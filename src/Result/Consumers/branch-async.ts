// ========================================
// ./src/Result/Consumers/branch-async.ts
// ========================================
import type {AnyResult} from '../types';
import {UnknownError} from '../../unknown-error';
import type {MaybePromise} from '../../Utils/type-tool';
import {dynamicAwait} from '../../helper';

/**
 * Asynchronously executes different callback functions based on the Result state and returns Promise<R>.
 * Catches exceptions thrown by the callbacks.
 * @typeParam T - The type of the success value
 * @typeParam E - The type of the error
 * @typeParam R - The type of the return value
 * @param result_promise - The Result or Promise<Result> to match
 * @param onOk - The callback function for a successful state (Ok)
 * @param onErr - The callback function for a failure state (Err)
 * @param signal - Optional AbortSignal for cancellation
 * @returns The Promise resolving to the return value of onOk or onErr, or an UnknownError if a callback throws
 */
export async function matchResultAsync<T, E, R>(
  result_promise: AnyResult<T, E>,
  onOk: (value: T, signal?: AbortSignal) => MaybePromise<R>,
  onErr: (error: E, signal?: AbortSignal) => MaybePromise<R>,
  signal?: AbortSignal,
): Promise<R | UnknownError> {
  const result = await result_promise;

  if (result.ok) {
    try {
      return await dynamicAwait(onOk(result.value, signal));
    } catch (raw_error) {
      return UnknownError.from(raw_error);
    }
  } else {
    try {
      return await dynamicAwait(onErr(result.error, signal));
    } catch (raw_error) {
      return UnknownError.from(raw_error);
    }
  }
}
/**
 * Asynchronously executes onOk if the Result is **Ok**; executes the optional onElse if **Err**.
 * All exceptions thrown by the callbacks are caught and wrapped as UnknownError.
 * @typeParam T - The type of the **Success Value** in the **Ok state**.
 * @typeParam E - The type of the **Error** in the **Err state**.
 * @typeParam R1 - The final resolved return type of the **onOk** callback.
 * @param result_promise - The Result object or Promise<Result> to be checked.
 * @param onOk - The callback executed if the Result is Ok. Returns R1 or Promise<R1>.
 * @returns A Promise that resolves to the result of onOk (R1), or UnknownError if a callback throws, or **void** if the Result is Err.
 */
export async function ifOkAsync<T, E, R1>(
  result_promise: AnyResult<T, E>,
  onOk: (value: T) => MaybePromise<R1>,
): Promise<R1 | UnknownError | void>;

/**
 * Asynchronously executes onOk if the Result is **Ok**; executes onElse if **Err**.
 * All exceptions thrown by the callbacks are caught and wrapped as UnknownError.
 * @typeParam T - The type of the **Success Value** in the **Ok state**.
 * @typeParam E - The type of the **Error** in the **Err state**.
 * @typeParam R1 - The final resolved return type of the **onOk** callback.
 * @typeParam R2 - The final resolved return type of the **onElse** callback.
 * @param result_promise - The Result object or Promise<Result> to be checked.
 * @param onOk - The callback executed if the Result is Ok. Returns R1 or Promise<R1>.
 * @param onElse - The callback executed if the Result is Err. Returns R2 or Promise<R2>.
 * @returns A Promise that resolves to the result of onOk or onElse (R1 or R2), or UnknownError if a callback throws.
 */
export async function ifOkAsync<T, E, R1, R2>(
  result_promise: AnyResult<T, E>,
  onOk: (value: T) => MaybePromise<R1>,
  onElse: (error: E) => MaybePromise<R2>,
): Promise<R1 | R2 | UnknownError>;

export async function ifOkAsync<T, E, R1, R2 = void>(
  result_promise: AnyResult<T, E>,
  onOk: (value: T) => MaybePromise<R1>,
  onElse?: (error: E) => MaybePromise<R2>,
): Promise<R1 | R2 | UnknownError | void> {
  const result = await result_promise;

  if (result.ok) {
    try {
      return await dynamicAwait(onOk(result.value));
    } catch (raw_error) {
      return UnknownError.from(raw_error);
    }
  } else {
    if (onElse) {
      try {
        return await dynamicAwait(onElse(result.error));
      } catch (raw_error) {
        return UnknownError.from(raw_error);
      }
    }
    return;
  }
}

