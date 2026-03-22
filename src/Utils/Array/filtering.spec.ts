// ========================================
// ./src/Utils/Array/filtering.spec.ts
// ========================================
/* eslint-disable no-sparse-arrays */
import {describe, it, expect, vi} from 'vitest';
import {
  uniq,
  uniqBy,
  uniqWith,
  without,
  pull,
  pullAt,
  KEEP_HOLE,
  remove,
  compact,
  nonNullable,
} from './filtering';

// ============================
// 数组移除函数测试
// ============================

describe.concurrent('without & pull Tests', () => {
  describe('without Tests', () => {
    it('should return new array without specified values', () => {
      const result = without([1, 2, 3, 4, 5], 2, 4);
      expect(result).toEqual([1, 3, 5]);
    });

    it('should handle multiple occurrences', () => {
      const result = without([1, 2, 2, 3, 2], 2);
      expect(result).toEqual([1, 3]);
    });

    it('should not mutate original array', () => {
      const original = [1, 2, 3, 4];
      const copy = [...original];
      const result = without(original, 2);

      expect(result).toEqual([1, 3, 4]);
      expect(original).toEqual(copy);
    });

    it('should handle no values to remove', () => {
      const result = without([1, 2, 3]);
      expect(result).toEqual([1, 2, 3]);
    });
  });

  describe('pull Tests', () => {
    it('should mutate array by removing specified values', () => {
      const arr = [1, 2, 3, 4, 2, 5];
      const result = pull(arr, 2, 4);

      expect(result).toBe(arr); // 返回原数组引用
      expect(arr).toEqual([1, 3, 5]);
    });

    it('should handle multiple occurrences efficiently', () => {
      const arr = [1, 2, 2, 3, 2, 4, 2];
      pull(arr, 2);
      expect(arr).toEqual([1, 3, 4]);
    });

    it('should work with complex values', () => {
      const obj1 = {id: 1};
      const obj2 = {id: 2};
      const arr = [obj1, obj2, obj1];
      pull(arr, obj1);
      expect(arr).toEqual([obj2]);
    });
  });
});

// ============================
// 按索引移除测试
// ============================

describe.concurrent('pullAt Tests', () => {
  it('should remove elements at specified indices and return them', () => {
    const arr = ['a', 'b', 'c', 'd', 'e'];
    const removed = pullAt(arr, [1, 3]);

    expect(removed).toEqual(['b', 'd']);
    expect(arr).toEqual(['a', 'c', 'e']);
  });

  it('should handle indices in reverse order', () => {
    const arr = [1, 2, 3, 4, 5];
    const removed = pullAt(arr, [4, 2, 0]);

    expect(removed).toEqual([5, 3, 1]);
    expect(arr).toEqual([2, 4]);
  });

  it('should ignore invalid indices', () => {
    const arr = [1, 2, 3];
    const removed = pullAt(arr, [5, -1, 1]);

    expect(removed).toEqual([2]);
    expect(arr).toEqual([1, 3]);
  });

  it('should handle duplicate indices', () => {
    const arr = ['x', 'y', 'z'];
    const removed = pullAt(arr, [1, 1, 2]);

    expect(removed).toEqual(['y', 'z']);
    expect(arr).toEqual(['x']);
  });

  it('should return empty array when all indices are invalid', () => {
    const arr = ['a', 'b', 'c', 'd', 'e'];
    const removed = pullAt(arr, [10, -5, 100, -1]);

    expect(removed).toEqual([]);
    expect(arr).toEqual(['a', 'b', 'c', 'd', 'e']); // 数组保持不变
  });
});

// ============================
// 条件移除测试
// ============================

