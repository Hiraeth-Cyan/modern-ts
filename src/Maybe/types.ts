// ========================================
// ./src/Maybe/types.ts
// ========================================

/**
 * A nullable type that can be `T`, `null`, or `undefined`.
 */
export type Maybe<T> = T | null | undefined;

/**
 * A Promise that resolves to a {@link Maybe} value.
 */
export type AsyncMaybe<T> = Promise<Maybe<T>>;

/**
 * A union of all possible maybe-like types - synchronous, asynchronous, or Promise-like.
 */
export type AnyMaybe<T> = Maybe<T> | AsyncMaybe<T> | PromiseLike<Maybe<T>>;
