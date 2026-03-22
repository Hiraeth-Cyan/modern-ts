// ========================================
// ./src/Utils/Array/randomization.spec.ts
// ========================================
import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {
  shuffle,
  shuffleInplace,
  sample,
  sampleSize,
  choices,
  weightedChoices,
  Xorshift32,
} from './randomization';

// ============================
// 测试辅助函数与生成器
// ============================
const createNumArray = (n: number) => Array.from({length: n}, (_, i) => i);
const createStrArray = (n: number) =>
  Array.from({length: n}, (_, i) => `s-${i}`);
const createObjArray = (n: number) =>
  Array.from({length: n}, (_, i) => ({id: i, value: i}));

// 检查两个数组是否包含相同的元素（忽略顺序），用于验证随机化结果
const expectSameElements = <T>(arr1: T[], arr2: T[]) => {
  expect(arr1).toHaveLength(arr2.length);
  arr1.forEach((item) => expect(arr2).toContain(item));
  arr2.forEach((item) => expect(arr1).toContain(item));
};

// 泛型测试辅助：用于测试不同数据类型的兼容性
// 避免在 it.each 中使用联合类型导致的类型推断问题
const testGenericBehavior = <T>(
  typeName: string,
  data: T[],
  testFn: (arr: T[]) => void,
) => {
  it(`should work with ${typeName}`, () => {
    testFn(data);
  });
};

// ============================
// shuffle 函数测试
// ============================
describe.concurrent('shuffle', () => {
  it('should return a new array without mutating the original', () => {
    const original = [1, 2, 3, 4, 5];
    const result = shuffle(original);

    expect(result).not.toBe(original);
    expect(original).toEqual([1, 2, 3, 4, 5]);
    expectSameElements(result, original);
  });

  it.each([
    {input: [] as number[], expectedLength: 0, desc: 'empty array'},
    {input: [1] as number[], expectedLength: 1, desc: 'single element array'},
  ])('should handle $desc', ({input, expectedLength}) => {
    const result = shuffle(input);
    expect(result).toHaveLength(expectedLength);
    expectSameElements(result, input);
  });

  // 泛型测试：覆盖不同类型
  testGenericBehavior('Numbers', createNumArray(5), (arr) => {
    expect(shuffle(arr)).toHaveLength(5);
  });
  testGenericBehavior('Strings', createStrArray(5), (arr) => {
    expect(shuffle(arr)).toHaveLength(5);
  });
  testGenericBehavior('Objects', createObjArray(5), (arr) => {
    expect(shuffle(arr)).toHaveLength(5);
  });
});

// ============================
// shuffleInplace 函数测试
// ============================
describe.concurrent('shuffleInplace', () => {
  it('should shuffle array in place and return the same reference', () => {
    const original = createNumArray(100);
    const result = shuffleInplace(original);

    expect(result).toBe(original);
    expectSameElements(result, createNumArray(100));
  });

  it.each([{input: [] as number[]}, {input: [1] as number[]}])(
    'should handle edge cases in place',
    ({input}) => {
      const result = shuffleInplace(input);
      expect(result).toBe(input);
      expectSameElements(result, input);
    },
  );

  testGenericBehavior('Numbers', createNumArray(10), (arr) => {
    const copy = [...arr];
    const result = shuffleInplace(arr);
    expect(result).toBe(arr);
    expectSameElements(result, copy);
  });

  testGenericBehavior('Strings', createStrArray(10), (arr) => {
    const result = shuffleInplace(arr);
    expect(result).toBe(arr);
  });

  testGenericBehavior('Objects', createObjArray(10), (arr) => {
    const result = shuffleInplace(arr);
    expect(result).toBe(arr);
  });
});

