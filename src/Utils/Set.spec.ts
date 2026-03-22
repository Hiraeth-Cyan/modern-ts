// ============================================
// ./src/Utils/Set.spec.ts
// ============================================

import {describe, it, expect, vi} from 'vitest';
import {
  filter,
  map,
  reduce,
  countBy,
  groupBy,
  filterInPlace,
  unionInPlace,
  intersectInPlace,
  differenceInPlace,
  subtractInPlace,
  some,
  every,
  find,
} from './Set';

// ============================
// 测试辅助函数
// ============================
const isEven = (x: number) => x % 2 === 0;
const isString = (value: unknown): value is string => typeof value === 'string';

// ============================
// filter 测试
// ============================
describe.concurrent('filter function', () => {
  it('should filter values based on predicate', () => {
    const set = new Set([1, 2, 3, 4, 5]);
    const filtered = filter(set, isEven);

    expect(filtered.size).toBe(2);
    expect(filtered.has(2)).toBe(true);
    expect(filtered.has(4)).toBe(true);
  });

  it('should return empty set when no values match', () => {
    const set = new Set([1, 3, 5]);
    const filtered = filter(set, isEven);

    expect(filtered.size).toBe(0);
  });

  it('should work with type guard predicates', () => {
    const set = new Set([1, 'hello', 2, 'world', true]);
    const filtered = filter(set, isString);

    // 类型守卫应该只保留字符串
    expect(filtered.size).toBe(2);
    expect(filtered.has('hello')).toBe(true);
    expect(filtered.has('world')).toBe(true);
  });

  it('should throw TypeError when predicate is not a function', () => {
    const set = new Set([1, 2, 3]);
    // @ts-expect-error: 故意传递错误类型以测试运行时行为
    expect(() => filter(set, 'not a function')).toThrow(TypeError);
  });
});

// ============================
// map 测试
// ============================
describe.concurrent('map function', () => {
  it('should transform each value in the set', () => {
    const set = new Set([1, 2, 3]);
    const mapped = map(set, (x) => x * 2);

    expect(mapped.size).toBe(3);
    expect(mapped.has(2)).toBe(true);
    expect(mapped.has(4)).toBe(true);
    expect(mapped.has(6)).toBe(true);
  });

  it('should deduplicate values after transformation', () => {
    const set = new Set([-1, 1, -2, 2]);
    const mapped = map(set, Math.abs);

    expect(mapped.size).toBe(2); // 绝对值去重后只有1和2
    expect(mapped.has(1)).toBe(true);
    expect(mapped.has(2)).toBe(true);
  });

  it('should return empty set when input is empty', () => {
    const set = new Set<number>();
    const mapped = map(set, (x) => x * 2);

    expect(mapped.size).toBe(0);
  });

  it('should throw TypeError when iteratee is not a function', () => {
    const set = new Set([1, 2, 3]);
    // @ts-expect-error: 故意传递错误类型以测试运行时行为
    expect(() => map(set, 'not a function')).toThrow(TypeError);
  });
});

// ============================
// reduce 测试
// ============================
describe.concurrent('reduce function', () => {
  it('should accumulate values with initial value', () => {
    const set = new Set([1, 2, 3, 4]);
    const sum = reduce(set, (acc, value) => acc + value, 0);

    expect(sum).toBe(10);
  });

  it('should handle empty set with initial value', () => {
    const set = new Set<number>();
    const result = reduce(set, (acc, value) => acc + value, 100);

    expect(result).toBe(100); // 空集时返回初始值
  });

  it('should follow set iteration order', () => {
    const set = new Set(['a', 'b', 'c']);
    const concatenated = reduce(set, (acc, value) => acc + value, '');

    expect(concatenated).toBe('abc');
  });

  it('should work with different accumulator types', () => {
    const set = new Set([1, 2, 3]);
    const result = reduce(
      set,
      (acc, value) => {
        acc.push(value * 2);
        return acc;
      },
      [] as number[],
    );

    expect(result).toEqual([2, 4, 6]);
  });
});