describe.concurrent('remove Tests', () => {
  it('should filter array based on predicate and return removed items', () => {
    const arr = [1, 2, 3, 4, 5];
    const removed = remove(arr, (val) => val % 2 === 0);

    expect(arr).toEqual([1, 3, 5]);
    expect(removed).toEqual([2, 4]);
  });

  it('should handle sparse arrays', () => {
    const arr = [1, , 3, , 5];
    const removed = remove(arr, (val) => Boolean(val && val > 2));

    expect(arr).toEqual([1, , ,]);
    expect(removed).toEqual([3, 5]);
  });

  it('should preserve holes when on_hole returns KEEP_HOLE', () => {
    const arr = [1, , 3, , 5];
    remove(
      arr,
      (val) => Boolean(val && val > 2),
      () => KEEP_HOLE,
    );

    expect(0 in arr).toBe(true);
    expect(1 in arr).toBe(false);
    expect(2 in arr).toBe(false);
    expect(3 in arr).toBe(false);
    expect(4 in arr).toBe(false);
    expect(arr.length).toBe(3);
  });

  it('should map holes when on_hole returns a value', () => {
    const arr = [1, , 3, , 5];
    const removed = remove(
      arr,
      (val) => Boolean(val && val > 2),
      () => 'filled',
    );

    expect(arr).toEqual([1, 'filled', 'filled']);
    expect(removed).toEqual([3, 5]);
  });

  it('should skip holes when on_hole returns undefined', () => {
    const arr = [1, , 3, , 5];
    const removed = remove(
      arr,
      (val) => Boolean(val && val > 2),
      () => undefined,
    );

    expect(arr).toEqual([1]);
    expect(removed).toEqual([3, 5]);
  });

  it('should handle all elements removed', () => {
    const arr = [1, 2, 3];
    const removed = remove(arr, () => true);
    expect(arr).toEqual([]);
    expect(removed).toEqual([1, 2, 3]);
  });

  it('should handle no elements removed', () => {
    const arr = [1, 2, 3];
    const removed = remove(arr, () => false);
    expect(arr).toEqual([1, 2, 3]);
    expect(removed).toEqual([]);
  });

  it('should pass index to on_hole callback', () => {
    const arr = [1, , 3];
    const spy = vi.fn(() => KEEP_HOLE);
    remove(arr, (val) => val === 3, spy);
    expect(spy).toHaveBeenCalledWith(1);
  });
});

// ============================
// 数组过滤函数测试
// ============================

describe.concurrent('compact Tests', () => {
  it('should remove falsy values', () => {
    const arr = [0, 1, false, 2, '', 3, null, undefined, 4];
    const result = compact(arr);

    expect(result).toEqual([1, 2, 3, 4]);
    expect(result.every((val) => Boolean(val))).toBe(true);
  });

  it('should not mutate original array', () => {
    const original = [0, 1, 2];
    const copy = [...original];
    const result = compact(original);

    expect(result).toEqual([1, 2]);
    expect(original).toEqual(copy);
    expect(result).not.toBe(original);
  });

  it('should work with typed arrays', () => {
    const arr = [null, undefined, 'hello', 0, false];
    const result = compact(arr);
    expect(result).toEqual(['hello']);
  });
});

describe('nonNullable Tests', () => {
  it('should remove null and undefined values only', () => {
    const arr = [1, null, 2, undefined, 3, '', false, 0];
    const result = nonNullable(arr);

    expect(result).toEqual([1, 2, 3, '', false, 0]);
  });

  it('should preserve other falsy values', () => {
    const arr = [0, false, '', NaN];
    const result = nonNullable(arr);

    expect(result).toEqual([0, false, '', NaN]);
  });

  it('should work with complex types', () => {
    const obj = {a: 1};
    const arr = [obj, null, undefined, {b: 2}];
    const result = nonNullable(arr);

    expect(result).toEqual([obj, {b: 2}]);
  });
});

// ============================
// 数组去重函数测试
// ============================

