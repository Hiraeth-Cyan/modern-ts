// ========================================
// ./src/Utils/Array/iteration.spec.ts
// ========================================

import {describe, it, expect, vi} from 'vitest';
import {
  forEachRight,
  forEachAsync,
  mapAsync,
  filterAsync,
  reduceAsync,
} from './iteration';
import {sleep} from '../../Concurrent/delay';
import {MockClock, runTimelineAsync} from '../../MockClock/__export__';

const createConcurrencySpy = <T, R>(
  delay: number,
  resolver: (value: T, index: number) => R | Promise<R>,
) => {
  let activeCount = 0;
  let maxActive = 0;

  const spy = vi.fn(async (value: T, index: number) => {
    activeCount++;
    maxActive = Math.max(maxActive, activeCount);

    // 执行逻辑并等待延迟
    const result = await resolver(value, index);
    await sleep(delay);

    activeCount--;
    return result;
  });

  return {
    spy,
    getMaxActive: () => maxActive,
  };
};

// ==========================================
// Test Suites
// ==========================================

describe.concurrent('forEachRight', () => {
  it('should iterate array from right to left', () => {
    const visited: number[] = [];
    forEachRight([1, 2, 3, 4], (value) => visited.push(value));
    expect(visited).toEqual([4, 3, 2, 1]);
  });

  it('should provide correct index and collection', () => {
    const array = ['a', 'b', 'c'];
    const indices: number[] = [];
    const collections: string[][] = [];

    forEachRight(array, (_, index, collection) => {
      indices.push(index);
      collections.push(collection);
    });

    expect(indices).toEqual([2, 1, 0]);
    expect(collections).toEqual([array, array, array]);
  });

  it('should handle edge cases (empty and single)', () => {
    const mock = vi.fn();
    forEachRight([], mock);
    expect(mock).not.toHaveBeenCalled();

    const visited: number[] = [];
    forEachRight([42], (v) => visited.push(v));
    expect(visited).toEqual([42]);
  });
});

