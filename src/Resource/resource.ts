// ========================================
// ./src/Resource/resource.ts
// ========================================
/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */

import {
  type StateOpened,
  type StateClosed,
  type NoneType,
  type Cleaner,
  NONE,
} from './types';
import {UseAfterFreeError} from '../Errors';

// ------ 私有符号定义 ------
const _data = Symbol('Data');
const _cleanup = Symbol('Cleanup');

/**
 * Synchronous resource management class.
 * @typeParam T - The type of the resource data
 * @typeParam S - The state type (opened or closed)
 */
export class Resource<T, S extends StateOpened | StateClosed> {
  declare private state: S;
  public [_data]: T | NoneType;
  public [_cleanup]: Cleaner<T> | undefined;

  // ------ 构造函数 ------
  private constructor(data: T, cleanup_fn?: Cleaner<T>) {
    this[_data] = data;
    this[_cleanup] = cleanup_fn;
  }

  /**
   * Creates a new opened synchronous resource.
   * @typeParam D - The type of the resource data
   * @param data - The resource data
   * @param cleaner - Optional synchronous cleanup function
   * @returns A new opened synchronous resource
   */
  static open<D>(data: D, cleaner?: Cleaner<D>): Resource<D, StateOpened> {
    return new Resource(data, cleaner);
  }

  /**
   * Synchronously disposes the resource (cleanup).
   */
  [Symbol.dispose](this: Resource<T, StateOpened>): void {
    if (this[_data] === NONE) {
      // 让清理具备幂等性，不会双重释放。这是为了避免被using修饰的资源被手动close之后资源被using再次尝试清理 -> 触发双重释放
      return;
    }
    if (this[_cleanup]) {
      this[_cleanup](this[_data] as T);
    }
    this[_data] = NONE;
  }
}

/**
 * Union type for synchronous resource states.
 * @typeParam T - The type of the resource data
 */
export type ResType<T> = Resource<T, StateOpened> | Resource<T, StateClosed>;

/**
 * Uses a synchronous resource with a callback function.
 * @typeParam T - The type of the resource data
 * @typeParam R - The return type of the callback
 * @param resource - The opened synchronous resource
 * @param fn - Function to process the resource data
 * @returns The result of the callback
 * @throws Error if resource is already disposed
 */
export function use<T, R>(
  resource: Resource<T, StateOpened>,
  fn: (data: T) => R,
): R {
  if (resource[_data] === NONE) {
    throw new UseAfterFreeError('Resource already disposed.');
  }
  return fn(resource[_data] as T);
}

/**
 * Performs a side effect on a synchronous resource and returns the resource.
 * @typeParam T - The type of the resource data
 * @typeParam R - The return type of the side effect function
 * @param resource - The opened synchronous resource
 * @param fn - Side effect function to execute
 * @returns The same resource after executing the side effect
 * @throws Error if resource is already disposed
 */
export function exec<T, R>(
  resource: Resource<T, StateOpened>,
  fn: (data: T) => R,
): Resource<T, StateOpened> {
  if (resource[_data] === NONE) {
    throw new UseAfterFreeError('Resource already disposed.');
  }
  fn(resource[_data] as T);
  return resource;
}

/**
 * Closes a synchronous resource (disposes it).
 * @typeParam T - The type of the resource data
 * @param resource - The opened synchronous resource to close
 * @returns The closed synchronous resource
 */
export function close<T>(
  resource: Resource<T, StateOpened>,
): Resource<T, StateClosed> {
  resource[Symbol.dispose]();
  return resource as unknown as Resource<T, StateClosed>;
}

/**
 * Executes a function on the resource and then closes it,
 * guaranteeing cleanup even if the function throws.
 * @typeParam T - The type of the resource data
 * @typeParam R - The return type of the function
 * @param resource - The opened synchronous resource
 * @param fn - Function to execute before closing
 * @returns The closed synchronous resource
 */
export function dispose<T, R>(
  resource: Resource<T, StateOpened>,
  fn: (data: T) => R,
): Resource<T, StateClosed> {
  if (resource[_data] === NONE) {
    throw new UseAfterFreeError('Resource already disposed.');
  }
  try {
    fn(resource[_data] as T);
  } finally {
    resource[Symbol.dispose]();
  }
  return resource as unknown as Resource<T, StateClosed>;
}

/**
 * Reopens a closed synchronous resource with new data.
 * @typeParam T - The type of the resource data
 * @param resource - The closed synchronous resource
 * @param data - New data for the resource
 * @param cleaner - Optional new cleanup function
 * @returns The reopened synchronous resource
 */
export function reopen<T>(
  resource: Resource<T, StateClosed>,
  data: T,
  cleaner?: Cleaner<T>,
): Resource<T, StateOpened> {
  const r = resource as unknown as Resource<T, StateOpened>;
  r[_data] = data;
  r[_cleanup] = cleaner;
  return r;
}
