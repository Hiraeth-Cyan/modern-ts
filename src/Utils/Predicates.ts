// ============================================
// ./src/Utils/Predicates.ts
// ============================================

/**
 * Gets the internal [[Class]] property of a value using Object.prototype.toString
 * @param value - Value to check
 * @returns String representation of value's type
 * @remarks Handles null and undefined explicitly to avoid [[Class]] inconsistencies
 */
export const getTag = (value: unknown): string => {
  if (value == null)
    return value === undefined ? '[object Undefined]' : '[object Null]';
  return Object.prototype.toString.call(value);
};

// ========================================
// 基础类型断言
// ========================================

/**
 * Checks if value is a string primitive or String object
 * @param value - Value to check
 * @returns Type guard for string
 * @remarks Returns true for both primitive strings and String objects
 */
export const isString = (value: unknown): value is string => {
  return typeof value === 'string' || getTag(value) === '[object String]';
};

/**
 * Checks if value is a number primitive or Number object
 * @param value - Value to check
 * @returns Type guard for number
 * @remarks Returns true for both primitive numbers and Number objects
 */
export const isNumber = (value: unknown): value is number => {
  return typeof value === 'number' || getTag(value) === '[object Number]';
};

/**
 * Checks if value is a finite number
 * @param value - Value to check
 * @returns Type guard for finite number
 * @remarks Returns false for Infinity, -Infinity, and NaN
 */
export const isFinite = (value: unknown): value is number => {
  return isNumber(value) && globalThis.isFinite(value);
};

/**
 * Checks if value is a boolean primitive or Boolean object
 * @param value - Value to check
 * @returns Type guard for boolean
 * @remarks Returns true for both primitive booleans and Boolean objects
 */
export const isBoolean = (value: unknown): value is boolean => {
  return typeof value === 'boolean' || getTag(value) === '[object Boolean]';
};

/**
 * Checks if value is a symbol primitive or Symbol object
 * @param value - Value to check
 * @returns Type guard for symbol
 * @remarks Returns true for both primitive symbols and Symbol objects
 */
export const isSymbol = (value: unknown): value is symbol => {
  return typeof value === 'symbol' || getTag(value) === '[object Symbol]';
};

/**
 * Checks if value is strictly null
 * @param value - Value to check
 * @returns Type guard for null
 * @remarks Uses strict equality (value === null)
 */
export const isNull = (value: unknown): value is null => {
  return value === null;
};

/**
 * Checks if value is strictly undefined
 * @param value - Value to check
 * @returns Type guard for undefined
 * @remarks Uses strict equality (value === undefined)
 */
export const isUndefined = (value: unknown): value is undefined => {
  return value === undefined;
};

/**
 * Checks if value is null or undefined (loose equality)
 * @param value - Value to check
 * @returns Type guard for null | undefined
 * @remarks Uses loose equality (value == null)
 */
export const isNil = (value: unknown): value is null | undefined => {
  return value == null;
};

/**
 * Checks if value is NOT null or undefined
 * @param value - Value to check
 * @returns Type guard for NonNullable<unknown>
 * @remarks Opposite of isNil
 */
export const isNotNil = (value: unknown): value is NonNullable<unknown> => {
  return !isNil(value);
};

/**
 * Checks if value is NOT null or undefined with proper type narrowing
 * @template T - Type of value when not nullish
 * @param value - Value to check
 * @returns Type guard for T
 * @remarks Properly narrows generic types while filtering null/undefined
 */
export const isNotNullish = <T>(value: T | null | undefined): value is T => {
  return !isNil(value);
};

// ========================================
// 复合类型检查
// =========================================

/**
 * Checks if value is a JavaScript primitive type
 * @param value - Value to check
 * @returns Type guard for primitive types
 * @remarks Returns true for string, number, boolean, symbol, bigint, null, undefined
 */
export const isPrimitive = (
  value: unknown,
): value is string | number | boolean | symbol | bigint | null | undefined => {
  if (value === null) return true;
  const type = typeof value;
  return type !== 'object' && type !== 'function';
};

/**
 * Checks if value is an object (including functions)
 * @param value - Value to check
 * @returns Type guard for object
 * @remarks Returns true for objects and functions, false for null
 */
export const isObject = (value: unknown): value is object => {
  return (
    typeof value === 'function' || (typeof value === 'object' && value !== null)
  );
};

