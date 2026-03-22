// ========================================
// ./src/Concurrent/Lock/mutex.ts
// ========================================

import {ensureDOMException} from 'src/unknown-error';
import {UseAfterFreeError, MutexError} from '../../Errors';

interface WaitingTask {
  resolve: () => void;
  reject: (reason: Error) => void;
  signal: AbortSignal | undefined;
  // 记录索引位置，实现高效查找
  queue_index: number;
}

/**
 * A mutual exclusion lock with queue management and abort support.
 *
 * @remarks
 * - Uses a queue to manage waiting tasks with efficient space reclamation.
 * - Supports `AbortSignal` for task cancellation.
 * - Implements `Disposable` and `AsyncDisposable` for resource cleanup.
 * - Throws {@link UseAfterFreeError} if accessed after disposal.
 * - Throws {@link MutexError} on invalid unlock attempts.
 *
 * @example
 * ```typescript
 * const mutex = new Mutex();
 * await mutex.lock();
 * try { /* critical section *\/ } finally { mutex.unlock(); }
 * ```
 */
export class Mutex {
  private static readonly MIN_QUEUE_SIZE_FOR_COMPACTION = 64; // 最小队列长度触发压缩
  private static readonly WASTE_RATIO_THRESHOLD = 0.65; // 空间浪费比例阈值

  private is_locked: boolean = false;
  private waiting_queue: (WaitingTask | null)[] | null = [];
  private queue_head: number = 0;
  private is_disposed = false;

  public get isDisposed(): boolean {
    return this.is_disposed;
  }

  public get isLocked(): boolean {
    return this.is_locked;
  }

  /** @throws {UseAfterFreeError} If mutex has been disposed. */
  private throwIfDisposed(): void {
    if (this.is_disposed)
      throw new UseAfterFreeError(
        'Mutex has been disposed and cannot be used.',
      );
  }

  /**
   * Create a Mutex
   * @param __IGNORED__ This parameter will be ignored, solely for seamless switching with `DEBUG_MUTEX`.
   */
  constructor(__IGNORED__?: number) {}

  private cleanupTask(task: WaitingTask): void {
    task.queue_index = -1;
    task.signal = undefined;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    (task as any).resolve = null;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    (task as any).reject = null;
  }

  /** Determines if queue compaction should be performed. */
  private shouldCompact(): boolean {
    // 避免频繁检查
    if (this.queue_head < Mutex.MIN_QUEUE_SIZE_FOR_COMPACTION) {
      return false;
    }

    const queue = this.waiting_queue!;
    const waste_ratio = this.queue_head / Math.max(1, queue.length);

    return (
      this.queue_head > Mutex.MIN_QUEUE_SIZE_FOR_COMPACTION &&
      waste_ratio > Mutex.WASTE_RATIO_THRESHOLD
    );
  }

  /** Compacts queue by removing null slots and resetting indices. */
  private compactQueue(): void {
    const queue = this.waiting_queue!;

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
    const queue = this.waiting_queue!;
    queue[task.queue_index] = null;
  }