// ============================
// countBy 测试
// ============================
describe.concurrent('countBy function', () => {
  it('should count occurrences by key', () => {
    const set = new Set([
      'apple',
      'banana',
      'apple',
      'orange',
      'banana',
      'apple',
    ]);
    const counts = countBy(set, (fruit) => fruit);

    expect(counts.apple).toBe(1); // Set自动去重，每个水果只出现一次
    expect(counts.banana).toBe(1);
    expect(counts.orange).toBe(1);
  });

  it('should work with numeric keys', () => {
    const set = new Set([1, 2, 3, 4, 5]);
    const counts = countBy(set, (x) => (x % 2 === 0 ? 'even' : 'odd'));

    expect(counts.even).toBe(2); // 2, 4
    expect(counts.odd).toBe(3); // 1, 3, 5
  });

  it('should return empty object for empty set', () => {
    const set = new Set<number>();
    const counts = countBy(set, (x) => x);

    expect(Object.keys(counts).length).toBe(0);
  });
});

// ============================
// groupBy 测试
// ============================
describe.concurrent('groupBy function', () => {
  it('should group values by key', () => {
    const set = new Set(['apple', 'banana', 'cherry', 'date']);
    const groups = groupBy(set, (fruit) => fruit.length);

    expect(groups.size).toBe(3);
    expect(groups.get(5)).toEqual(['apple']);
    expect(groups.get(6)).toEqual(['banana', 'cherry']);
    expect(groups.get(4)).toEqual(['date']);
  });

  it('should work with complex keys', () => {
    const set = new Set([
      {type: 'fruit', name: 'apple'},
      {type: 'fruit', name: 'banana'},
      {type: 'vegetable', name: 'carrot'},
    ]);

    const groups = groupBy(set, (item) => item.type);

    expect(groups.size).toBe(2);
    expect(groups.get('fruit')).toHaveLength(2);
    expect(groups.get('vegetable')).toHaveLength(1);
  });

  it('should return empty map for empty set', () => {
    const set = new Set<number>();
    const groups = groupBy(set, (x) => x);

    expect(groups.size).toBe(0);
  });
});

// ============================
// filterInPlace 测试
// ============================
describe.concurrent('filterInPlace function', () => {
  it('should mutate set by removing non-matching values', () => {
    const set = new Set([1, 2, 3, 4, 5]);
    const result = filterInPlace(set, isEven);

    expect(set).toBe(result); // 返回同一个引用
    expect(set.size).toBe(2);
    expect(set.has(2)).toBe(true);
    expect(set.has(4)).toBe(true);
  });

  it('should clear set when no values match', () => {
    const set = new Set([1, 3, 5]);
    filterInPlace(set, isEven);

    expect(set.size).toBe(0);
  });

  it('should not modify set when all values match', () => {
    const set = new Set([2, 4, 6]);
    const originalValues = Array.from(set);
    filterInPlace(set, isEven);

    expect(set.size).toBe(3);
    expect(Array.from(set)).toEqual(originalValues);
  });
});

