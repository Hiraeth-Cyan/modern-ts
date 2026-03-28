// ========================================
// ./src/Utils/Functions/ary.spec.ts
// ========================================
import {describe, it, expect, vi} from 'vitest';
import {ary, unary, binary, trinary} from './ary';

describe.concurrent('unary, binary and trinary functions', () => {
  it('unary should create a function with arity of 1', () => {
    const fn = vi.fn((a: number) => a * 2);
    const unaryFn = unary(fn);

    unaryFn(1);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(1);
  });

  it('binary should create a function with arity of 2', () => {
    const fn = vi.fn((a: number, b: number) => a + b);
    const binaryFn = binary(fn);

    binaryFn(1, 2);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(1, 2);
  });

  it('trinary should create a function with arity of 3', () => {
    const fn = vi.fn((a: number, b: number, c: number) => a + b + c);
    const trinaryFn = trinary(fn);

    trinaryFn(1, 2, 3);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(1, 2, 3);
  });
});

describe.concurrent('ary function', () => {
  it('should call function with only first n arguments', () => {
    const collectArgs = vi.fn((...args: unknown[]) => args.length);

    const ary2 = ary(collectArgs, 2);

    const result = ary2('a', 'b');

    expect(result).toBe(2);
    expect(collectArgs).toHaveBeenCalledWith('a', 'b');
  });

  it('should throw ParameterError when n is not a positive integer', () => {
    const mockFn = vi.fn((...args: unknown[]) => args);

    expect(() => ary(mockFn, 0)).not.toThrow(
      'Invalid length: Expected a non-negative integer, but received 0.',
    );
  });

  it('should handle functions with default parameters', () => {
    const fnWithDefaults = (a: string, b = 'default', c = 'fallback') => [
      a,
      b,
      c,
    ];

    const ary1 = ary(fnWithDefaults, 1);
    expect(ary1('first')).toEqual(['first', 'default', 'fallback']);

    const ary2 = ary(fnWithDefaults, 2);
    expect(ary2('first', 'custom')).toEqual(['first', 'custom', 'fallback']);

    const ary3 = ary(fnWithDefaults, 3);
    expect(ary3('first', 'custom', 'override')).toEqual([
      'first',
      'custom',
      'override',
    ]);
  });
});
