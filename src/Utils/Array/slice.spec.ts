// ========================================
// ./src/Utils/Array/slice.spec.ts
// ========================================

import {describe, it, expect} from 'vitest';
import {
  head,
  last,
  initial,
  tail,
  take,
  takeRight,
  drop,
  dropRight,
  takeWhile,
  takeRightWhile,
  dropWhile,
  dropRightWhile,
  collectAt,
  circularAt,
} from './slice';

// ============================
// 测试数据准备
// ============================
const numbers = [1, 2, 3, 4, 5];
const strings = ['a', 'b', 'c', 'd', 'e'];

// ============================
// collectAt 测试
// ============================
describe.concurrent('collectAt Tests', () => {
  it('collectAt should collect values at specified indices', () => {
    const result = collectAt(numbers, [0, 2, 4]);
    expect(result).toEqual([1, 3, 5]);
  });

  it('collectAt should return undefined for out-of-bounds indices when circular is false', () => {
    const result = collectAt(numbers, [5, -1]);
    expect(result).toEqual([undefined, undefined]);
  });

  it('collectAt with circular should wrap indices around', () => {
    const result = collectAt(numbers, [5, -1], true);
    expect(result).toEqual([1, 5]);
  });

  it('collectAt should return empty array for empty array input', () => {
    expect(collectAt([], [0])).toEqual([]);

    const result = collectAt([], [0, 1, 2]);
    expect(result).toEqual([]);
  });

  it('collectAt should return empty array for empty indices', () => {
    const result = collectAt(numbers, []);
    expect(result).toEqual([]);
  });
});

// ============================
// circularAt 测试
// ============================
describe.concurrent('circularAt Tests', () => {
  it('circularAt should return element at index when in bounds', () => {
    expect(circularAt(numbers, 2)).toBe(3);
    expect(circularAt(strings, 0)).toBe('a');
  });

  it('circularAt with circular enabled should wrap indices', () => {
    expect(circularAt(numbers, 5)).toBe(1); // 5 % 5 = 0
    expect(circularAt(numbers, -1)).toBe(5); // (-1 % 5 + 5) % 5 = 4
    expect(circularAt(numbers, 7)).toBe(3); // 7 % 5 = 2
  });

  it('circularAt should return undefined for empty array', () => {
    expect(circularAt([], 0)).toBeUndefined();
    expect(circularAt([], 5)).toBeUndefined();
  });
});

// ============================
// 基础切片函数测试
// ============================
describe.concurrent('Basic Slice Function Tests', () => {
  describe('head', () => {
    it('should return first element of array', () => {
      expect(head([1, 2, 3])).toBe(1);
      expect(head(['a', 'b', 'c'])).toBe('a');
    });

    it('should return undefined for empty array', () => {
      expect(head([])).toBeUndefined();
    });

    it('should work with single element array', () => {
      expect(head([42])).toBe(42);
    });
  });

  describe('last', () => {
    it('should return last element of array', () => {
      expect(last([1, 2, 3])).toBe(3);
      expect(last(['a', 'b', 'c'])).toBe('c');
    });

    it('should return undefined for empty array', () => {
      expect(last([])).toBeUndefined();
    });

    it('should work with single element array', () => {
      expect(last([42])).toBe(42);
    });
  });

  describe('initial', () => {
    it('should return all but last element', () => {
      expect(initial([1, 2, 3])).toEqual([1, 2]);
      expect(initial(['a', 'b', 'c'])).toEqual(['a', 'b']);
    });

    it('should return empty array for single element', () => {
      expect(initial([42])).toEqual([]);
    });

    it('should return empty array for empty array', () => {
      expect(initial([])).toEqual([]);
    });

    it('should not mutate original array', () => {
      const original = [1, 2, 3];
      const result = initial(original);
      expect(original).toEqual([1, 2, 3]);
      expect(result).toEqual([1, 2]);
    });
  });

  describe('tail', () => {
    it('should return all but first element', () => {
      expect(tail([1, 2, 3])).toEqual([2, 3]);
      expect(tail(['a', 'b', 'c'])).toEqual(['b', 'c']);
    });

    it('should return empty array for single element', () => {
      expect(tail([42])).toEqual([]);
    });

    it('should return empty array for empty array', () => {
      expect(tail([])).toEqual([]);
    });

    it('should not mutate original array', () => {
      const original = [1, 2, 3];
      const result = tail(original);
      expect(original).toEqual([1, 2, 3]);
      expect(result).toEqual([2, 3]);
    });
  });
});

