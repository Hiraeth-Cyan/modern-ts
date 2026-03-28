// ========================================
// ./src/Utils/Functions/curry.ts
// ========================================

import type {
  AnyFunction,
  IsNonNegativeIntegerLiteral,
  Subtract,
} from '../type-tool';

/**
 * The placeholder symbol used in curried functions to skip arguments.
 */
export const __ = Symbol('Curry placeholder');

/**
 * Type alias for the curry placeholder symbol.
 */
export type __ = typeof __;

// -- Internal Types --

// 从 rest 参数数组类型中提取元素类型
type RestElement<T> = T extends readonly (infer E)[]
  ? number extends T['length']
    ? E
    : never
  : never;

// 从元组类型中提取前 N 个元素（不保留可选标签，用于当长度无法确定时）
type Take<
  T extends readonly unknown[],
  N extends number,
  Acc extends readonly unknown[] = [],
> = Acc['length'] extends N
  ? Acc
  : T extends readonly [infer First, ...infer Rest]
    ? Take<Rest, N, [...Acc, First]>
    : RestElement<T> extends never
      ? Acc
      : Take<[RestElement<T>, ...RestElement<T>[]], N, Acc>;

// 从元组类型中丢弃前 N 个元素
type Drop<
  T extends readonly unknown[],
  N extends number,
  Acc extends readonly unknown[] = [],
> = Acc['length'] extends N
  ? T
  : T['length'] extends 0
    ? []
    : T extends readonly [unknown, ...infer Tail]
      ? Drop<Tail, N, [...Acc, unknown]>
      : T extends readonly [unknown?, ...infer Tail]
        ? Drop<Tail, N, [...Acc, unknown]>
        : [];

// 从元组类型中提取前 N 个元素，保留可选标签
type TakeWithLabels<
  T extends readonly unknown[],
  N extends number,
> = number extends N
  ? T
  : number extends T['length']
    ? Take<T, N>
    : Drop<T, N> extends []
      ? T
      : T extends [...infer Head, ...Drop<T, N>]
        ? Head
        : T;

// 品牌类型，用于在类型层面标记空调用错误
type EmptyCallError = {
  readonly __error_brand: unique symbol;
};

// 校验传入的参数是否是期望参数的有效前缀，禁止空调用并确保类型匹配
type ValidApply<
  Given extends readonly unknown[],
  Expected extends readonly unknown[],
> = Given['length'] extends 0
  ? [EmptyCallError]
  : IsValidPrefix<Given, Expected> extends true
    ? Given
    : {
        [K in keyof Given]: K extends keyof Expected
          ? Given[K] extends Expected[K] | __
            ? Given[K]
            : Expected[K]
          : never;
      };

// 递归检查 Given 参数是否是 Expected 参数的有效前缀，允许使用占位符
type IsValidPrefix<
  Given extends readonly unknown[],
  Expected extends readonly unknown[],
> = Given extends readonly [infer GFirst, ...infer GRest]
  ? Expected extends readonly [unknown?, ...infer ERest]
    ? GFirst extends Expected[0] | __
      ? IsValidPrefix<GRest, ERest>
      : false
    : false
  : true;

// 计算本次调用后剩余需要的参数类型，将占位符对应的类型填充进去
type RemainingArgs<
  Given extends readonly unknown[],
  Expected extends readonly unknown[],
  Acc extends readonly unknown[] = [],
> = Given extends readonly []
  ? [...Acc, ...Expected]
  : Expected extends readonly []
    ? Acc
    : Given extends readonly [infer GFirst, ...infer GRest]
      ? Expected extends readonly [unknown?, ...infer ERest]
        ? GFirst extends __
          ? RemainingArgs<GRest, ERest, [...Acc, Expected[0]]>
          : RemainingArgs<GRest, ERest, Acc>
        : Acc
      : Acc;

// 检查是否所有必需参数都已提供（长度匹配且无占位符）
type AllArgsProvided<
  Given extends readonly unknown[],
  Expected extends readonly unknown[],
> = Given['length'] extends Required<Expected>['length']
  ? __ extends Given[number]
    ? false
    : true
  : false;

// Curry 类型品牌，用于检测函数是否已经是柯里化函数
type CurryBrand = {readonly __is_curry__: unique symbol};

