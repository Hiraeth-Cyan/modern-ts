// ========================================
// ./src/Concurrent/Valve/leaky-bucket.ts
// ========================================

import {ensureDOMException} from '../../unknown-error';
import {ParameterError, UseAfterFreeError} from '../../Errors';

// setTimeout 最大延迟值（约 24.8 天），超过此值会导致溢出
const MAX_SET_TIMEOUT_DELAY = 2147483647;

/**
 * Error thrown when a leaky bucket operation fails.
 * Indicates that the bucket is full and cannot accept more tokens.
 */
export class LeakyBucketReject extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LeakyBucketReject';
    /* v8 ignore next -- @preserve */
    if (typeof Error.captureStackTrace === 'function')
      Error.captureStackTrace(this, LeakyBucketReject);
  }
}

// -- 类型定义 --

interface LeakyBucketConfig {
  /** Maximum number of requests the bucket can hold */
  limit: number;
  /** Time interval in milliseconds to process one request from the bucket */
  interval: number;
}

// 队列项：存储每个等待请求的信息
interface WaitingTask {
  resolve: () => void;
  reject: (error: Error) => void;
  signal?: AbortSignal | undefined;
  // 记录索引位置，实现高效查找和移除
  queue_index: number;
}

/**
 * Leaky bucket algorithm implementation for rate limiting.
 *
 * Features:
 * - High-performance queue management (O(1) operations with auto-compaction).
 * - Supports `AbortSignal` for cancellation.
 * - Implements `Disposable` for resource cleanup.
 * - Provides `tryWait` for non-throwing acquisition attempts.
 *
 * @example
 * ```ts
 * const bucket = new LeakyBucket({limit: 10, interval: 100});
 *
 * // Standard wait
 * await bucket.wait();
 *
 * // Non-throwing try
 * const p = bucket.tryWait();
 * if (p) await p;
 * ```
 */
export class LeakyBucket {
  private static readonly MIN_QUEUE_SIZE_FOR_COMPACTION = 64;
  private static readonly WASTE_RATIO_THRESHOLD = 0.65;

  private waiting_queue: (WaitingTask | null)[] = [];
  private queue_head: number = 0;
  private active_count: number = 0; // 有效任务计数

  private next_process_time: number;
  private max_queue_size: number;
  private interval: number;
  private timer_id: ReturnType<typeof setTimeout> | null = null;
  private is_disposed: boolean = false;

  public get isDisposed(): boolean {
    return this.is_disposed;
  }

  constructor(config: LeakyBucketConfig) {
    const {limit, interval} = config;
    this.validateConfig(limit, interval);

    this.max_queue_size = limit;
    this.interval = interval;
    this.next_process_time = performance.now();
  }

  // ============================================
  // Public API
  // ============================================

  /**
   * Resets the rate limit configuration.
   * Queued requests continue to be processed at the new rate.
   */
  public resetRate(config: LeakyBucketConfig): void {
    if (this.is_disposed) return;

    const {limit, interval} = config;
    this.validateConfig(limit, interval);

    this.max_queue_size = limit;
    this.interval = interval;
    this.scheduleNextProcess();
  }

  /**
   * Waits until the request can be processed.
   * @param signal - Optional AbortSignal for cancellation
   * @throws {LeakyBucketReject} If the bucket is full
   * @throws {DOMException} If the signal is aborted
   */
  public wait(signal?: AbortSignal): Promise<void> {
    if (this.is_disposed)
      return Promise.reject(
        new UseAfterFreeError('LeakyBucket has been disposed.'),
      );
    if (signal?.aborted)
      return Promise.reject(ensureDOMException(signal.reason));

    if (this.active_count >= this.max_queue_size) {
      return Promise.reject(
        new LeakyBucketReject(
          `LeakyBucket: queue is full (${this.max_queue_size}), cannot accept more requests`,
        ),
      );
    }

    return this._enqueue(signal);
  }

  /**
   * Attempts to enqueue without throwing an error if the bucket is full.
   *
   * @param signal - Optional AbortSignal for cancellation
   * @returns A Promise if successfully queued, or `false` if the bucket is full.
   * @throws {DOMException} If the signal is aborted
   * @throws {UseAfterFreeError} If the bucket is disposed
   *
   * @example
   * const result = bucket.tryWait();
   * if (result) {
   *   await result; // Wait for turn
   *   // do work
   * } else {
   *   // Bucket is full, handle rejection logic
   * }
   */
  public tryWait(signal?: AbortSignal): Promise<void> | false {
    if (this.is_disposed)
      return Promise.reject(
        new UseAfterFreeError('LeakyBucket has been disposed.'),
      );

    if (signal?.aborted)
      return Promise.reject(ensureDOMException(signal.reason));

    if (this.active_count >= this.max_queue_size) {
      return false;
    }

    return this._enqueue(signal);
  }

  /**
   * Returns the current state statistics.
   */
  public getStats() {
    return {
      queue_size: this.active_count,
      queue_capacity: this.waiting_queue.length,
      max_queue_size: this.max_queue_size,
      interval: this.interval,
      next_process_time: this.next_process_time,
      isDisposed: this.is_disposed,
    };
  }

  /**
   * Disposes the bucket, rejecting all pending waiters and stopping the timer.
   */
  public dispose(): void {
    if (this.is_disposed) return;
    this.is_disposed = true;

    if (this.timer_id !== null) {
      clearTimeout(this.timer_id);
      this.timer_id = null;
    }

    // 拒绝所有活跃的等待任务
    for (let i = this.queue_head; i < this.waiting_queue.length; i++) {
      const task = this.waiting_queue[i];
      if (task !== null) {
        task.reject(new DOMException('LeakyBucket disposed', 'AbortError'));
        this.cleanupTask(task);
      }
    }

    this.waiting_queue = [];
    this.queue_head = 0;
    this.active_count = 0;
  }

