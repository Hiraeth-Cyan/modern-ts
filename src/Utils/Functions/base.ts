// ========================================
// ./src/Utils/Functions/base.ts
// ========================================

import {dynamicAwait, isPromiseLike} from 'src/helper';
import type {AnyFunction, MaybePromise} from '../type-tool';

/**
 * Generic type for an identity function.
 * @template T - The type of the input and output value.
 */
export type IdentityFn = <T>(x: T) => T;

/**
 * A function that returns the same value passed to it.
 * @template T
 * @param x - The value to return
 * @returns The input value `x`
 * @satisfies {IdentityFn}
 */
export const identity: IdentityFn = (x) => x;

/**
 * A function that does nothing.
 * @returns `undefined`
 */
export const noop = (): void => {};

/**
 * A function that does nothing asynchronously.
 * @returns A promise that resolves to `undefined`.
 */
export const asyncNoop = async (): Promise<void> => {};

/**
 * Creates a function that negates the result of the predicate `fn`.
 *
 * @template Args - The arguments tuple type.
 * @param predicate - The predicate to negate.
 * @returns The new negated function.
 */
export const negate = <Args extends unknown[]>(
  predicate: (...args: Args) => boolean,
): ((this: ThisParameterType<typeof predicate>, ...args: Args) => boolean) => {
  return function (this: ThisParameterType<typeof predicate>, ...args: Args) {
    return !predicate.apply(this, args);
  };
};

/**
 * Creates a function that is restricted to invoking `fn` once.
 * Repeat calls to the function return the value of the first invocation.
 *
 * @template Args - The arguments tuple type.
 * @template Ret - The return type.
 * @param fn - The function to restrict.
 * @returns The new restricted function.
 */
export const once = <Args extends unknown[], Ret>(
  fn: (...args: Args) => Ret,
): ((this: ThisParameterType<typeof fn>, ...args: Args) => Ret) => {
  let done = false;
  let result: Ret;
  return function (this: ThisParameterType<typeof fn>, ...args: Args) {
    if (!done) {
      result = fn.apply(this, args);
      done = true;
    }
    return result;
  };
};

/**
 * Creates a function that invokes `fn` with arguments transformed.
 * The implementation splits arguments based on `fn.length`, expecting `fn` to take two arguments:
 * 1. A tuple of the first `fn.length - 1` arguments.
 * 2. A tuple of the remaining arguments.
 *
 * @template FixedArgs - The fixed arguments tuple.
 * @template RestArgs - The rest arguments tuple.
 * @template Ret - The return type.
 * @param fn - The function to transform arguments for.
 * @returns The new function.
 */
export const rest = <
  FixedArgs extends unknown[],
  RestArgs extends unknown[],
  Ret,
>(
  fn: (fixed: FixedArgs, rest: RestArgs) => Ret,
): ((
  this: ThisParameterType<typeof fn>,
  ...args: [...FixedArgs, ...RestArgs]
) => Ret) => {
  return function (
    this: ThisParameterType<typeof fn>,
    ...args: [...FixedArgs, ...RestArgs]
  ) {
    const fixedLength = fn.length > 0 ? fn.length - 1 : 0;
    const fixed = args.slice(0, fixedLength) as FixedArgs;
    const restParts = args.slice(fixedLength) as RestArgs;
    return fn.call(this, fixed, restParts);
  };
};

/**
 * Creates a function that invokes `fn` with the `args` spread as an array.
 *
 * @template Args - The arguments tuple type.
 * @template Ret - The return type.
 * @param fn - The function to spread arguments for.
 * @returns The new function.
 */
export const spread = <Args extends unknown[], Ret>(
  fn: (...args: Args) => Ret,
): ((this: ThisParameterType<typeof fn>, args: Args) => Ret) => {
  return function (this: ThisParameterType<typeof fn>, args: Args) {
    return fn.apply(this, args);
  };
};

/**
 * Symbolic placeholder for a value that has not been invoked.
 */
export const NOT_INVOKED = Symbol('notInvoked');
/**
 * The type of the symbolic placeholder for a value that has not been invoked.
 */
export type NotInvoked = typeof NOT_INVOKED;

/**
 * Creates a function that invokes `fn` only after being called `n` times.
 * Repeat calls return the result of the first invocation that met the threshold.
 *
 * @template Args - The arguments type.
 * @template Ret - The return type.
 * @param n - The number of calls before the function is invoked.
 * @param fn - The function to restrict.
 * @returns The new restricted function that returns `Ret | NotInvoked`.
 *          Check `result === NOT_INVOKED` to determine if `fn` was actually called.
 */
