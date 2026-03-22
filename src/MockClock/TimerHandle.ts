// ========================================
// ./src/MockClock/TimerHandle.ts
// ========================================

import type {Timeline} from './Timeline';
import type {TimerRef, ImmedRef, Timer} from './types';
import {TaskType} from './types';

/**
 * Mock timer handle for managing virtual timer references.
 *
 * This class wraps a timer in the mock timeline and provides the same API
 * as native NodeJS.Timeout, allowing transparent replacement in tests.
 */
export class MockTimerHandle implements TimerRef {
  /** The unique identifier of this timer. */
  public readonly id: number;
  private readonly timeline: Timeline;

  /** The delay in milliseconds before the timer fires. */
  public _idle_timeout: number;
  /** The repeat interval for interval timers, or null for one-shot timers. */
  public _repeat: number | null = null;
  /** Whether this timer has been destroyed. */
  public _destroyed: boolean = false;
  /** The callback to invoke when the timer fires. */
  public _on_timeout?: (...args: unknown[]) => void;
  protected _immediate_callback?: (...args: unknown[]) => void;

  public _onImmediate(...args: unknown[]): void {
    this._immediate_callback?.(...args);
  }

  /**
   * Creates a new mock timer handle.
   *
   * @param timeline - The mock timeline that owns this timer.
   * @param timer - The timer configuration object.
   */
  constructor(timeline: Timeline, timer: Timer) {
    this.timeline = timeline;
    this.id = timer.id;
    this._idle_timeout = timer.delay;
    this._on_timeout = timer.callback;

    if (timer.type === TaskType.interval) {
      this._repeat = timer.delay;
    }
    if (timer.type === TaskType.immediate) {
      this._immediate_callback = timer.callback;
    }
  }

  /**
   * Marks the timer as "referenced", preventing the process from exiting.
   *
   * @returns This handle for method chaining.
   */
  public ref(): this {
    const timer = this.timeline.getTimer(this.id);
    if (timer) timer.ref = true;
    return this;
  }

  /**
   * Marks the timer as "unreferenced", allowing the process to exit.
   *
   * @returns This handle for method chaining.
   */
  public unref(): this {
    const timer = this.timeline.getTimer(this.id);
    if (timer) timer.ref = false;
    return this;
  }

  /**
   * Checks whether the timer is in "referenced" state.
   *
   * @returns True if the timer is referenced, false otherwise.
   */
  public hasRef(): boolean {
    const timer = this.timeline.getTimer(this.id);
    return timer ? timer.ref : false;
  }

  /**
   * Refreshes the timer, recalculating its expiry time.
   *
   * @returns This handle for method chaining.
   */
  public refresh(): this {
    this.timeline.refreshTimer(this.id);
    return this;
  }

  /**
   * Cancels and destroys the timer.
   */
  public close(): void {
    this._destroyed = true;
    this.timeline.removeTimer(this.id);
  }

  [Symbol.toPrimitive](): number {
    return this.id;
  }

  [Symbol.dispose](): void {
    this.close();
  }
}

/**
 * Native timer handle wrapper for non-mock mode timer management.
 *
 * This class wraps a native NodeJS.Timeout and provides a consistent API
 * with MockTimerHandle, enabling seamless switching between mock and real timers.
 */
export class NativeTimerHandle implements TimerRef, NodeJS.Timeout {
  /** The underlying native timer handle. */
  public readonly handle: NodeJS.Timeout;
  /** The numeric ID of this timer. */
  public readonly id: number;

  /**
   * Creates a new native timer handle wrapper.
   *
   * @param handle - The native NodeJS.Timeout to wrap.
   * @param delay - The delay in milliseconds.
   * @param callback - Optional callback function for the timer.
   */
  constructor(
    handle: NodeJS.Timeout,
    delay: number,
    callback?: (...args: unknown[]) => void,
  ) {
    this.handle = handle;
    this.id = Number(handle);
    this._idle_timeout = delay;
    this._on_timeout = callback as (...args: unknown[]) => void;
  }

  /** The delay in milliseconds before the timer fires. */
  public _idle_timeout: number;
  /** The repeat interval for interval timers, or null for one-shot timers. */
  public _repeat: number | null = null;
  /** Whether this timer has been destroyed. */
  public _destroyed: boolean = false;
  /** The callback to invoke when the timer fires. */
  public _on_timeout?: (...args: unknown[]) => void;

  /**
   * Marks the timer as "referenced".
   *
   * @returns This handle for method chaining.
   */
  public ref(): this {
    this.handle.ref();
    return this;
  }

  /**
   * Marks the timer as "unreferenced".
   *
   * @returns This handle for method chaining.
   */
  public unref(): this {
    this.handle.unref();
    return this;
  }

  /**
   * Checks whether the timer is in "referenced" state.
   *
   * @returns True if the timer is referenced.
   */
  public hasRef(): boolean {
    return this.handle.hasRef();
  }

  /**
   * Refreshes the timer.
   *
   * @returns This handle for method chaining.
   */
  public refresh(): this {
    this.handle.refresh();
    return this;
  }

  /**
   * Cancels and destroys the timer.
   *
   * @returns This handle for method chaining.
   */
  public close(): this {
    this._destroyed = true;
    this.handle.close();
    return this;
  }

  [Symbol.toPrimitive](): number {
    return this.id;
  }

  [Symbol.dispose](): void {
    this.close();
  }

  _onTimeout(..._args: unknown[]): void {}
}

/**
 * Native setImmediate handle wrapper.
 *
 * This class wraps a native NodeJS.Immediate and provides a consistent API
 * for immediate callbacks in non-mock mode.
 */
export class NativeImmedHandle implements ImmedRef, NodeJS.Immediate {
  /** The underlying native immediate handle. */
  public readonly handle: NodeJS.Immediate;
  private readonly _id: number;

  /**
   * Creates a new native immediate handle wrapper.
   *
   * @param handle - The native NodeJS.Immediate to wrap.
   */
  constructor(handle: NodeJS.Immediate) {
    this.handle = handle;
    this._id = Number(handle);
  }

  /**
   * Marks the immediate as "referenced".
   *
   * @returns This handle for method chaining.
   */
  public ref(): this {
    this.handle.ref();
    return this;
  }

  /**
   * Marks the immediate as "unreferenced".
   *
   * @returns This handle for method chaining.
   */
  public unref(): this {
    this.handle.unref();
    return this;
  }

  /**
   * Checks whether the immediate is in "referenced" state.
   *
   * @returns True if the immediate is referenced.
   */
  public hasRef(): boolean {
    return this.handle.hasRef();
  }

  [Symbol.toPrimitive](): number {
    return this._id;
  }

  [Symbol.dispose](): void {
    this.handle[Symbol.dispose]();
  }

  _onImmediate(..._args: unknown[]): void {}
}
