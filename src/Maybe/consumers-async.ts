// ========================================
// ./src/Maybe/consumers-async.ts
// ========================================

import {isNone, isSome} from './base';
import type {AnyMaybe, Maybe} from './types';
import type {MaybePromise} from '../Utils/type-tool';
import {dynamicAwait} from '../helper';

// ========================================
// 分支控制流
// ========================================

/**
 * Asynchronously pattern matches on a Maybe value, executing the appropriate callback
 * @param val - The Maybe value or Promise of Maybe to match on
 * @param onSome - Callback executed when value is Some
 * @param onNone - Callback executed when value is None
 * @param signal - Optional AbortSignal for cancellation
 * @returns Promise resolving to the result of the executed callback
 */
export async function matchAsync<T, R>(
  val: AnyMaybe<T>,
  onSome: (value: T, signal?: AbortSignal) => MaybePromise<R>,
  onNone: (signal?: AbortSignal) => MaybePromise<R>,
  signal?: AbortSignal,
): Promise<R> {
  signal?.throwIfAborted();
  const unwrapped = await val;

  if (isSome(unwrapped)) {
    const res = await dynamicAwait(onSome(unwrapped, signal));
    signal?.throwIfAborted();
    return res;
  } else {
    const res = await dynamicAwait(onNone(signal));
    signal?.throwIfAborted();
    return res;
  }
}

/**
 * Executes callback only if Maybe value is Some (single callback version)
 * @returns Promise resolving to callback result or undefined
 */
export async function ifSomeAsync<T, R1>(
  val: AnyMaybe<T>,
  onSome: (value: T) => MaybePromise<R1>,
): Promise<R1 | void>;

/**
 * Executes appropriate callback based on Maybe value (two callback version)
 * @returns Promise resolving to result of either callback
 */
export async function ifSomeAsync<T, R1, R2>(
  val: AnyMaybe<T>,
  onSome: (value: T) => MaybePromise<R1>,
  onElse: () => MaybePromise<R2>,
): Promise<R1 | R2>;

/**
 * Conditionally executes callback based on Maybe value
 * @param val - The Maybe value or Promise of Maybe to check
 * @param onSome - Callback executed for Some values
 * @param onElse - Optional callback executed for None values
 * @returns Promise resolving to callback result or undefined
 */
export async function ifSomeAsync<T, R1, R2 = void>(
  val: AnyMaybe<T>,
  onSome: (value: T) => MaybePromise<R1>,
  onElse?: () => MaybePromise<R2>,
): Promise<R1 | R2 | void> {
  const unwrapped = await val;

  if (isSome(unwrapped)) {
    return await dynamicAwait(onSome(unwrapped));
  } else {
    if (onElse) {
      return await dynamicAwait(onElse());
    }
    return;
  }
}

/**
 * Executes callback only if Maybe value is None (single callback version)
 * @returns Promise resolving to callback result or undefined
 */
export async function ifNoneAsync<T, R1>(
  val: AnyMaybe<T>,
  onNone: () => MaybePromise<R1>,
): Promise<R1 | void>;

/**
 * Executes appropriate callback based on Maybe value (two callback version)
 * @returns Promise resolving to result of either callback
 */
export async function ifNoneAsync<T, R1, R2>(
  val: AnyMaybe<T>,
  onNone: () => MaybePromise<R1>,
  onElse: (value: T) => MaybePromise<R2>,
): Promise<R1 | R2>;

/**
 * Conditionally executes callback based on Maybe value
 * @param val - The Maybe value or Promise of Maybe to check
 * @param onNone - Callback executed for None values
 * @param onElse - Optional callback executed for Some values
 * @returns Promise resolving to callback result or undefined
 */
export async function ifNoneAsync<T, R1, R2 = void>(
  val: AnyMaybe<T>,
  onNone: () => MaybePromise<R1>,
  onElse?: (value: T) => MaybePromise<R2>,
): Promise<R1 | R2 | void> {
  const unwrapped = await val;

  if (isNone(unwrapped)) {
    return await dynamicAwait(onNone());
  } else {
    if (onElse) {
      return await dynamicAwait(onElse(unwrapped));
    }
    return;
  }
}

// ========================================
// 副作用
// ========================================

/**
 * Executes a side effect for Some values without modifying the Maybe
 * @param val - The Maybe value or Promise of Maybe to inspect
 * @param fn - Side effect function for Some values
 * @param signal - Optional AbortSignal for cancellation
 * @returns Promise resolving to the original Maybe value
 */
export async function peekAsync<T>(
  val: AnyMaybe<T>,
  fn: (v: T, signal?: AbortSignal) => MaybePromise<void>,
  signal?: AbortSignal,
): Promise<Maybe<T>> {
  signal?.throwIfAborted();
  const unwrapped = await val;
  signal?.throwIfAborted();

  if (isSome(unwrapped)) {
    await dynamicAwait(fn(unwrapped, signal));
    signal?.throwIfAborted();
  }
  return unwrapped;
}

/**
 * Executes a side effect for None values without modifying the Maybe
 * @param val - The Maybe value or Promise of Maybe to inspect
 * @param fn - Side effect function for None values
 * @param signal - Optional AbortSignal for cancellation
 * @returns Promise resolving to the original Maybe value
 */
export async function peekNoneAsync<T>(
  val: AnyMaybe<T>,
  fn: (signal?: AbortSignal) => MaybePromise<void>,
  signal?: AbortSignal,
): Promise<Maybe<T>> {
  signal?.throwIfAborted();
  const unwrapped = await val;
  signal?.throwIfAborted();

  if (isNone(unwrapped)) {
    await dynamicAwait(fn(signal));
    signal?.throwIfAborted();
  }
  return unwrapped;
}

/**
 * Executes side effects for both Some and None cases without modifying the Maybe
 * @param val - The Maybe value or Promise of Maybe to inspect
 * @param handlers - Object containing optional Some and None handlers
 * @param signal - Optional AbortSignal for cancellation
 * @returns Promise resolving to the original Maybe value
 */
export async function peekBothAsync<T>(
  val: AnyMaybe<T>,
  {
    fnSome = () => {},
    fnNone = () => {},
  }: {
    fnSome?: (v: T, signal?: AbortSignal) => MaybePromise<void>;
    fnNone?: (signal?: AbortSignal) => MaybePromise<void>;
  },
  signal?: AbortSignal,
): Promise<Maybe<T>> {
  signal?.throwIfAborted();
  const unwrapped = await val;
  signal?.throwIfAborted();

  if (isSome(unwrapped)) {
    await dynamicAwait(fnSome(unwrapped, signal));
  } else {
    await dynamicAwait(fnNone(signal));
  }
  signal?.throwIfAborted();

  return unwrapped;
}
