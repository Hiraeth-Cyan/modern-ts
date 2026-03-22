// ========================================
// ./src/Concurrent/Valve/circuit-breaker.ts
// ========================================

import type {MaybePromise} from 'src/Utils/type-tool';
import {ParameterError} from '../../Errors';
import {delaySafe} from '../delay';
import {ensureDOMException} from 'src/unknown-error';

// -- 类型定义 --

/**
 * Circuit breaker state enumeration.
 */
export const enum CircuitState {
  Closed = 0,
  Open = 1,
  HalfOpen = 2,
}

/**
 * Circuit breaker configuration options.
 */
export interface CircuitBreakerConfig {
  /** Number of consecutive failures before opening the circuit (default: 5) */
  failure_threshold: number;
  /** Time in milliseconds before attempting to close the circuit (default: 30000) */
  reset_timeout: number;
  /** Number of successful requests in half-open state to close the circuit (default: 3) */
  success_threshold: number;
}

/**
 * Result of a circuit breaker operation.
 */
export interface CircuitBreakerResult<T> {
  /** The result value if successful */
  value?: T;
  /** The error if failed */
  error?: unknown;
  /** Whether the operation succeeded */
  success: boolean;
  /** Current circuit state after the operation */
  state: CircuitState;
}

// -- 错误类 --

/**
 * Error thrown when the circuit breaker is open and rejects a request.
 */
export class CircuitBreakerOpenError extends Error {
  /**
   * Creates an instance of CircuitBreakerOpenError.
   * @param reset_timeout - The time remaining before the circuit may close.
   */
  constructor(public readonly reset_timeout: number) {
    super(`Circuit breaker is open. Retry after ${reset_timeout}ms.`);
    this.name = 'CircuitBreakerOpenError';
    /* v8 ignore next -- @preserve */
    if (typeof Error.captureStackTrace === 'function')
      Error.captureStackTrace(this, CircuitBreakerOpenError);
  }
}

// ============================================
// CircuitBreaker
// ============================================