describe.concurrent('Async Iteration Operations', () => {
  describe('forEachAsync', () => {
    it('should process all items with unlimited concurrency', async () => {
      const clock = MockClock();
      await runTimelineAsync(clock, async () => {
        const array = [1, 2, 3, 4];
        const processed: number[] = [];
        const callback = vi.fn(async (value: number) => {
          await sleep(10);
          processed.push(value);
        });

        const promise = forEachAsync(array, callback);
        await clock.tickAsync(100);
        await promise;

        expect(callback).toHaveBeenCalledTimes(4);
        expect(processed.sort()).toEqual(array);
      });
    });

    it('should respect concurrency limit', async () => {
      const clock = MockClock();
      await runTimelineAsync(clock, async () => {
        const array = [1, 2, 3, 4, 5];
        const maxConcurrent = 2;
        const {spy, getMaxActive} = createConcurrencySpy<number, void>(
          20,
          () => {},
        );

        const promise = forEachAsync(array, spy, maxConcurrent);
        await clock.tickAsync(200);
        await promise;

        expect(getMaxActive()).toBeLessThanOrEqual(maxConcurrent);
      });
    });

    it('should handle empty array', async () => {
      const clock = MockClock();
      await runTimelineAsync(clock, async () => {
        const callback = vi.fn();
        await forEachAsync([], callback);
        expect(callback).not.toHaveBeenCalled();
      });
    });

    it('should process items concurrently when limit >= length', async () => {
      const clock = MockClock();
      await runTimelineAsync(clock, async () => {
        const array = [1, 2, 3];
        const startTimes: number[] = [];
        const callback = vi.fn(async () => {
          startTimes.push(Date.now());
          await sleep(50);
        });

        const promise = forEachAsync(array, callback, 5);
        await clock.tickAsync(100);
        await promise;

        expect(callback).toHaveBeenCalledTimes(3);
        // 在假定时器中，Date.now 可能不递增，但若递增，它们应几乎同时触发
        if (startTimes[0] !== startTimes[2]) {
          expect(startTimes[2] - startTimes[0]).toBeLessThan(10);
        }
      });
    });
  });

  describe('mapAsync', () => {
    it('should map array asynchronously with correct order', async () => {
      const clock = MockClock();
      await runTimelineAsync(clock, async () => {
        const array = [1, 2, 3, 4];
        const callback = vi.fn(async (value: number) => {
          await sleep(10);
          return value * 2;
        });

        const promise = mapAsync(array, callback);
        await clock.tickAsync(100);
        const result = await promise;

        expect(callback).toHaveBeenCalledTimes(4);
        expect(result).toEqual([2, 4, 6, 8]);
      });
    });

    it('should respect concurrency limit', async () => {
      const clock = MockClock();
      await runTimelineAsync(clock, async () => {
        const array = [1, 2, 3, 4, 5];
        const maxConcurrent = 2;
        const {spy, getMaxActive} = createConcurrencySpy(
          15,
          (v: number) => v * 10,
        );

        const promise = mapAsync(array, spy, maxConcurrent);
        await clock.tickAsync(150);
        const result = await promise;

        expect(getMaxActive()).toBeLessThanOrEqual(maxConcurrent);
        expect(result).toEqual([10, 20, 30, 40, 50]);
      });
    });

    it('should handle empty array and sync callbacks', async () => {
      const clock = MockClock();
      await runTimelineAsync(clock, async () => {
        const syncCb = vi.fn((v: number) => v * 2);
        expect(await mapAsync([], syncCb)).toEqual([]);
        expect(await mapAsync([1, 2, 3], syncCb)).toEqual([2, 4, 6]);
      });
    });

    it('should preserve array indices and arguments', async () => {
      const clock = MockClock();
      await runTimelineAsync(clock, async () => {
        const array = [10, 20, 30];
        const receivedArgs: Array<{value: number; index: number}> = [];
        const callback = vi.fn(async (v: number, i: number) => {
          await sleep(5);
          receivedArgs.push({value: v, index: i});
          return v + i;
        });

        const promise = mapAsync(array, callback);
        await clock.tickAsync(50);
        const result = await promise;

        // 验证每个元素的 index 参数正确传递（不验证执行顺序）
        expect(receivedArgs.map((a) => a.index).sort()).toEqual([0, 1, 2]);
        expect(receivedArgs.map((a) => a.value).sort()).toEqual([10, 20, 30]);
        // 结果数组顺序必须正确
        expect(result).toEqual([10, 21, 32]);
      });
    });
  });

  describe('filterAsync', () => {
    it('should filter array asynchronously', async () => {
      const clock = MockClock();
      await runTimelineAsync(clock, async () => {
        const array = [1, 2, 3, 4, 5, 6];
        const callback = vi.fn(async (v: number) => {
          await sleep(5);
          return v % 2 === 0;
        });

        const promise = filterAsync(array, callback);
        await clock.tickAsync(50);
        const result = await promise;

        expect(callback).toHaveBeenCalledTimes(6);
        expect(result).toEqual([2, 4, 6]);
      });
    });

    it('should respect concurrency limit', async () => {
      const clock = MockClock();
      await runTimelineAsync(clock, async () => {
        const array = [1, 2, 3, 4, 5];
        const maxConcurrent = 2;
        const {spy, getMaxActive} = createConcurrencySpy(
          10,
          (v: number) => v > 2,
        );

        const promise = filterAsync(array, spy, maxConcurrent);
        await clock.tickAsync(100);
        const result = await promise;

        expect(getMaxActive()).toBeLessThanOrEqual(maxConcurrent);
        expect(result).toEqual([3, 4, 5]);
      });
    });

    it('should handle empty array and sync predicates', async () => {
      const clock = MockClock();
      await runTimelineAsync(clock, async () => {
        expect(await filterAsync([], vi.fn())).toEqual([]);
        expect(await filterAsync([10, 15, 20], (v) => v > 15)).toEqual([20]);
      });
    });
  });

  describe('reduceAsync', () => {
    it('should reduce array asynchronously', async () => {
      const clock = MockClock();
      await runTimelineAsync(clock, async () => {
        const array = [1, 2, 3, 4];
        const callback = vi.fn(async (acc: number, value: number) => {
          await sleep(5);
          return acc + value;
        });

        const promise = reduceAsync(array, callback, 0);
        await clock.tickAsync(50);
        const result = await promise;

        expect(callback).toHaveBeenCalledTimes(4);
        expect(result).toBe(10);
      });
    });

    it('should handle empty array with initial value', async () => {
      const clock = MockClock();
      await runTimelineAsync(clock, async () => {
        const callback = vi.fn<(acc: number, cur: number) => number>();
        const result = await reduceAsync([], callback, 42);
        expect(callback).not.toHaveBeenCalled();
        expect(result).toBe(42);
      });
    });

    it('should work with complex accumulation types', async () => {
      const clock = MockClock();
      await runTimelineAsync(clock, async () => {
        const array = ['a', 'b', 'c'];
        const callback = vi.fn(
          async (acc: Record<string, number>, value: string, index: number) => {
            await sleep(3);
            acc[value] = index;
            return acc;
          },
        );

        const promise = reduceAsync(
          array,
          callback,
          {} as Record<string, number>,
        );
        await clock.tickAsync(30);
        const result = await promise;

        expect(result).toEqual({a: 0, b: 1, c: 2});
      });
    });

    it('should process items strictly sequentially', async () => {
      const clock = MockClock();
      await runTimelineAsync(clock, async () => {
        const array = [1, 2, 3];
        const processingDepth: number[] = [];
        let currentDepth = 0;

        const callback = vi.fn(async (acc: number, value: number) => {
          currentDepth++;
          processingDepth.push(currentDepth);
          await sleep(10);
          currentDepth--;
          return acc + value;
        });

        const promise = reduceAsync(array, callback, 0);
        await clock.tickAsync(100);
        await promise;

        // 因为 reduce 是串行的，深度永远应该是 1
        expect(processingDepth).toEqual([1, 1, 1]);
      });
    });
  });
});

describe.concurrent('Integration and Edge Cases', () => {
  it('filterAsync should maintain original order despite async delays', async () => {
    const clock = MockClock();
    await runTimelineAsync(clock, async () => {
      const array = [5, 1, 8, 3, 9, 2];
      // 模拟完成顺序与数组顺序不一致的情况
      const callback = vi.fn(async (value: number) => {
        await sleep(10 - value); // Value 越小 sleep 越长
        return value > 4;
      });

      const promise = filterAsync(array, callback);
      await clock.tickAsync(50);
      const result = await promise;

      // 无论异步完成顺序如何，结果必须保持原数组顺序
      expect(result).toEqual([5, 8, 9]);
    });
  });

  it('mapAsync should handle large arrays with limited concurrency', async () => {
    const clock = MockClock();
    await runTimelineAsync(clock, async () => {
      const array = Array.from({length: 10}, (_, i) => i);
      const maxConcurrent = 3;
      const {spy, getMaxActive} = createConcurrencySpy(5, (v: number) => v * 2);

      const promise = mapAsync(array, spy, maxConcurrent);
      await clock.tickAsync(50);
      const result = await promise;

      expect(getMaxActive()).toBeLessThanOrEqual(maxConcurrent);
      expect(result.length).toBe(10);
      expect(result[9]).toBe(18);
    });
  });
});
