// ========================================
// ./src/Utils/Array/flatten.spec.ts
// ========================================

import {describe, it, expect, vi} from 'vitest';
import {flattenDeep, flatMapDeep, flatMapAsync} from './flatten';

// ============================
// 测试辅助函数
// ============================
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ============================
// flattenDeep 测试
// ============================
describe.concurrent('flattenDeep function', () => {
  it('should completely flatten deeply nested arrays', () => {
    const array = [1, [2, [3, [4, [5]]]]];
    const result = flattenDeep(array);
    expect(result).toEqual([1, 2, 3, 4, 5]);
  });

  it('should flatten arrays with multiple nesting patterns', () => {
    const array = [
      [1, 2],
      [[3], 4],
      [5, [6, [7, [8]]]],
    ];
    const result = flattenDeep(array);
    expect(result).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('should handle empty arrays', () => {
    expect(flattenDeep([])).toEqual([]);
    expect(flattenDeep([[], [[]]])).toEqual([]);
  });

  it('should preserve DeepExtract type inference', () => {
    const array = [[['string']], [[123]], [[true]]];
    const result = flattenDeep(array);

    expect(result).toEqual(['string', 123, true]);
    expect(result[0]).toBeTypeOf('string');
    expect(result[1]).toBeTypeOf('number');
    expect(result[2]).toBeTypeOf('boolean');
  });

  it('should handle complex nested structures', () => {
    const array = [
      [{id: 1}, [{nested: true}]],
      [[{id: 2}], 'string'],
      123,
      [[[true]]],
    ];

    const result = flattenDeep(array);
    expect(result).toEqual([
      {id: 1},
      {nested: true},
      {id: 2},
      'string',
      123,
      true,
    ]);
  });
});

// ============================
// flatMapDeep 测试
// ============================
describe.concurrent('flatMapDeep function', () => {
  it('should map and completely flatten deeply nested results', () => {
    const array = [1, 2];
    const result = flatMapDeep(array, (x) => [[[x]], [[x * 2]]]);
    expect(result).toEqual([1, 2, 2, 4]);
  });

  it('should deeply flatten complex nested structures', () => {
    const array = [1, 2, 3];
    const result = flatMapDeep(array, (x) => [
      x,
      [x * 10, [x * 100]],
      [[[x * 1000]]],
    ]);
    expect(result).toEqual([
      1, 10, 100, 1000, 2, 20, 200, 2000, 3, 30, 300, 3000,
    ]);
  });

  it('should provide correct index to callback', () => {
    const array = ['x', 'y'];
    const indices: number[] = [];
    const result = flatMapDeep(array, (item, index) => {
      indices.push(index);
      return [[item, index]];
    });

    expect(indices).toEqual([0, 1]);
    expect(result).toEqual(['x', 0, 'y', 1]);
  });

  it('should handle callback returning non-array values', () => {
    const array = [1, 2, 3];
    const result = flatMapDeep(array, (x) => x);
    expect(result).toEqual([1, 2, 3]);
  });

  it('should handle empty arrays', () => {
    const result = flatMapDeep([], (x) => [[[x]]]);
    expect(result).toEqual([]);
  });

  it('should work with recursive-like structures', () => {
    const array = [1];
    const result = flatMapDeep(array, (x) => {
      const createNested = (value: number, depth: number): unknown[] => {
        if (depth <= 0) return [value];
        return [createNested(value, depth - 1)];
      };
      return createNested(x, 3);
    });
    expect(result).toEqual([1]);
  });
});

// ============================
// flatMapAsync 测试
// ============================
describe.concurrent('flatMapAsync function', () => {
  it('should asynchronously map and flatten results', async () => {
    const array = [1, 2, 3];
    // eslint-disable-next-line @typescript-eslint/require-await
    const result = await flatMapAsync(array, async (x) => [x, x * 2]);
    expect(result).toEqual([1, 2, 2, 4, 3, 6]);
  });

  it('should handle async callback returning non-array values', async () => {
    const array = [1, 2, 3];
    // eslint-disable-next-line @typescript-eslint/require-await
    const result = await flatMapAsync(array, async (x) => x * 10);
    expect(result).toEqual([10, 20, 30]);
  });

  it('should respect concurrency limit', async () => {
    const array = [1, 2, 3, 4, 5];
    const concurrency = 2;
    const active: number[] = [];
    const maxActive: number[] = [];

    const result = await flatMapAsync(
      array,
      async (item) => {
        active.push(item);
        maxActive.push(active.length);

        await wait(10);

        const index = active.indexOf(item);
        if (index > -1) active.splice(index, 1);

        return [item, item * 2];
      },
      concurrency,
    );

    const maxConcurrent = Math.max(...maxActive);
    expect(maxConcurrent).toBeLessThanOrEqual(concurrency);
    expect(result).toEqual([1, 2, 2, 4, 3, 6, 4, 8, 5, 10]);
  });

  it('should handle NaN concurrency by defaulting to 1', async () => {
    const array = [1, 2];
    let active_count = 0;
    let max_concurrency = 0;

    const result = await flatMapAsync(
      array,
      async (item) => {
        active_count++;
        // 记录执行过程中达到的最大并发数
        max_concurrency = Math.max(max_concurrency, active_count);

        await wait(10);

        active_count--;
        return [item];
      },
      NaN, // 预期被视为 1
    );

    expect(max_concurrency).toBe(1);
    expect(result).toEqual([1, 2]);
  });

  it('should handle concurrency less than 1 by defaulting to 1', async () => {
    const array = [1, 2];
    const timestamps: number[] = [];

    const result = await flatMapAsync(
      array,
      async (item) => {
        timestamps.push(Date.now());
        await wait(10);
        return [item];
      },
      0,
    );

    expect(timestamps[1] - timestamps[0]).toBeGreaterThanOrEqual(10);
    expect(result).toEqual([1, 2]);
  });

  it('should handle empty arrays', async () => {
    // eslint-disable-next-line @typescript-eslint/require-await
    const result = await flatMapAsync([], async (x) => [x]);
    expect(result).toEqual([]);
  });

  it('should provide correct index to async callback', async () => {
    const array = ['a', 'b', 'c'];
    // eslint-disable-next-line @typescript-eslint/require-await
    const mockCallback = vi.fn(async (item: string, index: number) => [
      item,
      index,
    ]);

    const result = await flatMapAsync(array, mockCallback);

    expect(mockCallback).toHaveBeenCalledTimes(3);
    expect(mockCallback.mock.calls[0]).toEqual(['a', 0]);
    expect(mockCallback.mock.calls[1]).toEqual(['b', 1]);
    expect(mockCallback.mock.calls[2]).toEqual(['c', 2]);
    expect(result).toEqual(['a', 0, 'b', 1, 'c', 2]);
  });

  it('should handle async errors gracefully', async () => {
    const array = [1, 2, 3];
    const errorMessage = 'Async error';

    await expect(
      // eslint-disable-next-line @typescript-eslint/require-await
      flatMapAsync(array, async (item) => {
        if (item === 2) {
          throw new Error(errorMessage);
        }
        return [item];
      }),
    ).rejects.toThrow(errorMessage);
  });

  it('should work with concurrency equal to array length', async () => {
    const array = [1, 2, 3, 4];

    const result = await flatMapAsync(
      array,
      async (item) => {
        await wait(10);
        return [item, item * 2];
      },
      array.length,
    );

    expect(result).toEqual([1, 2, 2, 4, 3, 6, 4, 8]);
  });

  it('should handle mixed return types from async callback', async () => {
    const array = [1, 2, 3];
    // eslint-disable-next-line @typescript-eslint/require-await
    const result = await flatMapAsync(array, async (x) => {
      if (x % 2 === 0) return [x, x * 2];
      return x;
    });
    expect(result).toEqual([1, 2, 4, 3]);
  });
});

// ============================
// 稀疏数组专项测试
// ============================
describe.concurrent('Sparse Array Handling (Hole-Skipping Behavior)', () => {
  it('should SKIP holes in flatMapAsync (async hole-skipping)', async () => {
    // eslint-disable-next-line no-sparse-arrays
    const sparse = [1, , 3];
    const calls: {value: unknown; index: number}[] = [];

    // eslint-disable-next-line @typescript-eslint/require-await
    const result = await flatMapAsync(sparse, async (x, i) => {
      calls.push({value: x, index: i});
      return x;
    });

    expect(calls).toEqual([
      {value: 1, index: 0},
      {value: 3, index: 2},
    ]);
    expect(result).toEqual([1, 3]);
  });

  it('should PRESERVE explicit undefined in flatMapAsync', async () => {
    const withUndefined = [1, undefined, 3];
    // eslint-disable-next-line @typescript-eslint/require-await
    const result = await flatMapAsync(withUndefined, async (x) => x);
    expect(result).toEqual([1, undefined, 3]);
  });

  it('should skip multiple consecutive holes correctly', () => {
    // eslint-disable-next-line no-sparse-arrays
    const multiHole = [1, , , , 5];

    expect(flattenDeep(multiHole)).toEqual([1, 5]);
    expect([...multiHole.keys()]).toEqual([0, 1, 2, 3, 4]);

    expect(Object.keys(multiHole).map(Number)).toEqual([0, 4]);
  });
  it('should SKIP holes in flatMapDeep (sync version)', () => {
    // eslint-disable-next-line no-sparse-arrays
    const sparse = [1, , 3]; // 索引 1 是空洞
    const calls: number[] = [];

    const result = flatMapDeep(sparse, (x, i) => {
      calls.push(i);
      return x;
    });

    expect(calls).toEqual([0, 2]);
    expect(result).toEqual([1, 3]);
  });
});

// ============================
// 性能与行为测试
// ============================
describe.concurrent('Performance and Behavior', () => {
  it('flatMapAsync should execute callbacks in order for concurrency 1', async () => {
    const array = [1, 2, 3];
    const executionOrder: number[] = [];

    await flatMapAsync(
      array,
      async (item) => {
        executionOrder.push(item);
        await wait(10);
        return [item];
      },
      1,
    );

    expect(executionOrder).toEqual([1, 2, 3]);
  });

  it('should handle deeply nested arrays without stack overflow', () => {
    let nested: unknown = 42;
    for (let i = 0; i < 10000; i++) {
      nested = [nested];
    }

    const array = [nested];
    const result = flattenDeep(array);
    expect(result).toEqual([42]);
  });
});
