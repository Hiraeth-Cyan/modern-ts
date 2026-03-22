// ============================================
// ./src/Reactive/event_emitter.ts
// ============================================

import {isPromiseLike} from 'src/helper';
import {ensureDOMException} from 'src/unknown-error';

type Callback<T extends Record<string, unknown[]>, K extends keyof T> = (
  ...args: T[K]
) => void;

const ORIGINAL_CALLBACK = Symbol('Original callback');

type WrappedFn = ((...args: unknown[]) => PromiseLike<void> | void) & {
  [ORIGINAL_CALLBACK]?: (...args: unknown[]) => PromiseLike<void> | void;
};

type ListenerList = {
  prepend: WrappedFn[];
  normal: WrappedFn[];
};

type Storage = null | WrappedFn | ListenerList;

type PendingAddition = {
  event: PropertyKey;
  callback: WrappedFn;
  prepend: boolean;
};

type PendingRemoval = {
  event: PropertyKey;
  callback: WrappedFn;
};

/**
 * A type-safe event emitter that supports synchronous and asynchronous event handling.
 *
 * Features:
 * - Full TypeScript type safety with event map support
 * - Special events: `newListener`, `removeListener`, `error`
 * - Supports prepend/once/async patterns
 * - Deferred listener modification during emit (prevents iteration issues)
 * - Optimized storage: single function -> list transition
 *
 * @template T - Event map where keys are event names and values are argument tuples
 *
 * @example
 * ```ts
 * interface MyEvents {
 *   message: [text: string, from: string];
 *   data: [payload: unknown];
 *   error: [err: Error];
 * }
 *
 * const emitter = new EventEmitter<MyEvents>();
 * emitter.on('message', (text, from) => console.log(`${from}: ${text}`));
 * emitter.emit('message', 'Hello', 'Alice');
 * ```
 */
export class EventEmitter<T extends Record<PropertyKey, unknown[]>> {
  private events: Map<keyof T, Storage>;

  // 当前嵌套 emit 调用深度，用于延迟处理 on/off 操作
  private emitting_depth = 0;
  // emit 期间被移除的监听器，待 emit 结束后统一处理
  private pending_removals_set: Set<WrappedFn> | null = null;
  private pending_removals_list: PendingRemoval[] | null = null;
  // emit 期间被添加的监听器，待 emit 结束后统一处理
  private pending_additions: PendingAddition[] | null = null;

  /**
   * Creates a new EventEmitter instance.
   */
  constructor() {
    this.events = new Map();
  }

  private emitRemoveListener<K extends keyof T>(
    event: K,
    callback: Callback<T, K>,
  ): void {
    (this.emit as (event: PropertyKey, ...args: unknown[]) => boolean)(
      'removeListener',
      event,
      callback,
    );
  }

  // ============================================
  // 事件监听管理
  // ============================================

  /**
   * Registers an event listener that will be invoked each time the event is emitted.
   *
   * Triggers `newListener` event before adding the listener.
   * During an active emit, additions are deferred until the emit completes.
   *
   * @template K - Event name key
   * @param event - The event name to listen for
   * @param callback - The listener function to register
   * @returns This EventEmitter instance for chaining
   */
  on<K extends keyof T>(event: K, callback: Callback<T, K>): this {
    const wrapped = callback as WrappedFn;

    (this.emit as (event: PropertyKey, ...args: unknown[]) => boolean)(
      'newListener',
      event,
      callback,
    );

    // emit 期间延迟添加，避免遍历过程中修改数组
    if (this.emitting_depth > 0) {
      this.pending_additions ??= [];
      this.pending_additions.push({event, callback: wrapped, prepend: false});
      return this;
    }

    const current = this.events.get(event);

    // 优化分支：
    // 1. 热路径：已有列表，直接 push
    // 2. 冷路径：空，首次添加
    // 3. 冷路径：单函数，转换为列表
    if (current)
      if (typeof current === 'object') current.normal.push(wrapped);
      else this.events.set(event, {prepend: [], normal: [current, wrapped]});
    else this.events.set(event, wrapped);

    return this;
  }

