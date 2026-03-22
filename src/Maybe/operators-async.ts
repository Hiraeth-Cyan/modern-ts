// ========================================
// ./src/Maybe/operators-async.ts
// ========================================
import {isSome, None, Some} from './base';
import type {AnyMaybe, AsyncMaybe} from './types';

// ========================================
// 核心转换操作
// ========================================

/**
 * Applies async function from Maybe to async value.
 * @typeparam T - Input type
 * @typeparam R - Result type
 * @param fn_val - Maybe function
 * @param val - Maybe value
 * @param signal - Optional AbortSignal
 * @returns AsyncMaybe<R>
 */
export const apAsync = async <T, R>(
  fn_val: AnyMaybe<(v: T) => R | Promise<R>>,
  val: AnyMaybe<T>,
  signal?: AbortSignal,
): AsyncMaybe<R> => {
  signal?.throwIfAborted();
  const [f, v] = await Promise.all([
    Promise.resolve(fn_val),
    Promise.resolve(val),
  ]);
  signal?.throwIfAborted();
  return isSome(f) && isSome(v) ? Some(await f(v)) : None();
};

/**
 * Transforms async Maybe value with async function.
 * @typeparam T - Input type
 * @typeparam R - Result type
 * @param val - Maybe value
 * @param fn - Async transformation function
 * @param signal - Optional AbortSignal
 * @returns AsyncMaybe<R>
 */
export const mapAsync = async <T, R>(
  val: AnyMaybe<T>,
  fn: (v: T) => R | Promise<R>,
  signal?: AbortSignal,
): AsyncMaybe<R> => {
  signal?.throwIfAborted();
  const v = await val;
  signal?.throwIfAborted();
  return isSome(v) ? Some(await fn(v)) : None();
};

/**
 * Maps value only if predicate passes (async).
 * @typeparam T - Input type
 * @typeparam R - Result type
 * @param val - Maybe value
 * @param predicate - Async condition check
 * @param fn - Async transformation function
 * @param signal - Optional AbortSignal
 * @returns AsyncMaybe<R>
 */
export const mapIfAsync = async <T, R>(
  val: AnyMaybe<T>,
  predicate: (v: T) => boolean | Promise<boolean>,
  fn: (v: T) => R | Promise<R>,
  signal?: AbortSignal,
): AsyncMaybe<R> => {
  signal?.throwIfAborted();
  const v = await val;
  signal?.throwIfAborted();
  if (!isSome(v)) return None();

  const shouldMap = await predicate(v);
  signal?.throwIfAborted();
  return shouldMap ? Some(await fn(v)) : None();
};

/**
 * Chains async computations that may fail.
 * @typeparam T - Input type
 * @typeparam R - Result type
 * @param val - Maybe value
 * @param fn - Async function returning Maybe
 * @param signal - Optional AbortSignal
 * @returns AsyncMaybe<R>
 */
export const andThenAsync = async <T, R>(
  val: AnyMaybe<T>,
  fn: (v: T) => AnyMaybe<R>,
  signal?: AbortSignal,
): AsyncMaybe<R> => {
  signal?.throwIfAborted();
  const v = await val;
  signal?.throwIfAborted();
  return isSome(v) ? fn(v) : None();
};

/**
 * Filters async Maybe value with async predicate.
 * @typeparam T - Value type
 * @param val - Maybe value
 * @param predicate - Async filter condition
 * @param signal - Optional AbortSignal
 * @returns AsyncMaybe<T>
 */
export const filterAsync = async <T>(
  val: AnyMaybe<T>,
  predicate: (v: T) => boolean | Promise<boolean>,
  signal?: AbortSignal,
): AsyncMaybe<T> => {
  signal?.throwIfAborted();
  const v = await val;
  signal?.throwIfAborted();
  if (!isSome(v)) return None();

  const shouldKeep = await predicate(v);
  signal?.throwIfAborted();
  return shouldKeep ? v : None();
};

// ========================================
// 组合操作
// ========================================

