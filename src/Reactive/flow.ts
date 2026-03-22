// ========================================
// ./src/Reactive/flow.ts
// ========================================

import type {MaybePromise} from 'src/Utils/type-tool';
import {FlowCompletionError, UseAfterFreeError} from 'src/Errors';
import {noop} from 'src/Utils/Functions/base';
import {ensureDOMException} from 'src/unknown-error';

/**
 * Symbol indicating the flow should continue processing.
 * When a controller returns this symbol, the flow keeps waiting for the next value.
 */
export const FlowContinue = Symbol('Flow Continue');

/**
 * Stops the flow with the given return value.
 * When a controller returns this, the flow completes and resolves with the value.
 * @template T - The type of the return value.
 * @param value - The value to return.
 * @returns The same value passed in.
 */
export const FlowStop = <T>(value: T): T => value;

type FlowController<T, R> = (
  value: T,
  iteration: number,
  signal: AbortSignal | undefined,
) => MaybePromise<R | typeof FlowContinue>;

type SwitchFlowController<T, R> = (
  value: T,
  iteration: number,
  signal: AbortSignal,
) => MaybePromise<R | typeof FlowContinue>;

/**
 * Options for consuming a Flow.
 * @template R - The return type of the consume operation.
 */
interface ConsumeOptions<R> {
  /** Callback invoked when the flow completes normally. */
  on_complete?: () => MaybePromise<R>;
  /** Callback invoked when the flow errors. */
  on_error?: (err: unknown) => MaybePromise<R>;
  /** Optional AbortSignal to cancel the consume operation. */
  signal?: AbortSignal;
}

// -- 内部类型定义 --

interface PendingItem<R = unknown> {
  resolve: (value: R) => void;
  reject: (err: unknown) => void;
  on_complete?: () => MaybePromise<R>;
  on_error?: (err: unknown) => MaybePromise<R>;
  queue_index: number;
}

export interface Observer<T> {
  next?: (value: T) => void;
  error?: (err: unknown) => void;
  complete?: () => void;
}

export type Unsubscribable = Readonly<{
  unsubscribe: () => void;
  [Symbol.dispose](): void;
}>;

// -- 常量定义 --

const EMPTY_SUBSCRIPTION: Unsubscribable = {
  unsubscribe: noop,
  [Symbol.dispose]: noop,
};

const MIN_QUEUE_SIZE_FOR_COMPACTION = 64;
const WASTE_RATIO_THRESHOLD = 0.65;

// ============================================
// Helper Functions
// ============================================

// 判断是否需要压缩数组（当浪费空间超过阈值时触发）
function shouldCompactArray(readIndex: number, length: number): boolean {
  if (readIndex < MIN_QUEUE_SIZE_FOR_COMPACTION) return false;
  const waste_ratio = readIndex / Math.max(1, length);
  return waste_ratio > WASTE_RATIO_THRESHOLD;
}

// 压缩普通数组，移除已读取的元素
function compactArray<T>(queue: T[], readIndex: number): number {
  let write = 0;
  for (let i = readIndex; i < queue.length; i++) {
    queue[write] = queue[i];
    write++;
  }
  queue.length = write;
  return 0;
}

// 压缩可空数组，同时更新元素的 queue_index
function compactNullableArray<T extends {queue_index: number}>(
  queue: (T | null)[],
  readIndex: number,
): number {
  let write = 0;
  for (let i = readIndex; i < queue.length; i++) {
    const item = queue[i]!;
    queue[write] = item;
    item.queue_index = write;
    write++;
  }
  queue.length = write;
  return 0;
}

// ============================================
// Flow Class
// ============================================

/**
 * A reactive stream that emits values to subscribers.
 * Supports both push-based (observer pattern) and pull-based (async iterator) consumption.
 * @template T - The type of values emitted by this flow.
 */
export class Flow<T> {
  protected observers = new Set<Observer<T>>();
  protected teardowns = new Array<() => void>();

