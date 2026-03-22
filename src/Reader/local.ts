// ========================================
// ./src/Reader/local.ts
// ========================================
import type {
  Reader,
  AsyncReader,
  ReaderT,
  AsyncReaderT,
  AnyReader,
  AnyReaderT,
} from './types';

/**
 * Implements the local function for ReaderT type.
 * @typeParam R - Environment type
 * @typeParam E - Error type
 * @typeParam A - Result type
 * @param reader - Original ReaderT
 * @param f_mod - Environment modification function that takes the current environment and returns a modified one
 * @returns A new ReaderT that executes with the modified environment
 */
export function local<R, E, A>(
  reader: ReaderT<R, E, A>,
  f_mod: (env: R) => R,
): ReaderT<R, E, A>;

/**
 * Implements the local function for AsyncReaderT type.
 * @typeParam R - Environment type
 * @typeParam E - Error type
 * @typeParam A - Result type
 * @param reader - Original AsyncReaderT
 * @param f_mod - Environment modification function that takes the current environment and returns a modified one
 * @returns A new AsyncReaderT that executes with the modified environment
 */
export function local<R, E, A>(
  reader: AsyncReaderT<R, E, A>,
  f_mod: (env: R) => R,
): AsyncReaderT<R, E, A>;

/**
 * Implements the local function for Reader type.
 * @typeParam R - Environment type
 * @typeParam A - Result type
 * @param reader - Original Reader
 * @param f_mod - Environment modification function that takes the current environment and returns a modified one
 * @returns A new Reader that executes with the modified environment
 */
export function local<R, A>(
  reader: Reader<R, A>,
  f_mod: (env: R) => R,
): Reader<R, A>;

/**
 * Implements the local function for AsyncReader type.
 * @typeParam R - Environment type
 * @typeParam A - Result type
 * @param reader - Original AsyncReader
 * @param f_mod - Environment modification function that takes the current environment and returns a modified one
 * @returns A new AsyncReader that executes with the modified environment
 */
export function local<R, A>(
  reader: AsyncReader<R, A>,
  f_mod: (env: R) => R,
): AsyncReader<R, A>;

/**
 * Generic implementation of the local function.
 *
 * This implementation handles all types of Reader and ReaderT, providing type safety through overloads.
 * It creates a new function that takes an environment, applies the modification function first,
 * then calls the original reader with the modified environment.
 *
 * @typeParam R - Environment type
 * @typeParam A - Result type
 * @typeParam E - Error type (only for ReaderT)
 * @param reader_like - Original Reader or ReaderT function
 * @param f_mod - Environment modification function
 * @returns A new Reader or ReaderT function
 */
export function local<R, A, E, T extends AnyReader<R, A> | AnyReaderT<R, E, A>>(
  reader_like: T,
  f_mod: (env: R) => R,
): T {
  return ((env: R) => {
    const modified_env = f_mod(env);
    return reader_like(modified_env);
  }) as T;
}
