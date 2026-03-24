// ========================================
// ./src/Reader/readerT.ts
// ========================================
import type {ReaderT} from './types';
import {Ok, Err} from '../Result/base';
import type {Result} from '../Result/types';
import {
  map as mapResult,
  andThen as andThenResult,
  mapErr as mapErrResult,
} from '../Result/Operators/transform';
import {ap as apResult, all as allResult} from '../Result/Operators/combine';
import {type Maybe, isSome} from '../Maybe/__export__';

/**
 * Lifts a pure value (A) into the ReaderT context as a successful result.
 * This is the 'return' or 'pure' operation for ReaderT.
 * @typeParam R - The Environment type.
 * @typeParam E - The Error type.
 * @typeParam A - The type of the value to wrap.
 * @param a - The value to be wrapped in ReaderT.
 * @returns ReaderT<R, E, A> that always returns Ok(a).
 */
export const of = <R, E, A>(a: A): ReaderT<R, E, A> => {
  return (_env: R) => Ok(a);
};

/**
 * Retrieves the environment (R) as a successful result.
 * This is the 'ask' operation in ReaderT context.
 * @typeParam R - The Environment type.
 * @typeParam E - The Error type.
 * @returns ReaderT<R, E, R> that returns Ok(env).
 */
export const ask = <R, E>(): ReaderT<R, E, R> => {
  return (env: R) => Ok(env);
};

/**
 * Creates a ReaderT that immediately fails with the given error (E).
 * @typeParam R - The Environment type.
 * @typeParam E - The Error type.
 * @typeParam A - The type parameter (not used, but required for type consistency).
 * @param e - The error value.
 * @returns ReaderT<R, E, A> that always returns Err(e).
 */
export const fail = <R, E, A>(e: E): ReaderT<R, E, A> => {
  return (_env: R) => Err(e);
};

/**
 * Lifts an existing Result into the ReaderT context.
 * @typeParam R - The Environment type.
 * @typeParam E - The Error type.
 * @typeParam A - The success value type.
 * @param result - The Result<A, E> to wrap.
 * @returns ReaderT<R, E, A> that always returns the wrapped Result.
 */
export const fromResult = <R, E, A>(result: Result<A, E>): ReaderT<R, E, A> => {
  return (_env: R) => result;
};

/**
 * Converts a Maybe value into a ReaderT.
 * @typeParam R - The Environment type.
 * @typeParam E - The Error type.
 * @typeParam A - The success value type.
 * @param maybe - The Maybe<A> value.
 * @param on_none_error - The error to use if Maybe is None.
 * @returns ReaderT<R, E, A> that returns Ok(A) if Some, otherwise Err(on_none_error).
 */
export const fromMaybe = <R, E, A>(
  maybe: Maybe<A>,
  on_none_error: E,
): ReaderT<R, E, A> => {
  return (_env: R) => {
    if (isSome(maybe)) {
      return Ok(maybe);
    }
    return Err(on_none_error);
  };
};

/**
 * Converts a nullable value into a ReaderT.
 * @typeParam R - The Environment type.
 * @typeParam E - The Error type.
 * @typeParam A - The success value type.
 * @param maybe - The nullable value (A | null | undefined).
 * @param on_none_error - The error to use if the value is null or undefined.
 * @returns ReaderT<R, E, A> that returns Ok(A) if value exists, otherwise Err(on_none_error).
 */
export const fromNullable = fromMaybe;

/**
 * Applies a pure function (A) => B to the success value inside the ReaderT.
 * This is the 'map' operation (Functor) for ReaderT.
 * @typeParam R - The Environment type.
 * @typeParam E - The Error type.
 * @typeParam A - The type of the input value.
 * @typeParam B - The type of the output value.
 * @param reader - The source ReaderT<R, E, A>.
 * @param f_ab - The mapping function (A) => B.
 * @returns ReaderT<R, E, B> with the transformed success value.
 */
export const map = <R, E, A, B>(
  reader: ReaderT<R, E, A>,
  f_ab: (a: A) => B,
): ReaderT<R, E, B> => {
  return (env: R) => {
    const result_a = reader(env);
    return mapResult(result_a, f_ab);
  };
};

