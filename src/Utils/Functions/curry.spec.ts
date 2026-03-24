// ========================================
// ./src/Utils/Functions/curry.spec.ts
// ========================================

import {describe, it, expect, vi} from 'vitest';
import {curry, __} from './curry';

// --- 测试用的辅助函数 ---
const add = (a: number, b: number, c: number) => a + b + c;
const formatMessage = (
  prefix: string,
  message: string,
  suffix: string,
  count: number,
) => `${prefix}: ${message} ${suffix} (${count})`;
const asyncAdd = async (a: number, b: number) => Promise.resolve(a + b);
const identity = (x: number) => x;
const fiveArgs = (a: number, b: number, c: number, d: number, e: number) =>
  a + b + c + d + e;

// 带有默认/可选参数的函数 (length参数是关键)
function withDefaults(a: number, b: number = 10, c: number = 20) {
  return a + b + c;
}

describe.concurrent('Curry Function (Runtime)', () => {
  // ========================================
  // 1. 初始校验与异常 (Initial Validation)
  // ========================================
  it('should throw error for invalid length (non-positive integer)', () => {
    expect(() => curry(add, 0)).toThrow(
      'Invalid length: Expected a positive integer, but received 0.',
    );
    expect(() => curry(add, -1)).toThrow(
      'Invalid length: Expected a positive integer, but received -1.',
    );
    expect(() => curry(add, 3.5)).toThrow(
      'Invalid length: Expected a positive integer, but received 3.5.',
    );
    expect(() => curry(add, NaN)).toThrow(
      'Invalid length: Expected a positive integer, but received NaN.',
    );
  });

  it('should handle length 1 function (identity)', () => {
    const curriedIdentity = curry(identity, 1);
    expect(curriedIdentity(5)).toBe(5);
    expect(curriedIdentity(10)).toBe(10);
  });

  // ========================================
  // 2. 基本柯里化调用 (Basic Execution)
  // ========================================

  it('should execute when all arguments are provided in the first call', () => {
    const curriedAdd = curry(add, 3);
    expect(curriedAdd(1, 2, 3)).toBe(6);
  });

  it('should execute after full step-by-step calls', () => {
    const curriedAdd = curry(add, 3);
    expect(curriedAdd(1)(2)(3)).toBe(6);
  });

  it('should execute with mixed step calls (partial application)', () => {
    const curriedAdd = curry(add, 3);
    expect(curriedAdd(1, 2)(3)).toBe(6);
    expect(curriedAdd(1)(2, 3)).toBe(6);
  });

  // ========================================
  // 3. 占位符替换逻辑 (Placeholder Logic: __)
  // ========================================

  const curriedAdd = curry(add, 3);

  it('should replace placeholder in the second call (prefix __)', () => {
    // 调用链: (__, 2, 3)(1) -> (1, 2, 3)
    expect(curriedAdd(__, 2, 3)(1)).toBe(6);
  });

  it('should replace placeholder in the middle', () => {
    // 调用链: (1, __)(2) -> (1, 2, __) -> (1, 2)(3) -> (1, 2, 3)
    expect(curriedAdd(1, __)(2)(3)).toBe(6);
  });

  it('should handle multiple placeholders across multiple calls', () => {
    // 调用链: (__, __, 3) -> (1, __, 3) -> (1, 2, 3)
    expect(curriedAdd(__, __, 3)(1)(2)).toBe(6);
  });

  it('should use new arguments to replace old placeholders first', () => {
    // prev_args: [1, __, 3]
    // next_args: [2]
    // 替换后: [1, 2, 3] -> 6
    expect(curriedAdd(1, __, 3)(2)).toBe(6);
  });

  it('should use new arguments to fill placeholders and then append', () => {
    // prev_args: [__, __]
    // next_args: [1, 2, 3]
    // 替换后: [1, 2, 3] -> 6
    expect(curriedAdd(__, __)(1, 2, 3)).toBe(6);
  });

  // ========================================
  // 4. 复杂函数与长度 (Complex Functions & Length)
  // ========================================

  it('should handle function with 5 arguments', () => {
    const curriedFive = curry(fiveArgs, 5);
    expect(curriedFive(1)(2)(3)(4)(5)).toBe(15);
    expect(curriedFive(1, 2, 3, 4, 5)).toBe(15);
    expect(curriedFive(1, 2)(3, 4)(5)).toBe(15);

    // 占位符测试
    // (__, 2, __, 4, __)(1, 3, 5) -> (1, 2, 3, 4, 5)
    expect(curriedFive(__, 2, __, 4, __)(1, 3, 5)).toBe(15);
  });

  it('should call base function once length is met (formatMessage)', () => {
    const curriedFormat = curry(formatMessage, 4);

    // 1. 分步调用
    const partialFormat = curriedFormat('Hello')('World'); // 仍返回函数
    expect(typeof partialFormat).toBe('function');

    // 2. 完成调用
    const result = partialFormat('!', 1);
    expect(result).toBe('Hello: World ! (1)');

    // 3. 占位符
    const withCount = curriedFormat(__, __, 'times', 5);
    expect(withCount('Error', 'occurred')).toBe('Error: occurred times (5)');
  });

  // ========================================
  // 5. 特殊函数类型 (Special Function Types)
  // ========================================

  it('should handle async function and return Promise', async () => {
    const curriedAsyncAdd = curry(asyncAdd, 2);

    // 正常调用
    const result1 = curriedAsyncAdd(1, 2);
    expect(result1).toBeInstanceOf(Promise);
    await expect(result1).resolves.toBe(3);

    // 柯里化调用
    const result2 = curriedAsyncAdd(1)(2);
    expect(result2).toBeInstanceOf(Promise);
    await expect(result2).resolves.toBe(3);
  });

  it('should handle functions with default/optional params based on length', () => {
    // kRequiredLength = 1
    const curriedWithLength = curry(withDefaults, 1);

    // 调用 (1) -> 满足 length=1，执行 withDefaults(1, undefined, undefined)
    // 实际执行 (1, 10, 20) -> 31
    expect(curriedWithLength(1)).toBe(31);

    // kRequiredLength = 3
    const curriedDefaults3 = curry(withDefaults, 3);

    // 调用 (1, 2, 3) -> 满足 length=3，执行 withDefaults(1, 2, 3) -> 6
    expect(curriedDefaults3(1, 2, 3)).toBe(6);

    // 调用 (1)(2) -> 返回函数
    expect(typeof curriedDefaults3(1)(2)).toBe('function');

    // 调用 (1)(2)(3) -> 6
    expect(curriedDefaults3(1)(2)(3)).toBe(6);

    // 调用 (1, __, 3)(2) -> 6
    expect(curriedDefaults3(1, __, 3)(2)).toBe(6);
  });

  // ========================================
  // 6. 边缘情况 (Edge Cases)
  // ========================================

  it('should not call the original function when insufficient arguments are provided', () => {
    const spyFn = vi.fn(add);
    const curriedSpy = curry(spyFn, 3);

    // 1. 初始调用不足
    const partial1 = curriedSpy(1, 2);
    expect(typeof partial1).toBe('function');
    expect(spyFn).not.toHaveBeenCalled();

    // 2. 占位符调用不足 ( provided_args.length = 2 )
    const partial2 = curriedSpy(__, 2)(1);
    expect(typeof partial2).toBe('function');
    expect(spyFn).not.toHaveBeenCalled();

    // 3. 最终调用
    partial1(3);
    expect(spyFn).toHaveBeenCalledTimes(1);
    expect(spyFn).toHaveBeenCalledWith(1, 2, 3);
  });
});