  protected has_error = false;
  protected is_completed = false;
  protected thrown_error: unknown;

  // pending_items 用于追踪所有正在等待的 consume 调用
  protected pending_items = new Array<PendingItem | null>();
  protected queue_head = 0;

  // -- 广播方法 --

  protected broadcast(value: T): void {
    if (this.closed) return;
    this.observers.forEach((obs) => obs.next?.(value));
  }

  protected broadcastError(err: unknown): void {
    this.thrown_error = err;
    this.has_error = true;
    this.observers.forEach((obs) => obs.error?.(err));
    this.disposeInternal();
  }

  protected broadcastComplete(): void {
    this.is_completed = true;
    this.observers.forEach((obs) => obs.complete?.());
    this.disposeInternal();
  }

  // -- 生命周期管理 --

  protected disposeInternal(): void {
    for (const fn of this.teardowns) fn();
    this.teardowns.length = 0;
    this.observers.clear();
  }

  // -- 队列管理 --

  protected shouldCompact(): boolean {
    return shouldCompactArray(this.queue_head, this.pending_items.length);
  }

  protected compactQueue(): void {
    this.queue_head = compactNullableArray(this.pending_items, this.queue_head);
  }

  // 从队列中移除一个 pending item，标记为 null 以便后续压缩
  protected removePendingItem(item: PendingItem): void {
    this.pending_items[item.queue_index] = null;
    if (item.queue_index === this.queue_head) {
      this.queue_head++;
    }
  }

  // -- 公开 API --

  /** Returns true if the flow has errored or completed. */
  get closed(): boolean {
    return this.has_error || this.is_completed;
  }

  /**
   * Registers a teardown function to be called when the flow completes or errors.
   * If the flow is already closed, the teardown is called immediately.
   */
  addTeardown(teardown: () => void): void {
    if (this.closed) {
      teardown();
    } else {
      this.teardowns.push(teardown);
    }
  }

  /**
   * Subscribes to the flow with an observer or callback.
   * @param observerOrNext - An Observer object or a callback function for next values.
   * @returns An Unsubscribable that can be used to unsubscribe.
   */
  subscribe(observerOrNext: Observer<T> | ((v: T) => void)): Unsubscribable {
    const observer =
      typeof observerOrNext === 'function'
        ? {next: observerOrNext}
        : observerOrNext;

    // 已关闭时立即通知并返回空订阅
    if (this.has_error) {
      observer.error?.(this.thrown_error);
      return EMPTY_SUBSCRIPTION;
    }
    if (this.is_completed) {
      observer.complete?.();
      return EMPTY_SUBSCRIPTION;
    }

    this.observers.add(observer);

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    const unsubscribe = () => {
      self.observers.delete(observer);
    };
    return {unsubscribe, [Symbol.dispose]: unsubscribe};
  }

  /** Emits a value to all subscribers. */
  next(value: T): void {
    this.broadcast(value);
  }

  /** Signals an error to all subscribers and completes the flow. */
  error(err: unknown): void {
    if (this.closed) return;

    // 处理所有等待中的 consume 调用
    for (let i = this.queue_head; i < this.pending_items.length; i++) {
      const item = this.pending_items[i]!;
      if (item.on_error) {
        void Promise.resolve(item.on_error(err)).then(
          item.resolve,
          item.reject,
        );
      } else {
        item.reject(err);
      }
    }
    this.pending_items.length = 0;
    this.queue_head = 0;

    this.broadcastError(err);
  }

  /** Signals completion to all subscribers. */
  complete(): void {
    if (this.closed) return;

    // 处理所有等待中的 consume 调用
    for (let i = this.queue_head; i < this.pending_items.length; i++) {
      const item = this.pending_items[i]!;
      if (item.on_complete) {
        void Promise.resolve(item.on_complete()).then(
          item.resolve,
          item.reject,
        );
      } else {
        item.reject(new FlowCompletionError());
      }
    }
    this.pending_items.length = 0;
    this.queue_head = 0;

    this.broadcastComplete();
  }

