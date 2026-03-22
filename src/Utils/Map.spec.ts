// ============================================
// ./src/Utils/Map.spec.ts
// ============================================

import {describe, it, expect, vi} from 'vitest';
import {
  filter,
  mapValues,
  mapKeys,
  findKey,
  hasValue,
  reduce,
  countBy,
  groupBy,
  pick,
  omit,
  filterInPlace,
  mapValuesInPlace,
  omitInPlace,
  pickInPlace,
  mergeInPlace,
  getOrSetInPlace,
  updateInPlace,
} from './Map';

// ============================
// 测试辅助函数和类型
// ============================

// 类型守卫谓词函数示例
const isStringNumber = (value: unknown): value is string =>
  typeof value === 'string';

// 自定义比较函数
const deepCompare = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);

// ============================
// filter 函数测试
// ============================
describe.concurrent('filter', () => {
  it('should return map with entries satisfying predicate', () => {
    // 基础过滤：保留值大于1的条目
    const map = new Map([
      ['a', 1],
      ['b', 2],
      ['c', 3],
    ]);
    const result = filter(map, (value) => value > 1);
    expect(result.size).toBe(2);
    expect(result.get('b')).toBe(2);
    expect(result.get('c')).toBe(3);
  });

  it('should work with type guard predicate', () => {
    // 类型守卫：过滤出字符串类型的值
    const map = new Map<number, string | number>([
      [1, 'hello'],
      [2, 42],
      [3, 'world'],
    ]);
    const result = filter(map, isStringNumber);
    expect(result.size).toBe(2);
    expect(result.get(1)).toBe('hello');
    expect(result.get(3)).toBe('world');
  });

  it('should return empty map when no match', () => {
    // 无匹配元素时返回空 Map
    const map = new Map([
      ['a', 1],
      ['b', 2],
    ]);
    const result = filter(map, (value) => value > 5);
    expect(result.size).toBe(0);
  });

  it('should use key in predicate', () => {
    // 谓词函数中使用 key 参数
    const map = new Map([
      ['a', 1],
      ['b', 2],
      ['c', 3],
    ]);
    const result = filter(map, (_value, key) => key !== 'b');
    expect(result.size).toBe(2);
    expect(result.has('a')).toBe(true);
    expect(result.has('c')).toBe(true);
  });
});

// ============================
// mapValues 函数测试
// ============================
describe.concurrent('mapValues', () => {
  it('should transform values using iteratee', () => {
    // 值转换：每个值乘以2
    const map = new Map([
      ['a', 1],
      ['b', 2],
    ]);
    const result = mapValues(map, (value) => value * 2);
    expect(result.get('a')).toBe(2);
    expect(result.get('b')).toBe(4);
  });

  it('should pass key to iteratee', () => {
    // iteratee 接收 key 参数
    const map = new Map([
      ['a', 1],
      ['b', 2],
    ]);
    const result = mapValues(map, (value, key) => `${key}:${value}`);
    expect(result.get('a')).toBe('a:1');
    expect(result.get('b')).toBe('b:2');
  });

  it('should not mutate original map', () => {
    // 验证原 Map 未被修改
    const map = new Map([['a', 1]]);
    const original = new Map(map);
    mapValues(map, (value) => value * 2);
    expect(map).toEqual(original);
  });

  it('should handle complex value transformations', () => {
    // 复杂对象值转换
    const map = new Map([
      ['user1', {name: 'Alice', age: 25}],
      ['user2', {name: 'Bob', age: 30}],
    ]);
    const result = mapValues(map, (user) => ({...user, age: user.age + 1}));
    expect(result.get('user1')).toEqual({name: 'Alice', age: 26});
    expect(result.get('user2')).toEqual({name: 'Bob', age: 31});
  });
});