// ============================
// 固定数量切片函数测试
// ============================
describe.concurrent('Fixed Number Slice Function Tests', () => {
  const sampleArray = [1, 2, 3, 4, 5];

  describe('take', () => {
    it('should take n elements from beginning', () => {
      expect(take(sampleArray, 2)).toEqual([1, 2]);
      expect(take(sampleArray, 3)).toEqual([1, 2, 3]);
    });

    it('should default to 1 element', () => {
      expect(take(sampleArray)).toEqual([1]);
    });

    it('should return empty array when n is 0', () => {
      expect(take(sampleArray, 0)).toEqual([]);
    });

    it('should return full array when n exceeds length', () => {
      expect(take(sampleArray, 10)).toEqual(sampleArray);
    });

    it('should return empty array when array is empty', () => {
      expect(take([], 3)).toEqual([]);
    });
  });

  describe('takeRight', () => {
    it('should take n elements from end', () => {
      expect(takeRight(sampleArray, 2)).toEqual([4, 5]);
      expect(takeRight(sampleArray, 3)).toEqual([3, 4, 5]);
    });

    it('should default to 1 element', () => {
      expect(takeRight(sampleArray)).toEqual([5]);
    });

    it('should return empty array when n is 0', () => {
      expect(takeRight(sampleArray, 0)).toEqual([]);
    });

    it('should return full array when n exceeds length', () => {
      expect(takeRight(sampleArray, 10)).toEqual(sampleArray);
    });

    it('should return empty array when array is empty', () => {
      expect(takeRight([], 3)).toEqual([]);
    });
  });

  describe('drop', () => {
    it('should drop n elements from beginning', () => {
      expect(drop(sampleArray, 2)).toEqual([3, 4, 5]);
      expect(drop(sampleArray, 3)).toEqual([4, 5]);
    });

    it('should default to 1 element', () => {
      expect(drop(sampleArray)).toEqual([2, 3, 4, 5]);
    });

    it('should return empty array when n exceeds length', () => {
      expect(drop(sampleArray, 10)).toEqual([]);
    });

    it('should return full array when n is 0', () => {
      expect(drop(sampleArray, 0)).toEqual(sampleArray);
    });

    it('should return empty array when array is empty', () => {
      expect(drop([], 3)).toEqual([]);
    });
  });

  describe('dropRight', () => {
    it('should drop n elements from end', () => {
      expect(dropRight(sampleArray, 2)).toEqual([1, 2, 3]);
      expect(dropRight(sampleArray, 3)).toEqual([1, 2]);
    });

    it('should default to 1 element', () => {
      expect(dropRight(sampleArray)).toEqual([1, 2, 3, 4]);
    });

    it('should return empty array when n exceeds length', () => {
      expect(dropRight(sampleArray, 10)).toEqual([]);
    });

    it('should return full array when n is 0', () => {
      expect(dropRight(sampleArray, 0)).toEqual(sampleArray);
    });

    it('should handle empty arrays', () => {
      expect(dropRight([], 3)).toEqual([]);
    });
  });
});

// ============================
// 条件切片函数测试
// ============================
describe.concurrent('Conditional Slice Function Tests', () => {
  const isEven = (n: number) => n % 2 === 0;
  const isOdd = (n: number) => n % 2 !== 0;
  const lessThan3 = (n: number) => n < 3;
  const greaterThan2 = (n: number) => n > 2;

  describe('takeWhile', () => {
    it('should take from beginning while predicate is true', () => {
      expect(takeWhile([2, 4, 6, 7, 8, 9], isEven)).toEqual([2, 4, 6]);
      expect(takeWhile([1, 2, 3, 4], lessThan3)).toEqual([1, 2]);
    });

    it('should return full array if predicate always true', () => {
      expect(takeWhile([2, 4, 6, 8], isEven)).toEqual([2, 4, 6, 8]);
    });

    it('should return empty array if predicate false from start', () => {
      expect(takeWhile([1, 2, 3], isEven)).toEqual([]);
    });

    it('should handle empty array', () => {
      expect(takeWhile([], isEven)).toEqual([]);
    });

    it('should work with strings', () => {
      const startsWithA = (s: string) => s.startsWith('a');
      expect(
        takeWhile(['apple', 'ant', 'banana', 'apricot'], startsWithA),
      ).toEqual(['apple', 'ant']);
    });
  });

  describe('takeRightWhile', () => {
    it('should take from end while predicate is true', () => {
      expect(takeRightWhile([1, 2, 3, 6, 8, 10], isEven)).toEqual([6, 8, 10]);
      expect(takeRightWhile([1, 2, 3, 4, 5], greaterThan2)).toEqual([3, 4, 5]);
    });

    it('should return full array if predicate always true', () => {
      expect(takeRightWhile([1, 3, 5, 7], isOdd)).toEqual([1, 3, 5, 7]);
    });

    it('should return elements from end while predicate is true', () => {
      // 从右往左，4是偶数，继续；3不是偶数，停止。所以返回[4]
      expect(takeRightWhile([1, 2, 3, 4], isEven)).toEqual([4]);
    });

    it('should handle empty array', () => {
      expect(takeRightWhile([], isEven)).toEqual([]);
    });

    it('should work with objects', () => {
      type User = {name: string; active: boolean};
      const users: User[] = [
        {name: 'Alice', active: true},
        {name: 'Bob', active: true},
        {name: 'Charlie', active: false},
        {name: 'David', active: true}, // 注意：添加一个末尾为true的元素
      ];
      const isActive = (user: User) => user.active;
      // 从右往左，David是active，继续；Charlie不是active，停止
      // 所以返回[David]
      expect(takeRightWhile(users, isActive)).toEqual([
        {name: 'David', active: true},
      ]);
    });
  });

  describe('dropWhile', () => {
    it('should drop from beginning while predicate is true', () => {
      expect(dropWhile([2, 4, 6, 7, 8, 9], isEven)).toEqual([7, 8, 9]);
      expect(dropWhile([1, 2, 3, 4], lessThan3)).toEqual([3, 4]);
    });

    it('should return empty array if predicate always true', () => {
      expect(dropWhile([2, 4, 6, 8], isEven)).toEqual([]);
    });

    it('should return full array if predicate false from start', () => {
      expect(dropWhile([1, 2, 3], isEven)).toEqual([1, 2, 3]);
    });

    it('should handle empty array', () => {
      expect(dropWhile([], isEven)).toEqual([]);
    });

    it('should work with complex predicates', () => {
      const isPositive = (n: number) => n > 0;
      expect(dropWhile([5, 4, 3, -1, 2], isPositive)).toEqual([-1, 2]);
    });
  });

  describe('dropRightWhile', () => {
    it('should drop from end while predicate is true', () => {
      expect(dropRightWhile([1, 2, 3, 6, 8, 10], isEven)).toEqual([1, 2, 3]);
      expect(dropRightWhile([1, 2, 3, 4, 5], greaterThan2)).toEqual([1, 2]);
    });

    it('should return empty array if predicate always true', () => {
      expect(dropRightWhile([1, 3, 5, 7], isOdd)).toEqual([]);
    });

    it('should return array excluding elements from end while predicate is true', () => {
      expect(dropRightWhile([1, 2, 3, 4], isEven)).toEqual([1, 2, 3]);
    });

    it('should handle empty array', () => {
      expect(dropRightWhile([], isEven)).toEqual([]);
    });

    it('should work with array of arrays', () => {
      const isEmptyArray = (arr: unknown[]) => arr.length === 0;
      expect(dropRightWhile([[1], [2], [], []], isEmptyArray)).toEqual([
        [1],
        [2],
      ]);
    });
  });
});

