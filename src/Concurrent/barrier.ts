// ========================================
// ./src/Concurrent/barrier.ts
// ========================================
import {noop} from 'src/Utils/Functions/base';
import {ParameterError} from '../Errors';
import {ensureDOMException} from '../unknown-error';

/**
 * Represents a deferred promise with explicit resolve/reject controls.
 * @template T - The type of value the promise resolves to.
 * @internal
 */
interface Deferred<T = void> {
  /** The promise that can be resolved or rejected externally. */
  promise: Promise<T>;
  /** Resolves the associated promise with the given value. */
  resolve: (value: T) => void;
  /** Rejects the associated promise with the given reason. */
  reject: (reason: unknown) => void;
}

/**
 * Creates a deferred object allowing external control over promise resolution.
 * @template T - The type of the resolved value.
 * @returns A {@link Deferred} object containing the promise and its control functions.
 * @example
 * ```typescript
 * const deferred = createDeferred<string>();
 * deferred.promise.then(value => console.log(value));
 * deferred.resolve("Hello");
 * ```
 */
function createDeferred<T = void>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return {promise, resolve, reject};
}

/**
 * Abstract base class providing standardized abort signal handling.
 *
 * Manages automatic cleanup of abort event listeners to prevent memory leaks.
 * Subclasses should call {@link Abortable.setupAbortHandler} during initialization
 * and {@link Abortable.cleanupAbortHandler} during disposal.
 *
 * @remarks
 * When the associated abort signal triggers, the registered callback is invoked
 * with the abort reason converted to a {@link DOMException}.
 *
 * @throws {DOMException} Propagates the abort reason when the signal is aborted.
 */
abstract class Abortable {
  /** Optional abort signal for controlling operation cancellation. */
  protected readonly abort_signal: AbortSignal | undefined;
  private abortHandler: (() => void) | null = null;

  /**
   * Constructs an abortable instance.
   * @param signal - Optional {@link AbortSignal} for cancellation support.
   */
  constructor(signal?: AbortSignal) {
    this.abort_signal = signal;
  }

  /**
   * Registers an abort handler that invokes the callback when the signal aborts.
   *
   * If the signal is already aborted, the callback is invoked immediately.
   * The abort reason is converted to a {@link DOMException} via {@link ensureDOMException}.
   *
   * @param on_abort - Callback invoked with the abort reason when signal aborts.
   * @remarks This method should be called during subclass initialization.
   */
  protected setupAbortHandler(on_abort: (reason: unknown) => void) {
    if (!this.abort_signal) return;

    if (this.abort_signal.aborted) {
      on_abort(ensureDOMException(this.abort_signal.reason));
      return;
    }

    this.abortHandler = () => {
      on_abort(ensureDOMException(this.abort_signal!.reason));
    };

    this.abort_signal.addEventListener('abort', this.abortHandler);
  }

  /**
   * Cleans up the abort event listener.
   *
   * @remarks
   * Safe to call multiple times. No operation if no handler is registered.
   * Should be called during disposal to prevent memory leaks.
   */
  protected cleanupAbortHandler() {
    if (this.abort_signal && this.abortHandler) {
      this.abort_signal.removeEventListener('abort', this.abortHandler);
    }
    this.abortHandler = null;
  }
}

/**
 * A synchronization primitive that blocks until a specified number of threads/operations arrive.
 *
 * @remarks
 * Once triggered (either by reaching zero arrivals or via abort), the barrier becomes
 * permanently disposed and cannot be reused. This is useful for coordinating multiple
 * asynchronous operations that must all complete before proceeding.
 *
 * Implements both {@link Disposable} and {@link AsyncDisposable} interfaces.
 *
 * @example
 * ```typescript
 * // Create a barrier requiring 3 arrivals
 * const barrier = new Barrier(3);
 *
 * // Three async operations arrive at the barrier
 * Promise.all([
 *   doWork().then(() => barrier.arrive()),
 *   doWork().then(() => barrier.arrive()),
 *   doWork().then(() => barrier.arrive())
 * ]);
 *
 * // Wait for all to complete
 * await barrier.promise;
 * console.log("All work completed!");
 * ```
 *
 * @throws {ParameterError} When initial_count is negative.
 * @throws {DOMException} When the abort signal triggers before barrier resolution.
 */
