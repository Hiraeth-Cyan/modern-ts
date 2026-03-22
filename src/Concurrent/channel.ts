// ========================================
// ./src/Concurrent/channel.ts
// ========================================
import {ParameterError, UseAfterFreeError} from 'src/Errors';
import {ensureDOMException, ensureError} from '../unknown-error';

/**
 * Special symbol indicating the channel is closed
 * @remarks Returned by receive methods when channel is closed and no data remains
 */
export const CHANNEL_CLOSED = Symbol('Channel closed');

// -- 内部标记 --
const EMPTY_SLOT = Symbol('Channel empty');

/**
 * Buffer slot type - can contain data or be empty
 * @template T Type of data stored in the channel
 */
type Slot<T> = T | typeof EMPTY_SLOT;

// -- 等待队列节点定义 --

interface SenderNode<T> {
  resolve: () => void; // 发送完成回调
  reject: (reason?: unknown) => void; // 发送失败回调
  value: T; // 待发送的值
  signal?: AbortSignal | undefined; // 可中断信号
  index: number; // 在队列中的位置，用于快速移除
}

interface ReceiverNode<T> {
  resolve: (result: IteratorResult<T, void>) => void; // 接收完成回调
  reject: (reason?: unknown) => void; // 接收失败回调
  index: number; // 在队列中的位置
  signal?: AbortSignal | undefined; // 可中断信号
}

interface ResizeOptions {
  /** Strategy when reducing capacity below current data size */
  strategy?: 'error' | 'discard-oldest' | 'discard-newest';
  /** Whether to process pending senders after resize */
  flush_pending?: boolean;
}

const enum ChannelState {
  ACTIVE = 0,
  CLOSED = 1,
  DISPOSED = 2,
}

declare const Tag_Channel: unique symbol;

/**
 * A channel implementing producer-consumer pattern with bounded capacity
 * @template T Type of data transmitted through the channel
 * @remarks
 * - Uses a circular buffer for data storage
 * - Maintains separate queues for waiting senders and receivers
 * - Supports abort signals for async operations
 * - Auto-compacts internal queues when many slots become empty
 * @throws {UseAfterFreeError} When attempting operations after disposal
 * @throws {ParameterError} When resize would lose data without explicit strategy
 */
export class Channel<T = unknown> {
  declare readonly [Tag_Channel]: void;

  // -- 压缩阈值常量 --
  private static readonly COMPACTION_THRESHOLD = 64;
  private static readonly MIN_QUEUE_SIZE_FOR_COMPACTION = 128;

  // -- 环形缓冲区 --
  private buffer: Slot<T>[];
  private buffer_head = 0; // 下一个出队位置
  private buffer_tail = 0; // 下一个入队位置
  private buffer_size = 0; // 当前数据量

  // -- 通道状态 --
  private _capacity: number;
  private state: ChannelState = ChannelState.ACTIVE;

  // -- 等待队列（数组实现的队列） --
  private senders: Array<SenderNode<T> | null> = [];
  private sender_head = 0;
  private receivers: Array<ReceiverNode<T> | null> = [];
  private receiver_head = 0;

  /**
   * Creates a new channel with specified capacity
   * @param capacity Maximum number of items buffer can hold (default: 0)
   * @remarks Zero capacity creates a rendezvous channel (no buffering)
   * @throws {RangeError} If capacity is negative (implicitly, through Math.max)
   */
  constructor(capacity = 0) {
    this._capacity = Math.max(0, capacity);
    // 用EMPTY_SLOT填充确保类型安全，避免undefined/null歧义
    this.buffer = new Array<Slot<T>>(this._capacity).fill(EMPTY_SLOT);
  }

  // -- 状态检查 --

  private throwIfDisposed(): void {
    if (this.state >= ChannelState.DISPOSED)
      throw new UseAfterFreeError(
        'Channel has been disposed and cannot be used.',
      );
  }