// ========================================
// 7. 可变参数函数 (Rest Parameters / Variadic Functions)
// ========================================

describe.concurrent('Rest parameters (variadic functions)', () => {
  // 可变参数求和函数
  const sumAll = (...nums: number[]) => nums.reduce((acc, n) => acc + n, 0);

  // 可变参数拼接字符串
  const joinStrings = (separator: string, ...parts: string[]) =>
    parts.join(separator);

  // 可变参数取最大值
  const maxOf = (...nums: number[]) => Math.max(...nums);

  // 带固定参数和可变参数的函数
  const formatNumbers = (prefix: string, ...nums: number[]) =>
    `${prefix}: [${nums.join(', ')}]`;

  it('should handle rest parameters function with length=0 (throws error)', () => {
    expect(() => curry(sumAll, 0)).toThrow(
      'Invalid length: Expected a positive integer, but received 0.',
    );
  });

  it('should handle rest parameters with length=1', () => {
    const curriedSum = curry(sumAll, 1);
    expect(curriedSum(5)).toBe(5);
    expect(curriedSum(10)).toBe(10);
  });

  it('should handle rest parameters with length=3', () => {
    const curriedSum = curry(sumAll, 3);

    // 一次性提供所有参数
    expect(curriedSum(1, 2, 3)).toBe(6);

    // 分步调用
    expect(curriedSum(1)(2)(3)).toBe(6);
    expect(curriedSum(1, 2)(3)).toBe(6);
    expect(curriedSum(1)(2, 3)).toBe(6);
  });

  it('should handle rest parameters with length=5', () => {
    const curriedSum = curry(sumAll, 5);

    expect(curriedSum(1, 2, 3, 4, 5)).toBe(15);
    expect(curriedSum(1)(2)(3)(4)(5)).toBe(15);
    expect(curriedSum(1, 2, 3)(4, 5)).toBe(15);
  });

  it('should handle fixed + rest parameters', () => {
    const curriedJoin = curry(joinStrings, 3);

    // (separator, part1, part2)
    expect(curriedJoin('-', 'a', 'b')).toBe('a-b');
    expect(curriedJoin('-')('a')('b')).toBe('a-b');
    expect(curriedJoin('-', 'a')('b')).toBe('a-b');
  });

  it('should handle fixed + rest with length=4', () => {
    const curriedJoin = curry(joinStrings, 4);

    // (separator, part1, part2, part3)
    expect(curriedJoin('-', 'a', 'b', 'c')).toBe('a-b-c');
    expect(curriedJoin('-')('a')('b')('c')).toBe('a-b-c');
  });

  it('should handle rest parameters with placeholders', () => {
    const curriedSum = curry(sumAll, 3);

    // (__, 2, 3)(1) -> (1, 2, 3) -> 6
    expect(curriedSum(__, 2, 3)(1)).toBe(6);

    // (1, __)(2)(3) -> (1, 2, 3) -> 6
    expect(curriedSum(1, __)(2)(3)).toBe(6);

    // (__, __, 3)(1)(2) -> (1, 2, 3) -> 6
    expect(curriedSum(__, __, 3)(1)(2)).toBe(6);
  });

  it('should handle fixed + rest with placeholders', () => {
    const curriedFormat = curry(formatNumbers, 3);

    // (prefix, num1, num2)
    expect(curriedFormat('Sum', 1, 2)).toBe('Sum: [1, 2]');

    // 占位符测试
    expect(curriedFormat(__, 1, 2)('Sum')).toBe('Sum: [1, 2]');
    expect(curriedFormat('Sum', __, 2)(1)).toBe('Sum: [1, 2]');
    expect(curriedFormat(__, __, 2)('Sum', 1)).toBe('Sum: [1, 2]');
  });

  it('should handle Math.max style function', () => {
    const curriedMax = curry(maxOf, 4);

    expect(curriedMax(1, 2, 3, 4)).toBe(4);
    expect(curriedMax(4, 3, 2, 1)).toBe(4);
    expect(curriedMax(1)(5)(3)(2)).toBe(5);

    // 占位符
    expect(curriedMax(__, 5, __, 2)(1, 3)).toBe(5);
  });

  it('should not execute until length is met for rest params', () => {
    const spyFn = vi.fn(sumAll);
    const curriedSum = curry(spyFn, 3);

    // 提供不足参数
    const partial = curriedSum(1, 2);
    expect(typeof partial).toBe('function');
    expect(spyFn).not.toHaveBeenCalled();

    // 提供足够参数
    partial(3);
    expect(spyFn).toHaveBeenCalledTimes(1);
    expect(spyFn).toHaveBeenCalledWith(1, 2, 3);
  });

  it('should slice arguments to length for rest params', () => {
    // 当提供的参数超过 length 时，应该只取前 length 个
    const curriedSum = curry(sumAll, 3);

    // 提供超过 3 个参数，应该只取前 3 个
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call
    expect((curriedSum as any)(1, 2, 3, 4, 5)).toBe(6); // 只用 1+2+3
  });

  it('should handle empty array result for rest params', () => {
    // 创建一个返回数组的可变参数函数
    const collect = (...items: number[]) => items;
    const curriedCollect = curry(collect, 1);

    expect(curriedCollect(42)).toEqual([42]);
  });

  it('should handle rest params with object arguments', () => {
    type Item = {id: number; name: string};
    const collectItems = (...items: Item[]) => items;

    const curriedCollect = curry(collectItems, 2);

    const item1 = {id: 1, name: 'a'};
    const item2 = {id: 2, name: 'b'};

    expect(curriedCollect(item1, item2)).toEqual([item1, item2]);
    expect(curriedCollect(item1)(item2)).toEqual([item1, item2]);
  });
});

