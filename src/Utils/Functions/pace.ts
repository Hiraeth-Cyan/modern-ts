// ========================================
// ./src/Utils/Functions/pace.ts
// ========================================
import {delay} from 'src/Concurrent/delay';
import {Err, Ok} from 'src/Result/base';
import type {Result} from 'src/Result/types';
import type {MaybePromise} from '../type-tool';

// 定义下一次动作的类型：停止并返回值，或者继续等待
type NextAction<R> = {readonly value: R} | {readonly delay: number};

/**
 * @template R1 - The input result type from the executed function
 * @template R2 - The output result type after pacing logic
 */
type PaceFunction<R1, R2> = (
  output: Result<R1, unknown>,
  iteration: number,
  interval: number,
) => MaybePromise<NextAction<R2>>;

/**
 * Signals the pacer to stop and return a value.
 * @template T - The type of value to return
 */
export const Stop = <T>(value: T) => ({value});

/**
 * Signals the pacer to continue waiting with the specified delay.
 */
export const Continue = (delay: number) => ({delay});

/**
 * Calculates exponential backoff delay.
 * @param attempt - Current attempt number (0-indexed)
 * @param base - Base delay in milliseconds (default: 1000)
 * @param max - Maximum delay cap in milliseconds (default: 30000)
 */
export const expBackoff = (attempt: number, base = 1000, max = 30000): number =>
  Math.min(base * 2 ** attempt, max);

/**
 * Exponential backoff with jitter strategies to prevent thundering herd.
 * @param attempt - Current attempt number (0-indexed)
 * @param base - Base delay in milliseconds (default: 1000)
 * @param max - Maximum delay cap in milliseconds (default: 30000)
 * @param jitter - Jitter strategy: 'full' | 'equal' | 'decorrelated' (default: 'full')
 */
export const expJitter = (
  attempt: number,
  base = 1000,
  max = 30000,
  jitter: 'full' | 'equal' | 'decorrelated' = 'full',
): number => {
  const delay = expBackoff(attempt, base, max);
  const rand = Math.random();
  switch (jitter) {
    case 'full':
      return rand * delay;
    case 'equal':
      return delay / 2 + rand * (delay / 2);
    case 'decorrelated':
      return Math.min(base + rand * delay, max);
  }
};

/**
 * Executes a function repeatedly with custom pacing logic.
 *
 * The pace function controls when to stop and what to return based on
 * each iteration's result. Useful for implementing retry logic, polling,
 * or any iterative async operation with custom backoff strategies.
 *
 * @template R1 - The return type of the executed function
 * @template R2 - The final output type after pacing logic completes
 * @param fn - The function to execute on each iteration
 * @param pace - Controls iteration flow; return `Stop(value)` to complete or `Continue(ms)` to retry
 * @param signal - Optional AbortSignal for cancellation
 * @returns The value passed to `Stop()` when pacing completes
 */
export async function pacer<R1, R2>(
  fn: () => MaybePromise<R1>,
  pace: PaceFunction<R1, R2>,
  signal?: AbortSignal,
): Promise<R2> {
  signal?.throwIfAborted();
  let interval = 0;

  for (let iteration = 0; ; iteration++) {
    let output: Result<R1, unknown>;
    try {
      output = Ok(await fn());
      signal?.throwIfAborted();
    } catch (error) {
      output = Err(error);
    }

    const action = await pace(output, iteration, interval);
    signal?.throwIfAborted();

    // 决定停止，返回最终值
    if ('value' in action) return action.value;
    else {
      const ms = action.delay;
      // 只有延迟时间大于 0 才真正等待
      if (ms > 0) await delay(ms, signal);
      interval = ms;
    }
  }
}

/**
 * Options for retry operations with exponential backoff.
 */
interface PaceRetryOptions {
  /** Maximum number of retry attempts (default: 5) */
  readonly maxRetries?: number;
  /** Base delay in milliseconds for exponential backoff (default: 1000) */
  readonly baseDelayMs?: number;
  /** Maximum delay cap in milliseconds (default: 30000) */
  readonly maxBackoffMs?: number;

  /** Optional AbortSignal for cancellation */
  signal?: AbortSignal;
}

/**
 * Retries an async task with exponential backoff and jitter.
 *
 * @template T - The return type of the task
 * @param task - The async function to retry
 * @param options - Retry configuration options
 * @returns The result of the successful task execution
 * @throws Last error if all retry attempts fail
 */
export async function retry<T>(
  task: () => MaybePromise<T>,
  options?: PaceRetryOptions,
): Promise<T> {
  const {
    maxRetries = 5,
    baseDelayMs = 1000,
    maxBackoffMs = 30000,
    signal,
  } = options ?? {};
  signal?.throwIfAborted();

  let last_error: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await task();
      signal?.throwIfAborted();
      return result;
    } catch (error) {
      last_error = error;
      if (attempt < maxRetries) {
        const wait_ms = expJitter(attempt, baseDelayMs, maxBackoffMs, 'equal');
        await delay(wait_ms, signal);
      }
    }
  }

  throw last_error;
}
