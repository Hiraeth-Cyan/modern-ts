// ========================================
// ./src/Utils/Array/grouping.spec.ts
// ========================================

import {describe, it, expect} from 'vitest';
import {chunk, countBy, groupBy, keyBy, partition} from './grouping';

// ============================
// 测试辅助数据
// ============================
interface User {
  id: number;
  name: string;
  age: number;
  department: string;
}

const sampleUsers: User[] = [
  {id: 1, name: 'Alice', age: 25, department: 'Engineering'},
  {id: 2, name: 'Bob', age: 30, department: 'Engineering'},
  {id: 3, name: 'Charlie', age: 25, department: 'Marketing'},
  {id: 4, name: 'David', age: 30, department: 'Marketing'},
  {id: 5, name: 'Eve', age: 35, department: 'Engineering'},
];

// ============================
// groupBy 测试
// ============================
describe.concurrent('groupBy', () => {
  it('should group items by string key', () => {
    const result = groupBy(sampleUsers, (user) => user.department);

    expect(result).toEqual({
      Engineering: [
        {id: 1, name: 'Alice', age: 25, department: 'Engineering'},
        {id: 2, name: 'Bob', age: 30, department: 'Engineering'},
        {id: 5, name: 'Eve', age: 35, department: 'Engineering'},
      ],
      Marketing: [
        {id: 3, name: 'Charlie', age: 25, department: 'Marketing'},
        {id: 4, name: 'David', age: 30, department: 'Marketing'},
      ],
    });
  });

  it('should group items by numeric key', () => {
    const result = groupBy(sampleUsers, (user) => user.age);

    expect(result).toEqual({
      25: [
        {id: 1, name: 'Alice', age: 25, department: 'Engineering'},
        {id: 3, name: 'Charlie', age: 25, department: 'Marketing'},
      ],
      30: [
        {id: 2, name: 'Bob', age: 30, department: 'Engineering'},
        {id: 4, name: 'David', age: 30, department: 'Marketing'},
      ],
      35: [{id: 5, name: 'Eve', age: 35, department: 'Engineering'}],
    });
  });

  it('should group items by boolean key', () => {
    const users = [
      {id: 1, isAdmin: true},
      {id: 2, isAdmin: false},
      {id: 3, isAdmin: true},
    ];

    const result = groupBy(users, (user) => user.isAdmin);

    expect(result).toEqual({
      true: [
        {id: 1, isAdmin: true},
        {id: 3, isAdmin: true},
      ],
      false: [{id: 2, isAdmin: false}],
    });
  });

  it('should merge keys that stringify to the same value', () => {
    const items = [
      {key: '1', value: 'A'},
      {key: 1, value: 'B'}, // 数字1会字符串化为'1'
      {key: true, value: 'C'}, // true会字符串化为'true'
    ];

    const result = groupBy(items, (item) => item.key);

    expect(result).toEqual({
      '1': [
        {key: '1', value: 'A'},
        {key: 1, value: 'B'},
      ],
      true: [{key: true, value: 'C'}],
    });
  });

  it('should return empty object for empty array', () => {
    const result = groupBy(
      [],
      (item) => (item as {key: string | number | boolean}).key,
    );
    expect(result).toEqual({});
  });

  it('should preserve original order within groups', () => {
    const items = [
      {id: 1, group: 'A'},
      {id: 2, group: 'B'},
      {id: 3, group: 'A'},
      {id: 4, group: 'B'},
    ];

    const result = groupBy(items, (item) => item.group);

    expect(result.A).toEqual([
      {id: 1, group: 'A'},
      {id: 3, group: 'A'},
    ]);
    expect(result.B).toEqual([
      {id: 2, group: 'B'},
      {id: 4, group: 'B'},
    ]);
  });
});

