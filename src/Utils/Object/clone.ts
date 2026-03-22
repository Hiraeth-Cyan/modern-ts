// ========================================
// ./src/Utils/Object/clone.ts
// ========================================

import {getTag} from '../Predicates';

/**
 * Special symbol indicating that a value should be skipped during cloning.
 * When returned by a customizer or encountered as a cloned value, the property will be omitted.
 * @example
 * const obj = { a: 1, b: 2 };
 * const cloned = cloneDeepWith(obj, (value) => value === 1 ? CLONE_FILTER : CLONE_DEFAULT);
 * // Result: { b: 2 }
 */
export const CLONE_FILTER = Symbol('Clone filter');

/**
 * Special symbol indicating that the default cloning logic should be used.
 * When returned by a customizer, the cloner will continue with its standard cloning procedure.
 */
export const CLONE_DEFAULT = Symbol('Clone default');

/**
 * Special symbol indicating that an empty slot should be created.
 * When returned by a customizer for array elements, the position will be kept as an empty slot.
 * @example
 * const arr = [1, 2, 3];
 * const cloned = cloneDeepWith(arr, (value, index) => {
 *   if (index === 1) return CLONE_HOLE; // Keep index 1 as empty slot
 *   return CLONE_DEFAULT;
 * });
 * // Result: [1, empty, 3] (sparse array, length: 3)
 * // cloned[1] === undefined, but 1 in cloned === false
 */
export const CLONE_HOLE = Symbol('Clone hole');

/**
 * Creates a shallow copy of a value.
 * @template T - Type of value to clone
 * @param value - Value to clone
 * @returns Shallow clone of the value
 * @remarks
 * - For primitive values (null, undefined, strings, numbers, booleans, symbols, bigints):
 *   Returns the value directly (no actual cloning needed)
 * - For arrays: Creates a new array with the same elements (reference copy)
 * - For plain objects: Creates a new object with the same enumerable properties (reference copy)
 * - For other object types (Dates, RegExps, etc.): Returns a shallow copy using spread operator
 *   which may not preserve special behaviors
 * @example
 * const arr = [1, 2, { a: 3 }];
 * const clonedArr = clone(arr);
 * clonedArr[2].a = 99; // Also modifies original array's object
 */
export const clone = <T>(value: T): T => {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return [...value] as T;
  if (value instanceof Date) return new Date(value.getTime()) as T;
  if (value instanceof RegExp)
    return new RegExp(value.source, value.flags) as T;
  return {...value} as T;
};

/**
 * Checks if the given key is a valid array index.
 * @param k - The key to check (must be a string or number)
 * @param n - Optional maximum index (defaults to 0, meaning no upper bound)
 * @returns True if the key is a valid array index, false otherwise
 */
export const isArrayIndex = (k: PropertyKey, n = 0): boolean =>
  typeof k !== 'symbol'
    ? ((n = Number(k)), n >>> 0 === n && n !== 0xffffffff && String(n) === k)
    : false;

/**
 * Customizer function for controlling cloning behavior.
 * @param value - Current value being cloned
 * @param key - Property key of the value (undefined for root)
 * @param object - Parent object containing the value (undefined for root)
 * @param stack - WeakMap tracking already visited objects for circular reference detection
 * @returns
 * - `CLONE_FILTER`: Skip this property (omit from result)
 * - `CLONE_DEFAULT`: Use default cloning logic
 * - Any other value: Use as the cloned result
 */
export type CloneCustomizer = (
  value: unknown,
  key: PropertyKey | undefined,
  object: object | undefined,
  stack: WeakMap<object, unknown>,
) => unknown;

/**
 * Represents a frame in the cloning stack for iterative processing.
 */
interface CloneFrame {
  source: object;
  target: object;
  tag: string;
  depth: number;
}

// Precompiled regex for performance optimization
const TYPED_ARRAY_TAG =
  /^\[object (?:Int8|Uint8|Uint8Clamped|Int16|Uint16|Int32|Uint32|Float32|Float64|BigInt64|BigUint64)Array\]$/;

// Generic structure for TypedArray, used for precise type assertions
interface TypedArrayLike {
  buffer: ArrayBuffer;
  byteOffset: number;
  length: number;
  constructor: new (
    buffer: ArrayBuffer,
    byteOffset: number,
    length: number,
  ) => TypedArrayLike;
}