// ============================
// mapKeys 函数测试
// ============================
describe.concurrent('mapKeys', () => {
  it('should transform keys using iteratee', () => {
    // 键转换：数字键转为字符串前缀
    const map = new Map([
      [1, 'a'],
      [2, 'b'],
    ]);
    const result = mapKeys(map, (_value, key) => `key-${key}`);
    expect(result.get('key-1')).toBe('a');
    expect(result.get('key-2')).toBe('b');
    expect(result.size).toBe(2);
  });

  it('should overwrite duplicate keys', () => {
    // 重复键覆盖：按值奇偶分组，最后一个设置的值保留
    const map = new Map([
      ['a', 1],
      ['b', 2],
      ['c', 3],
    ]);
    const result = mapKeys(map, (value) => (value % 2 === 0 ? 'even' : 'odd'));
    expect(result.size).toBe(2);
    expect(result.get('odd')).toBe(3); // 最后遇到的 odd 是 3
    expect(result.get('even')).toBe(2);
  });

  it('should pass value to iteratee', () => {
    // iteratee 接收 value 参数
    const map = new Map([
      [1, 'apple'],
      [2, 'banana'],
    ]);
    const result = mapKeys(map, (value) => value.length);
    expect(result.get(5)).toBe('apple');
    expect(result.get(6)).toBe('banana');
  });
});

// ============================
// findKey 函数测试
// ============================
describe.concurrent('findKey', () => {
  it('should return first key matching predicate', () => {
    // 查找第一个值大于1的键
    const map = new Map([
      ['a', 1],
      ['b', 2],
      ['c', 3],
    ]);
    const result = findKey(map, (value) => value > 1);
    expect(result).toBe('b');
  });

  it('should return undefined when no match', () => {
    // 无匹配时返回 undefined
    const map = new Map([
      ['a', 1],
      ['b', 2],
    ]);
    const result = findKey(map, (value) => value > 5);
    expect(result).toBeUndefined();
  });

  it('should search in insertion order', () => {
    // 按插入顺序查找，返回第一个匹配的键
    const map = new Map([
      ['first', 1],
      ['second', 2],
      ['third', 1],
    ]);
    const result = findKey(map, (value) => value === 1);
    expect(result).toBe('first');
  });

  it('should use both value and key in predicate', () => {
    // 谓词同时使用值和键
    const map = new Map([
      ['a', 1],
      ['b', 2],
      ['c', 3],
    ]);
    const result = findKey(map, (value, key) => key === 'b' && value === 2);
    expect(result).toBe('b');
  });
});

// ============================
// hasValue 函数测试
// ============================
describe.concurrent('hasValue', () => {
  it('should return true when value exists', () => {
    // 值存在时返回 true
    const map = new Map([
      ['a', 1],
      ['b', 2],
    ]);
    expect(hasValue(map, 2)).toBe(true);
  });

  it('should return false when value does not exist', () => {
    // 值不存在时返回 false
    const map = new Map([
      ['a', 1],
      ['b', 2],
    ]);
    expect(hasValue(map, 5)).toBe(false);
  });

  it('should use custom comparator', () => {
    // 自定义比较器：包括基本类型和深度比较
    const map = new Map([
      ['a', {id: 1, name: 'Alice'}],
      ['b', {id: 2, name: 'Bob'}],
    ]);
    const target = {id: 1, name: 'Alice'};
    // 深度比较
    expect(hasValue(map, target, deepCompare)).toBe(true);
    // 基本类型比较器（合并原“原始比较器”测试）
    const simpleMap = new Map([
      ['a', 1],
      ['b', 2],
    ]);
    expect(hasValue(simpleMap, 2, (a, b) => a === b)).toBe(true);
  });
}); // 合并了原始比较器测试到自定义比较器测试中

