// ========================================
// ./src/Utils/Array/filtering.ts
// ========================================

/**
 * Filters out falsy values: false, null, undefined, '', 0. Returns new array.
 * Preserves truthy values including objects, arrays, and other non-falsy primitives.
 * @param array - Source array
 * @returns New array without falsy values
 */
export const compact = <T>(
  array: T[],
): Array<Exclude<T, false | null | undefined | '' | 0>> => {
  return array.filter(
    (val): val is Exclude<T, false | null | undefined | '' | 0> => Boolean(val),
  );
};

/**
 * Filters out null and undefined values. Returns new array.
 * Preserves all other values including falsy values like 0, false, ''.
 * @param array - Source array
 * @returns New array without null/undefined
 */
export const nonNullable = <T>(array: T[]): Array<NonNullable<T>> => {
  return array.filter(
    (val): val is NonNullable<T> => val !== null && val !== undefined,
  );
};

/**
 * Returns new array without specified values. Uses Set for O(1) lookups.
 * Preserves original order and empty slots. Original array unchanged.
 * @param arr - Source array
 * @param values - Values to exclude
 * @returns New filtered array
 */
export const without = <T>(arr: T[], ...values: T[]) => {
  const cache = new Set(values);
  return arr.filter((item) => !cache.has(item));
};

/**
 * Removes all specified values in-place. Returns mutated original array.
 * Uses two-pointer algorithm, O(n) time, O(k) space for value Set.
 * Preserves order of remaining elements.
 * @param arr - Array to modify (mutated)
 * @param values - Values to remove
 * @returns Mutated original array
 */
export const pull = <T>(arr: T[], ...values: T[]): T[] => {
  const cache = new Set(values);
  let write_idx = 0;
  for (let read_idx = 0; read_idx < arr.length; read_idx++) {
    if (!cache.has(arr[read_idx])) {
      arr[write_idx] = arr[read_idx];
      write_idx++;
    }
  }
  arr.length = write_idx;
  return arr;
};

/**
 * Removes elements at specified indices in-place. Returns array of removed elements.
 * Invalid indices and duplicates are ignored. Preserves order in both removed and remaining elements.
 * Returns empty array if source array empty or no valid indices provided.
 * @param arr - Array to modify (mutated)
 * @param indexes - Indices to remove (negative indices not supported)
 * @returns Array of removed elements
 */
export const pullAt = <T>(arr: T[], indexes: number[]): T[] => {
  if (!arr.length || !indexes.length) return [];
  const unique_indexes = new Set<number>();

  const valid_indexes: number[] = [];
  for (const i of indexes) {
    if (i >= 0 && i < arr.length && !unique_indexes.has(i)) {
      unique_indexes.add(i);
      valid_indexes.push(i);
    }
  }

  if (!valid_indexes.length) return [];
  const result = valid_indexes.map((i) => arr[i]);

  const delete_set = new Set(valid_indexes);
  let write_idx = 0;

  for (let read_idx = 0; read_idx < arr.length; read_idx++)
    if (!delete_set.has(read_idx)) arr[write_idx++] = arr[read_idx];

  arr.length = write_idx;
  return result;
};

/**
 * Special symbol used in `remove` function to indicate sparse array holes should be preserved.
 * Return this symbol from the `on_hole` callback to keep the hole in the resulting array.
 */
export const KEEP_HOLE = Symbol('Keep hole');

/**
 * Removes elements matching predicate in-place. Returns array of removed elements.
 * Handles sparse arrays: on_hole callback determines hole behavior (keep, fill, or skip).
 * KEEP_HOLE symbol preserves holes, undefined skips, any other value fills the position.
 * @param array - Array to modify (mutated)
 * @param predicate - Removal condition function
 * @param on_hole - Callback for sparse positions (optional)
 * @returns Array of removed elements
 */
export const remove = <T, R = T>(
  array: T[],
  predicate: (val: T, index: number) => boolean,
  on_hole?: (index: number) => R | typeof KEEP_HOLE | undefined,
): T[] => {
  const removed: T[] = [];
  let slow = 0;

  for (let fast = 0; fast < array.length; fast++) {
    if (!(fast in array)) {
      const action = on_hole ? on_hole(fast) : KEEP_HOLE;

      if (action === KEEP_HOLE) {
        // eslint-disable-next-line @typescript-eslint/no-array-delete
        delete array[slow++];
      } else if (action !== undefined) {
        (array as (T | R)[])[slow++] = action;
      }
      continue;
    }

    const element = array[fast];
    if (predicate(element, fast)) {
      removed.push(element);
    } else {
      if (slow !== fast) array[slow] = element;
      slow++;
    }
  }

  array.length = slow;
  return removed;
};

/**
 * Creates a duplicate-free version of an array using strict equality (`===`) for comparisons.
 * Preserves the first occurrence of each value. Maintains the relative order of first occurrences.
 * @template T - Array element type
 * @param array - The array to inspect
 * @returns Returns the new duplicate-free array
 * @example
 * ```ts
 * uniq([2, 1, 2, 3]) // => [2, 1, 3]
 * ```
 */
export const uniq = <T>(array: T[]): T[] => {
  return [...new Set(array)];
};

/**
 * Creates a duplicate-free array by computing a transformation for each element.
 * Uniqueness is determined by the result of `iteratee`. Preserves the first occurrence where the computed value appears. Maintains relative order.
 * @template T - Array element type
 * @param array - The array to inspect
 * @param iteratee - The function to transform elements
 * @returns Returns the new duplicate-free array
 * @example
 * ```ts
 * uniqBy([{x:1}, {x:2}, {x:1}], o => o.x) // => [{x:1}, {x:2}]
 * ```
 */
export const uniqBy = <T>(array: T[], iteratee: (value: T) => unknown): T[] => {
  const seen = new Set();
  return array.filter((item) => {
    const computed = iteratee(item);
    if (seen.has(computed)) {
      return false;
    }
    seen.add(computed);
    return true;
  });
};

/**
 * Creates a duplicate-free array using a custom comparator function.
 * Uniqueness is determined by the `comparator` returning `true` for any pair. Preserves the first occurrence. Performs O(n²) comparisons in worst case. Maintains relative order.
 * @template T - Array element type
 * @param array - The array to inspect
 * @param comparator - The function to compare elements (should return `true` for equality)
 * @returns Returns the new duplicate-free array
 */
export const uniqWith = <T>(
  array: T[],
  comparator: (a: T, b: T) => boolean,
): T[] => {
  const result: T[] = [];

  for (const item of array) {
    const is_duplicate = result.some((existing) => comparator(existing, item));
    if (!is_duplicate) {
      result.push(item);
    }
  }

  return result;
};
