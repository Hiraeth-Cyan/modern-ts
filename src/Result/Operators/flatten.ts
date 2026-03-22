// ========================================
// ./src/Result/Operators/flatten.ts
// ========================================
import type {Result} from '../types';
import {isOk} from '../base';
import {isPromiseLike, isResultLike} from '../../helper';

/**
 * Unwraps a nested Result into a single layer (Result<T, E>).
 * @typeParam T - The type of the success value
 * @typeParam E - The type of the error
 * @param result - The nested Result to flatten
 * @returns The flattened Result
 */
export function flatten<T, E>(
  result: Result<T | Result<T, E>, E>,
): Result<T, E> {
  if (isOk(result)) {
    const inner_value = result.value;
    if (isResultLike(inner_value)) {
      return inner_value as Result<T, E>;
    }
    return result as Result<T, E>;
  }
  return result as Result<T, E>;
}

/**
 * Recursively unwraps a deeply nested Result into a single layer (Result<T, E>).
 * @typeParam T - The type of the success value
 * @typeParam E - The type of the error
 * @param result - The deeply nested Result to flatten
 * @returns The flattened Result
 */
export function deepFlatten<T, E>(
  result: Result<T | Result<unknown, E>, E>,
): Result<T, E> {
  let current_result = result as Result<unknown, E>;

  while (isOk(current_result)) {
    const value_to_check = current_result.value;

    if (!isResultLike(value_to_check)) {
      return current_result as Result<T, E>;
    }
    current_result = value_to_check as Result<unknown, E>;
  }
  return current_result;
}

/**
 * Asynchronously and recursively unwraps a deeply nested Result (including nested Promises within the Result value) into a single layer.
 * @typeParam T - The type of the success value
 * @typeParam E - The type of the error
 * @param result_promise - The deeply nested Result or `Promise<Result<T, E>>` to flatten
 * @param signal - Optional AbortSignal for cancellation
 * @returns The Promise resolving to the flattened Result
 */
export async function deepFlattenAsync<T, E>(
  result_promise:
    | PromiseLike<Result<T | Result<unknown, E>, E>>
    | Result<T | Result<unknown, E>, E>,
): Promise<Result<T, E>> {
  let current_result = await result_promise;

  while (isOk(current_result)) {
    let value_to_check = current_result.value;

    if (isPromiseLike(value_to_check)) {
      value_to_check = await value_to_check;
    }

    if (!isResultLike(value_to_check)) {
      return current_result as Result<T, E>;
    }
    current_result = value_to_check as Result<T, E>;
  }
  return current_result;
}
