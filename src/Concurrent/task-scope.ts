// ========================================
// ./src/Concurrent/task-scope.ts
// ========================================

import {UseAfterFreeError} from 'src/Errors';
import {ensureDOMException} from 'src/unknown-error';
import {noop} from 'src/Utils/Functions/base';
import type {MaybePromise} from 'src/Utils/type-tool';

type Task<T = unknown> = (signal: AbortSignal) => MaybePromise<T>;
type GenTask<T = unknown> = (
  signal: AbortSignal,
) => Generator<MaybePromise<T>, T, unknown>;
type Finalizer = () => MaybePromise<void>;

// 使用轻量级对象代替 Map 存储信号与监听器的映射关系
interface LinkBinding {
  signal: AbortSignal;
  listener: () => void;
}

type SelectResult<T> = {
  index: number;
} & PromiseSettledResult<T>;

/**
 * Manages async operations with lifecycle tracking and cooperative cancellation.
 *
 * Tracks tasks and ensures proper cleanup when disposed. All operations are
 * automatically cancelled when the scope's signal aborts. Linking external
 * signals propagates their cancellation to this scope.
 *
 * @remarks
 * - Tasks added via `go()` continue running even if the scope is disposed.
 * - Tasks added via `run()` are immediately rejected when scope is disposed.
 * - Finalizers run in reverse order of registration during disposal.
 * - Throws `UseAfterFreeError` if used after disposal (except `dispose()`).
 *
 * @example
 * ```ts
 * const scope = new TaskScope();
 * scope.go(async () => { ... });
 * await scope.wait();
 * await scope.dispose();
 * ```
 */
export class TaskScope {
  // 任务并发量大，增删频繁，需要 O(1) 删除性能
  protected readonly tasks = new Set<PromiseLike<unknown>>();

  // 清理函数通常很少，数组内存开销更小，且 dispose 时无需创建副本即可倒序执行
  private readonly finalizers: Finalizer[] = [];

  private readonly link_groups: LinkBinding[][] = [];

  private is_disposed = false;

  private _abort_promise: Promise<never> | null = null;
  private _wait_promise: Promise<void> | null = null;
  private _resolve_wait: (() => void) | null = null;

  // 用于 dispose 等待任务结束的回调，避免创建 tasks 快照
  private _resolve_dispose: (() => void) | null = null;

  private readonly controller: AbortController = new AbortController();

  /**
   * AbortSignal that triggers when the scope is disposed.
   *
   * @remarks
   * - Automatically propagates parent signal's reason if provided.
   * - All tracked tasks receive this signal for cooperative cancellation.
   */
  readonly signal: AbortSignal = this.controller.signal;

  /**
   * Creates a TaskScope, optionally linked to a parent signal.
   *
   * @param parent_signal - When provided, scope automatically disposes if parent aborts.
   * If parent already aborted at construction, scope starts in disposed state.
   *
   * @throws {DOMException} If parent signal already aborted, scope becomes disposed
   * immediately with the parent's reason.
   */
  constructor(parent_signal?: AbortSignal) {
    if (parent_signal) {
      if (parent_signal.aborted) {
        this.is_disposed = true;
        this.controller.abort(ensureDOMException(parent_signal.reason));
      } else {
        const on_parent_abort = () => {
          void this.dispose(parent_signal.reason);
        };
        parent_signal.addEventListener('abort', on_parent_abort, {once: true});
        this.defer(() =>
          parent_signal.removeEventListener('abort', on_parent_abort),
        );
      }
    }
  }

  /**
   * Indicates whether the scope has been disposed.
   *
   * @remarks
   * After disposal, most methods throw `UseAfterFreeError` except `dispose()`.
   */
  public get isDisposed(): boolean {
    return this.is_disposed;
  }

  protected throwIfDisposed(): void {
    if (this.is_disposed) throw new UseAfterFreeError('TaskScope is disposed');
  }

