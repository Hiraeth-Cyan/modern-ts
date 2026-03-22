// ========================================
// ./src/Utils/Array/operators.spec.ts
// ========================================
/* eslint-disable no-sparse-arrays */
import {describe, it, expect} from 'vitest';
import {
  mapInPlace,
  mapToNewArray,
  shortest,
  move,
  maxBy,
  minBy,
} from './operators';

// ============================
// mapInPlace & mapToNewArray
// ============================
describe.concurrent('Array Mapping Operators', () => {
  describe('mapInPlace', () => {
    it('should mutate original array with transformed values', () => {
      const arr = [1, 2, 3, 4, 5];
      const result = mapInPlace(arr, (i) => i * 10, 1, 4);

      expect(result).toBe(arr);
      expect(arr).toEqual([1, 10, 20, 30, 5]);
    });

    it('should handle negative start and end indices', () => {
      const arr = [1, 2, 3, 4, 5];
      expect(mapInPlace(arr, (i) => `index-${i}`, -3, -1)).toEqual([
        1,
        2,
        'index-2',
        'index-3',
        5,
      ]);
    });

    it('should return original array when start >= end', () => {
      const arr = [1, 2, 3];
      expect(mapInPlace(arr, () => 99, 2, 2)).toEqual([1, 2, 3]);
    });

    it('should handle empty arrays', () => {
      expect(mapInPlace([] as number[], () => 1)).toEqual([]);
    });
  });

  describe('mapToNewArray', () => {
    it('should return new array without mutating original', () => {
      const original = [1, 2, 3, 4, 5];
      const copy = [...original];
      const result = mapToNewArray(original, (i) => i * 2, 1, 4);

      expect(result).not.toBe(original);
      expect(result).toEqual([1, 2, 4, 6, 5]);
      expect(original).toEqual(copy);
    });

    it('should create full copy with default parameters', () => {
      expect(mapToNewArray([1, 2, 3], (i) => i + 10)).toEqual([10, 11, 12]);
    });
  });
});

// ============================
// shortest
// ============================
describe.concurrent('shortest', () => {
  it('should return arrays with minimal length', () => {
    const arr1 = [1, 2];
    const arr2 = [3, 4, 5];
    const arr3 = [6];
    const arr4 = [7, 8];

    expect(shortest(arr1, arr2, arr3, arr4)).toEqual([[6]]);
  });

  it('should return all arrays with same minimal length', () => {
    const arr1 = [1, 2];
    const arr2 = [3, 4];
    const arr3 = [5, 6];

    expect(shortest(arr1, arr2, arr3)).toEqual([
      [1, 2],
      [3, 4],
      [5, 6],
    ]);
  });

  it('should return empty array for no arguments', () => {
    expect(shortest()).toEqual([]);
  });

  it('should handle arrays with holes correctly', () => {
    const arr1 = [1, , 3] as number[]; // length = 3
    const arr2 = [4]; // length = 1
    expect(shortest(arr1, arr2)).toEqual([[4]]);
  });

  it('should handle empty array input', () => {
    expect(shortest([])).toEqual([[]]);
  });
});

// ============================
// move
// ============================
describe.concurrent('move', () => {
  it('should move element within array', () => {
    const arr = [1, 2, 3, 4, 5];
    const result = move(arr, 2, 0);

    expect(result).toBe(arr);
    expect(arr).toEqual([3, 1, 2, 4, 5]);
  });

  it('should handle circular indices', () => {
    const arr = ['a', 'b', 'c', 'd'];

    // -1 (3) -> 4 (0)
    expect(move([...arr], -1, 4)).toEqual(['d', 'a', 'b', 'c']);
    // 5 (1) -> -2 (2)
    expect(move([...arr], 5, -2)).toEqual(['a', 'c', 'b', 'd']);
  });

  it('should return same array when from and to are equivalent', () => {
    const arr = [1, 2, 3];
    expect(move(arr, 1, 1)).toBe(arr);
    expect(arr).toEqual([1, 2, 3]);
  });

  it('should work with sparse arrays', () => {
    const arr = [1, , 3, , 5] as (number | undefined)[];
    move(arr, 0, 3);
    // 索引0移动到索引3，其他元素前移
    expect(arr).toEqual([undefined, 3, undefined, 1, 5]);
  });

  it('should handle empty arrays', () => {
    expect(move([], 0, 1)).toEqual([]);
  });
});