// ============================
// reduce 函数测试
// ============================
describe.concurrent('reduce', () => {
  it('should reduce map to a single value', () => {
    // 求和归约
    const map = new Map([
      ['a', 1],
      ['b', 2],
      ['c', 3],
    ]);
    const result = reduce(map, (sum, value) => sum + value, 0);
    expect(result).toBe(6);
  });

  it('should iterate in insertion order', () => {
    // 按插入顺序归约
    const map = new Map([
      ['first', 1],
      ['second', 2],
      ['third', 3],
    ]);
    const result = reduce(
      map,
      (str, value, key) => `${str}${key}:${value},`,
      '',
    );
    expect(result).toBe('first:1,second:2,third:3,');
  });

  it('should handle complex accumulator', () => {
    // 复杂累加器类型
    const map = new Map([
      ['a', {count: 1}],
      ['b', {count: 2}],
    ]);
    const result = reduce(
      map,
      (acc, value) => ({
        total: acc.total + value.count,
        items: [...acc.items, value],
      }),
      {total: 0, items: [] as Array<{count: number}>},
    );
    expect(result.total).toBe(3);
    expect(result.items).toHaveLength(2);
  });

  it('should use key in iteratee', () => {
    // iteratee 使用 key 参数
    const map = new Map([
      ['a', 1],
      ['b', 2],
    ]);
    const result = reduce(
      map,
      (obj, value, key) => {
        obj[key] = value;
        return obj;
      },
      {} as Record<string, number>,
    );
    expect(result).toEqual({a: 1, b: 2});
  });
});

// ============================
// countBy 函数测试
// ============================
describe.concurrent('countBy', () => {
  it('should count occurrences by grouping key', () => {
    // 合并数字分组和字符串分组测试
    // 数字分组
    const numMap = new Map([
      ['a', 1],
      ['b', 2],
      ['c', 1],
      ['d', 3],
      ['e', 2],
    ]);
    const numResult = countBy(numMap, (value) => value);
    expect(numResult).toEqual({1: 2, 2: 2, 3: 1});

    // 字符串分组
    const strMap = new Map([
      ['a', 'apple'],
      ['b', 'banana'],
      ['c', 'apple'],
      ['d', 'cherry'],
    ]);
    const strResult = countBy(strMap, (value) => value);
    expect(strResult).toEqual({apple: 2, banana: 1, cherry: 1});
  }); // 合并了数字和字符串分组的测试

  it('should use key in iteratee', () => {
    // iteratee 使用 key 参数
    const map = new Map([
      ['first_a', 'apple'],
      ['second_b', 'banana'],
      ['third_a', 'apple'],
    ]);
    const result = countBy(map, (_value, key) => key.split('_')[1]);
    expect(result).toEqual({a: 2, b: 1});
  });
});

// ============================
// groupBy 函数测试
// ============================
describe.concurrent('groupBy', () => {
  it('should group entries by key', () => {
    // 合并基本分组和复杂对象分组
    // 基本数字分组
    const numMap = new Map([
      ['a', 1],
      ['b', 2],
      ['c', 1],
    ]);
    const numResult = groupBy(numMap, (value) => value);
    expect(numResult.size).toBe(2);
    expect(numResult.get(1)).toEqual([
      ['a', 1],
      ['c', 1],
    ]);
    expect(numResult.get(2)).toEqual([['b', 2]]);

    // 复杂对象分组（保留原始键值对）
    const objMap = new Map([
      ['user1', {name: 'Alice', age: 25}],
      ['user2', {name: 'Bob', age: 30}],
      ['user3', {name: 'Alice', age: 28}],
    ]);
    const objResult = groupBy(objMap, (user) => user.name);
    const aliceGroup = objResult.get('Alice');
    expect(aliceGroup).toHaveLength(2);
    expect(aliceGroup?.[0]).toEqual(['user1', {name: 'Alice', age: 25}]);
    expect(aliceGroup?.[1]).toEqual(['user3', {name: 'Alice', age: 28}]);
  }); // 合并了基本分组和保留原始键值对的测试

  it('should handle complex grouping key', () => {
    // 复杂分组键（组合字符串）
    const map = new Map([
      [1, {category: 'A', active: true}],
      [2, {category: 'B', active: true}],
      [3, {category: 'A', active: false}],
    ]);
    const result = groupBy(map, (item) => `${item.category}-${item.active}`);
    expect(result.size).toBe(3);
    expect(result.get('A-true')).toHaveLength(1);
    expect(result.get('B-true')).toHaveLength(1);
    expect(result.get('A-false')).toHaveLength(1);
  });
});

