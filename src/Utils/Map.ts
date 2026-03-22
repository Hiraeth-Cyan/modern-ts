// ============================================
// ./src/Utils/Map.ts
// ============================================

/**
 * Filters a Map, keeping only entries that satisfy the predicate
 *
 * @template K - Key type
 * @template V - Value type
 * @template S - Narrowed value type (when using type guard predicate)
 * @param map - Map to filter
 * @param predicate - Function that returns true to keep entry, false to remove
 * @returns New Map with filtered entries
 * @remarks If the predicate is a type guard, returns Map<K, S>, otherwise Map<K, V>
 * @example
 * ```typescript
 * const m = new Map([['a', 1], ['b', 2], ['c', 3]]);
 * filter(m, (v) => v > 1); // Map([['b', 2], ['c', 3]])
 * ```
 */
export function filter<K, V, S extends V>(
  map: Map<K, V>,
  predicate: (value: V, key: K) => value is S,
): Map<K, S>;
export function filter<K, V>(
  map: Map<K, V>,
  predicate: (value: V, key: K) => boolean,
): Map<K, V>;
export function filter<K, V>(
  map: Map<K, V>,
  predicate: (value: V, key: K) => boolean,
): Map<K, V> {
  const result = new Map<K, V>();
  for (const [key, value] of map) {
    if (predicate(value, key)) {
      result.set(key, value);
    }
  }
  return result;
}

/**
 * Creates a new Map with same keys but values transformed by iteratee
 *
 * @template K - Key type
 * @template V - Original value type
 * @template T - Transformed value type
 * @param map - Map to transform values of
 * @param iteratee - Function that transforms each value
 * @returns New Map with transformed values
 * @remarks Original Map is not modified
 * @example
 * ```typescript
 * const m = new Map([['a', 1], ['b', 2]]);
 * mapValues(m, v => v * 2); // Map([['a', 2], ['b', 4]])
 * ```
 */
export const mapValues = <K, V, T>(
  map: Map<K, V>,
  iteratee: (value: V, key: K) => T,
): Map<K, T> => {
  const result = new Map<K, T>();
  for (const [key, value] of map) {
    result.set(key, iteratee(value, key));
  }
  return result;
};

/**
 * Creates a new Map with same values but keys transformed by iteratee
 *
 * @template K - Original key type
 * @template V - Value type
 * @template T - Transformed key type
 * @param map - Map to transform keys of
 * @param iteratee - Function that transforms each key
 * @returns New Map with transformed keys
 * @remarks Duplicate transformed keys will overwrite previous entries
 * @example
 * ```typescript
 * const m = new Map([[1, 'a'], [2, 'b']]);
 * mapKeys(m, (v, k) => `key-${k}`); // Map([['key-1', 'a'], ['key-2', 'b']])
 * ```
 */
export const mapKeys = <K, V, T>(
  map: Map<K, V>,
  iteratee: (value: V, key: K) => T,
): Map<T, V> => {
  const result = new Map<T, V>();
  for (const [key, value] of map) {
    result.set(iteratee(value, key), value);
  }
  return result;
};

/**
 * Finds the first key that satisfies the predicate
 *
 * @template K - Key type
 * @template V - Value type
 * @param map - Map to search
 * @param predicate - Function that returns true for matching entry
 * @returns First matching key or undefined if none found
 * @remarks Iterates in insertion order, stops at first match
 * @example
 * ```typescript
 * const m = new Map([['a', 1], ['b', 2], ['c', 3]]);
 * findKey(m, v => v > 1); // 'b'
 * ```
 */
export const findKey = <K, V>(
  map: Map<K, V>,
  predicate: (value: V, key: K) => boolean,
): K | undefined => {
  for (const [key, value] of map) {
    if (predicate(value, key)) return key;
  }
  return undefined;
};

/**
 * Checks if Map contains a value matching target_value using comparator
 *
 * @template K - Key type
 * @template V - Value type
 * @param map - Map to search
 * @param target_value - Value to search for
 * @param comparator - Optional comparison function (defaults to ===)
 * @returns True if matching value found, false otherwise
 * @remarks Uses linear search, O(n) time
 * @example
 * ```typescript
 * const m = new Map([['a', {id: 1}], ['b', {id: 2}]]);
 * hasValue(m, {id: 1}, (a, b) => a.id === b.id); // true
 * ```
 */
export const hasValue = <K, V>(
  map: Map<K, V>,
  target_value: V,
  comparator: (a: V, b: V) => boolean = (a, b) => a === b,
): boolean => {
  for (const value of map.values()) {
    if (comparator(value, target_value)) return true;
  }
  return false;
};

/**
 * Reduces Map to a single value using iteratee function
 *
 * @template K - Key type
 * @template V - Value type
 * @template T - Accumulator type
 * @param map - Map to reduce
 * @param iteratee - Function that updates accumulator with each entry
 * @param initial_value - Starting accumulator value
 * @returns Final accumulator value
 * @remarks Iterates in insertion order
 * @example
 * ```typescript
 * const m = new Map([['a', 1], ['b', 2], ['c', 3]]);
 * reduce(m, (sum, v) => sum + v, 0); // 6
 * ```
 */
