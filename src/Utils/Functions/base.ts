// ========================================
// ./src/Utils/Functions/base.ts
// ========================================

import {isPromiseLike} from 'src/helper';
import type {AnyFunction} from '../type-tool';

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
 * Creates a function that accepts up to one argument, ignoring any additional arguments.
 *
 * @template F - The function type.
 * @param fn - The function to cap arguments for.
 * @returns The new function.
 */
export const unary = <F extends AnyFunction>(
  fn: F,
): ((this: ThisParameterType<F>, arg: Parameters<F>[0]) => ReturnType<F>) => {
  return function (this: ThisParameterType<F>, arg: Parameters<F>[0]) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return fn.call(this, arg);
  };
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

// -- Internal Types for ary --

/**
 * Checks if the function has a rest parameter (...args) by comparing the length
 * of the parameter array to the length of the parameter array with placeholders replaced.
 * @template A - The parameter array of the function
 */
type IsRestParameter<A extends readonly unknown[]> = number extends A['length']
  ? true
  : false;

/**
 * Extracts the element type at a specific index from a tuple, preserving optionality.
 * @template T - The tuple type
 * @template I - The index to extract
 */
type ExtractElement<
  T extends readonly unknown[],
  I extends number,
> = T extends readonly unknown[] ? (I extends keyof T ? T[I] : never) : never;

/**
 * Builds a tuple of length N by extracting elements from T, preserving optionality.
 * @template T - The source tuple
 * @template N - The target length
 * @template Acc - Accumulator for recursion
 */
type TakePreserveOptional<
  T extends readonly unknown[],
  N extends number,
  Acc extends readonly unknown[] = [],
> = Acc['length'] extends N
  ? Acc
  : TakePreserveOptional<T, N, [...Acc, ExtractElement<T, Acc['length']>]>;

/**
 * Overloaded type definition for the `ary` function.
 * Provides precise type inference based on the arity parameter.
 * For functions with rest parameters, the returned function still accepts any number of arguments.
 * @template F - The function type
 * @template N - The number of arguments to accept (must be a literal number)
 */
type Ary<F, N extends number> = F extends (...args: infer A) => infer R
  ? number extends N
    ? {
        readonly __error: 'The arity parameter must be a literal number (e.g., 2), not a variable of type number.';
      }
    : IsRestParameter<A> extends true
      ? (this: ThisParameterType<F>, ...args: A) => R
      : TakePreserveOptional<A, N> extends infer P
        ? P extends readonly unknown[]
          ? (this: ThisParameterType<F>, ...args: P) => R
          : never
        : never
  : never;

/**
 * Creates a function that invokes `fn` with only the first `n` arguments provided.
 *
 * @template F - The function type.
 * @template N - The number of arguments to accept (must be a literal number).
 * @param fn - The function to cap arguments for.
 * @param n - The number of arguments to accept.
 * @returns The new function with capped arguments.
 */
export const ary = <F extends AnyFunction, N extends number>(
  fn: F,
  n: N,
): Ary<F, N> => {
  return function (this: ThisParameterType<F>, ...args: unknown[]) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return fn.apply(this, args.slice(0, n));
  } as Ary<F, N>;
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
): ((this: ThisParameterType<typeof fn>, ...rest: Rest) => Ret) => {
  return function (this: ThisParameterType<typeof fn>, ...restArgs: Rest) {
    return fn.apply(this, [...fixedArgs, ...restArgs] as Parameters<typeof fn>);
  };
};

/**
 * Extracts the remaining arguments from a function's parameter tuple after fixed arguments are removed from the end.
 * @template T - The function's parameter tuple
 * @template Fixed - The fixed arguments to remove from the end
 */
type ExtractRest<
  T extends readonly unknown[],
  Fixed extends readonly unknown[],
> = T extends [...infer Rest, ...Fixed] ? Rest : never;

/**
 * Creates a function that invokes `fn` with `partial` arguments appended to those provided to the new function.
 *
 * @template T - The function type.
 * @template Fixed - The fixed arguments type (appended).
 * @param fn - The function to partially apply arguments to.
 * @param fixedArgs - The arguments to append.
 * @returns The new partially applied function.
 */
export const partialRight = <T extends AnyFunction, Fixed extends unknown[]>(
  fn: T,
  ...fixedArgs: Fixed
): ((
  this: ThisParameterType<T>,
  ...rest: ExtractRest<Parameters<T>, Fixed>
) => ReturnType<T>) => {
  return function (
    this: ThisParameterType<T>,
    ...restArgs: ExtractRest<Parameters<T>, Fixed>
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return Reflect.apply(fn, this, [...restArgs, ...fixedArgs]);
  };
};

export const NOT_INVOKED = Symbol('notInvoked');
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
  resolver?: (this: ThisParameterType<typeof fn>, ...args: Args) => unknown,
): ((this: ThisParameterType<typeof fn>, ...args: Args) => Ret) => {
  const cache = new Map<unknown, Ret>();
  return function (this: ThisParameterType<typeof fn>, ...args: Args) {
    const key = resolver ? resolver.apply(this, args) : JSON.stringify(args);

    if (cache.has(key)) return cache.get(key) as Ret;
    const result = fn.apply(this, args);
    cache.set(key, result);
    return result;
  };
};

type AttemptResult<T> = [T] extends [never]
  ? [unknown, undefined]
  : 0 extends 1 & T
    ? [undefined, T] | [unknown, undefined]
    : T extends PromiseLike<infer R>
      ? PromiseLike<[undefined, R] | [unknown, undefined]>
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
