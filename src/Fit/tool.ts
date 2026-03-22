// ========================================
// ./src/Fit/tool.ts
// ========================================

/*
蛇形：不做类型守卫，它依赖于that之前的类型守卫，它是一个约束
小驼峰：即做类型守卫、也做约束，它是一个复合谓词
大驼峰：它是起手式，一个语法糖，内部实际上会创建对应的new Fit()类
*/

/* v8 ignore file -- @preserve */

/**
 * Type guard that checks if a value is a string.
 * @param x - The value to check
 * @returns True if the value is a string
 */
const _string = (x: unknown): x is string => typeof x === 'string';
/**
 * Type guard that checks if a value is a number.
 * @param x - The value to check
 * @returns True if the value is a number
 */
const _number = (x: unknown): x is number => typeof x === 'number';
/**
 * Type guard that checks if a value is a boolean.
 * @param x - The value to check
 * @returns True if the value is a boolean
 */
const _boolean = (x: unknown): x is boolean => typeof x === 'boolean';
/**
 * Type guard that checks if a value is a symbol.
 * @param x - The value to check
 * @returns True if the value is a symbol
 */
const _symbol = (x: unknown): x is symbol => typeof x === 'symbol';
/**
 * Type guard that checks if a value is a bigint.
 * @param x - The value to check
 * @returns True if the value is a bigint
 */
const _bigint = (x: unknown): x is bigint => typeof x === 'bigint';
/**
 * Type guard that checks if a value is a function.
 * @param x - The value to check
 * @returns True if the value is a function
 */
const _function = (x: unknown): x is (...args: unknown[]) => unknown =>
  typeof x === 'function';
/**
 * Type guard that checks if a value is a non-null object.
 * @param x - The value to check
 * @returns True if the value is a non-null object
 */
const _object = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null;
/**
 * Type guard that checks if a value is an array.
 * @param x - The value to check
 * @returns True if the value is an array
 */
const _array = (x: unknown): x is unknown[] => Array.isArray(x);

/**
 * Type guard that checks if a value is undefined.
 * @param x - The value to check
 * @returns True if the value is undefined
 */
const _undefined = (x: unknown): x is undefined => x === undefined;
/**
 * Type guard that checks if a value is null.
 * @param x - The value to check
 * @returns True if the value is null
 */
const _null = (x: unknown): x is null => x === null;
/**
 * Type guard that checks if a value is null or undefined.
 * @param x - The value to check
 * @returns True if the value is null or undefined
 */
const _nullish = (x: unknown): x is null | undefined =>
  x === null || x === undefined;
/**
 * Type guard that checks if a value is a primitive type.
 * @param x - The value to check
 * @returns True if the value is string, number, boolean, null, undefined, symbol, or bigint
 */
const _primitive = (
  x: unknown,
): x is string | number | boolean | null | undefined | symbol | bigint =>
  x === null ||
  x === undefined ||
  (typeof x !== 'object' && typeof x !== 'function');

/**
 * Type guard that checks if a value is a Date object.
 * @param x - The value to check
 * @returns True if the value is a Date instance
 */
const _date = (x: unknown): x is Date => x instanceof Date;
/**
 * Type guard that checks if a value is a RegExp object.
 * @param x - The value to check
 * @returns True if the value is a RegExp instance
 */
const _regexp = (x: unknown): x is RegExp => x instanceof RegExp;
/**
 * Type guard that checks if a value is an Error object.
 * @param x - The value to check
 * @returns True if the value is an Error instance
 */
const _error = (x: unknown): x is Error => x instanceof Error;
/**
 * Type guard that checks if a value is a Map object.
 * @template K - The map key type (default: unknown)
 * @template V - The map value type (default: unknown)
 * @param x - The value to check
 * @returns True if the value is a Map instance
 */
const _map = <K = unknown, V = unknown>(x: unknown): x is Map<K, V> =>
  x instanceof Map;
/**
 * Type guard that checks if a value is a Set object.
 * @template T - The set element type (default: unknown)
 * @param x - The value to check
 * @returns True if the value is a Set instance
 */
