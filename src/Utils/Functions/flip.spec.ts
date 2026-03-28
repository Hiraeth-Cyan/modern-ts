// ========================================
// ./src/Utils/Functions/flip.spec.ts
// ========================================
import {describe, it, expect} from 'vitest';
import {flip, reverseArgs} from './flip';

describe.concurrent('flip function', () => {
  it('should swap the first two arguments of a binary function', () => {
    const subtract = (a: number, b: number) => a - b;
    const flipped = flip(subtract);

    expect(flipped(5, 3)).toBe(-2);
    expect(flipped(3, 5)).toBe(2);
  });

  it('should swap the first two arguments and keep the rest unchanged for ternary function', () => {
    const format = (a: string, b: number, c: boolean) => `${a}-${b}-${c}`;
    const flipped = flip(format);

    expect(flipped(42, 'hello', true)).toBe('hello-42-true');
    expect(flipped(100, 'world', false)).toBe('world-100-false');
  });

  it('should work with quaternary function', () => {
    const quaternary = (a: string, b: number, c: boolean, d: bigint) =>
      `${a}-${b}-${c}-${d}`;
    const flipped = flip(quaternary);

    expect(flipped(42, 'hello', true, 100n)).toBe('hello-42-true-100');
  });

  it('should preserve this context', () => {
    const obj = {
      multiplier: 10,
      multiply(this: {multiplier: number}, a: number, b: number) {
        return (a + b) * this.multiplier;
      },
    };

    const flipped = flip(obj.multiply.bind(obj));
    expect(flipped.call(obj, 5, 3)).toBe(80);
  });

  it('should work with functions returning objects', () => {
    const pair = <T, U>(a: T, b: U): [T, U] => [a, b];
    const flipped = flip(pair);

    // flip 交换前两个参数，所以 flipped(2, 1) 相当于 pair(1, 2)
    expect(flipped(2, 1)).toEqual([1, 2]);
    expect(flipped('b', 'a')).toEqual(['a', 'b']);
  });

  it('should work with async functions', async () => {
    const asyncAdd = (a: number, b: number) => Promise.resolve(a + b);
    const flipped = flip(asyncAdd);

    await expect(flipped(5, 3)).resolves.toBe(8);
  });

  it('should work with functions that have default parameters', () => {
    const withDefault = (a: number, b: string = 'default') => `${a}-${b}`;
    const flipped = flip(withDefault);

    expect(flipped('hello', 42)).toBe('42-hello');
    // 传入 undefined 时默认参数生效
    expect(flipped(undefined, 42)).toBe('42-default');
  });
  it('should work with optional parameters', () => {
    const withOptional = (a?: number, b?: string) =>
      `${a ?? 'num-undefined'}-${b ?? 'str-undefined'}`;
    const flipped = flip(withOptional);

    // flipped('hello', 42) 相当于 withOptional(42, 'hello')
    expect(flipped('hello', 42)).toBe('42-hello');

    // flipped(undefined, 42) 相当于 withOptional(42, undefined)
    expect(flipped(undefined, 42)).toBe('42-str-undefined');

    // 不传参时，两个参数都是 undefined
    expect(flipped()).toBe('num-undefined-str-undefined');
  });
});

describe.concurrent('reverseArgs function', () => {
  it('should reverse arguments of a binary function', () => {
    const subtract = (a: number, b: number) => a - b;
    const reversed = reverseArgs(subtract);

    expect(reversed(5, 3)).toBe(-2);
    expect(reversed(3, 5)).toBe(2);
  });

  it('should reverse all arguments of a ternary function', () => {
    const format = (a: string, b: number, c: boolean) => `${a}-${b}-${c}`;
    const reversed = reverseArgs(format);

    expect(reversed(true, 42, 'hello')).toBe('hello-42-true');
    expect(reversed(false, 100, 'world')).toBe('world-100-false');
  });

  it('should reverse all arguments of a quaternary function', () => {
    const quaternary = (a: string, b: number, c: boolean, d: bigint) =>
      `${a}-${b}-${c}-${d}`;
    const reversed = reverseArgs(quaternary);

    expect(reversed(100n, true, 42, 'hello')).toBe('hello-42-true-100');
  });

  it('should preserve this context', () => {
    const obj = {
      multiplier: 10,
      multiply(this: {multiplier: number}, a: number, b: number) {
        return (a + b) * this.multiplier;
      },
    };

    const reversed = reverseArgs(obj.multiply.bind(obj));
    expect(reversed.call(obj, 5, 3)).toBe(80);
  });

  it('should work with functions returning objects', () => {
    const triple = <T, U, V>(a: T, b: U, c: V): [T, U, V] => [a, b, c];
    const reversed = reverseArgs(triple);

    expect(reversed(3, 2, 1)).toEqual([1, 2, 3]);
    expect(reversed('c', 'b', 'a')).toEqual(['a', 'b', 'c']);
  });

  it('should work with async functions', async () => {
    const asyncAdd = (a: number, b: number, c: number) =>
      Promise.resolve(a + b + c);
    const reversed = reverseArgs(asyncAdd);

    await expect(reversed(3, 2, 1)).resolves.toBe(6);
  });
});

describe.concurrent(
  'flip and reverseArgs equivalence for binary functions',
  () => {
    it('should produce same result for binary functions', () => {
      const fn = (a: number, b: string) => `${a}-${b}`;
      const flipped = flip(fn);
      const reversed = reverseArgs(fn);

      expect(flipped('hello', 42)).toBe(reversed('hello', 42));
      expect(flipped('world', 100)).toBe(reversed('world', 100));
    });
  },
);

describe.concurrent('double application', () => {
  it('should restore original order with double flip', () => {
    const fn = (a: number, b: string, c: boolean) => `${a}-${b}-${c}`;
    const doubleFlipped = flip(flip(fn));

    expect(doubleFlipped(1, 'hello', true)).toBe('1-hello-true');
  });

  it('should restore original order with double reverseArgs', () => {
    const fn = (a: number, b: string, c: boolean) => `${a}-${b}-${c}`;
    const doubleReversed = reverseArgs(reverseArgs(fn));

    expect(doubleReversed(1, 'hello', true)).toBe('1-hello-true');
  });
});
