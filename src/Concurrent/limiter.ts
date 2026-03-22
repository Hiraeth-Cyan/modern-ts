// ========================================
// ./src/Concurrent/limiter.ts
// ========================================

import {ParameterError} from '../Errors';
import {ensureDOMException} from '../unknown-error';

// -- 队列项 --
interface QueueItem {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  signal: AbortSignal | undefined;
  task: (() => unknown) | null;
  queue_index: number;
  is_wait: boolean;
  on_abort: (() => void) | undefined;
}

/**
 * Statistics about the current state of a Limiter.
 */
interface LimiterStats {
  /** Maximum number of concurrent tasks allowed. */
  concurrency: number;
  /** Number of currently executing tasks. */
  active: number;
  /** Number of tasks waiting in the queue. */
  pending: number;
  /** Whether the limiter is paused. */
  isPaused: boolean;
}

/**
 * A concurrency limiter that controls the number of simultaneous async operations.
 *
 * @remarks
 * - Uses a queue to manage pending tasks with efficient space reclamation.
 * - Supports `AbortSignal` for task cancellation.
 * - Allows dynamic adjustment of concurrency limits.
 * - Supports pause/resume for flow control.
 *
 * @example
 * ```typescript
 * const limiter = new Limiter(3);
 * const results = await Promise.all([
 *   limiter.add(() => fetch('/api/1')),
 *   limiter.add(() => fetch('/api/2')),
 *   limiter.add(() => fetch('/api/3')),
 * ]);
 * ```
 */
export class Limiter {
  // -- 队列压缩阈值 --
  private static readonly MIN_QUEUE_SIZE_FOR_COMPACTION = 64;
  private static readonly WASTE_RATIO_THRESHOLD = 0.65;

  // -- 实例状态 --
  private concurrency_limit: number;
  private active_count: number = 0;
  private pending_count: number = 0;
  private queue: (QueueItem | null)[] = [];
  private queue_head: number = 0;
  private is_paused: boolean = false;
  private idle_resolvers: Array<() => void> = [];

  /**
   * Creates a new Limiter instance.
   *
   * @param concurrency - The maximum number of concurrent tasks.
   * @throws ParameterError if concurrency is not a non-negative integer.
   */
  constructor(concurrency: number) {
    if (
      (!Number.isInteger(concurrency) && concurrency !== Infinity) ||
      concurrency < 0 ||
      Number.isNaN(concurrency)
    )
      throw new ParameterError('Concurrency must be a non-negative integer');

    this.concurrency_limit = concurrency;
  }

  /**
   * Gets the current concurrency limit.
   *
   * @returns The maximum number of concurrent tasks.
   */
  public getConcurrency(): number {
    return this.concurrency_limit;
  }

  /**
   * Gets the current state of the limiter.
   */
  public get stats(): LimiterStats {
    return {
      concurrency: this.concurrency_limit,
      active: this.active_count,
      pending: this.pending_count,
      isPaused: this.is_paused,
    };
  }

  // 判断是否需要压缩队列
  private shouldCompact(): boolean {
    if (this.queue_head < Limiter.MIN_QUEUE_SIZE_FOR_COMPACTION) return false;

    const waste_ratio = this.queue_head / Math.max(1, this.queue.length);
    return (
      this.queue_head > Limiter.MIN_QUEUE_SIZE_FOR_COMPACTION &&
      waste_ratio > Limiter.WASTE_RATIO_THRESHOLD
    );
  }

  // 压缩队列，移除已处理的空位
  private compactQueue(): void {
    let write = 0;
    for (let i = this.queue_head; i < this.queue.length; i++) {
      const item = this.queue[i];
      if (item !== null) {
        this.queue[write] = item;
        item.queue_index = write;
        write++;
      }
    }
    this.queue.length = write;
    this.queue_head = 0;
  }

  // 从队列中移除指定项
  private removeItemFromQueue(item: QueueItem): void {
    this.queue[item.queue_index] = null;
    this.pending_count--;
  }

  // 清理队列项的引用
  private cleanupItem(item: QueueItem): void {
    item.queue_index = -1;
    item.signal = undefined;
    item.task = null;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    (item as any).resolve = null;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    (item as any).reject = null;
  }

  // 尝试启动下一个待处理任务
  private tryStartNext(): void {
    if (this.is_paused) return;

    while (this.active_count < this.concurrency_limit) {
      let item: QueueItem | null = null;

      while (this.queue_head < this.queue.length) {
        item = this.queue[this.queue_head];
        this.queue[this.queue_head] = null;
        this.queue_head++;

        if (item !== null) {
          this.pending_count--;
          break;
        }
      }

      if (item === null) {
        if (this.queue.length > 1024) {
          this.queue = [];
        } else {
          this.queue.length = 0;
        }
        this.queue_head = 0;
        break;
      }

      this.active_count++;

      if (item.is_wait) {
        item.resolve(undefined);
        this.cleanupItem(item);
      } else {
        this.executeTask(item);
      }

      if (this.shouldCompact()) this.compactQueue();
    }
  }

  // 执行任务
  private executeTask(item: QueueItem): void {
    item.signal?.removeEventListener('abort', item.on_abort!);
    const run = async () => {
      try {
        const task = item.task!;
        const result = await task();
        item.resolve(result);
      } catch (err) {
        item.reject(err as Error);
      } finally {
        this.cleanupItem(item);
        this.active_count--;
        this.tryStartNext();
        this.checkIdle();
      }
    };
    void run();
  }