  private throwIfClosedOrDisposed(): void {
    if (this.state >= ChannelState.CLOSED)
      throw new UseAfterFreeError(
        'Channel is closed and cannot accept new sends.',
      );
  }

  // -- 节点清理（防止内存泄漏） --

  private cleanupSender(sender: SenderNode<T>): void {
    sender.signal = undefined;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    (sender as any).resolve = null;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    (sender as any).reject = null;
  }

  private cleanupReceiver(receiver: ReceiverNode<T>): void {
    receiver.signal = undefined;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    (receiver as any).resolve = null;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    (receiver as any).reject = null;
  }

  // -- 中止信号处理 --

  private handleSenderAbort(sender: SenderNode<T>, signal?: AbortSignal): void {
    this.senders[sender.index] = null; // 标记为已移除
    sender.reject(ensureDOMException(signal?.reason));
    this.cleanupSender(sender);
  }

  private handleReceiverAbort(
    receiver: ReceiverNode<T>,
    signal?: AbortSignal,
  ): void {
    this.receivers[receiver.index] = null;
    receiver.reject(ensureDOMException(signal!.reason));
    this.cleanupReceiver(receiver);
  }

  // -- 处理等待节点 --

  private processReceiver(receiver: ReceiverNode<T> | null, value: T): boolean {
    if (!receiver) return false;
    receiver.resolve({value});
    this.cleanupReceiver(receiver);
    return true;
  }

  private processSender(sender: SenderNode<T> | null): boolean {
    if (!sender) return false;
    sender.resolve();
    this.cleanupSender(sender);
    return true;
  }

  /**
   * Changes the channel's capacity
   * @param new_capacity New maximum buffer size
   * @param options Resize behavior options
   * @returns True if resize succeeded
   * @throws {UseAfterFreeError} When channel is disposed or closed
   * @throws {ParameterError} When new capacity < current data size and strategy='error'
   * @remarks
   * - Strategy 'discard-oldest' removes from buffer head
   * - Strategy 'discard-newest' removes from buffer tail
   * - By default, processes pending senders after successful resize
   * - Buffer data is preserved and compacted during resize
   */
  resize(new_capacity: number, options: ResizeOptions = {}): boolean {
    this.throwIfDisposed();
    this.throwIfClosedOrDisposed();

    const {strategy = 'error', flush_pending = true} = options;
    new_capacity = Math.max(0, new_capacity);

    if (new_capacity === this._capacity) return true;

    // 容量缩减时需要处理数据丢失问题
    if (new_capacity < this.buffer_size) {
      if (strategy === 'error') {
        throw new ParameterError(
          `Cannot resize channel: new capacity (${new_capacity}) is smaller than ` +
            `current buffered items (${this.buffer_size}). ` +
            `Use { strategy: 'discard-oldest' | 'discard-newest' } to force resize.`,
        );
      }

      const excess = this.buffer_size - new_capacity;
      if (strategy === 'discard-oldest') {
        // 从头部开始丢弃，保持最新数据
        for (let i = 0; i < excess; i++) {
          this.buffer[this.buffer_head] = EMPTY_SLOT;
          this.buffer_head = (this.buffer_head + 1) % this._capacity;
        }
      }

      if (strategy === 'discard-newest') {
        // 从尾部开始丢弃，保持最旧数据
        for (let i = 0; i < excess; i++) {
          this.buffer_tail =
            (this.buffer_tail - 1 + this._capacity) % this._capacity;
          this.buffer[this.buffer_tail] = EMPTY_SLOT;
        }
      }
      this.buffer_size = new_capacity;
    }

    // 重新分配缓冲区并迁移数据，保持数据连续性
    const new_buffer = new Array<Slot<T>>(new_capacity).fill(EMPTY_SLOT);
    if (this.buffer_size > 0) {
      if (this.buffer_head + this.buffer_size <= this._capacity) {
        // 数据连续，直接拷贝
        for (let i = 0; i < this.buffer_size; i++) {
          new_buffer[i] = this.buffer[this.buffer_head + i];
        }
      } else {
        // 数据跨越边界，分两段拷贝
        const first_part = this._capacity - this.buffer_head;
        for (let i = 0; i < first_part; i++) {
          new_buffer[i] = this.buffer[this.buffer_head + i];
        }
        const second_part = this.buffer_size - first_part;
        for (let i = 0; i < second_part; i++) {
          new_buffer[first_part + i] = this.buffer[i];
        }
      }
    }

    this.buffer = new_buffer;
    this.buffer_head = 0;
    this.buffer_tail = new_capacity === 0 ? 0 : this.buffer_size % new_capacity; // 防止除0错误
    this._capacity = new_capacity;

    // 扩容后尝试处理等待的发送者
    if (
      flush_pending &&
      new_capacity > 0 &&
      this.sender_head < this.senders.length
    ) {
      this.processPendingSenders();
    }
    return true;
  }

