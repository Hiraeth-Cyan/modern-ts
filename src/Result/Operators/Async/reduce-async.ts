// ========================================
// ./src/Result/Operators/Async/reduce-async.ts
// ========================================

import type {AnyResult, AsyncResult} from '../../types';
import {UnknownError, ensureDOMException} from '../../../unknown-error';
import {Ok, Err, normalizeToResult} from '../../base';
import {wrapError} from 'src/helper';
import type {MaybePromise} from '../../../Utils/type-tool';

/**
 * Asynchronously and sequentially reduces multiple AsyncResults into a single Result (short-circuit).
 * @typeParam T - The type of the success value
 * @typeParam E - The type of the error
 * @typeParam R - The type of the reduced result
 * @param resultPromises - The array of AsyncResults to reduce
 * @param initial - The initial value
 * @param reducer - The reduction function (can be async)
 * @param signal - Optional AbortSignal for cancellation
 * @returns An AsyncResult containing the reduced result
 */
export async function reduceAsync<T, E, R>(
  resultPromises: readonly AnyResult<T, E>[],
  initial: R,
  reducer: (accumulator: R, value: T, signal?: AbortSignal) => MaybePromise<R>,
  signal?: AbortSignal,
): AsyncResult<R, E | UnknownError | DOMException> {
  if (signal?.aborted) return Err(ensureDOMException(signal.reason));

  let accumulator = initial;

  for (const resultPromise of resultPromises) {
    const result = await normalizeToResult(resultPromise);
    if (signal?.aborted) return Err(ensureDOMException(signal.reason));

    if (!result.ok) {
      return Err(result.error);
    }

    try {
      accumulator = await reducer(accumulator, result.value, signal);
      if (signal?.aborted) return Err(ensureDOMException(signal.reason));
    } catch (rawError) {
      return Err(wrapError(rawError));
    }
  }

  return Ok(accumulator);
}
