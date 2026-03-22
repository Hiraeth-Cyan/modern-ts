// ========================================
// ./src/Maybe/operators-async.spec.ts
// ========================================

import {describe, it, expect} from 'vitest';
import {
  apAsync,
  mapAsync,
  mapIfAsync,
  andThenAsync,
  filterAsync,
  zipAsync,
  foldAsync,
  orElseAsync,
  mapAllAsync,
  allAsync,
  firstSomeAsync,
  reduceAsync,
  scanAsync,
  collectSomesAsync,
  partitionAsync,
} from './operators-async';
import {Some, None, isSome, isNone} from './base';
import type {AnyMaybe} from './types';

// ============================
// 测试辅助函数
// ============================
const double = (x: number) => x * 2;
const asyncDouble = async (x: number) => {
  await new Promise((resolve) => setTimeout(resolve, 10));
  return x * 2;
};

const isEven = (x: number) => x % 2 === 0;
const asyncIsEven = async (x: number) => {
  await new Promise((resolve) => setTimeout(resolve, 10));
  return x % 2 === 0;
};

// ============================
// 核心转换操作测试
// ============================
describe.concurrent('Core Transformation Tests', () => {
  describe('apAsync', () => {
    it('should apply async function to async value when both are Some', async () => {
      const fnMaybe = Some(double);
      const valMaybe = Some(5);
      const result = await apAsync(fnMaybe, valMaybe);
      expect(isSome(result)).toBe(true);
      expect(result).toBe(10);
    });

    it('should return None when function is None', async () => {
      const fnMaybe = None();
      const valMaybe = Some(5);
      const result = await apAsync(fnMaybe, valMaybe);
      expect(isNone(result)).toBe(true);
    });

    it('should return None when value is None', async () => {
      const fnMaybe = Some(double);
      const valMaybe = None();
      const result = await apAsync(fnMaybe, valMaybe);
      expect(isNone(result)).toBe(true);
    });

    it('should work with async functions and values', async () => {
      const fnMaybe = Promise.resolve(Some(asyncDouble));
      const valMaybe = Promise.resolve(Some(3));
      const result = await apAsync(fnMaybe, valMaybe);
      expect(isSome(result)).toBe(true);
      expect(result).toBe(6);
    });

    it('should respect AbortSignal', async () => {
      const controller = new AbortController();
      const signal = controller.signal;
      controller.abort();

      const fnMaybe = Some(double);
      const valMaybe = Some(5);

      await expect(apAsync(fnMaybe, valMaybe, signal)).rejects.toThrow();
    });
  });

  describe('mapAsync', () => {
    it('should transform Some value with async function', async () => {
      const valMaybe = Some(7);
      const result = await mapAsync(valMaybe, asyncDouble);
      expect(isSome(result)).toBe(true);
      expect(result).toBe(14);
    });

    it('should return None when input is None', async () => {
      const valMaybe = None();
      const result = await mapAsync(valMaybe, asyncDouble);
      expect(isNone(result)).toBe(true);
    });

    it('should work with Promise input', async () => {
      const valMaybe = Promise.resolve(Some(4));
      const result = await mapAsync(valMaybe, asyncDouble);
      expect(isSome(result)).toBe(true);
      expect(result).toBe(8);
    });

    it('should respect AbortSignal', async () => {
      const controller = new AbortController();
      const signal = controller.signal;
      controller.abort();

      const valMaybe = Some(3);

      await expect(mapAsync(valMaybe, asyncDouble, signal)).rejects.toThrow();
    });
  });

  describe('mapIfAsync', () => {
    it('should transform when predicate passes', async () => {
      const valMaybe = Some(6);
      const result = await mapIfAsync(valMaybe, isEven, asyncDouble);
      expect(isSome(result)).toBe(true);
      expect(result).toBe(12);
    });

    it('should return None when predicate fails', async () => {
      const valMaybe = Some(5);
      const result = await mapIfAsync(valMaybe, isEven, asyncDouble);
      expect(isNone(result)).toBe(true);
    });

    it('should return None when input is None', async () => {
      const valMaybe = None();
      const result = await mapIfAsync(valMaybe, isEven, asyncDouble);
      expect(isNone(result)).toBe(true);
    });

    it('should work with async predicate', async () => {
      const valMaybe = Some(8);
      const result = await mapIfAsync(valMaybe, asyncIsEven, asyncDouble);
      expect(isSome(result)).toBe(true);
      expect(result).toBe(16);
    });
  });

  describe('andThenAsync', () => {
    it('should chain async computations', async () => {
      const valMaybe = Some(2);
      const result = await andThenAsync(valMaybe, (v) => Some(v * 3));
      expect(isSome(result)).toBe(true);
      expect(result).toBe(6);
    });

    it('should return None when input is None', async () => {
      const valMaybe = None();
      const result = await andThenAsync(valMaybe, (v: number) => Some(v * 3));
      expect(isNone(result)).toBe(true);
    });

    it('should chain to None when inner function returns None', async () => {
      const valMaybe = Some(2);
      const result = await andThenAsync(valMaybe, () => None());
      expect(isNone(result)).toBe(true);
    });

    it('should work with async inner function', async () => {
      const valMaybe = Some(3);
      const result = await andThenAsync(valMaybe, async (v) =>
        Promise.resolve(Some(v * 4))
      );
      expect(isSome(result)).toBe(true);
      expect(result).toBe(12);
    });
  });

  describe('filterAsync', () => {
    it('should keep value when predicate passes', async () => {
      const valMaybe = Some(4);
      const result = await filterAsync(valMaybe, isEven);
      expect(isSome(result)).toBe(true);
      expect(result).toBe(4);
    });

    it('should return None when predicate fails', async () => {
      const valMaybe = Some(5);
      const result = await filterAsync(valMaybe, isEven);
      expect(isNone(result)).toBe(true);
    });

    it('should return None when input is None', async () => {
      const valMaybe = None();
      const result = await filterAsync(valMaybe, isEven);
      expect(isNone(result)).toBe(true);
    });

    it('should work with async predicate', async () => {
      const valMaybe = Some(6);
      const result = await filterAsync(valMaybe, asyncIsEven);
      expect(isSome(result)).toBe(true);
      expect(result).toBe(6);
    });
  });
});

