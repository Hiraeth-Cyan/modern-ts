// ========================================
// ./src/Resource/TxScope-async.ts
// ========================================
/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */

import {
  type StateOpened,
  type StateCommit,
  type StateRollback,
  type AnyCleaner,
  type AsyncCommitUp,
  type AnyRollbackUp,
  type NoneType,
  NONE,
} from './types';
import {UseAfterFreeError} from '../Errors';

// ------ 私有符号定义 ------
const _data = Symbol('Data');
const _cleanup = Symbol('AsyncCleanup');
const _commitup = Symbol('AsyncCommit');
const _rollbackup = Symbol('AsyncRollback');

/**
 * Asynchronous transaction scope management class.
 * @typeParam T - The type of the transaction data
 * @typeParam S - The state type (opened, commit, or rollback)
 */
export class AsyncTxScope<
  T,
  S extends StateOpened | StateCommit | StateRollback,
> {
  declare private state: S;
  public [_data]: T | NoneType;
  public [_cleanup]: AnyCleaner<T> | undefined;
  public [_commitup]: AsyncCommitUp<T> | undefined;
  public [_rollbackup]: AnyRollbackUp<T> | undefined;

  // ------ 构造函数 ------
  private constructor(
    data: T,
    cleanup_fn?: AnyCleaner<T>,
    commitup_fn?: AsyncCommitUp<T>,
    rollbackup_fn?: AnyRollbackUp<T>,
  ) {
    this[_data] = data;
    this[_cleanup] = cleanup_fn;
    this[_commitup] = commitup_fn;
    this[_rollbackup] = rollbackup_fn;
  }

  /**
   * Creates a new opened asynchronous transaction scope.
   * @typeParam D - The type of the transaction data
   * @param data - The transaction data
   * @param cleaner - Optional asynchronous cleanup function
   * @param commiter - Optional asynchronous commit function
   * @param rollbacker - Optional asynchronous rollback function
   * @returns A new opened asynchronous transaction scope
   */
  static open<D>(
    data: D,
    cleaner?: AnyCleaner<D>,
    commiter?: AsyncCommitUp<D>,
    rollbacker?: AnyRollbackUp<D>,
  ): AsyncTxScope<D, StateOpened> {
    return new AsyncTxScope(data, cleaner, commiter, rollbacker);
  }

  /**
   * Asynchronously disposes the transaction scope (cleanup with rollback).
   * @returns Promise that resolves when disposal is complete
   */
  async [Symbol.asyncDispose](
    this: AsyncTxScope<T, StateOpened>,
  ): Promise<void> {
    if (this[_data] === NONE) {
      return;
    }
    // 如果事务未被 commit/rollback 清理，则在 dispose 时执行异步回滚。
    if (this[_rollbackup]) {
      await this[_rollbackup](this[_data] as T); // 强制等待异步回滚
    }
    if (this[_cleanup]) {
      await this[_cleanup](this[_data] as T); // 强制等待异步清理
    }
    this[_data] = NONE;
  }
}

/**
 * Union type for asynchronous transaction scope states.
 * @typeParam T - The type of the transaction data
 */
export type AsyncTxScopeType<T> =
  | AsyncTxScope<T, StateOpened>
  | AsyncTxScope<T, StateCommit>
  | AsyncTxScope<T, StateRollback>;

/**
 * Commits an asynchronous transaction scope.
 * @typeParam T - The type of the transaction data
 * @param resource - The opened asynchronous transaction scope
 * @returns Promise with the committed transaction scope
 * @throws Error if resource is already disposed/committed/rolled back
 */
export async function commitAsync<T>(
  resource: AsyncTxScope<T, StateOpened>,
): Promise<AsyncTxScope<T, StateCommit>> {
  if (resource[_data] === NONE) {
    throw new UseAfterFreeError(
      'Resource already closed/committed/rolled back.',
    );
  }
  if (resource[_commitup]) {
    await resource[_commitup](resource[_data] as T);
  }
  resource[_rollbackup] = undefined;
  await resource[Symbol.asyncDispose]();
  return resource as unknown as AsyncTxScope<T, StateCommit>;
}

/**
 * Rolls back an asynchronous transaction scope.
 * @typeParam T - The type of the transaction data
 * @param resource - The opened asynchronous transaction scope
 * @returns Promise with the rolled back transaction scope
 * @throws Error if resource is already disposed/committed/rolled back
 */
export async function rollbackAsync<T>(
  resource: AsyncTxScope<T, StateOpened>,
): Promise<AsyncTxScope<T, StateRollback>> {
  if (resource[_data] === NONE) {
    throw new UseAfterFreeError(
      'Resource already closed/committed/rolled back.',
    );
  }
  const fn = resource[_rollbackup];
  resource[_rollbackup] = undefined;
  if (fn) {
    await fn(resource[_data] as T);
  }
  resource[_rollbackup] = undefined;
  await resource[Symbol.asyncDispose]();
  return resource as unknown as AsyncTxScope<T, StateRollback>;
}

/**
 * Uses an asynchronous transaction scope with a callback function.
 * @typeParam T - The type of the transaction data
 * @typeParam R - The return type of the callback
 * @param TxScope - The opened asynchronous transaction scope
 * @param fn - Function to process the transaction data
 * @returns Promise with the result of the callback
 * @throws Error if transaction scope is already disposed
 */
export async function useAsync<T, R>(
  TxScope: AsyncTxScope<T, StateOpened>,
  fn: (data: T) => Promise<R> | R,
): Promise<R> {
  if (TxScope[_data] === NONE) {
    throw new UseAfterFreeError('Resource already disposed.');
  }
  return await fn(TxScope[_data] as T);
}

/**
 * Performs a side effect on an asynchronous transaction scope and returns it.
 * @typeParam T - The type of the transaction data
 * @typeParam R - The return type of the side effect function
 * @param TxScope - The opened asynchronous transaction scope
 * @param fn - Side effect function to execute
 * @returns The same transaction scope after executing the side effect
 * @throws Error if transaction scope is already disposed
 */
export async function execAsync<T, R>(
  TxScope: AsyncTxScope<T, StateOpened>,
  fn: (data: T) => Promise<R> | R,
): Promise<AsyncTxScope<T, StateOpened>> {
  if (TxScope[_data] === NONE) {
    throw new UseAfterFreeError('Resource already disposed.');
  }
  await fn(TxScope[_data] as T);
  return TxScope;
}

/**
 * Reopens a committed or rolled back asynchronous transaction scope with new data.
 * @typeParam T - The type of the transaction data
 * @param TxScope - The committed or rolled back asynchronous transaction scope
 * @param data - New data for the transaction scope
 * @param cleaner - Optional new cleanup function
 * @param commiter - Optional new commit function
 * @param rollbacker - Optional new rollback function
 * @returns The reopened asynchronous transaction scope
 */
export function reopenAsync<T>(
  TxScope: AsyncTxScope<T, StateCommit> | AsyncTxScope<T, StateRollback>,
  data: T,
  cleaner?: AnyCleaner<T>,
  commiter?: AsyncCommitUp<T>,
  rollbacker?: AnyRollbackUp<T>,
): AsyncTxScope<T, StateOpened> {
  const r = TxScope as unknown as AsyncTxScope<T, StateOpened>;
  r[_data] = data;
  r[_cleanup] = cleaner;
  r[_commitup] = commiter;
  r[_rollbackup] = rollbacker;
  return r;
}