const _set = <T = unknown>(x: unknown): x is Set<T> => x instanceof Set;
/**
 * Type guard that checks if a value is a WeakMap object.
 * @template K - The weak map key type (must extend object, default: object)
 * @template V - The weak map value type (default: unknown)
 * @param x - The value to check
 * @returns True if the value is a WeakMap instance
 */
const _weakMap = <K extends object, V = unknown>(
  x: unknown,
): x is WeakMap<K, V> => x instanceof WeakMap;
/**
 * Type guard that checks if a value is a WeakSet object.
 * @template T - The weak set element type (must extend object, default: object)
 * @param x - The value to check
 * @returns True if the value is a WeakSet instance
 */
const _weakSet = <T extends object>(x: unknown): x is WeakSet<T> =>
  x instanceof WeakSet;

/**
 * Type guard that checks if a value is a plain object (non-null object that is not an array).
 * @param x - The value to check
 * @returns True if the value is a plain object
 */
const _plainObject = (x: unknown): x is Record<string, unknown> =>
  _object(x) && !_array(x);

/**
 * Type guard that checks if a value is iterable (has Symbol.iterator).
 * @param x - The value to check
 * @returns True if the value implements the Iterable protocol
 */
const _iterable = (x: unknown): x is Iterable<unknown> =>
  _object(x) && Symbol.iterator in x;

/**
 * Type guard that checks if a value is async iterable (has Symbol.asyncIterator).
 * @param x - The value to check
 * @returns True if the value implements the AsyncIterable protocol
 */
const _asyncIterable = (x: unknown): x is AsyncIterable<unknown> =>
  _object(x) && Symbol.asyncIterator in x;

/**
 * Creates a type guard that checks if a value is a Record with specific key and value types.
 * @template K - The record key type (must extend PropertyKey)
 * @template V - The record value type
 * @param key_guard - The type guard for keys
 * @param value_guard - The type guard for values
 * @returns A type guard that returns true if all enumerable own properties pass both guards
 */
const _record =
  <K extends PropertyKey, V>(
    key_guard: (k: unknown) => k is K,
    value_guard: (v: unknown) => v is V,
  ) =>
  (x: unknown): x is Record<K, V> => {
    if (!_object(x)) return false;
    for (const key in x) {
      if (Object.prototype.hasOwnProperty.call(x, key)) {
        if (!key_guard(key) || !value_guard(x[key])) return false;
      }
    }
    return true;
  };

/**
 * Type guard that checks if a value is truthy (coerces to true in boolean context).
 * @template T - The expected truthy type
 * @param x - The value to check
 * @returns True if the value is truthy (excludes null, undefined, false, 0, '', 0n)
 */
const _truthy = <T>(x: T | null | undefined | false | 0 | '' | 0n): x is T =>
  !!x;
/**
 * Type guard that checks if a value is falsy (coerces to false in boolean context).
 * @param x - The value to check
 * @returns True if the value is null, undefined, false, 0, '', or 0n
 */
const _falsy = (x: unknown): x is null | undefined | false | 0 | '' | 0n => !x;

/**
 * Checks if a value is empty (nullish, empty string/array, empty Map/Set, or object with no keys).
 * @param x - The value to check
 * @returns True if the value is considered empty
 */
const _empty = (x: unknown): boolean => {
  if (_nullish(x)) return true;
  if (_string(x) || _array(x)) return x.length === 0;
  if (_map(x) || _set(x)) return x.size === 0;
  if (_object(x)) return Object.keys(x).length === 0;
  return false;
};
/**
 * Checks if a value is non-empty (not nullish, has content).
 * @param x - The value to check
 * @returns True if the value is considered non-empty
 */
const _nonEmpty = (x: unknown): boolean => !_empty(x);

/**
 * Creates a type guard that checks if a value equals a specific value (strict equality).
 * @template T - The expected value type
 * @param val - The value to compare against
 * @returns A type guard that returns true if the value === val
 */
const _eq =
  <T>(val: T) =>
  (x: unknown): x is T =>
    x === val;
/**
 * Creates a predicate that checks if a value does not equal a specific value.
 * @template T - The comparison value type
 * @param val - The value to compare against
 * @returns A predicate that returns true if the value !== val
 */
