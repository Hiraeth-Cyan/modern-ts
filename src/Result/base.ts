// ========================================
// ./src/Result/base.ts
// ========================================
import type {Result, Success, Failure, AsyncResult, AnyResult} from './types';
import {UnknownError, ensureError} from '../unknown-error';
import {isPromiseLike, wrapError} from '../helper';

/**
 * Constructs a successful Result instance.
 * @typeParam T - The type of the successful value
 * @param value - The value upon success
 * @returns A successful Result
 */
export const Ok = <T, E = never>(value: T): Result<T, E> =>
  ({
    ok: true,
    value,
  }) as const;

/**
 * Get the value of Result<T, never>
 * @typeParam T - The type of the error
 * @param error - The error upon failure
 * @returns A failed Result
 */
export const Err = <T = never, E = unknown>(error: E): Result<T, E> =>
  ({
    ok: false,
    error,
  }) as const;

/**
 * Checks if the Result is in the Success (Ok) state.
 * @typeParam T - The type of the success value
 * @typeParam E - The type of the error value
 * @param result - The Result instance to check
 * @returns Returns true if the Result is Success
 */
export const isOk = <T, E>(result: Result<T, E>): result is Success<T> =>
  result.ok;

/**
 * Checks if the Result is in the Failure (Err) state.
 * @typeParam T - The type of the success value
 * @typeParam E - The type of the error value
 * @param result - The Result instance to check
 * @returns Returns true if the Result is Failure
 */
export const isErr = <T, E>(result: Result<T, E>): result is Failure<E> =>
  !result.ok;

/**
 * Checks if the Result is Success AND its value satisfies the given predicate.
 * @typeParam T - The type of the success valueexport function isPromiseLike<T>(value: unknown): value is PromiseLike<T> {
   return value !== null && typeof value === 'object' && 'then' in value;
 }
 * @typeParam E - The type of the error value
 * @param result - The Result instance to check
 * @param fn - The predicate function to check the success value
 * @returns Returns true if the Result is Success and the condition is met
 */
export const isOkAnd = <T, E>(
  result: Result<T, E>,
  fn: (value: T) => boolean,
): boolean => result.ok && fn(result.value);

/**
 * Checks if the Result is Failure AND its error satisfies the given predicate.
 * @typeParam T - The type of the success value
 * @typeParam E - The type of the error value
 * @param result - The Result instance to check
 * @param fn - The predicate function to check the error value
 * @returns Returns true if the Result is Failure and the condition is met
 */
export const isErrAnd = <T, E>(
  result: Result<T, E>,
  fn: (error: E) => boolean,
): boolean => !result.ok && fn(result.error);

// ============================================
// 异常安全执行器
// ============================================

/**
 * Safely executes a synchronous function, catching any thrown exception and wrapping it as an UnknownError.
 * @typeParam T - The success value type
 * @param fn - The synchronous function that might throw an exception
 * @param message - The error message to be used as the primary message for the UnknownError if an exception is thrown
 * @returns Returns Ok(T) on success, or Err(UnknownError) on failure
 */
export function safeExecute<T>(
  fn: () => T,
  message?: string,
): Result<T, UnknownError>;

/**
 * Safely executes a synchronous function, catching any thrown exception. If the exception is of the declared type E,
 * it returns Err(E); otherwise, it is wrapped as an UnknownError.
 * @typeParam T - The success value type
 * @typeParam E - The declared expected error type
 * @param fn - The synchronous function that might throw an exception
 * @param message - The error message to be used as the primary message for the UnknownError if an unknown exception is thrown
 * @param isExpectedError - A type guard function to determine if the caught error is of type E
 * @returns Returns Ok(T) on success, or Err(E | UnknownError) on failure
 */
export function safeExecute<T, E>(
  fn: () => T,
  message: string | undefined,
  isExpectedError: (error: unknown) => error is E,
): Result<T, E | UnknownError>;