  // 检查是否空闲，触发空闲回调
  private checkIdle(): void {
    if (this.active_count === 0 && this.stats.pending === 0) {
      const resolvers = this.idle_resolvers;
      this.idle_resolvers = [];
      for (const resolve of resolvers) resolve();
    }
  }

  /**
   * Adds a task to the limiter for execution.
   *
   * @template T - Return type of the task.
   * @param task - Function to execute.
   * @param signal - Optional `AbortSignal` to cancel the task.
   * @returns Promise resolving to the result of `task`.
   * @throws {DOMException} With name `'AbortError'` if `signal` aborts.
   */
  public add<T>(task: () => Promise<T> | T, signal?: AbortSignal): Promise<T> {
    if (signal?.aborted)
      return Promise.reject(ensureDOMException(signal.reason));

    return new Promise<T>((resolve, reject) => {
      const queue = this.queue;

      const on_abort = () => {
        this.removeItemFromQueue(item);
        signal!.removeEventListener('abort', on_abort);
        reject(ensureDOMException(signal!.reason));
      };

      const item: QueueItem = {
        resolve: (v: unknown) => {
          signal?.removeEventListener('abort', on_abort);
          resolve(v as T);
        },
        reject: (err: Error) => {
          signal?.removeEventListener('abort', on_abort);
          reject(err);
        },
        signal,
        task,
        queue_index: queue.length,
        is_wait: false,
        on_abort,
      };

      if (signal) signal.addEventListener('abort', on_abort, {once: true});

      queue.push(item);
      this.pending_count++;
      this.tryStartNext();
    });
  }

  /**
   * Waits for an available slot and returns a release function.
   *
   * @param signal - Optional `AbortSignal` to cancel waiting.
   * @returns Promise resolving to a release function.
   * @throws {DOMException} With name `'AbortError'` if `signal` aborts.
   *
   * @remarks
   * - The release function is idempotent - calling it multiple times has no additional effect.
   * - Use this for manual slot management instead of `add()`.
   */
  public async wait(signal?: AbortSignal): Promise<() => void> {
    if (signal?.aborted) throw ensureDOMException(signal.reason);

    return new Promise<() => void>((resolve, reject) => {
      const queue = this.queue;

      const on_abort = () => {
        this.removeItemFromQueue(item);
        signal!.removeEventListener('abort', on_abort);
        reject(ensureDOMException(signal!.reason));
      };

      const item: QueueItem = {
        resolve: () => {
          signal?.removeEventListener('abort', on_abort);
          resolve(release);
        },
        reject: (err: Error) => {
          signal?.removeEventListener('abort', on_abort);
          reject(err);
        },
        signal,
        task: null,
        queue_index: queue.length,
        is_wait: true,
        on_abort,
      };

      let released = false;
      const release = () => {
        if (released) return;
        released = true;
        this.active_count--;
        this.tryStartNext();
        this.checkIdle();
      };

      if (signal) signal.addEventListener('abort', on_abort, {once: true});

      queue.push(item);
      this.pending_count++;
      this.tryStartNext();
    });
  }

  /**
   * Dynamically adjusts the concurrency limit.
   *
   * @param new_concurrency - The new concurrency limit.
   * @throws {ParameterError} If `new_concurrency` is invalid.
   *
   * @remarks
   * - Increasing the limit may immediately start pending tasks.
   * - Decreasing the limit does not affect running tasks.
   */
  public resetLimits(new_concurrency: number): void {
    if (
      (!Number.isInteger(new_concurrency) && new_concurrency !== Infinity) ||
      new_concurrency < 0 ||
      Number.isNaN(new_concurrency)
    )
      throw new ParameterError('Concurrency must be a non-negative integer');

    this.concurrency_limit = new_concurrency;
    this.tryStartNext();
  }

  /**
   * Waits until all active and pending tasks are complete.
   *
   * @returns Promise that resolves when the limiter is idle.
   */
  public async onIdle(): Promise<void> {
    if (this.active_count === 0 && this.stats.pending === 0) return;
    return new Promise<void>((resolve) => {
      this.idle_resolvers.push(resolve);
    });
  }

  /**
   * Clears all pending tasks from the queue.
   *
   * @remarks
   * - All pending tasks are rejected with an `AbortError` `DOMException`.
   * - Active tasks continue running.
   */
  public clear(): void {
    for (let i = this.queue_head; i < this.queue.length; i++) {
      const item = this.queue[i];
      if (item !== null) {
        item.reject(
          new DOMException('The operation was aborted', 'AbortError'),
        );
        this.cleanupItem(item);
      }
    }

    if (this.queue.length > 1024) {
      this.queue = [];
    } else {
      this.queue.length = 0;
    }
    this.queue_head = 0;
    this.pending_count = 0;
    this.checkIdle();
  }

  /**
   * Pauses task processing.
   *
   * @remarks
   * - New tasks will be queued but not started.
   * - Active tasks continue running.
   */
  public pause(): void {
    this.is_paused = true;
  }

  /**
   * Resumes task processing.
   *
   * @remarks
   * - Idempotent - calling multiple times has no additional effect.
   * - May immediately start pending tasks if slots are available.
   */
  public resume(): void {
    this.is_paused = false;
    this.tryStartNext();
  }
}
