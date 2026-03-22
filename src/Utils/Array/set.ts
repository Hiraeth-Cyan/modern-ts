// ========================================
// ./src/Utils/Array/set.ts
// ========================================

type Comparator<T> = (a: T, b: T) => boolean;
type Iteratee<T, V> = (value: T) => V;

// ========================================
// 差集
// ========================================

/**
 * Returns the difference between two arrays (elements in array1 but not in array2)
 * @param array - The source array
 * @param values - Arrays to exclude values from
 * @returns Array containing elements present only in the first array
 */
export const difference = <T>(
  array: readonly T[],
  ...values: (readonly T[])[]
): T[] => {
  const restSet = new Set(values.flat());
  return array.filter((item) => !restSet.has(item));
};

/**
 * Returns the difference between arrays using an iteratee function
 * @param array - The source array
 * @param values - Array to exclude values from
 * @param iteratee - Function to transform values before comparison
 * @returns Array containing elements with unique transformed values
 */
export const differenceBy = <T, V>(
  array: readonly T[],
  values: readonly T[],
  iteratee: Iteratee<T, V>,
): T[] => {
  const restSet = new Set(values.map(iteratee));
  return array.filter((item) => !restSet.has(iteratee(item)));
};

/**
 * Returns the difference between arrays using a comparator function
 * @param array - The source array
 * @param values - Array to exclude values from
 * @param comparator - Function to compare two elements
 * @returns Array containing elements not matching any in values
 */
export const differenceWith = <T>(
  array: readonly T[],
  values: readonly T[],
  comparator: Comparator<T>,
): T[] => {
  return array.filter((a) => !values.some((b) => comparator(a, b)));
};

// ========================================
// 交集
// ========================================

/**
 * Returns the intersection of multiple arrays
 * @param arrays - Arrays to find common elements from
 * @returns Array containing elements present in all arrays
 */
export const intersection = <T>(...arrays: (readonly T[])[]): T[] => {
  if (arrays.length === 0) return [];
  if (arrays.length === 1) return [...arrays[0]];

  // 找到最短的数组作为基准
  const shortest = arrays.reduce((a, b) => (a.length < b.length ? a : b));
  // 将其他数组预处理成 Set
  const otherSets = arrays.filter((a) => a !== shortest).map((a) => new Set(a));

  return shortest.filter((item) => otherSets.every((set) => set.has(item)));
};

/**
 * Returns the intersection of two arrays using an iteratee function
 * @param array1 - First array
 * @param array2 - Second array
 * @param iteratee - Function to transform values before comparison
 * @returns Array containing elements with matching transformed values
 */
export const intersectionBy = <T, V>(
  array1: readonly T[],
  array2: readonly T[],
  iteratee: Iteratee<T, V>,
): T[] => {
  const set2 = new Set(array2.map(iteratee));
  return array1.filter((item) => set2.has(iteratee(item)));
};

/**
 * Returns the intersection of two arrays using a comparator function
 * @param array1 - First array
 * @param array2 - Second array
 * @param comparator - Function to compare two elements
 * @returns Array containing elements matching at least one in both arrays
 */
export const intersectionWith = <T>(
  array1: readonly T[],
  array2: readonly T[],
  comparator: Comparator<T>,
): T[] => {
  return array1.filter((a) => array2.some((b) => comparator(a, b)));
};

// ========================================
// 并集
// ========================================

/**
 * Returns the union of multiple arrays
 * @param arrays - Arrays to combine
 * @returns Array containing unique elements from all arrays
 */
export const union = <T>(...arrays: (readonly T[])[]): T[] => {
  return Array.from(new Set(arrays.flat()));
};

/**
 * Returns the union of two arrays using an iteratee function
 * @param array1 - First array
 * @param array2 - Second array
 * @param iteratee - Function to transform values before deduplication
 * @returns Array containing unique elements based on transformed values
 */
export const unionBy = <T, V>(
  array1: readonly T[],
  array2: readonly T[],
  iteratee: Iteratee<T, V>,
): T[] => {
  const map = new Map<V, T>();
  [...array1, ...array2].forEach((item) => {
    const key = iteratee(item);
    if (!map.has(key)) map.set(key, item);
  });
  return Array.from(map.values());
};

/**
 * Returns the union of two arrays using a comparator function
 * @param array1 - First array
 * @param array2 - Second array
 * @param comparator - Function to determine equality between elements
 * @returns Array containing elements considered unique by the comparator
 */
export const unionWith = <T>(
  array1: readonly T[],
  array2: readonly T[],
  comparator: Comparator<T>,
): T[] => {
  const result = [...array1];
  for (const item of array2) {
    if (!result.some((r) => comparator(r, item))) {
      result.push(item);
    }
  }
  return result;
};

// ========================================
// 对称差集
// ========================================

/**
 * Returns the symmetric difference between two arrays
 * @param array1 - First array
 * @param array2 - Second array
 * @returns Array containing elements present in only one of the arrays
 */
export const xor = <T>(array1: readonly T[], array2: readonly T[]): T[] => {
  return [...difference(array1, array2), ...difference(array2, array1)];
};

/**
 * Returns the symmetric difference using an iteratee function
 * @param array1 - First array
 * @param array2 - Second array
 * @param iteratee - Function to transform values before comparison
 * @returns Array containing elements with unique transformed values
 */
export const xorBy = <T, V>(
  array1: readonly T[],
  array2: readonly T[],
  iteratee: Iteratee<T, V>,
): T[] => {
  return [
    ...differenceBy(array1, array2, iteratee),
    ...differenceBy(array2, array1, iteratee),
  ];
};

/**
 * Returns the symmetric difference using a comparator function
 * @param array1 - First array
 * @param array2 - Second array
 * @param comparator - Function to compare two elements
 * @returns Array containing elements not matching any in the other array
 */
export const xorWith = <T>(
  array1: readonly T[],
  array2: readonly T[],
  comparator: Comparator<T>,
): T[] => {
  return [
    ...differenceWith(array1, array2, comparator),
    ...differenceWith(array2, array1, comparator),
  ];
};

// ========================================
// 子集判断
// ========================================

/**
 * Checks if one array is a subset of another
 * @param subset - Array to check as subset
 * @param superset - Array to check as superset
 * @returns True if all elements of subset exist in superset
 */
export const isSubset = <T>(
  subset: readonly T[],
  superset: readonly T[],
): boolean => {
  const superSetObj = new Set(superset);
  return subset.every((item) => superSetObj.has(item));
};

/**
 * Checks if one array is a subset of another using a comparator
 * @param subset - Array to check as subset
 * @param superset - Array to check as superset
 * @param comparator - Function to compare two elements
 * @returns True if all elements of subset have matches in superset
 */
export const isSubsetWith = <T>(
  subset: readonly T[],
  superset: readonly T[],
  comparator: Comparator<T>,
): boolean => {
  return subset.every((subItem) =>
    superset.some((superItem) => comparator(subItem, superItem)),
  );
};
