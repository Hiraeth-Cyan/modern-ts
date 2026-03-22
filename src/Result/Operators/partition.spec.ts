import {describe, it, expect} from 'vitest';
import {collectOk, collectErr, partition} from './partition';
import {Ok, Err} from '../base';
import {type Result} from '../types';

const successValues = [1, 2, 3];
const errorValues = ['error1', 'error2'];

const createMixedResults = (): Result<number, string>[] => [
  Ok(1),
  Err('error1'),
  Ok(2),
  Ok(3),
  Err('error2'),
];

describe.concurrent('Result Operators - partition utilities', () => {
  describe('collectOk', () => {
    it('should collect only success values from mixed array', () => {
      const results = createMixedResults();
      const successes = collectOk(results);
      expect(successes).toEqual([1, 2, 3]);
    });

    it('should return empty array when all results are errors', () => {
      const results: Result<number, string>[] = [Err('e1'), Err('e2')];
      const successes = collectOk(results);
      expect(successes).toEqual([]);
    });

    it('should return all values when all results are successes', () => {
      const results = successValues.map((v) => Ok(v));
      const successes = collectOk(results);
      expect(successes).toEqual(successValues);
    });

    it('should handle empty input array', () => {
      const successes = collectOk([]);
      expect(successes).toEqual([]);
    });
  });

  describe('collectErr', () => {
    it('should collect only error values from mixed array', () => {
      const results = createMixedResults();
      const errors = collectErr(results);
      expect(errors).toEqual(['error1', 'error2']);
    });

    it('should return empty array when all results are successes', () => {
      const results = successValues.map((v) => Ok(v));
      const errors = collectErr(results);
      expect(errors).toEqual([]);
    });

    it('should return all values when all results are errors', () => {
      const results = errorValues.map((e) => Err(e));
      const errors = collectErr(results);
      expect(errors).toEqual(errorValues);
    });

    it('should handle empty input array', () => {
      const errors = collectErr([]);
      expect(errors).toEqual([]);
    });
  });

  describe('partition', () => {
    it('should split mixed results into successes and errors', () => {
      const results = createMixedResults();
      const [successes, errors] = partition(results);
      expect(successes).toEqual([1, 2, 3]);
      expect(errors).toEqual(['error1', 'error2']);
    });

    it('should return empty arrays for appropriate sides when all successes or all errors', () => {
      const allSuccesses = successValues.map((v) => Ok(v));
      const [successes1, errors1] = partition(allSuccesses);
      expect(successes1).toEqual(successValues);
      expect(errors1).toEqual([]);

      const allErrors = errorValues.map((e) => Err(e));
      const [successes2, errors2] = partition(allErrors);
      expect(successes2).toEqual([]);
      expect(errors2).toEqual(errorValues);
    });

    it('should handle empty input array', () => {
      const [successes, errors] = partition([]);
      expect(successes).toEqual([]);
      expect(errors).toEqual([]);
    });

    it('should preserve order of successes and errors', () => {
      const results: Result<string, string>[] = [
        Ok('a'),
        Err('error1'),
        Ok('b'),
        Err('error2'),
        Ok('c'),
      ];
      const [successes, errors] = partition(results);
      expect(successes).toEqual(['a', 'b', 'c']);
      expect(errors).toEqual(['error1', 'error2']);
    });
  });
});
