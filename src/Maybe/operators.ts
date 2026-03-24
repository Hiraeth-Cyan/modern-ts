// ========================================
// ./src/Maybe/operators.ts
// ========================================
import {isSome, None, Some} from './base';
import type {Maybe} from './types';

// ========================================
// 基础转换
// ========================================

/**
 * Transforms the contained value if Some, returns None otherwise.
 * @template T - Original value type
 * @template R - Result type
 * @param val - Maybe value
 * @param fn - Transformation function
 * @returns Maybe<R>
 */
export const map = <T, R>(val: Maybe<T>, fn: (value: T) => R): Maybe<R> =>
  isSome(val) ? Some(fn(val)) : None();

/**
 * Chains computations that may fail. If Some, applies fn, otherwise returns None.
 * @template T - Original value type
 * @template R - Result type
 * @param val - Maybe value
 * @param fn - Function returning Maybe<R>
 * @returns Maybe<R>
 */
export const andThen = <T, R>(
  val: Maybe<T>,
  fn: (value: T) => Maybe<R>,
): Maybe<R> => (isSome(val) ? fn(val) : val);

/**
 * Applies a Maybe-wrapped function to a Maybe value.
 * @template T - Input type
 * @template R - Result type
 * @param fn_val - Maybe<(v: T) => R>
 * @param val - Maybe<T>
 * @returns Maybe<R>
 */
export const ap = <T, R>(
  fn_val: Maybe<(v: T) => R>,
  val: Maybe<T>,
): Maybe<R> => (isSome(fn_val) && isSome(val) ? Some(fn_val(val)) : None());

/**
 * Returns Some if value satisfies predicate, None otherwise.
 * @template T - Value type
 * @param val - Maybe value
 * @param predicate - Filter condition
 * @returns Maybe<T>
 */
export const filter = <T>(
  val: Maybe<T>,
  predicate: (v: T) => boolean,
): Maybe<T> => (isSome(val) && predicate(val) ? val : None());

/**
 * Maps value if predicate passes, returns None otherwise.
 * @template T - Original type
 * @template R - Result type
 * @param val - Maybe value
 * @param predicate - Condition to check
 * @param fn - Transformation function
 * @returns Maybe<R>
 */
export const mapIf = <T, R>(
  val: Maybe<T>,
  predicate: (v: T) => boolean,
  fn: (v: T) => R,
): Maybe<R> => (isSome(val) && predicate(val) ? Some(fn(val)) : None());

// ========================================
// 逻辑分支与聚合
// ========================================

/**
 * Returns other if val is Some, None otherwise.
 * @template T - First type
 * @template U - Second type
 * @param val - Maybe<T>
 * @param other - Maybe<U>
 * @returns Maybe<U>
 */
export const and = <T, U>(val: Maybe<T>, other: Maybe<U>): Maybe<U> =>
  isSome(val) ? other : None();

/**
 * Returns first Some value, otherwise other.
 * @template T - Value type
 * @param val - First Maybe
 * @param other - Fallback Maybe
 * @returns Maybe<T>
 */
export const or = <T>(val: Maybe<T>, other: Maybe<T>): Maybe<T> =>
  isSome(val) ? val : other;

/**
 * Returns val if Some, otherwise calls fn for fallback.
 * @template T - Value type
 * @param val - Maybe value
 * @param fn - Fallback supplier
 * @returns Maybe<T>
 */
export const orElse = <T>(val: Maybe<T>, fn: () => Maybe<T>): Maybe<T> =>
  isSome(val) ? val : fn();

/**
 * Extracts value or returns default.
 * @template T - Input type
 * @template R - Output type
 * @param val - Maybe value
 * @param initial - Default value
 * @param onSome - Handler for Some case
 * @returns R
 */
export const fold = <T, R>(
  val: Maybe<T>,
  initial: R,
  onSome: (v: T) => R,
): R => (isSome(val) ? onSome(val) : initial);

/**
 * Checks if Maybe contains specific value.
 * @template T - Value type
 * @param val - Maybe value
 * @param x - Value to compare
 * @returns boolean
 */
export const contains = <T>(val: Maybe<T>, x: T): boolean =>
  isSome(val) && val === x;

// ========================================
// 多元组合
// ========================================

/**
 * Combines two Maybes into tuple if both are Some.
 * @template T - First type
 * @template U - Second type
 * @param a - Maybe<T>
 * @param b - Maybe<U>
 * @returns Maybe<[T, U]>
 */
