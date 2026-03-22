// ========================================
// ./src/Resource/types.ts
// ========================================

/* eslint-disable @typescript-eslint/no-empty-object-type */

import type {MaybePromise} from '../Utils/type-tool';

/**
 * Marker interface for opened state.
 * @public
 */
export interface StateOpened {}

/**
 * Marker interface for closed state.
 */
export interface StateClosed {}

/**
 * Marker interface for committed state.
 */
export interface StateCommit {}

/**
 * Marker interface for rolled back state.
 */
export interface StateRollback {}

// ------ 清理函数类型 ------

/**
 * Synchronous cleanup function type.
 * @typeParam T - The type of the data to clean up
 */
export type Cleaner<T> = (data: T) => void;

/**
 * Asynchronous cleanup function type.
 * @typeParam T - The type of the data to clean up
 */
export type AsyncCleaner<T> = (data: T) => PromiseLike<void> | void;

/**
 * Union type for any cleanup function (synchronous or asynchronous).
 * @typeParam T - The type of the data to clean up
 */
export type AnyCleaner<T> = Cleaner<T> | AsyncCleaner<T>;

// ------ 事务函数类型 ------

/**
 * Synchronous commit function type.
 * @typeParam T - The type of the transaction data
 */
export type CommitUp<T> = (data: T) => void;

/**
 * Synchronous rollback function type.
 * @typeParam T - The type of the transaction data
 */
export type RollbackUp<T> = (data: T) => void;

/**
 * Asynchronous commit function type.
 * @typeParam T - The type of the transaction data
 */
export type AsyncCommitUp<T> = (data: T) => MaybePromise<void>;

/**
 * Asynchronous rollback function type.
 * @typeParam T - The type of the transaction data
 */
export type AsyncRollbackUp<T> = (data: T) => MaybePromise<void>;

// ------ 联合类型 ------

/**
 * Union type for any commit function (synchronous or asynchronous).
 * @typeParam T - The type of the transaction data
 */
export type AnyCommitUp<T> = CommitUp<T> | AsyncCommitUp<T>;

/**
 * Union type for any rollback function (synchronous or asynchronous).
 * @typeParam T - The type of the transaction data
 */
export type AnyRollbackUp<T> = RollbackUp<T> | AsyncRollbackUp<T>;

// ------ 空 ------
/**
 * A unique symbolic constant representing the absence of resources.
 * * @remarks
 * This is used as a placeholder within a `Resource` context to indicate
 * that the resource pool is exhausted or no resource is available.
 */
export const NONE = Symbol('None');

/**
 * Represents the type of the {@link NONE} constant.
 * Use this type for type guards or function signatures that might return the `NONE` placeholder.
 */
export type NoneType = typeof NONE;
