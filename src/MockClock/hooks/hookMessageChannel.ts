// ========================================
// ./src/MockClock/hooks/hookMessageChannel.ts
// ========================================

import type {HookContext, OriginalAPIs} from '../types';
import {TaskType} from '../types';

class MockMessagePort extends EventTarget {
  private _onmessage: ((this: MessagePort, ev: MessageEvent) => void) | null =
    null;
  private _onmessageerror:
    | ((this: MessagePort, ev: MessageEvent) => void)
    | null = null;
  private _started = false;
  private _closed = false;
  private _message_queue: Array<{
    message: unknown;
    transfer: Transferable[] | undefined;
  }> = [];
  private _other_port: MockMessagePort | null = null;

  constructor(private ctx: HookContext) {
    super();
  }

  _setOtherPort(port: MockMessagePort) {
    this._other_port = port;
  }

  get onmessage(): ((this: MessagePort, ev: MessageEvent) => void) | null {
    return this._onmessage;
  }

  set onmessage(
    handler: ((this: MessagePort, ev: MessageEvent) => void) | null,
  ) {
    if (this._onmessage) {
      this.removeEventListener('message', this._onmessage as EventListener);
    }
    this._onmessage = handler;
    if (handler) {
      this.addEventListener('message', handler as EventListener);
    }
  }

  get onmessageerror(): ((this: MessagePort, ev: MessageEvent) => void) | null {
    return this._onmessageerror;
  }

  set onmessageerror(
    handler: ((this: MessagePort, ev: MessageEvent) => void) | null,
  ) {
    if (this._onmessageerror) {
      this.removeEventListener(
        'messageerror',
        this._onmessageerror as EventListener,
      );
    }
    this._onmessageerror = handler;
    if (handler) {
      this.addEventListener('messageerror', handler as EventListener);
    }
  }

  close(): void {
    if (this._closed) return;
    this._closed = true;
    this._message_queue = [];
    this._started = false;
    this._other_port = null;
  }

  postMessage(
    message: unknown,
    transferOrOptions?: Transferable[] | StructuredSerializeOptions,
  ): void {
    if (this._closed || !this._other_port) return;

    const transfer = Array.isArray(transferOrOptions)
      ? transferOrOptions
      : transferOrOptions?.transfer;

    const timeline = this.ctx.getTimeline();
    if (!timeline) return;

    const other_port = this._other_port;

    if (!other_port._started) {
      other_port._message_queue.push({message, transfer});
      return;
    }

    timeline['addTimer'](
      TaskType.messageChannel,
      () => {
        if (other_port._closed) return;
        const event = new MessageEvent('message', {
          data: message,
          ports:
            transfer?.filter(
              (t): t is MessagePort => t instanceof MessagePort,
            ) ?? [],
        });
        other_port.dispatchEvent(event);
      },
      0,
      [],
    );

    timeline.runMicrotasks();
  }

  start(): void {
    if (this._started || this._closed) return;
    this._started = true;
    this._flush_queue();
  }

  private _flush_queue(): void {
    while (this._message_queue.length > 0 && !this._closed) {
      const item = this._message_queue.shift()!;
      const event = new MessageEvent('message', {
        data: item.message,
        ports:
          item.transfer?.filter(
            (t): t is MessagePort => t instanceof MessagePort,
          ) ?? [],
      });
      this.dispatchEvent(event);
    }
  }

  override addEventListener<K extends keyof MessagePortEventMap>(
    type: K,
    listener: (this: MessagePort, ev: MessagePortEventMap[K]) => unknown,
    options?: boolean | AddEventListenerOptions,
  ): void;
  override addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void;
  override addEventListener(
    type: string,
    listener:
      | EventListenerOrEventListenerObject
      | ((this: MessagePort, ev: MessageEvent) => unknown),
    options?: boolean | AddEventListenerOptions,
  ): void {
    super.addEventListener(
      type,
      listener as EventListenerOrEventListenerObject,
      options,
    );

    if (type === 'message' && !this._started && !this._closed) {
      this._started = true;
      this._flush_queue();
    }
  }

  override removeEventListener<K extends keyof MessagePortEventMap>(
    type: K,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    listener: (this: MessagePort, ev: MessagePortEventMap[K]) => any,
    options?: boolean | EventListenerOptions,
  ): void;
  override removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
  ): void;
  override removeEventListener(
    type: string,

    listener:
      | EventListenerOrEventListenerObject
      | ((this: MessagePort, ev: MessageEvent) => unknown),
    options?: boolean | EventListenerOptions,
  ): void {
    super.removeEventListener(
      type,
      listener as EventListenerOrEventListenerObject,
      options,
    );
  }
}

class MockMessageChannel {
  readonly port1: MockMessagePort;
  readonly port2: MockMessagePort;

  constructor(ctx: HookContext) {
    const port1 = new MockMessagePort(ctx);
    const port2 = new MockMessagePort(ctx);

    port1._setOtherPort(port2);
    port2._setOtherPort(port1);

    this.port1 = port1;
    this.port2 = port2;
  }
}

export function hookMessageChannel(ctx: HookContext, orig: OriginalAPIs) {
  const _orig_message_channel = orig.MessageChannel;

  const Wrapper = function (this: unknown) {
    if (!ctx.shouldMock('MessageChannel')) {
      return new _orig_message_channel();
    }
    return new MockMessageChannel(ctx);
  };

  Object.setPrototypeOf(Wrapper, _orig_message_channel);
  Wrapper.prototype = MockMessageChannel.prototype;
  globalThis.MessageChannel = Wrapper as unknown as typeof MessageChannel;
}

export function restoreMessageChannel(orig: OriginalAPIs) {
  globalThis.MessageChannel = orig.MessageChannel;
}