  /**
   * Removes a previously registered event listener.
   *
   * Triggers `removeListener` event after removing the listener.
   * During an active emit, removals are deferred until the emit completes.
   *
   * @template K - Event name key
   * @param event - The event name to remove the listener from
   * @param callback - The listener function to remove
   * @returns This EventEmitter instance for chaining
   */
  off<K extends keyof T>(event: K, callback: Callback<T, K>): this {
    const current = this.events.get(event);
    if (!current) return this;

    const target = callback as WrappedFn;

    // 快速路径：单函数直接匹配
    if (typeof current === 'function') {
      if (current === target || current[ORIGINAL_CALLBACK] === callback) {
        if (this.emitting_depth > 0) {
          this.pending_removals_set ??= new Set<WrappedFn>();
          this.pending_removals_list ??= [];
          if (!this.pending_removals_set.has(current)) {
            this.pending_removals_set.add(current);
            this.pending_removals_list.push({event, callback: current});
          }
        } else {
          this.events.delete(event);
          this.emitRemoveListener(event, callback);
        }
      }
      return this;
    }

    // emit 期间延迟移除
    if (this.emitting_depth > 0) {
      const actual_target = this.findWrappedFn(current, callback);
      if (actual_target && !this.isPendingRemoval(actual_target, event)) {
        this.pending_removals_set ??= new Set<WrappedFn>();
        this.pending_removals_list ??= [];
        this.pending_removals_set.add(actual_target);
        this.pending_removals_list.push({event, callback: actual_target});
      }
      return this;
    }

    const removed = this.removeFromList(current, callback);
    if (!removed) return this;

    // 列表只剩一个时降级为单函数存储
    const total = current.prepend.length + current.normal.length;
    if (total === 1) {
      const single = current.prepend[0] ?? current.normal[0];
      this.events.set(event, single);
    }

    this.emitRemoveListener(event, callback);
    return this;
  }

  // 在监听器列表中查找匹配的包装函数
  // 优先搜索 normal 列表（绝大多数监听器在此）
  private findWrappedFn<K extends keyof T>(
    list: ListenerList,
    callback: Callback<T, K>,
  ): WrappedFn | null {
    const target = callback as WrappedFn;
    const normal = list.normal;
    const prepend = list.prepend;

    for (let i = 0, len = normal.length; i < len; i++) {
      const cb = normal[i];
      if (cb === target || cb[ORIGINAL_CALLBACK] === callback) return cb;
    }
    for (let i = 0, len = prepend.length; i < len; i++) {
      const cb = prepend[i];
      if (cb === target || cb[ORIGINAL_CALLBACK] === callback) return cb;
    }
    return null;
  }

  // 从监听器列表中移除指定回调
  // 优先搜索 normal 列表，从后向前遍历符合 LIFO 预期
  private removeFromList<K extends keyof T>(
    list: ListenerList,
    callback: Callback<T, K>,
  ): boolean {
    const target = callback as WrappedFn;
    const normal = list.normal;
    const prepend = list.prepend;

    for (let i = normal.length - 1; i >= 0; i--) {
      const cb = normal[i];
      if (cb === target || cb[ORIGINAL_CALLBACK] === callback) {
        normal.splice(i, 1);
        return true;
      }
    }
    for (let i = prepend.length - 1; i >= 0; i--) {
      const cb = prepend[i];
      if (cb === target || cb[ORIGINAL_CALLBACK] === callback) {
        prepend.splice(i, 1);
        return true;
      }
    }
    return false;
  }

  /**
   * Emits an event, invoking all registered listeners with the provided arguments.
   *
   * Listeners are invoked in order: prepend listeners (reverse order) then normal listeners.
   * If no listeners exist and the event is `error`, the error is thrown.
   * Listener errors are caught and forwarded to `error` event handlers.
   *
   * @template K - Event name key
   * @param event - The event name to emit
   * @param args - Arguments to pass to the listeners
   * @returns `true` if all listeners completed without errors, `false` otherwise
   * @throws The error argument if emitting `error` with no listeners
   */
  emit<K extends keyof T>(event: K, ...args: T[K]): boolean {
    const events = this.events;
    const current = events.get(event);

    // 空检查
    if (!current) {
      if (event === 'error') throw args[0];
      return false;
    }

    // 分支预测优化：高频事件通常是列表（对象），优先判断 object
    if (typeof current === 'object') {
      const prepend = current.prepend;
      const normal = current.normal;

      this.emitting_depth++;
      let has_error = false;

      try {
        // 反向遍历 prepend（后添加的先执行）
        for (let i = prepend.length - 1; i >= 0; i--) {
          const cb = prepend[i];
          try {
            cb(...args);
          } catch (error) {
            has_error = true;
            this.handleEmitError(event, error);
          }
        }

        // 正向遍历 normal
        for (let i = 0, listLen = normal.length; i < listLen; i++) {
          const cb = normal[i];
          try {
            cb(...args);
          } catch (error) {
            has_error = true;
            this.handleEmitError(event, error);
          }
        }
      } finally {
        this.emitting_depth--;

        if (
          this.emitting_depth === 0 &&
          (this.pending_removals_list || this.pending_additions)
        )
          this.flushPendingOperations();
      }

      return !has_error;
    }

    // 单函数情况（低频/初始状态）
    try {
      current(...args);
    } catch (error) {
      this.handleEmitError(event, error);
      return false;
    }
    return true;
  }