export const zip = <T, U>(a: Maybe<T>, b: Maybe<U>): Maybe<[T, U]> =>
  isSome(a) && isSome(b) ? Some([a, b] as [T, U]) : None();

/**
 * Applies function to two Maybes if both are Some.
 * @template T - First type
 * @template U - Second type
 * @template R - Result type
 * @param ma - Maybe<T>
 * @param mb - Maybe<U>
 * @param fn - Combining function
 * @returns Maybe<R>
 */
export const zipWith = <T, U, R>(
  ma: Maybe<T>,
  mb: Maybe<U>,
  fn: (a: T, b: U) => R,
): Maybe<R> => (isSome(ma) && isSome(mb) ? Some(fn(ma, mb)) : None());

// ========================================
// 集合处理
// ========================================

/**
 * Returns array of all values if all are Some, None otherwise.
 * @template T - Element type
 * @param vals - Array of Maybes
 * @returns Maybe<T[]>
 */
export const all = <T>(vals: readonly Maybe<T>[]): Maybe<T[]> =>
  vals.every(isSome) ? Some(vals as T[]) : None();

/**
 * Maps array to Maybes, returns Some of results if all succeed.
 * @template UT - Input type
 * @template U - Output type
 * @param items - Input array
 * @param fn - Mapping function
 * @returns Maybe<U[]>
 */
export const mapAll = <T, U>(
  items: readonly T[],
  fn: (it: T, i: number) => Maybe<U>,
): Maybe<U[]> => {
  const results: U[] = [];
  for (let i = 0; i < items.length; i++) {
    const res = fn(items[i], i);
    if (!isSome(res)) return None();
    results.push(res);
  }
  return Some(results);
};

/**
 * Partitions array into Some values and None count.
 * @template T - Element type
 * @param vals - Array of Maybes
 * @returns [T[], number] - [Some values, None count]
 */
export const partition = <T>(vals: readonly Maybe<T>[]): [T[], number] => {
  const somes: T[] = [];
  let none_count = 0;
  for (const v of vals) {
    if (isSome(v)) somes.push(v);
    else none_count++;
  }
  return [somes, none_count];
};

/**
 * Collects all Some values from array.
 * @template T - Element type
 * @param vals - Array of Maybes
 * @returns T[] - Only Some values
 */
export const collectSomes = <T>(vals: readonly Maybe<T>[]): T[] => {
  const result: T[] = [];
  for (const v of vals) if (isSome(v)) result.push(v);
  return result;
};

/**
 * Returns first Some value in array, None if none found.
 * @template T - Element type
 * @param vals - Array of Maybes
 * @returns Maybe<T>
 */
export const firstSome = <T>(vals: readonly Maybe<T>[]): Maybe<T> =>
  vals.find(isSome) ?? None();

// ========================================
// 高级规约
// ========================================

/**
 * Reduces array of Maybes. Returns None if any is None.
 * @template T - Element type
 * @template R - Result type
 * @param vals - Array of Maybes
 * @param initial - Initial value
 * @param reducer - Reduction function
 * @returns Maybe<R>
 */
export function reduce<T, R>(
  vals: readonly Maybe<T>[],
  initial: R,
  reducer: (acc: R, v: T) => R,
): Maybe<R> {
  let acc = initial;
  for (const v of vals) {
    if (!isSome(v)) return None();
    acc = reducer(acc, v);
  }
  return Some(acc);
}

/**
 * Performs scan reduction. Returns None if any is None.
 * @template T - Element type
 * @template R - Result type
 * @param vals - Array of Maybes
 * @param initial - Initial value
 * @param scanner - Scanning function
 * @returns Maybe<R[]>
 */
export function scan<T, R>(
  vals: readonly Maybe<T>[],
  initial: R,
  scanner: (acc: R, v: T) => R,
): Maybe<R[]> {
  const scanned: R[] = [initial];
  let acc = initial;
  for (const v of vals) {
    if (!isSome(v)) return None();
    acc = scanner(acc, v);
    scanned.push(acc);
  }
  return Some(scanned);
}

/**
 * Folds with separate handlers for Some/None.
 * @template T - Element type
 * @template R - Result type
 * @param vals - Array of Maybes
 * @param initial - Initial value
 * @param onSome - Handler for Some values
 * @param onNone - Handler for None values
 * @returns R
 */
export const folds = <T, R>(
  vals: readonly Maybe<T>[],
  initial: R,
  onSome: (acc: R, v: T) => R,
  onNone: (acc: R) => R,
): R => {
  let acc = initial;
  for (const v of vals) acc = isSome(v) ? onSome(acc, v) : onNone(acc);
  return acc;
};
