import {beforeEach, describe, it, expect, vi} from 'vitest';
import {ap, zip, all, mapAll, and, or} from './combine';
import {Ok, Err} from '../base';
import type {Result} from '../types';

// ============================
// 测试辅助函数
// ============================
const numberValue = 42;
const stringValue = 'test';

const increment = vi.fn((x: number) => x + 1);
const toUpperCase = vi.fn((s: string) => s.toUpperCase());

const error1 = new Error('error 1');
const error2 = new Error('error 2');
const stringError1 = 'string error 1';

describe.concurrent('Result Operators combine functions', () => {
  // 每个测试前清除所有 mock 调用记录，确保环境独立
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================
  // ap 函数测试
  // ============================
  describe('ap', () => {
    it.each([
      {
        desc: 'both Ok',
        fnResult: Ok(increment),
        valResult: Ok(numberValue),
        expected: Ok(43),
      },
      {
        desc: 'function is Err',
        fnResult: Err(error1),
        valResult: Ok(numberValue),
        expected: Err(error1),
      },
      {
        desc: 'value is Err, function is Ok',
        fnResult: Ok(increment),
        valResult: Err(error2),
        expected: Err(error2),
      },
      {
        desc: 'both Err',
        fnResult: Err(error1),
        valResult: Err(error2),
        expected: Err(error1),
      },
    ])('should handle $desc', ({fnResult, valResult, expected}) => {
      expect(ap(fnResult, valResult)).toEqual(expected);
    });

    it('should handle different value and error types', () => {
      const stringFn = Ok(toUpperCase);
      const stringVal = Ok('hello');
      const stringErr = Err('string error');

      expect(ap(stringFn, stringVal)).toEqual(Ok('HELLO'));
      expect(ap(stringFn, stringErr)).toEqual(Err('string error'));
    });

    it('should apply curried functions correctly', () => {
      const curriedAdd = (a: number) => (b: number) => a + b;
      const add5 = curriedAdd(5);
      expect(ap(Ok(add5), Ok(10))).toEqual(Ok(15));
    });
  });

  // ============================
  // zip 函数测试
  // ============================
  describe('zip', () => {
    it.each([
      {
        desc: 'both Ok',
        res1: Ok(numberValue),
        res2: Ok(stringValue),
        expected: Ok([numberValue, stringValue]),
      },
      {
        desc: 'first Err',
        res1: Err(error1),
        res2: Ok(stringValue),
        expected: Err(error1),
      },
      {
        desc: 'second Err',
        res1: Ok(numberValue),
        res2: Err(error2),
        expected: Err(error2),
      },
      {
        desc: 'both Err',
        res1: Err(error1),
        res2: Err(error2),
        expected: Err(error1),
      },
    ])('should return $desc', ({res1, res2, expected}) => {
      expect(zip(res1, res2)).toEqual(expected);
    });

    it('should handle different error types', () => {
      expect(zip(Ok(numberValue), Err(stringError1))).toEqual(
        Err(stringError1)
      );
    });

    it('should work with object values', () => {
      const obj1 = {id: 1};
      const obj2 = {name: 'test'};
      expect(zip(Ok(obj1), Ok(obj2))).toEqual(Ok([obj1, obj2]));
    });
  });

  // ============================
  // all 函数测试
  // ============================
  describe('all', () => {
    it('should return Ok array when all results are Ok', () => {
      const results = [Ok(1), Ok(2), Ok(3)];
      expect(all(results)).toEqual(Ok([1, 2, 3]));
    });

    it.each([
      {
        desc: 'single Err',
        results: [Ok(1), Err(error1), Ok(3)],
        expected: Err(error1),
      },
      {
        desc: 'multiple Err (first error returned)',
        results: [Err(error1), Ok(2), Err(error2)],
        expected: Err(error1),
      },
      {
        desc: 'all Err',
        results: [Err(error1), Err(error2), Err(error1)],
        expected: Err(error1),
      },
    ])('should return first error when $desc', ({results, expected}) => {
      expect(all(results)).toEqual(expected);
    });

    it('should handle empty array', () => {
      expect(all([])).toEqual(Ok([]));
    });

    it('should preserve order of values', () => {
      expect(all([Ok('a'), Ok('b'), Ok('c')])).toEqual(Ok(['a', 'b', 'c']));
    });

    it('should work with different value types', () => {
      const results: Result<string | number, Error>[] = [Ok('test'), Ok(42)];
      expect(all(results)).toEqual(Ok(['test', 42]));
    });
  });

  // ============================
  // mapAll 函数测试
  // ============================
  describe('mapAll', () => {
    const safeParseNumber = vi.fn((str: string, index: number) => {
      const num = parseInt(str, 10);
      return isNaN(num)
        ? Err(new Error(`Invalid number at index ${index}`))
        : Ok(num);
    });

    const alwaysOk = vi.fn((item: string) => Ok(item.toUpperCase()));

    it('should transform all items successfully', () => {
      const items = ['10', '20', '30'];
      const result = mapAll(items, safeParseNumber);

      expect(safeParseNumber).toHaveBeenCalledTimes(3);
      expect(safeParseNumber).toHaveBeenCalledWith('10', 0);
      expect(safeParseNumber).toHaveBeenCalledWith('20', 1);
      expect(safeParseNumber).toHaveBeenCalledWith('30', 2);
      expect(result).toEqual(Ok([10, 20, 30]));
    });

    it('should return first error when transformation fails', () => {
      const items = ['10', 'abc', '30'];
      const result = mapAll(items, safeParseNumber);

      expect(safeParseNumber).toHaveBeenCalledTimes(2); // 遇到错误停止
      expect(result).toEqual(Err(new Error('Invalid number at index 1')));
    });

    it('should handle empty array', () => {
      const items: string[] = [];
      const result = mapAll(items, alwaysOk);

      expect(alwaysOk).not.toHaveBeenCalled();
      expect(result).toEqual(Ok([]));
    });

    it('should propagate different error types', () => {
      const failingFn = vi.fn((item: string) =>
        item === 'fail' ? Err('string error') : Ok(item)
      );
      const items = ['ok', 'fail', 'ok'];
      const result = mapAll(items, failingFn);

      expect(result).toEqual(Err('string error'));
    });

    it('should pass correct index to transformation function', () => {
      const items = ['a', 'b', 'c'];
      const indexedFn = vi.fn((item: string, index: number) =>
        Ok(`${item}${index}`)
      );
      const result = mapAll(items, indexedFn);

      expect(indexedFn).toHaveBeenCalledWith('a', 0);
      expect(indexedFn).toHaveBeenCalledWith('b', 1);
      expect(indexedFn).toHaveBeenCalledWith('c', 2);
      expect(result).toEqual(Ok(['a0', 'b1', 'c2']));
    });
  });

  // ============================
  // and 函数测试
  // ============================
  describe('and', () => {
    it.each([
      {
        desc: 'Ok then Ok',
        first: Ok(numberValue),
        second: Ok(stringValue),
        expected: Ok(stringValue),
      },
      {
        desc: 'Ok then Err',
        first: Ok(numberValue),
        second: Err(error2),
        expected: Err(error2),
      },
      {
        desc: 'Err then Ok',
        first: Err(error1),
        second: Ok(stringValue),
        expected: Err(error1),
      },
      {
        desc: 'Err then Err',
        first: Err(error1),
        second: Err(error2),
        expected: Err(error1),
      },
    ])('should return $desc', ({first, second, expected}) => {
      expect(and(first, second)).toEqual(expected);
    });

    it('should handle different value types', () => {
      expect(and(Ok(42), Ok({name: 'test'}))).toEqual(Ok({name: 'test'}));
    });

    it('should return correct type when first is Err', () => {
      const result = and(Err(error1), Ok('string'));
      // 类型上应该是 Result<string, Error>，但实际值是 Err<Error>
      expect(result).toEqual(Err(error1));
    });
  });

  // ============================
  // or 函数测试
  // ============================
  describe('or', () => {
    it.each([
      {
        desc: 'Ok then Ok',
        first: Ok(numberValue),
        second: Ok(stringValue),
        expected: Ok(numberValue),
      },
      {
        desc: 'Ok then Err',
        first: Ok(numberValue),
        second: Err(error2),
        expected: Ok(numberValue),
      },
      {
        desc: 'Err then Ok',
        first: Err(error1),
        second: Ok(stringValue),
        expected: Ok(stringValue),
      },
      {
        desc: 'Err then Err',
        first: Err(error1),
        second: Err(error2),
        expected: Err(error2),
      },
    ])('should return $desc', ({first, second, expected}) => {
      expect(or(first, second)).toEqual(expected);
    });

    it('should handle different error types', () => {
      expect(or(Err(error1), Err('string error'))).toEqual(Err('string error'));
    });

    it('should change error type when second result has different error type', () => {
      const result = or(Err(error1), Ok(42));
      expect(result).toEqual(Ok(42));
    });
  });

  // ============================
  // 组合操作综合测试
  // ============================
  describe('combine operations integration', () => {
    it('should chain ap operations correctly', () => {
      const add = (a: number) => (b: number) => a + b;
      const result1 = Ok(10);
      const result2 = Ok(20);
      const addFn = Ok(add);

      // ap 应用函数两次： add(10)(20) = 30
      const add10 = ap(addFn, result1);
      const final = ap(add10, result2);
      expect(final).toEqual(Ok(30));
    });

    it('should combine zip and all for complex scenarios', () => {
      const results = [
        zip(Ok(1), Ok('a')),
        zip(Ok(2), Ok('b')),
        zip(Ok(3), Ok('c')),
      ];
      const combined = all(results);
      expect(combined).toEqual(
        Ok([
          [1, 'a'],
          [2, 'b'],
          [3, 'c'],
        ])
      );
    });

    it('should short-circuit correctly in complex chains', () => {
      const results = [
        zip(Ok(1), Ok('a')),
        zip(Err(error1), Ok('b')), // 此处产生错误，all 应短路
        zip(Ok(3), Ok('c')),
      ];
      const combined = all(results);
      expect(combined).toEqual(Err(error1));
    });
  });
});