describe.concurrent('Uniqueness Functions', () => {
  describe('uniq', () => {
    it('should remove duplicate primitive values', () => {
      expect(uniq([1, 2, 2, 3, 3, 3])).toEqual([1, 2, 3]);
      expect(uniq(['a', 'b', 'a', 'c'])).toEqual(['a', 'b', 'c']);
      expect(uniq([true, false, true])).toEqual([true, false]);
      expect(uniq([null, null, undefined, undefined])).toEqual([
        null,
        undefined,
      ]);
    });

    it('should handle empty array', () => {
      expect(uniq([])).toEqual([]);
    });

    it('should preserve order of first occurrence', () => {
      expect(uniq([3, 1, 2, 1, 3])).toEqual([3, 1, 2]);
    });

    it('should treat objects as different by reference', () => {
      const obj = {id: 1};
      expect(uniq([obj, obj, {id: 1}])).toEqual([obj, {id: 1}]);
    });

    // 边界条件
    it('should handle mixed types in array', () => {
      expect(uniq([1, '1', true, 'true'])).toEqual([1, '1', true, 'true']);
    });

    it('should handle NaN in array', () => {
      const result = uniq([NaN, NaN, 1, NaN, 2]);
      expect(result.length).toBe(3);
      expect(Number.isNaN(result[0])).toBe(true);
      expect(result[1]).toBe(1);
      expect(result[2]).toBe(2);
    });

    it('should handle Symbol uniqueness', () => {
      const sym1 = Symbol('test');
      const sym2 = Symbol('test');
      expect(uniq([sym1, sym1, sym2])).toEqual([sym1, sym2]);
    });

    it('should handle large arrays efficiently', () => {
      const largeArray = Array.from({length: 10000}, (_, i) => i % 10);
      const result = uniq(largeArray);
      expect(result).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });
  });

  describe('uniqBy', () => {
    interface User {
      id: number;
      name: string;
    }

    interface NestedData {
      data: {
        value: string;
      };
    }

    it('should deduplicate based on property value', () => {
      const array: User[] = [
        {id: 1, name: 'Alice'},
        {id: 2, name: 'Bob'},
        {id: 1, name: 'Alice Clone'},
      ];

      expect(uniqBy(array, (item) => item.id)).toEqual([
        {id: 1, name: 'Alice'},
        {id: 2, name: 'Bob'},
      ]);
    });

    it('should deduplicate based on computed value', () => {
      const array = ['apple', 'banana', 'apricot', 'cherry'];
      expect(uniqBy(array, (str) => str.length)).toEqual([
        'apple',
        'banana',
        'apricot',
      ]);
    });

    it('should handle nested property access', () => {
      const array: NestedData[] = [
        {data: {value: 'a'}},
        {data: {value: 'b'}},
        {data: {value: 'a'}},
      ];

      expect(uniqBy(array, (item) => item.data.value)).toEqual([
        {data: {value: 'a'}},
        {data: {value: 'b'}},
      ]);
    });

    it('should preserve first occurrence order', () => {
      const array: User[] = [
        {id: 2, name: 'Second'},
        {id: 1, name: 'First'},
        {id: 2, name: 'Second Again'},
      ];

      expect(uniqBy(array, (item) => item.id)).toEqual([
        {id: 2, name: 'Second'},
        {id: 1, name: 'First'},
      ]);
    });

    it('should handle empty array', () => {
      expect(uniqBy([], (item) => item)).toEqual([]);
    });

    it('should work with complex iteratee functions', () => {
      interface Point {
        x: number;
        y: number;
      }

      const array: Point[] = [
        {x: 1, y: 2},
        {x: 2, y: 3},
        {x: 1, y: 2},
      ];

      expect(uniqBy(array, (item) => `${item.x}-${item.y}`)).toEqual([
        {x: 1, y: 2},
        {x: 2, y: 3},
      ]);
    });

    // 边界条件
    it('should handle undefined and null values in iteratee', () => {
      const array = [null, undefined, null, 1, undefined];
      expect(uniqBy(array, (item) => item)).toEqual([null, undefined, 1]);
    });
  });

  describe('uniqWith', () => {
    interface Point {
      x: number;
      y: number;
    }

    interface DeepObject {
      values: number[];
    }

    interface UserWithAccess {
      type: string;
      access: string;
    }

    interface NestedObject {
      nested: {
        deep: {
          value: number;
        };
      };
    }

    it('should deduplicate using custom comparator', () => {
      const array: Point[] = [
        {x: 1, y: 2},
        {x: 2, y: 3},
        {x: 1, y: 2},
      ];

      const comparator = (a: Point, b: Point) => a.x === b.x && a.y === b.y;
      expect(uniqWith(array, comparator)).toEqual([
        {x: 1, y: 2},
        {x: 2, y: 3},
      ]);
    });

    it('should handle deep comparison logic', () => {
      const array: DeepObject[] = [
        {values: [1, 2, 3]},
        {values: [4, 5, 6]},
        {values: [1, 2, 3]},
      ];

      const comparator = (a: DeepObject, b: DeepObject) =>
        JSON.stringify(a.values) === JSON.stringify(b.values);

      expect(uniqWith(array, comparator)).toEqual([
        {values: [1, 2, 3]},
        {values: [4, 5, 6]},
      ]);
    });

    it('should handle partial equality comparisons', () => {
      interface ItemWithIgnored {
        id: number;
        ignored: string;
      }

      const array: ItemWithIgnored[] = [
        {id: 1, ignored: 'a'},
        {id: 2, ignored: 'b'},
        {id: 1, ignored: 'c'},
      ];

      const comparator = (a: ItemWithIgnored, b: ItemWithIgnored) =>
        a.id === b.id;
      expect(uniqWith(array, comparator)).toEqual([
        {id: 1, ignored: 'a'},
        {id: 2, ignored: 'b'},
      ]);
    });

    it('should preserve order of first occurrence', () => {
      interface PrioritizedItem {
        value: string;
        priority: number;
      }

      const array: PrioritizedItem[] = [
        {value: 'second', priority: 2},
        {value: 'first', priority: 1},
        {value: 'second-dupe', priority: 2},
      ];

      const comparator = (a: PrioritizedItem, b: PrioritizedItem) =>
        a.priority === b.priority;
      expect(uniqWith(array, comparator)).toEqual([
        {value: 'second', priority: 2},
        {value: 'first', priority: 1},
      ]);
    });

    it('should handle empty array', () => {
      expect(uniqWith([], () => true)).toEqual([]);
    });

    it('should handle asymmetric comparators', () => {
      const array: UserWithAccess[] = [
        {type: 'admin', access: 'full'},
        {type: 'user', access: 'limited'},
        {type: 'admin', access: 'restricted'},
      ];

      const comparator = (a: UserWithAccess, b: UserWithAccess) =>
        a.type === b.type;
      expect(uniqWith(array, comparator)).toEqual([
        {type: 'admin', access: 'full'},
        {type: 'user', access: 'limited'},
      ]);
    });

    it('should work with complex object graphs', () => {
      const obj1: NestedObject = {nested: {deep: {value: 1}}};
      const obj2: NestedObject = {nested: {deep: {value: 2}}};
      const obj3: NestedObject = {nested: {deep: {value: 1}}};

      const comparator = (a: NestedObject, b: NestedObject) =>
        a.nested.deep.value === b.nested.deep.value;

      expect(uniqWith([obj1, obj2, obj3], comparator)).toEqual([obj1, obj2]);
    });

    // 边界条件
    it('should handle comparator that always returns false', () => {
      const array = [1, 1, 2, 2];
      const comparator = () => false;
      expect(uniqWith(array, comparator)).toEqual([1, 1, 2, 2]);
    });

    it('should handle comparator that always returns true', () => {
      const array = [1, 2, 3, 4];
      const comparator = () => true;
      expect(uniqWith(array, comparator)).toEqual([1]);
    });
  });
});

// ============================
// 边界条件测试
// ============================

describe.concurrent('Edge Cases', () => {
  it('should handle all operations on empty arrays', () => {
    expect(without([], 1)).toEqual([]);
    expect(pull([], 1)).toEqual([]);
    expect(pullAt([], [0])).toEqual([]);
    expect(remove([], () => true)).toEqual([]);
    expect(compact([])).toEqual([]);
    expect(nonNullable([])).toEqual([]);
  });

  it('should handle single element arrays', () => {
    expect(compact([0])).toEqual([]);
    expect(nonNullable([null])).toEqual([]);
  });

  it('should maintain type safety where applicable', () => {
    // compact 应该返回非 falsy 类型的数组
    const falsyArray = [0, 1, '', 'hello', false, true];
    const compacted = compact(falsyArray);

    const test: Array<string | number | boolean> = compacted;
    expect(test).toEqual([1, 'hello', true]);

    // nonNullable 应该返回 NonNullable 类型
    const nullableArray = [1, null, 'a', undefined];
    const nonNull = nonNullable(nullableArray);

    const test2: Array<number | string> = nonNull;
    expect(test2).toEqual([1, 'a']);
  });
});