/**
 * Internal base cloning implementation using an iterative approach to avoid call stack limits.
 * @template T
 * @param value - The value to clone
 * @param customizer - Optional customizer function for controlling cloning behavior
 * @param seen - WeakMap for tracking visited objects to detect circular references
 * @param depth - Maximum cloning depth
 * @param key - Current property key (undefined for root)
 * @param parent - Parent object (undefined for root)
 * @param stack - Stack for iterative processing of nested objects
 * @returns The cloned value
 */
function _baseClone<T>(
  value: T,
  customizer: CloneCustomizer | undefined,
  seen: WeakMap<object, unknown>,
  depth: number,
  key: PropertyKey | undefined = undefined,
  parent: object | undefined = undefined,
  stack: CloneFrame[] = [],
): T {
  if (depth <= 0) return value;

  if (customizer) {
    const result = customizer(value, key, parent, seen);
    if (result !== CLONE_DEFAULT) {
      return result as T;
    }
  }

  if (value === null || typeof value !== 'object') return value;

  if (seen.has(value)) return seen.get(value) as T;

  const tag = getTag(value);

  if (
    tag === '[object Promise]' ||
    tag === '[object Function]' ||
    typeof value === 'function'
  ) {
    return value;
  }

  let result: unknown;

  switch (tag) {
    case '[object ArrayBuffer]': {
      const buffer = value as unknown as ArrayBuffer;
      result = buffer.slice(0);
      seen.set(value, result);
      return result as T;
    }

    case '[object WeakMap]': {
      result = new WeakMap();
      seen.set(value, result);
      return result as T;
    }

    case '[object WeakSet]': {
      result = new WeakSet();
      seen.set(value, result);
      return result as T;
    }

    case '[object Date]': {
      result = new Date((value as unknown as Date).getTime());
      break;
    }

    case '[object RegExp]': {
      const r = value as unknown as RegExp;
      result = new RegExp(r.source, r.flags);
      (result as RegExp).lastIndex = r.lastIndex;
      break;
    }

    case '[object Error]': {
      const e = value as unknown as Error;
      // 保留原型链
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      result = Object.create(Object.getPrototypeOf(e));
      // 获取源对象所有自身的属性描述符（包括 code, message, name, stack 等）
      const descriptors = Object.getOwnPropertyDescriptors(e);
      // 将这些描述符定义到新对象上
      Object.defineProperties(result, descriptors);
      break;
    }

    case '[object Array]': {
      result = [];
      break;
    }

    case '[object Map]': {
      result = new Map();
      break;
    }

    case '[object Set]': {
      result = new Set();
      break;
    }

    case '[object DataView]': {
      const dv = value as unknown as DataView;
      const buf = _baseClone(
        dv.buffer,
        customizer,
        seen,
        depth - 1,
        'buffer',
        dv,
        stack,
      );
      result = new DataView(buf as ArrayBuffer, dv.byteOffset, dv.byteLength);
      break;
    }

    default: {
      if (TYPED_ARRAY_TAG.test(tag)) {
        const ta = value as unknown as TypedArrayLike;
        const buf = _baseClone(
          ta.buffer,
          customizer,
          seen,
          depth - 1,
          'buffer',
          ta,
          stack,
        );
        result = new ta.constructor(buf, ta.byteOffset, ta.length);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        result = Object.create(Object.getPrototypeOf(value));
      }
      break;
    }
  }

  seen.set(value, result);

  stack.push({
    source: value as object,
    target: result as object,
    tag,
    depth: depth - 1,
  });

  return result as T;
}

/**
 * Helper function: clones enumerable properties of an object (including string keys and Symbol keys).
 * @param source - The source object to clone properties from
 * @param target - The target object to clone properties to
 * @param depth - Current cloning depth
 * @param customizer - Optional customizer function for controlling cloning behavior
 * @param seen - WeakMap for tracking visited objects
 * @param stack - Stack for iterative processing of nested objects
 */
function cloneProperties(
  source: object,
  target: object,
  depth: number,
  customizer: CloneCustomizer | undefined,
  seen: WeakMap<object, unknown>,
  stack: CloneFrame[],
): void {
  const isArray = Array.isArray(source);

  // Handle string keys
  const keys = Object.keys(source);
  const keysLength = keys.length;
  for (let i = 0; i < keysLength; i++) {
    const k = keys[i];
    if (isArray && isArrayIndex(k)) continue;

    const clonedValue = _baseClone(
      (source as Record<PropertyKey, unknown>)[k],
      customizer,
      seen,
      depth,
      k,
      source,
      stack,
    );

    if (clonedValue !== CLONE_FILTER) {
      (target as Record<PropertyKey, unknown>)[k] = clonedValue;
    }
  }

  // Handle Symbol keys
  const symbols = Object.getOwnPropertySymbols(source);
  const symbolsLength = symbols.length;
  for (let i = 0; i < symbolsLength; i++) {
    const k = symbols[i];
    const descriptor = Object.getOwnPropertyDescriptor(source, k);
    if (descriptor?.enumerable) {
      const clonedValue = _baseClone(
        (source as Record<PropertyKey, unknown>)[k],
        customizer,
        seen,
        depth,
        k,
        source,
        stack,
      );

      if (clonedValue !== CLONE_FILTER) {
        (target as Record<PropertyKey, unknown>)[k] = clonedValue;
      }
    }
  }
}