export class Barrier extends Abortable {
  /** Current number of remaining arrivals required. */
  private count: number;
  /** Deferred promise representing the barrier's resolution. Null when disposed. */
  private deferred: Deferred | null = createDeferred();
  /** Public promise that resolves when the barrier is triggered. */
  public readonly promise: Promise<void>;

  /**
   * Creates a barrier requiring a specified number of arrivals.
   *
   * @param initial_count - Non-negative number of required arrivals.
   * @param signal - Optional {@link AbortSignal} to reject the barrier prematurely.
   * @throws {ParameterError} When `initial_count` is negative.
   * @remarks If `initial_count` is 0, the barrier resolves immediately.
   */
  constructor(initial_count: number, signal?: AbortSignal) {
    super(signal);

    if (initial_count < 0) {
      throw new ParameterError(
        'Barrier: `initial_count` must be a non-negative number.',
      );
    }

    this.count = initial_count;
    this.promise = this.deferred!.promise;

    this.setupAbortHandler(this.handleAbort.bind(this));

    if (this.count === 0) {
      this.trigger();
    }
  }

  /**
   * Handles abort signal by rejecting the barrier with the abort reason.
   *
   * @param reason - Abort reason (converted to {@link DOMException}).
   * @remarks Disposes the barrier after rejection.
   * @internal
   */
  private handleAbort(reason: unknown) {
    this.deferred!.reject(reason);
    this.dispose();
  }

  /**
   * Adjusts the required number of arrivals.
   *
   * @param new_count - New count value. Negative values are treated as 0.
   * @remarks
   * - Has no effect if the barrier is already disposed.
   * - If the new count becomes 0, triggers the barrier immediately.
   */
  resize(new_count: number) {
    if (this.is_disposed) return;

    this.count = Math.max(0, Math.floor(new_count));
    if (this.count === 0) {
      this.trigger();
    }
  }

  /**
   * Reduces the required arrivals by the specified amount.
   *
   * @param amount - Number of arrivals to discard (default: 1).
   * @remarks Delegates to {@link Barrier.resize} with `count - amount`.
   */
  discard(amount: number = 1) {
    this.resize((this.count = Math.max(0, this.count - amount)));
  }

  /**
   * Registers one arrival at the barrier.
   *
   * @remarks
   * - Has no effect if the barrier is already disposed.
   * - Triggers the barrier when the remaining count becomes ≤ 0 (allows overshoot).
   */
  arrive() {
    if (this.is_disposed) return;

    if (--this.count <= 0) {
      this.trigger();
    }
  }

  /**
   * Triggers barrier resolution and disposes it.
   *
   * @remarks Only called when count reaches zero or on abort.
   * @internal
   */
  private trigger() {
    this.deferred!.resolve();
    this.dispose();
  }

  /**
   * Cleans up resources and marks the barrier as disposed.
   *
   * @remarks After disposal, all public methods become no-ops.
   * @internal
   */
  private dispose() {
    this.cleanupAbortHandler();
    this.deferred = null;
  }

  /**
   * Disposes the barrier synchronously.
   *
   * @remarks Implements the {@link Disposable} interface.
   * If the barrier is already triggered, this is a no-op.
   */
  [Symbol.dispose](): void {
    this.dispose();
  }

  /**
   * Indicates whether the barrier has been triggered or aborted.
   */
  get is_disposed(): boolean {
    return this.deferred === null;
  }

  /**
   * Current number of remaining arrivals needed to trigger the barrier.
   */
  get remaining(): number {
    return this.count;
  }
}

/**
 * A reusable barrier that resets after each "generation" of arrivals.
 *
 * @remarks
 * Unlike {@link Barrier}, CyclicBarrier can be reused multiple times.
 * Each call to {@link CyclicBarrier.wait} blocks until the fixed number
 * of parties have arrived, then resets for the next generation.
 *
 * Implements both {@link Disposable} and {@link AsyncDisposable} interfaces.
 * Once broken (by abort or disposal), all current and future {@link CyclicBarrier.wait}
 * calls throw immediately.
 *
 * @example
 * ```typescript
 * // Create a barrier requiring 3 parties per generation
 * const barrier = new CyclicBarrier(3);
 *
 * // Multiple generations of synchronization
 * for (let i = 0; i < 3; i++) {
 *   await Promise.all([
 *     task().then(() => barrier.wait()),
 *     task().then(() => barrier.wait()),
 *     task().then(() => barrier.wait())
 *   ]);
 *   console.log(`Generation ${i} completed`);
 * }
 * ```
 *
 * @throws {ParameterError} When count < 1.
 * @throws {DOMException} When abort signal triggers while waiting.
 * @throws {any} When barrier is broken by previous abort or disposal.
 */
