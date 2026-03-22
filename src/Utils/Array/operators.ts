// ========================================
// ./src/Utils/Array/operators.ts
// ========================================

/**
 * Maps array in-place within specified range. Clamps indices to valid array bounds.
 * Negative start/end count from array end. Returns modified original array.
 * @param array - Array to modify (mutated)
 * @param transform - Mapping function receiving current index
 * @param start - Start index (clamped, negative counts from end)
 * @param end - End index (clamped, negative counts from end)
 * @returns Mutated original array with mixed types
 */
export const mapInPlace = <T, R>(
  array: readonly T[],
  transform: (index: number) => R,
  start = 0,
  end = array.length,
): readonly (T | R)[] => {
  const len = array.length;
  const relative_start =
    start < 0 ? Math.max(len + start, 0) : Math.min(start, len);
  const relative_end = end < 0 ? Math.max(len + end, 0) : Math.min(end, len);

  for (let i = relative_start; i < relative_end; i++) {
    (array as (T | R)[])[i] = transform(i);
  }
  return array as (T | R)[];
};

/**
 * Creates new array mapped within specified range. Clamps indices to valid bounds.
 * Negative start/end count from array end. Original array remains unchanged.
 * @param array - Source array (not mutated)
 * @param transform - Mapping function receiving current index
 * @param start - Start index (clamped, negative counts from end)
 * @param end - End index (clamped, negative counts from end)
 * @returns New array with mixed types
 */
export const mapToNewArray = <T, R>(
  array: readonly T[],
  transform: (index: number) => R,
  start = 0,
  end = array.length,
): readonly (T | R)[] => mapInPlace([...array], transform, start, end);

/**
 * Returns all arrays with minimum length. Empty arrays included in comparison.
 * Returns single array if unique minimum, multiple arrays if tie.
 * Returns empty array if no input arrays provided.
 * @param arrays - Arrays to compare
 * @returns Array of shortest arrays
 */
export const shortest = <T>(...arrays: readonly T[][]): readonly T[][] => {
  let min_len = Infinity;
  let result: T[][] = [];

  for (const arr of arrays) {
    const len = arr.length;
    if (len < min_len) {
      min_len = len;
      result = [arr];
    } else if (len === min_len) {
      result.push(arr);
    }
  }

  return result;
};

/**
 * Moves element between positions using circular indexing. Returns original array.
 * No-op for single-element arrays or identical source/destination.
 * Uses copyWithin for optimal performance. Handles both forward and backward moves.
 * @param array - Array to modify (mutated)
 * @param from - Source index (wraps circularly)
 * @param to - Destination index (wraps circularly)
 * @returns Mutated original array
 */
export const move = <T>(array: T[], from: number, to: number): T[] => {
  const len = array.length;
  if (len <= 1) return array;

  const start = ((from % len) + len) % len;
  const end = ((to % len) + len) % len;

  if (start === end) return array;
  const item = array[start];

  if (start < end) array.copyWithin(start, start + 1, end + 1);
  else array.copyWithin(end + 1, end, start);

  array[end] = item;
  return array;
};

/**
 * Finds the element with maximum value according to the iteratee function
 *
 * @template T - The type of elements in the array
 * @param array - The array to search (readonly, accepts sparse arrays)
 * @param iteratee - Function that returns a numeric value for each element
 * @returns The element with maximum iteratee value, or undefined for empty array
 * @remarks - Returns undefined for empty arrays. Handles sparse arrays by skipping missing indices.
 *           - If multiple elements have the same maximum value, returns the first found.
 *           - Iteratee is called only for existing elements in sparse arrays.
 */
export const maxBy = <T>(
  array: readonly T[],
  iteratee: (value: T) => number,
): T | undefined => {
  if (array.length === 0) {
    return undefined;
  }

  let result: T | undefined = undefined;
  let max_score = -Infinity;

  for (let i = 0; i < array.length; i++) {
    if (i in array) {
      const current_item = array[i];
      const current_score = iteratee(current_item);

      if (current_score > max_score) {
        max_score = current_score;
        result = current_item;
      }
    }
  }

  return result;
};

/**
 * Finds the element with minimum value according to the iteratee function
 *
 * @template T - The type of elements in the array
 * @param array - The array to search (readonly, accepts sparse arrays)
 * @param iteratee - Function that returns a numeric value for each element
 * @returns The element with minimum iteratee value, or undefined for empty array
 * @remarks - Returns undefined for empty arrays. Handles sparse arrays by skipping missing indices.
 *           - If multiple elements have the same minimum value, returns the first found.
 *           - Iteratee is called only for existing elements in sparse arrays.
 */
export const minBy = <T>(
  array: readonly T[],
  iteratee: (value: T) => number,
): T | undefined => {
  if (array.length === 0) {
    return undefined;
  }

  let result: T | undefined = undefined;
  let min_score = Infinity;

  for (let i = 0; i < array.length; i++) {
    if (i in array) {
      const current_item = array[i];
      const current_score = iteratee(current_item);

      if (current_score < min_score) {
        min_score = current_score;
        result = current_item;
      }
    }
  }

  return result;
};
