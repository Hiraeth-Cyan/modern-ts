// ========================================
// ./src/Concurrent/Lock/semaphore.ts
// ========================================

import {ensureDOMException} from 'src/unknown-error';
import {UseAfterFreeError, LockError, ParameterError} from '../../Errors';

interface WaitingTask {
  resolve: () => void;
  reject: (reason: Error) => void;
  signal: AbortSignal | undefined;
  queue_index?: number;
}

/**
 * A counting semaphore with queue management and abort support.
 *
 * @remarks
 * - Maintains a counter of available permits (non-negative integer).
 * - `acquire()` decrements counter if >0; otherwise waits in FIFO queue.
 * - `release()` increments counter and wakes next waiter (if any).
 * - Supports `AbortSignal` for cancellation during wait.
 * - Implements `Disposable` and `AsyncDisposable` for resource cleanup.
 * - Throws {@link UseAfterFreeError} if accessed after disposal.
 * - Initial permits must be non-negative; default is 1 (binary semaphore).
 *
 * @example
 * ```typescript
 * // Limit concurrent operations to 3
 * const sem = new Semaphore(3);
 * await sem.acquire();
 * try { /* critical section with up to 3 concurrent executions *\/ } finally { sem.release(); }
 * ```
 */
export class Semaphore {
  private static readonly MIN_QUEUE_SIZE_FOR_COMPACTION = 64; // 最小队列长度触发压缩
  private static readonly WASTE_RATIO_THRESHOLD = 0.65; // 空间浪费比例阈值

  private permits: number;
  private waiting_queue: (WaitingTask | null)[] | null = [];
  private queue_head: number = 0;
  private is_disposed = false;

  public get isDisposed(): boolean {
    return this.is_disposed;
  }

  /**
   * Creates a semaphore with the given number of initial permits.
   * @param initialPermits - Must be >= 0. Default: 1 (acts like a mutex).
   * @param __IGNORED__ This parameter will be ignored, solely for seamless switching with `DEBUG_SEMAPHORE`.
   * @throws {ParameterError} If initialPermits is negative.
   */
  constructor(initialPermits: number = 1, __IGNORED__?: number) {
    if (initialPermits < 0 || Number.isNaN(initialPermits))
      throw new ParameterError(
        `Semaphore: \`initialPermits\` must be a non-negative number, but got ${initialPermits}`,
      );
    this.permits = initialPermits;
  }

  /** @throws {UseAfterFreeError} If semaphore has been disposed. */
  private throwIfDisposed(): void {
    if (this.is_disposed)
      throw new UseAfterFreeError(
        'Semaphore has been disposed and cannot be used.',
      );
  }

  /** 彻底清理任务引用，斩断闭包链 */
  private cleanup_task(task: WaitingTask): void {
    task.signal = undefined;
    task.queue_index = -1;
    // 斩断闭包引用链
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    (task as any).reject = null;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    (task as any).resolve = null;
  }

  /** 判断是否需要压缩队列（空间浪费超过阈值） */
  private should_compact(): boolean {
    if (this.queue_head < Semaphore.MIN_QUEUE_SIZE_FOR_COMPACTION) {
      return false;
    }

    const queue = this.waiting_queue!;
    const waste_ratio = this.queue_head / Math.max(1, queue.length);

    return (
      this.queue_head > Semaphore.MIN_QUEUE_SIZE_FOR_COMPACTION &&
      waste_ratio > Semaphore.WASTE_RATIO_THRESHOLD
    );
  }

  /** 压缩队列：移除 null 槽位，重置索引 */
  private compact_queue(): void {
    const queue = this.waiting_queue!;

    let write = 0;
    for (let i = this.queue_head; i < queue.length; i++) {
      const task = queue[i];
      if (task !== null) {
        queue[write] = task;
        task.queue_index = write;
        write++;
      }
    }

    queue.length = write;
    this.queue_head = 0;
  }

  /** 从队列中标记移除任务（设置为null） */
  private remove_task_from_queue(task: WaitingTask): void {
    const queue = this.waiting_queue!;
    queue[task.queue_index!] = null;
  }

