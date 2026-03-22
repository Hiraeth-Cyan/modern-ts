// ========================================
// ./src/Resource/resource-async.ts
// ========================================
/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */

import {
  type StateOpened,
  type StateClosed,
  type AnyCleaner,
  type NoneType,
  NONE,
} from './types';
import {UseAfterFreeError} from '../Errors';

// ------ 私有符号定义 ------
const _data = Symbol('Data');
const _cleanup = Symbol('Cleanup');

/**
 * Asynchronous resource management class.
 * @typeParam T - The type of the resource data
 * @typeParam S - The state type (opened or closed)
 */
export class ResourceAsync<T, S extends StateOpened | StateClosed> {
  declare private state: S;
  public [_data]: T | NoneType;
  public [_cleanup]: AnyCleaner<T> | undefined;

  // ------ 构造函数 ------
  private constructor(data: T, async_cleanup_fn?: AnyCleaner<T>) {
    this[_data] = data;
    this[_cleanup] = async_cleanup_fn;
  }

  /**
   * Creates a new opened asynchronous resource.
   * @typeParam D - The type of the resource data
   * @param data - The resource data
   * @param cleaner - Optional asynchronous cleanup function
   * @returns A new opened asynchronous resource
   */
  static open<D>(
    data: D,
    cleaner?: AnyCleaner<D>,
  ): ResourceAsync<D, StateOpened> {
    return new ResourceAsync(data, cleaner);
  }

  /**
   * Asynchronously disposes the resource (cleanup).
   * @returns Promise that resolves when disposal is complete
   */
  async [Symbol.asyncDispose](
    this: ResourceAsync<T, StateOpened>,
  ): Promise<void> {
    if (this[_data] === NONE) {
      return;
    }
    if (this[_cleanup]) {
      await this[_cleanup](this[_data] as T);
    }
    this[_data] = NONE;
  }
}

/**
 * Union type for asynchronous resource states.
 * @typeParam T - The type of the resource data
 */
export type ResAsyncType<T> =
  | ResourceAsync<T, StateOpened>
  | ResourceAsync<T, StateClosed>;

/**
 * Uses an asynchronous resource with a callback function.
 * @typeParam T - The type of the resource data
 * @typeParam R - The return type of the callback
 * @param resource - The opened asynchronous resource
 * @param callback - Function to process the resource data
 * @returns Promise with the result of the callback
 * @throws Error if resource is already disposed
 */
export async function useAsync<T, R>(
  resource: ResourceAsync<T, StateOpened>,
  callback: (data: T) => Promise<R> | R,
): Promise<R> {
  if (resource[_data] === NONE) {
    throw new UseAfterFreeError('Resource already disposed.');
  }
  return await callback(resource[_data] as T);
}

/**
 * Performs a side effect on an asynchronous resource and returns the resource.
 * @typeParam T - The type of the resource data
 * @typeParam R - The return type of the side effect function
 * @param resource - The opened asynchronous resource
 * @param fn - Side effect function to execute
 * @returns The same resource after executing the side effect
 * @throws Error if resource is already disposed
 */
export async function execAsync<T, R>(
  resource: ResourceAsync<T, StateOpened>,
  fn: (data: T) => Promise<R> | R,
): Promise<ResourceAsync<T, StateOpened>> {
  if (resource[_data] === NONE) {
    throw new UseAfterFreeError('Resource already disposed.');
  }
  await fn(resource[_data] as T);
  return resource;
}

/**
 * Closes an asynchronous resource (disposes it).
 * @typeParam T - The type of the resource data
 * @param resource - The opened asynchronous resource to close
 * @returns The closed asynchronous resource
 */
export async function closeAsync<T>(
  resource: ResourceAsync<T, StateOpened>,
): Promise<ResourceAsync<T, StateClosed>> {
  await resource[Symbol.asyncDispose]();
  return resource as unknown as ResourceAsync<T, StateClosed>;
}

/**
 * Executes an asynchronous or synchronous function on the resource and then closes it,
 * guaranteeing asynchronous cleanup even if the function throws.
 * @typeParam T - The type of the resource data
 * @typeParam R - The return type of the function
 * @param resource - The opened asynchronous resource
 * @param fn - Asynchronous or synchronous function to execute before closing
 * @returns A promise that resolves to the closed asynchronous resource
 */
export async function disposeAsync<T, R>(
  resource: ResourceAsync<T, StateOpened>,
  fn: (data: T) => Promise<R> | R,
): Promise<ResourceAsync<T, StateClosed>> {
  if (resource[_data] === NONE) {
    throw new UseAfterFreeError('Resource already disposed.');
  }
  try {
    await fn(resource[_data] as T);
  } finally {
    await resource[Symbol.asyncDispose]();
  }
  return resource as unknown as ResourceAsync<T, StateClosed>;
}

/**
 * Reopens a closed asynchronous resource with new data.
 * @typeParam T - The type of the resource data
 * @param resource - The closed asynchronous resource
 * @param data - New data for the resource
 * @param cleaner - Optional new cleanup function
 * @returns The reopened asynchronous resource
 */
export function reopenAsync<T>(
  resource: ResourceAsync<T, StateClosed>,
  data: T,
  cleaner?: AnyCleaner<T>,
): ResourceAsync<T, StateOpened> {
  const r = resource as unknown as ResourceAsync<T, StateOpened>;
  r[_data] = data;
  r[_cleanup] = cleaner;
  return r;
}
