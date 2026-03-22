// ========================================
// ./src/Maybe/base.ts
// ========================================
import type {Result} from 'src/Result/types';
import {type AsyncMaybe, type Maybe} from './types';
import {Err, Ok} from 'src/Result/base';

/**
 * Constructs a `Some` value containing a non-null, non-undefined value.
 * @param value - The value to wrap in a Maybe.
 * @returns A Maybe containing the value.
 */
export const Some = <T>(value: T): Maybe<T> => value;

/**
 * Constructs a `None` value representing absence of a value.
 * @returns An empty Maybe (undefined).
 */
export const None = (): Maybe<never> => undefined;

/**
 * Type guard checking if a Maybe contains a value (`Some`).
 * @param m - The Maybe to inspect.
 * @returns True if the Maybe contains a value.
 */
export const isSome = <T>(m: Maybe<T>): m is T => m !== null && m !== undefined;

/**
 * Type guard checking if a Maybe is empty (`None`).
 * @param m - The Maybe to inspect.
 * @returns True if the Maybe is null or undefined.
 */
export const isNone = (m: Maybe<unknown>): m is null | undefined =>
  m === null || m === undefined;

/**
 * Converts nullable value to a Maybe.
 * @param value - Possibly null/undefined value.
 * @returns Some(value) if value exists, None otherwise.
 */
export const fromNullable = <T>(value: T | null | undefined): Maybe<T> =>
  isNone(value) ? None() : Some(value);

/**
 * Converts falsy value to a Maybe.
 * @param value - Possibly falsy value.
 * @returns Some(value) if truthy, None otherwise.
 */
export const fromFalsy = <T>(
  value: T | null | undefined | false | 0 | '',
): Maybe<T> => (!value ? None() : Some(value as T));

/**
 * Converts Maybe to nullable value.
 * @param maybe - Maybe value.
 * @returns The value if Some, null if None.
 */
export const toNullable = <T>(maybe: Maybe<T>): T | null =>
  isSome(maybe) ? maybe : null;

/**
 * Converts Maybe to Result type.
 * @param maybe - Maybe value.
 * @param errorFn - Error generator for None case.
 * @returns Ok(value) if Some, Err(errorFn()) if None.
 */
export const toResult = <T, E>(
  maybe: Maybe<T>,
  errorFn: () => E,
): Result<T, E> => (isSome(maybe) ? Ok(maybe) : Err(errorFn()));

/**
 * Converts Maybe to array representation.
 * @param val - Maybe value.
 * @returns Singleton array if Some, empty array if None.
 */
export const toArray = <T>(val: Maybe<T>): T[] => (isSome(val) ? [val] : []);

/**
 * Transposes a Maybe containing a Promise to an AsyncMaybe.
 * @param val - Maybe wrapping a Promise.
 * @returns Promise resolving to Some(value) if input was Some, None otherwise.
 */
export async function transpose<T>(val: Maybe<Promise<T>>): AsyncMaybe<T> {
  return isSome(val) ? await val : None();
}
