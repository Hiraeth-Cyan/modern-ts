// ========================================
// ./src/Utils/Functions/partial.spec.ts
// ========================================
import {describe, it, expect, vi} from 'vitest';
import {identity} from './base';
import {partial, partialRight} from './partial';

// ============================
// partial 函数测试
// ============================
describe.concurrent('partial function', () => {
  it('should prepend fixed arguments to function calls', () => {
    // 创建一个接受三个参数的函数
    const greet = vi.fn(
      (greeting: string, name: string, punctuation: string) =>
        `${greeting}, ${name}${punctuation}`,
    );

    // 固定前两个参数
    const partialGreet = partial(greet, 'Hello', 'Alice');

    // 只需要提供剩余的参数
    const result = partialGreet('!');

    expect(result).toBe('Hello, Alice!');
    expect(greet).toHaveBeenCalledWith('Hello', 'Alice', '!');
  });

  it('should work with multiple remaining arguments', () => {
    const joinValues = vi.fn(
      (prefix: string, a: number, b: number, c: number) =>
        `${prefix}: ${a}, ${b}, ${c}`,
    );

    const partialJoin = partial(joinValues, 'Numbers');
    const result = partialJoin(1, 2, 3);

    expect(result).toBe('Numbers: 1, 2, 3');
  });

  it('should handle empty fixed arguments', () => {
    // 测试不固定任何参数的情况
    const identityPartial = partial(identity, 'test');
    const result = identityPartial();

    expect(result).toBe('test');
  });
});

// ============================
// partialRight 函数测试
// ============================
describe.concurrent('partialRight function', () => {
  it('should append fixed arguments to function calls', () => {
    // 创建一个接受三个参数的函数
    const formatMessage = vi.fn(
      (name: string, action: string, target: string) =>
        `${name} ${action} ${target}`,
    );

    // 固定后两个参数
    const partialRightFormat = partialRight(
      formatMessage,
      'ran to',
      'the store',
    );

    // 只需要提供第一个参数
    const result = partialRightFormat('Alice');

    expect(result).toBe('Alice ran to the store');
    expect(formatMessage).toHaveBeenCalledWith('Alice', 'ran to', 'the store');
  });

  it('should work with multiple initial arguments', () => {
    const calculate = vi.fn(
      (a: number, b: number, c: number, d: number) => a + b + c + d,
    );

    const partialRightCalc = partialRight(calculate, 3, 4);
    const result = partialRightCalc(1, 2);

    expect(result).toBe(10); // 1 + 2 + 3 + 4
  });
});
