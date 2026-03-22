// ========================================
// ./src/Result/Operators/partition.ts
// ========================================
import type {Result} from '../types';

/**
 * Collects all success values from an array of Results.
 * @typeParam T - The type of the success value
 * @typeParam E - The type of the error
 * @param results - The array of Results
 * @returns An array of collected success values
 */
export const collectOk = <T, E>(results: readonly Result<T, E>[]): T[] =>
  results
    .filter((result): result is {ok: true; value: T} => result.ok)
    .map((result) => result.value);

/**
 * Collects all failure errors from an array of Results.
 * @typeParam T - The type of the success value
 * @typeParam E - The type of the error
 * @param results - The array of Results
 * @returns An array of collected error values
 */
export const collectErr = <T, E>(results: readonly Result<T, E>[]): E[] =>
  results
    .filter((result): result is {ok: false; error: E} => !result.ok)
    .map((result) => result.error);

/**
 * Splits an array of Results into a tuple of success values and error values.
 * @typeParam T - The type of the success value
 * @typeParam E - The type of the error
 * @param results - The array of Results
 * @returns A tuple containing the array of success values and the array of error values
 */
export function partition<T, E>(results: readonly Result<T, E>[]): [T[], E[]] {
  const oks: T[] = [];
  const errs: E[] = [];

  for (const result of results) {
    if (result.ok) {
      oks.push(result.value);
    } else {
      errs.push(result.error);
    }
  }

  return [oks, errs];
}
