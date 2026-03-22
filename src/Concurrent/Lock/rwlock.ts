// ========================================
// ./src/Concurrent/Lock/rwlock.ts
// ========================================

import {ensureDOMException} from 'src/unknown-error';
import {UseAfterFreeError, RWLockError} from '../../Errors';

/** Lock mode type: 0 for read, 1 for write. */
type LockMode = 0 | 1;

interface WaitingTask {
  resolve: () => void;
  reject: (reason: Error) => void;
  signal: AbortSignal | undefined;
  mode: LockMode;
  // Record index position for efficient lookup
  queue_index: number;
}

/**
 * A fair read-write lock implementation with queue management and abort support.
 *
 * @remarks
 * - Provides exclusive write access or shared read access to a resource.
 * - Uses a queue-based fairness algorithm to prevent writer starvation.
 * - Supports `AbortSignal` for task cancellation.
 * - Implements `Disposable` and `AsyncDisposable` for resource cleanup.
 * - Throws {@link UseAfterFreeError} if accessed after disposal.
 * - Throws {@link RWLockError} on invalid unlock attempts.
 *
 * @example
 * ```typescript
 * const rwlock = new ReadWriteLock();
 * await rwlock.readLock();
 * try { /* read operation *\/ } finally { rwlock.unlock(); }
 * ```
 */
export class ReadWriteLock {
  private static readonly MIN_QUEUE_SIZE_FOR_COMPACTION = 64; // 最小队列长度触发压缩
  private static readonly WASTE_RATIO_THRESHOLD = 0.65; // 空间浪费比例阈值

  protected active_readers: number = 0;
  protected active_writer: boolean = false;
  private waiting_queue: (WaitingTask | null)[] | null = [];
  private queue_head: number = 0;
  private is_disposed = false;

  /** Indicates whether the lock has been disposed. */
  public get isDisposed(): boolean {
    return this.is_disposed;
  }

  /** Indicates whether the lock is currently held (by readers or a writer). */
  public get isLocked(): boolean {
    return this.active_writer || this.active_readers > 0;
  }

  /** Indicates whether the lock is currently held by a writer. */
  public get isWriteLocked(): boolean {
    return this.active_writer;
  }

  /** Returns the number of active readers currently holding the lock. */
  public get readerCount(): number {
    return this.active_readers;
  }

  /** @throws {UseAfterFreeError} If lock has been disposed. */
  private throwIfDisposed(): void {
    if (this.is_disposed)
      throw new UseAfterFreeError(
        'ReadWriteLock has been disposed and cannot be used.',
      );
  }

  /**
   * Create a ReadWriteLock
   * @param __IGNORED__ This parameter will be ignored, solely for seamless switching with `DEBUG_RW_LOCK`.
   */
  constructor(__IGNORED__?: number) {}

  /** 彻底清理任务引用，斩断闭包链 */
  private cleanupTask(task: WaitingTask): void {
    task.queue_index = -1;
    task.signal = undefined;
    // 斩断闭包引用链，帮助GC
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    (task as any).resolve = null;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    (task as any).reject = null;
  }

  /** 判断是否需要压缩队列（空间浪费超过阈值） */
  private shouldCompact(): boolean {
    // 避免频繁检查
    if (this.queue_head < ReadWriteLock.MIN_QUEUE_SIZE_FOR_COMPACTION) {
      return false;
    }

    const queue = this.waiting_queue!;
    const waste_ratio = this.queue_head / Math.max(1, queue.length);

    return (
      this.queue_head > ReadWriteLock.MIN_QUEUE_SIZE_FOR_COMPACTION &&
      waste_ratio > ReadWriteLock.WASTE_RATIO_THRESHOLD
    );
  }

  /** 压缩队列：移除 null 槽位，重置索引 */
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

