// ========================================
// ./src/Result/types.ts
// ========================================

/**
 * The structure for a successful return value.
 * @typeParam T - The type of the value on success.
 */
export interface Success<T> {
  readonly ok: true;
  readonly value: T;
}

/**
 * The structure for a failed return value (error).
 * @typeParam E - The type of the error on failure.
 */
export interface Failure<E> {
  readonly ok: false;
  readonly error: E;
}

/**
 * Union type representing the result of an operation, which is either success or failure.
 * @typeParam T - The type of the value on success.
 * @typeParam E - The type of the error on failure.
 */
export type Result<T, E> = Readonly<Success<T> | Failure<E>>;

/**
 * A Promise wrapped Result type, representing a Promise that will resolve to a Result.
 * @typeParam T - The type of the value on success.
 * @typeParam E - The type of the error on failure.
 */
export type AsyncResult<T, E> = Promise<Result<T, E>>;

/**
 * Union type that unifies synchronous and asynchronous Result types.
 * @typeParam T - The type of the value on success.
 * @typeParam E - The type of the error on failure.
 */
export type AnyResult<T, E> =
  | Result<T, E>
  | AsyncResult<T, E>
  | PromiseLike<Result<T, E>>;
