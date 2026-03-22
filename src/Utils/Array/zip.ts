// ========================================
// ./src/Utils/Array/zip.ts
// ========================================

/**
 * Creates an array of grouped elements, where each element contains one element from each input array.
 * The length of the result equals the length of the longest input array.
 * Missing elements from shorter arrays are filled with `undefined`.
 *
 * @template T - Tuple type representing element types of each array
 * @param arrays - Arrays to zip together
 * @returns Array of tuples containing elements from each input array
 *
 * @example
 * zip([1, 2], ['a', 'b']); // returns [[1, 'a'], [2, 'b']]
 * zip([1], ['a', 'b']);    // returns [[1, 'a'], [undefined, 'b']]
 */
export const zip = <T extends unknown[]>(
  ...arrays: {[K in keyof T]: T[K][]}
): T[] => {
  const array_count = arrays.length;
  if (array_count === 0) return [];

  const max_length = Math.max(...arrays.map((arr) => arr.length));
  const result: T[] = [];

  for (let i = 0; i < max_length; i++) {
    const group = [] as unknown as T;
    for (let j = 0; j < array_count; j++) {
      group[j] = arrays[j][i];
    }
    result.push(group);
  }
  return result;
};

/**
 * Creates an object with keys from `keys` array and values from `values` array.
 * Stops when either array is exhausted (uses minimum length).
 *
 * @template K - Key type (string | number | symbol)
 * @template V - Value type
 * @param keys - Array of keys
 * @param values - Array of values
 * @returns Object with key-value pairs from both arrays
 *
 * @example
 * zipObject(['a', 'b'], [1, 2]); // returns {a: 1, b: 2}
 * zipObject(['a', 'b', 'c'], [1]); // returns {a: 1}
 */
export const zipObject = <K extends string | number | symbol, V>(
  keys: readonly K[],
  values: readonly V[],
): Record<K, V> => {
  const result = {} as Record<K, V>;

  const loop_limit = Math.min(keys.length, values.length);

  for (let i = 0; i < loop_limit; i++) {
    result[keys[i]] = values[i];
  }
  return result;
};

/**
 * Creates an array of results by applying `iteratee` to grouped elements from input arrays.
 * The length of the result equals the length of the shortest input array.
 *
 * @template T - Tuple type for iteratee parameters
 * @template R - Return type of iteratee
 * @param iteratee - Function to apply to grouped elements
 * @param arrays - Arrays to zip together
 * @returns Array of results from applying iteratee
 *
 * @example
 * zipWith((a, b) => a + b, [1, 2], [10, 20]); // returns [11, 22]
 * zipWith((a, b) => a + b, [1], [10, 20]);    // returns [11]
 */
export const zipWith = <T extends unknown[], R>(
  iteratee: (...args: T) => R,
  ...arrays: {[K in keyof T]: T[K][]}
): R[] => {
  const array_count = arrays.length;
  if (array_count === 0) return [];

  const min_length = Math.min(...arrays.map((arr) => arr.length));
  const result: R[] = [];

  for (let i = 0; i < min_length; i++) {
    const args = [] as unknown as T;
    for (let j = 0; j < array_count; j++) {
      args[j] = arrays[j][i];
    }
    result.push(iteratee(...args));
  }
  return result;
};

/**
 * Inverse of `zip`: splits array of tuples into separate arrays.
 * Returns empty array if input is empty.
 *
 * @template T - Tuple type
 * @param array - Array of tuples to unzip
 * @returns Array of arrays where each contains elements from one position
 *
 * @example
 * unzip([[1, 'a'], [2, 'b']]); // returns [[1, 2], ['a', 'b']]
 * unzip([]); // returns []
 */
export const unzip = <T extends unknown[]>(
  array: readonly T[],
): {[K in keyof T[number]]: T[number][K][]} => {
  if (array.length === 0) {
    return [] as unknown as {[K in keyof T[number]]: T[number][K][]};
  }
  return zip(...array) as {[K in keyof T[number]]: T[number][K][]};
};

/**
 * Inverse of `zipWith`: splits array and applies iteratee to resulting groups.
 * Returns empty array if input is empty.
 *
 * @template T - Tuple type for iteratee parameters
 * @template R - Return type of iteratee
 * @param array - Array of arrays to unzip
 * @param iteratee - Function to apply to unzipped groups
 * @returns Array of results from applying iteratee
 *
 * @example
 * unzipWith([[1, 10], [2, 20]], (a, b) => a + b); // returns [3, 30]
 * unzipWith([], (a, b) => a + b); // returns []
 */
export const unzipWith = <T extends unknown[], R>(
  array: readonly (readonly [...unknown[]])[],
  iteratee: (...args: T) => R,
): R[] => {
  if (!array || array.length === 0) return [];
  const unzipped = unzip(array as unknown[][]);
  return zipWith(iteratee, ...(unzipped as {[K in keyof T]: T[K][]}));
};

/**
 * Generates sliding windows of elements from an array.
 *
 * @param arr - The source array. Returns empty array if not an array.
 * @param size - Window size (positive integer). Returns empty array if invalid.
 * @param step - Step between windows (positive integer). Defaults to 1.
 * @param partial_windows - Include incomplete trailing windows. Defaults to false.
 * @returns Array of windows. Returns empty array for invalid inputs.
 *
 * @remarks
 * - Returns empty array if `arr` is not an array
 * - Returns empty array if `size` or `step` are non-positive or non-integers
 * - When `partial_windows` is false (default):
 *   - Returns empty array if `size > arr.length`
 *   - Only windows of exact `size` are included
 *   - Stops before incomplete trailing windows
 * - When `partial_windows` is true:
 *   - Allows windows smaller than `size` at array end
 *   - Processes until array start is exhausted
 */
export const windowed = <T>(
  arr: T[],
  size: number,
  step: number = 1,
  partial_windows: boolean = false,
): T[][] => {
  if (
    size <= 0 ||
    step <= 0 ||
    !Number.isInteger(size) ||
    !Number.isInteger(step)
  ) {
    return [];
  }

  const result: T[][] = [];
  const len = arr.length;

  for (let i = 0; i < len; i += step) {
    const chunk = arr.slice(i, i + size);
    if (!partial_windows && chunk.length < size) {
      break;
    }

    result.push(chunk);
  }

  return result;
};
