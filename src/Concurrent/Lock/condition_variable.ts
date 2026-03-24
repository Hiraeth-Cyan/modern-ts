// ========================================
// ./src/Concurrent/Lock/condition_variable.ts
// ========================================

import {ensureDOMException, ensureError} from 'src/unknown-error';
import {UseAfterFreeError, LockError} from '../../Errors';
import {Mutex} from './mutex';

interface WaitingTask {
  resolve: () => void;
  reject: (reason: Error) => void;
  signal?: AbortSignal | undefined;
  queue_index: number;
}

/**
 * Synchronization primitive allowing threads to wait for specific conditions.
 *
 * Implements a condition variable for coordinating between threads/tasks.
 * Provides `wait`, `notifyOne`, and `notifyAll` methods for condition synchronization.
 * Supports abort signals and proper resource cleanup.
 */
export class ConditionVariable {
  private static readonly MIN_QUEUE_SIZE_FOR_COMPACTION = 32;
  private static readonly WASTE_RATIO_THRESHOLD = 0.7;

  private waiting_queue: (WaitingTask | null)[] = [];
  private queue_head: number = 0;
  private is_disposed = false;

  /**
   * Gets whether this instance has been disposed.
   * @returns `true` if disposed; otherwise `false`.
   */
  public get isDisposed(): boolean {
    return this.is_disposed;
  }

  /**
   * Create a ConditionVariable
   * @param __IGNORED__ Ignored parameter for compatibility with `DEBUG_CONDITION_VARIABLE`.
   */
  constructor(__IGNORED__?: number) {}

  private throwIfDisposed(): void {
    if (this.is_disposed) {
      throw new UseAfterFreeError(
        'ConditionVariable has been disposed and cannot be used',
      );
    }
  }

  /** 彻底清理任务引用，斩断闭包链 */
  private cleanupTask(task: WaitingTask): void {
    task.signal = undefined;
    task.queue_index = -1; // 标记为无效索引
    // 斩断闭包引用链
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    (task as any).resolve = null;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    (task as any).reject = null;
  }

  /** 判断是否需要压缩队列（空间浪费超过阈值） */
  private shouldCompact(): boolean {
    if (this.queue_head < ConditionVariable.MIN_QUEUE_SIZE_FOR_COMPACTION) {
      return false;
    }
    const waste_ratio =
      this.queue_head / Math.max(1, this.waiting_queue.length);
    return waste_ratio > ConditionVariable.WASTE_RATIO_THRESHOLD;
  }