  /**
   * Attempts to resize channel, returns false on failure
   * @param new_capacity New maximum buffer size
   * @param options Resize behavior options
   * @returns True if resize succeeded, false otherwise
   * @remarks Does not throw on resize failure, returns false instead
   */
  tryResize(new_capacity: number, options: ResizeOptions = {}): boolean {
    this.throwIfDisposed();
    try {
      return this.resize(new_capacity, options);
    } catch {
      return false;
    }
  }

  /**
   * Asynchronously sends a value through the channel
   * @param value Value to send
   * @param signal Optional abort signal to cancel the send
   * @returns Promise that resolves when value is accepted
   * @throws {UseAfterFreeError} When channel is disposed or closed
   * @throws {DOMException} When abort signal is already triggered
   * @remarks
   * 1. First tries to match with waiting receiver (rendezvous)
   * 2. If buffer space available, stores immediately
   * 3. Otherwise waits in sender queue until space available or abort
   */
  async send(value: T, signal?: AbortSignal): Promise<void> {
    this.throwIfDisposed();
    this.throwIfClosedOrDisposed();
    if (signal?.aborted) throw ensureDOMException(signal?.reason);

    // 优先尝试无锁匹配：直接传递给等待的接收者
    while (this.receiver_head < this.receivers.length) {
      const receiver = this.receivers[this.receiver_head];
      this.receivers[this.receiver_head++] = null;
      if (this.processReceiver(receiver, value)) {
        this.compactReceiverQueueIfNeeded();
        return;
      }
    }

    // 如果有缓冲区空间，直接存入
    if (this.buffer_size < this._capacity) {
      this.buffer[this.buffer_tail] = value;
      this.buffer_tail = (this.buffer_tail + 1) % this._capacity;
      this.buffer_size++;
      return;
    }

    // 缓冲区满，加入等待队列
    return new Promise<void>((resolve, reject) => {
      const node: SenderNode<T> = {
        resolve: () => {
          signal?.removeEventListener('abort', on_abort);
          resolve();
          this.cleanupSender(node);
        },
        reject: (reason) => {
          signal?.removeEventListener('abort', on_abort);
          reject(ensureError(reason));
          this.cleanupSender(node);
        },
        value,
        signal,
        index: -1,
      };

      const on_abort = () => {
        this.handleSenderAbort(node, signal);
      };

      signal?.addEventListener('abort', on_abort, {once: true});
      node.index = this.senders.length;
      this.senders.push(node);
    });
  }

  /**
   * Synchronously attempts to send a value
   * @param value Value to send
   * @returns True if value was accepted, false otherwise
   * @throws {UseAfterFreeError} When channel is disposed or closed
   * @remarks Does not wait - returns false immediately if no buffer space and no waiting receiver
   */
  sendSync(value: T): boolean {
    this.throwIfDisposed();
    this.throwIfClosedOrDisposed();

    // 无锁匹配尝试
    while (this.receiver_head < this.receivers.length) {
      const receiver = this.receivers[this.receiver_head];
      this.receivers[this.receiver_head++] = null;
      if (this.processReceiver(receiver, value)) {
        this.compactReceiverQueueIfNeeded();
        return true;
      }
    }
    // 检查缓冲区空间
    if (this._capacity > 0 && this.buffer_size < this._capacity) {
      this.buffer[this.buffer_tail] = value;
      this.buffer_tail = (this.buffer_tail + 1) % this._capacity;
      this.buffer_size++;
      return true;
    }
    return false;
  }