/**
 * Chains two ReaderT computations. The result of the first reader (A) is used to
 * produce the second reader (ReaderT<R, E, B>). This is the 'flatMap' or 'bind' operation (Monad).
 * @typeParam R - The Environment type.
 * @typeParam E - The Error type.
 * @typeParam A - The type of the input value of the first reader.
 * @typeParam B - The type of the final output value.
 * @param reader - The initial ReaderT<R, E, A>.
 * @param f_next - A function that takes the result of 'reader' and returns the next ReaderT<R, E, B>.
 * @returns ReaderT<R, E, B> containing the result of the chained computation.
 */
export const andThen = <R, E, A, B>(
  reader: ReaderT<R, E, A>,
  f_next: (a: A) => ReaderT<R, E, B>,
): ReaderT<R, E, B> => {
  return (env: R) => {
    const result_a = reader(env);
    return andThenResult(result_a, (a: A) => {
      const next_reader = f_next(a);
      return next_reader(env);
    });
  };
};

/**
 * Applies a function contained within a ReaderT (R, E, (A) => B) to a value
 * contained within another ReaderT (R, E, A). This is the 'ap' operation (Applicative Functor).
 * @typeParam R - The Environment type.
 * @typeParam E - The Error type.
 * @typeParam A - The type of the input value.
 * @typeParam B - The type of the output value.
 * @param reader_fab - ReaderT containing the function (A) => B.
 * @param reader_a - ReaderT containing the input value A.
 * @returns ReaderT<R, E, B> containing the applied result.
 */
export const ap = <R, E, A, B>(
  reader_fab: ReaderT<R, E, (a: A) => B>,
  reader_a: ReaderT<R, E, A>,
): ReaderT<R, E, B> => {
  return (env: R) => {
    const result_fab = reader_fab(env);
    const result_a = reader_a(env);
    return apResult(result_fab, result_a);
  };
};

/**
 * Lifts a binary function (A, B) => C into the ReaderT context.
 * It combines two ReaderTs using the Applicative 'ap' operation.
 * @typeParam R - The Environment type.
 * @typeParam E - The Error type.
 * @typeParam A - The type of the first input value.
 * @typeParam B - The type of the second input value.
 * @typeParam C - The type of the output value.
 * @param f_abc - The binary function (A, B) => C.
 * @returns A function that takes two ReaderTs and returns a ReaderT<R, E, C>.
 */
export const liftA2 =
  <R, E, A, B, C>(f_abc: (a: A, b: B) => C) =>
  (
    reader_a: ReaderT<R, E, A>,
    reader_b: ReaderT<R, E, B>,
  ): ReaderT<R, E, C> => {
    const reader_f_bc = map(reader_a, (a: A) => (b: B) => f_abc(a, b));
    return ap(reader_f_bc, reader_b);
  };

/**
 * Lifts a ternary function (A, B, C) => D into the ReaderT context.
 * It combines three ReaderTs using the Applicative 'ap' operation.
 * @typeParam R - The Environment type.
 * @typeParam E - The Error type.
 * @typeParam A - The type of the first input value.
 * @typeParam B - The type of the second input value.
 * @typeParam C - The type of the third input value.
 * @typeParam D - The type of the output value.
 * @param f_abcd - The ternary function (A, B, C) => D.
 * @returns A function that takes three ReaderTs and returns a ReaderT<R, E, D>.
 */
export const liftA3 =
  <R, E, A, B, C, D>(f_abcd: (a: A, b: B, c: C) => D) =>
  (
    reader_a: ReaderT<R, E, A>,
    reader_b: ReaderT<R, E, B>,
    reader_c: ReaderT<R, E, C>,
  ): ReaderT<R, E, D> => {
    const reader_f_cd = liftA2<R, E, A, B, (c: C) => D>(
      (a: A, b: B) => (c: C) => f_abcd(a, b, c),
    )(reader_a, reader_b);

    return ap(reader_f_cd, reader_c);
  };