  /**
   * Acquires the lock, waiting if necessary.
   *
   * @param signal - Optional `AbortSignal` to cancel waiting.
   * @returns A promise that resolves when lock is acquired.
   * @throws {DOMException} With name `'AbortError'` if `signal` aborts before acquisition.
   * @throws {UseAfterFreeError} If mutex is disposed while waiting.
   *
   * @remarks
   * - If `signal.aborted` is true on entry, throws immediately.
   * - Tasks are queued in FIFO order; resolved tasks are skipped (due to abort).
   */
  public async lock(signal?: AbortSignal): Promise<void> {
    this.throwIfDisposed();

    // 优先检查外部中止信号
    if (signal?.aborted) {
      throw ensureDOMException(signal.reason);
    }

    // 快速路径：无竞争时直接获取锁
    if (!this.is_locked) {
      this.is_locked = true;
      return;
    }

    return new Promise<void>((resolve, reject) => {
      const queue = this.waiting_queue!;

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
        queue_index: queue.length,
      };

      if (signal) {
        signal.addEventListener('abort', on_abort, {once: true});
      }
      queue.push(task);
    });
  }

  /**
   * Releases the lock and wakes the next waiting task.
   *
   * @throws {MutexError} If the mutex is not currently locked.
   * @throws {UseAfterFreeError} If mutex has been disposed.
   *
   * @remarks
   * - If queue is empty after unlock, resets internal state and may shrink storage.
   * - Performs compaction if queue waste exceeds threshold.
   */
  public unlock(): void {
    this.throwIfDisposed();

    if (!this.is_locked) throw new MutexError('Mutex is not locked!');

    const queue = this.waiting_queue!;

    // 查找下一个有效的等待者（跳过已被中止的null槽位）
    while (this.queue_head < queue.length) {
      const task = queue[this.queue_head];
      queue[this.queue_head] = null; // 显式清空引用，帮助GC
      this.queue_head++;

      if (task !== null) {
        task.resolve();
        // 唤醒任务后检查是否需要压缩（避免在临界区频繁触发）
        if (this.shouldCompact()) this.compactQueue();
        return;
      }
    }

    if (queue.length > 1024) {
      this.waiting_queue = []; // 彻底释放底层数组内存
    } else {
      queue.length = 0; // 小队列直接截断，避免分配开销
    }

    // 重置所有状态标记
    this.queue_head = 0;
    this.is_locked = false; // 释放锁状态
  }

  /**
   * Executes a task with automatic lock acquisition and release.
   *
   * @template T - Return type of the task.
   * @param task - Function to execute in critical section.
   * @param signal - Optional `AbortSignal` to cancel waiting.
   * @returns Promise resolving to the result of `task`.
   *
   * @remarks
   * - Lock is acquired before execution and released after (even if task throws).
   * - If `signal` aborts before lock acquisition, the task is not executed.
   */
  public async withLock<T>(
    task: () => Promise<T> | T,
    signal?: AbortSignal,
  ): Promise<T> {
    this.throwIfDisposed();

    await this.lock(signal);
    try {
      return await task();
    } finally {
      this.unlock();
    }
  }

  /**
   * Attempts to acquire the lock without waiting.
   *
   * @returns `true` if lock was acquired; `false` if already locked.
   */
  public tryLock(): boolean {
    this.throwIfDisposed();

    if (!this.is_locked) {
      this.is_locked = true;
      return true;
    }
    return false;
  }

  /**
   * Returns internal statistics for monitoring.
   *
   * @returns Object containing queue metrics and state flags.
   *
   * @remarks
   * - `waitingQueueLength`: number of active (non‑null) waiting tasks.
   * - `queueCapacity`: total allocated slots (including null slots).
   * - `queueHead`: index of the first pending task.
   * - `isLocked`: current lock state.
   * - `isDisposed`: whether mutex has been disposed.
   * - `compactionCounter`: internal compaction trigger counter.
   */
  public getStats() {
    if (this.is_disposed || !this.waiting_queue) {
      return {
        waitingQueueLength: 0,
        queueCapacity: 0,
        queueHead: 0,
        isLocked: this.is_locked,
        isDisposed: true,
        compactionCounter: 0,
      };
    }

    let activeCount = 0;
    // 仅统计有效任务
    for (let i = this.queue_head; i < this.waiting_queue.length; i++) {
      if (this.waiting_queue[i] !== null) activeCount++;
    }

    return {
      waitingQueueLength: activeCount,
      queueCapacity: this.waiting_queue.length,
      queueHead: this.queue_head,
      isLocked: this.is_locked,
      isDisposed: this.is_disposed,
    };
  }

  /**
   * Disposes the mutex, rejecting all pending waiters.
   *
   * @remarks
   * - After disposal, all methods (except `dispose`) throw {@link UseAfterFreeError}.
   * - Pending tasks are rejected with an `AbortError` `DOMException`.
   * - Multiple calls are idempotent.
   */
  public dispose(): void {
    if (this.is_disposed) return;

    this.is_disposed = true;

    const queue = this.waiting_queue;

    // 拒绝所有活跃的等待任务
    for (let i = this.queue_head; i < queue!.length; i++) {
      const task = queue![i];
      if (task !== null) {
        task.reject(new DOMException('Mutex disposed', 'AbortError'));
        this.cleanupTask(task);
      }
    }
    this.waiting_queue = null; // 帮助GC

    this.is_locked = false;
  }

  [Symbol.dispose](): void {
    this.dispose();
  }
}

