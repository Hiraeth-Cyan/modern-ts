// ========================================
// ./src/Result/Operators/reduce.ts
// ========================================
import type {Result} from '../types';
import {Ok, Err} from '../base';

/**
 * Reduces multiple Results into a single Result, collecting all success values or the first error (short-circuit).
 * @typeParam T - The type of the success value
 * @typeParam E - The type of the error
 * @typeParam R - The type of the reduced result
 * @param results - The array of Results to reduce
 * @param initial - The initial value
 * @param reducer - The reduction function
 * @returns A Result containing the reduced result
 */
export function reduce<T, E, R>(
  results: readonly Result<T, E>[],
  initial: R,
  reducer: (accumulator: R, value: T) => R,
): Result<R, E> {
  let accumulator = initial;

  for (const result of results) {
    if (!result.ok) {
      return Err(result.error);
    }
    accumulator = reducer(accumulator, result.value);
  }

  return Ok(accumulator);
}