// ============================
// 边界情况和集成测试
// ============================
describe.concurrent('Edge Cases and Integration Tests', () => {
  it('should handle readonly arrays', () => {
    const readonlyArr = [1, 2, 3, 4, 5] as const;

    expect(head(readonlyArr)).toBe(1);
    expect(last(readonlyArr)).toBe(5);
    expect(initial(readonlyArr)).toEqual([1, 2, 3, 4]);
    expect(tail(readonlyArr)).toEqual([2, 3, 4, 5]);
    expect(take(readonlyArr, 2)).toEqual([1, 2]);
    expect(dropRight(readonlyArr, 2)).toEqual([1, 2, 3]);
  });

  it('should chain operations correctly', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    // 链式调用：先取前8个，再删除前3个，再取最后2个
    // take(arr, 8) => [1, 2, 3, 4, 5, 6, 7, 8]
    // drop([1, 2, 3, 4, 5, 6, 7, 8], 3) => [4, 5, 6, 7, 8]
    // takeRight([4, 5, 6, 7, 8], 2) => [7, 8]
    const result = takeRight(drop(take(arr, 8), 3), 2);
    expect(result).toEqual([7, 8]); // 修复：正确的预期结果
  });

  it('should handle negative numbers gracefully', () => {
    const arr = [1, 2, 3];

    // 对于负数，我们的函数应该返回空数组或完整数组
    expect(take(arr, -1)).toEqual([]); // take应该返回空数组
    expect(takeRight(arr, -1)).toEqual([]); // takeRight应该返回空数组

    // drop和dropRight对于负数应该返回完整数组
    expect(drop(arr, -1)).toEqual([1, 2, 3]); // drop负数应该返回完整数组
    expect(dropRight(arr, -1)).toEqual([1, 2, 3]); // dropRight负数应该返回完整数组
  });

  it('should work with sparse arrays', () => {
    const sparseArray = [1, , 3]; // eslint-disable-line no-sparse-arrays

    // head 和 last 应该跳过空位
    expect(head(sparseArray)).toBe(1);
    expect(last(sparseArray)).toBe(3);

    // slice 方法会保留空位
    expect(take(sparseArray, 2)).toEqual([1, undefined]);
    expect(drop(sparseArray, 1)).toEqual([undefined, 3]);
  });

  it('should maintain type safety', () => {
    const stringArray = ['a', 'b', 'c'] as const;
    const numberArray = [1, 2, 3] as const;

    // TypeScript 应该推断出正确的类型
    const headStr: string | undefined = head(stringArray);
    const headNum: number | undefined = head(numberArray);

    expect(headStr).toBe('a');
    expect(headNum).toBe(1);

    // takeWhile 应该保持类型
    const filtered = takeWhile(numberArray, (n) => n < 3);
    const first: number | undefined = filtered[0];

    expect(first).toBe(1);
    expect(filtered).toEqual([1, 2]);
  });
});
