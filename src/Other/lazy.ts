// ========================================
// ./src/Other/lazy.ts
// ========================================
import type {AsyncResult, Result} from '../Result/types';
import {Ok, Err} from '../Result/base';
import {UnknownError} from '../unknown-error';

/**
 * @typeParam T - The success value type.
 */
export type Lazy<T> = () => T;

/**
 * @typeParam T - The success value type.
 */
export type LazyAsync<T> = (signal?: AbortSignal) => Promise<T>;

/**
 * Wraps a concrete value into a synchronous Lazy function.
 * @typeParam T - The type of the value.
 * @param {T} value - The value to be lazily returned.
 * @returns {Lazy<T>} A Lazy function that always returns the value.
 */
export const wrap =
  <T>(value: T): Lazy<T> =>
  () =>
    value;
/**
 * Executes a synchronous Lazy function immediately.
 * @typeParam T - The return type of the function.
 * @param {Lazy<T>} fn - The Lazy function to execute.
 * @returns {T} The computed result of the Lazy function.
 */
export const run = <T>(fn: Lazy<T>): T => fn();

/**
 * Wraps a concrete value into an asynchronous LazyAsync function.
 * @typeParam T - The type of the value.
 * @param {T} value - The value to be lazily returned.
 * @returns {LazyAsync<T>} A LazyAsync function that asynchronously returns the value.
 */
export const wrapAsync =
  <T>(value: T): LazyAsync<T> =>
  // eslint-disable-next-line @typescript-eslint/require-await
  async () =>
    value;

/**
 * Executes an asynchronous LazyAsync function immediately with optional abort signal.
 * @typeParam T - The return type of the promise.
 * @param {LazyAsync<T>} fn - The LazyAsync function to execute.
 * @param {AbortSignal} [signal] - Optional AbortSignal to abort the operation.
 * @returns {Promise<T>} The asynchronous computed result.
 */
export const runAsync = async <T>(
  fn: LazyAsync<T>,
  signal?: AbortSignal,
): Promise<T> => fn(signal);

/**
 * Executes a Lazy function only once and caches the result (Memoization).
 * @typeParam T - The type of the computed value.
 * @param {Lazy<T>} fn - The Lazy function to memoize.
 * @returns {Lazy<T>} The memoized Lazy function.
 */
export function Memoized<T>(fn: Lazy<T>): Lazy<T> {
  let result: {value: T} | undefined = undefined;
  return () => {
    if (result === undefined) {
      const computed_value = fn();
      result = {value: computed_value};
    }
    return result.value;
  };
}
/**
 * Executes a LazyAsync function only once and caches the resulting Promise.
 * Accepts AbortSignal which is passed to the underlying function on first call.
 * Clears cache on abort to allow retries.
 * @typeParam T - The type of the computed value.
 * @param {LazyAsync<T>} fn - The LazyAsync function to memoize.
 * @returns {LazyAsync<T>} The memoized LazyAsync function.
 */
export function AsyncMemoized<T>(fn: LazyAsync<T>): LazyAsync<T> {
  let promise_cache: Promise<T> | undefined = undefined;
  return async (signal?: AbortSignal) => {
    if (promise_cache === undefined) {
      promise_cache = fn(signal);
      // 若中止，清理缓存以便下次重试
      promise_cache.catch(() => {
        promise_cache = undefined;
      });
    }
    return promise_cache;
  };
}

/**
 * Executes a Lazy function within a try-catch block and ensures cleanup runs.
 * Captures synchronous exceptions and wraps the result in Result.
 * @typeParam T - The type of the success value.
 * @param {Lazy<T>} fn - The Lazy function to execute.
 * @param {() => void} [cleaner] - Optional synchronous cleanup function.
 * @returns {Result<T, UnknownError>} Ok(T) on success, or Err(UnknownError) on exception.
 */
export function runWithCleanup<T>(
  fn: Lazy<T>,
  cleaner?: () => void,
): Result<T, UnknownError> {
  try {
    return Ok(fn());
  } catch (e) {
    return Err(UnknownError.from(e));
  } finally {
    cleaner?.();
  }
}