  /**
   * Attempts to send a value if channel is open
   * @param value Value to send
   * @returns True if value was accepted, false if channel is closed
   * @remarks Silent version of sendSync that returns false instead of throwing when closed
   */
  trySend(value: T): boolean {
    if (this.state >= ChannelState.CLOSED) {
      return false;
    }
    return this.sendSync(value);
  }

  /**
   * Asynchronously receives a value from the channel
   * @param signal Optional abort signal to cancel the receive
   * @returns Promise resolving to received value or CHANNEL_CLOSED symbol
   * @throws {UseAfterFreeError} When channel is disposed
   * @throws {DOMException} When abort signal is already triggered
   * @remarks
   * 1. First tries to dequeue from buffer
   * 2. If closed and buffer empty, returns CHANNEL_CLOSED
   * 3. Otherwise waits in receiver queue until data available, channel closes, or abort
   */
  async receive(signal?: AbortSignal): Promise<T | typeof CHANNEL_CLOSED> {
    this.throwIfDisposed();
    if (signal?.aborted) throw ensureDOMException(signal?.reason);

    // 从缓冲区获取数据
    const dequeued = this.dequeueBuffer();
    if (dequeued !== EMPTY_SLOT) return dequeued;

    // 通道已关闭且无数据时返回特殊标记
    if (this.state >= ChannelState.CLOSED && this.buffer_size === 0) {
      return CHANNEL_CLOSED;
    }

    // 尝试匹配等待的发送者（无缓冲区的直接传递）
    while (this.sender_head < this.senders.length) {
      const sender = this.senders[this.sender_head];
      this.senders[this.sender_head++] = null;
      if (this.processSender(sender)) {
        return sender!.value;
      }
    }

    // 无数据可用，加入等待队列
    return new Promise<T | typeof CHANNEL_CLOSED>((resolve, reject) => {
      const node: ReceiverNode<T> = {
        resolve: (result) => {
          signal?.removeEventListener('abort', on_abort);
          resolve(result.done ? CHANNEL_CLOSED : result.value);
          this.cleanupReceiver(node);
        },
        reject: (reason) => {
          signal?.removeEventListener('abort', on_abort);
          reject(reason as Error);
          this.cleanupReceiver(node);
        },
        index: this.receivers.length,
        signal,
      };

      const on_abort = () => {
        this.handleReceiverAbort(node, signal);
      };

      signal?.addEventListener('abort', on_abort, {once: true});
      this.receivers.push(node);
    });
  }

  /**
   * Synchronously attempts to receive a value
   * @returns Received value, CHANNEL_CLOSED, or undefined if no data
   * @throws {UseAfterFreeError} When channel is disposed
   * @remarks
   * - Returns T if data available in buffer or from waiting sender
   * - Returns CHANNEL_CLOSED if channel closed and buffer empty
   * - Returns undefined if no data available and channel still open
   */
  tryReceive(): T | typeof CHANNEL_CLOSED | undefined {
    this.throwIfDisposed();
    const dequeued = this.dequeueBuffer();
    if (dequeued !== EMPTY_SLOT) return dequeued;
    if (this.state >= ChannelState.CLOSED && this.buffer_size === 0)
      return CHANNEL_CLOSED;

    // 尝试无锁匹配发送者
    while (this.sender_head < this.senders.length) {
      const sender = this.senders[this.sender_head];
      this.senders[this.sender_head++] = null;
      if (this.processSender(sender)) {
        return sender!.value;
      }
    }
    return undefined;
  }