// ============================
// unionInPlace 测试
// ============================
describe.concurrent('unionInPlace function', () => {
  it('should add all values from another iterable', () => {
    const set = new Set([1, 2, 3]);
    const other = [3, 4, 5]; // 3是重复的
    const result = unionInPlace(set, other);

    expect(set).toBe(result);
    expect(set.size).toBe(5);
    expect(Array.from(set).sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('should work with Set as other iterable', () => {
    const set = new Set([1, 2]);
    const otherSet = new Set([2, 3, 4]);
    unionInPlace(set, otherSet);

    expect(set.size).toBe(4);
    expect(Array.from(set).sort()).toEqual([1, 2, 3, 4]);
  });

  it('should handle empty other iterable', () => {
    const set = new Set([1, 2, 3]);
    const originalSize = set.size;
    unionInPlace(set, []);

    expect(set.size).toBe(originalSize);
  });
});

// ============================
// intersectInPlace 测试
// ============================
describe.concurrent('intersectInPlace function', () => {
  it('should keep only values present in both sets', () => {
    const set = new Set([1, 2, 3, 4]);
    const other = [2, 3, 5];
    const result = intersectInPlace(set, other);

    expect(set).toBe(result);
    expect(set.size).toBe(2);
    expect(set.has(2)).toBe(true);
    expect(set.has(3)).toBe(true);
  });

  it('should handle Set as other iterable', () => {
    const set = new Set([1, 2, 3]);
    const otherSet = new Set([2, 3, 4]);
    intersectInPlace(set, otherSet);

    expect(set.size).toBe(2);
    expect(Array.from(set).sort()).toEqual([2, 3]);
  });

  it('should clear set when no intersection', () => {
    const set = new Set([1, 2, 3]);
    intersectInPlace(set, [4, 5, 6]);

    expect(set.size).toBe(0);
  });
});

// ============================
// differenceInPlace & subtractInPlace 测试
// ============================
describe.concurrent('differenceInPlace and subtractInPlace functions', () => {
  it('should remove values present in other iterable', () => {
    const set = new Set([1, 2, 3, 4, 5]);
    const other = [2, 4, 6];
    const result = differenceInPlace(set, other);

    expect(set).toBe(result);
    expect(set.size).toBe(3);
    expect(Array.from(set).sort()).toEqual([1, 3, 5]);
  });

  it('should work with Set as other iterable', () => {
    const set = new Set([1, 2, 3]);
    const otherSet = new Set([2, 3, 4]);
    differenceInPlace(set, otherSet);

    expect(set.size).toBe(1);
    expect(set.has(1)).toBe(true);
  });

  it('should not modify set when no values to remove', () => {
    const set = new Set([1, 2, 3]);
    const originalValues = Array.from(set);
    differenceInPlace(set, [4, 5]);

    expect(set.size).toBe(3);
    expect(Array.from(set)).toEqual(originalValues);
  });

  it('subtractInPlace should be an alias of differenceInPlace', () => {
    const set1 = new Set([1, 2, 3]);
    const set2 = new Set([1, 2, 3]);
    const other = [2, 3];

    differenceInPlace(set1, other);
    subtractInPlace(set2, other);

    expect(set1).toEqual(set2);
  });
});

// ============================
// some 测试
// ============================
describe.concurrent('some function', () => {
  it('should return true when at least one value matches', () => {
    const set = new Set([1, 3, 5, 6, 7]);
    const hasEven = some(set, isEven);

    expect(hasEven).toBe(true);
  });

  it('should return false when no values match', () => {
    const set = new Set([1, 3, 5, 7]);
    const hasEven = some(set, isEven);

    expect(hasEven).toBe(false);
  });

  it('should return false for empty set', () => {
    const set = new Set<number>();
    const result = some(set, isEven);

    expect(result).toBe(false);
  });

  it('should short-circuit on first match', () => {
    const mockPredicate = vi.fn((value: number) => value === 2);
    const set = new Set([1, 2, 3, 4, 5]);

    const result = some(set, mockPredicate);

    expect(result).toBe(true);
    expect(mockPredicate).toHaveBeenCalledTimes(2); // 调用到第二个元素就停止了
  });
});

// ============================
// every 测试
// ============================
describe.concurrent('every function', () => {
  it('should return true when all values match', () => {
    const set = new Set([2, 4, 6, 8]);
    const allEven = every(set, isEven);

    expect(allEven).toBe(true);
  });

  it('should return false when at least one value does not match', () => {
    const set = new Set([2, 4, 5, 6]);
    const allEven = every(set, isEven);

    expect(allEven).toBe(false);
  });

  it('should return true for empty set', () => {
    const set = new Set<number>();
    const result = every(set, isEven);

    expect(result).toBe(true); // 空集的情况返回true
  });

  it('should short-circuit on first failure', () => {
    const mockPredicate = vi.fn((value: number) => value > 0);
    mockPredicate.mockReturnValueOnce(true);
    mockPredicate.mockReturnValueOnce(false); // 第二个元素失败

    const set = new Set([1, -1, 3, 4]);
    const result = every(set, mockPredicate);

    expect(result).toBe(false);
    expect(mockPredicate).toHaveBeenCalledTimes(2); // 调用到第二个元素就停止了
  });
});

// ============================
// find 测试
// ============================
describe.concurrent('find function', () => {
  it('should return first matching value', () => {
    const set = new Set([1, 3, 5, 6, 7, 8]);
    const firstEven = find(set, isEven);

    expect(firstEven).toBe(6); // Set的迭代顺序是插入顺序
  });

  it('should return undefined when no value matches', () => {
    const set = new Set([1, 3, 5, 7]);
    const result = find(set, isEven);

    expect(result).toBeUndefined();
  });

  it('should return undefined for empty set', () => {
    const set = new Set<number>();
    const result = find(set, isEven);

    expect(result).toBeUndefined();
  });

  it('should follow set iteration order', () => {
    const set = new Set<number>();
    set.add(1);
    set.add(2);
    set.add(3);
    set.add(4);

    const result = find(set, (x: number) => x > 1);
    expect(result).toBe(2); // 第一个大于1的元素是2
  });
});