export class CyclicBarrier extends Abortable {
  /** Fixed number of parties required per generation. */
  private readonly initial_count: number;
  /** Current remaining parties needed in this generation. */
  private count: number;
  /** Whether the barrier is broken and will reject all future waits. */
  private is_broken: boolean = false;
  /** Reason for barrier breakage (abort reason or disposal error). */
  private break_reason: unknown = null;
  /** Deferred promise for the current generation. Null when broken. */
  private current_deferred: Deferred | null = null;

  /**
   * Creates a cyclic barrier requiring a fixed number of parties per generation.
   *
   * @param count - Minimum 1; number of parties required to advance each generation.
   * @param signal - Optional {@link AbortSignal} to break the barrier prematurely.
   * @throws {ParameterError} When `count` < 1.
   */
  constructor(count: number, signal?: AbortSignal) {
    super(signal);

    if (count < 1) {
      throw new ParameterError('CyclicBarrier: `count` must be at least 1');
    }

    this.initial_count = count;
    this.count = this.initial_count;
    this.initializeGeneration();

    this.setupAbortHandler(this.handleAbort.bind(this));
  }

  /**
   * Resets the barrier for a new generation.
   *
   * @remarks Called automatically when all parties have arrived.
   * @internal
   */
  private initializeGeneration() {
    this.count = this.initial_count;
    this.current_deferred = createDeferred();
  }

  /**
   * Waits until all parties have arrived at the barrier in the current generation.
   *
   * @returns Promise that resolves when all parties have arrived.
   * @throws {any} If the barrier is broken (by abort or disposal).
   * @remarks The last arriving party triggers generation advancement.
   */
  async wait(): Promise<void> {
    if (this.is_broken) {
      throw this.break_reason;
    }

    const {promise} = this.current_deferred!;

    if (--this.count <= 0) {
      this.triggerNextGeneration();
    }

    return promise;
  }

  /**
   * Resolves the current generation and prepares for the next one.
   *
   * @remarks Cleans up abort handlers before resetting.
   * @internal
   */
  private triggerNextGeneration() {
    const {resolve} = this.current_deferred!;

    this.cleanupAbortHandler();

    this.initializeGeneration();
    resolve();

    if (this.abort_signal && !this.is_broken) {
      this.setupAbortHandler(this.handleAbort.bind(this));
    }
  }

  /**
   * Handles abort signal by breaking the barrier and rejecting current waiters.
   *
   * @param reason - Abort reason (converted to {@link DOMException}).
   * @remarks Once broken, all subsequent {@link CyclicBarrier.wait} calls throw immediately.
   * @internal
   */
  private handleAbort(reason: unknown) {
    if (this.is_broken) return;

    this.is_broken = true;
    this.break_reason = reason;
    const deferred = this.current_deferred;

    this.current_deferred = null;
    this.cleanupAbortHandler();

    deferred?.reject(reason);
    deferred?.promise.catch(noop);
  }

  /**
   * Indicates whether the barrier is broken (aborted/disposed).
   */
  get is_disposed(): boolean {
    return this.current_deferred === null;
  }

  /**
   * Current number of remaining parties needed to advance the generation.
   */
  get remaining(): number {
    return this.count;
  }

  /**
   * Total number of parties required per generation (fixed at construction).
   */
  get parties(): number {
    return this.initial_count;
  }

  /**
   * Indicates whether the barrier is broken and will reject all future waits.
   */
  get broken(): boolean {
    return this.is_broken;
  }

  /**
   * Breaks the barrier with a disposal error.
   *
   * @remarks Implements the {@link Disposable} interface.
   * After disposal, all current and future {@link CyclicBarrier.wait} calls throw.
   */
  [Symbol.dispose](): void {
    this.handleAbort(new Error('CyclicBarrier disposed'));
  }
}
