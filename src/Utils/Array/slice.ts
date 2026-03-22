// ========================================
// ./src/Utils/Array/slice.ts
// ========================================

/**
 * Gets the first element of an array.
 * @param array - The array to query.
 * @returns The first element, or undefined if array is empty.
 * @example
 * head([1, 2, 3]) // => 1
 * head([]) // => undefined
 */
export const head = <T>(array: readonly T[]) => array[0];

/**
 * Gets the last element of an array.
 * @param array - The array to query.
 * @returns The last element, or undefined if array is empty.
 * @example
 * last([1, 2, 3]) // => 3
 * last([]) // => undefined
 */
export const last = <T>(array: readonly T[]): T | undefined =>
  array.at?.(-1) ?? array[array.length - 1];

/**
 * Gets all but the last element of an array.
 * @param array - The array to query.
 * @returns A new array excluding the last element.
 * @remarks
 * - Returns empty array if input array has 0 or 1 elements
 * - Non-integer array length is handled by slice()
 * @example
 * initial([1, 2, 3]) // => [1, 2]
 * initial([1]) // => []
 * initial([]) // => []
 */
export const initial = <T>(array: readonly T[]) => array.slice(0, -1);

/**
 * Gets all but the first element of an array.
 * @param array - The array to query.
 * @returns A new array excluding the first element.
 * @remarks
 * - Returns empty array if input array has 0 or 1 elements
 * - Non-integer array length is handled by slice()
 * @example
 * tail([1, 2, 3]) // => [2, 3]
 * tail([1]) // => []
 * tail([]) // => []
 */
export const tail = <T>(array: readonly T[]) => array.slice(1);

/**
 * Takes n elements from the beginning.
 * @param array - The array to query.
 * @param n - Number of elements to take (default: 1).
 * @returns A new array of taken elements.
 * @remarks
 * - n <= 0: returns empty array
 * - n is not an integer: converted to integer via slice()
 * - n > array.length: returns entire array copy
 * - NaN or Infinity n: behavior depends on slice() conversion
 * @example
 * take([1, 2, 3], 2) // => [1, 2]
 * take([1, 2, 3], 0) // => []
 * take([1, 2, 3], -1) // => []
 * take([1, 2, 3], 5) // => [1, 2, 3]
 */
export const take = <T>(array: readonly T[], n = 1) => {
  if (n <= 0) return [];
  return array.slice(0, n);
};

/**
 * Takes n elements from the end.
 * @param array - The array to query.
 * @param n - Number of elements to take (default: 1).
 * @returns A new array of taken elements.
 * @remarks
 * - n <= 0: returns empty array
 * - n is not an integer: converted to integer via slice()
 * - n > array.length: returns entire array copy
 * - NaN or Infinity n: behavior depends on slice() conversion
 * @example
 * takeRight([1, 2, 3], 2) // => [2, 3]
 * takeRight([1, 2, 3], 0) // => []
 * takeRight([1, 2, 3], -1) // => []
 */
export const takeRight = <T>(array: readonly T[], n = 1) => {
  if (n <= 0) return [];
  return array.slice(-n);
};

/**
 * Drops n elements from the beginning.
 * @param array - The array to query.
 * @param n - Number of elements to drop (default: 1).
 * @returns A new array of remaining elements.
 * @remarks
 * - n <= 0: returns full array copy
 * - n is not an integer: converted to integer via slice()
 * - n >= array.length: returns empty array
 * - NaN or Infinity n: behavior depends on slice() conversion
 * @example
 * drop([1, 2, 3], 2) // => [3]
 * drop([1, 2, 3], 0) // => [1, 2, 3]
 * drop([1, 2, 3], 5) // => []
 */
export const drop = <T>(array: readonly T[], n = 1) => {
  if (n <= 0) return [...array];
  return array.slice(n);
};

/**
 * Drops n elements from the end.
 * @param array - The array to query.
 * @param n - Number of elements to drop (default: 1).
 * @returns A new array of remaining elements.
 * @remarks
 * - n <= 0: returns full array copy
 * - n is not an integer: converted to integer via slice()
 * - n >= array.length: returns empty array
 * - NaN or Infinity n: behavior depends on slice() conversion
 * @example
 * dropRight([1, 2, 3], 2) // => [1]
 * dropRight([1, 2, 3], 0) // => [1, 2, 3]
 * dropRight([1, 2, 3], 5) // => []
 */
export const dropRight = <T>(array: readonly T[], n = 1) => {
  if (n <= 0) return [...array];
  return array.slice(0, -n);
};