  // -- Consume 相关 --

  protected createPendingItem<R>(): PendingItem<R> {
    const item: PendingItem<R> = {
      resolve: noop,
      reject: noop,
      queue_index: this.pending_items.length,
    };
    this.pending_items.push(item as PendingItem);
    return item;
  }

  /**
   * Consumes values from the flow until the controller returns a value.
   * Each emitted value is passed to the controller, which can return:
   * - FlowContinue: keep waiting for more values
   * - Any other value: resolve the promise with that value
   * @template R - The return type of the consume operation.
   * @param controller - Function called for each emitted value.
   * @param options - Optional callbacks for completion/error and abort signal.
   * @returns Promise that resolves when the controller returns a value.
   */
  async consume<R>(
    controller: FlowController<T, R>,
    options?: ConsumeOptions<R>,
  ): Promise<R> {
    const {on_complete, on_error, signal} = options ?? {};
    if (this.closed) throw new UseAfterFreeError('Subject is closed');
    if (signal?.aborted) throw ensureDOMException(signal.reason);

    return new Promise<R>((resolve, reject) => {
      let iteration = 0;
      let settled = false;

      const pending_item = this.createPendingItem<R>();
      pending_item.resolve = resolve;
      pending_item.reject = reject;
      if (on_complete) pending_item.on_complete = on_complete;
      if (on_error) pending_item.on_error = on_error;

      const cleanup = () => {
        signal?.removeEventListener('abort', abort_handler);
        this.observers.delete(internalObserver);
        this.removePendingItem(pending_item as PendingItem);
        if (this.shouldCompact()) this.compactQueue();
      };

      const abort_handler = () => {
        cleanup();
        reject(ensureDOMException(signal!.reason));
      };

      signal?.addEventListener('abort', abort_handler);
      const internalObserver: Observer<T> = {
        next: (value: T) => {
          void (async () => {
            try {
              const result = await controller(value, iteration++, signal);
              if (settled || signal?.aborted) return;
              if (result !== FlowContinue) {
                settled = true;
                cleanup();
                resolve(result);
              }
            } catch (e) {
              cleanup();
              reject(e as Error);
            }
          })();
        },
      };
      this.observers.add(internalObserver);
    });
  }

  /**
   * Similar to consume, but cancels the previous controller call when a new value arrives.
   * Useful for scenarios like search-as-you-type where only the latest input matters.
   * @template R - The return type of the consume operation.
   * @param controller - Function called for each emitted value with an AbortSignal.
   * @param options - Optional callbacks for completion/error and abort signal.
   * @returns Promise that resolves when the controller returns a value.
   */
  async switchConsume<R>(
    controller: SwitchFlowController<T, R>,
    options?: ConsumeOptions<R>,
  ): Promise<R> {
    const {on_complete, on_error, signal: external_signal} = options ?? {};
    if (this.closed) throw new UseAfterFreeError('Subject is closed');
    if (external_signal?.aborted)
      throw ensureDOMException(external_signal.reason);

    return new Promise<R>((resolve, reject) => {
      let iteration = 0;
      let current_abort: AbortController | null = null;
      let settled = false;

      const pending_item = this.createPendingItem<R>();
      pending_item.resolve = resolve;
      pending_item.reject = reject;
      if (on_complete) pending_item.on_complete = on_complete;
      if (on_error) pending_item.on_error = on_error;

      const abort_handler = () => {
        current_abort?.abort();
        cleanup();
        reject(ensureDOMException(external_signal!.reason));
      };

      const cleanup = () => {
        external_signal?.removeEventListener('abort', abort_handler);
        this.observers.delete(internalObserver);
        this.removePendingItem(pending_item as PendingItem);
        if (this.shouldCompact()) this.compactQueue();
      };

      external_signal?.addEventListener('abort', abort_handler);

      const internalObserver: Observer<T> = {
        next: (value: T) => {
          void (async () => {
            // 取消上一次的执行，实现 switch 语义
            current_abort?.abort();
            const abort = new AbortController();
            current_abort = abort;

            // 合并外部 signal 和内部 abort
            const combined_signal = abort.signal;
            if (external_signal) {
              const external_abort_handler = () => abort.abort();
              external_signal.addEventListener(
                'abort',
                external_abort_handler,
                {once: true},
              );
            }

            try {
              const result = await controller(
                value,
                iteration++,
                combined_signal,
              );
              // 检查是否已被新调用取代或已取消
              if (settled || abort.signal.aborted) return;
              if (result !== FlowContinue) {
                settled = true;
                cleanup();
                resolve(result);
              }
            } catch (e) {
              // 忽略内部主动 abort 引发的错误
              if (e instanceof DOMException && e.name === 'AbortError') return;
              settled = true;

              cleanup();
              reject(e as Error);
            }
          })();
        },
      };

      this.observers.add(internalObserver);
    });
  }