/**
 * Zips two async Maybes into tuple if both are Some.
 * @typeparam T - First type
 * @typeparam U - Second type
 * @param a - First Maybe
 * @param b - Second Maybe
 * @param signal - Optional AbortSignal
 * @returns AsyncMaybe<[T, U]>
 */
export const zipAsync = async <T, U>(
  a: AnyMaybe<T>,
  b: AnyMaybe<U>,
  signal?: AbortSignal,
): AsyncMaybe<[T, U]> => {
  signal?.throwIfAborted();
  const [ra, rb] = await Promise.all([Promise.resolve(a), Promise.resolve(b)]);
  signal?.throwIfAborted();
  return isSome(ra) && isSome(rb) ? Some([ra, rb]) : None();
};

// ========================================
// 逻辑分支与错误处理
// ========================================

/**
 * Extracts value from async Maybe or returns default.
 * @typeparam T - Input type
 * @typeparam R - Result type
 * @param val - Maybe value
 * @param initial - Default value or Promise
 * @param onSome - Async handler for Some case
 * @param signal - Optional AbortSignal
 * @returns Promise<R>
 */
export const foldAsync = async <T, R>(
  val: AnyMaybe<T>,
  initial: R | Promise<R>,
  onSome: (v: T) => R | Promise<R>,
  signal?: AbortSignal,
): Promise<R> => {
  signal?.throwIfAborted();
  const v = await val;
  signal?.throwIfAborted();
  return isSome(v) ? onSome(v) : initial;
};

/**
 * Returns value if Some, otherwise async fallback.
 * @typeparam T - Value type
 * @param val - Maybe value
 * @param fn - Async fallback supplier
 * @param signal - Optional AbortSignal
 * @returns AsyncMaybe<T>
 */
export const orElseAsync = async <T>(
  val: AnyMaybe<T>,
  fn: () => AnyMaybe<T>,
  signal?: AbortSignal,
): AsyncMaybe<T> => {
  signal?.throwIfAborted();
  const v = await val;
  signal?.throwIfAborted();
  return isSome(v) ? v : fn();
};

// ========================================
// 集合操作
// ========================================

/**
 * Maps array with async function, fails if any returns None.
 * @typeparam T - Input type
 * @typeparam R - Output type
 * @param items - Input array
 * @param fn - Async mapping function
 * @param signal - Optional AbortSignal
 * @returns AsyncMaybe<R[]>
 */
export const mapAllAsync = async <T, R>(
  items: readonly T[],
  fn: (it: T, i: number) => AnyMaybe<R>,
  signal?: AbortSignal,
): AsyncMaybe<R[]> => {
  signal?.throwIfAborted();
  const results = await Promise.all(
    items.map(async (it, i) => {
      signal?.throwIfAborted();
      return await fn(it, i);
    }),
  );
  signal?.throwIfAborted();

  const final: R[] = [];
  for (const r of results) {
    if (!isSome(r)) return None();
    final.push(r);
  }
  return Some(final);
};

/**
 * Returns all async values if all are Some, None otherwise.
 * @typeparam T - Element type
 * @param vals - Array of async Maybes
 * @param signal - Optional AbortSignal
 * @returns AsyncMaybe<T[]>
 */
export const allAsync = async <T>(
  vals: readonly AnyMaybe<T>[],
  signal?: AbortSignal,
): AsyncMaybe<T[]> => {
  signal?.throwIfAborted();
  const resolved = await Promise.all(
    vals.map((v) => {
      signal?.throwIfAborted();
      return Promise.resolve(v);
    }),
  );
  signal?.throwIfAborted();
  return resolved.every(isSome) ? Some(resolved as T[]) : None();
};

/**
 * Returns first Some value from async array, None if none found.
 * @typeparam T - Element type
 * @param vals - Array of async Maybes
 * @param signal - Optional AbortSignal
 * @returns AsyncMaybe<T>
 */