  private handleEmitError<K extends keyof T>(event: K, error: unknown): void {
    if (event === 'error') throw error;

    const storage = this.events.get('error');
    if (!storage) throw error;

    if (typeof storage === 'function') {
      if (!this.isPendingRemoval(storage, 'error')) storage(error);
      else throw error;
      return;
    }

    // 保持执行顺序：prepend -> normal
    const prepend = storage.prepend;
    const normal = storage.normal;
    let has_called = false;

    for (let i = 0, len = prepend.length; i < len; i++) {
      const cb = prepend[i];
      if (this.isPendingRemoval(cb, 'error')) continue;
      cb(error);
      has_called = true;
    }

    for (let i = 0, len = normal.length; i < len; i++) {
      const cb = normal[i];
      if (this.isPendingRemoval(cb, 'error')) continue;
      cb(error);
      has_called = true;
    }

    if (!has_called) throw error;
  }

  // 检查回调是否已在待移除列表中（O(1) 复杂度）
  private isPendingRemoval(callback: WrappedFn, _event: keyof T): boolean {
    return this.pending_removals_set?.has(callback) ?? false;
  }

  // 处理 emit 期间延迟的添加/移除操作
  private flushPendingOperations(): void {
    const pending_removals = this.pending_removals_list;
    this.pending_removals_list = null;
    this.pending_removals_set = null;

    const pending_additions = this.pending_additions;
    this.pending_additions = null;

    if (pending_removals) {
      for (let i = 0, len = pending_removals.length; i < len; i++) {
        const {event, callback} = pending_removals[i];
        const storage = this.events.get(event);

        if (!storage) continue;

        if (typeof storage === 'function') {
          if (storage === callback) this.events.delete(event);
        } else {
          let idx = storage.normal.indexOf(callback);
          if (idx !== -1) {
            storage.normal.splice(idx, 1);
          } else {
            idx = storage.prepend.indexOf(callback);
            if (idx !== -1) storage.prepend.splice(idx, 1);
          }

          const total = storage.prepend.length + storage.normal.length;
          if (total === 1) {
            const single = storage.prepend[0] ?? storage.normal[0];
            this.events.set(event, single);
          }
        }

        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        this.emitRemoveListener(event, callback);
      }
    }

    if (pending_additions) {
      for (let i = 0, len = pending_additions.length; i < len; i++) {
        const {event, callback, prepend} = pending_additions[i];
        const current = this.events.get(event);

        if (!current) {
          this.events.set(event, callback);
        } else if (typeof current === 'object') {
          if (prepend) current.prepend.push(callback);
          else current.normal.push(callback);
        } else {
          this.events.set(
            event,
            prepend
              ? {prepend: [callback], normal: [current]}
              : {prepend: [], normal: [current, callback]},
          );
        }
      }
    }
  }

  /**
   * Registers a one-time listener that removes itself after first invocation.
   *
   * @template K - Event name key
   * @param event - The event name to listen for
   * @param callback - The listener function to register
   * @returns This EventEmitter instance for chaining
   */
  once<K extends keyof T>(event: K, callback: Callback<T, K>): this {
    const wrapper = (...args: T[K]) => {
      this.off(event, wrapper);
      callback(...args);
    };
    wrapper[ORIGINAL_CALLBACK] = callback as WrappedFn;
    return this.on(event, wrapper);
  }

