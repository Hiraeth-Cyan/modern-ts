// ============================================
// ./src/Utils/Set.ts
// ============================================

/**
 * Creates a new set containing only values that satisfy the predicate
 * @remarks Type-safe overload supports type narrowing via type guards
 * @param set - The source set to filter
 * @param predicate - Function returning true for values to include
 * @returns New set containing filtered values
 * @throws {TypeError} If predicate is not a function
 */
export function filter<T, S extends T>(
  set: Set<T>,
  predicate: (value: T) => value is S,
): Set<S>;
export function filter<T>(
  set: Set<T>,
  predicate: (value: T) => boolean,
): Set<T>;
export function filter<T>(
  set: Set<T>,
  predicate: (value: T) => boolean,
): Set<T> {
  const result_set = new Set<T>();
  for (const value of set) {
    if (predicate(value)) {
      result_set.add(value);
    }
  }
  return result_set;
}

/**
 * Creates a new set by transforming each value
 * @remarks Duplicate transformed values are deduplicated in the result set
 * @param set - Source set to map
 * @param iteratee - Transformation function
 * @returns New set with transformed values
 * @throws {TypeError} If iteratee is not a function
 */
export const map = <T, U>(set: Set<T>, iteratee: (value: T) => U): Set<U> => {
  const result_set = new Set<U>();
  for (const value of set) {
    result_set.add(iteratee(value));
  }
  return result_set;
};

/**
 * Accumulates values into a single result
 * @remarks Iteration order follows set iteration order
 * @param set - Source set to reduce
 * @param iteratee - Accumulator function
 * @param initial_value - Starting value for accumulation
 * @returns Final accumulated value
 */
export const reduce = <T, U>(
  set: Set<T>,
  iteratee: (accumulator: U, value: T) => U,
  initial_value: U,
): U => {
  let accumulator = initial_value;
  for (const value of set) {
    accumulator = iteratee(accumulator, value);
  }
  return accumulator;
};

/**
 * Counts occurrences of values grouped by key
 * @remarks Keys are coerced to strings for object property access
 * @param set - Source set to count
 * @param iteratee - Function returning grouping key
 * @returns Object mapping keys to counts
 */
export const countBy = <T>(
  set: Set<T>,
  iteratee: (value: T) => string | number,
): Record<string | number, number> => {
  const result: Record<string | number, number> = {};
  for (const value of set) {
    const group_key = iteratee(value);
    result[group_key] = (result[group_key] || 0) + 1;
  }
  return result;
};

/**
 * Groups values into a map by key
 * @remarks Original values are preserved in arrays
 * @param set - Source set to group
 * @param iteratee - Function returning grouping key
 * @returns Map from keys to arrays of values
 */
export const groupBy = <T, G>(
  set: Set<T>,
  iteratee: (value: T) => G,
): Map<G, T[]> => {
  const result_map = new Map<G, T[]>();
  for (const value of set) {
    const group_key = iteratee(value);
    let group = result_map.get(group_key);
    if (!group) {
      group = [];
      result_map.set(group_key, group);
    }
    group.push(value);
  }
  return result_map;
};

/**
 * Removes values that don't satisfy predicate from the original set
 * @remarks Mutates the input set and returns it for chaining
 * @param set - Set to filter in place
 * @param predicate - Function returning true to keep value
 * @returns The same set instance after mutation
 * @throws {TypeError} If predicate is not a function
 */
export const filterInPlace = <T>(
  set: Set<T>,
  predicate: (value: T) => boolean,
): Set<T> => {
  for (const value of set) {
    if (!predicate(value)) {
      set.delete(value);
    }
  }
  return set;
};

/**
 * Adds all values from an iterable to the target set
 * @remarks Mutates target set, duplicate values are ignored
 * @param target - Set to modify
 * @param other - Iterable containing values to add
 * @returns The mutated target set
 */
export const unionInPlace = <T>(target: Set<T>, other: Iterable<T>): Set<T> => {
  for (const value of other) {
    target.add(value);
  }
  return target;
};

/**
 * Removes values from target that aren't present in the other iterable
 * @remarks Mutates target set. For non-Set iterables, creates temporary Set.
 * @param target - Set to modify
 * @param other - Iterable containing allowed values
 * @returns The mutated target set
 */
export const intersectInPlace = <T>(
  target: Set<T>,
  other: Iterable<T>,
): Set<T> => {
  const other_set = other instanceof Set ? other : new Set(other);
  for (const value of target) {
    if (!other_set.has(value)) {
      target.delete(value);
    }
  }
  return target;
};

/**
 * Removes values present in the other iterable from the target set
 * @remarks Mutates target set. Values not in target are ignored.
 * @param target - Set to modify
 * @param other - Iterable containing values to remove
 * @returns The mutated target set
 */
export const differenceInPlace = <T>(
  target: Set<T>,
  other: Iterable<T>,
): Set<T> => {
  for (const value of other) {
    target.delete(value);
  }
  return target;
};
export const subtractInPlace = differenceInPlace;

/**
 * Tests if at least one value satisfies the predicate
 * @remarks Short-circuits on first match. Empty sets return false.
 * @param set - Set to test
 * @param predicate - Test function
 * @returns True if predicate returns true for any value
 * @throws {TypeError} If predicate is not a function
 */
export const some = <T>(
  set: Set<T>,
  predicate: (value: T) => boolean,
): boolean => {
  for (const value of set) {
    if (predicate(value)) return true;
  }
  return false;
};

/**
 * Tests if all values satisfy the predicate
 * @remarks Short-circuits on first failure. Empty sets return true.
 * @param set - Set to test
 * @param predicate - Test function
 * @returns True if predicate returns true for all values
 * @throws {TypeError} If predicate is not a function
 */
export const every = <T>(
  set: Set<T>,
  predicate: (value: T) => boolean,
): boolean => {
  for (const value of set) {
    if (!predicate(value)) return false;
  }
  return true;
};

/**
 * Finds the first value that satisfies the predicate
 * @remarks Iteration order follows set iteration order
 * @param set - Set to search
 * @param predicate - Test function
 * @returns The first matching value, or undefined if none found
 * @throws {TypeError} If predicate is not a function
 */
export const find = <T>(
  set: Set<T>,
  predicate: (value: T) => boolean,
): T | undefined => {
  for (const value of set) {
    if (predicate(value)) return value;
  }
  return undefined;
};
