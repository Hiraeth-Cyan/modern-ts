// ========================================
// ./src/Result/Operators/combine.ts
// ========================================
import type {Result} from '../types';
import {Ok, Err} from '../base';

/**
 * Applicative Apply. If both Results are Ok, applies the function inside result_fab
 * to the value inside result_a. Short-circuits on the first error.
 * @typeParam T - The type of the input value A
 * @typeParam E - The type of the error
 * @typeParam U - The type of the output value B
 * @param result_fab - The Result containing the mapping function (A) => B
 * @param result_a - The Result containing the value A
 * @returns The Result containing the output value B or the first error
 */
export function ap<T, E, U>(
  result_fab: Result<(value: T) => U, E>,
  result_a: Result<T, E>,
): Result<U, E> {
  if (!result_fab.ok) {
    return result_fab as Result<U, E>;
  }
  if (!result_a.ok) {
    return result_a as Result<U, E>;
  }
  const f_ab = result_fab.value;
  const result_t = result_a.value;
  return Ok(f_ab(result_t));
}

/**
 * Combines two Results into a tuple. Short-circuits by returning the first error if either fails.
 * @typeParam T - The success value type of the first Result
 * @typeParam E - The error type of the first Result
 * @typeParam U - The success value type of the second Result
 * @typeParam F - The error type of the second Result
 * @param result_a - The first Result
 * @param result_b - The second Result
 * @returns A Result containing the tuple or the first error
 */
export function zip<T, E, U, F>(
  result_a: Result<T, E>,
  result_b: Result<U, F>,
): Result<[T, U], E | F> {
  if (!result_a.ok) {
    return result_a as Result<never, E>;
  }
  if (!result_b.ok) {
    return result_b as Result<never, F>;
  }
  return Ok([result_a.value, result_b.value]);
}

/**
 * Combines multiple Results. Returns an array if all succeed, or short-circuits by returning the first error.
 * @typeParam T - The type of the success value
 * @typeParam E - The type of the error
 * @param results - The array of Results
 * @returns A Result containing the array of values or the first error
 */
export function all<T, E>(results: readonly Result<T, E>[]): Result<T[], E> {
  const values: T[] = [];

  for (const result of results) {
    if (!result.ok) {
      return Err(result.error);
    }
    values.push(result.value);
  }

  return Ok(values);
}

/**
 * Processes an array in batch. Transforms each element using the provided function, collects all success results, and short-circuits on the first failure.
 * @typeParam T - The type of the input array elements
 * @typeParam U - The success value type of the transformed Result
 * @typeParam E - The error type of the transformed Result
 * @param items - The input array
 * @param fn - The transformation function
 * @returns A Result containing the array of transformed values or the first error
 */
export function mapAll<T, U, E>(
  items: readonly T[],
  fn: (item: T, index: number) => Result<U, E>,
): Result<U[], E> {
  const results: U[] = [];

  for (let i = 0; i < items.length; i++) {
    const result = fn(items[i], i);
    if (!result.ok) {
      return Err(result.error);
    }
    results.push(result.value);
  }

  return Ok(results);
}

/**
 * Logical AND operation for two Results.
 * If the first result is successful, returns the second result.
 * If the first result is a failure, returns the first result (casted to the target type).
 * @template T - Success type of the first result
 * @template E - Error type of both results
 * @template U - Success type of the second result (and the overall result)
 */
export const and = <T, E, U>(
  result: Result<T, E>,
  other: Result<U, E>,
): Result<U, E> => (result.ok ? other : result);

/**
 * Logical OR operation for two Results.
 * If the first result is successful, returns the first result (widened to include U).
 * If the first result is a failure, returns the second result.
 * * @template T - Success type of the first result
 * @template E - Error type of the first result
 * @template U - Success type of the second result
 * @template F - Error type of the second result
 */
export const or = <T, E, U, F>(
  result: Result<T, E>,
  other: Result<U, F>,
): Result<T | U, F> => (result.ok ? result : other);