  /**
   * Registers a listener that will be invoked before other listeners.
   *
   * Prepend listeners are invoked in reverse order of registration (LIFO).
   * Triggers `newListener` event before adding the listener.
   *
   * @template K - Event name key
   * @param event - The event name to listen for
   * @param callback - The listener function to register
   * @returns This EventEmitter instance for chaining
   */
  prependListener<K extends keyof T>(event: K, callback: Callback<T, K>): this {
    const wrapped = callback as WrappedFn;

    (this.emit as (event: PropertyKey, ...args: unknown[]) => boolean)(
      'newListener',
      event,
      callback,
    );

    if (this.emitting_depth > 0) {
      this.pending_additions ??= [];
      this.pending_additions.push({event, callback: wrapped, prepend: true});
      return this;
    }

    const current = this.events.get(event);

    if (current) {
      if (typeof current === 'object') {
        current.prepend.push(wrapped);
      } else {
        this.events.set(event, {prepend: [wrapped], normal: [current]});
      }
    } else {
      this.events.set(event, wrapped);
    }

    return this;
  }

  /**
   * Registers a one-time prepend listener.
   *
   * Combines `prependListener` and `once` behavior.
   *
   * @template K - Event name key
   * @param event - The event name to listen for
   * @param callback - The listener function to register
   * @returns This EventEmitter instance for chaining
   */
  prependOnceListener<K extends keyof T>(
    event: K,
    callback: Callback<T, K>,
  ): this {
    const wrapper = (...args: T[K]) => {
      this.off(event, wrapper);
      callback(...args);
    };
    wrapper[ORIGINAL_CALLBACK] = callback;
    return this.prependListener(event, wrapper);
  }

  // ============================================
  // 监听器查询
  // ============================================

  /**
   * Returns the number of listeners registered for the specified event.
   *
   * @param event - The event name to query
   * @returns The count of registered listeners
   */
  listenerCount(event: keyof T): number {
    const current = this.events.get(event);
    if (!current) return 0;
    if (typeof current === 'function') return 1;
    return current.prepend.length + current.normal.length;
  }

  /**
   * Returns a copy of the listeners array for the specified event.
   *
   * @template K - Event name key
   * @param event - The event name to query
   * @returns Array of registered listener functions
   */
  listeners<K extends keyof T>(event: K): Callback<T, K>[] {
    const current = this.events.get(event);
    if (!current) return [];
    if (typeof current === 'function') return [current];
    return [...current.prepend, ...current.normal];
  }

  /**
   * Returns an array of event names that have registered listeners.
   *
   * @returns Array of event names with at least one listener
   */
  eventNames(): (keyof T)[] {
    return Array.from(this.events.keys());
  }

