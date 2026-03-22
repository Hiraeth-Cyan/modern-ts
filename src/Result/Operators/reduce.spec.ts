import {describe, it, expect, vi} from 'vitest';
import {Ok, Err, isOk, isErr} from '../base';
import type {Result, Success, Failure} from '../types';
import {reduce} from './reduce';

const add = (a: number, b: number) => a + b;

describe('Reducer Functions', () => {
  describe('reduce', () => {
    it('should reduce all Ok results to a single Ok', () => {
      const results = [Ok(1), Ok(2), Ok(3)] as const;
      const reduced = reduce(results, 0, add);

      expect(isOk(reduced)).toBe(true);
      expect((reduced as Success<number>).value).toBe(6);
    });

    it('should short-circuit and return first Err', () => {
      const error = new Error('failed');
      const results = [Ok(1), Err(error), Ok(3)] as const;
      const reduced = reduce(results, 0, add);

      expect(isErr(reduced)).toBe(true);
      expect((reduced as Failure<Error>).error).toBe(error);
    });

    it('should handle empty array of results', () => {
      const results: Result<number, string>[] = [];
      const reduced = reduce(results, 10, add);

      expect(isOk(reduced)).toBe(true);
      expect((reduced as Success<number>).value).toBe(10);
    });

    it('should apply reducer in correct order', () => {
      const results = [Ok(1), Ok(2), Ok(3)] as const;
      const reducer = vi.fn((acc: number, val: number) => acc + val);
      const reduced = reduce(results, 0, reducer);

      expect((reduced as Success<number>).value).toBe(6);
      expect(reducer).toHaveBeenCalledTimes(3);
      expect(reducer).toHaveBeenNthCalledWith(1, 0, 1);
      expect(reducer).toHaveBeenNthCalledWith(2, 1, 2);
      expect(reducer).toHaveBeenNthCalledWith(3, 3, 3);
    });
  });

  describe('Edge Cases', () => {
    it('should handle mixed Result types with type guards', () => {
      const results: Result<number, string>[] = [
        Ok(1),
        Math.random() > 0.5 ? Ok(2) : Err('maybe error'),
      ];

      const reduced = reduce(results, 0, add);

      if (isOk(reduced)) {
        expect(typeof reduced.value).toBe('number');
      } else {
        expect(typeof reduced.error).toBe('string');
      }
    });

    it('should maintain immutability of input arrays', () => {
      const originalArray = [Ok(1), Ok(2), Ok(3)];
      const results = [...originalArray];
      const reduced = reduce(results, 0, add);

      expect(results).toEqual(originalArray);
      expect((reduced as Success<number>).value).toBe(6);
    });
  });
});
