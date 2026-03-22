// ========================================
// ./src/Utils/Array/randomization.ts
// ========================================

/**
 * Returns a new array with elements randomly shuffled using Fisher-Yates algorithm
 * @template T - Array element type
 * @param {T[]} array - Input array to shuffle (will not be modified)
 * @returns {T[]} New shuffled array. Empty array returns empty array.
 */
export const shuffle = <T>(array: T[]): T[] => {
  const result_array = [...array];
  for (let i = result_array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result_array[i], result_array[j]] = [result_array[j], result_array[i]];
  }
  return result_array;
};

/**
 * Xorshift32 Pseudo-random number generator
 * A small, fast PRNG that provides deterministic sequences based on a seed.
 */
export class Xorshift32 {
  private seed_state: number;

  /**
   * @param {number} seed - Initial seed (must be a non-zero 32-bit integer)
   */
  constructor(seed: number) {
    // 种子不能为0，否则算法会卡死在0输出
    this.seed_state = seed === 0 ? 1 : seed >>> 0;
  }

  /**
   * Generates the next raw 32-bit unsigned integer
   * @returns {number} 32-bit unsigned integer
   */
  nextUint32(): number {
    let x = this.seed_state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.seed_state = x >>> 0; // 确保保持为无符号32位
    return this.seed_state;
  }

  /**
   * Returns a random float between [0, 1)
   * @returns {number}
   */
  nextFloat(): number {
    return this.nextUint32() / 4294967296;
  }
}

/**
 * Shuffles array in-place using Fisher-Yates algorithm
 * @template T - Array element type
 * @param {T[]} array - Array to shuffle (will be modified)
 * @returns {T[]} The same array reference, now shuffled. Empty array returns same empty array.
 */
export const shuffleInplace = <T>(array: T[]): T[] => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

/**
 * Returns a random element from array
 * @template T - Array element type
 * @param {T[]} collection - Input array
 * @returns {T | undefined} Random element, or undefined if array is empty
 */
export const sample = <T>(collection: T[]): T | undefined => {
  if (collection.length === 0) return undefined;
  const random_index = Math.floor(Math.random() * collection.length);
  return collection[random_index];
};

/**
 * Returns n random unique elements from array
 * @template T - Array element type
 * @param {T[]} collection - Input array (will not be modified)
 * @param {number} n - Number of elements to sample
 * @returns {T[]} Array of n random unique elements. Returns empty array if:
 * - Input array is empty
 * - n ≤ 0
 * - n > collection.length: returns shuffled copy of entire array
 */
export const sampleSize = <T>(collection: T[], n: number): T[] => {
  const actual_n = Math.max(0, Math.min(n, collection.length));
  if (actual_n === 0) return [];
  return shuffle(collection).slice(0, actual_n);
};

/**
 * Returns n random elements with replacement (duplicates possible)
 * @template T - Array element type
 * @param {T[]} collection - Input array
 * @param {number} n - Number of elements to pick
 * @returns {T[]} Array of n random elements. Returns empty array if:
 * - Input array is empty
 * - n ≤ 0
 */
export const choices = <T>(collection: T[], n: number): T[] => {
  if (collection.length === 0 || n <= 0) return [];
  const result_list: T[] = [];
  for (let i = 0; i < n; i++) result_list.push(sample(collection) as T);
  return result_list;
};

/**
 * Returns n random elements based on weights
 * @template T - Array element type
 * @param {T[]} collection - Input array
 * @param {number[]} weights - Corresponding weights for each element
 * @param {number} n - Number of elements to pick
 * @returns {T[]} Array of n random weighted elements. Returns empty array if:
 * - Input array is empty
 * - Weights array length doesn't match collection length
 * - n ≤ 0
 * @throws No explicit error, but will return empty array for invalid inputs
 */
export const weightedChoices = <T>(
  collection: T[],
  weights: number[],
  n: number,
): T[] => {
  if (
    collection.length === 0 ||
    collection.length !== weights.length ||
    n <= 0
  ) {
    return [];
  }

  const cumulative_weights: number[] = [];
  let total_weight = 0;
  for (const w of weights) {
    total_weight += w;
    cumulative_weights.push(total_weight);
  }

  const result: T[] = [];
  for (let i = 0; i < n; i++) {
    const target = Math.random() * total_weight;
    let low = 0;
    let high = cumulative_weights.length - 1;
    let index = high;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (cumulative_weights[mid] >= target) {
        index = mid;
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }
    result.push(collection[index]);
  }

  return result;
};