const _neq =
  <T>(val: T) =>
  (x: unknown): boolean =>
    x !== val;
/**
 * Creates a predicate that checks if a number is greater than a value.
 * @param val - The comparison value
 * @returns A predicate that returns true if the number > val
 */
const _gt = (val: number) => (x: number) => x > val;
/**
 * Creates a predicate that checks if a number is greater than or equal to a value.
 * @param val - The comparison value
 * @returns A predicate that returns true if the number >= val
 */
const _gte = (val: number) => (x: number) => x >= val;
/**
 * Creates a predicate that checks if a number is less than a value.
 * @param val - The comparison value
 * @returns A predicate that returns true if the number < val
 */
const _lt = (val: number) => (x: number) => x < val;
/**
 * Creates a predicate that checks if a number is less than or equal to a value.
 * @param val - The comparison value
 * @returns A predicate that returns true if the number <= val
 */
const _lte = (val: number) => (x: number) => x <= val;
/**
 * Creates a predicate that checks if a number is strictly between two values (exclusive).
 * @param min_val - The minimum value (exclusive)
 * @param max_val - The maximum value (exclusive)
 * @returns A predicate that returns true if min_val < number < max_val
 */
const _between = (min_val: number, max_val: number) => (x: number) =>
  x > min_val && x < max_val;
/**
 * Creates a predicate that checks if a number is between two values (inclusive).
 * @param min_val - The minimum value (inclusive)
 * @param max_val - The maximum value (inclusive)
 * @returns A predicate that returns true if min_val <= number <= max_val
 */
const _betweenInclusive = (min_val: number, max_val: number) => (x: number) =>
  x >= min_val && x <= max_val;

/**
 * Creates a type guard that checks if a value is one of the specified values.
 * @template T - The tuple of allowed values
 * @param vals - The values to check against
 * @returns A type guard that returns true if the value is in the list
 */
const _oneOf =
  <const T extends readonly [unknown, ...unknown[]]>(...vals: T) =>
  (x: unknown): x is T[number] =>
    vals.includes(x as T[number]);

/**
 * Creates a predicate that checks if a value is not one of the specified values.
 * @template T - The tuple of excluded values
 * @param vals - The values to exclude
 * @returns A predicate that returns true if the value is not in the list
 */
const _notOneOf =
  <const T extends readonly [unknown, ...unknown[]]>(...vals: T) =>
  (x: unknown): boolean =>
    !vals.includes(x as T[number]);

/**
 * Creates a type guard that checks if a value is an instance of a class.
 * @template T - The constructor type
 * @param cls - The class constructor to check against
 * @returns A type guard that returns true if the value is an instance of cls
 */
const _instanceOf =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  <T extends abstract new (...args: any[]) => unknown>(cls: T) =>
    (x: unknown): x is InstanceType<T> =>
      x instanceof cls;

// ============================================
// String Constraints
// ============================================

/**
 * Creates a predicate that checks if a string has at least the specified length.
 * @param len - The minimum required length
 * @returns A predicate function that returns true if the string length is >= len
 */
export const min_len = (len: number) => (x: string) => x.length >= len;

/**
 * Creates a predicate that checks if a string has at most the specified length.
 * @param len - The maximum allowed length
 * @returns A predicate function that returns true if the string length is <= len
 */
export const max_len = (len: number) => (x: string) => x.length <= len;

/**
 * Creates a predicate that checks if a string length falls within a specified range.
 * @param min - The minimum required length (inclusive)
 * @param max - The maximum allowed length (inclusive)
 * @returns A predicate function that returns true if the string length is within [min, max]
 */
export const len_range = (min: number, max: number) => (x: string) =>
  x.length >= min && x.length <= max;

/**
 * Creates a predicate that checks if a string matches a regular expression.
 * @param reg - The regular expression to test against
 * @returns A predicate function that returns true if the string matches the regex
 */
export const matches = (reg: RegExp) => (x: string) => reg.test(x);

/**
 * Creates a predicate that checks if a string starts with the specified prefix.
 * @param prefix - The prefix to check for
 * @returns A predicate function that returns true if the string starts with the prefix
 */