  /**
   * Clears all buffered data
   * @returns Number of items drained from buffer
   * @throws {UseAfterFreeError} When channel is disposed or closed
   * @remarks Processes pending senders after draining if capacity > 0
   */
  drain(): number {
    this.throwIfDisposed();
    this.throwIfClosedOrDisposed();

    const drained = this.buffer_size;
    this.buffer.fill(EMPTY_SLOT);
    this.buffer_size = this.buffer_head = this.buffer_tail = 0;

    // 清空缓冲区后可能有等待的发送者可以入队
    if (this._capacity > 0 && this.sender_head < this.senders.length) {
      this.processPendingSenders();
    }

    return drained;
  }

  /**
   * Closes the channel to new sends
   * @remarks
   * - Rejects all pending senders with UseAfterFreeError
   * - Resolves all pending receivers with done: true
   * - Does nothing if already closed or disposed
   */
  close(): void {
    if (this.state >= ChannelState.CLOSED) return;

    this.state = ChannelState.CLOSED;

    // 拒绝所有等待的发送者
    for (let i = this.sender_head; i < this.senders.length; i++) {
      const sender = this.senders[i];
      if (sender) {
        // 直接调用 reject，sender.reject 内部会处理 signal 的 removeEventListener
        sender.reject(new UseAfterFreeError('Channel is closed'));
        this.senders[i] = null; // 清空队列引用
        // sender.reject 内部已经调用了 this.cleanupSender(sender)
      }
    }
    // 重置发送队列状态
    this.senders.length = 0;
    this.sender_head = 0;

    // 完成所有等待的接收者
    for (let i = this.receiver_head; i < this.receivers.length; i++) {
      const receiver = this.receivers[i];
      if (receiver) {
        // 直接调用 resolve，receiver.resolve 内部会处理 signal 的 removeEventListener
        receiver.resolve({value: undefined, done: true});
        this.receivers[i] = null;
      }
    }
    // 重置接收队列状态
    this.receivers.length = 0;
    this.receiver_head = 0;
  }

  /**
   * Disposes the channel, releasing all resources
   * @remarks Calls close() then marks as disposed and clears buffer
   */
  dispose(): void {
    if (this.state >= ChannelState.DISPOSED) return;
    this.close();
    this.state = ChannelState.DISPOSED;

    this.buffer.fill(EMPTY_SLOT);
    this.buffer_size = this.buffer_head = this.buffer_tail = 0;
    this.buffer = [];
  }

  // -- 缓冲区操作 --

  /** 从环形缓冲区出队一个值，并处理可能等待的发送者 */
  private dequeueBuffer(): Slot<T> {
    if (this.buffer_size === 0) return EMPTY_SLOT;

    const value = this.buffer[this.buffer_head];
    this.buffer[this.buffer_head] = EMPTY_SLOT;
    this.buffer_head = (this.buffer_head + 1) % this._capacity;
    this.buffer_size--;

    // 取出数据后可能有缓冲区空间供发送者使用
    if (this._capacity > 0 && this.sender_head < this.senders.length) {
      this.processPendingSenders();
    }

    return value;
  }

  /** 处理等待的发送者，利用缓冲区空间 */
  private processPendingSenders(): void {
    // 将等待的发送者数据放入缓冲区
    while (
      this.buffer_size < this._capacity &&
      this.sender_head < this.senders.length
    ) {
      const sender = this.senders[this.sender_head];
      this.senders[this.sender_head++] = null;
      if (sender) {
        sender.index = -1;
        this.buffer[this.buffer_tail] = sender.value;
        this.buffer_tail = (this.buffer_tail + 1) % this._capacity;
        this.buffer_size++;
        // sender.resolve 内部已经包含了正确的 removeEventListener 和 cleanupSender 逻辑
        queueMicrotask(sender.resolve);
      }
    }

    // 检查是否需要压缩发送队列（避免内存浪费）
    const unused_slots = this.sender_head;
    if (
      unused_slots > Channel.COMPACTION_THRESHOLD &&
      this.senders.length > Channel.MIN_QUEUE_SIZE_FOR_COMPACTION
    ) {
      this.compactQueue(this.senders, unused_slots);
      this.sender_head = 0;
    }
  }