  [Symbol.dispose](): void {
    this.dispose();
  }

  // ============================================
  // Private Methods
  // ============================================

  private validateConfig(limit: number, interval: number): void {
    if (
      !Number.isFinite(limit) ||
      limit <= 0 ||
      limit > Number.MAX_SAFE_INTEGER ||
      !Number.isInteger(limit)
    ) {
      const reason =
        limit > Number.MAX_SAFE_INTEGER
          ? `must be less than or equal to Number.MAX_SAFE_INTEGER`
          : `must be a positive finite number`;
      throw new ParameterError(
        `LeakyBucket: \`limit\` ${reason}, but got ${limit}`,
      );
    }
    if (!Number.isFinite(interval) || interval <= 0)
      throw new ParameterError(
        `LeakyBucket: \`interval\` must be a positive finite number, but got ${interval}`,
      );

    if (interval > MAX_SET_TIMEOUT_DELAY)
      throw new ParameterError(
        `LeakyBucket: \`interval\` exceeds the maximum safe timer delay (${MAX_SET_TIMEOUT_DELAY}ms).`,
      );
  }

  /**
   * Internal method to enqueue a task.
   */
  private _enqueue(signal?: AbortSignal): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const queue = this.waiting_queue;

      const on_abort = () => {
        this.removeTaskFromQueue(task);
        signal!.removeEventListener('abort', on_abort);
        reject(ensureDOMException(signal!.reason));
      };

      const task: WaitingTask = {
        resolve: () => {
          signal?.removeEventListener('abort', on_abort);
          resolve();
          this.cleanupTask(task);
        },
        reject: (reason: Error) => {
          signal?.removeEventListener('abort', on_abort);
          reject(reason);
          this.cleanupTask(task);
        },
        signal,
        queue_index: queue.length, // 初始位置在数组末尾
      };

      if (signal) {
        signal.addEventListener('abort', on_abort, {once: true});
      }

      queue.push(task);
      this.active_count++;
      this.scheduleNextProcess();
    });
  }

  private cleanupTask(task: WaitingTask): void {
    task.queue_index = -1;
    task.signal = undefined;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    (task as any).reject = null;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    (task as any).resolve = null;
  }

  /** Determines if queue compaction should be performed. */
  private shouldCompact(): boolean {
    // 避免频繁检查
    if (this.queue_head < LeakyBucket.MIN_QUEUE_SIZE_FOR_COMPACTION)
      return false;

    const queue = this.waiting_queue;
    const waste_ratio = this.queue_head / Math.max(1, queue.length);

    return (
      this.queue_head > LeakyBucket.MIN_QUEUE_SIZE_FOR_COMPACTION &&
      waste_ratio > LeakyBucket.WASTE_RATIO_THRESHOLD
    );
  }

  /** Compacts queue by removing null slots and resetting indices. */
  private compactQueue(): void {
    const queue = this.waiting_queue;

    // 原地压缩
    let write = 0;
    for (let i = this.queue_head; i < queue.length; i++) {
      const task = queue[i];
      if (task !== null) {
        queue[write] = task;
        task.queue_index = write; // 更新索引
        write++;
      }
    }

    // 直接截断数组
    queue.length = write;
    this.queue_head = 0;
  }

  /** Marks a task as null in the queue without shifting. */
  private removeTaskFromQueue(task: WaitingTask): void {
    const queue = this.waiting_queue;
    // 仅当任务在“已处理区域”之后才进行移除操作
    if (
      task.queue_index >= this.queue_head &&
      task.queue_index < queue.length
    ) {
      queue[task.queue_index] = null;
      this.active_count--;

      // 注意：这里不立即触发压缩，留给 processOne 或下次操作时处理
      // 如果 active_count 变为 0，且 queue_head 没动过，可以选择重置
      if (this.active_count === 0) {
        clearTimeout(this.timer_id!);
        this.timer_id = null;
        // 如果队列空了，且浪费空间大，直接重置
        if (queue.length > 1024) {
          this.waiting_queue = [];
          this.queue_head = 0;
        }
      }
    }
  }

  /**
   * 调度下一次队列处理
   */
  private scheduleNextProcess(): void {
    // 如果没有任务或已销毁，停止调度
    if (this.active_count === 0 || this.is_disposed) return;

    const now = performance.now();
    // 计算需要延迟的时间，确保至少有微小延迟避免循环过快
    const delay = Math.max(0, this.next_process_time - now);

    if (this.timer_id !== null) clearTimeout(this.timer_id);

    this.timer_id = setTimeout(() => this.processOne(), delay);
  }

  /**
   * 处理队列中的一个请求
   */
  private processOne(): void {
    this.timer_id = null;
    const queue = this.waiting_queue;

    // 查找下一个有效的等待者（跳过已被中止的null槽位）
    while (this.queue_head < queue.length) {
      const task = queue[this.queue_head];
      queue[this.queue_head] = null; // 显式清空引用
      this.queue_head++;

      if (task !== null) {
        this.active_count--;
        task.resolve();

        // 更新下一个处理时间
        this.next_process_time = performance.now() + this.interval;

        // 唤醒任务后检查是否需要压缩
        if (this.shouldCompact()) this.compactQueue();

        // 继续调度下一个
        this.scheduleNextProcess();
        return;
      }
    }
  }
}
