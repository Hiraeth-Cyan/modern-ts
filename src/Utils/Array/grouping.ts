// ========================================
// ./src/Utils/Array/grouping.ts
// ========================================

/**
 * Groups array items by a computed key. Keys are converted to strings -
 * distinct original keys that stringify to the same value will merge groups.
 * @param list Array to group
 * @param keyGetter Function extracting grouping key from each item
 * @returns Object with stringified keys mapping to arrays of grouped items
 */
export const groupBy = <T, K extends string | number | boolean>(
  list: readonly T[],
  keyGetter: (item: T) => K,
): Record<string | number, T[]> => {
  return list.reduce<Record<string | number, T[]>>(
    (acc, item) => {
      const rawKey = keyGetter(item);
      const key = String(rawKey);

      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(item);
      return acc;
    },
    {} as Record<string | number, T[]>,
  );
};

/**
 * Creates object lookup by computed key. Last item wins for duplicate keys
 * after string conversion. Returns empty object for empty array.
 * @param list Array to index
 * @param keyGetter Function extracting key from each item
 * @returns Object with stringified keys mapping to the last corresponding item
 */
export const keyBy = <T, K extends string | number | boolean>(
  list: readonly T[],
  keyGetter: (item: T) => K,
): Record<string | number, T> => {
  return list.reduce<Record<string | number, T>>(
    (acc, item) => {
      const key = String(keyGetter(item));
      acc[key] = item;
      return acc;
    },
    {} as Record<string | number, T>,
  );
};

/**
 * Splits array into two groups based on predicate. Always returns tuple of
 * two arrays (truthy group first). Both arrays are empty for empty input.
 * @param list Array to partition
 * @param predicate Filtering function
 * @returns Tuple where first array contains items satisfying predicate
 */
export const partition = <T>(
  list: readonly T[],
  predicate: (item: T) => boolean,
): [T[], T[]] => {
  return list.reduce(
    (acc, item) => {
      acc[predicate(item) ? 0 : 1].push(item);
      return acc;
    },
    [[], []] as [T[], T[]],
  );
};

/**
 * Splits an array into chunks of the specified size. Returns an empty array
 * if the input array is empty or chunk size is zero. Negative sizes are
 * treated as zero. The final chunk may be smaller than the specified size.
 *
 * @param array - The array to process
 * @param size - The length of each chunk (default: 1)
 * @returns A new array of chunks
 */
export const chunk = <T>(array: readonly T[], size: number = 1): T[][] => {
  const chunk_size = Math.max(Math.floor(size), 0);
  const array_length = array.length;
  if (array_length === 0 || chunk_size === 0) return [];

  const result: T[][] = [];
  for (let i = 0; i < array_length; i += chunk_size) {
    result.push(array.slice(i, i + chunk_size));
  }
  return result;
};

/**
 * Creates an object composed of keys generated from iteratee results,
 * with corresponding values counting their occurrences in the array.
 * String and number keys are supported; other types will be coerced to strings.
 *
 * @param array - The array to iterate over
 * @param iteratee - The function to generate keys from elements
 * @returns An object with keys and their counts
 */
export const countBy = <T>(
  array: readonly T[],
  iteratee: (value: T) => string | number,
): Record<string, number> => {
  const result: Record<string, number> = {};
  for (const item of array) {
    const key = iteratee(item);
    if (result[key]) {
      result[key]++;
    } else {
      result[key] = 1;
    }
  }
  return result;
};
