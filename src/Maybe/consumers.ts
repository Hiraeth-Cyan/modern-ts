// ========================================
// ./src/Maybe/consumers.ts
// ========================================

import {isNone, isSome} from './base';
import type {Maybe} from './types';

// ========================================
// 分支控制流
// ========================================

/**
 * Pattern matching for Maybe type
 * @param val - Maybe value to match
 * @param onSome - Callback for Some case
 * @param onNone - Callback for None case
 * @returns Result of the matched case
 */
export const match = <T, R>(
  val: Maybe<T>,
  onSome: (value: T) => R,
  onNone: () => R,
): R => (isSome(val) ? onSome(val) : onNone());

/**
 * Execute callback only if Maybe is Some
 * @param val - Maybe value to check
 * @param onSome - Callback for Some case
 * @returns Callback result or undefined
 */
export function ifSome<T, R1>(
  val: Maybe<T>,
  onSome: (value: T) => R1,
): R1 | void;

/**
 * Execute callback for Some, fallback for None
 * @param val - Maybe value to check
 * @param onSome - Callback for Some case
 * @param onElse - Fallback callback
 * @returns Result of either callback
 */
export function ifSome<T, R1, R2>(
  val: Maybe<T>,
  onSome: (value: T) => R1,
  onElse: () => R2,
): R1 | R2;

/**
 * @internal
 */
export function ifSome<T, R1, R2>(
  val: Maybe<T>,
  onSome: (value: T) => R1,
  onElse?: () => R2,
): R1 | R2 | void {
  return isSome(val) ? onSome(val) : onElse?.();
}

/**
 * Execute callback only if Maybe is None
 * @param val - Maybe value to check
 * @param onNone - Callback for None case
 * @returns Callback result or undefined
 */
export function ifNone<T, R1>(val: Maybe<T>, onNone: () => R1): R1 | void;

/**
 * Execute callback for None, fallback for Some
 * @param val - Maybe value to check
 * @param onNone - Callback for None case
 * @param onElse - Fallback callback
 * @returns Result of either callback
 */
export function ifNone<T, R1, R2>(
  val: Maybe<T>,
  onNone: () => R1,
  onElse: (value: T) => R2,
): R1 | R2;

/**
 * @internal
 */
export function ifNone<T, R1, R2>(
  val: Maybe<T>,
  onNone: () => R1,
  onElse?: (value: T) => R2,
): R1 | R2 | void {
  return isNone(val) ? onNone() : onElse?.(val);
}

// ========================================
// 副作用
// ========================================

/**
 * Peek at Some value without consuming
 * @param val - Maybe value to inspect
 * @param fn - Side effect callback
 * @returns Original Maybe value
 */
export const peek = <T>(val: Maybe<T>, fn: (v: T) => void): Maybe<T> => {
  if (isSome(val)) fn(val);
  return val;
};

/**
 * Peek at None case without consuming
 * @param val - Maybe value to inspect
 * @param fn - Side effect callback
 * @returns Original Maybe value
 */
export const peekNone = <T>(val: Maybe<T>, fn: () => void): Maybe<T> => {
  if (isNone(val)) fn();
  return val;
};

/**
 * Peek at both cases with separate callbacks
 * @param val - Maybe value to inspect
 * @param callbacks - Object with Some and None handlers
 * @returns Original Maybe value
 */
export function peekBoth<T>(
  val: Maybe<T>,
  {
    fnSome = () => {},
    fnNone = () => {},
  }: {
    fnSome?: (v: T) => void;
    fnNone?: () => void;
  },
): Maybe<T> {
  if (isSome(val)) {
    fnSome(val);
  } else {
    fnNone();
  }

  return val;
}