// ============================
// keyBy 测试
// ============================
describe.concurrent('keyBy', () => {
  it('should create lookup by string key', () => {
    const result = keyBy(sampleUsers, (user) => user.name);

    expect(result).toEqual({
      Alice: {id: 1, name: 'Alice', age: 25, department: 'Engineering'},
      Bob: {id: 2, name: 'Bob', age: 30, department: 'Engineering'},
      Charlie: {id: 3, name: 'Charlie', age: 25, department: 'Marketing'},
      David: {id: 4, name: 'David', age: 30, department: 'Marketing'},
      Eve: {id: 5, name: 'Eve', age: 35, department: 'Engineering'},
    });
  });

  it('should create lookup by numeric key', () => {
    const result = keyBy(sampleUsers, (user) => user.id);

    expect(result).toEqual({
      1: {id: 1, name: 'Alice', age: 25, department: 'Engineering'},
      2: {id: 2, name: 'Bob', age: 30, department: 'Engineering'},
      3: {id: 3, name: 'Charlie', age: 25, department: 'Marketing'},
      4: {id: 4, name: 'David', age: 30, department: 'Marketing'},
      5: {id: 5, name: 'Eve', age: 35, department: 'Engineering'},
    });
  });

  it('should use last item for duplicate keys', () => {
    const items = [
      {id: 1, version: 'v1'},
      {id: 1, version: 'v2'}, // 相同id，这个会覆盖上一个
      {id: 2, version: 'v1'},
      {id: 2, version: 'v2'}, // 相同id，这个会覆盖上一个
    ];

    const result = keyBy(items, (item) => item.id);

    expect(result).toEqual({
      1: {id: 1, version: 'v2'},
      2: {id: 2, version: 'v2'},
    });
  });

  it('should merge keys that stringify to the same value', () => {
    const items = [
      {key: '1', value: 'First'},
      {key: 1, value: 'Second'}, // 会覆盖'1'
      {key: true, value: 'Third'},
    ];

    const result = keyBy(items, (item) => item.key);

    expect(result).toEqual({
      '1': {key: 1, value: 'Second'}, // 注意这里值是数字1的对象
      true: {key: true, value: 'Third'},
    });
  });

  it('should return empty object for empty array', () => {
    const result = keyBy(
      [],
      (item) => (item as {key: string | number | boolean}).key,
    );
    expect(result).toEqual({});
  });

  it('should handle complex key getter functions', () => {
    const items = [
      {category: 'A', subcategory: 'X'},
      {category: 'A', subcategory: 'Y'},
      {category: 'B', subcategory: 'X'},
    ];

    const result = keyBy(
      items,
      (item) => `${item.category}-${item.subcategory}`,
    );

    expect(result).toEqual({
      'A-X': {category: 'A', subcategory: 'X'},
      'A-Y': {category: 'A', subcategory: 'Y'},
      'B-X': {category: 'B', subcategory: 'X'},
    });
  });
});

// ============================
// partition 测试
// ============================
describe.concurrent('partition', () => {
  it('should partition items based on predicate', () => {
    const result = partition(
      sampleUsers,
      (user) => user.department === 'Engineering',
    );

    expect(result).toEqual([
      [
        {id: 1, name: 'Alice', age: 25, department: 'Engineering'},
        {id: 2, name: 'Bob', age: 30, department: 'Engineering'},
        {id: 5, name: 'Eve', age: 35, department: 'Engineering'},
      ],
      [
        {id: 3, name: 'Charlie', age: 25, department: 'Marketing'},
        {id: 4, name: 'David', age: 30, department: 'Marketing'},
      ],
    ]);
  });

  it('should return empty arrays for empty input', () => {
    const result = partition([], (item) => (item as {test: boolean}).test);
    expect(result).toEqual([[], []]);
  });

  it('should return all items in first array when predicate always true', () => {
    const items = [1, 2, 3, 4];
    const result = partition(items, () => true);
    expect(result).toEqual([[1, 2, 3, 4], []]);
  });

  it('should return all items in second array when predicate always false', () => {
    const items = [1, 2, 3, 4];
    const result = partition(items, () => false);
    expect(result).toEqual([[], [1, 2, 3, 4]]);
  });

  it('should preserve original order in both partitions', () => {
    const items = [1, 2, 3, 4, 5, 6];
    const result = partition(items, (n) => n % 2 === 0);
    expect(result).toEqual([
      [2, 4, 6],
      [1, 3, 5],
    ]);
  });

  it('should handle complex predicate logic', () => {
    const items = [{value: 10}, {value: 20}, {value: 30}, {value: 40}];

    const result = partition(items, (item) => item.value >= 25);

    expect(result).toEqual([
      [{value: 30}, {value: 40}],
      [{value: 10}, {value: 20}],
    ]);
  });

  it('should handle mixed truthy/falsy predicate returns', () => {
    const items = [0, 1, '', 'hello', null, undefined, {}, []];

    const result = partition(items, (item) => !!item);

    // 注意: 0, '', null, undefined 会被判定为falsy
    expect(result[0]).toEqual([1, 'hello', {}, []]);
    expect(result[1]).toEqual([0, '', null, undefined]);
  });
});

