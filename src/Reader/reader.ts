// ========================================
// ./src/Reader/reader.ts
// ========================================
import type {Reader} from './types';

/**
 * Creates a Reader that ignores the environment (R) and returns the given value (A).
 * This is the 'return' or 'pure' operation (Applicative/Monad).
 *
 * @typeParam R - The Environment type.
 * @typeParam A - The type of the value to wrap.
 * @param a - The value to be wrapped in Reader.
 * @returns Reader<R, A> that returns 'a'.
 */
export const of = <R, A>(a: A): Reader<R, A> => {
  return (_env: R) => a; // 忽略环境参数 R，直接返回传入的值 a。
};

/**
 * Applies a function contained within a Reader (R, (A) => B) to a value
 * contained within another Reader (R, A), preserving the environment.
 * This is the 'ap' operation (Applicative Functor).
 *
 * @typeParam R - The Environment type.
 * @typeParam A - The type of the input value.
 * @typeParam B - The type of the output value.
 * @param reader_fab - Reader containing the function (A) => B.
 * @param reader_a - Reader containing the input value A.
 * @returns Reader<R, B> containing the result of applying the function.
 */
export const ap = <R, A, B>(
  reader_fab: Reader<R, (a: A) => B>,
  reader_a: Reader<R, A>
): Reader<R, B> => {
  return (env: R) => {
    const f_ab = reader_fab(env);
    const result_a = reader_a(env);
    return f_ab(result_a);
  };
};

/**
 * Creates a Reader that retrieves the environment (R) and returns it.
 * This is the 'ask' operation in Reader Monad.
 *
 * @typeParam R - The Environment type.
 * @returns Reader<R, R> that returns the environment 'R'.
 */
export const ask = <R>(): Reader<R, R> => {
  return (env: R) => env;
};

/**
 * Applies a function (A) => B to the value inside the Reader, maintaining the
 * environment context. This is the 'map' operation (Functor).
 *
 * @typeParam R - The Environment type.
 * @typeParam A - The type of the input value.
 * @typeParam B - The type of the output value.
 * @param reader - The source Reader<R, A>.
 * @param f - The mapping function (A) => B.
 * @returns Reader<R, B> containing the mapped value.
 */
export const map = <R, A, B>(
  reader: Reader<R, A>,
  f: (a: A) => B
): Reader<R, B> => {
  return (env: R) => {
    const result_a = reader(env);
    return f(result_a);
  };
};

/**
 * Chains two Reader computations. The result of the first reader (A) is used to
 * produce the second reader (Reader<R, B>).
 * This is the 'flatMap' or 'bind' operation (Monad).
 *
 * @typeParam R - The Environment type.
 * @typeParam A - The type of the input value of the first reader.
 * @typeParam B - The type of the final output value.
 * @param reader - The initial Reader<R, A>.
 * @param f - A function that takes the result of 'reader' and returns the next Reader<R, B>.
 * @returns Reader<R, B> containing the final result.
 */
export const anThen = <R, A, B>(
  reader: Reader<R, A>,
  f: (a: A) => Reader<R, B>
): Reader<R, B> => {
  return (env: R) => {
    const result_a = reader(env);
    const next_reader = f(result_a);
    return next_reader(env);
  };
};

/**
 * Performs a side effect using the result of the first Reader, and then returns
 * the original result, ignoring the side effect's return value.
 * Note: The side effect function must return a Reader.
 *
 * @typeParam R - The Environment type.
 * @typeParam A - The type of the original value to be passed through.
 * @param reader - The source Reader<R, A>.
 * @param f - A function that takes A and returns a Reader<R, unknown> (the side effect).
 * @returns Reader<R, A> containing the original value.
 */
export const tap = <R, A>(
  reader: Reader<R, A>,
  f: (a: A) => Reader<R, unknown>
): Reader<R, A> => {
  return (env: R) => {
    const result_a = reader(env);
    const side_effect_reader = f(result_a);
    side_effect_reader(env);
    return result_a;
  };
};

/**
 * Lifts a binary function (A, B) => C into the Reader context.
 * It takes a standard two-argument function and two Readers, and returns a new Reader
 * that applies the function to the values within the Readers. This is achieved via Currying and 'ap'.
 *
 * @typeParam R - The Environment type
 * @typeParam A - The type of the first input value
 * @typeParam B - The type of the second input value
 * @typeParam C - The type of the output value
 * @param f_abc - The binary function (A, B) => C
 * @returns A function that takes two Readers and returns a Reader<R, C>
 */
export const liftA2 =
  <R, A, B, C>(f_abc: (a: A, b: B) => C) =>
  (reader_a: Reader<R, A>, reader_b: Reader<R, B>): Reader<R, C> => {
    return ap(
      map(reader_a, (a: A) => (b: B) => f_abc(a, b)),
      reader_b
    );
  };

/**
 * Lifts a ternary function (A, B, C) => D into the Reader context.
 * It takes a standard three-argument function and three Readers, and returns a new Reader
 * that applies the function to the values within the Readers. This is built upon liftA2 and 'ap'.
 *
 * @typeParam R - The Environment type
 * @typeParam A - The type of the first input value
 * @typeParam B - The type of the second input value
 * @typeParam C - The type of the third input value
 * @typeParam D - The type of the output value
 * @param f_abcd - The ternary function (A, B, C) => D
 * @returns A function that takes three Readers and returns a Reader<R, D>
 */
export const liftA3 =
  <R, A, B, C, D>(f_abcd: (a: A, b: B, c: C) => D) =>
  (
    reader_a: Reader<R, A>,
    reader_b: Reader<R, B>,
    reader_c: Reader<R, C>
  ): Reader<R, D> => {
    const liftA2_R = liftA2<R, A, B, (c: C) => D>(
      (a: A, b: B) => (c: C) => f_abcd(a, b, c)
    );
    const reader_f_cd = liftA2_R(reader_a, reader_b);
    return ap(reader_f_cd, reader_c);
  };
