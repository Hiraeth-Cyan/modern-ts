// ========================================
// ./src/Utils/Object/base.ts
// ========================================

import {isPlainObject} from '../Predicates';
import {camelCase, snakeCase} from '../String';

/**
 * Transforms object keys using a mapper function.
 * @template T - Object type
 * @param obj - Source object
 * @param fn - Function that receives (value, key) and returns new key name
 * @returns New object with transformed keys (original values preserved)
 * @remarks If fn returns duplicate keys, later entries will overwrite earlier ones
 */
export const mapKeys = <T extends Record<string, unknown>>(
  obj: T,
  fn: (value: T[keyof T], key: keyof T) => string,
): Record<string, T[keyof T]> => {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [
      fn(v as T[keyof T], k as keyof T),
      v as T[keyof T],
    ]),
  ) as Record<string, T[keyof T]>;
};

/**
 * Transforms object values while preserving keys.
 * @template T - Source object type
 * @template V - Transformed value type
 * @param obj - Source object
 * @param fn - Function that receives (value, key) and returns new value
 * @returns New object with same keys but transformed values
 */
export const mapValues = <T extends Record<string, unknown>, V>(
  obj: T,
  fn: (value: T[keyof T], key: keyof T) => V,
): Record<keyof T, V> => {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, fn(v as T[keyof T], k as keyof T)]),
  ) as Record<keyof T, V>;
};

/**
 * Swaps object keys and values.
 * @template T - Object with string/number values
 * @param obj - Source object (values must be string or number)
 * @returns New object with keys and values swapped
 * @remarks Duplicate values in source will cause later keys to overwrite earlier ones
 */
export const invert = <T extends Record<string, string | number>>(
  obj: T,
): Record<string, keyof T> => {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [v, k as keyof T]),
  );
};

/**
 * Creates new object with only specified keys.
 * @template T - Source object type
 * @template K - Selected keys
 * @param obj - Source object
 * @param keys - Array of keys to include
 * @returns New object containing only specified keys
 * @remarks Keys not present in source object are silently ignored
 */
export const pick = <T extends object, K extends keyof T>(
  obj: T,
  keys: K[],
): Pick<T, K> => {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  return result;
};

/**
 * Creates new object with keys satisfying predicate.
 * @template T - Source object type
 * @param obj - Source object
 * @param predicate - Function that receives (value, key) and returns boolean
 * @returns Partial object containing only entries where predicate returns true
 */
export const pickBy = <T extends Record<PropertyKey, unknown>>(
  obj: T,
  predicate: (value: T[keyof T], key: keyof T) => boolean,
): Partial<T> => {
  return Object.fromEntries(
    Object.entries(obj).filter(([key, value]) =>
      predicate(value as T[keyof T], key as keyof T),
    ),
  ) as Partial<T>;
};

/**
 * Creates new object excluding specified keys.
 * @template T - Source object type
 * @template K - Keys to exclude
 * @param obj - Source object
 * @param keys - Array of keys to exclude
 * @returns New object without specified keys
 * @remarks Non-enumerable properties are not included in result
 */
export const omit = <T extends object, K extends keyof T>(
  obj: T,
  keys: K[],
): Omit<T, K> => {
  const result = {} as Omit<T, K>;
  const skipSet = new Set<PropertyKey>(keys);

  for (const key of Object.keys(obj)) {
    if (!skipSet.has(key)) {
      (result as T)[key as keyof T] = obj[key as keyof T];
    }
  }

  return result;
};

/**
 * Creates new object excluding keys where predicate returns true.
 * @template T - Source object type
 * @param obj - Source object
 * @param predicate - Function that receives (value, key) and returns boolean
 * @returns Partial object excluding entries where predicate returns true
 */
export const omitBy = <T extends Record<PropertyKey, unknown>>(
  obj: T,
  predicate: (value: T[keyof T], key: keyof T) => boolean,
): Partial<T> => {
  return Object.fromEntries(
    Object.entries(obj).filter(
      ([key, value]) => !predicate(value as T[keyof T], key as keyof T),
    ),
  ) as Partial<T>;
};

/**
 * Finds first key where predicate returns true.
 * @template T - Source object type
 * @param obj - Source object
 * @param fn - Function that receives (value, key) and returns boolean
 * @returns First matching key, or undefined if none found
 * @remarks Only checks own enumerable properties
 */
export const findKey = <T extends object>(
  obj: T,
  fn: (value: T[keyof T], key: keyof T) => boolean,
): keyof T | undefined => {
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      if (fn(obj[key as keyof T], key as keyof T)) {
        return key as keyof T;
      }
    }
  }
  return undefined;
};

/** Symbol indicating merge should skip current property */
export const MERGE_SKIP = Symbol('Merge skip');
/** Symbol indicating merge should use default logic for current property */
export const MERGE_DEFAULT = Symbol('Merge default');

/**
 * Customizer function type for mergeWith.
 * @returns New value, MERGE_SKIP to skip, or MERGE_DEFAULT for default logic
 */
