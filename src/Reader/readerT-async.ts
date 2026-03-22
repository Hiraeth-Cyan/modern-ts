// ========================================
// ./src/Reader/readerT-async.ts
// ========================================
/* eslint-disable @typescript-eslint/require-await */

import type {AsyncReaderT} from './types';
import {Ok, Err} from '../Result/base';
import type {Result} from '../Result/types';
import {
  mapAsync as mapResultAsync,
  andThenAsync as andThenResultAsync,
  mapErrAsync as mapErrResultAsync,
} from '../Result/Operators/Async/transform-async';
import {
  apAsync as apResultAsync,
  allAsync as allResultAsync,
} from '../Result/Operators/Async/combine-async';
import {type Maybe, isSome} from '../Maybe/__export__';
import {UnknownError} from '../unknown-error';

/**
 * Creates an AsyncReaderT that ignores the environment (R) and resolves immediately
 * with a successful Result containing the given value (A). This is the 'return' or 'pure' operation.
 * @typeParam R - The Environment type.
 * @typeParam E - The Error type.
 * @typeParam A - The type of the value to wrap.
 * @param a - The value to be wrapped in AsyncReaderT.
 * @returns AsyncReaderT<R, E, A> that resolves to Ok(a).
 */
export const ofAsync = <R, E, A>(a: A): AsyncReaderT<R, E, A> => {
  return async (_env: R) => Ok(a);
};

/**
 * Creates an AsyncReaderT that retrieves the environment (R) and resolves with it
 * in a successful Result. This is the 'ask' operation in ReaderT Monad.
 * @typeParam R - The Environment type.
 * @typeParam E - The Error type.
 * @returns AsyncReaderT<R, E, R> that resolves to Ok(env).
 */
export const askAsync = <R, E>(): AsyncReaderT<R, E, R> => {
  return async (env: R) => Ok(env);
};

/**
 * Creates an AsyncReaderT that always fails with the given error (E), ignoring the environment.
 * @typeParam R - The Environment type.
 * @typeParam E - The Error type.
 * @typeParam A - The type parameter for the value (unused, for consistency).
 * @param e - The error value to wrap in a failed Result.
 * @returns AsyncReaderT<R, E, A> that resolves to Err(e).
 */
export const failAsync = <R, E, A>(e: E): AsyncReaderT<R, E, A> => {
  return async (_env: R) => Err(e);
};

/**
 * Lifts a Result<A, E> into the AsyncReaderT context, ignoring the environment.
 * @typeParam R - The Environment type.
 * @typeParam E - The Error type.
 * @typeParam A - The type of the value.
 * @param result - The Result to lift.
 * @returns AsyncReaderT<R, E | UnknownError, A> that resolves to the given result.
 */
export const fromResultAsync = <R, E, A>(
  result: Result<A, E>,
): AsyncReaderT<R, E, A> => {
  return async (_env: R) => result;
};

/**
 * Lifts a Maybe<A> into the AsyncReaderT context, converting it to a Result.
 * If the Maybe is Some, returns Ok with the value; if None, returns Err with the given error.
 * @typeParam R - The Environment type.
 * @typeParam E - The Error type.
 * @typeParam A - The type of the value.
 * @param maybe - The Maybe value to convert.
 * @param on_none_error - The error to use if the Maybe is None.
 * @returns AsyncReaderT<R, E | UnknownError, A> that resolves to Ok(a) or Err(on_none_error).
 */
export const fromMaybeAsync = <R, E, A>(
  maybe: Maybe<A>,
  on_none_error: E,
): AsyncReaderT<R, E | UnknownError, A> => {
  return async (_env: R) => {
    if (isSome(maybe)) {
      return Ok(maybe);
    }
    return Err(on_none_error);
  };
};

/**
 * Lifts a nullable value (A | null | undefined) into the AsyncReaderT context.
 * If the value is not null or undefined, returns Ok with the value; otherwise returns Err.
 * @typeParam R - The Environment type.
 * @typeParam E - The Error type.
 * @typeParam A - The type of the value.
 * @param maybe - The nullable value to convert.
 * @param on_none_error - The error to use if the value is null or undefined.
 * @returns AsyncReaderT<R, E | UnknownError, A> that resolves accordingly.
 */
export const fromNullableAsync = fromMaybeAsync;

/**
 * Applies a function (A) => B to the successful value inside the AsyncReaderT,
 * maintaining the environment context and propagating errors. This is the 'map' operation.
 * @typeParam R - The Environment type.
 * @typeParam E - The Error type.
 * @typeParam A - The type of the input value.
 * @typeParam B - The type of the output value.
 * @param reader - The source AsyncReaderT<R, E, A>.
 * @param fn - The mapping function (A) => B.
 * @returns AsyncReaderT<R, E | UnknownError, B> containing the mapped value or the original error.
 */