  /** Returns an async iterator for the flow, enabling for-await-of syntax. */
  [Symbol.asyncIterator](): AsyncIterator<T> {
    const buffer = new Array<T>();
    let resolveNext: ((value: IteratorResult<T>) => void) | null = null;
    let error: unknown = null;
    let done = false;

    const subscription = this.subscribe({
      next: (value) => {
        if (resolveNext) {
          resolveNext({value, done: false});
          resolveNext = null;
        } else {
          buffer.push(value);
        }
      },
      error: (err) => {
        error = err;
        if (resolveNext) {
          resolveNext({value: undefined, done: true});
          resolveNext = null;
        }
      },
      complete: () => {
        done = true;
        if (resolveNext) {
          resolveNext({value: undefined, done: true});
          resolveNext = null;
        }
      },
    });

    return {
      next: async (): Promise<IteratorResult<T>> => {
        if (error) throw error as Error;
        if (buffer.length > 0) return {value: buffer.shift()!, done: false};
        if (done) return {value: undefined, done: true};
        return new Promise((resolve) => {
          resolveNext = resolve;
        });
      },
      return: (): Promise<IteratorResult<T>> => {
        subscription.unsubscribe();
        return Promise.resolve({value: undefined, done: true});
      },
    };
  }
}

// ============================================
// SerialFlow Class
// ============================================

/**
 * A Flow variant that processes values sequentially.
 * Unlike the base Flow, SerialFlow ensures each value is fully processed
 * before the next one is handled, preventing concurrent controller executions.
 * @template T - The type of values emitted by this flow.
 */
export class SerialFlow<T> extends Flow<T> {
  protected pending_queue = new Array<T>();
  protected queue_read_index = 0;
  protected is_consuming = false;

  override switchConsume(): never {
    throw new TypeError(
      'SerialFlow does not support switchConsume. Use consume() instead.',
    );
  }