/**
 * Performs a side effect using the result of the first ReaderT, and then returns
 * the original result. The side effect can fail (return Err), in which case the
 * entire computation fails with that error.
 * @typeParam R - The Environment type.
 * @typeParam E - The Error type.
 * @typeParam A - The type of the original value to be passed through.
 * @param reader - The source ReaderT<R, E, A>.
 * @param f - A function that takes A and returns a ReaderT<R, E, unknown> (the side effect).
 * @returns ReaderT<R, E, A> that returns the original success value or the side effect's error.
 */
export const tap = <R, E, A>(
  reader: ReaderT<R, E, A>,
  f: (a: A) => ReaderT<R, E, unknown>,
): ReaderT<R, E, A> => {
  return (env: R) => {
    const result_a = reader(env);

    return andThenResult(result_a, (a: A) => {
      const side_effect_reader = f(a);
      const side_effect_result = side_effect_reader(env);

      if (!side_effect_result.ok) {
        return side_effect_result;
      }
      return Ok(a);
    });
  };
};

/**
 * Transforms the error type (E) of a ReaderT using a mapping function.
 * This is the 'mapError' operation for ReaderT.
 * @typeParam R - The Environment type.
 * @typeParam E - The original Error type.
 * @typeParam A - The success value type.
 * @typeParam F - The new Error type.
 * @param reader - The source ReaderT<R, E, A>.
 * @param fn_fe - The function (E) => F to map the error.
 * @returns ReaderT<R, F, A> with the transformed error type.
 */
export const mapErr = <R, E, A, F>(
  reader: ReaderT<R, E, A>,
  fn_fe: (e: E) => F,
): ReaderT<R, F, A> => {
  return (env: R) => {
    const result_a = reader(env);
    return mapErrResult(result_a, fn_fe);
  };
};

/**
 * Provides an alternative ReaderT to execute if the primary ReaderT fails.
 * This allows for error recovery or fallback behavior.
 * @typeParam R - The Environment type.
 * @typeParam E - The primary error type.
 * @typeParam A - The success value type.
 * @typeParam F - The alternative error type.
 * @param reader - The primary ReaderT<R, E, A>.
 * @param alternative_reader - A function that takes the error E and returns a recovery ReaderT<R, F, A>.
 * @returns ReaderT<R, F, A> that is either the success of the primary reader, or the result of the alternative reader.
 */
export const orElse = <R, E, A, F>(
  reader: ReaderT<R, E, A>,
  alternative_reader: (e: E) => ReaderT<R, F, A>,
): ReaderT<R, F, A> => {
  return (env: R) => {
    const result_a = reader(env);
    if (result_a.ok) {
      return result_a as Result<A, F>;
    }
    const error = result_a.error;
    const recovered_reader = alternative_reader(error);
    return recovered_reader(env);
  };
};

/**
 * Maps a list of items (T[]) to ReaderT computations and collects the results (A[])
 * into a single ReaderT. This is the 'traverse' operation.
 * @typeParam R - The Environment type.
 * @typeParam E - The Error type.
 * @typeParam T - The type of input items.
 * @typeParam A - The type of output values.
 * @param f_ta - The function (T) => ReaderT<R, E, A> to apply to each item.
 * @returns ReaderT<R, E, A[]> that contains an array of results A or the first error E.
 */
export const traverse =
  <R, E, T, A>(f_ta: (t: T) => ReaderT<R, E, A>) =>
  (items: readonly T[]): ReaderT<R, E, A[]> => {
    return (env: R) => {
      const results: Result<A, E>[] = items.map((item) => {
        const reader = f_ta(item);
        return reader(env);
      });
      return allResult(results);
    };
  };

/**
 * Sequences a list of ReaderT computations into a single ReaderT.
 * This is a specialization of 'traverse' where the function is the identity.
 * @typeParam R - The Environment type.
 * @typeParam E - The Error type.
 * @typeParam A - The success value type.
 * @param readers - The list of ReaderT<R, E, A> computations.
 * @returns ReaderT<R, E, A[]> that contains an array of results A or the first error E.
 */
export const sequence = <R, E, A>(
  readers: readonly ReaderT<R, E, A>[],
): ReaderT<R, E, A[]> => {
  return traverse((reader: ReaderT<R, E, A>) => reader)(readers);
};