/**
 * Checks if value is a function
 * @param value - Value to check
 * @returns Type guard for function
 * @remarks Returns true for any function type
 */
export const isFunction = (
  value: unknown,
): value is (...arg: unknown[]) => unknown => {
  return typeof value === 'function';
};

/**
 * Checks if value is an array
 * @param value - Value to check
 * @returns Type guard for array
 * @remarks Uses native Array.isArray for reliability
 */
export const isArray = (value: unknown): value is unknown[] =>
  Array.isArray(value);

/**
 * Checks if value is a plain object (object created by {} or new Object)
 * @param value - Value to check
 * @returns Type guard for plain object
 * @remarks Returns false for arrays, dates, regexp, and custom class instances
 */
export const isPlainObject = (
  value: unknown,
): value is Record<PropertyKey, unknown> => {
  if (getTag(value) !== '[object Object]') {
    return false;
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const proto = Object.getPrototypeOf(value);
  if (proto === null) {
    return true;
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  return proto === Object.prototype || proto.constructor === Object;
};

// ========================================
// 数字相关检查
// ========================================

/**
 * Checks if value is an integer
 * @param value - Value to check
 * @returns Type guard for integer number
 * @remarks Returns true for integer numbers, false for non-integer numbers
 */
export const isInteger = (value: unknown): value is number => {
  return isNumber(value) && Number.isInteger(value);
};

/**
 * Checks if value is a safe integer
 * @param value - Value to check
 * @returns Type guard for safe integer
 * @remarks Safe integers are integers between -(2^53-1) and 2^53-1
 */
export const isSafeInteger = (value: unknown): value is number => {
  return isNumber(value) && Number.isSafeInteger(value);
};

/**
 * Checks if value is a valid array-like length
 * @param value - Value to check
 * @returns Type guard for valid length number
 * @remarks Valid lengths are non-negative integers ≤ Number.MAX_SAFE_INTEGER
 */
export const isLength = (value: unknown): value is number => {
  return (
    typeof value === 'number' &&
    value > -1 &&
    value % 1 === 0 &&
    value <= Number.MAX_SAFE_INTEGER
  );
};

// ========================================
// 内置对象检查
// ========================================

/**
 * Checks if value is a Date object
 * @param value - Value to check
 * @returns Type guard for Date
 * @remarks Returns true for Date instances only
 */
export const isDate = (value: unknown): value is Date => {
  return getTag(value) === '[object Date]';
};

/**
 * Checks if value is a RegExp object
 * @param value - Value to check
 * @returns Type guard for RegExp
 * @remarks Returns true for RegExp instances only
 */
export const isRegExp = (value: unknown): value is RegExp => {
  return getTag(value) === '[object RegExp]';
};

/**
 * Checks if value is an Error object
 * @param value - Value to check
 * @returns Type guard for Error
 * @remarks Returns true for Error and DOMException instances
 */
export const isError = (value: unknown): value is Error => {
  const tag = getTag(value);
  return tag === '[object Error]' || tag === '[object DOMException]';
};

/**
 * Checks if value is a Map object
 * @param value - Value to check
 * @returns Type guard for Map<unknown, unknown>
 * @remarks Returns true for Map instances only
 */
export const isMap = (value: unknown): value is Map<unknown, unknown> => {
  return getTag(value) === '[object Map]';
};

/**
 * Checks if value is a Set object
 * @param value - Value to check
 * @returns Type guard for Set<unknown>
 * @remarks Returns true for Set instances only
 */
export const isSet = (value: unknown): value is Set<unknown> => {
  return getTag(value) === '[object Set]';
};

/**
 * Checks if value is a WeakMap object
 * @param value - Value to check
 * @returns Type guard for WeakMap<object, unknown>
 * @remarks Returns true for WeakMap instances only
 */
export const isWeakMap = (
  value: unknown,
): value is WeakMap<object, unknown> => {
  return getTag(value) === '[object WeakMap]';
};

/**
 * Checks if value is a WeakSet object
 * @param value - Value to check
 * @returns Type guard for WeakSet<object>
 * @remarks Returns true for WeakSet instances only
 */
export const isWeakSet = (value: unknown): value is WeakSet<object> => {
  return getTag(value) === '[object WeakSet]';
};

/**
 * Checks if value is an ArrayBuffer object
 * @param value - Value to check
 * @returns Type guard for ArrayBuffer
 * @remarks Returns true for ArrayBuffer instances only
 */
export const isArrayBuffer = (value: unknown): value is ArrayBuffer => {
  return getTag(value) === '[object ArrayBuffer]';
};

const TYPED_ARRAY_TAG =
  /^\[object (?:Float(?:32|64)|(?:Int|Uint)(?:8|16|32)|Uint8Clamped)Array\]$/;

/**
 * Checks if value is a typed array
 * @param value - Value to check
 * @returns Type guard for ArrayBufferView
 * @remarks Supports all standard typed array types
 */
export const isTypedArray = (value: unknown): value is ArrayBufferView => {
  return isObject(value) && TYPED_ARRAY_TAG.test(getTag(value));
};

// ========================================
// 浏览器/Node特定类型
// ========================================

/**
 * Checks if code is running in a browser environment
 * @returns True if running in browser with DOM access
 * @remarks Verifies both window and document exist and are properly connected
 */
export const isBrowser = (): boolean => {
  return (
    typeof window !== 'undefined' &&
    typeof document !== 'undefined' &&
    window.document === document
  );
};

/**
 * Checks if code is running in a client environment
 * @returns True if running in any client-side context
 * @remarks Less strict than isBrowser, checks for window or self
 */
export const isClient = (): boolean => {
  return typeof window !== 'undefined' || typeof self !== 'undefined';
};

/**
 * Checks if code is running in a Node.js environment
 * @returns True if running in Node.js
 * @remarks Checks for process.versions.node existence
 */
export const isNode = (): boolean => {
  return (
    typeof process !== 'undefined' &&
    process.versions != null &&
    process.versions.node != null
  );
};

/**
 * Checks if value is a Buffer (Node.js)
 * @param value - Value to check
 * @returns True if value is a Buffer
 * @remarks Uses Buffer.isBuffer if available, fails gracefully in browser
 */
export const isBuffer = (value: unknown): boolean => {
  try {
    if (
      value != null &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
      (value as any).constructor &&
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
      typeof (value as any).constructor.isBuffer === 'function'
    ) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
      return (value as any).constructor.isBuffer(value);
    }
  } catch (e) {
    return false;
  }
  return false;
};

/**
 * Checks if value is a Blob object
 * @param value - Value to check
 * @returns Type guard for Blob
 * @remarks Returns true for Blob instances only
 */
export const isBlob = (value: unknown): value is Blob => {
  return getTag(value) === '[object Blob]';
};

/**
 * Checks if value is a File object
 * @param value - Value to check
 * @returns Type guard for File
 * @remarks Returns true for File instances only
 */
export const isFile = (value: unknown): value is File => {
  return getTag(value) === '[object File]';
};

// ========================================
// 迭代器检查
// ========================================

/**
 * Checks if value is iterable (has Symbol.iterator)
 * @param value - Value to check
 * @returns Type guard for Iterable<unknown>
 * @remarks Returns true for arrays, strings, maps, sets, and custom iterables
 */
export const isIterable = (value: unknown): value is Iterable<unknown> => {
  return (
    !isNil(value) &&
    typeof (value as {[Symbol.iterator]?: unknown})[Symbol.iterator] ===
      'function'
  );
};

/**
 * Checks if value is async iterable (has Symbol.asyncIterator)
 * @param value - Value to check
 * @returns Type guard for AsyncIterable<unknown>
 * @remarks Returns true for async generators and custom async iterables
 */
export const isAsyncIterable = (
  value: unknown,
): value is AsyncIterable<unknown> => {
  return isObject(value) && Symbol.asyncIterator in value;
};

// ========================================
// Promise检查
// ========================================

export {isPromiseLike} from '../helper';
import {isPromiseLike} from '../helper';

/**
 * Checks if value is a Promise
 * @param value - Value to check
 * @returns Type guard for Promise<unknown>
 * @remarks Returns true for native promises and promise-like objects
 */
export const isPromise = (value: unknown): value is Promise<unknown> => {
  return (
    value instanceof Promise ||
    getTag(value) === '[object Promise]' ||
    isPromiseLike(value)
  );
};

// ========================================
// 实例检查
// ========================================

/**
 * Checks if value is an instance of specified constructor
 * @template T - Expected instance type
 * @param value - Value to check
 * @param constructor - Constructor function
 * @returns Type guard for T
 * @remarks Uses instanceof operator with type safety
 */
export const isInstanceOf = <T>(
  value: unknown,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor: abstract new (...args: any[]) => T,
): value is T => {
  return isObject(value) && value instanceof constructor;
};

// ========================================
// 属性键检查
// ========================================

/**
 * Checks if value is a valid property key (string, number, or symbol)
 * @param value - Value to check
 * @returns Type guard for PropertyKey
 * @remarks Returns true for values usable as object keys
 */
export const isPropertyKey = (value: unknown): value is PropertyKey => {
  return isString(value) || isNumber(value) || isSymbol(value);
};

// ========================================
// 空值检查
// ========================================

/**
 * Checks if value is empty (null, undefined, or has no elements/properties)
 * @param value - Value to check
 * @returns True if value is considered empty
 * @remarks Handles arrays, strings, maps, sets, and plain objects
 */
export const isEmpty = (value: unknown): boolean => {
  if (isNil(value)) return true;
  if (isArray(value) || isString(value)) return value.length === 0;
  if (isMap(value) || isSet(value)) return value.size === 0;
  if (isPlainObject(value)) return Object.keys(value).length === 0;
  return false;
};

/**
 * Checks if value is an empty plain object
 * @param value - Value to check
 * @returns Type guard for empty plain object
 * @remarks Returns true only for plain objects with no own enumerable properties
 */
export const isEmptyObject = (
  value: unknown,
): value is Record<PropertyKey, unknown> => {
  return isPlainObject(value) && Object.keys(value).length === 0;
};

// ========================================
// 序列化检查
// ========================================

/**
 * Checks if value is JSON serializable
 * @param value - Value to check
 * @returns True if value can be serialized to JSON
 * @remarks Recursively checks arrays and objects, excludes functions and symbols
 */
export const isSerializable = (value: unknown): boolean => {
  if (
    value === undefined ||
    typeof value === 'symbol' ||
    typeof value === 'function'
  ) {
    return false;
  }

  if (isPrimitive(value)) return true;

  if (isArray(value)) {
    return value.every(isSerializable);
  }

  if (isPlainObject(value)) {
    return Object.values(value).every(isSerializable);
  }

  return false;
};

/**
 * Checks if value is a valid JSON value
 * @param value - Value to check
 * @returns True if value is JSON-compatible
 * @remarks Less strict than isSerializable, allows undefined in some contexts
 */
export const isJSONValue = (value: unknown): boolean => {
  if (value === undefined || typeof value === 'symbol') return false;
  return isPrimitive(value) || isJSONObject(value) || isJSONArray(value);
};

/**
 * Checks if value is a JSON-serializable object
 * @param value - Value to check
 * @returns Type guard for JSON object
 * @remarks Returns true for plain objects with JSON-compatible values
 */
export const isJSONObject = (
  value: unknown,
): value is Record<string, unknown> => {
  if (!isPlainObject(value)) return false;
  const entries = Object.entries(value);
  return entries.every(([_, val]) => isJSONValue(val));
};

/**
 * Checks if value is a JSON-serializable array
 * @param value - Value to check
 * @returns Type guard for JSON array
 * @remarks Returns true for arrays with JSON-compatible values
 */
export const isJSONArray = (value: unknown): value is unknown[] => {
  if (!isArray(value)) return false;
  return value.every(isJSONValue);
};

/**
 * Checks if value is a valid JSON string
 * @param value - Value to check
 * @returns Type guard for JSON string
 * @remarks Returns true for strings that parse to valid JSON
 */
export const isJSON = (value: unknown): value is string => {
  if (!isString(value)) return false;
  const str = value.trim();
  if (str.length === 0) return false;
  if (str === 'null' || str === 'true' || str === 'false') return true;
  if (
    (str.startsWith('{') && str.endsWith('}')) ||
    (str.startsWith('[') && str.endsWith(']'))
  ) {
    try {
      JSON.parse(str);
      return true;
    } catch (e) {
      return false;
    }
  }
  try {
    JSON.parse(str);
    return true;
  } catch (e) {
    return false;
  }
};

// ========================================
// 格式验证
// ========================================

/**
 * Checks if value is a valid email format string
 * @param value - Value to check
 * @returns Type guard for email string
 * @remarks Uses basic email regex validation
 */
export const isEmail = (value: unknown): value is string => {
  return isString(value) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
};

/**
 * Checks if value is a valid URL string
 * @param value - Value to check
 * @returns Type guard for URL string
 * @remarks Uses URL constructor for validation
 */
export const isUrl = (value: unknown): value is string => {
  if (!isString(value)) return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

/**
 * Checks if value is a valid UUID string
 * @param value - Value to check
 * @returns Type guard for UUID string
 * @remarks Supports both uppercase and lowercase UUIDs
 */
export const isUUID = (value: unknown): value is string => {
  if (!isString(value)) return false;
  const UuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return UuidPattern.test(value);
};

// ========================================
// 深度相等检查
// ========================================

/**
 * Deep equality check with custom comparator
 * @param value - First value to compare
 * @param other - Second value to compare
 * @param customizer - Optional custom comparison function
 * @returns True if values are deeply equal
 * @remarks Handles circular references, NaN equality, and various object types
 */
export const isEqualWith = (
  value: unknown,
  other: unknown,
  customizer?: (val1: unknown, val2: unknown) => boolean | void,
): boolean => {
  const stack = new WeakMap<object, Set<object>>();

  const baseEqual = (a: unknown, b: unknown): boolean => {
    // 1. 自定义比较逻辑
    if (customizer) {
      const result = customizer(a, b);
      if (result !== undefined) return result;
    }

    // 2. 基础引用相等及 NaN 处理
    if (a === b) return true;
    if (
      typeof a === 'number' &&
      typeof b === 'number' &&
      isNaN(a) &&
      isNaN(b)
    ) {
      return true;
    }
    if (a == null || b == null) return false;

    const tagA = getTag(a);
    const tagB = getTag(b);
    if (tagA !== tagB) return false;

    // 3. 循环引用检测
    if (typeof a === 'object' || typeof a === 'function') {
      const seenOther = stack.get(a);
      if (seenOther?.has(b)) return true;

      if (!seenOther) {
        stack.set(a, new Set([b]));
      } else {
        seenOther.add(b);
      }
    }

    // 4. 深度比较逻辑
    switch (tagA) {
      case '[object Date]':
      case '[object Number]':
        return +a === +b;
      case '[object RegExp]':
      case '[object String]':
        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        return String(a) === String(b);
      case '[object Array]': {
        const arrA = a as unknown[];
        const arrB = b as unknown[];
        if (arrA.length !== arrB.length) return false;
        return arrA.every((val, index) => baseEqual(val, arrB[index]));
      }
      case '[object Object]': {
        if (!isPlainObject(a) || !isPlainObject(b)) return false;
        const keysA = Object.keys(a);
        const keysB = Object.keys(b);
        if (keysA.length !== keysB.length) return false;
        return keysA.every((key) => {
          if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
          return baseEqual(a[key], b[key]);
        });
      }
      case '[object Map]': {
        const mapA = a as Map<unknown, unknown>;
        const mapB = b as Map<unknown, unknown>;
        if (mapA.size !== mapB.size) return false;
        for (const [key, val] of mapA) {
          if (!mapB.has(key) || !baseEqual(val, mapB.get(key))) return false;
        }
        return true;
      }
      case '[object Set]': {
        const setA = a as Set<unknown>;
        const setB = b as Set<unknown>;
        if (setA.size !== setB.size) return false;
        // Set 的比较依旧比较棘手，因为顺序无关
        // 但使用了数组缓存来避免重复查找
        const bValues = Array.from(setB);
        for (const item of setA) {
          const idx = bValues.findIndex((bVal) => baseEqual(item, bVal));
          if (idx === -1) return false;
          bValues.splice(idx, 1);
        }
        return true;
      }
      case '[object ArrayBuffer]': {
        const bufA = new Uint8Array(a as ArrayBuffer);
        const bufB = new Uint8Array(b as ArrayBuffer);
        if (bufA.length !== bufB.length) return false;
        for (let i = 0; i < bufA.length; i++) {
          if (bufA[i] !== bufB[i]) return false;
        }
        return true;
      }
      default:
        return false;
    }
  };

  return baseEqual(value, other);
};

/**
 * Deep equality check without custom comparator
 * @param value - First value to compare
 * @param other - Second value to compare
 * @returns True if values are deeply equal
 * @remarks Convenience wrapper for isEqualWith without customizer
 */
export const isEqual = (value: unknown, other: unknown): boolean => {
  return isEqualWith(value, other);
};