type MergeCustomizer = (
  target_value: unknown,
  source_value: unknown,
  key: string,
  target: unknown,
  source: unknown,
) => unknown;

/**
 * Internal merge implementation.
 * @template T - Target object type
 * @param target - Target object (will be mutated)
 * @param customizer - Optional customizer function
 * @param sources - Source objects to merge
 * @returns Mutated target object
 * @remarks Performs deep merge for plain objects, overwrites other values
 */
export const internalMerge = <T extends Record<string, unknown>>(
  target: T,
  customizer: MergeCustomizer | undefined,
  ...sources: Record<string, unknown>[]
): T => {
  if (!sources.length) return target;

  for (const source of sources) {
    const stack: [Record<string, unknown>, Record<string, unknown>][] = [
      [target, source],
    ];

    while (stack.length > 0) {
      const [currTarget, currSource] = stack.pop()!;

      for (const key in currSource) {
        if (Object.prototype.hasOwnProperty.call(currSource, key)) {
          const sourceValue = currSource[key];
          const targetValue = currTarget[key];
          const result = sourceValue;

          // Execute customizer first if provided
          if (customizer) {
            const customResult = customizer(
              targetValue,
              sourceValue,
              key,
              currTarget,
              currSource,
            );
            if (customResult !== MERGE_DEFAULT) {
              if (customResult !== MERGE_SKIP) currTarget[key] = customResult;
              continue;
            }
          }

          // Default merge logic
          if (isPlainObject(result)) {
            if (!isPlainObject(targetValue)) {
              currTarget[key] = {};
            }
            stack.push([currTarget[key] as Record<string, unknown>, result]);
          } else {
            currTarget[key] = result;
          }
        }
      }
    }
  }

  return target;
};

/**
 * Deep merges source objects into target.
 * @template T - Target object type
 * @param target - Target object (will be cloned)
 * @param sources - Source objects to merge
 * @returns New deeply merged object (target is not mutated)
 * @remarks Uses structuredClone for deep cloning target
 */
export const merge = <T extends Record<string, unknown>>(
  target: T,
  ...sources: Record<string, unknown>[]
): T => internalMerge(structuredClone(target), undefined, ...sources);

/**
 * Deep merges with customizer function.
 * @template T - Target object type
 * @param target - Target object (will be cloned)
 * @param customizer - Customizer function for control over merging
 * @param sources - Source objects to merge
 * @returns New deeply merged object (target is not mutated)
 */
export const mergeWith = <T extends Record<string, unknown>>(
  target: T,
  customizer: MergeCustomizer,
  ...sources: Record<string, unknown>[]
): T => internalMerge(structuredClone(target), customizer, ...sources);

/**
 * Flattens nested object to single level.
 * @param obj - Object to flatten
 * @param separator - Separator for nested keys (default: '.')
 * @returns New flattened object
 * @remarks Empty objects are preserved as objects (not flattened)
 */
export const flattenObject = (
  obj: Record<string, unknown>,
  separator: string = '.',
): Record<string, unknown> => {
  const result: Record<string, unknown> = {};
  const stack: [Record<string, unknown>, string][] = [[obj, '']];

  while (stack.length > 0) {
    const [curr, prefix] = stack.pop()!;

    for (const key in curr) {
      if (Object.prototype.hasOwnProperty.call(curr, key)) {
        const value = curr[key];
        const newKey = prefix ? `${prefix}${separator}${key}` : key;

        if (isPlainObject(value) && Object.keys(value).length > 0) {
          stack.push([value as Record<string, unknown>, newKey]);
        } else {
          result[newKey] = value;
        }
      }
    }
  }

  return result;
};

/**
 * Recursively transforms keys in object/array structure.
 * @param obj - Input value
 * @param transformer - Function to transform key strings
 * @returns Transformed value
 * @remarks Only transforms plain objects and arrays; other values returned as-is
 */
const transformKeys = (
  obj: unknown,
  transformer: (str: string) => string,
): unknown => {
  if (obj === null || typeof obj !== 'object') return obj;

  if (Array.isArray(obj))
    return obj.map((item) => transformKeys(item, transformer));

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const prototype = Object.getPrototypeOf(obj);
  if (prototype !== Object.prototype && prototype !== null) return obj;

  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [
      transformer(key),
      transformKeys(value, transformer),
    ]),
  );
};

/**
 * Recursively converts object keys to camelCase.
 * @template T - Desired return type
 * @param obj - Input value
 * @returns Value with keys transformed to camelCase
 */
export const toCamelCaseKeys = <T = unknown>(obj: unknown): T =>
  transformKeys(obj, camelCase) as T;

/**
 * Recursively converts object keys to snake_case.
 * @template T - Desired return type
 * @param obj - Input value
 * @returns Value with keys transformed to snake_case
 */
export const toSnakeCaseKeys = <T = unknown>(obj: unknown): T =>
  transformKeys(obj, snakeCase) as T;