// ============================
// pick 函数测试
// ============================
describe.concurrent('pick', () => {
  it('should return map with only specified keys', () => {
    // 选取指定键
    const map = new Map([
      ['a', 1],
      ['b', 2],
      ['c', 3],
      ['d', 4],
    ]);
    const result = pick(map, ['a', 'c', 'e']);
    expect(result.size).toBe(2);
    expect(result.get('a')).toBe(1);
    expect(result.get('c')).toBe(3);
    expect(result.has('e')).toBe(false);
  });

  it('should return empty map when no keys match', () => {
    // 无匹配键时返回空 Map
    const map = new Map([
      ['a', 1],
      ['b', 2],
    ]);
    const result = pick(map, ['c', 'd']);
    expect(result.size).toBe(0);
  });

  it('should not mutate original map', () => {
    // 不修改原 Map
    const map = new Map([
      ['a', 1],
      ['b', 2],
    ]);
    const original = new Map(map);
    pick(map, ['a']);
    expect(map).toEqual(original);
  });

  it('should handle Set as keys parameter', () => {
    // 处理 Set 类型的键集合
    const map = new Map([
      ['a', 1],
      ['b', 2],
      ['c', 3],
    ]);
    const keys = new Set(['a', 'c']);
    const result = pick(map, keys);
    expect(result.size).toBe(2);
    expect(result.get('a')).toBe(1);
    expect(result.get('c')).toBe(3);
  });
});

// ============================
// omit 函数测试
// ============================
describe.concurrent('omit', () => {
  it('should return map without specified keys', () => {
    // 省略指定键
    const map = new Map([
      ['a', 1],
      ['b', 2],
      ['c', 3],
    ]);
    const result = omit(map, ['b']);
    expect(result.size).toBe(2);
    expect(result.get('a')).toBe(1);
    expect(result.get('c')).toBe(3);
    expect(result.has('b')).toBe(false);
  });

  it('should handle non-existent keys', () => {
    // 处理不存在的键（忽略）
    const map = new Map([
      ['a', 1],
      ['b', 2],
    ]);
    const result = omit(map, ['c', 'd']);
    expect(result.size).toBe(2);
    expect(result.get('a')).toBe(1);
    expect(result.get('b')).toBe(2);
  });

  it('should not mutate original map', () => {
    // 不修改原 Map
    const map = new Map([
      ['a', 1],
      ['b', 2],
    ]);
    const original = new Map(map);
    omit(map, ['a']);
    expect(map).toEqual(original);
  });

  it('should handle Set as keys parameter', () => {
    // 处理 Set 类型的键集合
    const map = new Map([
      ['a', 1],
      ['b', 2],
      ['c', 3],
      ['d', 4],
    ]);
    const keys = new Set(['b', 'd']);
    const result = omit(map, keys);
    expect(result.size).toBe(2);
    expect(result.has('a')).toBe(true);
    expect(result.has('c')).toBe(true);
  });
});

// ============================
// filterInPlace 函数测试
// ============================
describe.concurrent('filterInPlace', () => {
  it('should filter map in place', () => {
    // 原地过滤，保留值大于1的条目
    const map = new Map([
      ['a', 1],
      ['b', 2],
      ['c', 3],
    ]);
    const result = filterInPlace(map, (value) => value > 1);
    expect(result).toBe(map);
    expect(map.size).toBe(2);
    expect(map.get('b')).toBe(2);
    expect(map.get('c')).toBe(3);
  });

  it('should remove all elements when none match', () => {
    // 无匹配元素时清空 Map
    const map = new Map([
      ['a', 1],
      ['b', 2],
    ]);
    filterInPlace(map, (value) => value > 5);
    expect(map.size).toBe(0);
  });

  it('should use key in predicate', () => {
    // 谓词使用 key 参数
    const map = new Map([
      ['keep', 1],
      ['remove', 2],
    ]);
    filterInPlace(map, (_value, key) => key === 'keep');
    expect(map.size).toBe(1);
    expect(map.get('keep')).toBe(1);
  });
});