export const after = <Args extends unknown[], Ret>(
  n: number,
  fn: (...args: Args) => Ret,
): ((
  this: ThisParameterType<typeof fn>,
  ...args: Args
) => Ret | NotInvoked) => {
  let count = 0;
  return function (this: ThisParameterType<typeof fn>, ...args: Args) {
    count++;
    if (count >= n) return fn.apply(this, args);
    return NOT_INVOKED;
  };
};

/**
 * Creates a function that invokes `fn` while it's called less than `n` times.
 * Subsequent calls return the last result from the last successful invocation.
 *
 * @template Args - The arguments type.
 * @template Ret - The return type.
 * @param n - The number of calls before the function stops being invoked.
 * @param fn - The function to restrict.
 * @returns The new restricted function that returns `Ret | NotInvoked`.
 *          Check `result === NOT_INVOKED` to determine if `fn` was actually called.
 */
export const before = <Args extends unknown[], Ret>(
  n: number,
  fn: (...args: Args) => Ret,
): ((
  this: ThisParameterType<typeof fn>,
  ...args: Args
) => Ret | NotInvoked) => {
  let count = 0;
  let lastResult: Ret | typeof NOT_INVOKED = NOT_INVOKED;
  return function (this: ThisParameterType<typeof fn>, ...args: Args) {
    if (count < n) {
      count++;
      lastResult = fn.apply(this, args);
    }
    return lastResult;
  };
};

/**
 * Cache interface for memoization.
 *
 * @template K - The cache key type.
 * @template V - The cached value type.
 */
export interface MemoizeCache<K, V> {
  /**
   * Stores a value with the specified key.
   *
   * @param key - The key to associate with the value.
   * @param value - The value to store.
   */
  set(key: K, value: V): void;

  /**
   * Retrieves a value by its key.
   *
   * @param key - The key to look up.
   * @returns The cached value, or undefined if not found.
   */
  get(key: K): V | undefined;

  /**
   * Checks if a key exists in the cache.
   *
   * @param key - The key to check.
   * @returns True if the key exists.
   */
  has(key: K): boolean;

  /**
   * Deletes a value by its key.
   *
   * @param key - The key to delete.
   * @returns True if deleted successfully.
   */
  delete(key: K): boolean | void;

  /**
   * Clears all cached values.
   */
  clear(): void;

  /**
   * The number of entries in the cache.
   */
  readonly size: number;
}

/**
 * Options for creating a memoized function.
 *
 * @template K - The cache key type.
 * @template V - The cached value type.
 * @template Args - The function arguments type.
 */
export interface MemoizeOptions<K, V, Args extends unknown[] = unknown[]> {
  /**
   * The cache instance to use for storing results.
   * Defaults to a new Map if not provided.
   */
  cache?: MemoizeCache<K, V>;

  /**
   * A function to generate the cache key from the function arguments.
   * Defaults to JSON.stringify of all arguments if not provided.
   */
  getCacheKey?: (...args: Args) => K;
}

/**
 * Creates a function that memoizes the result of `fn` using a configurable cache strategy.
 *
 * @template F - The function type to memoize.
 * @param fn - The function to memoize.
 * @param options - The memoization options including cache strategy and key generator.
 * @returns The new memoized function with a `cache` property attached.
 */
export function memoize<F extends AnyFunction>(
  fn: F,
  options: MemoizeOptions<unknown, ReturnType<F>, Parameters<F>> = {},
): F & {cache: MemoizeCache<unknown, ReturnType<F>>} {
  const {cache = new Map<unknown, ReturnType<F>>(), getCacheKey} = options;

  const memoizedFn = function (
    this: unknown,
    ...args: Parameters<F>
  ): ReturnType<F> {
    const key = getCacheKey ? getCacheKey(...args) : JSON.stringify(args);

    if (cache.has(key)) return cache.get(key) as ReturnType<F>;

    const result = fn.apply(this, args) as ReturnType<F>;
    cache.set(key, result);
    return result;
  };

  memoizedFn.cache = cache;

  return memoizedFn as F & {cache: MemoizeCache<unknown, ReturnType<F>>};
}

