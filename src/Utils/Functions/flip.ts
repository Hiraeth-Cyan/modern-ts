// ========================================
// ./src/Utils/Functions/flip.ts
// ========================================

import type {AnyFunction} from '../type-tool';

// 去掉第一个参数（允许第一个可选）
type Tail<T extends readonly unknown[]> = T extends readonly [
  unknown?,
  ...infer R,
]
  ? R
  : [];

// 提取第一个参数为单元素元组（保留可选标记）
type FirstAsTuple<T extends readonly unknown[]> = T extends readonly [
  unknown?,
  ...infer R,
]
  ? T extends readonly [...infer F, ...R]
    ? F
    : []
  : [];

// 提取第二个参数为单元素元组
type SecondAsTuple<T extends readonly unknown[]> = FirstAsTuple<Tail<T>>;

// 从第三个参数开始
type DropFirstTwo<T extends readonly unknown[]> = Tail<Tail<T>>;

// 翻转前两个参数，只要存在索引 1（即有第二个参数）就翻转
type FlipFirstTwo<T extends readonly unknown[]> = 1 extends keyof T
  ? [...SecondAsTuple<T>, ...FirstAsTuple<T>, ...DropFirstTwo<T>]
  : T;

// 翻转后的函数类型
type Flip<F> = F extends (this: infer This, ...args: infer A) => infer R
  ? (this: This, ...args: FlipFirstTwo<A>) => R
  : never;

// 在参数位置（逆变位）施加约束：只有当函数合法时才可传入
type ValidFlipFn<F> = F extends AnyFunction
  ? number extends Parameters<F>['length']
    ? 'Rest parameters are not supported.'
    : Parameters<F>['length'] extends 0 | 1
      ? 'The function must have at least 2 parameters.'
      : F
  : 'The parameter must be a function.';

/**
 * Creates a new function that swaps the first two arguments of the original function.
 * @param fn The original function (must have at least 2 parameters, no rest parameters)
 * @returns The flipped function
 *
 * @example
 * const subtract = (a: number, b: number) => a - b;
 * const flipped = flip(subtract);
 * flipped(5, 3); // => -2
 *
 */
export function flip<F>(fn: ValidFlipFn<F>): Flip<F> {
  const _fn = fn as AnyFunction; // TS需要知道它不是那几个错误字符串
  return function (this: ThisParameterType<F>, ...args: unknown[]) {
    // 类型系统保证至少有两个参数
    const temp = args[0];
    args[0] = args[1];
    args[1] = temp;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return _fn.apply(this, args);
  } as unknown as Flip<F>;
}

// 支持首参必选/可选，并尽量保留可选标记
type Shift<T extends readonly unknown[]> = T extends readonly [
  unknown,
  ...infer R,
]
  ? T extends readonly [...infer F, ...R]
    ? [F, R]
    : never
  : T extends readonly [unknown?, ...infer R]
    ? T extends readonly [...infer F, ...R]
      ? [F, R]
      : never
    : [[], []];

type ReverseTuple<
  T extends readonly unknown[],
  Acc extends readonly unknown[] = [],
  Depth extends readonly unknown[] = [],
> = number extends T['length']
  ? [...T, ...Acc] // 非定长，直接停止
  : T extends readonly []
    ? Acc
    : Shift<T> extends [
          infer F extends readonly unknown[],
          infer R extends readonly unknown[],
        ]
      ? ReverseTuple<R, [...F, ...Acc], [...Depth, 0]>
      : Acc;

type ReverseArgs<F> = F extends (this: infer This, ...args: infer A) => infer R
  ? (this: This, ...args: ReverseTuple<A>) => R
  : never;

/**
 *
 * @template F - The function type.
 * @param fn - The function to reverse arguments for (must have at least 2 parameters, no rest).
 * @returns The new function with reversed arguments.
 *
 * @example
 * ```typescript
 * const fn = (a: string, b: number, c: boolean) => `${a}-${b}-${c}`;
 * const reversed = reverseArgs(fn);
 * reversed(true, 42, 'hello'); // => "hello-42-true"
 * ```
 */
export const reverseArgs = <F>(fn: ValidFlipFn<F>): ReverseArgs<F> => {
  const _fn = fn as AnyFunction;
  return function (this: ThisParameterType<F>, ...args: unknown[]) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return _fn.apply(this, args.reverse());
  } as unknown as ReverseArgs<F>;
};
