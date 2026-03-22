// ========================================
// ./src/Utils/Functions/base.ts
// ========================================
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import {isPromiseLike} from 'src/helper';

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

export const noop = (): void => {};
export const asyncNoop = async (): Promise<void> => {};

/**
 * Creates a function that accepts up to one argument, ignoring any additional arguments.
 *
 * @template Args - The arguments tuple type.
 * @template Ret - The return type.
 * @param fn - The function to cap arguments for.
 * @returns The new function.
 */
export const unary = <T, Ret>(
  fn: (arg: T, ...rest: unknown[]) => Ret,
): ((arg: T) => Ret) => {
  return (arg) => fn(arg);
};

/**
 * Creates a function that negates the result of the predicate `fn`.
 *
 * @template Args - The arguments tuple type.
 * @param predicate - The predicate to negate.
 * @returns The new negated function.
 */
export const negate = <Args extends unknown[]>(
  predicate: (...args: Args) => boolean,
): ((...args: Args) => boolean) => {
  return (...args) => !predicate(...args);
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
): ((...args: Args) => Ret) => {
  let done = false;
  let result: Ret;

  return (...args) => {
    if (!done) {
      done = true;
      result = fn(...args);
    }
    return result;
  };
};

/**
 * Creates a function that invokes `fn` with only the first `n` arguments provided.
 *
 * @template Args - The arguments tuple type.
 * @template Ret - The return type.
 * @param fn - The function to cap arguments for.
 * @param n - The number of arguments to accept.
 * @returns The new function.
 */
export const ary = <Args extends unknown[], Ret>(
  fn: (...args: Args) => Ret,
  n: number,
): ((...args: Args) => Ret) => {
  return (...args) => fn(...(args.slice(0, n) as Args));
};

/**
 * Creates a function that invokes `fn` with arguments transformed.
 * The implementation splits arguments based on `fn.length`, expecting `fn` to take two arguments:
 * 1. A tuple of the first `fn.length - 1` arguments.
 * 2. A tuple of the remaining arguments.
 *
 * Note: Based on the implementation `fn.length - 1`, `FixedArgs` is strictly a single-element tuple.
 *
 * @template FixedArgs - The fixed arguments tuple (must be length 1).
 * @template RestArgs - The rest arguments tuple.
 * @template Ret - The return type.
 * @param fn - The function to transform arguments for.
 * @returns The new function.
 */
export const rest = <
  FixedArgs extends [unknown],
  RestArgs extends unknown[],
  Ret,
>(
  fn: (fixed: FixedArgs, rest: RestArgs) => Ret,
): ((...args: [...FixedArgs, ...RestArgs]) => Ret) => {
  return (...args) => {
    const fixedLength = fn.length > 0 ? fn.length - 1 : 0;
    const fixed = args.slice(0, fixedLength) as FixedArgs;
    const restParts = args.slice(fixedLength) as RestArgs;
    return fn(fixed, restParts);
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
): ((args: Args) => Ret) => {
  return (args) => fn(...args);
};

/**
 * Creates a function that invokes `fn` with `partial` arguments prepended to those provided to the new function.
 *
 * @template Fixed - The fixed arguments type.
 * @template Rest - The remaining arguments type.
 * @template Ret - The return type.
 * @param fn - The function to partially apply arguments to.
 * @param fixedArgs - The arguments to prepend.
 * @returns The new partially applied function.
 */
export const partial = <Fixed extends unknown[], Rest extends unknown[], Ret>(
  fn: (...args: [...Fixed, ...Rest]) => Ret,
  ...fixedArgs: Fixed
): ((...rest: Rest) => Ret) => {
  return (...restArgs) => fn(...fixedArgs, ...restArgs);
};

/**
 * Creates a function that invokes `fn` with `partial` arguments appended to those provided to the new function.
 *
 * @template Fixed - The fixed arguments type (appended).
 * @template Rest - The remaining arguments type.
 * @template Ret - The return type.
 * @param fn - The function to partially apply arguments to.
 * @param fixedArgs - The arguments to append.
 * @returns The new partially applied function.
 */
export const partialRight = <
  T extends (...args: any[]) => any,
  Fixed extends any[],
>(
  fn: T,
  ...fixedArgs: Fixed
): ((
  ...rest: T extends (...args: [...infer Rest, ...Fixed]) => any ? Rest : never
) => ReturnType<T>) => {
  return (...restArgs: any[]) => fn(...restArgs, ...fixedArgs);
};
/**
 * Creates a function that invokes `fn` only after being called `n` times.
 *
 * @template Args - The arguments type.
 * @template Ret - The return type.
 * @param n - The number of calls before the function is invoked.
 * @param fn - The function to restrict.
 * @returns The new restricted function.
 */
export const after = <Args extends unknown[], Ret>(
  n: number,
  fn: (...args: Args) => Ret,
): ((...args: Args) => Ret | undefined) => {
  let count = 0;
  return (...args) => {
    count++;
    if (count >= n) {
      return fn(...args);
    }
    return undefined;
  };
};

/**
 * Creates a function that invokes `fn` while it's called less than `n` times.
 *
 * @template Args - The arguments type.
 * @template Ret - The return type.
 * @param n - The number of calls before the function stops being invoked.
 * @param fn - The function to restrict.
 * @returns The new restricted function.
 */
export const before = <Args extends unknown[], Ret>(
  n: number,
  fn: (...args: Args) => Ret,
): ((...args: Args) => Ret | undefined) => {
  let count = 0;
  let lastResult: Ret | undefined;
  return (...args) => {
    if (count < n) {
      count++;
      lastResult = fn(...args);
    }
    return lastResult;
  };
};

/**
 * Creates a function that memoizes the result of `fn`.
 * If `resolver` is provided, it determines the cache key for storing the result based on the arguments provided.
 *
 * @template Args - The arguments type.
 * @template Ret - The return type.
 * @param fn - The function to memoize.
 * @param resolver - The function to resolve the cache key.
 * @returns The new memoized function.
 */
export const memoize = <Args extends unknown[], Ret>(
  fn: (...args: Args) => Ret,
  resolver?: (...args: Args) => unknown,
): ((...args: Args) => Ret) => {
  const cache = new Map<unknown, Ret>();
  return (...args) => {
    const key = resolver ? resolver(...args) : JSON.stringify(args);

    if (cache.has(key)) {
      return cache.get(key) as Ret;
    }
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
};

type AttemptResult<T> =
  T extends PromiseLike<infer R>
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
