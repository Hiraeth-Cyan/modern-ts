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

  it('should replace placeholder with undefined when excess arguments are provided in first call', () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
    const curriedAdd = curry(add, 3) as any; // 使用 any 绕过类型检查

    // 类型系统不允许，但我们强制运行时执行
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const result = curriedAdd(1, 2, __, 4);
    // add(1, 2, undefined) => NaN
    expect(result).toBeNaN();
  });

  it('should replace placeholder with undefined when excess arguments are provided in subsequent call', () => {
    const curriedAdd = curry(add, 3);
    // 第一次调用，正常类型
    const partial = curriedAdd(1);
    // 第二次调用，使用 any 绕过类型检查
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const result = (partial as any)(2, __, 4);
    // add(1, 2, undefined) => NaN
    expect(result).toBeNaN();
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
