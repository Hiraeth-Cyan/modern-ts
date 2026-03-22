// ========================================
// ./src/Utils/Array/zip.spec.ts
// ========================================

import {describe, it, expect, vi} from 'vitest';
import {windowed, zip, zipObject, zipWith, unzip, unzipWith} from './zip';

// ============================
// 基本 zip 功能测试
// ============================
describe.concurrent('zip Function Tests', () => {
  it('should zip multiple arrays of equal length', () => {
    const arr1 = [1, 2, 3];
    const arr2 = ['a', 'b', 'c'];
    const arr3 = [true, false, true];

    const result = zip(arr1, arr2, arr3);

    expect(result).toEqual([
      [1, 'a', true],
      [2, 'b', false],
      [3, 'c', true],
    ]);
    expect(result).toHaveLength(3);
  });

  it('should handle arrays of different lengths by using the max length', () => {
    const arr1 = [1, 2];
    const arr2 = ['a', 'b', 'c', 'd'];

    const result = zip(arr1, arr2);

    expect(result).toEqual([
      [1, 'a'],
      [2, 'b'],
      [undefined, 'c'],
      [undefined, 'd'],
    ]);
  });

  it('should return empty array when no arrays provided', () => {
    const result = zip();
    expect(result).toEqual([]);
  });

  it('should handle single array', () => {
    const arr = [1, 2, 3];
    const result = zip(arr);

    expect(result).toEqual([[1], [2], [3]]);
  });

  it('should handle empty arrays', () => {
    const result = zip([], [], []);
    expect(result).toEqual([]);
  });

  it('should preserve types correctly with mixed arrays', () => {
    const numbers = [1, 2];
    const strings = ['a', 'b'];
    const booleans = [true, false];

    const result = zip(numbers, strings, booleans);

    // 验证类型推断
    const first = result[0];
    expect(first[0]).toBeTypeOf('number');
    expect(first[1]).toBeTypeOf('string');
    expect(first[2]).toBeTypeOf('boolean');
  });
});

// ============================
// zipObject 功能测试
// ============================
describe.concurrent('zipObject Function Tests', () => {
  it('should create object from keys and values arrays', () => {
    const keys = ['a', 'b', 'c'] as const;
    const values = [1, 2, 3];

    const result = zipObject(keys, values);

    expect(result).toEqual({
      a: 1,
      b: 2,
      c: 3,
    });
  });

  it('should handle arrays of different lengths by using min length', () => {
    const keys = ['a', 'b', 'c', 'd'];
    const values = [1, 2];

    const result = zipObject(keys, values);

    expect(result).toEqual({
      a: 1,
      b: 2,
    });
    expect(result).not.toHaveProperty('c');
    expect(result).not.toHaveProperty('d');
  });

  it('should handle number and symbol keys', () => {
    const keys = [1, 2, 3];
    const values = ['one', 'two', 'three'];

    const result = zipObject(keys, values);

    expect(result).toEqual({
      1: 'one',
      2: 'two',
      3: 'three',
    });
  });

  it('should return empty object when either array is empty', () => {
    expect(zipObject([], [1, 2, 3])).toEqual({});
    expect(zipObject(['a', 'b', 'c'], [])).toEqual({});
    expect(zipObject([], [])).toEqual({});
  });
});

// ============================
// zipWith 功能测试
// ============================
describe.concurrent('zipWith Function Tests', () => {
  it('should zip arrays with iteratee function', () => {
    const arr1 = [1, 2, 3];
    const arr2 = [10, 20, 30];

    const result = zipWith((a: number, b: number) => a + b, arr1, arr2);

    expect(result).toEqual([11, 22, 33]);
  });

  it('should handle multiple arrays with iteratee', () => {
    const arr1 = [1, 2];
    const arr2 = [10, 20];
    const arr3 = [100, 200];

    const result = zipWith(
      (a: number, b: number, c: number) => a + b + c,
      arr1,
      arr2,
      arr3,
    );

    expect(result).toEqual([111, 222]);
  });

  it('should use min length when arrays have different lengths', () => {
    const arr1 = [1, 2, 3, 4];
    const arr2 = [10, 20];

    const result = zipWith((a: number, b: number) => a * b, arr1, arr2);

    expect(result).toEqual([10, 40]);
    expect(result).toHaveLength(2);
  });

  it('should return empty array when no arrays provided', () => {
    const result = zipWith(() => 'test');
    expect(result).toEqual([]);
  });

  it('should handle complex transformation with different types', () => {
    const numbers = [1, 2];
    const strings = ['a', 'b'];
    const booleans = [true, false];

    const result = zipWith(
      (num: number, str: string, bool: boolean) => `${num}-${str}-${bool}`,
      numbers,
      strings,
      booleans,
    );

    expect(result).toEqual(['1-a-true', '2-b-false']);
  });

  it('should pass undefined for missing elements in shorter arrays', () => {
    const arr1 = [1, 2, 3];
    const arr2 = ['a'];

    const mockIteratee = vi.fn(
      (_n: number, _s: string | undefined) => 'result',
    );

    zipWith(mockIteratee, arr1, arr2);

    expect(mockIteratee).toHaveBeenCalledTimes(1);
    expect(mockIteratee).toHaveBeenCalledWith(1, 'a');
  });
});