// ============================
// 组合操作测试
// ============================
describe.concurrent('Combination Operations Tests', () => {
  describe('zipAsync', () => {
    it('should zip two Some values into tuple', async () => {
      const a = Some('hello');
      const b = Some(42);
      const result = await zipAsync(a, b);
      expect(isSome(result)).toBe(true);
      expect(result).toEqual(['hello', 42]);
    });

    it('should return None when first is None', async () => {
      const a = None();
      const b = Some(42);
      const result = await zipAsync(a, b);
      expect(isNone(result)).toBe(true);
    });

    it('should return None when second is None', async () => {
      const a = Some('hello');
      const b = None();
      const result = await zipAsync(a, b);
      expect(isNone(result)).toBe(true);
    });

    it('should work with async inputs', async () => {
      const a = Promise.resolve(Some('a'));
      const b = Promise.resolve(Some(1));
      const result = await zipAsync(a, b);
      expect(isSome(result)).toBe(true);
      expect(result).toEqual(['a', 1]);
    });
  });
});

// ============================
// 逻辑分支与错误处理测试
// ============================
describe.concurrent('Branching & Error Handling Tests', () => {
  describe('foldAsync', () => {
    it('should apply onSome when value is Some', async () => {
      const valMaybe = Some(10);
      const result = await foldAsync(valMaybe, 0, (v) => v * 2);
      expect(result).toBe(20);
    });

    it('should return initial when value is None', async () => {
      const valMaybe = None();
      const result = await foldAsync(valMaybe, 0, (v: number) => v * 2);
      expect(result).toBe(0);
    });

    it('should work with async initial and onSome', async () => {
      const valMaybe = Some(5);
      const result = await foldAsync(
        valMaybe,
        Promise.resolve(100),
        async (v) => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return v * 3;
        }
      );
      expect(result).toBe(15);
    });
  });

  describe('orElseAsync', () => {
    it('should return original value when Some', async () => {
      const valMaybe = Some('original');
      const result = await orElseAsync(valMaybe, () => Some('fallback'));
      expect(isSome(result)).toBe(true);
      expect(result).toBe('original');
    });

    it('should return fallback when original is None', async () => {
      const valMaybe = None();
      const result = await orElseAsync(valMaybe, () => Some('fallback'));
      expect(isSome(result)).toBe(true);
      expect(result).toBe('fallback');
    });

    it('should work with async fallback', async () => {
      const valMaybe = None();
      const result = await orElseAsync(valMaybe, async () =>
        Promise.resolve(Some('async fallback'))
      );
      expect(isSome(result)).toBe(true);
      expect(result).toBe('async fallback');
    });
  });
});