export const firstSomeAsync = async <T>(
  vals: readonly AnyMaybe<T>[],
  signal?: AbortSignal,
): AsyncMaybe<T> => {
  signal?.throwIfAborted();
  const resolved = await Promise.all(
    vals.map((v) => {
      signal?.throwIfAborted();
      return Promise.resolve(v);
    }),
  );
  signal?.throwIfAborted();

  for (const v of resolved) {
    if (isSome(v)) return Some(v);
  }
  return None();
};

// ========================================
// 规约与聚合
// ========================================

/**
 * Reduces array of async Maybes with async reducer.
 * @typeparam T - Element type
 * @typeparam R - Result type
 * @param vals - Array of async Maybes
 * @param initial - Initial value
 * @param reducer - Async reduction function
 * @param signal - Optional AbortSignal
 * @returns AsyncMaybe<R>
 */
export async function reduceAsync<T, R>(
  vals: readonly AnyMaybe<T>[],
  initial: R,
  reducer: (acc: R, v: T) => R | Promise<R>,
  signal?: AbortSignal,
): AsyncMaybe<R> {
  signal?.throwIfAborted();
  let acc = initial;
  const resolved_vals = await Promise.all(
    vals.map((v) => {
      signal?.throwIfAborted();
      return Promise.resolve(v);
    }),
  );
  signal?.throwIfAborted();

  for (const v of resolved_vals) {
    if (!isSome(v)) return None();
    acc = await reducer(acc, v);
    signal?.throwIfAborted();
  }
  return Some(acc);
}

/**
 * Performs async scan reduction on array of async Maybes.
 * @typeparam T - Element type
 * @typeparam R - Result type
 * @param vals - Array of async Maybes
 * @param initial - Initial value
 * @param scanner - Async scanning function
 * @param signal - Optional AbortSignal
 * @returns AsyncMaybe<R[]>
 */
export async function scanAsync<T, R>(
  vals: readonly AnyMaybe<T>[],
  initial: R,
  scanner: (acc: R, v: T) => R | Promise<R>,
  signal?: AbortSignal,
): AsyncMaybe<R[]> {
  signal?.throwIfAborted();
  const resolved = await Promise.all(
    vals.map((v) => {
      signal?.throwIfAborted();
      return Promise.resolve(v);
    }),
  );
  signal?.throwIfAborted();

  const scanned: R[] = [initial];
  let acc = initial;

  for (const v of resolved) {
    if (!isSome(v)) return None();
    acc = await scanner(acc, v);
    signal?.throwIfAborted();
    scanned.push(acc);
  }
  return Some(scanned);
}

// ========================================
// 集合筛选与统计
// ========================================

/**
 * Collects all Some values from async array.
 * @typeparam T - Element type
 * @param vals - Array of async Maybes
 * @param signal - Optional AbortSignal
 * @returns Promise<T[]> - Only Some values
 */
export const collectSomesAsync = async <T>(
  vals: readonly AnyMaybe<T>[],
  signal?: AbortSignal,
): Promise<T[]> => {
  signal?.throwIfAborted();
  const resolved = await Promise.all(
    vals.map((v) => {
      signal?.throwIfAborted();
      return Promise.resolve(v);
    }),
  );
  signal?.throwIfAborted();
  return resolved.filter(isSome) as T[];
};

/**
 * Partitions async array into Some values and None count.
 * @typeparam T - Element type
 * @param vals - Array of async Maybes
 * @param signal - Optional AbortSignal
 * @returns Promise<[T[], number]> - [Some values, None count]
 */
export const partitionAsync = async <T>(
  vals: readonly AnyMaybe<T>[],
  signal?: AbortSignal,
): Promise<[T[], number]> => {
  signal?.throwIfAborted();
  const resolved = await Promise.all(
    vals.map((v) => {
      signal?.throwIfAborted();
      return Promise.resolve(v);
    }),
  );
  signal?.throwIfAborted();

  const somes: T[] = [];
  let none_count = 0;

  for (const v of resolved) {
    if (isSome(v)) somes.push(v);
    else none_count++;
  }

  return [somes, none_count];
};
