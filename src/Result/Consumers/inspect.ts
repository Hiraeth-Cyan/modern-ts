// ========================================
// ./src/Result/Consumers/inspect.ts
// ========================================

import type {AnyResult, Result} from '../types';
import {UnknownError, ensureDOMException} from '../../unknown-error';
import {Err} from '../base';
import {wrapError} from '../../helper';
import type {MaybePromise} from '../../Utils/type-tool';

/**
 * Returns the Result as is, regardless of its state. Used for side effects (e.g., logging) on both Success/Failure paths.
 * @typeParam T - The type of the success value
 * @typeParam E - The type of the error
 * @param result - The Result to peek
 * @param options - Options object containing optional side-effect functions
 * @returns The unchanged Result
 */
export function peekBoth<T, E>(
  result: Result<T, E>,
  {
    fnOk = () => {},
    fnErr = () => {},
  }: {
    fnOk?: (value: T) => void;
    fnErr?: (error: E) => void;
  },
): Result<T, E> {
  if (result.ok) {
    fnOk(result.value);
  } else {
    fnErr(result.error);
  }
  return result;
}

/**
 * Executes the fnErr function as a side effect if the Result is Failure; then returns the Result as is.
 * @typeParam T - The type of the success value
 * @typeParam E - The type of the error
 * @param result - The Result to peek
 * @param fnErr - The side-effect function to execute on Failure
 * @returns The unchanged Result
 */
export function peekErr<T, E>(
  result: Result<T, E>,
  fnErr: (error: E) => void,
): Result<T, E> {
  if (!result.ok) {
    fnErr(result.error);
  }
  return result;
}

/**
 * Executes the fnOk function as a side effect if the Result is Success; then returns the Result as is.
 * @typeParam T - The type of the success value
 * @typeParam E - The type of the error
 * @param result - The Result to peek
 * @param fnOk - The side-effect function to execute on Success
 * @returns The unchanged Result
 */
export function peekOk<T, E>(
  result: Result<T, E>,
  fnOk: (value: T) => void,
): Result<T, E> {
  if (result.ok) {
    fnOk(result.value);
  }
  return result;
}

/**
 * Asynchronously executes side effects for both Success/Failure paths, and returns the AsyncResult unchanged.
 * @typeParam T - The type of the success value
 * @typeParam E - The type of the error
 * @param result_promise - The Result or Promise<Result> to peek
 * @param options - Options object containing optional side-effect functions
 * @param signal - Optional AbortSignal for cancellation
 * @returns A Promise containing the original Result, or an UnknownError if a side effect throws
 */
export async function peekBothAsync<T, E>(
  result_promise: AnyResult<T, E>,
  {
    fnOk = () => {},
    fnErr = () => {},
  }: {
    fnOk?: (value: T, signal?: AbortSignal) => MaybePromise<void>;
    fnErr?: (error: E, signal?: AbortSignal) => MaybePromise<void>;
  },
  signal?: AbortSignal,
): Promise<Result<T, E | DOMException | UnknownError>> {
  if (signal?.aborted) return Err(ensureDOMException(signal.reason));
  const result = await result_promise;

  try {
    if (result.ok) {
      await fnOk(result.value, signal);
    } else {
      await fnErr(result.error, signal);
    }
  } catch (raw_error) {
    return Err(wrapError(raw_error));
  }

  return result;
}

/**
 * Asynchronously executes fnErr as a side effect if the Result is Failure; then returns the Result unchanged.
 * @typeParam T - The type of the success value
 * @typeParam E - The type of the error
 * @param result_promise - The Result or Promise<Result> to peek
 * @param fnErr - The side-effect function to execute on Failure
 * @param signal - Optional AbortSignal for cancellation
 * @returns A Promise containing the original Result, or an UnknownError if fnErr throws
 */
export async function peekErrAsync<T, E>(
  result_promise: AnyResult<T, E>,
  fnErr: (error: E, signal?: AbortSignal) => MaybePromise<void>,
  signal?: AbortSignal,
): Promise<Result<T, E | DOMException | UnknownError>> {
  if (signal?.aborted) return Err(ensureDOMException(signal.reason));
  const result = await result_promise;

  if (!result.ok) {
    try {
      await fnErr(result.error, signal);
    } catch (raw_error) {
      return Err(wrapError(raw_error));
    }
  }
  return result;
}

/**
 * Asynchronously executes fnOk as a side effect if the Result is Success; then returns the Result unchanged.
 * @typeParam T - The type of the success value
 * @typeParam E - The type of the error
 * @param result_promise - The Result or Promise<Result> to peek
 * @param fnOk - The side-effect function to execute on Success
 * @param signal - Optional AbortSignal for cancellation
 * @returns A Promise containing the original Result, or an UnknownError if fnOk throws
 */
export async function peekOkAsync<T, E>(
  result_promise: AnyResult<T, E>,
  fnOk: (value: T, signal?: AbortSignal) => MaybePromise<void>,
  signal?: AbortSignal,
): Promise<Result<T, E | DOMException | UnknownError>> {
  if (signal?.aborted) return Err(ensureDOMException(signal.reason));
  const result = await result_promise;

  if (result.ok) {
    try {
      await fnOk(result.value, signal);
    } catch (raw_error) {
      return Err(wrapError(raw_error));
    }
  }
  return result;
}