/**
 * Circuit breaker pattern implementation for fault tolerance.
 *
 * The circuit breaker monitors failures and automatically opens to prevent
 * cascading failures when a service is unhealthy. After a timeout period,
 * it enters a half-open state to test if the service has recovered.
 *
 * States:
 * - **closed**: Normal operation, all requests pass through
 * - **open**: Circuit is tripped, all requests are rejected immediately
 * - **half-open**: Limited requests allowed to test service recovery
 *
 * @example
 * ```ts
 * const breaker = new CircuitBreaker({
 *   failure_threshold: 5,
 *   reset_timeout: 30000,
 *   success_threshold: 3
 * });
 *
 * const result = await breaker.execute(async () => {
 *   return await fetch('https://api.example.com/data');
 * });
 * ```
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.Closed;
  private failure_count = 0;
  private success_count = 0;
  private last_failure_time = 0;

  private readonly failure_threshold: number;
  private readonly reset_timeout: number;
  private readonly success_threshold: number;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    const {
      failure_threshold = 5,
      reset_timeout = 30000,
      success_threshold = 3,
    } = config;

    if (!Number.isFinite(failure_threshold) || failure_threshold <= 0)
      throw new ParameterError(
        `CircuitBreaker: \`failure_threshold\` must be a positive finite number, but got ${failure_threshold}`,
      );
    if (!Number.isFinite(reset_timeout) || reset_timeout <= 0)
      throw new ParameterError(
        `CircuitBreaker: \`reset_timeout\` must be a positive finite number, but got ${reset_timeout}`,
      );
    if (!Number.isFinite(success_threshold) || success_threshold <= 0)
      throw new ParameterError(
        `CircuitBreaker: \`success_threshold\` must be a positive finite number, but got ${success_threshold}`,
      );

    this.failure_threshold = failure_threshold;
    this.reset_timeout = reset_timeout;
    this.success_threshold = success_threshold;
  }

  // ============================================
  // Public API
  // ============================================

  /**
   * Executes a function through the circuit breaker.
   *
   * @param fn - The async function to execute
   * @param signal - Optional AbortSignal for cancellation
   * @returns The result of the function execution
   * @throws {CircuitBreakerOpenError} If the circuit is open
   * @throws {DOMException} If the signal is aborted
   */
  public async execute<T>(
    fn: (signal?: AbortSignal) => MaybePromise<T>,
    signal?: AbortSignal,
  ): Promise<T> {
    if (signal?.aborted) {
      throw ensureDOMException(signal.reason);
    }

    const current_state = this.getCurrentState();

    if (current_state === CircuitState.Open) {
      const remaining = this.getRemainingTimeout();
      throw new CircuitBreakerOpenError(remaining);
    }

    try {
      const result = await fn(signal);
      this.onSuccess();
      return result;
    } catch (error) {
      const isAbortError =
        error instanceof DOMException && error.name === 'AbortError';
      if (!isAbortError) this.onFailure();

      throw error;
    }
  }

  /**
   * Attempts to execute a function, returning a result object instead of throwing.
   *
   * @param fn - The async function to execute
   * @param signal - Optional AbortSignal for cancellation
   * @returns A result object containing success status and value/error
   */
  public async tryExecute<T>(
    fn: (signal?: AbortSignal) => MaybePromise<T>,
    signal?: AbortSignal,
  ): Promise<CircuitBreakerResult<T>> {
    try {
      const value = await this.execute(fn, signal);
      return {value, success: true, state: this.state};
    } catch (error) {
      if (error instanceof CircuitBreakerOpenError) {
        return {
          error,
          success: false,
          state: CircuitState.Open,
        };
      }
      return {
        error,
        success: false,
        state: this.state,
      };
    }
  }

  /**
   * Waits for the circuit to exit the Open state.
   * This method returns when the circuit enters HalfOpen or Closed state.
   *
   * @param signal - Optional AbortSignal for cancellation
   * @throws {DOMException} If the signal is aborted
   */
  public async waitForRecovery(signal?: AbortSignal): Promise<void> {
    while (this.getCurrentState() === CircuitState.Open) {
      const remaining = this.getRemainingTimeout();

      const abort_result = await delaySafe(remaining, signal);
      if (abort_result) throw abort_result;
    }
  }

  /**
   * Manually resets the circuit breaker to closed state.
   */
  public reset(): void {
    this.state = CircuitState.Closed;
    this.failure_count = 0;
    this.success_count = 0;
    this.last_failure_time = 0;
  }

  /**
   * Manually trips the circuit breaker to open state.
   */
  public trip(): void {
    this.state = CircuitState.Open;
    this.last_failure_time = performance.now();
  }

  /**
   * Returns the current state of the circuit breaker.
   */
  public getState(): CircuitState {
    return this.getCurrentState();
  }

  /**
   * Returns the current statistics of the circuit breaker.
   */
  public getStats() {
    return {
      state: this.getCurrentState(),
      failure_count: this.failure_count,
      success_count: this.success_count,
      failure_threshold: this.failure_threshold,
      success_threshold: this.success_threshold,
      reset_timeout: this.reset_timeout,
      last_failure_time: this.last_failure_time,
      remaining_timeout: this.getRemainingTimeout(),
    };
  }

  // ============================================
  // Private Methods
  // ============================================

  /**
   * Gets the current state, handling automatic state transitions.
   */
  private getCurrentState(): CircuitState {
    if (this.state === CircuitState.Open) {
      const elapsed = performance.now() - this.last_failure_time;
      if (elapsed >= this.reset_timeout) {
        this.state = CircuitState.HalfOpen;
        this.success_count = 0;
      }
    }
    return this.state;
  }

  /**
   * Calculates remaining time until the circuit may close.
   */
  private getRemainingTimeout(): number {
    if (this.state !== CircuitState.Open) return 0;
    const elapsed = performance.now() - this.last_failure_time;
    return Math.max(0, this.reset_timeout - elapsed);
  }

  /**
   * Handles successful operation completion.
   */
  private onSuccess(): void {
    this.failure_count = 0;

    if (this.state === CircuitState.HalfOpen) {
      this.success_count++;
      if (this.success_count >= this.success_threshold) {
        this.state = CircuitState.Closed;
        this.success_count = 0;
      }
    }
  }

  /**
   * Handles failed operation completion.
   */
  private onFailure(): void {
    this.failure_count++;
    this.last_failure_time = performance.now();

    if (this.state === CircuitState.HalfOpen) {
      this.state = CircuitState.Open;
      this.success_count = 0;
    } else if (this.failure_count >= this.failure_threshold) {
      this.state = CircuitState.Open;
    }
  }
}