// ============================
// sample 函数测试
// ============================
describe('sample', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return undefined for empty array', () => {
    expect(sample([])).toBeUndefined();
  });

  it('should return the only element for single element array', () => {
    expect(sample([42])).toBe(42);
    expect(sample(['only'])).toBe('only');
  });

  it('should respect Math.random (index = floor(0.5 * len))', () => {
    const arr = ['a', 'b', 'c', 'd', 'e']; // length 5. 0.5 * 5 = 2.5 -> index 2 -> 'c'
    expect(sample(arr)).toBe('c');
  });

  testGenericBehavior('Numbers', createNumArray(10), (arr) => {
    const result = sample(arr);
    expect(arr).toContain(result);
  });

  testGenericBehavior('Strings', createStrArray(10), (arr) => {
    const result = sample(arr);
    expect(arr).toContain(result);
  });

  testGenericBehavior('Objects', createObjArray(10), (arr) => {
    const result = sample(arr);
    expect(arr).toContain(result);
  });
});

// ============================
// sampleSize 函数测试
// ============================
describe.concurrent('sampleSize', () => {
  it.each([
    {arr: [1, 2, 3] as number[], n: 0},
    {arr: [1, 2, 3] as number[], n: -1},
    {arr: [] as number[], n: 5},
  ])('should return empty array for edge cases (n: $n)', ({arr, n}) => {
    expect(sampleSize(arr, n)).toEqual([]);
  });

  it('should return a shuffled slice for n < length and full copy for n >= length', () => {
    const arr = createNumArray(10);

    const slice = sampleSize(arr, 3);
    expect(slice).toHaveLength(3);
    expect(arr).toEqual(expect.arrayContaining(slice));

    const full = sampleSize(arr, 100);
    expect(full).toHaveLength(10);
    expectSameElements(full, arr);
  });

  it('should not mutate the original array', () => {
    const original = createNumArray(10);
    const copy = [...original];
    sampleSize(original, 5);
    expect(original).toEqual(copy);
  });

  testGenericBehavior('Numbers', createNumArray(10), (arr) => {
    const result = sampleSize(arr, 3);
    expect(result).toHaveLength(3);
    result.forEach((item) => expect(arr).toContain(item));

    // 检查唯一性
    const uniqueResult = new Set(result);
    expect(uniqueResult.size).toBe(result.length);
  });

  testGenericBehavior('Strings', createStrArray(10), (arr) => {
    expect(sampleSize(arr, 3)).toHaveLength(3);
  });

  testGenericBehavior('Objects', createObjArray(10), (arr) => {
    expect(sampleSize(arr, 3)).toHaveLength(3);
  });
});

// ============================
// choices 函数测试
// ============================
describe('choices', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0.3);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    {arr: [1, 2, 3] as number[], n: 0},
    {arr: [1, 2, 3] as number[], n: -1},
    {arr: [] as number[], n: 5},
  ])('should return empty array for edge cases (n: $n)', ({arr, n}) => {
    expect(choices(arr, n)).toEqual([]);
  });

  it('should return exactly n elements, allowing duplicates', () => {
    const arr = ['a', 'b', 'c'];
    const n = 5;
    const result = choices(arr, n);

    expect(result).toHaveLength(n);
    result.forEach((item) => expect(arr).toContain(item));
  });

  it('should respect Math.random (index = floor(0.3 * 2) = 0)', () => {
    const arr = ['x', 'y'];
    // 0.3 * 2 = 0.6 -> floor 0 -> 'x'
    const result = choices(arr, 3);
    expect(result).toEqual(['x', 'x', 'x']);
  });

  testGenericBehavior('Numbers', [1, 2, 3], (arr) => {
    expect(choices(arr, 3)).toHaveLength(3);
  });

  testGenericBehavior('Strings', ['a', 'b', 'c'], (arr) => {
    expect(choices(arr, 3)).toHaveLength(3);
  });

  testGenericBehavior('Objects', [{id: 1}, {id: 2}], (arr) => {
    expect(choices(arr, 3)).toHaveLength(3);
  });
});