/**
 * Processes the stack of frames to perform deep cloning iteratively.
 * @param stack - Stack of frames to process
 * @param customizer - Optional customizer function for controlling cloning behavior
 * @param seen - WeakMap for tracking visited objects
 */
function processStack(
  stack: CloneFrame[],
  customizer: CloneCustomizer | undefined,
  seen: WeakMap<object, unknown>,
): void {
  while (stack.length > 0) {
    const frame = stack.pop()!;
    const {source, target, tag, depth} = frame;

    switch (tag) {
      case '[object Array]': {
        const arr = source as unknown[];
        const tgt = target as unknown[];
        const arrLength = arr.length;

        tgt.length = 0;

        for (let i = 0; i < arrLength; i++) {
          if (!(i in arr)) {
            tgt.length++;
            continue;
          }

          const clonedItem = _baseClone(
            arr[i],
            customizer,
            seen,
            depth,
            i,
            arr,
            stack,
          );

          if (clonedItem === CLONE_FILTER) {
            continue;
          }

          if (clonedItem === CLONE_HOLE) {
            tgt.length++;
          } else {
            tgt.push(clonedItem);
          }
        }

        cloneProperties(source, target, depth, customizer, seen, stack);
        break;
      }

      case '[object Map]': {
        const map = source as Map<unknown, unknown>;
        const tgt = target as Map<unknown, unknown>;

        map.forEach((v, k) => {
          const clonedKey = _baseClone(
            k,
            customizer,
            seen,
            depth,
            k as PropertyKey,
            map,
            stack,
          );

          if (clonedKey !== CLONE_FILTER) {
            const clonedVal = _baseClone(
              v,
              customizer,
              seen,
              depth,
              k as PropertyKey,
              map,
              stack,
            );
            if (clonedVal !== CLONE_FILTER) {
              tgt.set(clonedKey, clonedVal);
            }
          }
        });

        cloneProperties(source, target, depth, customizer, seen, stack);
        break;
      }

      case '[object Set]': {
        const set = source as Set<unknown>;
        const tgt = target as Set<unknown>;

        set.forEach((v) => {
          const clonedVal = _baseClone(
            v,
            customizer,
            seen,
            depth,
            v as PropertyKey,
            set,
            stack,
          );
          if (clonedVal !== CLONE_FILTER) {
            tgt.add(clonedVal);
          }
        });

        cloneProperties(source, target, depth, customizer, seen, stack);
        break;
      }

      default: {
        cloneProperties(source, target, depth, customizer, seen, stack);
        break;
      }
    }
  }
}

/**
 * Creates a deep clone of a value.
 * @template T - Type of value to clone
 * @param value - Value to clone
 * @param depth - Maximum cloning depth (default: Infinity)
 * @returns Deep clone of the value
 */
export const cloneDeep = <T>(value: T, depth: number = Infinity): T => {
  const stack: CloneFrame[] = [];
  const seen = new WeakMap<object, unknown>();
  const result = _baseClone(
    value,
    undefined,
    seen,
    depth,
    undefined,
    undefined,
    stack,
  );
  processStack(stack, undefined, seen);
  return result;
};

/**
 * Creates a deep clone of a value with custom transformation logic.
 * @template T - Type of value to clone
 * @param value - Value to clone
 * @param customizer - Customizer function for controlling cloning behavior
 * @param depth - Maximum cloning depth (default: Infinity)
 * @returns Deep clone of the value with custom transformations
 */
export const cloneDeepWith = <T>(
  value: T,
  customizer: CloneCustomizer,
  depth: number = Infinity,
): T => {
  const stack: CloneFrame[] = [];
  const seen = new WeakMap<object, unknown>();
  const result = _baseClone(
    value,
    customizer,
    seen,
    depth,
    undefined,
    undefined,
    stack,
  );
  processStack(stack, customizer, seen);
  return result;
};
