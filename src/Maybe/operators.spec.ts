// ========================================
// ./src/Maybe/operators.spec.ts
// ========================================
import {describe, it, expect} from 'vitest';
import {Some, None} from './base';
import {
  map,
  andThen,
  ap,
  filter,
  mapIf,
  and,
  or,
  orElse,
  fold,
  contains,
  zip,
  zipWith,
  all,
  mapAll,
  partition,
  collectSomes,
  firstSome,
  reduce,
  scan,
  folds,
} from './operators';

describe.concurrent('Maybe operators', () => {
  // ========================================
  // 基础转换
  // ========================================
  describe('map', () => {
    it('should transform Some value', () => {
      expect(map(Some(5), (x) => x * 2)).toBe(10);
    });

    it('should return None for None', () => {
      expect(map(None(), (x) => x * 2)).toBeUndefined();
    });
  });

  describe('andThen', () => {
    it('should chain Some to Some', () => {
      expect(andThen(Some(5), (x) => Some(x * 2))).toBe(10);
    });

    it('should chain Some to None', () => {
      expect(andThen(Some(5), () => None())).toBeUndefined();
    });

    it('should return None for None', () => {
      expect(andThen(None(), (x) => Some(x * 2))).toBeUndefined();
    });
  });

  describe('ap', () => {
    const add = (x: number) => (y: number) => x + y;

    it('should apply Some function to Some value', () => {
      expect(ap(Some(add(5)), Some(3))).toBe(8);
    });

    it('should return None if function is None', () => {
      expect(ap(None(), Some(3))).toBeUndefined();
    });

    it('should return None if value is None', () => {
      expect(ap(Some(add(5)), None())).toBeUndefined();
    });

    it('should return None if both are None', () => {
      expect(ap(None(), None())).toBeUndefined();
    });
  });

  describe('filter', () => {
    const isEven = (x: number) => x % 2 === 0;

    it('should keep Some if predicate true', () => {
      expect(filter(Some(4), isEven)).toBe(4);
    });

    it('should convert Some to None if predicate false', () => {
      expect(filter(Some(3), isEven)).toBeUndefined();
    });

    it('should return None for None', () => {
      expect(filter(None(), isEven)).toBeUndefined();
    });
  });

  describe('mapIf', () => {
    const isEven = (x: number) => x % 2 === 0;
    const double = (x: number) => x * 2;

    it('should transform Some if predicate true', () => {
      expect(mapIf(Some(4), isEven, double)).toBe(8);
    });

    it('should return None if predicate false', () => {
      expect(mapIf(Some(3), isEven, double)).toBeUndefined();
    });

    it('should return None for None', () => {
      expect(mapIf(None(), isEven, double)).toBeUndefined();
    });
  });

  // ========================================
  // 逻辑分支与聚合
  // ========================================
  describe('and', () => {
    it('should return other if first is Some', () => {
      expect(and(Some(1), Some(2))).toBe(2);
      expect(and(Some(1), None())).toBeUndefined();
    });

    it('should return None if first is None', () => {
      expect(and(None(), Some(2))).toBeUndefined();
      expect(and(None(), None())).toBeUndefined();
    });
  });

  describe('or', () => {
    it('should return first if Some', () => {
      expect(or(Some(1), Some(2))).toBe(1);
      expect(or(Some(1), None())).toBe(1);
    });

    it('should return other if first is None', () => {
      expect(or(None(), Some(2))).toBe(2);
      expect(or(None(), None())).toBeUndefined();
    });
  });

  describe('orElse', () => {
    it('should return first if Some', () => {
      expect(orElse(Some(1), () => Some(2))).toBe(1);
    });

    it('should call fn if None', () => {
      expect(orElse(None(), () => Some(2))).toBe(2);
      expect(orElse(None(), () => None())).toBeUndefined();
    });
  });

  describe('fold', () => {
    it('should apply onSome for Some', () => {
      expect(fold(Some(5), 0, (x) => x * 2)).toBe(10);
    });

    it('should return initial for None', () => {
      expect(fold(None(), 0, (x) => x * 2)).toBe(0);
    });
  });

  describe('contains', () => {
    it('should return true for Some with matching value', () => {
      expect(contains(Some(5), 5)).toBe(true);
    });

    it('should return false for Some with different value', () => {
      expect(contains(Some(5), 3)).toBe(false);
    });

    it('should return false for None', () => {
      expect(contains(None(), 5)).toBe(false);
    });
  });

  // ========================================
  // 多元组合
  // ========================================
  describe('zip', () => {
    it('should return Some tuple if both are Some', () => {
      expect(zip(Some(1), Some(2))).toEqual([1, 2]);
    });

    it('should return None if first is None', () => {
      expect(zip(None(), Some(2))).toBeUndefined();
    });

    it('should return None if second is None', () => {
      expect(zip(Some(1), None())).toBeUndefined();
    });

    it('should return None if both are None', () => {
      expect(zip(None(), None())).toBeUndefined();
    });
  });

  describe('zipWith', () => {
    const add = (a: number, b: number) => a + b;

    it('should apply function if both are Some', () => {
      expect(zipWith(Some(1), Some(2), add)).toBe(3);
    });

    it('should return None if first is None', () => {
      expect(zipWith(None(), Some(2), add)).toBeUndefined();
    });

    it('should return None if second is None', () => {
      expect(zipWith(Some(1), None(), add)).toBeUndefined();
    });

    it('should return None if both are None', () => {
      expect(zipWith(None(), None(), add)).toBeUndefined();
    });
  });

  // ========================================
  // 集合处理
  // ========================================
  describe('all', () => {
    it('should return Some array if all are Some', () => {
      expect(all([Some(1), Some(2), Some(3)])).toEqual([1, 2, 3]);
    });

    it('should return None if any is None', () => {
      expect(all([Some(1), None(), Some(3)])).toBeUndefined();
      expect(all([None()])).toBeUndefined();
      expect(all([])).toEqual([]);
    });
  });

  describe('mapAll', () => {
    const safeDivide = (x: number) => (y: number) =>
      y === 0 ? None() : Some(x / y);

    it('should return Some array if all succeed', () => {
      expect(mapAll([2, 4, 6], (x, i) => Some(x + i))).toEqual([2, 5, 8]);
    });

    it('should return None if any fails', () => {
      expect(mapAll([2, 0, 6], safeDivide(10))).toBeUndefined();
    });

    it('should handle empty array', () => {
      expect(mapAll([], () => Some(1))).toEqual([]);
    });
  });

  describe('partition', () => {
    it('should separate Some and None', () => {
      expect(partition([Some(1), None(), Some(3), None(), Some(5)])).toEqual([
        [1, 3, 5],
        2,
      ]);
    });

    it('should handle empty array', () => {
      expect(partition([])).toEqual([[], 0]);
    });

    it('should handle all Some', () => {
      expect(partition([Some(1), Some(2)])).toEqual([[1, 2], 0]);
    });

    it('should handle all None', () => {
      expect(partition([None(), None()])).toEqual([[], 2]);
    });
  });

  describe('collectSomes', () => {
    it('should collect only Some values', () => {
      expect(collectSomes([Some(1), None(), Some(3), None(), Some(5)])).toEqual(
        [1, 3, 5]
      );
    });

    it('should return empty array if all None', () => {
      expect(collectSomes([None(), None()])).toEqual([]);
    });
  });

  describe('firstSome', () => {
    it('should return first Some', () => {
      expect(firstSome([None(), Some(2), Some(3)])).toBe(2);
    });

    it('should return None if no Some', () => {
      expect(firstSome([None(), None()])).toBeUndefined();
    });

    it('should handle empty array', () => {
      expect(firstSome([])).toBeUndefined();
    });
  });

  // ========================================
  // 高级规约
  // ========================================
  describe('reduce', () => {
    it('should reduce if all are Some', () => {
      expect(reduce([Some(1), Some(2), Some(3)], 0, (acc, x) => acc + x)).toBe(
        6
      );
    });

    it('should return None if any is None', () => {
      expect(reduce([Some(1), None(), Some(3)], 0, (acc, x) => acc + x)).toBe(
        undefined
      );
    });

    it('should handle empty array', () => {
      expect(reduce([], 10, (acc: number, x: number) => acc + x)).toBe(10);
    });
  });

  describe('scan', () => {
    it('should scan if all are Some', () => {
      expect(scan([Some(1), Some(2), Some(3)], 0, (acc, x) => acc + x)).toEqual(
        [0, 1, 3, 6]
      );
    });

    it('should return None if any is None', () => {
      expect(scan([Some(1), None(), Some(3)], 0, (acc, x) => acc + x)).toBe(
        undefined
      );
    });

    it('should handle empty array', () => {
      expect(scan([], 10, (acc: number, x: number) => acc + x)).toEqual([10]);
    });
  });

  describe('folds', () => {
    it('should fold with separate handlers', () => {
      const result = folds(
        [Some(1), None(), Some(3), None(), Some(5)],
        [] as string[],
        (acc, v) => [...acc, `some:${v}`],
        (acc) => [...acc, 'none']
      );
      expect(result).toEqual(['some:1', 'none', 'some:3', 'none', 'some:5']);
    });

    it('should handle empty array', () => {
      expect(
        folds(
          [],
          [] as string[],
          (acc, v: number) => [...acc, `some:${v}`],
          (acc) => [...acc, 'none']
        )
      ).toEqual([]);
    });
  });
});