// ============================
// unzip 功能测试
// ============================
describe.concurrent('unzip Function Tests', () => {
  it('should unzip a zipped array back to original arrays', () => {
    const zipped = [
      [1, 'a', true],
      [2, 'b', false],
      [3, 'c', true],
    ];

    const result = unzip(zipped);

    expect(result).toEqual([
      [1, 2, 3],
      ['a', 'b', 'c'],
      [true, false, true],
    ]);
  });

  it('should handle empty array', () => {
    const result = unzip([]);
    expect(result).toEqual([]);
  });

  it('should handle arrays with varying inner lengths', () => {
    const zipped = [[1, 'a'], [2, 'b', true], [3]];

    const result = unzip(zipped);

    expect(result).toEqual([
      [1, 2, 3],
      ['a', 'b', undefined],
      [undefined, true, undefined],
    ]);
  });

  it('should be the inverse of zip for equal length arrays', () => {
    const arr1 = [1, 2, 3];
    const arr2 = ['a', 'b', 'c'];
    const arr3 = [true, false, true];

    const zipped = zip(arr1, arr2, arr3);
    const unzipped = unzip(zipped);

    expect(unzipped).toEqual([arr1, arr2, arr3]);
  });
});

// ============================
// unzipWith 功能测试
// ============================
describe.concurrent('unzipWith Function Tests', () => {
  it('should apply iteratee to unzipped groups (row by row)', () => {
    // 原始数据
    const zipped = [
      [1, 10],
      [2, 20],
      [3, 30],
    ];

    // unzip 后逻辑上是 [1, 2, 3] 和 [10, 20, 30]
    // 但 unzipWith 会像 zip 之后再 map 一样，
    // 把 1 和 10 传给 iteratee，2 和 20 传给 iteratee...
    const result = unzipWith(zipped, (num: number, ten: number) => {
      return num + ten;
    });

    // 结果应该是每一行处理后的数组喵！
    expect(result).toEqual([11, 22, 33]);
  });

  it('should handle empty array', () => {
    const result = unzipWith([], () => 'test');
    expect(result).toEqual([]);
  });

  it('should call iteratee for each group of unzipped elements', () => {
    const zipped = [
      [1, 'a'],
      [2, 'b'],
    ] as const;

    const mockIteratee = vi.fn((n, s) => `${n}${s}`);

    const result = unzipWith(zipped, mockIteratee);

    // 应该调用 2 次（因为解压后有两组对应元素）
    expect(mockIteratee).toHaveBeenCalledTimes(2);
    expect(mockIteratee).toHaveBeenNthCalledWith(1, 1, 'a');
    expect(mockIteratee).toHaveBeenNthCalledWith(2, 2, 'b');
    expect(result).toEqual(['1a', '2b']);
  });

  it('should work with varying inner lengths', () => {
    const zipped = [[1, 10, 100], [2, 20], [3]];

    const result = unzipWith(zipped, (a: number, b: number, c: number) => {
      return (a ?? 0) + (b ?? 0) + (c ?? 0);
    });

    expect(result).toEqual([111, 22, 3]);
  });

  it('should handle complex transformation', () => {
    const zipped = [
      [1, 'apple'],
      [2, 'banana'],
    ];

    // num 和 fruit 分别是解压后对应位置的元素
    const result = unzipWith(zipped, (num: number, fruit: string) => {
      return `${num} is ${fruit}`;
    });

    expect(result).toEqual(['1 is apple', '2 is banana']);
  });
});