/**
 * Executes LazyAsync with cleanup and abort support.
 * @typeParam T - The type of the success value.
 * @param {LazyAsync<T>} fn - The LazyAsync function to execute.
 * @param {() => void | Promise<void>} [cleaner] - Optional cleanup function.
 * @param {AbortSignal} [signal] - Optional AbortSignal to abort the operation. ✨ 新增参数
 * @returns {AsyncResult<T, UnknownError>}
 */
export async function runAsyncWithCleanup<T>(
  fn: LazyAsync<T>,
  cleaner?: () => void | Promise<void>,
  signal?: AbortSignal,
): AsyncResult<T, UnknownError> {
  try {
    return Ok(await fn(signal));
  } catch (e) {
    return Err(UnknownError.from(e));
  } finally {
    await cleaner?.();
  }
}
/**
 * Maps the result of a Lazy function to a new Lazy function (Functor map).
 * @typeParam T - The input value type.
 * @typeParam U - The output value type.
 * @param {Lazy<T>} fn - The input Lazy function.
 * @param {(value: T) => U} mapper - The synchronous mapping function.
 * @returns {Lazy<U>} The composed Lazy function.
 */
export const map =
  <T, U>(fn: Lazy<T>, mapper: (value: T) => U): Lazy<U> =>
  () =>
    mapper(fn());

/**
 * Maps async LazyAsync result with abort support.
 * @typeParam T - The input value type.
 * @typeParam U - The output value type.
 * @param {LazyAsync<T>} fn - The input LazyAsync function.
 * @param {(value: T) => U | Promise<U>} mapper - Mapping function.
 * @returns {LazyAsync<U>} Composed LazyAsync function.
 */
export const mapAsync =
  <T, U>(
    fn: LazyAsync<T>,
    mapper: (value: T) => U | Promise<U>,
  ): LazyAsync<U> =>
  async (signal?: AbortSignal) =>
    mapper(await fn(signal));

/**
 * Monadic bind operation (flatMap) for Lazy. Composes two Lazy functions.
 * @typeParam T - The input value type.
 * @typeParam U - The output value type.
 * @param {Lazy<T>} fn - The initial Lazy function.
 * @param {(value: T) => Lazy<U>} mapper - Maps the result T to a new Lazy<U>.
 * @returns {Lazy<U>} The flattened composed Lazy function.
 */
export const andThen =
  <T, U>(fn: Lazy<T>, mapper: (value: T) => Lazy<U>): Lazy<U> =>
  () =>
    run(mapper(fn()));

/**
 * Async monadic bind (flatMap) with abort support.
 * @typeParam T - The input value type.
 * @typeParam U - The output value type.
 * @param {LazyAsync<T>} fn - Initial LazyAsync function.
 * @param {(value: T) => LazyAsync<U>} mapper - Maps to new LazyAsync.
 * @returns {LazyAsync<U>} Flattened composed function.
 */
export const andThenAsync =
  <T, U>(fn: LazyAsync<T>, mapper: (value: T) => LazyAsync<U>): LazyAsync<U> =>
  async (signal?: AbortSignal) => {
    const value = await fn(signal);
    return runAsync(mapper(value), signal);
  };

/**
 * Combines the results of two Lazy functions into a tuple.
 * @typeParam T - The type of the first value.
 * @typeParam U - The type of the second value.
 * @param {Lazy<T>} fn1 - The first Lazy function.
 * @param {Lazy<U>} fn2 - The second Lazy function.
 * @returns {Lazy<[T, U]>} A Lazy function returning the tuple [T, U].
 */
export const zip =
  <T, U>(fn1: Lazy<T>, fn2: Lazy<U>): Lazy<[T, U]> =>
  () => [fn1(), fn2()];

/**
 * Concurrent execution of two LazyAsync with shared abort signal.
 * @typeParam T - First value type.
 * @typeParam U - Second value type.
 * @param {LazyAsync<T>} fn1 - First LazyAsync function.
 * @param {LazyAsync<U>} fn2 - Second LazyAsync function.
 * @returns {LazyAsync<[T, U]>} Tuple result function.
 */
export const zipAsync =
  <T, U>(fn1: LazyAsync<T>, fn2: LazyAsync<U>): LazyAsync<[T, U]> =>
  async (signal?: AbortSignal) =>
    Promise.all([fn1(signal), fn2(signal)]);