// ============================
// countBy 函数测试
// ============================
describe.concurrent('countBy', () => {
  it('should return empty object for empty array', () => {
    const result = countBy([], (item) => item);
    expect(result).toEqual({});
  });

  it('should count occurrences by string keys', () => {
    const animals = ['cat', 'dog', 'cat', 'bird', 'dog', 'dog'];
    const result = countBy(animals, (animal) => animal);

    expect(result).toEqual({
      cat: 2,
      dog: 3,
      bird: 1,
    });
  });

  it('should count occurrences by numeric keys', () => {
    const numbers = [1, 2, 3, 1, 2, 1];
    const result = countBy(numbers, (num) => num);

    expect(result).toEqual({
      1: 3,
      2: 2,
      3: 1,
    });
  });

  it('should count occurrences by computed keys', () => {
    const people = [
      {name: 'Alice', age: 25},
      {name: 'Bob', age: 30},
      {name: 'Charlie', age: 25},
      {name: 'David', age: 30},
      {name: 'Eve', age: 25},
    ];

    const result = countBy(people, (person) => person.age);

    expect(result).toEqual({
      25: 3,
      30: 2,
    });
  });

  it('should handle keys with different types but same string representation', () => {
    const items = [42, '42', {toString: () => '42'}];
    const result = countBy(items, (item) => {
      if (typeof item === 'object') return item.toString();
      return item.toString();
    });

    expect(result).toEqual({
      42: 3,
    });
  });
});

// ============================
// chunk 函数测试
// ============================
describe.concurrent('chunk', () => {
  describe('basic functionality', () => {
    it('should split array into chunks of specified size', () => {
      expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
      expect(chunk([1, 2, 3, 4, 5, 6], 3)).toEqual([
        [1, 2, 3],
        [4, 5, 6],
      ]);
    });

    it('should handle chunk size larger than array length', () => {
      expect(chunk([1, 2, 3], 5)).toEqual([[1, 2, 3]]);
    });

    it('should handle exact division', () => {
      expect(chunk([1, 2, 3, 4], 2)).toEqual([
        [1, 2],
        [3, 4],
      ]);
    });
  });

  describe('edge cases', () => {
    it('should return empty array for empty input array', () => {
      expect(chunk([], 2)).toEqual([]);
      expect(chunk([])).toEqual([]);
    });

    it('should return empty array when chunk size is 0', () => {
      expect(chunk([1, 2, 3], 0)).toEqual([]);
      expect(chunk([], 0)).toEqual([]);
    });

    it('should treat negative size as zero', () => {
      expect(chunk([1, 2, 3], -1)).toEqual([]);
      expect(chunk([1, 2, 3], -10)).toEqual([]);
    });

    it('should handle single element arrays', () => {
      expect(chunk([42], 2)).toEqual([[42]]);
      expect(chunk([42], 1)).toEqual([[42]]);
    });
  });

  describe('default behavior', () => {
    it('should use default chunk size of 1 when no size provided', () => {
      expect(chunk([1, 2, 3])).toEqual([[1], [2], [3]]);
      expect(chunk([])).toEqual([]);
    });

    it('should use default chunk size when size is undefined', () => {
      expect(chunk([1, 2, 3], undefined)).toEqual([[1], [2], [3]]);
    });
  });

  describe('type preservation', () => {
    it('should preserve types in chunks', () => {
      const stringArray = ['a', 'b', 'c', 'd'];
      const result = chunk(stringArray, 2);
      expect(result).toEqual([
        ['a', 'b'],
        ['c', 'd'],
      ]);
      expect(result[0][0]).toBe('a');
    });

    it('should handle mixed types', () => {
      const mixed = [1, 'two', {three: 3}, [4]];
      const result = chunk(mixed, 2);
      expect(result).toEqual([
        [1, 'two'],
        [{three: 3}, [4]],
      ]);
    });
  });

  describe('non-integer size handling', () => {
    it('should floor non-integer sizes', () => {
      expect(chunk([1, 2, 3, 4, 5], 2.1)).toEqual([[1, 2], [3, 4], [5]]);
      expect(chunk([1, 2, 3, 4, 5], 2.9)).toEqual([[1, 2], [3, 4], [5]]);
    });

    it('should handle size of 0.5 as 0 (after flooring)', () => {
      expect(chunk([1, 2, 3], 0.5)).toEqual([]);
    });
  });

  describe('immutability', () => {
    it('should not modify the original array', () => {
      const original = [1, 2, 3, 4, 5];
      const copy = [...original];
      chunk(original, 2);
      expect(original).toEqual(copy);
    });

    it('should return new array references', () => {
      const original = [1, 2, 3];
      const result = chunk(original, 1);
      expect(result[0]).not.toBe(original); // Different reference
      expect(result[0][0]).toBe(original[0]); // Same primitive value
    });
  });
});