describe.concurrent('windowed Function Tests', () => {
  // 测试基本功能
  describe('basic functionality', () => {
    it('should return sliding windows with default step and no partial windows', () => {
      const arr = [1, 2, 3, 4, 5];
      const result = windowed(arr, 3);
      expect(result).toEqual([
        [1, 2, 3],
        [2, 3, 4],
        [3, 4, 5],
      ]);
    });

    it('should handle step > 1', () => {
      const arr = [1, 2, 3, 4, 5, 6, 7, 8];
      const result = windowed(arr, 3, 2);
      expect(result).toEqual([
        [1, 2, 3],
        [3, 4, 5],
        [5, 6, 7],
      ]);
    });

    it('should handle size equal to array length', () => {
      const arr = [1, 2, 3, 4, 5];
      const result = windowed(arr, 5);
      expect(result).toEqual([[1, 2, 3, 4, 5]]);
    });
  });

  // 测试 partial_windows 参数
  describe('partial windows', () => {
    it('should include incomplete trailing windows when partial_windows=true', () => {
      const arr = [1, 2, 3, 4, 5];
      const result = windowed(arr, 3, 1, true);
      expect(result).toEqual([[1, 2, 3], [2, 3, 4], [3, 4, 5], [4, 5], [5]]);
    });

    it('should include incomplete windows with step > 1 when partial_windows=true', () => {
      const arr = [1, 2, 3, 4, 5, 6, 7];
      const result = windowed(arr, 4, 2, true);
      expect(result).toEqual([[1, 2, 3, 4], [3, 4, 5, 6], [5, 6, 7], [7]]);
    });

    it('should stop before incomplete windows when partial_windows=false (default)', () => {
      const arr = [1, 2, 3, 4, 5];
      const result = windowed(arr, 4, 2, false);
      expect(result).toEqual([[1, 2, 3, 4]]);
    });
  });

  // 测试边界条件和无效输入
  describe('invalid inputs and edge cases', () => {
    it('should return empty array if size is not a positive integer', () => {
      const arr = [1, 2, 3, 4, 5];
      expect(windowed(arr, 0)).toEqual([]);
      expect(windowed(arr, -1)).toEqual([]);
      expect(windowed(arr, 2.5)).toEqual([]);
      expect(windowed(arr, NaN)).toEqual([]);
    });

    it('should return empty array if step is not a positive integer', () => {
      const arr = [1, 2, 3, 4, 5];
      expect(windowed(arr, 3, 0)).toEqual([]);
      expect(windowed(arr, 3, -2)).toEqual([]);
      expect(windowed(arr, 3, 1.5)).toEqual([]);
      expect(windowed(arr, 3, NaN)).toEqual([]);
    });

    it('should return empty array if size > arr.length and partial_windows=false', () => {
      const arr = [1, 2, 3];
      expect(windowed(arr, 5)).toEqual([]);
    });

    it('should handle size > arr.length when partial_windows=true', () => {
      const arr = [1, 2, 3];
      const result = windowed(arr, 5, 1, true);
      expect(result).toEqual([[1, 2, 3], [2, 3], [3]]);
    });

    it('should handle empty array input', () => {
      expect(windowed([], 3)).toEqual([]);
      expect(windowed([], 3, 1, true)).toEqual([]);
    });

    it('should handle size = 1', () => {
      const arr = [1, 2, 3, 4];
      const result = windowed(arr, 1);
      expect(result).toEqual([[1], [2], [3], [4]]);
    });

    it('should handle step > size', () => {
      const arr = [1, 2, 3, 4, 5, 6, 7, 8];
      const result = windowed(arr, 3, 5);
      expect(result).toEqual([
        [1, 2, 3],
        [6, 7, 8],
      ]);
    });
  });

  // 测试不同类型的数据
  describe('with different data types', () => {
    it('should work with strings', () => {
      const arr = ['a', 'b', 'c', 'd', 'e'];
      const result = windowed(arr, 3);
      expect(result).toEqual([
        ['a', 'b', 'c'],
        ['b', 'c', 'd'],
        ['c', 'd', 'e'],
      ]);
    });

    it('should work with objects', () => {
      const arr = [{id: 1}, {id: 2}, {id: 3}];
      const result = windowed(arr, 2);
      expect(result).toEqual([
        [{id: 1}, {id: 2}],
        [{id: 2}, {id: 3}],
      ]);
    });

    it('should work with mixed types', () => {
      const arr = [1, 'two', {three: 3}, [4]];
      const result = windowed(arr, 2);
      expect(result).toEqual([
        [1, 'two'],
        ['two', {three: 3}],
        [{three: 3}, [4]],
      ]);
    });
  });
});

// ============================
// 边缘情况测试
// ============================
describe.concurrent('Edge Cases', () => {
  it('should handle nested arrays in zipWith', () => {
    const arr1 = [
      [1, 2],
      [3, 4],
    ];
    const arr2 = [
      [5, 6],
      [7, 8],
    ];

    const result = zipWith(
      (a: number[], b: number[]) => a.concat(b),
      arr1,
      arr2,
    );

    expect(result).toEqual([
      [1, 2, 5, 6],
      [3, 4, 7, 8],
    ]);
  });

  it('should maintain referential equality for objects', () => {
    const obj1 = {id: 1};
    const obj2 = {id: 2};
    const arr1 = [obj1, obj2];
    const arr2 = ['a', 'b'];

    const result = zip(arr1, arr2);

    expect(result[0][0]).toBe(obj1);
    expect(result[1][0]).toBe(obj2);
  });
});