  /**
   * Consumes values sequentially, ensuring each value is fully processed before the next.
   * Values emitted during processing are queued and processed in order.
   */
  async consume<R>(
    controller: FlowController<T, R>,
    options?: ConsumeOptions<R>,
  ): Promise<R> {
    const {on_complete, on_error, signal} = options ?? {};
    if (this.closed) throw new UseAfterFreeError('SerialFlow is closed');
    if (signal?.aborted) throw ensureDOMException(signal.reason);

    return new Promise<R>((resolve, reject) => {
      let iteration = 0;

      const pending_item = this.createPendingItem<R>();
      pending_item.resolve = resolve;
      pending_item.reject = reject;
      if (on_complete) pending_item.on_complete = on_complete;
      if (on_error) pending_item.on_error = on_error;

      const cleanup = () => {
        signal?.removeEventListener('abort', abort_handler);
        this.observers.delete(internalObserver);
        this.removePendingItem(pending_item as PendingItem);
      };

      const abort_handler = () => {
        cleanup();
        reject(ensureDOMException(signal!.reason));
      };

      signal?.addEventListener('abort', abort_handler);

      // 串行处理循环：逐个处理队列中的值
      const runLoop = async () => {
        if (this.is_consuming) return;
        this.is_consuming = true;

        while (
          this.queue_read_index < this.pending_queue.length &&
          !this.is_completed &&
          !signal?.aborted
        ) {
          const value = this.pending_queue[this.queue_read_index];
          this.queue_read_index++;

          try {
            const result = await controller(value, iteration++, signal);
            if (signal?.aborted) break;
            if (result !== FlowContinue) {
              cleanup();
              if (
                shouldCompactArray(
                  this.queue_read_index,
                  this.pending_queue.length,
                )
              )
                this.queue_read_index = compactArray(
                  this.pending_queue,
                  this.queue_read_index,
                );
              resolve(result);
              return;
            }
          } catch (e) {
            if (signal?.aborted) return; // 外部中止，静默退出
            cleanup();
            if (
              shouldCompactArray(
                this.queue_read_index,
                this.pending_queue.length,
              )
            )
              this.queue_read_index = compactArray(
                this.pending_queue,
                this.queue_read_index,
              );

            reject(e as Error);
            return;
          }
        }

        this.is_consuming = false;
      };

      const internalObserver: Observer<T> = {
        next: (value: T) => {
          this.pending_queue.push(value);
          void runLoop();
        },
      };

      this.observers.add(internalObserver);
    });
  }
}

// ============================================
// BehaviorFlow Class
// ============================================

/**
 * A Flow that always has a current value and emits it to new subscribers immediately.
 * Similar to RxJS's BehaviorSubject.
 * @template T - The type of the current value.
 */
export class BehaviorFlow<T> extends Flow<T> {
  private _value: T;

  constructor(initialValue: T) {
    super();
    this._value = initialValue;
  }

  /** Returns the current value. */
  get value(): T {
    return this._value;
  }

  /**
   * Subscribes to the flow and immediately receives the current value.
   * @param observerOrNext - An Observer object or a callback function.
   * @returns An Unsubscribable that can be used to unsubscribe.
   */
  override subscribe(
    observerOrNext: Observer<T> | ((v: T) => void),
  ): Unsubscribable {
    const observer =
      typeof observerOrNext === 'function'
        ? {next: observerOrNext}
        : observerOrNext;

    if (this.has_error) {
      observer.error?.(this.thrown_error);
      return EMPTY_SUBSCRIPTION;
    }
    if (this.is_completed) {
      observer.complete?.();
      return EMPTY_SUBSCRIPTION;
    }

    // 立即发射当前值给新订阅者
    observer.next?.(this._value);

    this.observers.add(observer);

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    const unsubscribe = () => {
      self.observers.delete(observer);
    };
    return {unsubscribe, [Symbol.dispose]: unsubscribe};
  }

  /** Updates the current value and emits it to all subscribers. */
  override next(value: T): void {
    this._value = value;
    super.next(value);
  }
}

// ============================================
// ColdFlow Implementation
// ============================================

/** Function type that produces values into a Flow. */
export type FlowProducer<T> = (flow: Flow<T>) => (() => void) | void;

/**
 * A Flow that starts producing values only when subscribed (cold stream).
 * Each subscription triggers the producer function.
 * @template T - The type of values emitted by this flow.
 */
export class ColdFlow<T> extends Flow<T> {
  private producer: FlowProducer<T>;

  constructor(producer: FlowProducer<T>) {
    super();
    this.producer = producer;
  }

  /**
   * Subscribes to the flow and starts the producer.
   * The producer is called once per subscription.
   */
  override subscribe(
    observerOrNext: Observer<T> | ((v: T) => void),
  ): Unsubscribable {
    if (this.closed) return super.subscribe(observerOrNext);

    const sub = super.subscribe(observerOrNext);

    try {
      const teardown = this.producer(this);
      if (teardown) {
        this.addTeardown(teardown);
      }
    } catch (err) {
      this.error(err);
    }

    return sub;
  }
}