  /**
   * Removes all listeners for a specific event, or all listeners if no event is specified.
   *
   * Triggers `removeListener` event for each removed listener.
   * During an active emit, removals are deferred until the emit completes.
   *
   * @param event - Optional event name to remove listeners from
   * @returns This EventEmitter instance for chaining
   */
  removeAllListeners(event?: keyof T): this {
    // --------------------------------------------
    // 场景 A: 正在 emit 过程中 (需要延迟处理)
    // --------------------------------------------
    if (this.emitting_depth > 0) {
      if (event) {
        const storage = this.events.get(event);
        if (storage) {
          this.pending_removals_set ??= new Set<WrappedFn>();
          this.pending_removals_list ??= [];

          if (typeof storage === 'function') {
            this.pending_removals_set.add(storage);
            this.pending_removals_list.push({event, callback: storage});
          } else {
            // 不去重，同一回调可能在 prepend 和 normal 中各有一份
            for (let i = 0, len = storage.prepend.length; i < len; i++) {
              const cb = storage.prepend[i];
              this.pending_removals_set.add(cb);
              this.pending_removals_list.push({event, callback: cb});
            }
            for (let i = 0, len = storage.normal.length; i < len; i++) {
              const cb = storage.normal[i];
              this.pending_removals_set.add(cb);
              this.pending_removals_list.push({event, callback: cb});
            }
          }
        }
      } else {
        this.pending_removals_set ??= new Set<WrappedFn>();
        this.pending_removals_list ??= [];

        for (const [evt, storage] of this.events) {
          if (typeof storage === 'function') {
            this.pending_removals_set.add(storage);
            this.pending_removals_list.push({event: evt, callback: storage});
          } else {
            for (let i = 0, len = storage!.prepend.length; i < len; i++) {
              const cb = storage!.prepend[i];
              this.pending_removals_set.add(cb);
              this.pending_removals_list.push({event: evt, callback: cb});
            }
            for (let i = 0, len = storage!.normal.length; i < len; i++) {
              const cb = storage!.normal[i];
              this.pending_removals_set.add(cb);
              this.pending_removals_list.push({event: evt, callback: cb});
            }
          }
        }
      }
      return this;
    }

    // --------------------------------------------
    // 场景 B: 非 emit 期间 (立即处理)
    // --------------------------------------------

    if (event) {
      // 移除特定事件
      const storage = this.events.get(event);
      this.events.delete(event);
      if (storage) {
        // 准备触发 removeListener 事件
        const rlStorage = this.events.get('removeListener' as keyof T);
        const rlListeners: WrappedFn[] = [];

        if (rlStorage) {
          if (typeof rlStorage === 'function') {
            rlListeners.push(rlStorage);
          } else {
            rlListeners.push(...rlStorage.prepend, ...rlStorage.normal);
          }
        }

        const triggerRemove = (
          removedEvent: keyof T,
          removedCallback: WrappedFn,
        ) => {
          for (let i = 0, len = rlListeners.length; i < len; i++) {
            try {
              rlListeners[i](removedEvent, removedCallback);
            } catch (e) {
              console.error('Error in removeListener handler:', e);
            }
          }
        };

        if (typeof storage === 'function') {
          triggerRemove(event, storage);
        } else {
          for (const cb of storage.prepend) triggerRemove(event, cb);
          for (const cb of storage.normal) triggerRemove(event, cb);
        }
      }
    } else {
      // 移除所有事件
      // 先快照所有监听器
      const snapshot: Array<{event: keyof T; callback: WrappedFn}> = [];
      for (const [evt, storage] of this.events) {
        if (typeof storage === 'function') {
          snapshot.push({event: evt, callback: storage});
        } else {
          for (let i = 0, len = storage!.prepend.length; i < len; i++)
            snapshot.push({event: evt, callback: storage!.prepend[i]});
          for (let i = 0, len = storage!.normal.length; i < len; i++)
            snapshot.push({event: evt, callback: storage!.normal[i]});
        }
      }

      // 分离 removeListener 监听器和普通监听器
      const normal_listeners: typeof snapshot = [];
      const remove_listeners: typeof snapshot = [];

      for (let i = 0, len = snapshot.length; i < len; i++) {
        const item = snapshot[i];
        if (item.event === 'removeListener') {
          remove_listeners.push(item);
        } else {
          normal_listeners.push(item);
        }
      }

      // 触发 removeListener 事件
      const triggerRemoveFromSnapshot = (
        removedEvent: keyof T,
        removedCallback: WrappedFn,
      ) => {
        for (let i = 0, len = remove_listeners.length; i < len; i++) {
          try {
            remove_listeners[i].callback(removedEvent, removedCallback);
          } catch (e) {
            console.error('Error in removeListener handler:', e);
          }
        }
      };

      // 执行单个监听器移除
      const process_removal = (item: {event: keyof T; callback: WrappedFn}) => {
        const {event, callback} = item;
        const current = this.events.get(event);
        if (current) {
          if (typeof current === 'function') {
            if (current === callback) this.events.delete(event);
          } else {
            let idx = current.normal.indexOf(callback);
            if (idx !== -1) {
              current.normal.splice(idx, 1);
            } else {
              idx = current.prepend.indexOf(callback);
              if (idx !== -1) current.prepend.splice(idx, 1);
            }
            const total = current.prepend.length + current.normal.length;
            if (total === 0) this.events.delete(event);
          }
        }
        triggerRemoveFromSnapshot(event, callback);
      };

      // 先移除普通监听器，最后移除 removeListener 监听器
      for (let i = 0, len = normal_listeners.length; i < len; i++)
        process_removal(normal_listeners[i]);
      for (let i = 0, len = remove_listeners.length; i < len; i++)
        process_removal(remove_listeners[i]);

      this.events.clear();
    }

    return this;
  }

  // ============================================
  // 异步方法
  // ============================================

