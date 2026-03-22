// ========================================
// ./src/Resource/TxScope.ts
// ========================================
/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */

import {
  type StateOpened,
  type StateCommit,
  type StateRollback,
  type Cleaner,
  type CommitUp,
  type RollbackUp,
  type NoneType,
  NONE,
} from './types';
import {UseAfterFreeError} from '../Errors';

// ------ 私有符号定义 ------
const _data = Symbol('Data');
const _cleanup = Symbol('Cleanup');
const _commitup = Symbol('Commit');
const _rollbackup = Symbol('Rollback');

/**
 * Synchronous transaction scope management class.
 * @typeParam T - The type of the transaction data
 * @typeParam S - The state type (opened, commit, or rollback)
 */
export class TxScope<T, S extends StateOpened | StateCommit | StateRollback> {
  declare private state: S;
  public [_data]: T | NoneType;
  public [_cleanup]: Cleaner<T> | undefined;
  public [_commitup]: CommitUp<T> | undefined;
  public [_rollbackup]: RollbackUp<T> | undefined;

  // ------ 构造函数 ------
  private constructor(
    data: T,
    cleanup_fn?: Cleaner<T>,
    commitup_fn?: CommitUp<T>,
    rollbackup_fn?: RollbackUp<T>,
  ) {
    this[_data] = data;
    this[_cleanup] = cleanup_fn;
    this[_commitup] = commitup_fn;
    this[_rollbackup] = rollbackup_fn;
  }

  /**
   * Creates a new opened synchronous transaction scope.
   * @typeParam D - The type of the transaction data
   * @param data - The transaction data
   * @param cleaner - Optional synchronous cleanup function
   * @param commiter - Optional synchronous commit function
   * @param rollbacker - Optional synchronous rollback function
   * @returns A new opened synchronous transaction scope
   */
  static open<D>(
    data: D,
    cleaner?: Cleaner<D>,
    commiter?: CommitUp<D>,
    rollbacker?: RollbackUp<D>,
  ): TxScope<D, StateOpened> {
    return new TxScope(data, cleaner, commiter, rollbacker);
  }

  /**
   * Synchronously disposes the transaction scope (cleanup with rollback).
   */
  [Symbol.dispose](this: TxScope<T, StateOpened>): void {
    if (this[_data] === NONE) {
      return;
    }
    // 如果事务未被 commit/rollback 清理，则在 dispose 时执行回滚。
    if (this[_rollbackup]) {
      this[_rollbackup](this[_data] as T);
    }
    if (this[_cleanup]) {
      this[_cleanup](this[_data] as T);
    }
    this[_data] = NONE;
  }
}

/**
 * Union type for synchronous transaction scope states.
 * @typeParam T - The type of the transaction data
 */
export type TxScopeType<T> =
  | TxScope<T, StateOpened>
  | TxScope<T, StateCommit>
  | TxScope<T, StateRollback>;

/**
 * Commits a synchronous transaction scope.
 * @typeParam T - The type of the transaction data
 * @param resource - The opened synchronous transaction scope
 * @returns The committed transaction scope
 * @throws Error if resource is already disposed/committed/rolled back
 */
export function commit<T>(
  resource: TxScope<T, StateOpened>,
): TxScope<T, StateCommit> {
  if (resource[_data] === NONE) {
    throw new UseAfterFreeError(
      'Resource already closed/committed/rolled back.',
    );
  }
  resource[_rollbackup] = undefined;
  if (resource[_commitup]) {
    resource[_commitup](resource[_data] as T);
  }
  resource[Symbol.dispose]();
  return resource as unknown as TxScope<T, StateCommit>;
}

/**
 * Rolls back a synchronous transaction scope.
 * @typeParam T - The type of the transaction data
 * @param resource - The opened synchronous transaction scope
 * @returns The rolled back transaction scope
 * @throws Error if resource is already disposed/committed/rolled back
 */
export function rollback<T>(
  resource: TxScope<T, StateOpened>,
): TxScope<T, StateRollback> {
  if (resource[_data] === NONE) {
    throw new UseAfterFreeError(
      'Resource already closed/committed/rolled back.',
    );
  }
  const fn = resource[_rollbackup];
  resource[_rollbackup] = undefined;
  if (fn) {
    fn(resource[_data] as T); // 即使这里失败了，回滚函数已经是undefined了，不会二次错误
  }
  resource[Symbol.dispose]();
  return resource as unknown as TxScope<T, StateRollback>;
}

/**
 * Uses a synchronous transaction scope with a callback function.
 * @typeParam T - The type of the transaction data
 * @typeParam R - The return type of the callback
 * @param TxScope - The opened synchronous transaction scope
 * @param fn - Function to process the transaction data
 * @returns The result of the callback
 * @throws Error if transaction scope is already disposed
 */
export function use<T, R>(
  TxScope: TxScope<T, StateOpened>,
  fn: (data: T) => R,
): R {
  if (TxScope[_data] === NONE) {
    throw new UseAfterFreeError('Resource already disposed.');
  }
  return fn(TxScope[_data] as T);
}

/**
 * Performs a side effect on a synchronous transaction scope and returns it.
 * @typeParam T - The type of the transaction data
 * @typeParam R - The return type of the side effect function
 * @param TxScope - The opened synchronous transaction scope
 * @param fn - Side effect function to execute
 * @returns The same transaction scope after executing the side effect
 * @throws Error if transaction scope is already disposed
 */
export function exec<T, R>(
  TxScope: TxScope<T, StateOpened>,
  fn: (data: T) => R,
): TxScope<T, StateOpened> {
  if (TxScope[_data] === NONE) {
    throw new UseAfterFreeError('Resource already disposed.');
  }
  fn(TxScope[_data] as T);
  return TxScope;
}

/**
 * Reopens a committed or rolled back synchronous transaction scope with new data.
 * @typeParam T - The type of the transaction data
 * @param TxScope - The committed or rolled back synchronous transaction scope
 * @param data - New data for the transaction scope
 * @param cleaner - Optional new cleanup function
 * @param commiter - Optional new commit function
 * @param rollbacker - Optional new rollback function
 * @returns The reopened synchronous transaction scope
 */
export function reopen<T>(
  TxScope: TxScope<T, StateCommit> | TxScope<T, StateRollback>,
  data: T,
  cleaner?: Cleaner<T>,
  commiter?: CommitUp<T>,
  rollbacker?: RollbackUp<T>,
): TxScope<T, StateOpened> {
  const r = TxScope as unknown as TxScope<T, StateOpened>;
  r[_data] = data;
  r[_cleanup] = cleaner;
  r[_commitup] = commiter;
  r[_rollbackup] = rollbacker;
  return r;
}