export const reduce = <K, V, T>(
  map: Map<K, V>,
  iteratee: (accumulator: T, value: V, key: K) => T,
  initial_value: T,
): T => {
  let accumulator = initial_value;
  for (const [key, value] of map) {
    accumulator = iteratee(accumulator, value, key);
  }
  return accumulator;
};

/**
 * Groups Map entries by key derived from iteratee and counts occurrences
 *
 * @template K - Key type
 * @template V - Value type
 * @param map - Map to analyze
 * @param iteratee - Function that returns grouping key (string or number)
 * @returns Object with grouping keys as properties and counts as values
 * @remarks Keys are coerced to string for object property access
 * @example
 * ```typescript
 * const m = new Map([['a', 1], ['b', 2], ['c', 1]]);
 * countBy(m, v => v); // {1: 2, 2: 1}
 * ```
 */
export const countBy = <K, V>(
  map: Map<K, V>,
  iteratee: (value: V, key: K) => string | number,
): Record<string | number, number> => {
  const result: Record<string | number, number> = {};
  for (const [key, value] of map) {
    const group_key = iteratee(value, key);
    result[group_key] = (result[group_key] || 0) + 1;
  }
  return result;
};

/**
 * Groups Map entries by key derived from iteratee
 *
 * @template K - Original key type
 * @template V - Value type
 * @template T - Grouping key type
 * @param map - Map to group
 * @param iteratee - Function that returns grouping key
 * @returns New Map with grouping keys and arrays of [K, V] entries
 * @remarks Each group contains original key-value pairs as arrays
 * @example
 * ```typescript
 * const m = new Map([['a', 1], ['b', 2], ['c', 1]]);
 * groupBy(m, v => v); // Map([[1, [['a', 1], ['c', 1]]], [2, [['b', 2]]]])
 * ```
 */
export const groupBy = <K, V, T>(
  map: Map<K, V>,
  iteratee: (value: V, key: K) => T,
): Map<T, Array<[K, V]>> => {
  const result = new Map<T, Array<[K, V]>>();
  for (const [key, value] of map) {
    const group_key = iteratee(value, key);
    let group = result.get(group_key);
    if (!group) {
      group = [];
      result.set(group_key, group);
    }
    group.push([key, value]);
  }
  return result;
};

/**
 * Creates new Map with only specified keys
 *
 * @template K - Key type
 * @template V - Value type
 * @param map - Map to pick from
 * @param keys - Iterable of keys to include
 * @returns New Map with selected keys
 * @remarks Keys not present in original Map are silently ignored
 * @example
 * ```typescript
 * const m = new Map([['a', 1], ['b', 2], ['c', 3]]);
 * pick(m, ['a', 'c']); // Map([['a', 1], ['c', 3]])
 * ```
 */
export const pick = <K, V>(map: Map<K, V>, keys: Iterable<K>): Map<K, V> => {
  const result = new Map<K, V>();
  for (const key of keys) {
    if (map.has(key)) {
      result.set(key, map.get(key)!);
    }
  }
  return result;
};

/**
 * Creates new Map without specified keys
 *
 * @template K - Key type
 * @template V - Value type
 * @param map - Map to omit from
 * @param keys - Iterable of keys to exclude
 * @returns New Map without specified keys
 * @remarks Keys not present in original Map are silently ignored
 * @example
 * ```typescript
 * const m = new Map([['a', 1], ['b', 2], ['c', 3]]);
 * omit(m, ['b']); // Map([['a', 1], ['c', 3]])
 * ```
 */
export const omit = <K, V>(map: Map<K, V>, keys: Iterable<K>): Map<K, V> => {
  const result = new Map(map);
  const keys_to_delete = keys instanceof Set ? keys : new Set(keys);
  for (const key of keys_to_delete) {
    result.delete(key as K);
  }
  return result;
};

/**
 * Filters Map in-place, removing entries that don't satisfy predicate
 *
 * @template K - Key type
 * @template V - Value type
 * @param map - Map to filter (modified in-place)
 * @param predicate - Function that returns true to keep entry
 * @returns Same Map instance (mutated)
 * @remarks Modifies original Map, use filter() for immutable operation
 * @example
 * ```typescript
 * const m = new Map([['a', 1], ['b', 2], ['c', 3]]);
 * filterInPlace(m, v => v > 1); // m is now Map([['b', 2], ['c', 3]])
 * ```
 */
export const filterInPlace = <K, V>(
  map: Map<K, V>,
  predicate: (value: V, key: K) => boolean,
): Map<K, V> => {
  for (const [key, value] of map) {
    if (!predicate(value, key)) {
      map.delete(key);
    }
  }
  return map;
};