  /**
   * Acquires a permit, waiting if necessary.
   *
   * @param signal - Optional `AbortSignal` to cancel waiting.
   * @returns A promise that resolves when a permit is acquired.
   * @throws {DOMException} With name `'AbortError'` if `signal` aborts before acquisition.
   * @throws {UseAfterFreeError} If semaphore is disposed while waiting.
   *
   * @remarks
   * - If `signal.aborted` is true on entry, throws immediately.
   * - Decrements internal permit counter on successful acquisition.
   * - Tasks are queued in FIFO order; resolved tasks are skipped (due to abort).
   */
  public async acquire(signal?: AbortSignal): Promise<void> {
    this.throwIfDisposed();

    // 快速路径：信号已中止时直接抛出错误
    if (signal?.aborted) {
      throw ensureDOMException(signal.reason);
    }

    // 快速路径：有可用许可时直接获取
    if (this.permits > 0) {
      this.permits--;
      return;
    }

    return new Promise<void>((resolve, reject) => {
      const queue = this.waiting_queue!;

      // 中止信号处理函数
      const on_abort = () => {
        this.remove_task_from_queue(task);
        // 立即移除监听器，防止内存泄漏
        signal!.removeEventListener('abort', on_abort);
        reject(ensureDOMException(signal!.reason));
      };

      const task: WaitingTask = {
        resolve: () => {
          // 任务被正常唤醒，移除中止监听器
          signal?.removeEventListener('abort', on_abort);
          resolve();
          this.cleanup_task(task);
        },
        reject: (reason: Error) => {
          // 任务被拒绝，移除中止监听器
          signal?.removeEventListener('abort', on_abort);
          reject(reason);
          this.cleanup_task(task);
        },
        signal,
        queue_index: queue.length,
      };

      // 注册中止监听器
      if (signal) {
        signal.addEventListener('abort', on_abort, {once: true});
      }

      queue.push(task);
    });
  }

  /**
   * Releases a permit and wakes the next waiting task (if any).
   *
   * @param count - Number of permits to release (default: 1). Must be >= 1.
   * @throws {ParameterError} If count is less than 1.
   * @throws {UseAfterFreeError} If semaphore has been disposed.
   *
   * @remarks
   * - Increments internal permit counter by `count`.
   * - Wakes up to `count` waiting tasks (FIFO order).
   * - If no waiters, permits accumulate for future acquisitions.
   * - Performs compaction after waking tasks if queue waste exceeds threshold.
   */
  public release(count: number = 1): void {
    this.throwIfDisposed();

    if (count < 1) {
      throw new ParameterError(
        `Semaphore: \`count\` must be at least 1, but got ${count}`,
      );
    }

    const queue = this.waiting_queue!;
    let released = 0;

    // 唤醒最多 count 个等待者
    while (released < count && this.queue_head < queue.length) {
      const task = queue[this.queue_head];
      queue[this.queue_head] = null; // 显式清空引用，帮助GC
      this.queue_head++;

      if (task !== null) {
        task.resolve();
        released++;
      }
    }

    // 剩余许可累加到计数器
    this.permits += count - released;

    // 唤醒后检查是否需要压缩
    if (released > 0 && this.should_compact()) {
      this.compact_queue();
    }

    // 队列完全清空时重置状态
    if (this.queue_head >= queue.length) {
      // 大队列完全释放底层数组内存
      if (queue.length > 1024) {
        this.waiting_queue = [];
      } else {
        queue.length = 0; // 小队列直接截断，避免分配开销
      }
      this.queue_head = 0;
    }
  }

  /**
   * Attempts to acquire a permit without waiting.
   *
   * @returns `true` if permit was acquired; `false` if no permits available.
   * @throws {UseAfterFreeError} If semaphore is disposed.
   */
  public tryAcquire(): boolean {
    this.throwIfDisposed();
    if (this.permits > 0) {
      this.permits--;
      return true;
    }
    return false;
  }

