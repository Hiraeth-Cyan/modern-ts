// ========================================
// ./src/Result/Operators/Async/combine-async.ts
// ========================================

import type {AnyResult, AsyncResult} from '../../types';
import {UnknownError, ensureDOMException} from '../../../unknown-error';
import {Ok, Err, normalizeToResult} from '../../base';
import {all, zip} from '../combine';
import {wrapError} from 'src/helper';

/**
 * Asynchronous Applicative Apply.
 * Applies the function inside result_fab to the value inside result_a, executing concurrently.
 * Short-circuits on the first error encountered in either input.
 *
 * @typeParam T - The type of the input value A
 * @typeParam E - The type of the error
 * @typeParam U - The type of the output value B
 * @typeParam F - The error type of the function Result
 * @param result_fab - The AnyResult containing the mapping function (A) => B
 * @param result_a - The AnyResult containing the value A
 * @param signal - Optional AbortSignal for cancellation
 * @returns An AsyncResult containing the output value B or the first error
 */
export async function apAsync<T, E, U, F>(
  result_fab: AnyResult<(value: T, signal?: AbortSignal) => U, F>,
  result_a: AnyResult<T, E>,
  signal?: AbortSignal,
): AsyncResult<U, E | F | UnknownError | DOMException> {
  if (signal?.aborted) return Err(ensureDOMException(signal.reason));

  const [res_fab, res_a] = await Promise.all([
    normalizeToResult(result_fab),
    normalizeToResult(result_a),
  ]);
  if (!res_fab.ok) {
    return Err(res_fab.error);
  }
  if (!res_a.ok) {
    return Err(res_a.error);
  }
  const f_ab = res_fab.value;
  const result_t = res_a.value;

  try {
    const res = Ok(await f_ab(result_t, signal));
    if (signal?.aborted) return Err(ensureDOMException(signal.reason));
    return res;
  } catch (e) {
    return Err(wrapError(e));
  }
}

/**
 * Asynchronously combines two Results into a tuple (executed concurrently).
 * @typeParam T - The success value type of the first Result
 * @typeParam E - The error type of the first Result
 * @typeParam U - The success value type of the second Result
 * @typeParam F - The error type of the second Result
 * @param result_a - The first AnyResult
 * @param result_b - The second AnyResult
 * @param signal - Optional AbortSignal for cancellation
 * @returns An AsyncResult containing the tuple or the first error
 */
export async function zipAsync<T, E, U, F>(
  result_a: AnyResult<T, E>,
  result_b: AnyResult<U, F>,
  signal?: AbortSignal,
): AsyncResult<[T, U], E | F | UnknownError | DOMException> {
  if (signal?.aborted) return Err(ensureDOMException(signal.reason));

  const [res_a, res_b] = await Promise.all([
    normalizeToResult(result_a),
    normalizeToResult(result_b),
  ]);
  return zip(res_a, res_b);
}

/**
 * Executes multiple AsyncResults concurrently. Returns an array if all succeed, or short-circuits by returning the first error.
 * @typeParam T - The type of the success value
 * @typeParam E - The type of the error
 * @param results - The array of AnyResults
 * @param signal - Optional AbortSignal for cancellation
 * @returns An AsyncResult containing the array of values or the first error
 */
export async function allAsync<T, E>(
  results: readonly AnyResult<T, E>[],
  signal?: AbortSignal,
): AsyncResult<T[], E | UnknownError | DOMException> {
  if (signal?.aborted) return Err(ensureDOMException(signal.reason));

  if (results.length === 0) return Ok([]);
  const normalizedPromises = results.map((r) => normalizeToResult(r));

  const settledResults = await Promise.all(normalizedPromises);
  return all(settledResults);
}

/**
 * Executes multiple AsyncResults sequentially. Returns an array if all succeed, or short-circuits by returning the first error.
 * @typeParam T - The type of the success value
 * @typeParam E - The type of the error
 * @param results - The array of AnyResults
 * @param signal - Optional AbortSignal for cancellation
 * @returns An AsyncResult containing the array of values or the first error
 */
export async function sequenceAsync<T, E>(
  results: readonly AnyResult<T, E>[],
  signal?: AbortSignal,
): AsyncResult<T[], E | UnknownError | DOMException> {
  if (signal?.aborted) return Err(ensureDOMException(signal.reason));

  const values: T[] = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const normalized = await normalizeToResult(result);
    if (signal?.aborted) return Err(ensureDOMException(signal.reason));

    if (!normalized.ok) {
      return Err(normalized.error);
    }
    values.push(normalized.value);
  }

  return Ok(values);
}

/**
 * Asynchronous logical AND operation. If result is Ok, awaits and returns other; if result is Err, returns result's error.
 * @typeParam T - The success value type of the first Result
 * @typeParam E - The type of the error
 * @typeParam U - The success value type of the second Result
 * @param result_promise - The first AnyResult
 * @param other_promise - The second AnyResult
 * @param signal - Optional AbortSignal for cancellation
 * @returns The result of the logical AND
 */
export async function andAsync<T, E, U>(
  result_promise: AnyResult<T, E>,
  other_promise: AnyResult<U, E>,
  signal?: AbortSignal,
): AsyncResult<U, E | UnknownError | DOMException> {
  if (signal?.aborted) return Err(ensureDOMException(signal.reason));

  const result = await normalizeToResult(result_promise);

  if (!result.ok) {
    return Err(result.error);
  }

  return normalizeToResult(other_promise);
}

/**
 * Asynchronous logical OR operation. If result is Ok, returns result; if result is Err, awaits and returns other.
 * @typeParam T - The type of the success value
 * @typeParam E - The type of the original error
 * @typeParam F - The type of the alternative error
 * @param result_promise - The first AnyResult
 * @param other_promise - The second AnyResult
 * @param signal - Optional AbortSignal for cancellation
 * @returns The result of the logical OR
 */
export async function orAsync<T, E, F>(
  result_promise: AnyResult<T, E>,
  other_promise: AnyResult<T, F>,
  signal?: AbortSignal,
): AsyncResult<T, F | UnknownError | DOMException> {
  if (signal?.aborted) return Err(ensureDOMException(signal.reason));

  const result = await normalizeToResult(result_promise);

  if (result.ok) {
    return Ok(result.value);
  }

  return normalizeToResult(other_promise);
}
