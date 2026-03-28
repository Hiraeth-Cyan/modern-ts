// ========================================
// ./src/Utils/Functions/partial.ts
// ========================================

import type {AnyFunction} from '../type-tool';

/**
 * Creates a function that invokes `fn` with `partial` arguments prepended to those provided to the new function.
 *
 * @template Fixed - The fixed arguments type.
 * @template Rest - The remaining arguments type.
 * @template Ret - The return type.
 * @param fn - The function to partially apply arguments to.
 * @param fixedArgs - The arguments to prepend.
 * @returns The new partially applied function.
 */
export const partial = <
  This,
  Fixed extends readonly [unknown, ...unknown[]], // 至少固定一个参数
  Rest extends readonly unknown[],
  Ret,
>(
  fn: (this: This, ...args: [...Fixed, ...Rest]) => Ret,
  ...fixedArgs: Fixed
): ((this: This, ...rest: Rest) => Ret) => {
  return function (this: This, ...restArgs: Rest) {
    return fn.apply(this, [...fixedArgs, ...restArgs] as Parameters<typeof fn>);
  };
};

// 移除元组末尾 N 个元素
type DropRight<
  T extends readonly unknown[],
  N extends number,
  Acc extends readonly unknown[] = [],
> = Acc['length'] extends N
  ? T
  : T extends readonly [...infer Head, unknown]
    ? DropRight<Head, N, [...Acc, unknown]>
    : T extends readonly [...infer Head, unknown?]
      ? DropRight<Head, N, [...Acc, unknown]>
      : [];

type ExtractRest<
  T extends readonly unknown[],
  Fixed extends readonly unknown[],
> = DropRight<T, Fixed['length']>;

// 检测元组是否是固定长度（非 rest 参数数组）
type IsFixedLengthTuple<T extends readonly unknown[]> =
  number extends T['length'] ? false : true;

// 提取元组末尾 N 个元素的实际类型
// 当 N 超过元组长度时返回 never（用于检测参数数量溢出）
export type TakeRight<
  T extends readonly unknown[],
  N extends number,
  Acc extends readonly unknown[] = [],
> = Acc['length'] extends N
  ? Acc
  : T extends readonly []
    ? never
    : T extends readonly [...infer Head, infer Last]
      ? TakeRight<Head, N, [Last, ...Acc]>
      : T extends readonly [infer First, ...infer Rest, (infer Last)?]
        ? TakeRight<[First, ...Rest], N, [Last, ...Acc]>
        : T extends readonly [(infer Last)?]
          ? TakeRight<[], N, [Last, ...Acc]>
          : never;

// 当函数有 rest 参数或 Fixed 不是固定长度元组时返回 never，否则返回 Fixed
export type ValidFixedForRight<
  T extends readonly unknown[],
  Fixed extends readonly unknown[],
> = number extends T['length'] // 检测 T 是否是 rest 参数数组类型
  ? never
  : IsFixedLengthTuple<Fixed> extends false
    ? never
    : Fixed extends TakeRight<T, Fixed['length']>
      ? Fixed
      : never;

type AtLeastOneParams<T extends AnyFunction> =
  Required<Parameters<T>> extends [unknown, ...unknown[]] ? T : never;

/**
 * Creates a function that invokes `fn` with `partial` arguments appended to those provided to the new function.
 *
 * The fixed arguments are passed in the **same order** as they appear in the function signature,
 * making the API intuitive and readable.
 *
 * @example
 * ```typescript
 * const fn = (a: number, b: string, c: boolean) => `${a}-${b}-${c}`;
 *
 * // ✅ Correct: pass arguments in declaration order (fixes b and c)
 * const partial1 = partialRight(fn, 'hello', true);
 * partial1(1); // => "1-hello-true"
 *
 * // ❌ Incorrect: passing in reverse order would fix c='hello' (type error)
 * // partialRight(fn, true, 'hello'); // Error: 'hello' is not assignable to boolean
 * ```
 *
 * @template T - The function type.
 * @template Fixed - The fixed arguments type (appended).
 * @param fn - The function to partially apply arguments to.
 * @param fixedArgs - The arguments to append (in declaration order).
 * @returns The new partially applied function.
 */
export const partialRight = <
  T extends AnyFunction,
  Fixed extends readonly [unknown, ...unknown[]], // 至少一个参数
>(
  fn: AtLeastOneParams<T>,
  ...fixedArgs: ValidFixedForRight<Parameters<T>, Fixed>
): ((
  this: ThisParameterType<T>,
  ...rest: ExtractRest<Parameters<T>, Fixed>
) => ReturnType<T>) => {
  return function (
    this: ThisParameterType<T>,
    ...restArgs: ExtractRest<Parameters<T>, Fixed>
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return fn.apply(this, [...restArgs, ...fixedArgs]);
  };
};