type AttemptResult<T> = [T] extends [never]
  ? [unknown, undefined]
  : 0 extends 1 & T
    ? [undefined, T] | [unknown, undefined]
    : T extends PromiseLike<infer R>
      ? Promise<[undefined, R] | [unknown, undefined]>
      : [undefined, T] | [unknown, undefined];

/**
 *
 * Wraps any function – synchronous or asynchronous – and returns a tuple `[error, result]` instead of throwing.
 * It catches **everything**: thrown exceptions and rejected promises alike, turning them into a consistent error-first return.
 * Eliminates try-catch blocks and makes error handling explicit and type‑safe.
 *
 * @template Args - The arguments tuple type of the wrapped function
 * @template R - The return type of the wrapped function
 * @param fn - The function to wrap
 * @returns A function that returns `[undefined, result]` on success, or `[error, undefined]` on failure
 *
 * @example
 * ```typescript
 * const [err, data] = attempt(JSON.parse)('{"a":1}');
 * if (err) console.error('Parse failed:', err);
 * else console.log('Parsed:', data);
 * ```
 *
 * @example
 * ```typescript
 * // Works seamlessly with async functions
 * const fetchData = async (url: string) => ({ data: 'response' });
 * const [err, data] = await attempt(fetchData)('https://api.example.com');
 * ```
 */
export const attempt = <Args extends unknown[], R>(
  fn: (...args: Args) => R,
): ((
  this: ThisParameterType<typeof fn>,
  ...args: Args
) => AttemptResult<R>) => {
  return function (
    this: ThisParameterType<typeof fn>,
    ...args: Args
  ): AttemptResult<R> {
    try {
      const result = fn.apply(this, args);

      // 处理异步函数
      if (isPromiseLike(result))
        return (result as PromiseLike<R>).then(
          (value) => [undefined, value],
          (err: unknown) => [err, undefined],
        ) as AttemptResult<R>;

      // 处理同步函数
      return [undefined, result] as AttemptResult<R>;
    } catch (err) {
      return [err, undefined] as AttemptResult<R>;
    }
  };
};

/**
 * Symbol used to indicate no error occurred during task execution.
 */
export const DEFER_NO_ERROR = Symbol('No Error');

/**
 * Type for error callback functions registered with defer.
 * @param error - The error from the task, or DEFER_NO_ERROR if task succeeded
 * @returns A promise or value (return value is ignored)
 */
type DeferErrorCallback = (error: unknown) => unknown;

/**
 * Function type for registering cleanup/error callbacks.
 * @param fn - The callback function to register
 */
type DeferRegisterFn = (fn: DeferErrorCallback) => void;

/**
 * Executes a task with deferred cleanup/error handling callbacks.
 *
 * This function provides a resource management pattern similar to try-finally,
 * but with support for async cleanup and multiple callbacks. Callbacks are
 * executed in reverse order (LIFO) regardless of task success or failure.
 *
 * @template R - The type of the task result
 * @param task - A function that receives a register function and returns a result
 * @returns A promise that resolves with the task result
 * @throws {AggregateError} If both the task and callbacks fail, or if multiple callbacks fail
 * @throws {unknown} If only the task fails and callbacks succeed, the original error is thrown
 * @throws {AggregateError} If only callbacks fail, an AggregateError is thrown
 *
 * @example
 * ```typescript
 * const result = await defer(async (register) => {
 *   const resource = acquireResource();
 *   register(async (error) => {
 *     await resource.release();
 *   });
 *   return resource.use();
 * });
 * ```
 */
export const defer = async <R>(
  task: (register: DeferRegisterFn) => MaybePromise<R>,
) => {
  const callbacks: DeferErrorCallback[] = [];
  const register = (fn: DeferErrorCallback) => void callbacks.push(fn);
  let result_value: R;
  let error_arg: unknown = DEFER_NO_ERROR;
  const callback_errors: unknown[] = [];

  try {
    result_value = await dynamicAwait(task(register));
  } catch (e) {
    error_arg = e;
  } finally {
    for (let i = callbacks.length - 1; i >= 0; i--)
      try {
        await callbacks[i](error_arg);
      } catch (e) {
        callback_errors.push(e);
      }
  }
  if (error_arg !== DEFER_NO_ERROR) {
    if (callback_errors.length > 0) {
      const all_errors = [error_arg, ...callback_errors];
      throw new AggregateError(all_errors, 'defer: task and callbacks failed');
    }
    throw error_arg;
  }
  if (callback_errors.length > 0)
    throw new AggregateError(callback_errors, 'defer: callbacks failed');

  return result_value!;
};
