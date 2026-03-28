// ========================================
// ./src/Utils/Functions/ary.ts
// ========================================

import type {
  AnyFunction,
  IsNonNegativeIntegerLiteral,
  Subtract,
} from '../type-tool';

// 从 rest 参数数组类型中提取元素类型
type RestElement<T> = T extends readonly (infer E)[]
  ? number extends T['length']
    ? E
    : never
  : never;

// 从元组类型中提取前 N 个元素
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
  : Drop<T, N> extends []
    ? T
    : T extends [...infer Head, ...Drop<T, N>]
      ? Head
      : T;

// 计算函数的参数个数
type FunctionArity<F extends AnyFunction> = F extends (
  ...args: infer A
) => unknown
  ? Required<A>['length']
  : never;

// ============================================
// Ary 参数验证类型（只负责验证 N）
// ============================================

type ValidAryN<F, N extends number> = F extends (...args: infer A) => unknown
  ? number extends N
    ? 'The length parameter must be a literal number (e.g., 2), not a variable of type number.'
    : IsNonNegativeIntegerLiteral<N> extends false
      ? 'The length parameter must be a non-negative integer.'
      : number extends A['length']
        ? N // rest 函数：只要求字面量，不检查范围
        : Subtract<FunctionArity<F> & number, N> extends never
          ? `The length parameter must be <= ${FunctionArity<F> & number}.`
          : N
  : never;

// ============================================
// Ary 约束 F 的类型
// ============================================

// 约束 F 必须是至少有一个参数的函数
type ValidAryFn<F> = F extends (...args: infer A) => unknown
  ? A['length'] extends 0
    ? 'The function must have at least one parameter.'
    : F
  : never;

// 约束 F 必须是至少有 N 个参数的函数
type ValidAryFnOf<F, N extends number> = F extends (...args: infer A) => unknown
  ? number extends A['length']
    ? ValidAryFn<F>
    : Subtract<Required<A>['length'] & number, N> extends never
      ? `The function must have at least ${N} parameters.`
      : ValidAryFn<F>
  : never;

// ============================================
// Ary 返回类型
// ============================================

export type Ary<F, N extends number> = F extends (
  this: infer This,
  ...args: infer A
) => infer R
  ? (
      number extends A['length'] ? Take<A, N> : TakeWithLabels<A, N>
    ) extends infer P
    ? P extends readonly unknown[]
      ? (this: This, ...args: P) => R
      : never
    : never
  : never;

/**
 * Creates a function that invokes `fn` with only the first `n` arguments provided.
 * Arguments beyond `n` are discarded and not passed to `fn`.
 *
 * @template F - The function type to limit arguments for
 * @template N - The number of arguments to accept (must be a literal number)
 * @param fn - The function to limit arguments for (must have at least one parameter)
 * @param _n - The number of arguments to accept (must be a non-negative integer at runtime)
 * @returns A new function that accepts only the first `n` arguments
 *
 * @example
 * ```typescript
 * const fn = (a: string, b: number, c: boolean) => true;
 * const limited = ary(fn, 2);
 * limited('hello', 42); // true
 * ```
 *
 * @example
 * ```typescript
 * // Fix parseInt in map
 * ['1', '2', '3'].map(ary(parseInt, 1)); // [1, 2, 3]
 * ```
 *
 * @example
 * ```typescript
 * // Ary can be composed
 * const fn = (a: string, b: number, c: boolean) => true;
 * const composed = ary(ary(fn, 2), 1); // ✅ works
 * ```
 */
export const ary = <F extends AnyFunction, N extends number>(
  fn: ValidAryFn<F>,
  _n: ValidAryN<F, N>,
): Ary<F, N> => {
  const _fn = fn as AnyFunction;
  return function (
    this: ThisParameterType<F>,
    ...args: unknown[]
  ): ReturnType<F> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return _fn.apply(this, args);
  } as unknown as Ary<F, N>;
};

/**
 * Creates a function that accepts only the first argument, ignoring any additional arguments.
 * This is a convenience wrapper around `ary(fn, 1)`.
 *
 * @template F - The function type to cap arguments for
 * @param fn - The function to cap arguments for (must have at least one parameter)
 * @returns A new function that accepts only the first argument
 *
 * @example
 * ```typescript
 * const fn = (a: number, b: number) => a + b;
 * unary(fn)(1, 2); // 1 (second argument ignored)
 * ```
 */
export const unary = <F extends AnyFunction>(fn: ValidAryFn<F>) =>
  ary(fn, 1 as ValidAryN<F, 1>);

/**
 * Creates a function that accepts only the first two arguments, ignoring any additional arguments.
 * This is a convenience wrapper around `ary(fn, 2)`.
 *
 * @template F - The function type to cap arguments for
 * @param fn - The function to cap arguments for (must have at least one parameter)
 * @returns A new function that accepts only the first two arguments
 *
 * @example
 * ```typescript
 * const fn = (a: number, b: number, c: number) => a + b + c;
 * binary(fn)(1, 2, 3); // 3 (third argument ignored)
 * ```
 */
export const binary = <F extends AnyFunction>(fn: ValidAryFnOf<F, 2>) =>
  ary(fn, 2 as ValidAryN<F, 2>);

/**
 * Creates a function that accepts only the first three arguments, ignoring any additional arguments.
 * This is a convenience wrapper around `ary(fn, 3)`.
 *
 * @template F - The function type to cap arguments for
 * @param fn - The function to cap arguments for (must have at least one parameter)
 * @returns A new function that accepts only the first three arguments
 *
 * @example
 * ```typescript
 * const fn = (a: number, b: number, c: number, d: number) => a + b + c + d;
 * trinary(fn)(1, 2, 3, 4); // 6 (fourth argument ignored)
 * ```
 */
export const trinary = <F extends AnyFunction>(fn: ValidAryFnOf<F, 3>) =>
  ary(fn, 3 as ValidAryN<F, 3>);