type Predicate<T> = (value: T) => boolean;

/**
 * Takes elements from the beginning while predicate returns true.
 * @param array - The array to query.
 * @param predicate - The function invoked per iteration.
 * @returns A new array of taken elements.
 * @remarks
 * - Empty array: returns empty array
 * - All elements satisfy predicate: returns full array copy
 * - No elements satisfy predicate: returns empty array
 * - Predicate throws: iteration stops at exception
 * @example
 * takeWhile([1, 2, 3, 4], x => x < 3) // => [1, 2]
 * takeWhile([], x => x < 3) // => []
 * takeWhile([1, 2, 3], x => x < 5) // => [1, 2, 3]
 */
export const takeWhile = <T>(
  array: readonly T[],
  predicate: Predicate<T>,
): T[] => {
  const index = array.findIndex((value) => !predicate(value));
  if (index === -1) return [...array];
  return array.slice(0, index);
};

/**
 * Takes elements from the end while predicate returns true.
 * @param array - The array to query.
 * @param predicate - The function invoked per iteration.
 * @returns A new array of taken elements.
 * @remarks
 * - Empty array: returns empty array
 * - All elements satisfy predicate: returns full array copy
 * - No elements satisfy predicate: returns empty array
 * - Iterates from end; predicate called for each element until false
 * @example
 * takeRightWhile([1, 2, 3, 4], x => x > 2) // => [3, 4]
 * takeRightWhile([], x => x > 2) // => []
 */
export const takeRightWhile = <T>(
  array: readonly T[],
  predicate: Predicate<T>,
): T[] => {
  let i = array.length;
  while (i-- > 0 && predicate(array[i]));
  return array.slice(i + 1);
};

/**
 * Drops elements from the beginning while predicate returns true.
 * @param array - The array to query.
 * @param predicate - The function invoked per iteration.
 * @returns A new array of remaining elements.
 * @remarks
 * - Empty array: returns empty array
 * - All elements satisfy predicate: returns empty array
 * - No elements satisfy predicate: returns full array copy
 * @example
 * dropWhile([1, 2, 3, 4], x => x < 3) // => [3, 4]
 * dropWhile([], x => x < 3) // => []
 * dropWhile([1, 2, 3], x => x < 5) // => []
 */
export const dropWhile = <T>(
  array: readonly T[],
  predicate: Predicate<T>,
): T[] => {
  const index = array.findIndex((value) => !predicate(value));
  if (index === -1) return [];
  return array.slice(index);
};

/**
 * Drops elements from the end while predicate returns true.
 * @param array - The array to query.
 * @param predicate - The function invoked per iteration.
 * @returns A new array of remaining elements.
 * @remarks
 * - Empty array: returns empty array
 * - All elements satisfy predicate: returns empty array
 * - No elements satisfy predicate: returns full array copy
 * - Iterates from end; predicate called for each element until false
 * @example
 * dropRightWhile([1, 2, 3, 4], x => x > 2) // => [1, 2]
 * dropRightWhile([], x => x > 2) // => []
 */
export const dropRightWhile = <T>(
  array: readonly T[],
  predicate: Predicate<T>,
): T[] => {
  let i = array.length;
  while (i-- > 0 && predicate(array[i]));
  return array.slice(0, i + 1);
};

/**
 * Collects elements at specified indices. Returns empty array if either array or indices are empty.
 * When circular is true, indices wrap around array bounds using modulo arithmetic.
 * @param array - Source array
 * @param indices - Target indices to collect
 * @param circular - Enable circular indexing (default: false)
 * @returns Array of collected elements, undefined for out-of-bounds non-circular indices
 */
export const collectAt = <T>(
  array: T[],
  indices: number[],
  circular = false,
): (T | undefined)[] => {
  const len = array.length;
  if (!len || !indices.length) return [];
  const getIdx = circular
    ? (idx: number) => ((idx % len) + len) % len
    : (idx: number) => idx;

  return indices.map((idx) => array[getIdx(idx)]);
};

/**
 * Gets element at circular index. Returns undefined for empty array.
 * Implements modulo arithmetic: negative indices wrap from end, positive from start.
 * @param array - Source array
 * @param index - Target index (wraps circularly)
 * @returns Element at circular index or undefined if array empty
 */
export const circularAt = <T>(array: T[], index: number): T | undefined => {
  if (!array.length) return undefined;
  const len = array.length;
  return array[((index % len) + len) % len];
};
