// ========================================
// ./src/Utils/Functions/pipe.ts
// ========================================
/* eslint-disable @typescript-eslint/no-explicit-any */

import {isPromiseLike} from '../../helper';
import {identity, type IdentityFn} from './base';

/**
 * Represents a value that can either be of type `Out` or `Promise<Out>`, depending on the `IsAsync` flag.
 * @template Out - The resolved output type
 * @template IsAsync - Boolean flag indicating if the function is asynchronous
 */
type MaybePromise<Out, IsAsync extends boolean> = IsAsync extends true
  ? Out | Promise<Out>
  : Out;

/**
 * The base type for the *first* function in a pipe, which can take multiple arguments.
 * @template In - The input arguments tuple type
 * @template Out - The resolved output type
 * @template IsAsync - Boolean flag indicating if the function is asynchronous
 */
type BaseFn<In extends readonly unknown[], Out, IsAsync extends boolean> = (
  ...args: In
) => MaybePromise<Out, IsAsync>;

/**
 * The base type for *subsequent* functions in a pipe, which must take exactly one input argument.
 * @template In - The single input argument type (which is the output of the previous function)
 * @template Out - The resolved output type
 * @template IsAsync - Boolean flag indicating if the function is asynchronous
 */
type BaseNextFn<In, Out, IsAsync extends boolean> = (
  input: In,
) => MaybePromise<Out, IsAsync>;

// ============================================
// 类型错误提示
// ============================================

/**
 * A type that forces a TypeScript error when a pipe function's input type
 * (Actual) does not match the previous function's output type (Expected). (Sync version)
 * @template Expected - The expected input type
 * @template Actual - The actual input type received (from the previous function's output)
 */
export type PipeError<Expected, Actual> = {
  __error: never;
  expected: Expected;
  actual: Actual;
};

/**
 * A type that forces a TypeScript error when the initial input of `run`
 * (Actual) does not match the input type of the first function (Expected). (Sync version)
 * @template Expected - The expected input type of the first function
 * @template Actual - The actual input type provided to `run`
 */
type RunInputError<Expected, Actual> = (
  __error: never,
  expected: Expected,
  actual: Actual,
) => Actual;

// ============================================
// 核心校验
// ============================================

/**
 * Validates if the initial input type (T) matches the input type of the first function (F1).
 * @template T - The actual input type provided to `run`/`runAsync`
 * @template F1 - The type of the first function in the pipe
 * @template IsAsync - Boolean flag for async validation mode
 */
type VInput<T, F1, IsAsync extends boolean> =
  F1 extends BaseNextFn<infer ExpectedIn, unknown, IsAsync> // [L1]：约束 第一个函数必须满足 BaseNextFn（单参数）
    ? T extends ExpectedIn // [L2]：类型T必须能够兼容ExpectedIn（run的第一个参数T，能否兼容第一个函数F1）
      ? T
      : RunInputError<ExpectedIn, T>
    : RunInputError<unknown[], T>;

/**
 * Recursively validates the function chain to ensure the output of the preceding function
 * is compatible with the input of the succeeding function. Uses Tail Recursion Optimization (TRO) pattern.
 * @template Fns - The remaining functions to validate
 * @template IsAsync - Boolean flag for async validation mode
 * @template Acc - Accumulator holding the validated functions so far (used for TRO)
 */
type VFuncsIterative<
  Fns extends readonly unknown[],
  IsAsync extends boolean,
  Acc extends readonly unknown[] = [], // 累加器
> = Fns extends readonly [infer F, ...infer R] // [L1]：解构成功，还有函数待处理
  ? F extends
      | BaseFn<infer _I, infer O, IsAsync>
      | BaseNextFn<unknown, infer O, IsAsync>
    ? // [L2]：F 是合法函数。检查下一个函数 S。
      R extends readonly [infer S, ...infer Oth] // [L3]：S 存在
      ? S extends BaseNextFn<
          IsAsync extends true ? Awaited<O> : O,
          unknown,
          IsAsync
        >
        ? // [L4]：S 匹配 F 的输出。-> 尾递归调用（成功）
          VFuncsIterative<
            R, // R 是 [S, ...Oth]
            IsAsync,
            [...Acc, F] // TRO：将 F 放入累加器！
          >
        : // [L4]：S 匹配 F 的输出失败。-> 返回错误元组（结束）
          [
            ...Acc,
            F,
            PipeError<IsAsync extends true ? Awaited<O> : O, S>,
            ...(Oth extends readonly unknown[] ? Oth : []),
          ]
      : // [L3]：R 为空元组 []。-> 递归结束（成功）
        [...Acc, F] // 最后的 F 也加入 Acc 中
    : // [L2]：F 不是合法函数。-> 返回错误元组（结束）
      [
        ...Acc,
        PipeError<unknown[], F>,
        ...(R extends readonly unknown[] ? R : []),
      ]
  : Fns extends [] // [L1]：Fns 为空元组 []。-> 递归结束（初始 Fns 为空，或已跑完）
    ? Acc
    : Fns; // [L1]：Fns 无法解构或不匹配，原样返回