  private getAbortPromise(): Promise<never> {
    if (this._abort_promise) return this._abort_promise;

    this._abort_promise = new Promise<never>((_, reject) => {
      this.signal.addEventListener(
        'abort',
        () => {
          reject(ensureDOMException(this.signal.reason));
        },
        {once: true},
      );
    });

    return this._abort_promise;
  }

  private notifyTaskRemoved(): void {
    // 当 tasks 清空时，同时检查并触发 wait 和 dispose 的结束信号
    if (this.tasks.size === 0) {
      if (this._resolve_wait) {
        this._resolve_wait();
        this._wait_promise = null;
        this._resolve_wait = null;
      }
      if (this._resolve_dispose) {
        this._resolve_dispose();
        this._resolve_dispose = null;
      }
    }
  }

  private async executeTracked<T>(task: Task<T>): Promise<T> {
    const promise = Promise.resolve(task(this.signal));
    this.tasks.add(promise);
    try {
      return await promise;
    } finally {
      this.tasks.delete(promise);
      this.notifyTaskRemoved();
    }
  }

  /**
   * Starts a fire-and-forget task with optional error handling.
   *
   * @param task - Function receiving scope's AbortSignal.
   * @param onError - Optional callback invoked if task rejects.
   *
   * @remarks
   * - Task continues running even if scope disposes (no automatic cancellation).
   * - If scope already disposed at call time, throws `UseAfterFreeError`.
   * - If scope's signal already aborted, calls `onError` immediately with the reason.
   * - Errors in `onError` are silently ignored.
   *
   * @throws {UseAfterFreeError} If scope already disposed.
   */
  go(task: Task, onError?: (error: unknown) => MaybePromise<void>): void {
    this.throwIfDisposed();
    if (this.signal.aborted) {
      if (onError)
        void Promise.resolve(onError(ensureDOMException(this.signal.reason)));
      return;
    }

    void this.executeTracked(task).catch((error) => {
      if (onError) void onError(error);
    });
  }

  /**
   * Runs a task and returns its result, aborting if scope disposes.
   *
   * @template T - Return type of the task.
   * @param task - Function receiving scope's AbortSignal.
   * @returns Promise resolving to task result or rejecting if scope aborts.
   *
   * @remarks
   * - Task competes with scope disposal: if scope aborts first, promise rejects.
   * - If scope already disposed at call time, throws `UseAfterFreeError`.
   * - If scope's signal already aborted, immediately rejects with that reason.
   *
   * @throws {UseAfterFreeError} If scope already disposed.
   * @throws {DOMException} If scope's signal aborts before task completes.
   */
  async run<T>(task: Task<T>): Promise<T> {
    this.throwIfDisposed();
    if (this.signal.aborted) throw ensureDOMException(this.signal.reason);
    return Promise.race([this.executeTracked(task), this.getAbortPromise()]);
  }

  /**
   * Waits for all tracked tasks to complete.
   *
   * @returns Promise that resolves when no tasks remain, or when scope is disposed.
   *
   * @remarks
   * - **Latch Behavior**: Continuously waits until the task set becomes empty.
   *   Tasks added *after* calling `wait()` will delay resolution until they complete.
   * - **Disposal**: Resolves immediately if the scope is disposed (even if tasks were running).
   * - If scope already disposed at call time, throws `UseAfterFreeError`.
   * - If scope's signal already aborted at call time, immediately rejects with that reason.
   *
   * @throws {UseAfterFreeError} If scope already disposed.
   * @throws {DOMException} If scope's signal already aborted at call time.
   */
  async wait(): Promise<void> {
    this.throwIfDisposed();
    if (this.signal.aborted) throw ensureDOMException(this.signal.reason);
    if (this.tasks.size === 0) return;

    if (!this._wait_promise)
      this._wait_promise = new Promise((res) => {
        this._resolve_wait = res;
      });

    return this._wait_promise;
  }