    queue.length = write; // 直接截断数组
    this.queue_head = 0;
  }

  /** 从队列中移除任务（标记为 null） */
  private removeTaskFromQueue(task: WaitingTask): void {
    const queue = this.waiting_queue!;
    queue[task.queue_index] = null;
  }

  /** 唤醒队列中的等待任务 */
  private drainQueue(): void {
    const queue = this.waiting_queue!;

    while (this.queue_head < queue.length) {
      const task = queue[this.queue_head];
      if (task === null) {
        // 跳过已取消的任务槽位
        this.queue_head++;
        continue;
      }

      if (task.mode === 1) {
        // 写锁：需要确保没有活跃读者
        if (this.active_readers > 0) {
          break; // 有读者持有锁，不能唤醒写者
        }

        // 唤醒写者
        queue[this.queue_head] = null; // 显式清空引用，帮助GC
        this.queue_head++;
        this.active_writer = true;
        task.resolve();
        break; // 写者独占，唤醒一个就停止
      } else {
        // 读锁：可以同时唤醒多个读者
        queue[this.queue_head] = null; // 显式清空引用，帮助GC
        this.queue_head++;
        this.active_readers++;
        task.resolve();
        // 继续循环，尝试唤醒队列中连续的更多读者
      }
    }

    // 队列处理完毕，清理存储
    if (this.queue_head >= queue.length) {
      if (queue.length > 1024) {
        this.waiting_queue = []; // 彻底释放底层数组内存
      } else {
        queue.length = 0; // 小队列直接截断，避免分配开销
      }
      this.queue_head = 0;
    } else if (this.shouldCompact()) {
      // 队列浪费严重，进行压缩
      this.compactQueue();
    }
  }

  /** 将任务加入队列并返回等待 Promise */
  private enqueueTask(mode: LockMode, signal?: AbortSignal): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const queue = this.waiting_queue!;

      const task: WaitingTask = {
        resolve: () => {
          // 立即移除监听器，防止内存泄漏
          signal?.removeEventListener('abort', on_abort);
          resolve();
          this.cleanupTask(task);
        },
        reject: (reason: Error) => {
          // 立即移除监听器，防止内存泄漏
          signal?.removeEventListener('abort', on_abort);
          reject(reason);
          this.cleanupTask(task);
        },
        signal,
        mode,
        queue_index: queue.length,
      };

      const on_abort = () => {
        this.removeTaskFromQueue(task);
        // 注意：这里不要立即调用 task.reject，因为 task.reject 会移除监听器
        // 我们手动调用 reject 并传入 AbortError
        reject(ensureDOMException(signal?.reason));
      };

      if (signal) {
        signal.addEventListener('abort', on_abort, {once: true});
      }

      queue.push(task);
    });
  }

  /**
   * Acquires a read lock (shared access).
   *
   * @param signal - Optional `AbortSignal` to cancel waiting.
   * @returns A promise that resolves when read lock is acquired.
   * @throws {DOMException} With name `'AbortError'` if `signal` aborts before acquisition.
   * @throws {UseAfterFreeError} If lock is disposed while waiting.
   *
   * @remarks
   * - Multiple readers can hold the lock simultaneously.
   * - If a writer is queued before the reader, the reader will wait (fairness).
   */
  public async readLock(signal?: AbortSignal): Promise<void> {
    this.throwIfDisposed();

    // 优先检查外部中止信号
    if (signal?.aborted) {
      throw ensureDOMException(signal.reason);
    }

    // 快速路径：没有写者，且队列为空（公平性：新读者必须排队如果有等待者）
    if (!this.active_writer && this.queue_head === this.waiting_queue!.length) {
      this.active_readers++;
      return;
    }

    await this.enqueueTask(0, signal);
  }

  /**
   * Acquires a write lock (exclusive access).
   *
   * @param signal - Optional `AbortSignal` to cancel waiting.
   * @returns A promise that resolves when write lock is acquired.
   * @throws {DOMException} With name `'AbortError'` if `signal` aborts before acquisition.
   * @throws {UseAfterFreeError} If lock is disposed while waiting.
   *
   * @remarks
   * - Only one writer can hold the lock at a time.
   * - Writers wait for all current readers to release the lock.
   */
  public async writeLock(signal?: AbortSignal): Promise<void> {
    this.throwIfDisposed();

    // 优先检查外部中止信号
    if (signal?.aborted) {
      throw ensureDOMException(signal.reason);
    }

    // 快速路径：没有读者，没有写者，且队列为空
    if (
      !this.active_writer &&
      this.active_readers === 0 &&
      this.queue_head === this.waiting_queue!.length
    ) {
      this.active_writer = true;
      return;
    }

    await this.enqueueTask(1, signal);
  }

  /**
   * Releases the currently held lock.
   *
   * @throws {RWLockError} If the lock is not currently held.
   * @throws {UseAfterFreeError} If lock has been disposed.
   *
   * @remarks
   * - Automatically detects whether to release a read or write lock.
   * - Wakes waiting tasks according to fairness rules.
   */
  public unlock(): void {
    this.throwIfDisposed();

    if (this.active_writer) {
      this.active_writer = false;
      this.drainQueue();
    } else if (this.active_readers > 0) {
      this.active_readers--;
      if (this.active_readers === 0) {
        this.drainQueue();
      }
    } else {
      throw new RWLockError('ReadWriteLock is not locked!');
    }
  }

  /**
   * Executes a task with automatic read lock acquisition and release.
   *
   * @template T - Return type of the task.
   * @param task - Function to execute while holding read lock.
   * @param signal - Optional `AbortSignal` to cancel waiting.
   * @returns Promise resolving to the result of `task`.
   *
   * @remarks
   * - Read lock is acquired before execution and released after (even if task throws).
   * - If `signal` aborts before lock acquisition, the task is not executed.
   */
  public async withReadLock<T>(
    task: () => Promise<T> | T,
    signal?: AbortSignal,
  ): Promise<T> {
    this.throwIfDisposed();

    await this.readLock(signal);
    try {
      return await task();
    } finally {
      this.unlock();
    }
  }

  /**
   * Executes a task with automatic write lock acquisition and release.
   *
   * @template T - Return type of the task.
   * @param task - Function to execute while holding write lock.
   * @param signal - Optional `AbortSignal` to cancel waiting.
   * @returns Promise resolving to the result of `task`.
   *
   * @remarks
   * - Write lock is acquired before execution and released after (even if task throws).
   * - If `signal` aborts before lock acquisition, the task is not executed.
   */
  public async withWriteLock<T>(
    task: () => Promise<T> | T,
    signal?: AbortSignal,
  ): Promise<T> {
    this.throwIfDisposed();

    await this.writeLock(signal);
    try {
      return await task();
    } finally {
      this.unlock();
    }
  }

  /**
   * Attempts to acquire a read lock without waiting.
   *
   * @returns `true` if read lock was acquired; `false` if not available.
   * @throws {UseAfterFreeError} If lock has been disposed.
   */
  public tryReadLock(): boolean {
    this.throwIfDisposed();

    if (!this.active_writer && this.queue_head === this.waiting_queue!.length) {
      this.active_readers++;
      return true;
    }
    return false;
  }

  /**
   * Attempts to acquire a write lock without waiting.
   *
   * @returns `true` if write lock was acquired; `false` if not available.
   * @throws {UseAfterFreeError} If lock has been disposed.
   */
  public tryWriteLock(): boolean {
    this.throwIfDisposed();

    if (
      !this.active_writer &&
      this.active_readers === 0 &&
      this.queue_head === this.waiting_queue!.length
    ) {
      this.active_writer = true;
      return true;
    }
    return false;
  }

  /**
   * Returns internal statistics for monitoring.
   *
   * @returns Object containing active/waiting reader/writer counts and state flags.
   *
   * @remarks
   * - `activeReaders`: number of active readers holding the lock.
   * - `activeWriter`: whether a writer currently holds the lock.
   * - `waitingReaders`: number of readers waiting in queue.
   * - `waitingWriters`: number of writers waiting in queue.
   * - `queueLength`: total number of waiting tasks (including null slots).
   * - `isDisposed`: whether lock has been disposed.
   */
  public getStats() {
    if (this.is_disposed || !this.waiting_queue) {
      return {
        activeReaders: 0,
        activeWriter: false,
        waitingReaders: 0,
        waitingWriters: 0,
        queueLength: 0,
        isDisposed: true,
      };
    }

    let waitingReaders = 0;
    let waitingWriters = 0;

    // 仅统计有效任务
    for (let i = this.queue_head; i < this.waiting_queue.length; i++) {
      const task = this.waiting_queue[i];
      if (task !== null) {
        if (task.mode === 0) waitingReaders++;
        else waitingWriters++;
      }
    }

    return {
      activeReaders: this.active_readers,
      activeWriter: this.active_writer,
      waitingReaders,
      waitingWriters,
      queueLength: this.waiting_queue.length - this.queue_head,
      isDisposed: this.is_disposed,
    };
  }

  /**
   * Disposes the lock, rejecting all pending waiters.
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
        task.reject(new DOMException('ReadWriteLock disposed', 'AbortError'));
        this.cleanupTask(task);
      }
    }

    this.waiting_queue = null; // 帮助GC
    this.active_readers = 0;
    this.active_writer = false;
  }

  [Symbol.dispose](): void {
    this.dispose();
  }
}

/**
 * RAII guard for a {@link ReadWriteLock} read lock.
 *
 * @remarks
 * - Implements `Disposable` for `using` statements.
 * - Automatically releases the read lock when disposed.
 */