describe.concurrent('Placeholder edge cases', () => {
  it('should handle when both args and next_args have placeholders at same position', () => {
    const curriedAdd = curry(add, 3);

    // 测试场景：args=[__, 2], next_args=[__, 3]
    const step1 = curriedAdd(__, 2); // args: [__, 2], h=1
    const step2 = step1(__, 3); // 测试 else if 分支
    expect(step2(1)).toBe(6); // 应该替换第一个占位符，然后追加 3

    // 另一种测试
    const result = curriedAdd(__, __)(__, 1)(2, 3);
    expect(result).toBe(6);
  });

  it('should handle consecutive placeholders in multiple calls', () => {
    const curriedAdd = curry(add, 3);

    // 第一次调用：两个占位符
    const step1 = curriedAdd(__, __);
    // 第二次调用：两个占位符（触发 else if 分支）
    const step2 = step1(__, __);
    // 第三次调用：三个实参
    const result = step2(1, 2, 3);
    expect(result).toBe(6);
  });

  it('should handle mixed placeholders and real args', () => {
    const curriedAdd = curry(add, 3);

    // 测试：占位符在多个位置
    const result = curriedAdd(__, 2, __)(1, 3);
    expect(result).toBe(6);

    // 测试：先有实参后有占位符
    const result2 = curriedAdd(1, __, __)(2, 3);
    expect(result2).toBe(6);
  });
});