// ============================================
// Factory Functions
// ============================================

/** Creates a Flow from a producer function. */
export function fromProducer<T>(producer: FlowProducer<T>): Flow<T> {
  return new ColdFlow(producer);
}

/** Creates a SerialFlow from a producer function. */
export function fromSerialProducer<T>(
  producer: FlowProducer<T>,
): SerialFlow<T> {
  return new SerialColdFlow(producer);
}

/** Creates a Flow that emits the given values and completes. */
export function of<T>(...values: T[]): Flow<T> {
  return fromProducer((dest) => {
    for (const value of values) {
      if (dest.closed) return;
      dest.next(value);
    }
    dest.complete();
  });
}

// -- from 函数重载 --

export function from<T>(source: Iterable<T>): Flow<T>;
export function from<T>(source: AsyncIterable<T>): Flow<T>;
export function from<T>(source: Promise<T>): Flow<T>;
export function from<T>(source: ArrayLike<T>): Flow<T>;

/**
 * Creates a Flow from various source types.
 * @param source - An Iterable, AsyncIterable, Promise, or ArrayLike.
 * @returns A Flow that emits the source's values.
 */
export function from<T>(
  source: Iterable<T> | AsyncIterable<T> | Promise<T> | ArrayLike<T>,
): Flow<T> {
  // Promise: 发射单个值后完成
  if (source instanceof Promise) {
    return fromProducer((dest) => {
      source.then(
        (value) => {
          if (!dest.closed) {
            dest.next(value);
            dest.complete();
          }
        },
        (err) => {
          if (!dest.closed) dest.error(err);
        },
      );
    });
  }

  // AsyncIterable: 异步迭代发射值
  if (
    typeof (source as AsyncIterable<T>)[Symbol.asyncIterator] === 'function'
  ) {
    return fromProducer((dest) => {
      let cancelled = false;
      void (async () => {
        try {
          for await (const value of source as AsyncIterable<T>) {
            if (cancelled || dest.closed) return;
            dest.next(value);
          }
          dest.complete();
        } catch (err) {
          dest.error(err);
        }
      })();
      return () => {
        cancelled = true;
      };
    });
  }

  // Iterable: 同步迭代发射值
  if (typeof (source as Iterable<T>)[Symbol.iterator] === 'function') {
    return fromProducer((dest) => {
      for (const value of source as Iterable<T>) {
        if (dest.closed) return;
        dest.next(value);
      }
      dest.complete();
    });
  }

  // ArrayLike: 按索引访问发射值
  if ('length' in source) {
    return fromProducer((dest) => {
      const arr = source;
      for (let i = 0; i < arr.length; i++) {
        if (dest.closed) return;
        dest.next(arr[i]);
      }
      dest.complete();
    });
  }

  throw new TypeError('Cannot convert the provided source to a Flow');
}

// ============================================
// SerialColdFlow Class
// ============================================

/**
 * A SerialFlow that starts producing values only when subscribed.
 * Combines cold stream behavior with sequential processing.
 * @template T - The type of values emitted by this flow.
 */
export class SerialColdFlow<T> extends SerialFlow<T> {
  private producer: FlowProducer<T>;

  constructor(producer: FlowProducer<T>) {
    super();
    this.producer = producer;
  }

  override subscribe(
    observerOrNext: Observer<T> | ((v: T) => void),
  ): Unsubscribable {
    if (this.closed) return super.subscribe(observerOrNext);

    const sub = super.subscribe(observerOrNext);

    try {
      const teardown = this.producer(this);
      if (teardown) {
        this.addTeardown(teardown);
      }
    } catch (err) {
      this.error(err);
    }

    return sub;
  }
}