export class ReadLockGuard implements Disposable {
  #lock: ReadWriteLock | null;

  private constructor(lock: ReadWriteLock) {
    this.#lock = lock;
  }

  /**
   * Acquires a read lock and returns a guard.
   *
   * @param lock - The {@link ReadWriteLock} to lock.
   * @param signal - Optional `AbortSignal` to cancel waiting.
   * @returns Promise resolving to a new `ReadLockGuard` holding the read lock.
   */
  static async acquire(
    lock: ReadWriteLock,
    signal?: AbortSignal,
  ): Promise<ReadLockGuard> {
    await lock.readLock(signal);
    return new ReadLockGuard(lock);
  }

  /**
   * Attempts to acquire a read lock immediately.
   *
   * @param lock - The {@link ReadWriteLock} to lock.
   * @returns A new `ReadLockGuard` if lock was acquired; `null` otherwise.
   */
  static tryAcquire(lock: ReadWriteLock): ReadLockGuard | null {
    if (lock.tryReadLock()) return new ReadLockGuard(lock);
    return null;
  }

  [Symbol.dispose](): void {
    this.release();
  }

  /** Releases the read lock if still held. Idempotent. */
  release(): void {
    if (this.#lock !== null) {
      this.#lock.unlock();
      this.#lock = null;
    }
  }
}