// ============================
// maxBy & minBy (Data Driven)
// ============================
describe.concurrent('maxBy & minBy', () => {
  const people = [
    {name: 'Alice', score: 85},
    {name: 'Bob', score: 92},
    {name: 'Charlie', score: 78},
  ];

  const items = [
    {id: 1, value: 100},
    {id: 2, value: 100},
    {id: 3, value: 100},
    {id: 4, value: 99},
  ];

  describe('maxBy', () => {
    it('should return undefined for empty array', () => {
      expect(maxBy([], (item) => item)).toBeUndefined();
    });

    it('should find element with maximum computed value', () => {
      expect(maxBy(people, (p) => p.score)).toEqual({name: 'Bob', score: 92});
    });

    it('should return first element when multiple have same maximum value', () => {
      expect(maxBy(items, (i) => i.value)).toEqual({id: 1, value: 100});
    });

    it('should work with strings via charCodeAt', () => {
      const chars = ['a', 'b', 'c'];
      expect(maxBy(chars, (c) => c.charCodeAt(0))).toBe('c');
    });

    // Table-driven tests for numeric primitives
    describe('maxBy - Basic Numbers', () => {
      it.each([
        {desc: 'positive', input: [1, 5, 3, 9, 2], expected: 9},
        {
          desc: 'Infinity',
          input: [Infinity, 100, -Infinity],
          expected: Infinity,
        },
      ])('should handle $desc', ({input, expected}) => {
        expect(maxBy(input, (n) => n)).toEqual(expected);
      });
    });

    describe('maxBy - Objects', () => {
      it.each([
        {desc: 'single element', input: [{value: 42}], expected: {value: 42}},
      ])('should handle $desc', ({input, expected}) => {
        expect(maxBy(input, (item) => item.value)).toEqual(expected);
      });
    });
  });

  describe('minBy', () => {
    it('should return undefined for empty array', () => {
      expect(minBy([], (item) => item)).toBeUndefined();
    });

    it('should find element with minimum computed value', () => {
      const products = [
        {name: 'Apple', price: 1.5},
        {name: 'Banana', price: 0.8},
        {name: 'Orange', price: 1.2},
      ];
      expect(minBy(products, (p) => p.price)).toEqual({
        name: 'Banana',
        price: 0.8,
      });
    });

    it('should return first element when multiple have same minimum value', () => {
      const students = [
        {name: 'Alice', grade: 75},
        {name: 'Bob', grade: 75},
        {name: 'Charlie', grade: 80},
      ];
      expect(minBy(students, (s) => s.grade)).toEqual({
        name: 'Alice',
        grade: 75,
      });
    });

    // Table-driven tests for numeric primitives
    describe('minBy', () => {
      // 专门测数字的
      it.each([
        {desc: 'positive numbers', input: [10, 5, 8, 2, 7], expected: 2},
        {desc: 'negative numbers', input: [-1, -5, -10, -3], expected: -10},
      ])('should handle $desc', ({input, expected}) => {
        expect(minBy(input, (n) => n)).toEqual(expected);
      });

      // 专门测对象的
      it.each([
        {
          desc: 'single element',
          input: [{value: -100}],
          expected: {value: -100},
        },
      ])('should handle $desc (object)', ({input, expected}) => {
        expect(minBy(input, (item) => item.value)).toEqual(expected);
      });
    });
  });
});

// ============================
// Sparse Array Edge Cases
// ============================
describe.concurrent('Sparse Array Edge Cases', () => {
  it('maxBy/minBy should handle sparse arrays with default values', () => {
    const sparseArray = new Array<number>(5);
    sparseArray[2] = 10;
    sparseArray[4] = 5;

    const selector = (n: number | undefined) => n || 0;

    expect(maxBy(sparseArray, selector)).toBe(10);
    expect(minBy(sparseArray, selector)).toBe(5);
  });
});