/**
 * Transforms Map values in-place
 *
 * @template K - Key type
 * @template V - Value type
 * @param map - Map to transform (modified in-place)
 * @param iteratee - Function that transforms each value
 * @returns Same Map instance (mutated)
 * @remarks Modifies original Map, use mapValues() for immutable operation
 * @example
 * ```typescript
 * const m = new Map([['a', 1], ['b', 2]]);
 * mapValuesInPlace(m, v => v * 2); // m is now Map([['a', 2], ['b', 4]])
 * ```
 */
export const mapValuesInPlace = <K, V>(
  map: Map<K, V>,
  iteratee: (value: V, key: K) => V,
): Map<K, V> => {
  for (const [key, value] of map) {
    map.set(key, iteratee(value, key));
  }
  return map;
};

/**
 * Removes specified keys from Map in-place
 *
 * @template K - Key type
 * @template V - Value type
 * @param map - Map to modify (modified in-place)
 * @param keys - Iterable of keys to remove
 * @returns Same Map instance (mutated)
 * @remarks Modifies original Map, use omit() for immutable operation
 * @example
 * ```typescript
 * const m = new Map([['a', 1], ['b', 2], ['c', 3]]);
 * omitInPlace(m, ['b']); // m is now Map([['a', 1], ['c', 3]])
 * ```
 */
export const omitInPlace = <K, V>(
  map: Map<K, V>,
  keys: Iterable<K>,
): Map<K, V> => {
  for (const key of keys) {
    map.delete(key);
  }
  return map;
};

/**
 * Keeps only specified keys in Map in-place
 *
 * @template K - Key type
 * @template V - Value type
 * @param map - Map to modify (modified in-place)
 * @param keys - Iterable of keys to keep
 * @returns Same Map instance (mutated)
 * @remarks Modifies original Map, use pick() for immutable operation
 * @example
 * ```typescript
 * const m = new Map([['a', 1], ['b', 2], ['c', 3]]);
 * pickInPlace(m, ['a', 'c']); // m is now Map([['a', 1], ['c', 3]])
 * ```
 */
export const pickInPlace = <K, V>(
  map: Map<K, V>,
  keys: Iterable<K>,
): Map<K, V> => {
  const keep_set = keys instanceof Set ? keys : new Set(keys);
  for (const key of map.keys()) {
    if (!keep_set.has(key)) {
      map.delete(key);
    }
  }
  return map;
};

/**
 * Merges source Map into target Map in-place
 *
 * @template K - Key type
 * @template V - Value type
 * @param target - Map to merge into (modified in-place)
 * @param source - Map to merge from
 * @param resolve_conflict - Function to resolve key conflicts (default: source wins)
 * @returns Same target Map instance (mutated)
 * @remarks Modifies target Map, source Map is not modified
 * @example
 * ```typescript
 * const t = new Map([['a', 1], ['b', 2]]);
 * const s = new Map([['b', 20], ['c', 3]]);
 * mergeInPlace(t, s); // t is now Map([['a', 1], ['b', 20], ['c', 3]])
 * ```
 */
export const mergeInPlace = <K, V>(
  target: Map<K, V>,
  source: Map<K, V>,
  resolve_conflict: (target_val: V, source_val: V, key: K) => V = (_t, s) => s,
): Map<K, V> => {
  for (const [key, value] of source) {
    if (target.has(key)) {
      target.set(key, resolve_conflict(target.get(key)!, value, key));
    } else {
      target.set(key, value);
    }
  }
  return target;
};

/**
 * Gets value for key, setting it with default_factory if not present
 *
 * @template K - Key type
 * @template V - Value type
 * @param map - Map to access (modified in-place if key missing)
 * @param key - Key to get/set
 * @param default_factory - Function that creates default value when key missing
 * @returns Existing value or newly created default value
 * @remarks Modifies Map if key was not present (lazy initialization)
 * @example
 * ```typescript
 * const m = new Map([['a', 1]]);
 * getOrSetInPlace(m, 'b', () => 100); // Returns 100, m now has 'b': 100
 * ```
 */
export const getOrSetInPlace = <K, V>(
  map: Map<K, V>,
  key: K,
  default_factory: (key: K) => V,
): V => {
  if (map.has(key)) {
    return map.get(key)!;
  }
  const new_value = default_factory(key);
  map.set(key, new_value);
  return new_value;
};

/**
 * Updates value for key using updater function
 *
 * @template K - Key type
 * @template V - Value type
 * @param map - Map to update (modified in-place)
 * @param key - Key to update
 * @param updater - Function that receives current value (or undefined) and returns new value
 * @returns Same Map instance (mutated)
 * @remarks Always sets the key, even if updater returns undefined (as value)
 * @example
 * ```typescript
 * const m = new Map([['a', 1]]);
 * updateInPlace(m, 'a', v => v ? v + 1 : 0); // m is now Map([['a', 2]])
 * ```
 */
export const updateInPlace = <K, V>(
  map: Map<K, V>,
  key: K,
  updater: (value: V | undefined, key: K) => V,
): Map<K, V> => {
  const current_value = map.get(key);
  const next_value = updater(current_value, key);
  map.set(key, next_value);
  return map;
};