  /**
   * Dynamically updates the permit count.
   *
   * @param new_permits - New permit count. Must be non-negative.
   * @throws {ParameterError} If new_permits is negative or NaN.
   * @throws {UseAfterFreeError} If semaphore is disposed.
   *
   * @remarks
   * - If permits increase, wakes waiting tasks if any.
   * - If permits decrease, the counter is reduced (may go negative temporarily).
   */
  public resetPermits(new_permits: number): void {
    this.throwIfDisposed();

    if (new_permits < 0 || Number.isNaN(new_permits))
      throw new ParameterError(
        `Semaphore: \`new_permits\` must be a non-negative number, but got ${new_permits}`,
      );

    const old_permits = this.permits;
    this.permits = new_permits;

    // 如果 permits 增加且有等待者，尝试唤醒
    if (new_permits > old_permits && new_permits > 0) this.wakeWaiters();
  }

  /**
   * Returns the current permit count.
   *
   * @returns Current number of available permits.
   * @throws {UseAfterFreeError} If semaphore is disposed.
   */
  public getPermits(): number {
    this.throwIfDisposed();
    return this.permits;
  }

  /** 唤醒等待者（内部方法） */
  private wakeWaiters(): void {
    const queue = this.waiting_queue!;

    while (this.permits > 0 && this.queue_head < queue.length) {
      const task = queue[this.queue_head];
      queue[this.queue_head] = null;
      this.queue_head++;

      if (task !== null) {
        this.permits--;
        task.resolve();
      }
    }

    // 队列清理逻辑
    if (this.queue_head >= queue.length) {
      if (queue.length > 1024) this.waiting_queue = [];
      else queue.length = 0;
      this.queue_head = 0;
    }
  }

  /**
   * Executes a task with automatic permit acquisition and release.
   *
   * @template T - Return type of the task.
   * @param task - Function to execute with acquired permit(s).
   * @param signal - Optional `AbortSignal` to cancel waiting.
   * @returns Promise resolving to the result of `task`.
   *
   * @remarks
   * - Acquires permit before execution and releases after (even if task throws).
   * - If `signal` aborts before acquisition, the task is not executed.
   */
  public async withPermit<T>(
    task: () => Promise<T> | T,
    signal?: AbortSignal,
  ): Promise<T> {
    this.throwIfDisposed();

    await this.acquire(signal);
    try {
      return await task();
    } finally {
      this.release();
    }
  }

  /**
   * Returns internal statistics for monitoring.
   *
   * @returns Object containing queue metrics and state flags.
   *
   * @remarks
   * - `availablePermits`: current permit count (non-negative).
   * - `waitingQueueLength`: number of active (non‑null) waiting tasks.
   * - `queueCapacity`: total allocated slots (including null slots).
   * - `queueHead`: index of the first pending task.
   * - `isDisposed`: whether semaphore has been disposed.
   * - `compactionCounter`: internal compaction trigger counter.
   */
  public getStats() {
    if (this.is_disposed || !this.waiting_queue) {
      return {
        availablePermits: 0,
        waitingQueueLength: 0,
        queueCapacity: 0,
        queueHead: 0,
        isDisposed: true,
        compactionCounter: 0,
      };
    }

    let activeCount = 0;
    for (let i = this.queue_head; i < this.waiting_queue.length; i++) {
      if (this.waiting_queue[i] !== null) activeCount++;
    }

    return {
      availablePermits: this.permits,
      waitingQueueLength: activeCount,
      queueCapacity: this.waiting_queue.length,
      queueHead: this.queue_head,
      isDisposed: this.is_disposed,
    };
  }