export const mapAsync = <R, E, A, B>(
  reader: AsyncReaderT<R, E, A>,
  fn: (a: A) => B,
): AsyncReaderT<R, E | UnknownError | DOMException, B> => {
  return async (env: R) => {
    const result_a = await reader(env);
    return mapResultAsync(result_a, fn);
  };
};

/**
 * Chains two AsyncReaderT computations. The successful result of the first reader (A) is used to
 * produce the second reader (AsyncReaderT<R, E, B>). Errors are propagated.
 * This is the 'flatMap' or 'bind' operation (Monad).
 * @typeParam R - The Environment type.
 * @typeParam E - The Error type.
 * @typeParam A - The type of the input value of the first reader.
 * @typeParam B - The type of the final output value.
 * @param reader - The initial AsyncReaderT<R, E, A>.
 * @param f_next - A function that takes the successful result of 'reader' and returns the next AsyncReaderT<R, E, B>.
 * @returns AsyncReaderT<R, E | UnknownError, B> containing the final result or an error.
 */
export const andThenAsync = <R, E, A, B>(
  reader: AsyncReaderT<R, E, A>,
  f_next: (a: A, signal?: AbortSignal) => AsyncReaderT<R, E, B>,
): AsyncReaderT<R, E | UnknownError | DOMException, B> => {
  return async (env: R) => {
    const result_a = await reader(env);
    return andThenResultAsync(result_a, async (a: A) => {
      const next_reader = f_next(a);
      return await next_reader(env);
    });
  };
};

/**
 * Applies a function contained within an AsyncReaderT (R, (A) => B) to a value
 * contained within another AsyncReaderT (R, A), preserving the environment and propagating errors.
 * This is the 'ap' operation (Applicative Functor).
 * @typeParam R - The Environment type.
 * @typeParam E - The Error type.
 * @typeParam A - The type of the input value.
 * @typeParam B - The type of the output value.
 * @param reader_fab - AsyncReaderT containing the function (A) => B.
 * @param reader_a - AsyncReaderT containing the input value A.
 * @returns AsyncReaderT<R, E | UnknownError, B> containing the result of applying the function or an error.
 */
export const apAsync = <R, E, A, B>(
  reader_fab: AsyncReaderT<R, E, (a: A) => B>,
  reader_a: AsyncReaderT<R, E, A>,
): AsyncReaderT<R, E | UnknownError | DOMException, B> => {
  return async (env: R) => {
    const promise_fab = reader_fab(env);
    const promise_a = reader_a(env);

    const [result_fab, result_a] = await Promise.all([promise_fab, promise_a]);

    return apResultAsync(result_fab, result_a);
  };
};

/**
 * Asynchronously lifts a binary function (A, B) => C into the AsyncReaderT context.
 * It combines two AsyncReaderTs using the Applicative 'ap' operation, propagating errors.
 * @typeParam R - The Environment type.
 * @typeParam E - The Error type.
 * @typeParam A - The type of the first input value.
 * @typeParam B - The type of the second input value.
 * @typeParam C - The type of the output value.
 * @param f_abc - The binary function (A, B) => C.
 * @returns A function that takes two AsyncReaderTs and returns an AsyncReaderT<R, E | UnknownError, C>.
 */
export const liftA2Async =
  <A, B, C>(f_abc: (a: A, b: B) => C) =>
  <R, E>(
    reader_a: AsyncReaderT<R, E, A>,
    reader_b: AsyncReaderT<R, E, B>,
  ): AsyncReaderT<R, E | UnknownError | DOMException, C> => {
    const reader_f_bc = mapAsync(reader_a, (a: A) => (b: B) => f_abc(a, b));
    return apAsync(reader_f_bc, reader_b);
  };

/**
 * Asynchronously lifts a ternary function (A, B, C) => D into the AsyncReaderT context.
 * It combines three AsyncReaderTs using the Applicative 'ap' operation, propagating errors.
 * @typeParam R - The Environment type.
 * @typeParam E - The Error type.
 * @typeParam A - The type of the first input value.
 * @typeParam B - The type of the second input value.
 * @typeParam C - The type of the third input value.
 * @typeParam D - The type of the output value.
 * @param f_abcd - The ternary function (A, B, C) => D.
 * @returns A function that takes three AsyncReaderTs and returns an AsyncReaderT<R, E | UnknownError, D>.
 */
export const liftA3Async =
  <A, B, C, D>(f_abcd: (a: A, b: B, c: C) => D) =>
  <R, E>(
    reader_a: AsyncReaderT<R, E, A>,
    reader_b: AsyncReaderT<R, E, B>,
    reader_c: AsyncReaderT<R, E, C>,
  ): AsyncReaderT<R, E | UnknownError | DOMException, D> => {
    const reader_f_cd = liftA2Async((a: A, b: B) => (c: C) => f_abcd(a, b, c))(
      reader_a,
      reader_b,
    );
    return apAsync(reader_f_cd, reader_c);
  };