  /**
   * Registers a cleanup function to run during disposal.
   *
   * @param fn - Cleanup function (may be async).
   * @returns Function to remove this finalizer.
   *
   * @remarks
   * - Finalizers run in reverse order of registration (LIFO).
   * - If scope already disposed at call time, throws `UseAfterFreeError`.
   * - Errors in finalizers are collected and thrown as `AggregateError` after all run.
   *
   * @throws {UseAfterFreeError} If scope already disposed.
   */
  defer(fn: Finalizer): () => void {
    this.throwIfDisposed();
    this.finalizers.push(fn);
    // 假设 finalizers 数量很少，使用 indexOf 查找删除是安全的，且节省了 Set 的内存开销
    return () => {
      const index = this.finalizers.indexOf(fn);
      if (index !== -1) this.finalizers.splice(index, 1); // cache friendly不用担心速度
    };
  }

  /**
   * Runs tasks in parallel and waits for all to complete.
   *
   * @template T - Return type of tasks.
   * @param tasks - Array of at least one task.
   * @returns Promise resolving to array of results if all succeed.
   *
   * @remarks
   * - If any task rejects, the whole promise rejects with that error.
   * - If scope aborts before completion, rejects with abort reason.
   * - If scope already disposed at call time, throws `UseAfterFreeError`.
   *
   * @throws {UseAfterFreeError} If scope already disposed.
   * @throws {DOMException} If scope's signal aborts before completion.
   */
  async all<T>(tasks: [Task<T>, ...Task<T>[]]): Promise<T[]> {
    this.throwIfDisposed();
    if (this.signal.aborted) throw ensureDOMException(this.signal.reason);

    return Promise.race([
      Promise.all(tasks.map((t) => this.executeTracked(t))),
      this.getAbortPromise(),
    ]);
  }

  /**
   * Runs tasks in parallel and waits for all to settle.
   *
   * @template T - Return type of tasks.
   * @param tasks - Array of at least one task.
   * @returns Array of settlement results for each task.
   *
   * @remarks
   * - Never rejects due to task failures (only due to scope abortion).
   * - If scope aborts before completion, rejects with abort reason.
   * - If scope already disposed at call time, throws `UseAfterFreeError`.
   *
   * @throws {UseAfterFreeError} If scope already disposed.
   * @throws {DOMException} If scope's signal aborts before completion.
   */
  async allSettled<T>(
    tasks: [Task<T>, ...Task<T>[]],
  ): Promise<PromiseSettledResult<T>[]> {
    this.throwIfDisposed();
    if (this.signal.aborted) throw ensureDOMException(this.signal.reason);
    return Promise.race([
      Promise.allSettled(tasks.map((t) => this.executeTracked(t))),
      this.getAbortPromise(),
    ]);
  }

  /**
   * Runs tasks in parallel and returns the first to settle successfully.
   *
   * @template T - Return type of tasks.
   * @param tasks - Array of at least one task.
   * @returns Promise resolving with the first successful task result.
   *
   * @remarks
   * - If all tasks reject, rejects with an `AggregateError` of all reasons.
   * - If scope aborts before any task succeeds, rejects with abort reason.
   * - If scope already disposed at call time, throws `UseAfterFreeError`.
   *
   * @throws {UseAfterFreeError} If scope already disposed.
   * @throws {DOMException} If scope's signal aborts before any task succeeds.
   * @throws {AggregateError} If all tasks reject (and scope doesn't abort first).
   */
  async any<T>(tasks: [Task<T>, ...Task<T>[]]): Promise<T> {
    this.throwIfDisposed();
    if (this.signal.aborted) throw ensureDOMException(this.signal.reason);
    return Promise.race([
      Promise.any(tasks.map((t) => this.executeTracked(t))),
      this.getAbortPromise(),
    ]);
  }

