// ========================================
// ./src/Result/Operators/Async/partition-async.ts
// ========================================

import type {AnyResult} from '../../types';
import {UnknownError, ensureDOMException} from '../../../unknown-error';
import {normalizeToResult} from '../../base';

/**
 * Asynchronously collects all success values from an array of AsyncResults.
 * @typeParam T - The type of the success value
 * @typeParam E - The type of the error
 * @param results - The array of AsyncResults
 * @param signal - Optional AbortSignal for cancellation
 * @returns A Promise of the array of collected success values
 */
export async function collectOkAsync<T, E>(
  results: readonly AnyResult<T, E>[],
  signal?: AbortSignal,
): Promise<T[]> {
  if (signal?.aborted) return Promise.reject(ensureDOMException(signal.reason));

  const normalized_promises = results.map((r) => normalizeToResult(r));
  const settled_results = await Promise.all(normalized_promises);

  const oks: T[] = [];
  for (const result of settled_results) {
    if (signal?.aborted)
      return Promise.reject(ensureDOMException(signal.reason));

    if (result.ok) {
      oks.push(result.value);
    }
  }

  return oks;
}

/**
 * Asynchronously collects all failure errors from an array of AsyncResults.
 * @typeParam T - The type of the success value
 * @typeParam E - The type of the error
 * @param results - The array of AsyncResults
 * @param signal - Optional AbortSignal for cancellation
 * @returns A Promise of the array of collected error values
 */
export async function collectErrAsync<T, E>(
  results: readonly AnyResult<T, E>[],
  signal?: AbortSignal,
): Promise<E[]> {
  if (signal?.aborted) return Promise.reject(ensureDOMException(signal.reason));

  const normalized_promises = results.map((r) => normalizeToResult(r));
  const settled_results = await Promise.all(normalized_promises);

  const errs: E[] = [];
  for (const result of settled_results) {
    if (signal?.aborted) throw signal.reason;

    if (!result.ok) {
      errs.push(result.error as E);
    }
  }

  return errs;
}

/**
 * Asynchronously executes the Result array concurrently and partitions it into a tuple of success values and error values (non-short-circuiting).
 * @typeParam T - The type of the success value
 * @typeParam E - The type of the error
 * @param results - The array of AsyncResults
 * @param signal - Optional AbortSignal for cancellation
 * @returns A Promise of a tuple containing the success value array and the error value array
 */
export async function partitionAsync<T, E>(
  results: readonly AnyResult<T, E>[],
  signal?: AbortSignal,
): Promise<[T[], Array<E | DOMException | UnknownError>]> {
  if (signal?.aborted) return Promise.reject(ensureDOMException(signal.reason));

  const normalized_promises = results.map((r) => normalizeToResult(r));
  const settled_results = await Promise.all(normalized_promises);

  const oks: T[] = [];
  const errs: Array<E | DOMException | UnknownError> = [];

  for (const result of settled_results) {
    if (signal?.aborted) throw signal.reason;

    if (result.ok) {
      oks.push(result.value);
    } else {
      errs.push(result.error);
    }
  }

  return [oks, errs];
}
