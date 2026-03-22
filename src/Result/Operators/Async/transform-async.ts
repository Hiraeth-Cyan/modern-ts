// ========================================
// ./src/Result/Operators/Async/transform-async.ts
// ========================================

import type {AnyResult, AsyncResult} from '../../types';
import {UnknownError, ensureDOMException} from '../../../unknown-error';
import {Ok, Err, normalizeToResult} from '../../base';
import {wrapError, dynamicAwait} from 'src/helper';
import type {MaybePromise} from '../../../Utils/type-tool';

/**
 * Asynchronously maps the success value. If the Result is Ok, applies fn to transform the value's type and catches exceptions thrown by fn.
 * @typeParam T - The type of the original success value
 * @typeParam E - The type of the original error
 * @typeParam U - The type of the new success value
 * @param result_promise - The AnyResult to map
 * @param fn - The async/sync mapping function
 * @param signal - Optional AbortSignal for cancellation
 * @returns The mapped AsyncResult
 */
export async function mapAsync<T, E, U>(
  result_promise: AnyResult<T, E>,
  fn: (value: T, signal?: AbortSignal) => MaybePromise<U>,
  signal?: AbortSignal,
): AsyncResult<U, E | UnknownError | DOMException> {
  if (signal?.aborted) return Err(ensureDOMException(signal.reason));

  const result = await normalizeToResult(result_promise);
  if (!result.ok) return Err(result.error);

  try {
    const value = await dynamicAwait(fn(result.value, signal));
    if (signal?.aborted) return Err(ensureDOMException(signal.reason));
    return Ok(value);
  } catch (e) {
    return Err(wrapError(e));
  }
}

/**
 * Asynchronously maps the error value. If the Result is Err, applies fn to transform the error's type and catches exceptions thrown by fn.
 * @typeParam T - The type of the success value
 * @typeParam E - The type of the original error
 * @typeParam F - The type of the new error
 * @param result_promise - The AnyResult to map
 * @param fn - The async/sync mapping function
 * @param signal - Optional AbortSignal for cancellation
 * @returns The mapped AsyncResult
 */
export async function mapErrAsync<T, E, F>(
  result_promise: AnyResult<T, E>,
  fn: (error: E, signal?: AbortSignal) => MaybePromise<F>,
  signal?: AbortSignal,
): AsyncResult<T, F | UnknownError | DOMException> {
  if (signal?.aborted) return Err(ensureDOMException(signal.reason));

  const result = await normalizeToResult(result_promise);

  if (result.ok) {
    return Ok(result.value);
  }

  try {
    const newError = await dynamicAwait(fn(result.error as E, signal));
    if (signal?.aborted) return Err(ensureDOMException(signal.reason));
    return Err(newError);
  } catch (e) {
    return Err(wrapError(e));
  }
}

/**
 * Asynchronously maps both success and error values simultaneously.
 * @typeParam T - The type of the original success value
 * @typeParam E - The type of the original error
 * @typeParam U - The type of the new success value
 * @typeParam F - The type of the new error
 * @param result_promise - The AnyResult to map
 * @param mapOk - The async/sync success mapping function
 * @param mapErr - The async/sync failure mapping function
 * @param signal - Optional AbortSignal for cancellation
 * @returns The mapped AsyncResult
 */
export async function mapBothAsync<T, E, U, F>(
  result_promise: AnyResult<T, E>,
  mapOk: (value: T, signal?: AbortSignal) => MaybePromise<U>,
  mapErr: (error: E, signal?: AbortSignal) => MaybePromise<F>,
  signal?: AbortSignal,
): AsyncResult<U, F | UnknownError | DOMException> {
  if (signal?.aborted) return Err(ensureDOMException(signal.reason));

  const result = await normalizeToResult(result_promise);

  if (result.ok) {
    try {
      const newValue = await dynamicAwait(mapOk(result.value, signal));
      if (signal?.aborted) return Err(ensureDOMException(signal.reason));
      return Ok(newValue);
    } catch (e) {
      return Err(wrapError(e));
    }
  }

  try {
    const newError = await dynamicAwait(mapErr(result.error as E, signal));
    if (signal?.aborted) return Err(ensureDOMException(signal.reason));
    return Err(newError);
  } catch (e) {
    return Err(wrapError(e));
  }
}

/**
 * Asynchronously chains operations. If the Result is Ok, executes fn and returns its AnyResult result.
 * @typeParam T - The type of the original success value
 * @typeParam E - The type of the error
 * @typeParam U - The success value type returned by fn
 * @param result_promise - The preceding AnyResult
 * @param fn - The async/sync chaining function
 * @param signal - Optional AbortSignal for cancellation
 * @returns The result of the chained operation
 */