  /**
   * Runs tasks in parallel and returns the first to settle (success or failure).
   *
   * @template T - Return type of tasks.
   * @param tasks - Array of at least one task.
   * @returns Promise resolving with the first settled task result.
   *
   * @remarks
   * - The result includes the task index for identification.
   * - If scope aborts before any task settles, rejects with abort reason.
   * - If scope already disposed at call time, throws `UseAfterFreeError`.
   *
   * @throws {UseAfterFreeError} If scope already disposed.
   * @throws {DOMException} If scope's signal aborts before any task settles.
   */
  async race<T>(tasks: [Task<T>, ...Task<T>[]]): Promise<T> {
    this.throwIfDisposed();
    if (this.signal.aborted) throw ensureDOMException(this.signal.reason);
    return Promise.race([
      Promise.race(tasks.map((t) => this.executeTracked(t))),
      this.getAbortPromise(),
    ]);
  }

  /**
   * Runs tasks in parallel and returns the first to settle with its index.
   *
   * @template T - Return type of tasks.
   * @param tasks - Array of at least one task.
   * @returns Object containing `index` and settlement details of first settled task.
   *
   * @remarks
   * - Unlike `race()`, this never rejects due to task failure (only scope abortion).
   * - If scope aborts before any task settles, rejects with abort reason.
   * - If scope already disposed at call time, throws `UseAfterFreeError`.
   *
   * @throws {UseAfterFreeError} If scope already disposed.
   * @throws {DOMException} If scope's signal aborts before any task settles.
   */
  async select<T>(tasks: [Task<T>, ...Task<T>[]]): Promise<SelectResult<T>> {
    this.throwIfDisposed();
    if (this.signal.aborted) throw ensureDOMException(this.signal.reason);
    const running = tasks.map(async (task, index) => {
      try {
        const value = await this.executeTracked(task);
        return {index, status: 'fulfilled', value} as SelectResult<T>;
      } catch (reason) {
        return {index, status: 'rejected', reason} as SelectResult<T>;
      }
    });
    return Promise.race([Promise.race(running), this.getAbortPromise()]);
  }

  /**
   * Runs a generator function as an async task with proper cancellation.
   *
   * @template T - Return type of the generator.
   * @param task - Generator function receiving scope's AbortSignal.
   * @returns Promise resolving to the generator's return value.
   *
   * @remarks
   * - Yielding a promise suspends execution until it settles.
   * - If scope aborts, generator is force-returned and promise rejects.
   * - If generator throws, the promise rejects with that error.
   * - If scope already disposed at call time, throws `UseAfterFreeError`.
   *
   * @throws {UseAfterFreeError} If scope already disposed.
   * @throws {DOMException} If scope's signal aborts before generator completes.
   */
  spawn<T>(task: GenTask<T>): Promise<T> {
    this.throwIfDisposed();

    const g = task(this.signal);
    const runner = (async (): Promise<T> => {
      let next_val: unknown;
      let error: unknown;

      while (true) {
        if (this.signal.aborted) {
          (g as Generator<unknown>).return(undefined);
          throw ensureDOMException(this.signal.reason);
        }
        const iter_result = error ? g.throw(error) : g.next(next_val);
        error = undefined;
        if (iter_result.done) return iter_result.value;
        try {
          next_val = await iter_result.value;
        } catch (e) {
          error = e;
        }
      }
    })();

    this.tasks.add(runner);
    void runner
      .finally(() => {
        this.tasks.delete(runner);
        this.notifyTaskRemoved();
      })
      .catch(noop);

    return runner;
  }
  