// ============================================
// 最终类型提取
// ============================================

/**
 * Extracts the final resolved output type from the function chain.
 * @template Fns - The function chain
 * @template IsAsync - Boolean flag for async mode
 */

type FinalOut<
  Fns extends readonly unknown[],
  IsAsync extends boolean,
> = Fns extends [
  ...unknown[],
  (
    // 若在此处将any换成unknown将导致返回值推断为never
    BaseFn<any[], infer O, IsAsync> | BaseNextFn<unknown, infer O, IsAsync>
  ),
]
  ? IsAsync extends true
    ? Awaited<O>
    : O
  : never;

/**
 * Extracts the full signature of the resulting curried pipe function.
 * @template Fns - The validated function chain
 * @template IsAsync - Boolean flag for async mode
 */
type BasePipeR<
  Fns extends readonly unknown[],
  IsAsync extends boolean,
> = Fns extends [BaseFn<infer I, unknown, IsAsync>, ...unknown[]]
  ? (...args: I) => IsAsync extends true
      ? Promise<FinalOut<Fns, IsAsync>> // 强制要求异步管道返回 Promise
      : FinalOut<Fns, IsAsync>
  : never;

// ============================================
// 同步/异步别名导出
// ============================================

// -- 同步别名 --

/**
 * Alias for a synchronous, multi-argument function (first function in sync pipe).
 * @template In - The input arguments tuple type
 * @template Out - The output type
 */
type Fn<In extends unknown[], Out> = BaseFn<In, Out, false>;

/**
 * Alias for a synchronous, single-argument function (subsequent functions in sync pipe).
 * @template In - The single input argument type
 * @template Out - The output type
 */
type NextFn<In, Out> = BaseNextFn<In, Out, false>;

/**
 * Type validation for a synchronous function chain.
 * @template Fns - The function chain to validate
 */
type VFuncs<Fns extends readonly unknown[]> = VFuncsIterative<Fns, false>;

/**
 * Extracts the final synchronous output type.
 * @template Fns - The function chain
 */
type Out<Fns extends readonly unknown[]> = FinalOut<Fns, false>;

/**
 * Extracts the final synchronous pipe function signature.
 * @template Fns - The function chain
 */
type PipeR<Fns extends readonly unknown[]> = BasePipeR<Fns, false>;

// -- 异步别名 --

/**
 * Alias for an asynchronous, multi-argument function (first function in async pipe).
 * @template In - The input arguments tuple type
 * @template Out - The output type
 */
type AsyncFn<In extends unknown[], Out> = BaseFn<In, Out, true>;

/**
 * Alias for an asynchronous, single-argument function (subsequent functions in async pipe).
 * @template In - The single input argument type
 * @template Out - The output type
 */
type AsyncNextFn<In, Out> = BaseNextFn<In, Out, true>;

/**
 * Type validation for an asynchronous function chain.
 * @template Fns - The function chain to validate
 */
type AsyncVFuncs<Fns extends readonly unknown[]> = VFuncsIterative<Fns, true>;

/**
 * Extracts the final asynchronous output type.
 * @template Fns - The function chain
 */
type AsyncOut<Fns extends readonly unknown[]> = FinalOut<Fns, true>;

/**
 * Extracts the final asynchronous pipe function signature.
 * @template Fns - The function chain
 */
type AsyncPipeR<Fns extends readonly unknown[]> = BasePipeR<Fns, true>;

// ============================================
// 运行时实现
// ============================================

/**
 * Core logic for executing the synchronous pipeline.
 * @param initial_value - The initial input value for the pipeline.
 * @param fns - The sequence of functions to execute (must be of type NextFn<unknown, unknown>).
 * @returns The final synchronous result of the pipeline.
 */
function execute_pipeline(
  initial_value: unknown,
  fns: readonly NextFn<unknown, unknown>[],
): unknown {
  let result: unknown = initial_value;
  for (const fn of fns) {
    result = fn(result);
  }
  return result;
}
/**
 * Core asynchronous pipeline execution logic (handling Promise switching).
 * @param initial_value - The initial input value of the pipeline.
 * @param fns - The list of functions to be executed (must be of type AsyncNextFn<unknown, unknown>).
 * @returns The final result of the pipeline (which may be a synchronous value or a Promise).
 */
function execute_async_pipeline(
  initial_value: unknown,
  fns: readonly AsyncNextFn<unknown, unknown>[],
): MaybePromise<unknown, true> {
  let result: unknown = initial_value;

  // 尝试同步循环并检查异步切换点
  for (let i = 0; i < fns.length; i++) {
    result = fns[i](result);

    if (isPromiseLike(result)) {
      // 发现 Promise，立即切换到异步接管模式！
      return (async () => {
        let async_result = await result; // 等待当前的 Promise

        // 接管并执行后续函数
        for (let j = i + 1; j < fns.length; j++) {
          async_result = fns[j](async_result);
          if (isPromiseLike(async_result)) {
            async_result = await async_result; // 遇到新的 Promise 继续等待
          }
        }
        return async_result;
      })();
    }
  }

  // 全同步时，直接返回同步值
  return result;
}

