// ========================================
// ./src/Result/Operators/transform.ts
// ========================================
import {match} from '../Consumers/branch';
import type {Result} from '../types';
import {Ok, Err} from '../base';

/**
 * Maps the success value using `fn` if the Result is Ok.
 * @typeParam T - Original success value type
 * @typeParam E - Original error type
 * @typeParam U - Transformed success value type
 * @param result - The Result to transform
 * @param fn - Function to transform the success value
 * @returns A new Result with the transformed value or the original error
 */
export const map = <T, E, U>(result: Result<T, E>, fn: (v: T) => U) =>
  match(
    result,
    (v) => Ok(fn(v)),
    (e) => Err(e),
  );

/**
 * Maps the error value using `fn` if the Result is Err.
 * @typeParam T - Success value type
 * @typeParam E - Original error type
 * @typeParam F - Transformed error type
 * @param result - The Result to transform
 * @param fn - Function to transform the error value
 * @returns A new Result with the original value or the transformed error
 */
export const mapErr = <T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F,
): Result<T, F> =>
  match(
    result,
    (v) => Ok(v),
    (e) => Err(fn(e)),
  );

/**
 * Maps both success and error values, converting Result<T, E> to Result<U, F>.
 * @typeParam T - Original success value type
 * @typeParam E - Original error type
 * @typeParam U - New success value type
 * @typeParam F - New error type
 * @param result - The Result to transform
 * @param mapOk - Function to transform the success value
 * @param mapErr - Function to transform the error value
 * @returns A new Result with both value and error types transformed
 */
export const mapBoth = <T, E, U, F>(
  result: Result<T, E>,
  mapOk: (value: T) => U,
  mapErr: (error: E) => F,
): Result<U, F> =>
  match(
    result,
    (v) => Ok(mapOk(v)),
    (e) => Err(mapErr(e)),
  );

/**
 * Chains a computation that returns a new Result.
 * Returns the new Result if the original is Ok, otherwise propagates the error.
 * @typeParam T - Original success value type
 * @typeParam E - Original error type
 * @typeParam U - Success value type returned by `fn`
 * @typeParam F - Error type returned by `fn`
 * @param result - The preceding Result
 * @param fn - Function that returns a new Result based on the success value
 * @returns The chained Result or the original error
 */
export const andThen = <T, E, U, F>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, F>,
): Result<U, E | F> => {
  return result.ok ? fn(result.value) : result;
};

/**
 * Attempts recovery by applying `fn` to the error value if the Result is Err.
 * Returns the original Result if it is Ok.
 * @typeParam T - Original success value type
 * @typeParam E - Original error type
 * @typeParam U - Success value type of the recovery operation
 * @typeParam F - Error type of the recovery operation
 * @param result - The Result to recover from
 * @param fn - Recovery function that returns a new Result based on the error
 * @returns Either the original success or the result of the recovery attempt
 */
export const recover = <T, E, U, F>(
  result: Result<T, E>,
  fn: (error: E) => Result<U, F>,
): Result<T | U, F> => {
  if (result.ok) {
    return result as Result<T | U, F>;
  }
  return fn(result.error) as Result<T | U, F>;
};

/**
 * Fallback operation: if the Result is Err, executes `fn` with the error and
 * returns its result; otherwise returns the original Ok value.
 * @typeParam T - Success value type
 * @typeParam E - Original error type
 * @typeParam F - Alternative error type from the fallback operation
 * @param result - The preceding Result
 * @param fn - Fallback function that returns an alternative Result
 * @returns Either the original success or the result of the fallback operation
 */
export const orElse = <T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => Result<T, F>,
): Result<T, F> => recover(result, fn);

// Overload 1: Type-guard predicate that narrows the success type
export function filter<T, E, F, S extends T>(
  result: Result<T, E>,
  predicate: (value: T) => value is S,
  getErrorOnFail: (value: T) => F,
): Result<S, E | F>;

// Overload 2: Boolean predicate that preserves the success type
export function filter<T, E, F>(
  result: Result<T, E>,
  predicate: (value: T) => boolean,
  getErrorOnFail: (value: T) => F,
): Result<T, E | F>;

/**
 * Filters the success value using a predicate.
 * If the Result is Ok and the predicate returns true, returns the original Result.
 * If the predicate returns false, returns an Err with the error produced by `getErrorOnFail`.
 * If the original Result is Err, returns it unchanged.
 */
export function filter<T, E, F, S extends T = T>(
  result: Result<T, E>,
  predicate: ((value: T) => boolean) | ((value: T) => value is S),
  getErrorOnFail: (value: T) => F,
): Result<T, E | F> | Result<S, E | F> {
  return andThen(result, (v) => {
    if (predicate(v)) {
      return Ok(v);
    }
    return Err(getErrorOnFail(v));
  });
}