  /** 压缩接收队列以回收内存 */
  private compactReceiverQueueIfNeeded(): void {
    const unused_slots = this.receiver_head;
    if (
      unused_slots > Channel.COMPACTION_THRESHOLD &&
      this.receivers.length > Channel.MIN_QUEUE_SIZE_FOR_COMPACTION
    ) {
      this.compactQueue(this.receivers, unused_slots);
      this.receiver_head = 0;
    }
  }

  /** 压缩队列，移除空槽并更新节点索引 */
  private compactQueue<U extends {index: number}>(
    queue: Array<U | null>,
    unused_slots: number,
  ): void {
    const remaining = queue.length - unused_slots;
    if (remaining === 0) {
      queue.length = 0;
      return;
    }
    queue.copyWithin(0, unused_slots, queue.length);
    queue.length = remaining;
    // 更新剩余节点的索引，保持快速访问能力
    for (let i = 0; i < remaining; i++) {
      const node = queue[i];
      if (node) node.index = i;
    }
  }

  // -- 属性访问器 --

  /** Gets current channel statistics */
  get stats() {
    let actualWaitingSenders = 0;
    for (let i = this.sender_head; i < this.senders.length; i++)
      if (this.senders[i] !== null) actualWaitingSenders++;
    let actualWaitingReceivers = 0;
    for (let i = this.receiver_head; i < this.receivers.length; i++)
      if (this.receivers[i] !== null) actualWaitingReceivers++;

    return {
      capacity: this._capacity,
      buffered: this.buffer_size,
      waiting_senders: actualWaitingSenders,
      waiting_receivers: actualWaitingReceivers,
      closed: this.state >= ChannelState.CLOSED,
      disposed: this.state >= ChannelState.DISPOSED,
    };
  }

  /** Current channel capacity */
  get capacity(): number {
    return this._capacity;
  }

  /** Whether channel is closed to new sends */
  get isClosed() {
    return this.state >= ChannelState.CLOSED;
  }

  /** Whether channel is fully disposed */
  get isDisposed() {
    return this.state >= ChannelState.DISPOSED;
  }

  /** Number of items currently buffered */
  get buffered(): number {
    return this.buffer_size;
  }

  // -- 迭代器支持 --

  /**
   * Async iterator yielding values until channel closes
   * @yields {T} Next value from channel
   * @returns When channel closes
   */
  async *[Symbol.asyncIterator](): AsyncGenerator<T, void, unknown> {
    while (true) {
      const val = await this.receive();
      if (val === CHANNEL_CLOSED) return;
      yield val;
    }
  }

  /**
   * Receives values in batches
   * @param max_size Maximum batch size (default: Infinity)
   * @param signal Optional abort signal
   * @yields {T[]} Batch of values
   * @throws {DOMException} When abort signal triggered
   * @remarks Yields final partial batch even if channel closes early
   */
  async *receiveBatch(
    max_size: number = Infinity,
    signal?: AbortSignal,
  ): AsyncGenerator<T[], void, unknown> {
    let batch: T[] = [];
    try {
      while (true) {
        if (signal?.aborted) throw ensureDOMException(signal?.reason);
        const val = await this.receive(signal);
        if (val === CHANNEL_CLOSED) break;
        batch.push(val);
        if (batch.length >= max_size) {
          yield batch;
          batch = [];
        }
      }
    } finally {
      // 确保返回剩余数据，避免数据丢失
      if (batch.length > 0) {
        yield batch;
        batch = [];
      }
    }
  }

  /** Synchronous disposal (for using with `using` statement) */
  [Symbol.dispose](): void {
    this.dispose();
  }
}

// ============================================
// Select 多路复用
// ============================================