  /**
   * Disposes the semaphore, rejecting all pending waiters.
   *
   * @remarks
   * - After disposal, all methods (except `dispose`) throw {@link UseAfterFreeError}.
   * - Pending tasks are rejected with an `AbortError` `DOMException`.
   * - Multiple calls are idempotent.
   * - Does NOT release accumulated permits (resources should be managed externally).
   */
  public dispose(): void {
    if (this.is_disposed) return;

    this.is_disposed = true;

    const queue = this.waiting_queue;

    // 拒绝所有活跃的等待任务
    for (let i = this.queue_head; i < queue!.length; i++) {
      const task = queue![i];
      if (task !== null) {
        // 任务会通过其内部的 reject 方法清理自身
        task.reject(new DOMException('Semaphore disposed', 'AbortError'));
      }
    }

    // 帮助 GC 回收内存
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
    this.waiting_queue = null as any;
    this.permits = 0; // 重置许可计数器
  }

  [Symbol.dispose](): void {
    this.dispose();
  }
}

/**
 * RAII guard for a {@link Semaphore} permit.
 *
 * @remarks
 * - Implements `Disposable` and `AsyncDisposable` for `using` statements.
 * - Automatically releases the permit when disposed.
 * - Throws {@link LockError} if `acquire` fails (no permits available).
 */
export class PermitGuard implements Disposable {
  #semaphore: Semaphore | null;
  #released = false;

  private constructor(semaphore: Semaphore) {
    this.#semaphore = semaphore;
  }

  /**
   * Attempts to acquire a permit immediately.
   *
   * @param semaphore - The semaphore to acquire from.
   * @returns A new `PermitGuard` holding the permit.
   * @throws {LockError} If no permits are available.
   */
  static acquire(semaphore: Semaphore): PermitGuard {
    if (!semaphore.tryAcquire()) {
      throw new LockError(
        'Failed to acquire semaphore permit immediately (no permits available)',
      );
    }
    return new PermitGuard(semaphore);
  }

  /**
   * Acquires a permit, waiting if necessary.
   *
   * @param semaphore - The semaphore to acquire from.
   * @param signal - Optional `AbortSignal` to cancel waiting.
   * @returns Promise resolving to a new `PermitGuard` holding the permit.
   */
  static async acquireAsync(
    semaphore: Semaphore,
    signal?: AbortSignal,
  ): Promise<PermitGuard> {
    await semaphore.acquire(signal);
    return new PermitGuard(semaphore);
  }

  [Symbol.dispose](): void {
    this.release();
  }

  /** Releases the permit if still held. Idempotent. */
  release(): void {
    if (!this.#released && this.#semaphore !== null) {
      this.#semaphore.release();
      this.#semaphore = null;
      this.#released = true;
    }
  }
}

/**
 * Debug version of {@link Semaphore} with timeout and stack‑trace tracking.
 *
 * @remarks
 * - Tracks stack traces for permit acquisition attempts.
 * - Throws descriptive {@link LockError} on timeout (potential resource starvation).
 * - Timeout measured from `acquire` call until permit acquisition.
 * - If both user `signal` and timeout fire, the first wins.
 */
export class DEBUG_SEMAPHORE extends Semaphore {
  private timeout_ms: number;

  /**
   * @param initialPermits - Initial permit count (default: 1).
   * @param timeout_ms - Timeout in milliseconds before throwing on acquire (default: 5000).
   */
  constructor(initialPermits: number = 1, timeout_ms: number = 5000) {
    super(initialPermits);
    this.timeout_ms = timeout_ms;
  }

  /**
   * @inheritdoc
   * @throws {LockError} If acquisition times out (with stack traces).
   */
  public async acquire(signal?: AbortSignal): Promise<void> {
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
      await super.acquire(combined_signal);
    } catch (err) {
      // 仅当超时触发时包装错误（用户中止保持不变）
      if (
        internal_controller.signal.aborted &&
        err instanceof DOMException &&
        err.name === 'AbortError'
      ) {
        throw new LockError(
          `[Semaphore Timeout] (${this.timeout_ms}ms) - No permits available\n` +
            `[Current Request Location]: ${current_stack}\n` +
            `Available Permits: ${this['permits']}\n` +
            `Waiting Queue Length: ${this.getStats().waitingQueueLength}`,
        );
      }
      throw err;
    } finally {
      clearTimeout(timer_id);
      internal_controller.abort();
    }
  }

  [Symbol.dispose](): void {
    super.dispose();
  }
}
