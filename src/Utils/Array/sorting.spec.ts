// ========================================
// ./src/Utils/Array/sorting.spec.ts
// ========================================

import {describe, it, expect} from 'vitest';
import {
  coreSort,
  orderBy,
  orderByInplace,
  sortBy,
  sortByInplace,
  type Iteratee,
  type Order,
} from './sorting';

// ============================
// 测试数据
// ============================
interface User {
  id: number;
  name: string;
  age: number;
  active: boolean;
  joinDate: Date;
}

const users: User[] = [
  {
    id: 3,
    name: 'Charlie',
    age: 30,
    active: false,
    joinDate: new Date('2022-03-01'),
  },
  {
    id: 1,
    name: 'Alice',
    age: 25,
    active: true,
    joinDate: new Date('2023-01-01'),
  },
  {
    id: 4,
    name: 'David',
    age: 35,
    active: true,
    joinDate: new Date('2021-06-01'),
  },
  {
    id: 2,
    name: 'Bob',
    age: 25,
    active: false,
    joinDate: new Date('2022-12-01'),
  },
  {id: 5, name: 'Eve', age: 30, active: true, joinDate: new Date('2021-01-01')},
];

// ============================
// coreSort 核心功能测试
// ============================
describe.concurrent('Core Sorting Function (coreSort)', () => {
  describe('Basic Sorting', () => {
    it('should sort by single field in ascending order', () => {
      // 准备测试数据
      const array = [...users];
      const iteratees: Array<Iteratee<User>> = [(user) => user.name];
      const orders: Array<Order> = ['asc'];

      // 执行排序
      const result = coreSort(array, iteratees, orders, false);

      // 验证结果
      expect(result[0].name).toBe('Alice');
      expect(result[1].name).toBe('Bob');
      expect(result[2].name).toBe('Charlie');
      expect(result[3].name).toBe('David');
      expect(result[4].name).toBe('Eve');
    });

    it('should sort by single field in descending order', () => {
      // 准备测试数据
      const array = [...users];
      const iteratees: Array<Iteratee<User>> = [(user) => user.age];
      const orders: Array<Order> = ['desc'];

      // 执行排序
      const result = coreSort(array, iteratees, orders, false);

      // 验证结果：年龄从大到小
      expect(result[0].age).toBe(35); // David
      expect(result[1].age).toBe(30); // Charlie 或 Eve
      expect(result[2].age).toBe(30);
      expect(result[3].age).toBe(25); // Alice 或 Bob
      expect(result[4].age).toBe(25);
    });
  });

  describe('Multi-field Sorting', () => {
    it('should sort by multiple fields with different orders', () => {
      // 准备测试数据
      const array = [...users];
      const iteratees: Array<Iteratee<User>> = [
        (user) => user.age, // 第一排序字段：年龄
        (user) => user.name, // 第二排序字段：姓名
      ];
      const orders: Array<Order> = ['asc', 'desc']; // 年龄升序，姓名降序

      // 执行排序
      const result = coreSort(array, iteratees, orders, false);

      // 验证结果：年龄相同的按姓名降序排列
      const age25Users = result.filter((user) => user.age === 25);
      const age30Users = result.filter((user) => user.age === 30);

      // 年龄为25的用户：Bob 应该在 Alice 前面（姓名降序：B > A）
      expect(age25Users[0].name).toBe('Bob');
      expect(age25Users[1].name).toBe('Alice');

      // 年龄为30的用户：Eve 应该在 Charlie 前面（姓名降序：E > C）
      expect(age30Users[0].name).toBe('Eve');
      expect(age30Users[1].name).toBe('Charlie');

      // David 年龄最大（35）应该在最后
      expect(result[4].age).toBe(35);
      expect(result[4].name).toBe('David');
    });

    it('should handle ties correctly with multiple fields', () => {
      // 准备测试数据：故意创建有相同年龄和状态的数据
      const testData = [
        {age: 25, active: true, name: 'B'},
        {age: 25, active: false, name: 'D'},
        {age: 25, active: true, name: 'A'},
        {age: 30, active: false, name: 'C'},
      ];

      const iteratees: Array<Iteratee<(typeof testData)[0]>> = [
        (item) => item.age,
        (item) => item.active,
      ];
      const orders: Array<Order> = ['asc', 'desc'];

      // 执行排序
      const result = coreSort(testData, iteratees, orders, false);

      // 验证结果：先按年龄升序，再按 active 降序（true > false）
      expect(result[0].age).toBe(25);
      expect(result[0].active).toBe(true);
      expect(result[0].name).toBe('B'); // 由于 active 相同，保持原顺序

      expect(result[1].age).toBe(25);
      expect(result[1].active).toBe(true);
      expect(result[1].name).toBe('A');

      expect(result[2].age).toBe(25);
      expect(result[2].active).toBe(false);
      expect(result[2].name).toBe('D');

      expect(result[3].age).toBe(30);
    });
  });

  describe('Date Sorting', () => {
    it('should sort Date objects correctly', () => {
      // 准备测试数据
      const array = [...users];
      const iteratees: Array<Iteratee<User>> = [(user) => user.joinDate];
      const orders: Array<Order> = ['asc']; // 按加入日期升序

      // 执行排序
      const result = coreSort(array, iteratees, orders, false);

      // 验证结果：最早加入的在前
      expect(result[0].joinDate.getTime()).toBe(
        new Date('2021-01-01').getTime(),
      );
      expect(result[0].name).toBe('Eve');

      expect(result[1].joinDate.getTime()).toBe(
        new Date('2021-06-01').getTime(),
      );
      expect(result[1].name).toBe('David');

      expect(result[4].joinDate.getTime()).toBe(
        new Date('2023-01-01').getTime(),
      );
      expect(result[4].name).toBe('Alice');
    });
  });

  describe('In-place vs Copy Behavior', () => {
    it('should not mutate original array when inplace is false', () => {
      // 准备测试数据
      const original = [...users];
      const array = [...original];
      const iteratees: Array<Iteratee<User>> = [(user) => user.id];
      const orders: Array<Order> = ['asc'];

      // 执行非原地排序
      const result = coreSort(array, iteratees, orders, false);

      // 验证结果已排序
      expect(result[0].id).toBe(1);
      expect(result[1].id).toBe(2);

      // 验证原始数组未被修改
      expect(array).toEqual(original);
    });

    it('should mutate original array when inplace is true', () => {
      // 准备测试数据
      const array = [...users];
      const originalReference = array; // 保存引用
      const iteratees: Array<Iteratee<User>> = [(user) => user.id];
      const orders: Array<Order> = ['asc'];

      // 执行原地排序
      const result = coreSort(array, iteratees, orders, true);

      // 验证结果已排序
      expect(result[0].id).toBe(1);
      expect(result[1].id).toBe(2);

      // 验证原始数组已被修改（引用相同）
      expect(result).toBe(originalReference);
      expect(array[0].id).toBe(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty array', () => {
      const array: User[] = [];
      const iteratees: Array<Iteratee<User>> = [(user) => user.id];
      const orders: Array<Order> = ['asc'];

      const result = coreSort(array, iteratees, orders, false);

      expect(result).toEqual([]);
      expect(result).not.toBe(array); // 应该返回新数组
    });

    it('should handle single element array', () => {
      const array = [
        {id: 1, name: 'Single', age: 99, active: true, joinDate: new Date()},
      ];
      const iteratees: Array<Iteratee<User>> = [(user) => user.name];
      const orders: Array<Order> = ['desc'];

      const result = coreSort(array, iteratees, orders, false);

      expect(result).toEqual(array);
      expect(result[0].name).toBe('Single');
    });

    it('should handle boolean sorting', () => {
      // 准备测试数据
      const array = [...users];
      const iteratees: Array<Iteratee<User>> = [(user) => user.active];
      const orders: Array<Order> = ['desc']; // true 在前

      // 执行排序
      const result = coreSort(array, iteratees, orders, false);

      // 验证结果：active 为 true 的在前
      const trueUsers = result.filter((user) => user.active);
      const falseUsers = result.filter((user) => !user.active);

      // 所有 true 应该在前
      expect(trueUsers.length).toBe(3);
      expect(falseUsers.length).toBe(2);

      // 验证前3个都是 active: true
      expect(result[0].active).toBe(true);
      expect(result[1].active).toBe(true);
      expect(result[2].active).toBe(true);

      // 后2个都是 active: false
      expect(result[3].active).toBe(false);
      expect(result[4].active).toBe(false);
    });

    it('should handle missing orders array elements', () => {
      // 测试 orders 数组比 iteratees 短的情况
      const array = [...users];
      const iteratees: Array<Iteratee<User>> = [
        (user) => user.age,
        (user) => user.name,
      ];
      const orders: Array<Order> = ['asc']; // 只指定第一个字段的排序方式

      // 执行排序：第二个字段应该使用默认的 'asc'
      const result = coreSort(array, iteratees, orders, false);

      // 年龄升序，年龄相同时姓名升序
      const age25Users = result.filter((user) => user.age === 25);
      expect(age25Users[0].name).toBe('Alice'); // A < B
      expect(age25Users[1].name).toBe('Bob');

      const age30Users = result.filter((user) => user.age === 30);
      expect(age30Users[0].name).toBe('Charlie'); // C < E
      expect(age30Users[1].name).toBe('Eve');
    });
  });
});

// ============================
// orderBy 函数测试
// ============================
describe.concurrent('orderBy Function', () => {
  it('should sort with multiple criteria and return new array', () => {
    // 准备测试数据
    const array = [...users];
    const iteratees: Array<Iteratee<User>> = [
      (user) => user.active,
      (user) => user.age,
      (user) => user.name,
    ];
    const orders: Array<Order> = ['desc', 'asc', 'asc'];

    // 执行排序
    const result = orderBy(array, iteratees, orders);

    // 验证结果：先按 active 降序，再按 age 升序，最后按 name 升序
    expect(result[0].active).toBe(true); // active 为 true 的在前
    expect(result[0].age).toBe(25); // Alice 年龄最小
    expect(result[0].name).toBe('Alice');

    expect(result[1].active).toBe(true);
    expect(result[1].age).toBe(30);
    expect(result[1].name).toBe('Eve'); // Eve 在 David 前（age 相同按 name 排序）

    expect(result[2].active).toBe(true);
    expect(result[2].age).toBe(35);
    expect(result[2].name).toBe('David');

    // active 为 false 的在后
    expect(result[3].active).toBe(false);
    expect(result[4].active).toBe(false);

    // 验证原始数组未被修改
    expect(array).toEqual(users);
  });
});

// ============================
// orderByInplace 函数测试
// ============================
describe.concurrent('orderByInplace Function', () => {
  it('should sort with multiple criteria in place', () => {
    // 准备测试数据
    const array = [...users];
    const originalReference = array;
    const iteratees: Array<Iteratee<User>> = [
      (user) => user.age,
      (user) => user.active,
    ];
    const orders: Array<Order> = ['desc', 'asc']; // 年龄降序，active 升序

    // 执行原地排序
    const result = orderByInplace(array, iteratees, orders);

    // 验证结果：年龄最大的在前，年龄相同时 active 为 false 的在前
    expect(result[0].age).toBe(35); // David
    expect(result[0].active).toBe(true);

    // 年龄30的用户
    expect(result[1].age).toBe(30);
    expect(result[1].active).toBe(false); // Charlie (false) 在 Eve (true) 前
    expect(result[1].name).toBe('Charlie');

    expect(result[2].age).toBe(30);
    expect(result[2].active).toBe(true);
    expect(result[2].name).toBe('Eve');

    // 年龄25的用户
    expect(result[3].age).toBe(25);
    expect(result[3].active).toBe(false); // Bob (false) 在 Alice (true) 前
    expect(result[3].name).toBe('Bob');

    expect(result[4].age).toBe(25);
    expect(result[4].active).toBe(true);
    expect(result[4].name).toBe('Alice');

    // 验证是原地排序
    expect(result).toBe(originalReference);
  });
});

// ============================
// sortBy 函数测试
// ============================
describe.concurrent('sortBy Function', () => {
  it('should sort by single field with default asc order', () => {
    // 准备测试数据
    const array = [...users];
    const iteratee: Iteratee<User> = (user) => user.name;

    // 执行排序（默认升序）
    const result = sortBy(array, iteratee);

    // 验证结果按姓名升序排列
    expect(result[0].name).toBe('Alice');
    expect(result[1].name).toBe('Bob');
    expect(result[2].name).toBe('Charlie');
    expect(result[3].name).toBe('David');
    expect(result[4].name).toBe('Eve');

    // 验证原始数组未被修改
    expect(array).toEqual(users);
  });

  it('should sort by single field with specified order', () => {
    // 准备测试数据
    const array = [...users];
    const iteratee: Iteratee<User> = (user) => user.joinDate;

    // 执行降序排序
    const result = sortBy(array, iteratee, 'desc');

    // 验证结果按加入日期降序排列
    expect(result[0].joinDate.getTime()).toBe(new Date('2023-01-01').getTime());
    expect(result[0].name).toBe('Alice');

    expect(result[1].joinDate.getTime()).toBe(new Date('2022-12-01').getTime());
    expect(result[1].name).toBe('Bob');

    expect(result[4].joinDate.getTime()).toBe(new Date('2021-01-01').getTime());
    expect(result[4].name).toBe('Eve');
  });
});

// ============================
// sortByInplace 函数测试
// ============================
describe.concurrent('sortByInplace Function', () => {
  it('should sort by single field in place', () => {
    // 准备测试数据
    const array = [...users];
    const originalReference = array;
    const iteratee: Iteratee<User> = (user) => user.id;

    // 执行原地排序（默认升序）
    const result = sortByInplace(array, iteratee);

    // 验证结果按ID升序排列
    expect(result[0].id).toBe(1);
    expect(result[0].name).toBe('Alice');

    expect(result[1].id).toBe(2);
    expect(result[1].name).toBe('Bob');

    expect(result[2].id).toBe(3);
    expect(result[2].name).toBe('Charlie');

    expect(result[3].id).toBe(4);
    expect(result[3].name).toBe('David');

    expect(result[4].id).toBe(5);
    expect(result[4].name).toBe('Eve');

    // 验证是原地排序
    expect(result).toBe(originalReference);
  });

  it('should sort by boolean field with desc order in place', () => {
    // 准备测试数据
    const array = [...users];
    const iteratee: Iteratee<User> = (user) => user.active;

    // 执行原地降序排序（true 在前）
    const result = sortByInplace(array, iteratee, 'desc');

    // 验证结果：active 为 true 的在前
    const firstThree = result.slice(0, 3);
    const lastTwo = result.slice(3);

    expect(firstThree.every((user) => user.active)).toBe(true);
    expect(lastTwo.every((user) => !user.active)).toBe(true);
  });
});

// ============================
// 泛型严谨性测试
// ============================
describe.concurrent('Generic Type Safety Tests', () => {
  it('should work with different data types', () => {
    // 测试字符串数组
    const strings = ['banana', 'apple', 'cherry'];
    const stringIteratee: Iteratee<string> = (str) => str;
    const sortedStrings = sortBy(strings, stringIteratee);
    expect(sortedStrings).toEqual(['apple', 'banana', 'cherry']);

    // 测试数字数组
    const numbers = [5, 1, 4, 2, 3];
    const numberIteratee: Iteratee<number> = (num) => num;
    const sortedNumbers = sortBy(numbers, numberIteratee);
    expect(sortedNumbers).toEqual([1, 2, 3, 4, 5]);

    // 测试混合类型数组
    type MixedItem = {value: string | number | boolean};
    const mixedItems: MixedItem[] = [
      {value: 100},
      {value: 'zebra'},
      {value: true},
      {value: 50},
      {value: 'apple'},
      {value: false},
    ];

    const mixedIteratee: Iteratee<MixedItem> = (item) => item.value;
    const sortedMixed = sortBy(mixedItems, mixedIteratee);

    // 验证排序结果：按照值的自然顺序
    expect(sortedMixed.map((item) => item.value)).toEqual([
      false, // boolean false
      true, // boolean true
      50, // number 50
      100, // number 100
      'apple', // string 'apple'
      'zebra', // string 'zebra'
    ]);
  });

  it('should cover the type-order branch when comparing different types', () => {
    const diffTypes = [{v: 1}, {v: '1'}]; // number vs string

    const resAsc = coreSort(diffTypes, [(i) => i.v], ['asc'], false);
    // 在 JS 里 "number" < "string"，所以 1 应该在 '1' 前面
    expect(typeof resAsc[0].v).toBe('number');

    const resDesc = coreSort(diffTypes, [(i) => i.v], ['desc'], false);
    expect(typeof resDesc[0].v).toBe('string');
  });

  it('should handle complex nested objects', () => {
    // 测试嵌套对象
    type Nested = {
      id: number;
      info: {
        score: number;
        name: string;
      };
    };

    const nestedArray: Nested[] = [
      {id: 1, info: {score: 90, name: 'Alice'}},
      {id: 2, info: {score: 85, name: 'Bob'}},
      {id: 3, info: {score: 90, name: 'Charlie'}},
    ];

    // 按分数降序，分数相同时按姓名升序
    const iteratees: Array<Iteratee<Nested>> = [
      (item) => item.info.score,
      (item) => item.info.name,
    ];
    const orders: Array<Order> = ['desc', 'asc'];

    const result = orderBy(nestedArray, iteratees, orders);

    // 验证结果
    expect(result[0].info.score).toBe(90);
    expect(result[0].info.name).toBe('Alice'); // 分数相同时按姓名排序

    expect(result[1].info.score).toBe(90);
    expect(result[1].info.name).toBe('Charlie');

    expect(result[2].info.score).toBe(85);
    expect(result[2].info.name).toBe('Bob');
  });
});
