// ========================================
// ./src/Utils/Array/set.spec.ts
// ========================================
import {describe, it, expect} from 'vitest';
import {
  difference,
  differenceBy,
  differenceWith,
  intersection,
  intersectionBy,
  intersectionWith,
  union,
  unionBy,
  unionWith,
  xor,
  xorBy,
  xorWith,
  isSubset,
  isSubsetWith,
} from './set';

// ============================
// 测试辅助函数
// ============================
const compareByLength = (a: string, b: string) => a.length === b.length;
const getId = (item: {id: number}) => item.id;
const compareById = (a: {id: number}, b: {id: number}) => a.id === b.id;

// ============================
// 差集测试
// ============================
describe.concurrent('Difference Tests', () => {
  describe('difference', () => {
    it('should return elements in array not in any other arrays', () => {
      const result = difference([1, 2, 3, 4], [2, 3], [3, 4, 5]);
      expect(result).toEqual([1]);
    });

    it('should return empty array when all elements are in other arrays', () => {
      const result = difference([1, 2, 3], [1], [2], [3]);
      expect(result).toEqual([]);
    });

    it('should handle empty arrays', () => {
      expect(difference([], [1, 2])).toEqual([]);
      expect(difference([1, 2], [])).toEqual([1, 2]);
      expect(difference([], [], [])).toEqual([]);
    });

    it('should handle single array', () => {
      const result = difference([1, 2, 3]);
      expect(result).toEqual([1, 2, 3]);
    });
  });

  describe('differenceBy', () => {
    const objects = [
      {id: 1, name: 'Alice'},
      {id: 2, name: 'Bob'},
      {id: 3, name: 'Charlie'},
    ];

    it('should return elements not in values based on iteratee', () => {
      const values = [{id: 2}, {id: 3}];
      const result = differenceBy(objects, values, getId);
      expect(result).toEqual([{id: 1, name: 'Alice'}]);
    });

    it('should handle empty arrays', () => {
      expect(differenceBy([], [], getId)).toEqual([]);
      expect(differenceBy(objects, [], getId)).toEqual(objects);
      expect(differenceBy([], objects, getId)).toEqual([]);
    });
  });

  describe('differenceWith', () => {
    it('should return elements not in values based on comparator', () => {
      const array = ['apple', 'banana', 'cherry', 'date'];
      // 'apple'(5) 匹配 'apple'(5) -> 排除
      // 'date'(4) 匹配 'kiwi'(4) -> 排除 (因为按长度比较)
      const values = ['grape', 'kiwi', 'apple'];
      const result = differenceWith(array, values, compareByLength);
      // 剩下的应该是 'banana'(6) 和 'cherry'(6)
      expect(result).toEqual(['banana', 'cherry']);
    });

    it('should handle custom object comparator', () => {
      const array = [
        {id: 1, name: 'A'},
        {id: 2, name: 'B'},
        {id: 3, name: 'C'},
      ];
      const values = [{id: 2}, {id: 4}];
      const result = differenceWith(array, values, compareById);
      expect(result).toEqual([
        {id: 1, name: 'A'},
        {id: 3, name: 'C'},
      ]);
    });
  });
});

