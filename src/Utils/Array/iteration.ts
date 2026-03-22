// ========================================
// ./src/Utils/Array/iteration.ts
// ========================================

import type {MaybePromise} from '../type-tool';

/**
 * Iterates over array elements from right to left (last to first).
 * Executes the iteratee function for each element.
 *
 * @param array - The array to iterate over
 * @param iteratee - Function invoked per iteration with (value, index, collection)
 * @returns void
 *
 * @remarks
 * - For empty arrays, no iterations occur
 * - Iteration order is reversed: array[length-1] to array[0]
 * - Original array modifications during iteration affect the iteration
 */
export const forEachRight = <T>(
  array: T[],
  iteratee: (value: T, index: number, collection: T[]) => void,
): void => {
  for (let i = array.length - 1; i >= 0; i--) {
    iteratee(array[i], i, array);
  }
};

/**
 * Asynchronously iterates over array elements with controlled concurrency.
 * Executes callbacks concurrently up to the concurrency limit.
 *
 * @param array - The array to iterate over
 * @param callback - Async function invoked per element with (value, index, array)
 * @param concurrency - Maximum number of concurrent executions (default: Infinity)
 * @returns Promise that resolves when all callbacks complete
 *
 * @remarks
 * - Empty arrays resolve immediately
 * - Concurrency values < 1 behave as concurrency=Infinity
 * - If concurrency >= array.length, uses Promise.all for optimization
 * - Callback exceptions cause immediate rejection; pending callbacks continue
 * - Execution order starts from index 0, but completion order varies
 */
export const forEachAsync = async <T>(
  array: T[],
  callback: (value: T, index: number, array: T[]) => Promise<void>,
  concurrency: number = Infinity,
): Promise<void> => {
  if (array.length === 0) return;

  if (concurrency >= array.length) {
    await Promise.all(array.map((item, index) => callback(item, index, array)));
    return;
  }
  const executing: Promise<void>[] = [];
  const pool = new Set<Promise<void>>();

  for (let i = 0; i < array.length; i++) {
    const task = callback(array[i], i, array).then(() => {
      pool.delete(task);
    });

    pool.add(task);
    executing.push(task);
    if (pool.size >= concurrency) {
      await Promise.race(pool);
    }
  }

  await Promise.all(executing);
};

/**
 * Asynchronously maps array elements with controlled concurrency.
 * Returns new array with mapped values in original indices.
 *
 * @template T - Input array element type
 * @template U - Output array element type
 * @param array - Source array to map
 * @param callback - Async mapping function with (value, index, array)
 * @param concurrency - Maximum concurrent executions (default: Infinity)
 * @returns Promise resolving to new array of mapped values
 *
 * @remarks
 * - Empty arrays resolve to empty array
 * - Concurrency behavior matches forEachAsync
 * - Output array length equals input array length
 * - Original indices are preserved regardless of execution timing
 * - Any rejection immediately rejects the entire operation
 */
export const mapAsync = async <T, U>(
  array: T[],
  callback: (value: T, index: number, array: T[]) => MaybePromise<U>,
  concurrency: number = Infinity,
): Promise<U[]> => {
  const result_array = new Array<U>(array.length);

  await forEachAsync(
    array,
    async (item, index, arr) => {
      result_array[index] = await callback(item, index, arr);
    },
    concurrency,
  );

  return result_array;
};

/**
 * Asynchronously filters array elements with controlled concurrency.
 * Returns new array containing elements where predicate returns truthy.
 *
 * @param array - Array to filter
 * @param predicate - Async function returning truthy/falsy with (value, index, array)
 * @param concurrency - Maximum concurrent executions (default: Infinity)
 * @returns Promise resolving to filtered array
 *
 * @remarks
 * - Empty arrays resolve to empty array
 * - Concurrency behavior matches mapAsync
 * - Output array order preserves original relative order
 * - Predicate is called for every element (no short-circuiting)
 * - All predicates execute before filtering occurs
 */
export const filterAsync = async <T>(
  array: T[],
  predicate: (value: T, index: number, array: T[]) => MaybePromise<boolean>,
  concurrency: number = Infinity,
): Promise<T[]> => {
  const bool_results = await mapAsync(array, predicate, concurrency);
  return array.filter((_, index) => bool_results[index]);
};

/**
 * Asynchronously reduces array to single value using callback.
 * Executes callbacks sequentially from left to right.
 *
 * @template T - Array element type
 * @template U - Accumulator type
 * @param array - Array to reduce
 * @param callback - Async reducer with (accumulator, value, index, array)
 * @param initial_value - Initial accumulator value
 * @returns Promise resolving to final accumulator value
 *
 * @remarks
 * - Empty arrays with initial_value return initial_value
 * - Execution is strictly sequential (no concurrency)
 * - Reduction order: array[0] to array[length-1]
 * - Callback awaited before processing next element
 */
export const reduceAsync = async <T, U>(
  array: T[],
  callback: (
    accumulator: U,
    value: T,
    index: number,
    array: T[],
  ) => MaybePromise<U>,
  initial_value: U,
): Promise<U> => {
  let accumulator = initial_value;
  for (let i = 0; i < array.length; i++) {
    accumulator = await callback(accumulator, array[i], i, array);
  }
  return accumulator;
};