export async function andThenAsync<T, E, U>(
  result_promise: AnyResult<T, E>,
  fn: (value: T, signal?: AbortSignal) => AnyResult<U, E>,
  signal?: AbortSignal,
): AsyncResult<U, E | UnknownError | DOMException> {
  if (signal?.aborted) return Err(ensureDOMException(signal.reason));

  const result = await normalizeToResult(result_promise);

  if (!result.ok) {
    return Err(result.error);
  }

  try {
    const next_awaitable = fn(result.value, signal);
    const res = await normalizeToResult(next_awaitable);
    if (signal?.aborted) return Err(ensureDOMException(signal.reason));
    return res;
  } catch (raw_error) {
    return Err(wrapError(raw_error));
  }
}

/**
 * Asynchronous error recovery. If the Result is Err, executes fn to attempt recovery.
 * @typeParam T - The type of the original success value
 * @typeParam E - The type of the original error
 * @typeParam U - The success value type of the recovery operation
 * @typeParam F - The error type of the recovery operation
 * @param result_promise - The AnyResult to recover
 * @param fn - The async/sync error recovery function
 * @param signal - Optional AbortSignal for cancellation
 * @returns The recovered AsyncResult
 */
export async function recoverAsync<T, E, U, F>(
  result_promise: AnyResult<T, E>,
  fn: (error: E, signal?: AbortSignal) => AnyResult<U, F>,
  signal?: AbortSignal,
): AsyncResult<T | U, F | UnknownError | DOMException> {
  if (signal?.aborted) return Err(ensureDOMException(signal.reason));

  const result = await normalizeToResult(result_promise);

  if (result.ok) {
    return Ok(result.value);
  }

  try {
    const res = await normalizeToResult(fn(result.error as E, signal));
    if (signal?.aborted) return Err(ensureDOMException(signal.reason));
    return res;
  } catch (e) {
    return Err(wrapError(e));
  }
}

/**
 * Asynchronous error handling chain. If the Result is Err, executes fn to attempt an alternative operation.
 * @typeParam T - The type of the success value
 * @typeParam E - The type of the original error
 * @typeParam F - The type of the alternative error
 * @param result_promise - The preceding AnyResult
 * @param fn - The async/sync alternative operation function
 * @param signal - Optional AbortSignal for cancellation
 * @returns The result of the error handling chain
 */
export async function orElseAsync<T, E, F>(
  result_promise: AnyResult<T, E>,
  fn: (error: E, signal?: AbortSignal) => AnyResult<T, F>,
  signal?: AbortSignal,
): AsyncResult<T, F | UnknownError | DOMException> {
  if (signal?.aborted) return Err(ensureDOMException(signal.reason));

  const result = await normalizeToResult(result_promise);

  if (result.ok) {
    return Ok(result.value);
  }

  try {
    const res = await normalizeToResult(fn(result.error as E, signal));
    if (signal?.aborted) return Err(ensureDOMException(signal.reason));
    return res;
  } catch (e) {
    return Err(wrapError(e));
  }
}

/**
 * Asynchronously filters the Result value.
 *
 * 1. If the input Result is Err, returns the original error E directly.
 * 2. If Ok, applies the asynchronous predicate for filtering.
 * 3. If the predicate condition is not met, transforms to a new error F.
 * 4. If the predicate itself throws an exception, transforms to UnknownError.
 *
 * @typeParam T - The type of the success value
 * @typeParam E - The type of the original error
 * @typeParam F - The type of the new error upon filter failure
 * @param result_promise - The AnyResult to filter
 * @param predicate - The async/sync filter condition
 * @param get_error_on_fail - Function to generate error F when the condition is not met
 * @param signal - Optional AbortSignal for cancellation
 * @returns The filtered AsyncResult
 */
export async function filterAsync<T, E, F>(
  result_promise: AnyResult<T, E>,
  predicate: (value: T, signal?: AbortSignal) => MaybePromise<boolean>,
  get_error_on_fail: (value: T, signal?: AbortSignal) => MaybePromise<F>,
  signal?: AbortSignal,
): AsyncResult<T, E | F | UnknownError | DOMException> {
  if (signal?.aborted) return Err(ensureDOMException(signal.reason));

  const result = await normalizeToResult(result_promise);

  if (!result.ok) {
    return result;
  }

  const value = result.value;

  try {
    const passes_filter = await dynamicAwait(predicate(value, signal));

    if (passes_filter) {
      if (signal?.aborted) return Err(ensureDOMException(signal.reason));
      return Ok(value);
    } else {
      const error = await dynamicAwait(get_error_on_fail(value, signal));
      if (signal?.aborted) return Err(ensureDOMException(signal.reason));
      return Err(error);
    }
  } catch (e) {
    return Err(wrapError(e));
  }
}