type SelectableChannel<T> = {
  trySend(value: T): boolean;
  tryReceive(): T | typeof CHANNEL_CLOSED | undefined;
  send(value: T, signal?: AbortSignal): Promise<void>;
  receive(signal?: AbortSignal): Promise<T | typeof CHANNEL_CLOSED>;
  readonly [Tag_Channel]: void;
};

interface SelectSendCase<T = unknown> {
  op: 'send';
  channel: SelectableChannel<T>;
  value: T;
}

interface SelectReceiveCase<T = unknown> {
  op: 'receive';
  channel: SelectableChannel<T>;
}

type SelectCase<T = unknown> = SelectSendCase<T> | SelectReceiveCase<T>;

export type SelectResult<C extends SelectCase<unknown>> =
  | (C extends SelectSendCase<infer T>
      ? SelectSendCase<T> & {value: T}
      : C extends SelectReceiveCase<infer T>
        ? SelectReceiveCase<T> & {value: T | typeof CHANNEL_CLOSED}
        : never)
  | SelectDefaultResult;

export interface SelectDefaultResult {
  op: 'default';
}

export interface SelectOptions {
  /**
   * If provided, this function is called if no other case is ready immediately.
   * This makes the select operation non-blocking.
   */
  default?: () => void;
}

/**
 * Waits for multiple channel operations and returns when one completes.
 * This implements CSP-style select semantics: it checks if any operation can
 * proceed immediately without blocking; otherwise, it waits until one does.
 *
 * @template Cases The array type of select cases
 * @param cases Array of send or receive cases
 * @param signal Optional AbortSignal to cancel the entire select operation
 * @param options Optional configuration object, supports 'default' callback for non-blocking behavior
 * @returns Promise resolving to the case that fired, augmented with the value (for receive), or default
 * @throws {UseAfterFreeError} If a channel operation fails permanently
 * @throws {DOMException} If the provided signal is aborted
 * @remarks
 * - Prioritizes cases that can complete synchronously (using `trySend`/`tryReceive`).
 * - If multiple are ready, the first one in the array is selected.
 * - If none are ready and `options.default` is provided, it executes the callback and returns immediately.
 * - If none are ready and no default is provided, it races async operations.
 */
export async function select<Cases extends [SelectCase, ...SelectCase[]]>(
  cases: Cases,
  signal?: AbortSignal,
  options?: SelectOptions,
): Promise<SelectResult<Cases[number]>> {
  const n = cases.length;
  // 生成一个随机起始位置，像旋转轮盘
  const start_index = Math.floor(Math.random() * n);

  // 同步尝试阶段 (环形遍历)
  for (let i = 0; i < n; i++) {
    const idx = (start_index + i) % n;
    const c = cases[idx];

    if (c.op === 'send') {
      if (c.channel.trySend(c.value)) {
        return c as SelectResult<Cases[number]>;
      }
    } else {
      const val = c.channel.tryReceive();
      if (val !== undefined) {
        return {
          ...c,
          value: val,
        } as SelectResult<Cases[number]>;
      }
    }
  }

  // 检查是否有外部中止信号
  if (signal?.aborted) {
    throw ensureDOMException(signal.reason);
  }

  // Default Case 检查
  if (options?.default) {
    options.default();
    return {op: 'default'};
  }

  // 异步竞争阶段
  const controller = new AbortController();
  const on_abort = () => controller.abort();
  signal?.addEventListener('abort', on_abort, {once: true});

  const racePromises = cases.map((c) => {
    if (c.op === 'send') {
      return c.channel
        .send(c.value, controller.signal)
        .then(() => c as SelectResult<Cases[number]>);
    } else {
      return c.channel.receive(controller.signal).then((val) => {
        return {
          ...c,
          value: val,
        } as SelectResult<Cases[number]>;
      });
    }
  });

  try {
    return await Promise.race(racePromises);
  } finally {
    signal?.removeEventListener('abort', on_abort);
    // 别忘了清理！不然内存会肿起来的！
    controller.abort();
  }
}
