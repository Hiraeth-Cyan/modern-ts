// ========================================
// ./src/Utils/Functions/curry.ts
// ========================================

import {ParameterError} from 'src/Errors';
import type {AnyFunction} from '../type-tool';

/**
 * The placeholder symbol used in curried functions to skip arguments.
 */
export const __ = Symbol('Curry placeholder');

/**
 * Type alias for the curry placeholder symbol.
 */
export type __ = typeof __;

// -- Internal Types --

// 从 rest 参数数组类型中提取元素类型，如果不是 rest 参数数组则返回 never
// 例如：RestElement<string[]> = string，RestElement<[string, number]> = never
type RestElement<T> = T extends readonly (infer E)[] // 匹配数组类型，推断元素类型 E
  ? number extends T['length'] // 判断是否是 rest 参数数组（长度不固定）
    ? E // 是 rest 参数数组，返回元素类型
    : never // 是固定长度元组，返回 never
  : never; // 不是数组类型，返回 never

// 从元组类型中提取前 N 个元素，支持普通元组和 rest 参数数组（如 T[]）
// 例如：Take<[string, number, boolean], 2> = [string, number]
type Take<
  T extends readonly unknown[], // 待提取的元组
  N extends number, // 提取数量
  Acc extends readonly unknown[] = [], // 累加器，用于递归收集元素
> = Acc['length'] extends N // 累加器长度达到 N，递归结束
  ? Acc
  : T extends readonly [infer First, ...infer Rest] // T 还有元素可取
    ? Take<Rest, N, [...Acc, First]> // 取出第一个元素放入累加器，继续递归
    : RestElement<T> extends never // T 是固定长度元组且已取完
      ? Acc // 返回已收集的结果
      : Take<[RestElement<T>, ...RestElement<T>[]], N, Acc>; // T 是 rest 数组，构造无限元组继续取

// 品牌类型，用于在类型层面标记空调用错误（不传参数直接调用）
type EmptyCallError = {
  readonly __error_brand: unique symbol; // 唯一符号，确保类型不兼容
};

// 校验传入的参数是否是期望参数的有效前缀，禁止空调用并确保类型匹配
// 如果校验通过返回原参数 T，否则返回一个映射类型，精准指出哪个位置类型错误
type ValidApply<
  T extends readonly unknown[], // 本次调用传入的参数
  A extends readonly unknown[], // 原函数期望的参数
> = T['length'] extends 0 // 禁止空调用，这毫无意义
  ? [EmptyCallError] // 返回错误类型，让 TypeScript 报错
  : IsValidPrefix<T, A> extends true // 检测前缀是否符合
    ? T // 校验通过，返回原参数类型
    : {
        // 校验失败，构造一个映射类型精准指出哪个位置类型错误
        [K in keyof T]: K extends keyof A
          ? T[K] extends A[K] | __
            ? T[K] // 类型匹配或使用了占位符，保持原类型
            : A[K] // 类型不匹配，显示期望的类型，让用户知道应该传什么
          : never; // 超出期望参数范围的位置
      };

// 递归检查 Given 参数是否是 Expected 参数的有效前缀，允许使用占位符 __ 代替任意参数
type IsValidPrefix<
  Given extends readonly unknown[], // 本次调用传入的参数
  Expected extends readonly unknown[], // 剩余期望的参数
> = Given extends readonly [infer GFirst, ...infer GRest] // 还有传入参数要检查
  ? Expected extends readonly [infer EFirst, ...infer ERest] // 还有期望参数可匹配
    ? GFirst extends EFirst | __ // 传入参数类型匹配期望类型或使用了占位符
      ? IsValidPrefix<GRest, ERest> // 继续检查剩余参数
      : false // 类型不匹配，校验失败
    : false // 传入参数多了，期望参数不够，校验失败
  : true; // 传入参数检查完毕，校验通过

// 计算本次调用后剩余需要的参数类型，将占位符对应的类型填充进去
// 例如：RemainingArgs<[__, string], [number, string, boolean]> = [number, boolean]
type RemainingArgs<
  Given extends readonly unknown[], // 本次调用传入的参数
  Expected extends readonly unknown[], // 剩余期望的参数
  Acc extends readonly unknown[] = [], // 累加器，收集占位符对应的类型
> = Given extends readonly [] // 传入参数已处理完毕
  ? [...Acc, ...Expected] // 合并占位符类型和剩余期望参数
  : Expected extends readonly [] // 期望参数已处理完毕（传入参数多了也不影响）
    ? Acc
    : Given extends readonly [infer GFirst, ...infer GRest]
      ? Expected extends readonly [infer EFirst, ...infer ERest]
        ? GFirst extends __ // 这个位置是占位符
          ? RemainingArgs<GRest, ERest, [...Acc, EFirst]> // 把期望类型加入累加器
          : RemainingArgs<GRest, ERest, Acc> // 这个位置是实参，跳过
        : Acc
      : Acc;

// 检查是否所有必需参数都已提供（长度匹配且无占位符）
type AllArgsProvided<
  Given extends readonly unknown[], // 已收集的参数
  Expected extends readonly unknown[], // 原函数期望的参数
> = Given['length'] extends Expected['length'] // 长度匹配
  ? __ extends Given[number] // 检查是否还有占位符
    ? false // 有占位符，还需要继续填充
    : true // 全是实参，可以执行了
  : false; // 长度不够，继续柯里化

// 柯里化函数的类型定义，递归地根据传入参数决定返回类型
// 当参数凑齐时返回原函数结果，否则返回继续柯里化的函数
type Curry<
  F, // 待柯里化的函数
  N extends number, // 执行所需参数数量
> = F extends (...args: infer A) => infer R // 提取函数参数和返回类型
  ? number extends N // N 是动态 number 类型而非字面量
    ? {
        readonly __error: 'The length parameter must be a literal number (e.g., 2), not a variable of type number.';
      }
    : N extends 0 // 0 参数不需要柯里化
      ? {
          readonly __error: '0 parameters do not need currying, which is meaningless';
        }
      : Take<Required<A>, N> extends infer Target // 提取前 N 个参数作为目标
        ? Target extends readonly unknown[]
          ? <T extends readonly unknown[]>(
              ...args: ValidApply<T, Target> // 校验传入参数
            ) => AllArgsProvided<T, Target> extends true // 参数凑齐了
              ? R // 返回原函数结果
              : RemainingArgs<T, Target> extends infer P // 计算剩余参数
                ? P extends readonly [infer Single] // 剩余单个参数
                  ? (arg: Single) => R // 返回单参数函数（便于兼容 pipe）
                  : Curry<
                      (...args: P extends readonly unknown[] ? P : []) => R,
                      P extends readonly unknown[] ? P['length'] : 0
                    > // 返回继续柯里化的函数
                : never
          : never
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
 * @template N - The required arity (number of arguments) for the function to execute
 * @param fn - The function to curry
 * @param length - The required arity (number of arguments) for the function to execute
 * @returns The curried function
 * @throws If `length` is not a positive integer
 */
export function curry<F extends AnyFunction, N extends number>(
  fn: F,
  length: N,
): Curry<F, N>;

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
        ? fn(...args.slice(0, length))
        : makeCurried(args, h);
    };
  };

  return makeCurried([], 0);
}