// ============================
// mapValuesInPlace 函数测试
// ============================
describe.concurrent('mapValuesInPlace', () => {
  it('should transform values in place', () => {
    // 原地值转换：每个值乘以2
    const map = new Map([
      ['a', 1],
      ['b', 2],
    ]);
    const result = mapValuesInPlace(map, (value) => value * 2);
    expect(result).toBe(map);
    expect(map.get('a')).toBe(2);
    expect(map.get('b')).toBe(4);
  });

  it('should pass key to iteratee', () => {
    // iteratee 接收 key 参数
    const map = new Map([
      ['a', 1],
      ['b', 2],
    ]);
    mapValuesInPlace(map, (value, key) => value + key.charCodeAt(0));
    expect(map.get('a')).toBe(1 + 97);
    expect(map.get('b')).toBe(2 + 98);
  });

  it('should handle complex transformations', () => {
    // 复杂对象值转换
    const map = new Map([
      ['a', {count: 1}],
      ['b', {count: 2}],
    ]);
    mapValuesInPlace(map, (value) => ({...value, count: value.count + 1}));
    expect(map.get('a')).toEqual({count: 2});
    expect(map.get('b')).toEqual({count: 3});
  });
});

// ============================
// omitInPlace 函数测试
// ============================
describe.concurrent('omitInPlace', () => {
  it('should remove specified keys in place', () => {
    // 原地移除指定键
    const map = new Map([
      ['a', 1],
      ['b', 2],
      ['c', 3],
    ]);
    const result = omitInPlace(map, ['b', 'd']);
    expect(result).toBe(map);
    expect(map.size).toBe(2);
    expect(map.has('a')).toBe(true);
    expect(map.has('c')).toBe(true);
    expect(map.has('b')).toBe(false);
  });

  it('should handle empty keys array', () => {
    // 空键数组，Map 不变
    const map = new Map([
      ['a', 1],
      ['b', 2],
    ]);
    omitInPlace(map, []);
    expect(map.size).toBe(2);
  });

  it('should handle Set as keys parameter', () => {
    // 处理 Set 类型的键集合
    const map = new Map([
      ['a', 1],
      ['b', 2],
      ['c', 3],
    ]);
    const keys = new Set(['a', 'c']);
    omitInPlace(map, keys);
    expect(map.size).toBe(1);
    expect(map.has('b')).toBe(true);
  });
});

// ============================
// pickInPlace 函数测试
// ============================
describe.concurrent('pickInPlace', () => {
  it('should keep only specified keys in place', () => {
    // 原地保留指定键
    const map = new Map([
      ['a', 1],
      ['b', 2],
      ['c', 3],
      ['d', 4],
    ]);
    const result = pickInPlace(map, ['a', 'c', 'e']);
    expect(result).toBe(map);
    expect(map.size).toBe(2);
    expect(map.get('a')).toBe(1);
    expect(map.get('c')).toBe(3);
  });

  it('should handle non-existent keys', () => {
    // 没有键匹配时清空 Map
    const map = new Map([
      ['a', 1],
      ['b', 2],
    ]);
    pickInPlace(map, ['c']);
    expect(map.size).toBe(0);
  });

  it('should handle Set as keys parameter', () => {
    // 处理 Set 类型的键集合
    const map = new Map([
      ['a', 1],
      ['b', 2],
      ['c', 3],
    ]);
    const keys = new Set(['a', 'b']);
    pickInPlace(map, keys);
    expect(map.size).toBe(2);
    expect(map.has('a')).toBe(true);
    expect(map.has('b')).toBe(true);
  });
});