export function safeExecute<T, E = never>(
  fn: () => T,
  message?: string,
  isExpectedError?: (error: unknown) => error is E,
): Result<T, E | UnknownError> {
  try {
    const value = fn();
    return Ok(value);
  } catch (raw_error) {
    if (isExpectedError && isExpectedError(raw_error)) return Err(raw_error);
    return Err(UnknownError.from(raw_error, message));
  }
}

/**
 * Safely executes an asynchronous function, catching its rejection or thrown exception and wrapping it as an UnknownError.
 * @typeParam T - The success value type
 * @param async_fn - The asynchronous function that might throw or reject
 * @param message - The error message to be used as the primary message for the UnknownError
 * @returns Returns Promise<Ok(T)> on success, or Promise<Err(UnknownError)> on failure
 */
export async function safeExecuteAsync<T>(
  async_fn: () => Promise<T>,
  message?: string,
): AsyncResult<T, UnknownError>;

/**
 * Safely executes an asynchronous function, catching its rejection or thrown exception. If the exception is of the declared type E,
 * it returns Err(E); otherwise, it is wrapped as an UnknownError.
 * @typeParam T - The success value type
 * @typeParam E - The declared expected error type
 * @param async_fn - The asynchronous function that might throw or reject
 * @param message - The error message to be used as the primary message for the UnknownError if an unknown exception is thrown
 * @param isExpectedError - A type guard function to determine if the caught error is of type E
 * @returns Returns Promise<Ok(T)> on success, or Promise<Err(E | UnknownError)> on failure
 */
export async function safeExecuteAsync<T, E>(
  async_fn: () => Promise<T>,
  message: string | undefined,
  isExpectedError: (error: unknown) => error is E,
): AsyncResult<T, E | UnknownError>;
export async function safeExecuteAsync<T, E = never>(
  async_fn: () => Promise<T>,
  message?: string,
  isExpectedError?: (error: unknown) => error is E,
): AsyncResult<T, E | UnknownError> {
  try {
    const value = await async_fn();
    return Ok(value);
  } catch (raw_error) {
    if (isExpectedError && isExpectedError(raw_error)) return Err(raw_error);
    return Err(UnknownError.from(raw_error, message));
  }
}

// ========================================
// 互相转换
// ========================================

/**
 * Converts a Result into a Promise. Success resolves, Failure rejects.
 * @typeParam T - The type of the success value
 * @typeParam E - The type of the error value
 * @param result - The Result to convert
 * @returns The resulting Promise
 * @throws If the Result is Failure, it rejects with the error wrapped by `ensureError`
 */
export const toPromise = <T, E>(result: Result<T, E>): Promise<T> =>
  result.ok
    ? Promise.resolve(result.value)
    : Promise.reject(ensureError(result.error));

/**
 * Converts a Promise into an AsyncResult. Resolution becomes Ok, and rejection becomes Err(UnknownError).
 * @typeParam T - The type of the success value
 * @param promise - The Promise to convert
 * @returns The resulting AsyncResult
 */
export const fromPromise = <T>(
  promise: Promise<T>,
): AsyncResult<T, UnknownError> =>
  promise.then(Ok).catch((e) => Err(UnknownError.from(e)));

/**
 * Safely normalizes an AnyResult (synchronous Result or asynchronous AsyncResult/Thenable) into a Promise<Result>.
 * It handles the Promise resolve/reject paths, ensuring rejection is always encapsulated as Err(UnknownError).
 * @typeParam T - The type of the success value
 * @typeParam E - The type of the error value
 * @param awaitable - The value to normalize, which can be a Result, Promise<Result>, or a Thenable object
 * @returns The normalized Promise<Result>
 */
export const normalizeToResult = async <T, E>(
  awaitable: AnyResult<T, E>,
): Promise<Result<T, E | UnknownError | DOMException>> => {
  // 同步 Result 快速路径
  if (!isPromiseLike(awaitable)) return awaitable;

  // 统一处理所有异步情况 (Promise & Thenable)
  try {
    return await awaitable;
  } catch (raw_error) {
    return Err(wrapError(raw_error));
  }
};