// ============================
// 交集测试
// ============================
describe.concurrent('Intersection Tests', () => {
  describe('intersection', () => {
    it('should return common elements across all arrays', () => {
      const result = intersection([1, 2, 3], [2, 3, 4], [3, 4, 5]);
      expect(result).toEqual([3]);
    });

    it('should return empty array when no common elements', () => {
      const result = intersection([1, 2], [3, 4], [5, 6]);
      expect(result).toEqual([]);
    });

    it('should handle empty arrays', () => {
      expect(intersection([])).toEqual([]);
      expect(intersection([1, 2], [])).toEqual([]);
      expect(intersection([], [1, 2], [3])).toEqual([]);
    });

    it('should handle single array', () => {
      expect(intersection([1, 2, 3])).toEqual([1, 2, 3]);
    });

    it('should use shortest array as base for efficiency', () => {
      const longArray = Array.from({length: 1000}, (_, i) => i);
      const shortArray = [999, 1000];
      const result = intersection(longArray, shortArray);
      expect(result).toEqual([999]);
    });
  });

  describe('intersectionBy', () => {
    it('should return common elements based on iteratee', () => {
      const array1 = [
        {id: 1, name: 'A'},
        {id: 2, name: 'B'},
        {id: 3, name: 'C'},
      ];
      const array2 = [{id: 2}, {id: 3}, {id: 4}];
      const result = intersectionBy(array1, array2, getId);
      expect(result).toEqual([
        {id: 2, name: 'B'},
        {id: 3, name: 'C'},
      ]);
    });

    it('should handle empty arrays', () => {
      expect(intersectionBy([], [], getId)).toEqual([]);
      expect(intersectionBy([{id: 1}], [], getId)).toEqual([]);
    });
  });

  describe('intersectionWith', () => {
    it('should return common elements based on comparator', () => {
      const array1 = ['apple', 'banana', 'cherry'];
      const array2 = ['grape', 'kiwi', 'apple']; // 只有'apple'匹配（长度不同）
      const result = intersectionWith(array1, array2, compareByLength);
      expect(result).toEqual(['apple']); // 只有'apple'长度匹配
    });

    it('should handle custom object comparator', () => {
      const array1 = [
        {id: 1, name: 'A'},
        {id: 2, name: 'B'},
      ];
      const array2 = [{id: 2, name: 'Different'}, {id: 3}];
      const result = intersectionWith(array1, array2, compareById);
      expect(result).toEqual([{id: 2, name: 'B'}]);
    });
  });
});

// ============================
// 并集测试
// ============================
describe.concurrent('Union Tests', () => {
  describe('union', () => {
    it('should return unique elements from all arrays', () => {
      const result = union([1, 2], [2, 3], [3, 4]);
      expect(result).toEqual([1, 2, 3, 4]);
    });

    it('should remove duplicates within single array', () => {
      const result = union([1, 1, 2, 2]);
      expect(result).toEqual([1, 2]);
    });

    it('should handle empty arrays', () => {
      expect(union([])).toEqual([]);
      expect(union([], [])).toEqual([]);
      expect(union([1, 2], [], [3])).toEqual([1, 2, 3]);
    });
  });

  describe('unionBy', () => {
    it('should return unique elements based on iteratee', () => {
      const array1 = [
        {id: 1, name: 'A'},
        {id: 2, name: 'B'},
      ];
      const array2 = [
        {id: 2, name: 'B2'},
        {id: 3, name: 'C'},
      ];
      const result = unionBy(array1, array2, getId);
      expect(result).toEqual([
        {id: 1, name: 'A'},
        {id: 2, name: 'B'}, // 第一个出现的id=2
        {id: 3, name: 'C'},
      ]);
    });

    it('should preserve first occurrence order', () => {
      const array1 = [{id: 2}, {id: 1}];
      const array2 = [{id: 1}, {id: 3}];
      const result = unionBy(array1, array2, getId);
      expect(result).toEqual([{id: 2}, {id: 1}, {id: 3}]);
    });
  });

  describe('unionWith', () => {
    it('should return unique elements based on comparator', () => {
      const array1 = ['apple', 'banana']; // 长度: 5, 6
      const array2 = ['grape', 'kiwi', 'pear']; // 长度: 5, 4, 4
      const result = unionWith(array1, array2, compareByLength);
      // 'grape'(5) 和 'apple'(5) 重复，跳过
      // 'kiwi'(4) 是新的，保留
      // 'pear'(4) 和 'kiwi'(4) 重复，跳过
      expect(result).toEqual(['apple', 'banana', 'kiwi']);
    });

    it('should handle custom object comparator', () => {
      const array1 = [
        {id: 1, name: 'A'},
        {id: 2, name: 'B'},
      ];
      const array2 = [
        {id: 2, name: 'Different'},
        {id: 3, name: 'C'},
      ];
      const result = unionWith(array1, array2, compareById);
      expect(result).toEqual([
        {id: 1, name: 'A'},
        {id: 2, name: 'B'},
        {id: 3, name: 'C'},
      ]);
    });
  });
});

