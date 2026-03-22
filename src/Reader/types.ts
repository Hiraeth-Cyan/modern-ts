// ========================================
// ./src/Reader/types.ts
// ========================================
import type {Result, AsyncResult} from '../Result/types';

/**
 * Standard synchronous Reader type.
 * R: The Environment (Read-only dependency) type.
 * A: The successful result type.
 */
export type Reader<R, A> = (env: R) => A;

/**
 * Asynchronous Reader type.
 * R: The Environment type.
 * A: The successful result type wrapped in a PromiseLike.
 */
export type AsyncReader<R, A> = (env: R) => PromiseLike<A>;

/**
 * Synchronous Reader Monad Transformer (ReaderT).
 * Combines environment dependency (Reader) and synchronous failure handling (Result).
 * R: The Environment type.
 * E: The Error type.
 * A: The successful result type.
 */
export type ReaderT<R, E, A> = Reader<R, Result<A, E>>;

/**
 * Asynchronous Reader Monad Transformer (AsyncReaderT).
 * Combines environment dependency (Reader) and asynchronous failure handling (AsyncResult/Promise<Result>).
 * R: The Environment type.
 * E: The Error type.
 * A: The successful result type wrapped in an AsyncResult (Promise<Result>).
 */
export type AsyncReaderT<R, E, A> = Reader<R, AsyncResult<A, E>>;

/**
 * Union type for either Reader or AsyncReader.
 */
export type AnyReader<R, A> = Reader<R, A> | AsyncReader<R, A>;

/**
 * Union type for either ReaderT or AsyncReaderT.
 */
export type AnyReaderT<R, E, A> = ReaderT<R, E, A> | AsyncReaderT<R, E, A>;