type ValidCurryFn<F> = F extends CurryBrand // 不能是已柯里化的函数
  ? 'The function is already curried.'
  : F extends AnyFunction
    ? Parameters<F>['length'] extends 0 | 1 // 函数必须至少有2个参数
      ? 'The function must have at least 2 parameters.'
      : F
    : 'The parameter must be a function.';

// 目标参数长度（包括可选参数的最长长度）
type CurryArity<F extends AnyFunction> = F extends (...args: infer A) => unknown
  ? Required<A>['length']
  : never;

// 对 rest/可变参数（length = number）不做上界限制
type ValidLengthForFn<F extends AnyFunction, N extends number> =
  IsNonNegativeIntegerLiteral<N> extends false
    ? 'The length parameter must be a positive integer literal.'
    : N extends 0 | 1
      ? 'Currying is meaningless for functions with 0 or 1 parameters'
      : number extends CurryArity<F>
        ? N
        : Subtract<CurryArity<F> & number, N> extends never
          ? `The length parameter must be <= ${CurryArity<F> & number}.`
          : N;

/**
 * 柯里化函数的递归类型，直接操作剩余参数元组。
 * @template A - 目标参数列表（已通过 TakeWithLabels 处理）
 * @template R - 最终返回值类型
 */
type CurryFromArgs<A extends readonly unknown[], R> = {
  <G extends readonly unknown[]>(
    ...args: ValidApply<G, A>
  ): AllArgsProvided<G, A> extends true
    ? R
    : RemainingArgs<G, A> extends infer Rest
      ? Rest extends readonly [unknown?] | readonly []
        ? (...args: Rest extends readonly unknown[] ? Rest : []) => R
        : Rest extends readonly unknown[]
          ? CurryFromArgs<Rest, R>
          : never
      : never;
};

/**
 * 入口柯里化类型，只执行一次参数截取。
 */
type Curry<F, N extends number> = F extends (...args: infer A) => infer R
  ? TakeWithLabels<A, N> extends infer Target
    ? Target extends readonly unknown[]
      ? CurryFromArgs<Target, R>
      : never
    : never
  : never;

// ============================================
// curry 运行时实现（保持不变）
// ============================================

/**
 * Creates a curried version of a function, supporting argument placeholders (`__`).
 * The curried function is recursively callable until all required arguments are supplied.
 *
 * @template F - The function type to curry
 * @template N - The arity (number of required parameters) for the original function
 * @param fn - The function to curry
 * @param length - The arity of `fn`; must be a positive integer literal
 * @returns A curried function that accumulates arguments until all required ones are provided
 *
 * @example
 * ```typescript
 * const add = curry((a: number, b: number) => a + b, 2);
 * add(1)(2); // 3
 * ```
 *
 * @example
 * ```typescript
 * // Using placeholder
 * const add = curry((a: number, b: number, c: number) => a + b + c, 3);
 * add(1, __)(2)(3); // 6
 * ```
 */
export function curry<F extends AnyFunction, N extends number>(
  fn: ValidCurryFn<F>,
  length: ValidLengthForFn<F, N>,
): Curry<F, N> & CurryBrand {
  // TS 需要知道它不是那些报错的字符串
  const _length = length as number;
  const _fn = fn as AnyFunction;

  const makeCurried = (prev_args: unknown[], holes: number) => {
    return (...next_args: unknown[]): unknown => {
      // 1. 复制之前的参数
      const args = [...prev_args];
      let ptr = 0;
      let h = holes;

      if (holes > 0) {
        const argsLen = args.length;
        const nextLen = next_args.length;

        for (let i = 0; i < argsLen && ptr < nextLen; i++) {
          if (args[i] === __) {
            const val = next_args[ptr++];
            if (val !== __) {
              args[i] = val;
              h--;
            }
          }
        }
      }

      const nextLen = next_args.length;
      for (; ptr < nextLen; ptr++) {
        const val = next_args[ptr];
        args.push(val);
        if (val === __) h++;
      }

      return args.length - h >= _length ? _fn(...args) : makeCurried(args, h);
    };
  };

  return makeCurried([], 0) as unknown as Curry<F, N> & CurryBrand;
}
