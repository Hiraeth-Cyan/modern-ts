// ========================================
// ./src/Utils/Functions/curry.ts
// ========================================

import {ParameterError} from 'src/Errors';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFunction = (...args: any[]) => any;

/**
 * The placeholder symbol used in curried functions to skip arguments.
 */
export const __ = Symbol('Curry placeholder');

/**
 * Type alias for the curry placeholder symbol.
 */
export type __ = typeof __;

// -- Internal Types --

/**
 * A brand type used internally to signal an invalid call (e.g., calling without any arguments).
 */
type EmptyCallError = {
  readonly __error_brand: unique symbol;
};

/**
 * Validates whether the provided arguments (T) form a valid prefix for the expected arguments (A).
 * Prevents empty calls and ensures types match or use the placeholder.
 * @template T - The arguments currently provided
 * @template A - The expected arguments of the original function
 */
type ValidApply<
  T extends readonly unknown[],
  A extends readonly unknown[],
> = T['length'] extends 0 // 禁止空调用，这毫无意义
  ? [EmptyCallError]
  : IsValidPrefix<T, A> extends true // 检测前缀是否符合
    ? T
    : {
        [K in keyof T]: K extends keyof A
          ? T[K] extends A[K] | __
            ? T[K]
            : A[K] // 精准指出哪一格错了
          : never;
      };

/**
 * Recursively checks if the `Given` arguments are a valid prefix of the `Expected` arguments,
 * allowing the placeholder `__` in place of any expected argument type.
 * @template Given - The arguments provided in the current call
 * @template Expected - The remaining arguments expected by the original function
 */
type IsValidPrefix<
  Given extends readonly unknown[],
  Expected extends readonly unknown[],
> = Given extends readonly [infer GFirst, ...infer GRest]
  ? Expected extends readonly [infer EFirst, ...infer ERest]
    ? GFirst extends EFirst | __
      ? IsValidPrefix<GRest, ERest>
      : false // 类型不匹配，直接出局
    : false // Given 还没完，Expected 没了，短了！
  : true; // Given 耗尽，校验通过

/**
 * Calculates the types of the remaining arguments needed after a call,
 * filling the types corresponding to used placeholders (`__`).
 * @template Given - The arguments provided in the current call
 * @template Expected - The remaining arguments expected by the original function
 */
type RemainingArgs<
  Given extends readonly unknown[],
  Expected extends readonly unknown[],
  Acc extends readonly unknown[] = [], // 累加器
> = Given extends readonly []
  ? [...Acc, ...Expected] // 递归终点：把攒下的孔洞类型和剩余预期合并
  : Expected extends readonly []
    ? Acc // 给多了也不怕
    : Given extends readonly [infer GFirst, ...infer GRest]
      ? Expected extends readonly [infer EFirst, ...infer ERest]
        ? GFirst extends __
          ? RemainingArgs<GRest, ERest, [...Acc, EFirst]> // 遇到占位符，把类型塞进累加器，继续递归
          : RemainingArgs<GRest, ERest, Acc> // 填了实参，直接跳过这一位
        : Acc
      : Acc;

/**
 * Checks if all arguments required by the original function are now provided
 * (i.e., provided arguments match expected length and contain no placeholders).
 * @template Given - The currently accumulated arguments
 * @template Expected - The required arguments of the original function
 */
type AllArgsProvided<
  Given extends readonly unknown[],
  Expected extends readonly unknown[],
> = Given['length'] extends Expected['length']
  ? __ extends Given[number]
    ? false // 长度够了但有占位符，还没完
    : true // 长度够了且全是实参，大功告成！
  : false;

/**
 * Checks if the function has a rest parameter (...args) by comparing the length
 * of the parameter array to the length of the parameter array with placeholders replaced.
 * @template A - The parameter array of the function
 */
type IsRestParameter<A extends readonly unknown[]> = number extends A['length']
  ? true
  : false;

/**
 * Overloaded type definition for the `curry` function. It recursively defines the
 * return type based on the arguments provided in the current call.
 * @template F - The function being curried
 */

type Curry<F> = F extends (...args: infer A) => infer R
  ? IsRestParameter<A> extends true
    ? {
        readonly __error: 'Cannot curry a function with rest parameters (...args). Please use fixed-arity functions.';
      }
    : A['length'] extends 0
      ? {
          readonly __error: '0 parameters do not need currying, which is meaningless';
        }
      : <T extends readonly unknown[]>(
          ...args: ValidApply<T, Required<A>>
        ) => AllArgsProvided<T, Required<A>> extends true
          ? R
          : RemainingArgs<T, Required<A>> extends infer P
            ? P extends readonly [infer Single]
              ? (arg: Single) => R // 兼容pipe的关键
              : Curry<(...args: P extends readonly unknown[] ? P : []) => R>
            : never
  : never;

// ============================================
// curry
// ============================================

/**
 * Creates a curried version of a function that supports argument placeholders (`__`).
 * The resulting function will be recursively callable until the required number of
 * non-placeholder arguments (`length`) have been provided.
 * @template F - The function to curry
 * @param fn - The function to curry
 * @param length - The required arity (number of arguments) for the function to execute
 * @returns The curried function
 * @throws If `length` is not a positive integer
 */
export function curry<F extends AnyFunction>(fn: F, length: number): Curry<F>;

export function curry(fn: AnyFunction, length: number): unknown {
  if (length <= 0 || !Number.isInteger(length))
    throw new ParameterError(
      `Invalid length: Expected a positive integer, but received ${length}.`,
    );

  const makeCurried = (prev_args: unknown[], holes: number) => {
    return (...next_args: unknown[]): unknown => {
      const args = [...prev_args];
      let [ptr, h] = [0, holes];

      // 填坑：用新参数替换已有的占位符
      for (let i = 0; i < args.length && ptr < next_args.length; i++)
        if (args[i] === __ && next_args[ptr] !== __) {
          args[i] = next_args[ptr++];
          h--;
        } else if (args[i] === __ && next_args[ptr] === __) {
          // 当 args[i] 和 next_args[ptr] 都是占位符时，跳过
          ptr++;
        }
      // 如果 args[i] 不是占位符，直接跳过

      // 追加剩余参数
      while (ptr < next_args.length) {
        const val = next_args[ptr++];
        args.push(val);
        if (val === __) h++;
      }

      // 检查是否达到执行条件：总参数数减去占位符数 >= 要求的参数长度
      return args.length - h >= length
        ? fn(...args.map((x) => (x === __ ? undefined : x)).slice(0, length))
        : makeCurried(args, h);
    };
  };

  return makeCurried([], 0);
}