/**
 * Asynchronously executes onErr if the Result is **Err**; executes the optional onElse if **Ok**.
 * All exceptions thrown by the callbacks are caught and wrapped as UnknownError.
 * @typeParam T - The type of the **Success Value** in the **Ok state**.
 * @typeParam E - The type of the **Error** in the **Err state**.
 * @typeParam R1 - The final resolved return type of the **onErr** callback.
 * @param result_promise - The Result object or Promise<Result> to be checked.
 * @param onErr - The callback executed if the Result is Err. Returns R1 or Promise<R1>.
 * @returns A Promise that resolves to the result of onErr (R1), or UnknownError if a callback throws, or **void** if the Result is Ok.
 */
export async function ifErrAsync<T, E, R1>(
  result_promise: AnyResult<T, E>,
  onErr: (error: E) => MaybePromise<R1>,
): Promise<R1 | UnknownError | void>;

/**
 * Asynchronously executes onErr if the Result is **Err**; executes onElse if **Ok**.
 * All exceptions thrown by the callbacks are caught and wrapped as UnknownError.
 * @typeParam T - The type of the **Success Value** in the **Ok state**.
 * @typeParam E - The type of the **Error** in the **Err state**.
 * @typeParam R1 - The final resolved return type of the **onErr** callback.
 * @typeParam R2 - The final resolved return type of the **onElse** callback.
 * @param result_promise - The Result object or Promise<Result> to be checked.
 * @param onErr - The callback executed if the Result is Err. Returns R1 or Promise<R1>.
 * @param onElse - The callback executed if the Result is Ok. Returns R2 or Promise<R2>.
 * @returns A Promise that resolves to the result of onErr or onElse (R1 or R2), or UnknownError if a callback throws.
 */
export async function ifErrAsync<T, E, R1, R2>(
  result_promise: AnyResult<T, E>,
  onErr: (error: E) => MaybePromise<R1>,
  onElse: (value: T) => MaybePromise<R2>,
): Promise<R1 | R2 | UnknownError>;

export async function ifErrAsync<T, E, R1, R2 = void>(
  result_promise: AnyResult<T, E>,
  onErr: (error: E) => MaybePromise<R1>,
  onElse?: (value: T) => MaybePromise<R2>,
): Promise<R1 | R2 | UnknownError | void> {
  const result = await result_promise;

  if (!result.ok) {
    try {
      return await dynamicAwait(onErr(result.error));
    } catch (raw_error) {
      return UnknownError.from(raw_error);
    }
  } else {
    if (onElse) {
      try {
        return await dynamicAwait(onElse(result.value));
      } catch (raw_error) {
        return UnknownError.from(raw_error);
      }
    }
    return;
  }
}

/**
 * Asynchronously transforms the Result into a single type R.
 * Uses mapFn on Success; uses defaultFn on Failure.
 * Catches exceptions thrown by the callbacks.
 * @typeParam T - The type of the success value
 * @typeParam E - The type of the error
 * @typeParam R - The type of the final return value
 * @param result_promise - The Result or Promise<Result> to process
 * @param defaultFn - The function to compute the default value on failure
 * @param mapFn - The function to map the success value
 * @returns The Promise resolving to the final return value, or an UnknownError if a callback throws
 */
export async function mapOrElseAsync<T, E, R>(
  result_promise: AnyResult<T, E>,
  defaultFn: (error: E) => MaybePromise<R>,
  mapFn: (value: T) => MaybePromise<R>,
): Promise<R | UnknownError> {
  const result = await result_promise;

  if (result.ok) {
    try {
      return await dynamicAwait(mapFn(result.value));
    } catch (raw_error) {
      return UnknownError.from(raw_error);
    }
  } else {
    try {
      return await dynamicAwait(defaultFn(result.error));
    } catch (raw_error) {
      return UnknownError.from(raw_error);
    }
  }
}