/**
 * RAII guard for a {@link ReadWriteLock} write lock.
 *
 * @remarks
 * - Implements `Disposable` for `using` statements.
 * - Automatically releases the write lock when disposed.
 */
export class WriteLockGuard implements Disposable {
  #lock: ReadWriteLock | null;

  private constructor(lock: ReadWriteLock) {
    this.#lock = lock;
  }

  /**
   * Acquires a write lock and returns a guard.
   *
   * @param lock - The {@link ReadWriteLock} to lock.
   * @param signal - Optional `AbortSignal` to cancel waiting.
   * @returns Promise resolving to a new `WriteLockGuard` holding the write lock.
   */
  static async acquire(
    lock: ReadWriteLock,
    signal?: AbortSignal,
  ): Promise<WriteLockGuard> {
    await lock.writeLock(signal);
    return new WriteLockGuard(lock);
  }

  /**
   * Attempts to acquire a write lock immediately.
   *
   * @param lock - The {@link ReadWriteLock} to lock.
   * @returns A new `WriteLockGuard` if lock was acquired; `null` otherwise.
   */
  static tryAcquire(lock: ReadWriteLock): WriteLockGuard | null {
    if (lock.tryWriteLock()) return new WriteLockGuard(lock);
    return null;
  }

  [Symbol.dispose](): void {
    this.release();
  }

