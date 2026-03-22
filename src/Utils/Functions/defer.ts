// ========================================
// ./src/Utils/Functions/defer.ts
// ========================================
import type {MaybePromise} from '../type-tool';
import {dynamicAwait} from '../../helper';

/**
 * Symbol used to indicate no error occurred during task execution.
 */
export const NO_ERROR = Symbol('No Error');

/**
 * Type for error callback functions registered with defer.
 * @param error - The error from the task, or NO_ERROR if task succeeded
 * @returns A promise or value (return value is ignored)
 */
type ErrorCallback = (error: unknown) => unknown;

/**
 * Function type for registering cleanup/error callbacks.
 * @param fn - The callback function to register
 */
type RegisterFn = (fn: ErrorCallback) => void;

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
  task: (register: RegisterFn) => MaybePromise<R>,
) => {
  const callbacks: ErrorCallback[] = [];
  const register = (fn: ErrorCallback) => void callbacks.push(fn);
  let result_value: R;
  let error_arg: unknown = NO_ERROR;
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
  if (error_arg !== NO_ERROR) {
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