// ============================
// mergeInPlace 函数测试
// ============================
describe.concurrent('mergeInPlace', () => {
  it('should merge source into target', () => {
    // 合并源 Map 到目标 Map，默认覆盖
    const target = new Map([
      ['a', 1],
      ['b', 2],
    ]);
    const source = new Map([
      ['b', 20],
      ['c', 3],
    ]);
    const result = mergeInPlace(target, source);
    expect(result).toBe(target);
    expect(target.size).toBe(3);
    expect(target.get('a')).toBe(1);
    expect(target.get('b')).toBe(20); // 被覆盖
    expect(target.get('c')).toBe(3);
  });

  it('should use custom conflict resolver', () => {
    // 自定义冲突解决函数
    const target = new Map([
      ['a', 1],
      ['b', 2],
    ]);
    const source = new Map([
      ['b', 20],
      ['c', 3],
    ]);
    mergeInPlace(
      target,
      source,
      (targetVal, sourceVal) => targetVal + sourceVal,
    );
    expect(target.get('b')).toBe(22); // 2 + 20
  });

  it('should not mutate source map', () => {
    // 不修改源 Map
    const target = new Map([['a', 1]]);
    const source = new Map([['b', 2]]);
    const sourceCopy = new Map(source);
    mergeInPlace(target, source);
    expect(source).toEqual(sourceCopy);
  });

  it('should handle empty source map', () => {
    // 空源 Map，目标 Map 不变
    const target = new Map([
      ['a', 1],
      ['b', 2],
    ]);
    const original = new Map(target);
    mergeInPlace(target, new Map());
    expect(target).toEqual(original);
  });
});

// ============================
// getOrSetInPlace 函数测试
// ============================
describe.concurrent('getOrSetInPlace', () => {
  it('should return existing value', () => {
    // 键存在时返回现有值，不调用工厂
    const map = new Map([['a', 1]]);
    const factory = vi.fn(() => 100);
    const result = getOrSetInPlace(map, 'a', factory);
    expect(result).toBe(1);
    expect(factory).not.toHaveBeenCalled();
  });

  it('should set and return new value when key missing', () => {
    // 键不存在时调用工厂设置新值，并传递 key 参数（合并原“传递key”测试）
    const map = new Map([['a', 1]]);
    const factory = vi.fn((key: string) => key.length * 10);
    const result = getOrSetInPlace(map, 'hello', factory);
    expect(result).toBe(50); // 'hello'.length * 10
    expect(factory).toHaveBeenCalledWith('hello');
    expect(map.get('hello')).toBe(50);
    expect(map.size).toBe(2);
  });

  it('should handle complex factory function', () => {
    // 复杂工厂函数返回对象
    const map = new Map<string, {id: string; data: number}>();
    const result = getOrSetInPlace(map, 'user1', (key) => ({id: key, data: 0}));
    expect(result).toEqual({id: 'user1', data: 0});
    expect(map.get('user1')).toEqual({id: 'user1', data: 0});
  });
});

// ============================
// updateInPlace 函数测试
// ============================
describe.concurrent('updateInPlace', () => {
  it('should update existing value with updater', () => {
    // 更新已存在的值，并验证 key 被传递（合并原“传递key”测试）
    const map = new Map([['a', 1]]);
    const updater = vi.fn(
      (value: number | undefined, key: string) => (value ?? 0) + key.length,
    );
    const result = updateInPlace(map, 'a', updater);
    expect(result).toBe(map);
    expect(map.get('a')).toBe(1 + 1); // 'a'.length = 1
    expect(updater).toHaveBeenCalledWith(1, 'a');
  });
  it('should set new value when key missing', () => {
    // 键不存在时设置新值，并验证 updater 接收 undefined 和 key（合并原“传递undefined”测试）
    const map = new Map([['a', 1]]);
    const updater = vi.fn(
      (value: number | undefined, key: string) => value || key.length,
    );
    updateInPlace(map, 'b', updater);
    expect(map.get('b')).toBe(1); // 'b'.length = 1
    expect(updater).toHaveBeenCalledWith(undefined, 'b');
    expect(map.size).toBe(2);
  });

  it('should handle setting undefined as value', () => {
    // 允许设置 undefined 作为值
    const map = new Map<string, number | undefined>([['a', 1]]);
    updateInPlace(map, 'b', () => undefined);
    expect(map.get('b')).toBeUndefined();
    expect(map.has('b')).toBe(true);
  });
});