/**
 * Executes a synchronous function chain with an initial input.
 * All intermediate function results are passed synchronously.
 * @template T - The type of the initial input
 * @template Fns - The tuple of functions in the pipe (validated)
 * @template F1 - The type of the first function
 * @param input - The initial value to start the pipe with
 * @param fns - The sequence of functions to execute
 * @returns The final synchronous result
 */
export function run<
  T,
  Fns extends readonly [NextFn<any, any>, ...NextFn<any, any>[]],
  F1 extends Fns[0], // 提取第一个函数类型
>(
  input: VInput<T, F1, false>, // 在 input 参数上强制校验 T 是否匹配 F1 的输入类型
  ...fns: VFuncs<Fns> // VFuncs 负责链式校验
): Out<Fns> {
  return execute_pipeline(input, fns as NextFn<unknown, unknown>[]) as Out<Fns>;
}

/**
 * Creates a synchronous, multi-argument function that executes a sequence of functions from left-to-right.
 * The output of each function (except the first) is passed as the input to the next.
 * @returns Returns an identity function if no functions are provided
 */
export function pipe(): IdentityFn;

/**
 * Creates a synchronous, multi-argument function that executes a sequence of functions from left-to-right.
 * The output of each function (except the first) is passed as the input to the next.
 * @template Fns - The tuple of functions in the pipe (validated)
 * @param fns - The sequence of functions to compose
 * @returns The composed synchronous function
 */
export function pipe<
  Fns extends readonly [Fn<any, any>, ...NextFn<any, any>[]],
>(...fns: VFuncs<Fns>): PipeR<Fns>;

export function pipe(...fns: unknown[]): unknown {
  if (fns.length === 0) return identity; // 如果没有函数，返回恒等函数
  // 返回柯里化函数
  return (...args: unknown[]) => {
    // 1. 先执行第一个多参数函数
    const first_result = (fns[0] as Fn<unknown[], unknown>)(...args);

    // 2. 将结果和后续的单参数函数传入公共执行器
    const subsequent_fns = fns.slice(1) as NextFn<unknown, unknown>[];
    return execute_pipeline(first_result, subsequent_fns);
  };
}

/**
 * Executes a potentially asynchronous function chain with an initial input.
 * It will run synchronously until the first `Promise` is encountered, then switch to async execution.
 * @template T - The type of the initial input
 * @template Fns - The tuple of functions in the pipe (validated)
 * @template F1 - The type of the first function
 * @param input - The initial value to start the pipe with
 * @param fns - The sequence of async-compatible functions to execute
 * @returns The final result, which may be a Promise
 */
export function runAsync<
  T,
  Fns extends [AsyncNextFn<any, any>, ...AsyncNextFn<any, any>[]],
  F1 extends Fns[0],
>(
  input: VInput<T, F1, true>,
  ...fns: AsyncVFuncs<Fns>
): Promise<AsyncOut<Fns>> {
  return execute_async_pipeline(
    input,
    fns as AsyncNextFn<unknown, unknown>[],
  ) as Promise<AsyncOut<Fns>>;
}

/**
 * Creates a multi-argument function that executes a sequence of potentially asynchronous functions from left-to-right.
 * The resulting function returns a `Promise` if any function in the chain returns one.
 * @returns Returns an identity function if no functions are provided
 */
export function pipeAsync(): IdentityFn;

/**
 * Creates a multi-argument function that executes a sequence of potentially asynchronous functions from left-to-right.
 * The resulting function returns a `Promise` if any function in the chain returns one.
 * @template Fns - The tuple of async-compatible functions in the pipe (validated)
 * @param fns - The sequence of functions to compose
 * @returns The composed async-compatible function
 */
export function pipeAsync<
  Fns extends readonly [AsyncFn<any, any>, ...AsyncNextFn<any, any>[]],
>(...fns: AsyncVFuncs<Fns>): AsyncPipeR<Fns>;
export function pipeAsync(...fns: unknown[]): unknown {
  if (fns.length === 0) return identity;
  // 返回柯里化函数
  return (...args: unknown[]) => {
    // 1. 执行第一个多参数函数
    const result: unknown = (fns[0] as AsyncFn<unknown[], unknown>)(...args);

    const subsequent_fns = fns.slice(1) as AsyncNextFn<unknown, unknown>[];

    // 2. 检查第一个函数是否返回 Promise
    if (isPromiseLike(result)) {
      // 如果第一个函数就是异步的，切换到 Promise 链式执行
      return (async () => {
        const async_result = await result;
        return execute_async_pipeline(
          async_result,
          subsequent_fns,
        ) as BasePipeR<[AsyncFn<unknown[], unknown>], true>;
      })();
    }

    // 3. 如果第一个函数是同步的，则传入执行器，让执行器处理后续可能出现的异步
    return execute_async_pipeline(result, subsequent_fns) as BasePipeR<
      [AsyncFn<unknown[], unknown>],
      true
    >;
  };
}