/**
 * RAII guard for a {@link Mutex} lock.
 *
 * @remarks
 * - Implements `Disposable` and `AsyncDisposable` for `using` statements.
 * - Automatically releases the lock when disposed.
 * - Throws {@link MutexError} if `acquire` fails (lock already held).
 */
export class LockGuard implements Disposable {
  #mutex: Mutex | null;

  private constructor(mutex: Mutex) {
    this.#mutex = mutex;
  }

  /**
   * Attempts to acquire the mutex immediately.
   *
   * @param mutex - The mutex to lock.
   * @returns A new `LockGuard` holding the lock.
   * @throws {MutexError} If the mutex is already locked.
   */
  static acquire(mutex: Mutex): LockGuard {
    if (!mutex.tryLock()) {
      throw new MutexError(
        'Failed to acquire mutex immediately (already locked)',
      );
    }
    return new LockGuard(mutex);
  }

  /**
   * Acquires the mutex, waiting if necessary.
   *
   * @param mutex - The mutex to lock.
   * @param signal - Optional `AbortSignal` to cancel waiting.
   * @returns Promise resolving to a new `LockGuard` holding the lock.
   *
   * @remarks
   * - If `signal` aborts before acquisition, the mutex remains unchanged.
   */
  static async acquireAsync(
    mutex: Mutex,
    signal?: AbortSignal,
  ): Promise<LockGuard> {
    await mutex.lock(signal);
    return new LockGuard(mutex);
  }

  [Symbol.dispose](): void {
    this.release();
  }

  /** Releases the lock if still held. Idempotent. */
  release(): void {
    if (this.#mutex !== null) {
      this.#mutex.unlock();
      this.#mutex = null;
    }
  }
}

/**
 * Debug version of {@link Mutex} with timeout and stack‑trace tracking.
 *
 * @remarks
 * - Tracks the stack trace of the current lock holder.
 * - Throws a descriptive {@link MutexError} on timeout (potential deadlock).
 * - Timeout is measured from the call to `lock` until acquisition.
 * - If both a user `signal` and timeout fire, the first wins.
 */
export class DEBUG_MUTEX extends Mutex {
  private owner_stack: string | undefined = undefined;
  private timeout_ms: number;

  /**
   * @param timeout_ms - Timeout in milliseconds before throwing on lock acquisition.
   */
  constructor(timeout_ms: number = 5000) {
    super();
    this.timeout_ms = timeout_ms;
  }

  /**
   * @inheritdoc
   * @throws {MutexError} If acquisition times out (with stack traces).
   *
   * @remarks
   * - On timeout, the error includes the current request stack and holder stack (if any).
   * - If the user's `signal` aborts, throws a standard `AbortError` `DOMException`.
   */
  public async lock(signal?: AbortSignal): Promise<void> {
    const current_stack = new Error().stack;
    // 创建超时信号
    const internal_controller = new AbortController();

    // 手动开启计时器
    const timer_id = setTimeout(() => {
      internal_controller.abort();
    }, this.timeout_ms);

    // 合并用户传入的信号和超时信号
    const combined_signal = signal
      ? AbortSignal.any([signal, internal_controller.signal])
      : internal_controller.signal;

    try {
      await super.lock(combined_signal);
    } catch (err) {
      // 如果是超时导致的 AbortError，包装为带有详细堆栈的 MutexError
      if (
        internal_controller.signal.aborted &&
        err instanceof DOMException &&
        err.name === 'AbortError'
      ) {
        throw new MutexError(
          `[Mutex Deadlock/Timeout] (${this.timeout_ms}ms)\n` +
            `[Current Request Location]: ${current_stack}\n` +
            `Holder stack: ${this.owner_stack || 'Unknown'}`,
        );
      }
      // 否则直接抛出原错误（例如用户手动 Abort）
      throw err;
    } finally {
      clearTimeout(timer_id);
      internal_controller.abort();
    }

    // 成功获取后，记录持有者
    this.owner_stack = current_stack;
  }

  /** @inheritdoc */
  public unlock(): void {
    super.unlock();
    this.owner_stack = undefined; // 释放后清除
  }

  [Symbol.dispose](): void {
    super.dispose();
    this.owner_stack = undefined;
  }
}