// ============================
// 对称差集测试
// ============================
describe.concurrent('Symmetric Difference (XOR) Tests', () => {
  describe('xor', () => {
    it('should return elements in either array but not both', () => {
      const result = xor([1, 2, 3], [2, 3, 4]);
      expect(result).toEqual([1, 4]);
    });

    it('should handle multiple arrays', () => {
      const result = xor([1, 2], [2, 3]);
      expect(result).toEqual([1, 3]);
    });

    it('should handle empty arrays', () => {
      expect(xor([], [])).toEqual([]);
      expect(xor([1, 2], [])).toEqual([1, 2]);
      expect(xor([], [1, 2])).toEqual([1, 2]);
    });
  });

  describe('xorBy', () => {
    it('should return symmetric difference based on iteratee', () => {
      const array1 = [
        {id: 1, name: 'A'},
        {id: 2, name: 'B'},
        {id: 3, name: 'C'},
      ];
      const array2 = [{id: 2}, {id: 3}, {id: 4}];
      const result = xorBy(array1, array2, getId);
      expect(result).toEqual([{id: 1, name: 'A'}, {id: 4}]);
    });
  });

  describe('xorWith', () => {
    it('should return symmetric difference based on comparator', () => {
      const array1 = ['apple', 'banana', 'cherry']; // 5, 6, 6
      const array2 = ['grape', 'kiwi', 'strawberry']; // 5, 4, 10
      const result = xorWith(array1, array2, compareByLength);
      // apple(5) == grape(5) -> 抵消
      // banana, cherry (6) 没有匹配
      // kiwi (4), strawberry (10) 没有匹配
      expect(result).toEqual(['banana', 'cherry', 'kiwi', 'strawberry']);
    });
  });
});

// ============================
// 子集判断测试
// ============================
describe.concurrent('Subset Tests', () => {
  describe('isSubset', () => {
    it('should return true when all elements of subset are in superset', () => {
      expect(isSubset([1, 2], [1, 2, 3, 4])).toBe(true);
    });

    it('should return false when subset has element not in superset', () => {
      expect(isSubset([1, 5], [1, 2, 3])).toBe(false);
    });

    it('should handle empty subset', () => {
      expect(isSubset([], [1, 2, 3])).toBe(true);
    });

    it('should handle duplicates', () => {
      expect(isSubset([1, 1, 2], [1, 2, 3])).toBe(true);
    });

    it('should return false when superset is smaller', () => {
      expect(isSubset([1, 2, 3], [1, 2])).toBe(false);
    });
  });

  describe('isSubsetWith', () => {
    it('should check subset based on comparator', () => {
      const array1 = ['apple', 'banana', 'pear'];
      const array2 = ['grape', 'kiwi'];
      const result = isSubsetWith(array2, array1, compareByLength);
      expect(result).toBe(true);
    });

    it('should handle custom object comparator', () => {
      const superset = [
        {id: 1, name: 'A'},
        {id: 2, name: 'B'},
        {id: 3, name: 'C'},
      ];
      const subset = [{id: 2}, {id: 3}];
      const result = isSubsetWith(subset, superset, compareById);
      expect(result).toBe(true);
    });
  });
});

// ============================
// 边缘情况测试
// ============================
describe.concurrent('Edge Cases', () => {
  it('should return an empty array when no arguments are provided', () => {
    const result = intersection();
    expect(result).toEqual([]);
    expect(result.length).toBe(0);
  });

  it('should handle objects with same iteratee value', () => {
    const array1 = [
      {id: 1, name: 'A'},
      {id: 1, name: 'B'},
    ];
    const array2 = [{id: 1, name: 'C'}];
    const result = unionBy(array1, array2, getId);
    expect(result).toEqual([{id: 1, name: 'A'}]); // 只保留第一个
  });

  it('should maintain order for union operations', () => {
    const array1 = [3, 1, 2];
    const array2 = [2, 4, 3];
    const result = union(array1, array2);
    expect(result).toEqual([3, 1, 2, 4]); // 保持第一个数组的顺序，然后添加第二个数组的新元素
  });
});