  /**
   * Links external AbortSignals to this scope's lifecycle.
   *
   * @param signals - Array of at least one external signal.
   * @returns Cleanup function to remove the linkage.
   *
   * @remarks
   * - If any linked signal aborts, the scope disposes with that signal's reason.
   * - If any signal already aborted at call time, scope disposes immediately.
   * - Cleanup function removes listeners but does not affect already-triggered disposal.
   * - If scope already disposed at call time, throws `UseAfterFreeError`.
   *
   * @throws {UseAfterFreeError} If scope already disposed.
   */
  async link(...signals: [AbortSignal, ...AbortSignal[]]): Promise<() => void> {
    this.throwIfDisposed();

    for (const signal of signals) {
      if (signal.aborted) {
        await this.dispose(signal.reason);
        return noop;
      }
    }

    // 使用轻量级数组代替复杂的对象结构
    const bindings: LinkBinding[] = [];
    this.link_groups.push(bindings);

    const cleanup_group = () => {
      // 假设 link_groups 数量很少，使用 indexOf 查找
      const index = this.link_groups.indexOf(bindings);
      if (index === -1) return;
      this.link_groups.splice(index, 1);

      for (const {signal, listener} of bindings)
        signal.removeEventListener('abort', listener);

      bindings.length = 0;
    };

    for (const signal of signals) {
      const on_abort = () => {
        cleanup_group();
        void this.dispose(signal.reason);
      };
      signal.addEventListener('abort', on_abort, {once: true});
      bindings.push({signal, listener: on_abort});
    }

    return cleanup_group;
  }

  /**
   * Creates a child scope that inherits this scope's cancellation.
   *
   * @returns New TaskScope linked to this scope's signal.
   *
   * @remarks
   * - Child scope automatically disposes when parent scope disposes.
   * - Parent scope waits for child scope to complete during disposal.
   * - If parent already disposed at call time, throws `UseAfterFreeError`.
   *
   * @throws {UseAfterFreeError} If scope already disposed.
   */
  fork(): TaskScope {
    this.throwIfDisposed();

    const sub_scope = new TaskScope(this.signal);
    const un_defer = this.defer(() => sub_scope.dispose(this.signal.reason));

    const sub_wait_task = (async () => {
      try {
        await sub_scope.wait();
      } finally {
        un_defer();
      }
    })();

    this.tasks.add(sub_wait_task);
    void sub_wait_task
      .finally(() => {
        this.tasks.delete(sub_wait_task);
        this.notifyTaskRemoved();
      })
      .catch(noop);

    return sub_scope;
  }

  /**
   * Disposes the scope, aborting all operations and running finalizers.
   *
   * @param reason - Optional reason for disposal, becomes signal's abort reason.
   * @returns Promise that resolves after all cleanup completes.
   *
   * @remarks
   * - Safe to call multiple times (idempotent).
   * - Finalizers run in reverse order of registration (LIFO).
   * - Waits for all tracked tasks to complete (but signals them to abort).
   * - Throws `AggregateError` if any finalizer rejects (after all finalizers run).
   * - Does NOT throw `UseAfterFreeError` if already disposed.
   *
   * @throws {AggregateError} If any finalizer rejects during cleanup.
   */
  async dispose(reason?: unknown): Promise<void> {
    if (this.is_disposed) return;
    this.is_disposed = true;

    if (this._resolve_wait) {
      this._resolve_wait();
      this._wait_promise = null;
      this._resolve_wait = null;
    }

    // 直接遍历数组，无需 Map 迭代
    for (const bindings of this.link_groups)
      for (const {signal, listener} of bindings)
        signal.removeEventListener('abort', listener);

    this.link_groups.length = 0;
    this.controller.abort(reason);

    const finalizer_errors: unknown[] = [];

    // 直接倒序遍历数组并 pop
    while (this.finalizers.length > 0) {
      const fn = this.finalizers.pop()!;
      try {
        await fn();
      } catch (err) {
        finalizer_errors.push(err);
      }
    }

    // 不再创建 tasks 快照，而是利用 notifyTaskRemoved 信号驱动
    if (this.tasks.size > 0) {
      await new Promise<void>((resolve) => {
        this._resolve_dispose = resolve;
      });
    }

    this._abort_promise = null;
    if (finalizer_errors.length > 0) {
      throw new AggregateError(finalizer_errors, 'TaskScope dispose errors');
    }
  }

  /**
   * Enables using TaskScope with `using` statement (Stage 3 proposal).
   *
   * @example
   * ```ts
   * await using scope = new TaskScope();
   * scope.go(async () => { ... });
   * ```
   */
  async [Symbol.asyncDispose]() {
    await this.dispose();
  }
}