  /**
   * Asynchronously emits an event, awaiting all listener results.
   *
   * All listeners are executed in parallel using `Promise.all`.
   * Listener errors are collected and thrown as `AggregateError` if multiple,
   * or re-thrown directly if only one error occurred.
   *
   * @template K - Event name key
   * @param event - The event name to emit
   * @param args - Arguments to pass to the listeners
   * @returns Promise resolving to `true` if all listeners succeeded
   * @throws The error argument if emitting `error` with no listeners
   * @throws AggregateError if multiple listeners threw errors
   */
  async emitAsync<K extends keyof T>(
    event: K,
    ...args: T[K]
  ): Promise<boolean> {
    const events = this.events;
    const current = events.get(event);

    if (!current) {
      if (event === 'error') throw args[0];
      return false;
    }

    const listeners =
      typeof current === 'object'
        ? [...current.prepend, ...current.normal]
        : [current];

    const errors = new Array<unknown>();
    let has_error = false;

    // 并行执行所有监听器
    await Promise.all(
      listeners.map(async (cb) => {
        try {
          await cb(...args);
        } catch (error) {
          has_error = true;
          if (event !== 'error') {
            const handler_result = await this.handleAsyncError(event, error);
            if (handler_result !== null) errors.push(handler_result);
          } else {
            errors.push(error);
          }
        }
      }),
    );

    if (errors.length === 1) throw errors[0];
    if (errors.length > 1) throw new AggregateError(errors);

    return !has_error;
  }

  // 异步错误处理，返回需要抛出的错误，null 表示已成功处理
  private async handleAsyncError<K extends keyof T>(
    _event: K,
    error: unknown,
  ): Promise<unknown> {
    const storage = this.events.get('error');
    if (!storage) return error;

    const listeners =
      typeof storage === 'object'
        ? [...storage.prepend, ...storage.normal]
        : [storage];

    try {
      await Promise.all(
        listeners.map((cb) => {
          const result = cb(error);
          return isPromiseLike(result) ? result : Promise.resolve();
        }),
      );
      return null;
    } catch (handler_error) {
      return handler_error;
    }
  }

  /**
   * Returns a promise that resolves when the specified event is emitted.
   *
   * Supports timeout, filter function, and AbortSignal for cancellation.
   *
   * @template K - Event name key
   * @param event - The event name to wait for
   * @param options - Optional configuration
   * @param options.timeout - Maximum time to wait in milliseconds
   * @param options.filter - Function to filter which emissions to accept
   * @param options.signal - AbortSignal for cancellation
   * @returns Promise resolving to the event arguments tuple
   * @throws Error on timeout
   * @throws DOMException when aborted via signal
   */
  waitFor<K extends keyof T>(
    event: K,
    options?: {
      timeout?: number;
      filter?: (...args: T[K]) => boolean;
      signal?: AbortSignal;
    },
  ): Promise<T[K]> {
    return new Promise<T[K]>((resolve, reject) => {
      // AbortSignal 检查
      if (options?.signal?.aborted) {
        reject(ensureDOMException(options.signal.reason));
        return;
      }

      let timeout_id: ReturnType<typeof setTimeout> | undefined;

      const cleanup = () => {
        if (timeout_id !== undefined) clearTimeout(timeout_id);
        this.off(event, handler);
        options?.signal?.removeEventListener('abort', abort_handler);
      };

      const handler = (...args: T[K]) => {
        if (options?.filter && !options.filter(...args)) return;
        cleanup();
        resolve(args);
      };

      const abort_handler = () => {
        cleanup();
        reject(ensureDOMException(options!.signal!.reason));
      };

      if (options?.timeout !== undefined) {
        timeout_id = setTimeout(() => {
          cleanup();
          reject(new Error(`Timeout waiting for event "${String(event)}"`));
        }, options.timeout);
      }

      options?.signal?.addEventListener('abort', abort_handler, {once: true});
      this.on(event, handler);
    });
  }

  /**
   * Alias for `waitFor` without filter support.
   *
   * @template K - Event name key
   * @param event - The event name to wait for
   * @param options - Optional configuration
   * @param options.timeout - Maximum time to wait in milliseconds
   * @param options.signal - AbortSignal for cancellation
   * @returns Promise resolving to the event arguments tuple
   */
  onceAsync<K extends keyof T>(
    event: K,
    options?: {timeout?: number; signal?: AbortSignal},
  ): Promise<T[K]> {
    return this.waitFor(event, options);
  }
}