  /** 压缩队列：移除 null 槽位，重置索引 */
  private compactQueue(): void {
    const queue = this.waiting_queue;
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

  /** 从队列中移除任务（标记为 null） */
  private removeTaskFromQueue(task: WaitingTask): void {
    this.waiting_queue[task.queue_index] = null;
  }

  /**
   * Waits for notification while atomically releasing the mutex.
   *
   * Must be called while holding the mutex lock. Releases the lock,
   * waits for notification, then re-acquires the lock before returning.
   *
   * @param mutex - The mutex currently held by the caller.
   * @param signal - Optional abort signal to cancel waiting.
   * @throws {LockError} If called without holding the mutex.
   * @throws {DOMException} If waiting is aborted via signal.
   * @throws {Error} If mutex re-lock fails after waiting.
   */
  public async wait(mutex: Mutex, signal?: AbortSignal): Promise<void> {
    this.throwIfDisposed();

    // 防御性检查：确保调用者持有锁
    if (!mutex.isLocked) {
      throw new LockError(
        'ConditionVariable.wait() called without holding the mutex lock! ' +
          'This is a critical synchronization bug.',
      );
    }

    // 信号已中止时快速失败
    if (signal?.aborted) throw ensureDOMException(signal.reason);

    // 创建等待任务
    const task = {
      signal,
      queue_index: this.waiting_queue.length,
    } as WaitingTask;

    const on_abort = () => {
      this.removeTaskFromQueue(task);
      // 立即移除监听器，防止多次调用
      signal!.removeEventListener('abort', on_abort);
      task.reject(ensureDOMException(signal!.reason));
    };

    const promise = new Promise<void>((resolve, reject) => {
      task.resolve = () => {
        signal?.removeEventListener('abort', on_abort);
        resolve();
        this.cleanupTask(task);
      };
      task.reject = (reason: Error) => {
        signal?.removeEventListener('abort', on_abort);
        reject(reason);
        this.cleanupTask(task);
      };
      if (signal) {
        signal.addEventListener('abort', on_abort, {once: true});
      }
    });

    // 先入队（防止通知丢失）
    this.waiting_queue.push(task);

    // 入队后原子性释放锁
    try {
      mutex.unlock(); // 同步操作，可能抛出异常
    } catch (unlockErr) {
      // 解锁失败：清理任务（避免悬空）
      signal?.removeEventListener('abort', on_abort);
      this.removeTaskFromQueue(task);
      this.cleanupTask(task);
      // 重新抛出原始错误
      throw unlockErr;
    }

    // 等待唤醒/中止（可能被拒绝）
    let waitError: Error | null = null;
    try {
      await promise;
    } catch (err) {
      waitError = ensureError(err);
    }

    // 总是重新获取锁（确保锁状态一致性）
    let lockError: Error | null = null;
    try {
      // 注意：这里不传递信号，等待阶段已结束
      // 重新获取锁是操作契约的一部分（POSIX行为）
      await mutex.lock();
    } catch (err) {
      lockError = err as Error; // lock 抛出标准 Error
    }

    const finalError = waitError || lockError;
    if (finalError) {
      if (waitError && lockError) waitError.cause = lockError;
      throw finalError;
    }
  }

  /**
   * Wakes up one waiting task.
   *
   * If no tasks are waiting, this is a no-op.
   * Automatically compacts the internal queue when appropriate.
   */
  public notifyOne(): void {
    this.throwIfDisposed();

    // 跳过已中止的 null 槽位
    while (this.queue_head < this.waiting_queue.length) {
      const task = this.waiting_queue[this.queue_head];
      this.waiting_queue[this.queue_head] = null; // 显式清空引用，帮助GC
      this.queue_head++;

      if (task !== null) {
        task.resolve();
        if (this.shouldCompact()) this.compactQueue();
        return;
      }
    }

    // 大队列完全释放底层数组内存
    if (this.waiting_queue.length > 1024) this.waiting_queue = [];
    else this.waiting_queue.length = 0; // 小队列直接截断，避免分配开销

    this.queue_head = 0;
  }

  /**
   * Wakes up all waiting tasks.
   *
   * Resets the internal queue after notifying all tasks.
   */
  public notifyAll(): void {
    this.throwIfDisposed();

    // 批量唤醒所有活跃任务
    for (let i = this.queue_head; i < this.waiting_queue.length; i++) {
      const task = this.waiting_queue[i];
      if (task !== null) {
        this.waiting_queue[i] = null;
        task.resolve();
      }
    }

    // 重置队列（notifyAll 后通常不需要空槽位）
    this.waiting_queue = [];
    this.queue_head = 0;
  }

  /**
   * Gets internal statistics for debugging.
   * @returns Object containing queue metrics and disposal status.
   */
  public getStats() {
    if (this.is_disposed) {
      return {
        waitingCount: 0,
        queueCapacity: 0,
        queueHead: 0,
        isDisposed: true,
      };
    }

    let activeCount = 0;
    for (let i = this.queue_head; i < this.waiting_queue.length; i++) {
      if (this.waiting_queue[i] !== null) activeCount++;
    }

    return {
      waitingCount: activeCount,
      queueCapacity: this.waiting_queue.length,
      queueHead: this.queue_head,
      isDisposed: false,
    };
  }

  /**
   * Disposes this condition variable.
   *
   * Rejects all waiting tasks with an `AbortError`.
   * After disposal, all operations will throw `UseAfterFreeError`.
   */
  public dispose(): void {
    if (this.is_disposed) return;
    this.is_disposed = true;

    // 拒绝所有活跃等待者
    for (let i = this.queue_head; i < this.waiting_queue.length; i++) {
      const task = this.waiting_queue[i];
      if (task !== null) {
        task.reject(
          new DOMException('ConditionVariable disposed', 'AbortError'),
        );
        this.cleanupTask(task);
      }
    }

    // 强制 GC 回收
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
    this.waiting_queue = null as any;
  }

  /**
   * Symbol.dispose implementation for explicit resource management.
   * Calls `dispose()`.
   */
  [Symbol.dispose](): void {
    this.dispose();
  }
}

/**
 * Debug version of ConditionVariable with timeout and stack tracing.
 *
 * Extends `ConditionVariable` to add debugging capabilities:
 * - Timeout detection for stuck waits
 * - Stack trace capture on notify operations
 * - Enhanced error messages for debugging deadlocks
 */
export class DEBUG_CONDITION_VARIABLE extends ConditionVariable {
  private last_notify_stack: string | undefined = undefined;
  private timeout_ms: number;

