// ========================================
// ./src/Reader/reader-async.ts
// ========================================
/* eslint-disable @typescript-eslint/require-await */
import type {AsyncReader} from './types';

/**
 * Creates an AsyncReader that ignores the environment (R) and resolves immediately
 * with the given value (A). This is the 'return' or 'pure' operation.
 * @typeParam R - The Environment type.
 * @typeParam A - The type of the value to wrap.
 * @param a - The value to be wrapped in AsyncReader.
 * @returns AsyncReader<R, A> that resolves to 'a'.
 */
export const ofAsync = <R, A>(a: A): AsyncReader<R, A> => {
  return async (_env: R) => a;
};

/**
 * Creates an AsyncReader that retrieves the environment (R) and resolves with it.
 * This is the 'ask' operation in Reader Monad.
 * @typeParam R - The Environment type.
 * @returns AsyncReader<R, R> that resolves to the environment 'R'.
 */
export const askAsync = <R>(): AsyncReader<R, R> => {
  return async (env: R) => env;
};

/**
 * Applies a function (A) => B to the value inside the AsyncReader, maintaining the
 * environment context. This is the 'map' operation (Functor).
 * @typeParam R - The Environment type.
 * @typeParam A - The type of the input value.
 * @typeParam B - The type of the output value.
 * @param reader - The source AsyncReader<R, A>.
 * @param f - The mapping function (A) => B.
 * @returns AsyncReader<R, B> containing the mapped value.
 */
export const mapAsync = <R, A, B>(
  reader: AsyncReader<R, A>,
  f: (a: A) => B
): AsyncReader<R, B> => {
  return (env: R) => {
    const promise_a = reader(env);
    return promise_a.then(f);
  };
};

/**
 * Chains two AsyncReader computations. The result of the first reader (A) is used to
 * produce the second reader (AsyncReader<R, B>). This is the 'flatMap' or 'bind' operation (Monad).
 * @typeParam R - The Environment type.
 * @typeParam A - The type of the input value of the first reader.
 * @typeParam B - The type of the final output value.
 * @param reader - The initial AsyncReader<R, A>.
 * @param f - A function that takes the result of 'reader' and returns the next AsyncReader<R, B>.
 * @returns AsyncReader<R, B> containing the final result.
 */
export const anThenAsync = <R, A, B>(
  reader: AsyncReader<R, A>,
  f: (a: A) => AsyncReader<R, B>
): AsyncReader<R, B> => {
  return (env: R) => {
    const promise_a = reader(env);
    return promise_a.then((result_a) => {
      // 拿到第一个reader的结果A后，执行函数f，得到下一个AsyncReader<R, B>
      const next_reader = f(result_a);
      // 在相同的环境env下执行next_reader，返回最终的Promise<B>
      return next_reader(env);
    });
  };
};

/**
 * Applies a function contained within an AsyncReader (R, (A) => B) to a value
 * contained within another AsyncReader (R, A), preserving the environment. This is the 'ap' operation (Applicative Functor).
 * @typeParam R - The Environment type.
 * @typeParam A - The type of the input value.
 * @typeParam B - The type of the output value.
 * @param reader_fab - AsyncReader containing the function (A) => B.
 * @param reader_a - AsyncReader containing the input value A.
 * @returns AsyncReader<R, B> containing the result of applying the function.
 */
export const apAsync = <R, A, B>(
  reader_fab: AsyncReader<R, (a: A) => B>,
  reader_a: AsyncReader<R, A>
): AsyncReader<R, B> => {
  return (env: R) => {
    const promise_fab = reader_fab(env);
    const promise_a = reader_a(env);
    // 同时执行两个Reader，得到函数f和值a，然后应用f(a)
    return Promise.all([promise_fab, promise_a]).then(([f_ab, result_a]) =>
      f_ab(result_a)
    );
  };
};

/**
 * Performs a side effect using the result of the first AsyncReader, and then returns
 * the original result, ignoring the side effect's return value.
 * Note: The side effect function must return an AsyncReader.
 * @typeParam R - The Environment type.
 * @typeParam A - The type of the original value to be passed through.
 * @param reader - The source AsyncReader<R, A>.
 * @param f - A function that takes A and returns an AsyncReader<R, unknown> (the side effect).
 * @returns AsyncReader<R, A> containing the original value.
 */
export const tapAsync = <R, A>(
  reader: AsyncReader<R, A>,
  f: (a: A) => AsyncReader<R, unknown>
): AsyncReader<R, A> => {
  return (env: R) => {
    const promise_a = reader(env);
    return promise_a.then((result_a) => {
      // 得到result_a后，创建副作用reader
      const side_effect_reader = f(result_a);
      // 在相同的环境env下执行副作用reader
      const promise_side_effect = side_effect_reader(env);
      // 等待副作用完成后，返回原始结果result_a（忽略副作用reader的返回值）
      return promise_side_effect.then(() => result_a);
    });
  };
};

/**
 * Asynchronously lifts a binary function (A, B) => C into the AsyncReader context.
 * It combines two AsyncReaders using the Applicative 'ap' operation.
 * @typeParam R - The Environment type
 * @typeParam A - The type of the first input value
 * @typeParam B - The type of the second input value
 * @typeParam C - The type of the output value
 * @param f_abc - The binary function (A, B) => C
 * @returns A function that takes two AsyncReaders and returns an AsyncReader<R, C>
 */
export const liftA2Async =
  <R, A, B, C>(f_abc: (a: A, b: B) => C) =>
  (
    reader_a: AsyncReader<R, A>,
    reader_b: AsyncReader<R, B>
  ): AsyncReader<R, C> => {
    const reader_f_bc = mapAsync(reader_a, (a: A) => (b: B) => f_abc(a, b));
    return apAsync(reader_f_bc, reader_b);
  };

/**
 * Asynchronously lifts a ternary function (A, B, C) => D into the AsyncReader context.
 * It combines three AsyncReaders using the Applicative 'ap' operation.
 * @typeParam R - The Environment type
 * @typeParam A - The type of the first input value
 * @typeParam B - The type of the second input value
 * @typeParam C - The type of the third input value
 * @typeParam D - The type of the output value
 * @param f_abcd - The ternary function (A, B, C) => D
 * @returns A function that takes three AsyncReaders and returns an AsyncReader<R, D>
 */
export const liftA3Async =
  <R, A, B, C, D>(f_abcd: (a: A, b: B, c: C) => D) =>
  (
    reader_a: AsyncReader<R, A>,
    reader_b: AsyncReader<R, B>,
    reader_c: AsyncReader<R, C>
  ): AsyncReader<R, D> => {
    const reader_f_cd = liftA2Async<R, A, B, (c: C) => D>(
      (a: A, b: B) => (c: C) => f_abcd(a, b, c)
    )(reader_a, reader_b);
    return apAsync(reader_f_cd, reader_c);
  };
