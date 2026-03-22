// ========================================
// ./src/Result/Consumers/branch.ts
// ========================================
import type {Result} from '../types';

/**
 * Executes one of two callbacks based on whether the Result is Ok or Err,
 * and returns the result of the executed callback.
 * @typeParam T - The type of the success value in the Ok variant.
 * @typeParam E - The type of the error in the Err variant.
 * @typeParam R1 - The return type of the onOk callback.
 * @typeParam R2 - The return type of the onErr callback.
 * @param result - The Result object to match against.
 * @param onOk - Callback executed if the Result is Ok. Receives the inner value (T).
 * @param onErr - Callback executed if the Result is Err. Receives the inner error (E).
 * @returns The result of either onOk or onErr, with type R1 | R2.
 */
export const match = <T, E, R1, R2>(
  result: Result<T, E>,
  onOk: (value: T) => R1,
  onErr: (error: E) => R2,
): R1 | R2 => (result.ok ? onOk(result.value) : onErr(result.error));

/**
 * Executes onOk if the Result is **Ok** (Success).
 * @typeParam T - The type of the **Success Value** contained in the **Ok state**.
 * @typeParam E - The type of the **Error** contained in the **Err state**.
 * @typeParam R1 - The return type of the **onOk** callback.
 * @param result - The Result object to check.
 * @param onOk - The function executed when the Result is **Ok**, receiving the internal value (T).
 * @returns The return value of onOk (R1) or **void** if the Result is Err.
 */
export function ifOk<T, E, R1>(
  result: Result<T, E>,
  onOk: (value: T) => R1,
): R1 | void;

/**
 * Executes onOk if the Result is **Ok**; executes onElse if **Err**.
 * @typeParam T - The type of the **Success Value** contained in the **Ok state**.
 * @typeParam E - The type of the **Error** contained in the **Err state**.
 * @typeParam R1 - The return type of the **onOk** callback.
 * @typeParam R2 - The return type of the **onElse** callback.
 * @param result - The Result object to check.
 * @param onOk - The function executed when the Result is **Ok**, receiving the internal value (T).
 * @param onElse - The function executed when the Result is **Err**, receiving the internal error (E).
 * @returns The return value of onOk (R1) or onElse (R2).
 */
export function ifOk<T, E, R1, R2>(
  result: Result<T, E>,
  onOk: (value: T) => R1,
  onElse: (error: E) => R2,
): R1 | R2;
export function ifOk<T, E, R1, R2>(
  result: Result<T, E>,
  onOk: (value: T) => R1,
  onElse?: (error: E) => R2,
): R1 | R2 | void {
  return result.ok ? onOk(result.value) : onElse?.(result.error);
}

/**
 * Executes onErr if the Result is **Err** (Failure).
 * @typeParam T - The type of the **Success Value** contained in the **Ok state**.
 * @typeParam E - The type of the **Error** contained in the **Err state**.
 * @typeParam R1 - The return type of the **onErr** callback.
 * @param result - The Result object to check.
 * @param onErr - The function executed when the Result is **Err**, receiving the internal error (E).
 * @returns The return value of onErr (R1) or **void** if the Result is Ok.
 */
export function ifErr<T, E, R1>(
  result: Result<T, E>,
  onErr: (error: E) => R1,
): R1 | void;

/**
 * Executes onErr if the Result is **Err**; executes onElse if **Ok**.
 * @typeParam T - The type of the **Success Value** contained in the **Ok state**.
 * @typeParam E - The type of the **Error** contained in the **Err state**.
 * @typeParam R1 - The return type of the **onErr** callback.
 * @typeParam R2 - The return type of the **onElse** callback.
 * @param result - The Result object to check.
 * @param onErr - The function executed when the Result is **Err**, receiving the internal error (E).
 * @param onElse - The function executed when the Result is **Ok**, receiving the internal value (T).
 * @returns The return value of onErr (R1) or onElse (R2).
 */
export function ifErr<T, E, R1, R2>(
  result: Result<T, E>,
  onErr: (error: E) => R1,
  onElse: (value: T) => R2,
): R1 | R2;
export function ifErr<T, E, R1, R2>(
  result: Result<T, E>,
  onErr: (error: E) => R1,
  onElse?: (value: T) => R2,
): R1 | R2 | void {
  return !result.ok ? onErr(result.error) : onElse?.(result.value);
}

/**
 * Transforms the Result into a single type R. Uses mapFn to transform the value on Success;
 * uses defaultFn to transform the error into a default value on Failure.
 * @typeParam T - The type of the success value
 * @typeParam E - The type of the error
 * @typeParam R - The type of the final return value
 * @param result - The Result to process
 * @param defaultFn - The function to compute the default value on failure
 * @param mapFn - The function to map the success value
 * @returns The final return value R
 */
export const mapOrElse = <T, E, R1, R2>(
  result: Result<T, E>,
  defaultFn: (error: E) => R1,
  mapFn: (value: T) => R2,
): R1 | R2 => (result.ok ? mapFn(result.value) : defaultFn(result.error));