  /**
   * Creates a debug condition variable.
   * @param timeout_ms - Timeout in milliseconds for wait operations (default: 3000).
   */
  constructor(timeout_ms: number = 3000) {
    super();
    this.timeout_ms = timeout_ms;
  }

  /**
   * @inheritdoc
   * @throws {LockError} With stack traces if wait times out.
   */
  public async wait(mutex: Mutex, signal?: AbortSignal): Promise<void> {
    const wait_start_stack = new Error().stack;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout_ms);

    // 合并用户信号和超时信号
    const combined = signal
      ? AbortSignal.any([signal, controller.signal])
      : controller.signal;

    try {
      await super.wait(mutex, combined);
    } catch (err) {
      const isUserAborted = signal?.aborted;
      const isTimeout = controller.signal.aborted;

      if (
        !isUserAborted &&
        isTimeout &&
        err instanceof DOMException &&
        err.name === 'AbortError'
      ) {
        throw new LockError(
          `[ConditionVariable Timeout] (${this.timeout_ms}ms)\n` +
            `Waiting at:\n${wait_start_stack}\n` +
            `Last notify at:\n${this.last_notify_stack || 'Never notified'}`,
        );
      }
      throw err;
    } finally {
      clearTimeout(timer);
      controller.abort();
    }
  }

  /**
   * @inheritdoc
   */
  public notifyOne(): void {
    this.last_notify_stack = new Error().stack;
    super.notifyOne();
  }

  /**
   * @inheritdoc
   */
  public notifyAll(): void {
    this.last_notify_stack = new Error().stack;
    super.notifyAll();
  }

  /**
   * @inheritdoc
   */
  public dispose(): void {
    this.last_notify_stack = undefined;
    super.dispose();
  }
}

/**
 * Executes a task after waiting for a condition predicate.
 *
 * A utility function that encapsulates the classic condition wait pattern:
 * 1. Acquires the mutex lock
 * 2. Waits in a loop until predicate returns true
 * 3. Executes the task
 * 4. Releases the lock
 *
 * @template T - Return type of the task.
 * @param mutex - Mutex to lock during the operation.
 * @param cond - Condition variable to wait on.
 * @param predicate - Condition predicate; wait continues while this returns false.
 * @param task - Task to execute once predicate is true.
 * @param signal - Optional abort signal to cancel the operation.
 * @returns The result of the task.
 */
export async function withCondition<T>(
  mutex: Mutex,
  cond: ConditionVariable,
  predicate: () => boolean | Promise<boolean>,
  task: () => Promise<T> | T,
  signal?: AbortSignal,
): Promise<T> {
  await mutex.lock(signal);
  try {
    // 经典的条件等待循环
    while (!(await predicate())) {
      await cond.wait(mutex, signal);
    }
    return await task();
  } finally {
    mutex.unlock();
  }
}