/**
 * Performs a side effect using the successful result of the AsyncReaderT, and then returns
 * the original result, ignoring the side effect's return value. If the side effect fails,
 * the error is propagated.
 * Note: The side effect function must return an AsyncReaderT.
 * @typeParam R - The Environment type.
 * @typeParam E - The Error type.
 * @typeParam A - The type of the original value to be passed through.
 * @param reader - The source AsyncReaderT<R, E, A>.
 * @param f - A function that takes A and returns an AsyncReaderT<R, E, unknown> (the side effect).
 * @returns AsyncReaderT<R, E | UnknownError, A> containing the original value or an error.
 */
export const tapAsync = <R, E, A>(
  reader: AsyncReaderT<R, E, A>,
  f: (a: A) => AsyncReaderT<R, E, unknown>,
): AsyncReaderT<R, E | UnknownError | DOMException, A> => {
  return async (env: R) => {
    const result_a = await reader(env);

    return andThenResultAsync(result_a, async (a: A) => {
      const side_effect_reader = f(a);
      const side_effect_result = await side_effect_reader(env);

      if (!side_effect_result.ok) {
        return side_effect_result;
      }
      return Ok(a);
    });
  };
};

/**
 * Transforms the error value inside a failed AsyncReaderT using the given function.
 * Successful results are passed through unchanged.
 * @typeParam R - The Environment type.
 * @typeParam E - The original Error type.
 * @typeParam A - The value type.
 * @typeParam F - The new Error type.
 * @param reader - The source AsyncReaderT<R, E, A>.
 * @param fn_fe - The error transformation function (E) => Promise<F> | F.
 * @returns AsyncReaderT<R, F | UnknownError, A> with transformed error or original success.
 */
export const mapErrAsync = <R, E, A, F>(
  reader: AsyncReaderT<R, E, A>,
  fn_fe: (e: E) => Promise<F> | F,
): AsyncReaderT<R, F | UnknownError | DOMException, A> => {
  return async (env: R) => {
    const result_a = await reader(env);
    return mapErrResultAsync(result_a, fn_fe);
  };
};

/**
 * Recovers from an error in the AsyncReaderT by executing an alternative reader.
 * If the original reader succeeds, its result is returned; otherwise, the error is
 * passed to the alternative function which returns a new reader to try.
 * @typeParam R - The Environment type.
 * @typeParam E - The original Error type.
 * @typeParam A - The value type.
 * @typeParam F - The alternative Error type.
 * @param reader - The original AsyncReaderT<R, E, A>.
 * @param alternative_reader - A function that takes the error and returns an alternative AsyncReaderT<R, F, A>.
 * @returns AsyncReaderT<R, F | UnknownError, A> with either the original success or the alternative result.
 */
export const orElseAsync = <R, E, A, F>(
  reader: AsyncReaderT<R, E, A>,
  alternative_reader: (e: E) => AsyncReaderT<R, F, A>,
): AsyncReaderT<R, F | UnknownError, A> => {
  return async (env: R) => {
    const result_a = await reader(env);

    if (result_a.ok) {
      return result_a;
    }

    const error = result_a.error;
    const recovered_reader = alternative_reader(error);
    return await recovered_reader(env);
  };
};

/**
 * Transforms a list of items (T) into an AsyncReaderT that processes each item
 * with the given function and collects all results into an array.
 * All items are processed in parallel (using Promise.all).
 * @typeParam R - The Environment type.
 * @typeParam E - The Error type.
 * @typeParam T - The type of input items.
 * @typeParam A - The type of output values.
 * @param f_ta - A function that transforms each item T into an AsyncReaderT<R, E, A>.
 * @returns A function that takes an array of T and returns an AsyncReaderT<R, E | UnknownError, A[]>
 *          containing all successful results, or the first error encountered.
 */
export const traverseAsync =
  <R, E, T, A>(f_ta: (t: T) => AsyncReaderT<R, E, A>) =>
  (
    items: readonly T[],
  ): AsyncReaderT<R, E | UnknownError | DOMException, A[]> => {
    return async (env: R) => {
      const promises: Promise<Result<A, E>>[] = items.map((item) => {
        const reader = f_ta(item);
        return reader(env);
      });

      const results: Result<A, E>[] = await Promise.all(promises);

      return allResultAsync(results);
    };
  };

/**
 * Converts a list of AsyncReaderTs into a single AsyncReaderT that contains an array of results.
 * All readers are executed in parallel (using Promise.all).
 * @typeParam R - The Environment type.
 * @typeParam E - The Error type.
 * @typeParam A - The value type.
 * @param readers - An array of AsyncReaderT<R, E, A> to sequence.
 * @returns AsyncReaderT<R, E | UnknownError, A[]> containing all successful results, or the first error.
 */
export const sequenceAsync = <R, E, A>(
  readers: readonly AsyncReaderT<R, E, A>[],
): AsyncReaderT<R, E | UnknownError | DOMException, A[]> => {
  return traverseAsync((reader: AsyncReaderT<R, E, A>) => reader)(readers);
};