  /** Releases the write lock if still held. Idempotent. */
  release(): void {
    if (this.#lock !== null) {
      this.#lock.unlock();
      this.#lock = null;
    }
  }
}

/**
 * Debug version of {@link ReadWriteLock} with timeout and stack‑trace tracking.
 *
 * @remarks
 * - Tracks stack traces of current lock holders.
 * - Throws descriptive {@link RWLockError} on timeout (potential deadlock).
 * - Timeout is measured from the call to `readLock`/`writeLock` until acquisition.
 * - If both a user `signal` and timeout fire, the first wins.
 */
export class DEBUG_RW_LOCK extends ReadWriteLock {
  private writer_stack: string | undefined = undefined;
  private reader_stacks: string[] = [];
  private timeout_ms: number;

  /**
   * @param timeout_ms - Timeout in milliseconds before throwing on lock acquisition.
   */
  constructor(timeout_ms: number = 5000) {
    super();
    this.timeout_ms = timeout_ms;
  }

  /** 创建超时包装器，包含清理逻辑和错误格式化 */
  private createTimeoutWrapper(mode: LockMode, current_stack: string) {
    const internal_controller = new AbortController();
    const timer_id = setTimeout(() => {
      internal_controller.abort();
    }, this.timeout_ms);

    return {
      controller: internal_controller,
      cleanup: () => {
        clearTimeout(timer_id);
        internal_controller.abort(); // 确保清理信号
      },
      getError: (err: unknown) => {
        // 如果是超时导致的 AbortError，包装为带有详细堆栈的 RWLockError
        if (
          internal_controller.signal.aborted &&
          err instanceof DOMException &&
          err.name === 'AbortError'
        ) {
          const holderInfo =
            mode === 1
              ? `Writer Holder: ${this.writer_stack || 'None'}`
              : `Active Readers: ${this.active_readers}\nOne Reader Stack: ${this.reader_stacks[0] || 'Unknown'}`;

          return new RWLockError(
            `[RWLock Deadlock/Timeout] (${this.timeout_ms}ms)\n` +
              `[Waiting Mode]: ${mode === 0 ? 'read' : 'write'}\n` +
              `[Request Location]: ${current_stack}\n` +
              holderInfo,
          );
        }
        return err;
      },
    };
  }

  /**
   * @inheritdoc
   * @throws {RWLockError} If acquisition times out (with stack traces).
   */
  public async readLock(signal?: AbortSignal): Promise<void> {
    const current_stack = new Error().stack;
    const {controller, cleanup, getError} = this.createTimeoutWrapper(
      0,
      current_stack!,
    );

    try {
      const combined_signal = signal
        ? AbortSignal.any([signal, controller.signal])
        : controller.signal;

      await super.readLock(combined_signal);
    } catch (e) {
      throw getError(e);
    } finally {
      cleanup();
    }

    this.reader_stacks.push(current_stack!);
  }

  /**
   * @inheritdoc
   * @throws {RWLockError} If acquisition times out (with stack traces).
   */
  public async writeLock(signal?: AbortSignal): Promise<void> {
    const current_stack = new Error().stack;
    const {controller, cleanup, getError} = this.createTimeoutWrapper(
      1,
      current_stack!,
    );

    try {
      const combined_signal = signal
        ? AbortSignal.any([signal, controller.signal])
        : controller.signal;

      await super.writeLock(combined_signal);
    } catch (e) {
      throw getError(e);
    } finally {
      cleanup();
    }

    this.writer_stack = current_stack;
  }

  /** @inheritdoc */
  public unlock(): void {
    if (this.active_writer) {
      this.writer_stack = undefined;
    } else if (this.active_readers > 0) {
      this.reader_stacks.pop();
    }
    super.unlock();
  }

  [Symbol.dispose](): void {
    super.dispose();
    this.writer_stack = undefined;
    this.reader_stacks = [];
  }
}