export const starts_with = (prefix: string) => (x: string) =>
  x.startsWith(prefix);

/**
 * Creates a predicate that checks if a string ends with the specified suffix.
 * @param suffix - The suffix to check for
 * @returns A predicate function that returns true if the string ends with the suffix
 */
export const ends_with = (suffix: string) => (x: string) => x.endsWith(suffix);

/**
 * Creates a predicate that checks if a string contains the specified substring.
 * @param substr - The substring to search for
 * @returns A predicate function that returns true if the string contains the substring
 */
export const includes = (substr: string) => (x: string) => x.includes(substr);

/**
 * Checks if a string is equal to its trimmed version (no leading/trailing whitespace).
 * @param x - The string to check
 * @returns True if the string has no leading or trailing whitespace
 */
export const trimmed = (x: string) => x === x.trim();

/**
 * Checks if a string has at least one character.
 * @param x - The string to check
 * @returns True if the string length is greater than 0
 */
export const non_empty_string = (x: string) => x.length > 0;

/**
 * Checks if a string consists only of numeric digits.
 * @param x - The string to check
 * @returns True if the string matches /^\d+$/
 */
export const numeric_string = (x: string) => /^\d+$/.test(x);

/**
 * Checks if a string consists only of alphabetic characters (a-z, A-Z).
 * @param x - The string to check
 * @returns True if the string matches /^[a-zA-Z]+$/
 */
export const alpha_string = (x: string) => /^[a-zA-Z]+$/.test(x);

/**
 * Checks if a string consists only of alphanumeric characters (a-z, A-Z, 0-9).
 * @param x - The string to check
 * @returns True if the string matches /^[a-zA-Z0-9]+$/
 */
export const alphanumeric_string = (x: string) => /^[a-zA-Z0-9]+$/.test(x);

/**
 * Checks if a string matches ISO 8601 datetime format.
 * @param x - The string to check
 * @returns True if the string matches ISO datetime format (YYYY-MM-DDTHH:mm:ss)
 */
export const iso_datetime = (x: string) =>
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(x);

/**
 * Validates an email address according to RFC 5321.
 * @param email_str - The email string to validate
 * @returns True if the string is a valid email address (max 254 characters per RFC 5321)
 */