// ============================
// weightedChoices 函数测试
// ============================
describe('weightedChoices', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0.6);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return empty array for invalid inputs', () => {
    const items = [1, 2];
    const weights = [1, 2];

    expect(weightedChoices([], weights, 3)).toEqual([]);
    expect(weightedChoices(items, [1], 3)).toEqual([]); // 长度不匹配
    expect(weightedChoices(items, weights, 0)).toEqual([]);
    expect(weightedChoices(items, weights, -1)).toEqual([]);
  });

  it('should return exactly n elements based on weights', () => {
    const items = ['low', 'medium', 'high'];
    const weights = [1, 2, 7]; // 总和 10
    // mock 0.6 -> 0.6 * 10 = 6. 范围 [0,1), [1,3), [3,10). 6 落在 [3,10) -> 索引 2 'high'

    const result = weightedChoices(items, weights, 3);
    expect(result).toHaveLength(3);
    expect(result[0]).toBe('high');
    expect(result[1]).toBe('high');
    expect(result[2]).toBe('high');
  });

  it('should handle zero weights and floating points correctly', () => {
    const items = ['a', 'b', 'c'];
    const weights = [0, 0, 1]; // 总和 1. mock 0.6 -> 0.6 * 1 = 0.6. 索引 0-0是a, 0-0是b, 0-1是c. 0.6在c的区间.

    const zeroResult = weightedChoices(items, weights, 2);
    expect(zeroResult).toEqual(['c', 'c']);

    const floatWeights = [0.1, 0.2, 0.7]; // 总和 1.0. mock 0.6 -> 0.6. 范围 [0, 0.1), [0.1, 0.3), [0.3, 1.0). 0.6 在索引 2.
    const floatResult = weightedChoices(items, floatWeights, 1);
    expect(floatResult[0]).toBe('c');
  });

  testGenericBehavior('Numbers', [1, 2, 3], (arr) => {
    const weights = arr.map(() => 1);
    const result = weightedChoices(arr, weights, 2);
    expect(result).toHaveLength(2);
    result.forEach((item) => expect(arr).toContain(item));
  });

  testGenericBehavior('Strings', ['a', 'b', 'c'], (arr) => {
    const weights = arr.map(() => 1);
    const result = weightedChoices(arr, weights, 2);
    expect(result).toHaveLength(2);
  });

  testGenericBehavior('Objects', [{id: 1}, {id: 2}, {id: 3}], (arr) => {
    const weights = arr.map(() => 1);
    const result = weightedChoices(arr, weights, 2);
    expect(result).toHaveLength(2);
  });

  it('should handle large n efficiently', () => {
    const largeArr = createNumArray(100);
    const weights = largeArr.map(() => 1);
    const result = weightedChoices(largeArr, weights, 1000);

    expect(result).toHaveLength(1000);
    result.forEach((item) => expect(largeArr).toContain(item));
  });
});

describe.concurrent('Xorshift32', () => {
  it('should produce deterministic output for a given seed', () => {
    const seed = 123456789;
    const rng1 = new Xorshift32(seed);
    const rng2 = new Xorshift32(seed);

    // 产生一串随机数，它们必须完全相等
    for (let i = 0; i < 100; i++) {
      expect(rng1.nextUint32()).toBe(rng2.nextUint32());
    }
  });

  it('should not produce all zeros if seed is 0', () => {
    // 即使给个笨蛋种子0，内部也应该处理它
    const rng = new Xorshift32(0);
    expect(rng.nextUint32()).not.toBe(0);
  });

  it('should produce floats in the range [0, 1)', () => {
    const rng = new Xorshift32(42);
    for (let i = 0; i < 1000; i++) {
      const val = rng.nextFloat();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    }
  });

  it('should produce different sequences for different seeds', () => {
    const rng1 = new Xorshift32(111);
    const rng2 = new Xorshift32(222);

    // 虽然理论上可能碰撞，但概率极低，这里检查前5个数不完全相同
    const seq1 = Array.from({length: 5}, () => rng1.nextUint32());
    const seq2 = Array.from({length: 5}, () => rng2.nextUint32());
    expect(seq1).not.toEqual(seq2);
  });
});