// ============================
// 集合操作测试
// ============================
describe.concurrent('Collection Operations Tests', () => {
  describe('mapAllAsync', () => {
    it('should map all items successfully', async () => {
      const items = [1, 2, 3];
      const result = await mapAllAsync(items, (it) => Some(it * 2));
      expect(isSome(result)).toBe(true);
      expect(result).toEqual([2, 4, 6]);
    });

    it('should return None if any mapping fails', async () => {
      const items = [1, 2, 3];
      const result = await mapAllAsync(items, (it) =>
        it === 2 ? None() : Some(it * 2)
      );
      expect(isNone(result)).toBe(true);
    });

    it('should work with async mapping function', async () => {
      const items = [1, 2, 3];
      const result = await mapAllAsync(items, async (it) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return Some(it * 3);
      });
      expect(isSome(result)).toBe(true);
      expect(result).toEqual([3, 6, 9]);
    });
  });

  describe('allAsync', () => {
    it('should return all values when all are Some', async () => {
      const vals = [Some(1), Some(2), Some(3)];
      const result = await allAsync(vals);
      expect(isSome(result)).toBe(true);
      expect(result).toEqual([1, 2, 3]);
    });

    it('should return None when any is None', async () => {
      const vals = [Some(1), None(), Some(3)];
      const result = await allAsync(vals);
      expect(isNone(result)).toBe(true);
    });

    it('should work with async Maybes', async () => {
      const vals = [Promise.resolve(Some(1)), Promise.resolve(Some(2))];
      const result = await allAsync(vals);
      expect(isSome(result)).toBe(true);
      expect(result).toEqual([1, 2]);
    });
  });

  describe('firstSomeAsync', () => {
    it('should return first Some value', async () => {
      const vals = [None(), Some('first'), Some('second')];
      const result = await firstSomeAsync(vals);
      expect(isSome(result)).toBe(true);
      expect(result).toBe('first');
    });

    it('should return None when all are None', async () => {
      const vals = [None(), None(), None()];
      const result = await firstSomeAsync(vals);
      expect(isNone(result)).toBe(true);
    });

    it('should work with async Maybes', async () => {
      const vals = [
        Promise.resolve(None()),
        Promise.resolve(Some('async first')),
      ];
      const result = await firstSomeAsync(vals);
      expect(isSome(result)).toBe(true);
      expect(result).toBe('async first');
    });
  });
});

// ============================
// 规约与聚合测试
// ============================
describe.concurrent('Reduction & Aggregation Tests', () => {
  describe('reduceAsync', () => {
    it('should reduce array of Some values', async () => {
      const vals = [Some(1), Some(2), Some(3)];
      const result = await reduceAsync(vals, 0, (acc, v) => acc + v);
      expect(isSome(result)).toBe(true);
      expect(result).toBe(6);
    });

    it('should return None if any value is None', async () => {
      const vals = [Some(1), None(), Some(3)];
      const result = await reduceAsync(vals, 0, (acc, v) => acc + v);
      expect(isNone(result)).toBe(true);
    });

    it('should work with async reducer', async () => {
      const vals = [Some(1), Some(2)];
      const result = await reduceAsync(vals, 10, async (acc, v) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return acc + v;
      });
      expect(isSome(result)).toBe(true);
      expect(result).toBe(13);
    });
  });

  describe('scanAsync', () => {
    it('should produce intermediate results', async () => {
      const vals = [Some(1), Some(2), Some(3)];
      const result = await scanAsync(vals, 0, (acc, v) => acc + v);
      expect(isSome(result)).toBe(true);
      expect(result).toEqual([0, 1, 3, 6]);
    });

    it('should return None if any value is None', async () => {
      const vals = [Some(1), None(), Some(3)];
      const result = await scanAsync(vals, 0, (acc, v) => acc + v);
      expect(isNone(result)).toBe(true);
    });

    it('should work with async scanner', async () => {
      const vals = [Some(1), Some(2)];
      const result = await scanAsync(vals, 10, async (acc, v) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return acc + v;
      });
      expect(isSome(result)).toBe(true);
      expect(result).toEqual([10, 11, 13]);
    });
  });
});

// ============================
// 集合筛选与统计测试
// ============================
describe.concurrent('Collection Filtering & Statistics Tests', () => {
  describe('collectSomesAsync', () => {
    it('should collect only Some values', async () => {
      const vals = [Some(1), None(), Some(3), None(), Some(5)];
      const result = await collectSomesAsync(vals);
      expect(result).toEqual([1, 3, 5]);
    });

    it('should return empty array for all None', async () => {
      const vals = [None(), None(), None()];
      const result = await collectSomesAsync(vals);
      expect(result).toEqual([]);
    });

    it('should work with async Maybes', async () => {
      const vals = [
        Promise.resolve(Some(1)),
        Promise.resolve(None()),
        Promise.resolve(Some(2)),
      ];
      const result = await collectSomesAsync(vals);
      expect(result).toEqual([1, 2]);
    });
  });

  describe('partitionAsync', () => {
    it('should partition Some and None values', async () => {
      const vals = [Some(1), None(), Some(3), None(), Some(5)];
      const [somes, noneCount] = await partitionAsync(vals);
      expect(somes).toEqual([1, 3, 5]);
      expect(noneCount).toBe(2);
    });

    it('should handle empty input', async () => {
      const vals: AnyMaybe<number>[] = [];
      const [somes, noneCount] = await partitionAsync(vals);
      expect(somes).toEqual([]);
      expect(noneCount).toBe(0);
    });
  });
});