export const email = (email_str: string): boolean => {
  const email_regex =
    /^(?!\.)(?!.*?\.\.)[a-zA-Z0-9!#$%&'*+/=?^_`{|}~.-]+@((?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,})$/u;
  if (!email_str || email_str.length > 254) return false;
  return email_regex.test(email_str);
};

/**
 * Checks if a string is a valid URL.
 * @param x - The string to check
 * @returns True if the string can be parsed as a valid URL
 */
export const url = (x: string) => {
  try {
    new URL(x);
    return true;
  } catch {
    return false;
  }
};

/**
 * Checks if a string is a valid UUID format.
 * @param x - The string to check
 * @returns True if the string matches UUID format (8-4-4-4-12 hexadecimal)
 */
export const uuid = (x: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);

/**
 * Checks if a string is a valid hexadecimal color code.
 * @param x - The string to check
 * @returns True if the string matches #RGB, #RRGGBB, or #RRGGBBAA format
 */
export const hex_color = (x: string) =>
  /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(x);

// ============================================
// Number Constraints
// ============================================

/**
 * Creates a predicate that checks if a number is greater than or equal to a minimum value.
 * @param val - The minimum value (inclusive)
 * @returns A predicate function that returns true if the number >= val
 */
export const min = (val: number) => (x: number) => x >= val;

/**
 * Creates a predicate that checks if a number is less than or equal to a maximum value.
 * @param val - The maximum value (inclusive)
 * @returns A predicate function that returns true if the number <= val
 */
export const max = (val: number) => (x: number) => x <= val;

/**
 * Creates a predicate that checks if a number falls within a specified range.
 * @param min_val - The minimum value (inclusive)
 * @param max_val - The maximum value (inclusive)
 * @returns A predicate function that returns true if the number is within [min_val, max_val]
 */
export const range = (min_val: number, max_val: number) => (x: number) =>
  x >= min_val && x <= max_val;

/**
 * Checks if a number is an integer (no fractional part).
 * @param x - The number to check
 * @returns True if the number is an integer
 */
export const integer = (x: number) => Number.isInteger(x);

/**
 * Checks if a number is a safe integer (within IEEE-754 safe integer range).
 * @param x - The number to check
 * @returns True if the number is a safe integer (-(2^53 - 1) to 2^53 - 1)
 */
export const safe_integer = (x: number) => Number.isSafeInteger(x);

/**
 * Checks if a number is positive (greater than 0).
 * @param x - The number to check
 * @returns True if the number > 0
 */
export const positive = (x: number) => x > 0;

/**
 * Checks if a number is negative (less than 0).
 * @param x - The number to check
 * @returns True if the number < 0
 */
export const negative = (x: number) => x < 0;

/**
 * Checks if a number is non-positive (less than or equal to 0).
 * @param x - The number to check
 * @returns True if the number <= 0
 */
export const non_positive = (x: number) => x <= 0;

/**
 * Checks if a number is non-negative (greater than or equal to 0).
 * @param x - The number to check
 * @returns True if the number >= 0
 */
export const non_negative = (x: number) => x >= 0;

/**
 * Checks if a number is finite (not Infinity or -Infinity).
 * @param x - The number to check
 * @returns True if the number is finite
 */
export const finite = (x: number) => Number.isFinite(x);

/**
 * Type guard that checks if a value is NaN (Not a Number).
 * @param x - The value to check
 * @returns True if the value is NaN
 */
export const nan = (x: unknown): x is number => Number.isNaN(x);

/**
 * Checks if a number is even (divisible by 2).
 * @param x - The number to check
 * @returns True if the number is even
 */
export const even = (x: number) => x % 2 === 0;

/**
 * Checks if a number is odd (not divisible by 2).
 * @param x - The number to check
 * @returns True if the number is odd
 */
export const odd = (x: number) => x % 2 !== 0;

/**
 * Creates a predicate that checks if a number is divisible by a given divisor.
 * @param divisor - The divisor to check divisibility against
 * @returns A predicate function that returns true if the number is divisible by divisor
 */
export const multiple_of = (divisor: number) => (x: number) =>
  x % divisor === 0;

// ============================================
// Array Constraints
// ============================================

/**
 * Creates a predicate that checks if an array has at least the specified length.
 * @template T - The array element type
 * @param len - The minimum required length
 * @returns A predicate function that returns true if the array length >= len
 */
export const arr_min_len =
  <T>(len: number) =>
  (x: T[]) =>
    x.length >= len;

/**
 * Creates a predicate that checks if an array has at most the specified length.
 * @template T - The array element type
 * @param len - The maximum allowed length
 * @returns A predicate function that returns true if the array length <= len
 */
export const arr_max_len =
  <T>(len: number) =>
  (x: T[]) =>
    x.length <= len;

/**
 * Creates a predicate that checks if an array length falls within a specified range.
 * @template T - The array element type
 * @param min - The minimum required length (inclusive)
 * @param max - The maximum allowed length (inclusive)
 * @returns A predicate function that returns true if the array length is within [min, max]
 */
export const arr_len_range =
  <T>(min: number, max: number) =>
  (x: T[]) =>
    x.length >= min && x.length <= max;

/**
 * Creates a predicate that checks if an array has exactly the specified length.
 * @template T - The array element type
 * @param len - The exact required length
 * @returns A predicate function that returns true if the array length === len
 */
export const arr_len =
  <T>(len: number) =>
  (x: T[]) =>
    x.length === len;

/**
 * Type guard that checks if an array is non-empty.
 * @template T - The array element type
 * @param x - The array to check
 * @returns True if the array has at least one element, narrowing type to [T, ...T[]]
 */
export const non_empty_array = <T>(x: T[]): x is [T, ...T[]] => x.length > 0;

/**
 * Checks if an array contains only unique elements (no duplicates).
 * @template T - The array element type
 * @param x - The array to check
 * @returns True if all elements in the array are unique
 */
export const unique = <T>(x: T[]) => new Set(x).size === x.length;

/**
 * Creates a predicate that checks if an array is sorted.
 * @template T - The array element type
 * @param compare - Optional comparison function for sorting
 * @returns A predicate function that returns true if the array is sorted
 */
export const sorted =
  <T>(compare?: (a: T, b: T) => number) =>
  (x: T[]) => {
    const sorted_copy = [...x].sort(compare);
    return x.every((val, i) => val === sorted_copy[i]);
  };

/**
 * Creates a predicate that checks if all array elements satisfy a condition.
 * @template T - The array element type
 * @param pred - The predicate function to test each element
 * @returns A predicate function that returns true if every element passes the predicate
 */
export const every =
  <T>(pred: (val: T) => boolean) =>
  (x: T[]) =>
    x.every(pred);

/**
 * Creates a predicate that checks if at least one array element satisfies a condition.
 * @template T - The array element type
 * @param pred - The predicate function to test each element
 * @returns A predicate function that returns true if at least one element passes the predicate
 */
export const some =
  <T>(pred: (val: T) => boolean) =>
  (x: T[]) =>
    x.some(pred);

// ============================================
// Object Constraints
// ============================================

/**
 * Creates a predicate that checks if an object has a specific key (own or inherited).
 * @param key - The key to check for (string, number, or symbol)
 * @returns A predicate function that returns true if the key exists in the object
 */
export const has_key = (key: string | number | symbol) => (x: object) =>
  key in x;

/**
 * Creates a predicate that checks if an object has a specific own property.
 * @param key - The property key to check for
 * @returns A predicate function that returns true if the object has the own property
 */
export const has_own = (key: string | number | symbol) => (x: object) =>
  Object.prototype.hasOwnProperty.call(x, key);

/**
 * Creates a type guard that checks if an object has all specified keys.
 * @template T - The tuple of required key names
 * @param keys - The keys that must be present in the object
 * @returns A type guard function that narrows the type to include the specified keys
 */
export const keys =
  <const T extends readonly string[]>(...keys: T) =>
  <U extends Record<string, unknown>>(
    x: U,
  ): x is U & Record<T[number], unknown> =>
    keys.every((k) => k in x);

/**
 * Creates a predicate that checks if an object has exactly the specified keys (no more, no less).
 * @template T - The tuple of expected key names
 * @param keys - The exact keys the object should have
 * @returns A predicate function that returns true if the object has exactly these keys
 */
export const exact_keys =
  <const T extends readonly string[]>(...keys: T) =>
  (x: object) => {
    const obj_keys = Object.keys(x).sort();
    const expected = [...keys].sort();
    return (
      obj_keys.length === expected.length &&
      obj_keys.every((k, i) => k === expected[i])
    );
  };

// ============================================
// Combinator Predicates
// ============================================

type Predicate = (v: unknown) => boolean;
type TypeGuard<T> = (v: unknown) => v is T;

type ExtractGuardUnion<T extends readonly unknown[]> = T extends readonly [
  infer H,
  ...infer R,
]
  ? (H extends (v: unknown) => v is infer U ? U : never) | ExtractGuardUnion<R>
  : never;

type ExtractGuardIntersection<T extends readonly unknown[]> =
  T extends readonly [infer H, ...infer R]
    ? H extends (v: unknown) => v is infer U
      ? U & ExtractGuardIntersection<R>
      : ExtractGuardIntersection<R>
    : unknown;

/**
 * Creates a type guard that is the union of multiple type guards.
 * The resulting guard returns true if any of the input guards return true.
 * @template T - The tuple of predicates or type guards
 * @param guards - The type guards to combine with OR logic
 * @returns A type guard that returns true if any guard passes
 */
export function union<T extends readonly (Predicate | TypeGuard<unknown>)[]>(
  ...guards: T
): (v: unknown) => v is ExtractGuardUnion<T> {
  return ((v: unknown) => guards.some((g) => g(v))) as ReturnType<
    typeof union<T>
  >;
}

/**
 * Creates a type guard that is the intersection of multiple type guards.
 * The resulting guard returns true only if all of the input guards return true.
 * @template T - The tuple of predicates or type guards
 * @param guards - The type guards to combine with AND logic
 * @returns A type guard that returns true only if all guards pass
 */
export function and<T extends readonly (Predicate | TypeGuard<unknown>)[]>(
  ...guards: T
): (v: unknown) => v is ExtractGuardIntersection<T> {
  return ((v: unknown) => guards.every((g) => g(v))) as ReturnType<
    typeof and<T>
  >;
}

type ExtractDiscriminated<
  _K extends PropertyKey,
  T extends Record<PropertyKey, (v: unknown) => v is unknown>,
> = T[keyof T] extends (v: unknown) => v is infer R ? R : never;

/**
 * Creates a type guard for a discriminated union based on a discriminator key.
 * @template K - The discriminator key type
 * @template T - The record mapping discriminator values to type guards
 * @param key - The property key used as the discriminator
 * @param guards - A record mapping discriminator values to their corresponding type guards
 * @returns A type guard that checks the discriminator value and applies the appropriate guard
 */
export const discriminatedUnion =
  <
    K extends PropertyKey,
    T extends Record<PropertyKey, (v: unknown) => v is unknown>,
  >(
    key: K,
    guards: T,
  ) =>
  (v: unknown): v is ExtractDiscriminated<K, T> => {
    if (typeof v !== 'object' || v === null) return false;
    const obj = v as Record<PropertyKey, unknown>;
    const discriminator = obj[key];
    const guard = guards[discriminator as keyof T];
    return guard?.(v) ?? false;
  };

// ============================================
// Composite API
// ============================================

/**
 * Creates a type guard that checks if a value is an array where all elements pass the element guard.
 * @template T - The element type
 * @param element_guard - The type guard to apply to each element
 * @returns A type guard that returns true if the value is an array of T
 */
export const arrayOf =
  <T>(element_guard: (v: unknown) => v is T) =>
  (v: unknown): v is T[] =>
    _array(v) && v.every(element_guard);

/**
 * Creates a type guard that checks if an object matches a specific shape.
 * @template T - The expected object shape type
 * @param shape - A record of type guards for each property
 * @returns A type guard that returns true if the object matches the shape
 */
export const objectShape =
  <T extends Record<string, unknown>>(shape: {
    [K in keyof T]: (v: unknown) => v is T[K];
  }) =>
  (v: unknown): v is T => {
    if (!_object(v)) return false;
    for (const key in shape) {
      if (!(key in v)) return false;
      if (!shape[key](v[key])) return false;
    }
    return true;
  };

/**
 * Creates a type guard that checks if a value is a number within a specified range.
 * @param min_val - The minimum value (inclusive)
 * @param max_val - The maximum value (inclusive)
 * @param int - Whether the number must be an integer (default: false)
 * @returns A type guard that returns true if the value is a number within the range
 */
export const numRange =
  (min_val: number, max_val: number, int = false) =>
  (v: unknown): v is number =>
    _number(v) && v >= min_val && v <= max_val && (!int || integer(v));

/**
 * Type guard that checks if a value is a non-negative integer (0, 1, 2, ...).
 * @param v - The value to check
 * @returns True if the value is an integer >= 0
 */
export const nonNegativeInt = (v: unknown): v is number =>
  _number(v) && integer(v) && v >= 0;

// ============================================
// Type Guards
// ============================================

export {
  _string as string,
  _number as number,
  _boolean as boolean,
  _symbol as symbol,
  _bigint as bigint,
  _function as function,
  _object as object,
  _array as array,
  _undefined as undefined,
  _null as null,
  _nullish as nullish,
  _primitive as primitive,
  _date as date,
  _regexp as regexp,
  _error as error,
  _map as map,
  _set as set,
  _weakMap as weakMap,
  _weakSet as weakSet,
  _plainObject as plainObject,
  _iterable as iterable,
  _asyncIterable as asyncIterable,
  _record as record,
  _truthy as truthy,
  _falsy as falsy,
  _empty as empty,
  _nonEmpty as nonEmpty,
  _eq as eq,
  _oneOf as oneOf,
  _neq as neq,
  _notOneOf as notOneOf,
  _gt as gt,
  _gte as gte,
  _lt as lt,
  _lte as lte,
  _between as between,
  _betweenInclusive as betweenInclusive,
  _instanceOf as instanceOf,
};
