import {beforeEach, describe, it, expect, vi} from 'vitest';
import {collectOkAsync, collectErrAsync, partitionAsync} from './partition-async';
import {Ok, Err} from '../../base';
import type {Result} from '../../types';

type TestSuccess = {id: number; name: string};
type TestError = Error | TypeError;

const successValue1: TestSuccess = {id: 1, name: 'Test1'};
const successValue2: TestSuccess = {id: 2, name: 'Test2'};
const errorValue1: TestError = new Error('Error 1');
const errorValue2: TestError = new TypeError('Type Error');

const createAbortSignal = (aborted = false, reason?: unknown): AbortSignal => {
  const controller = new AbortController();
  if (aborted) {
    controller.abort(reason);
  }
  return controller.signal;
};

describe.concurrent('partitionAsync and related functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('collectOkAsync', () => {
    it('should collect only Ok values from mixed array', async () => {
      const results = [
        Ok(successValue1),
        Err(errorValue1),
        Ok(successValue2),
        Err(errorValue2),
      ];

      const collected = await collectOkAsync(results);

      expect(collected).toHaveLength(2);
      expect(collected).toEqual([successValue1, successValue2]);
    });

    it('should return empty array when all results are Err', async () => {
      const results: Result<TestSuccess, TestError>[] = [
        Err(errorValue1),
        Err(errorValue2),
      ];

      const collected = await collectOkAsync(results);

      expect(collected).toHaveLength(0);
      expect(collected).toEqual([]);
    });

    it('should return all values when all results are Ok', async () => {
      const results: Result<TestSuccess, TestError>[] = [
        Ok(successValue1),
        Ok(successValue2),
      ];

      const collected = await collectOkAsync(results);

      expect(collected).toHaveLength(2);
      expect(collected).toEqual([successValue1, successValue2]);
    });

    it('should handle empty input array', async () => {
      const results: Result<TestSuccess, TestError>[] = [];

      const collected = await collectOkAsync(results);

      expect(collected).toHaveLength(0);
      expect(collected).toEqual([]);
    });

    it('should handle Promise<Result> inputs', async () => {
      const results = [
        Promise.resolve(Ok(successValue1)),
        Promise.resolve(Err(errorValue1)),
        Ok(successValue2),
      ];

      const collected = await collectOkAsync(results);

      expect(collected).toHaveLength(2);
      expect(collected).toEqual([successValue1, successValue2]);
    });

    it('should reject with DOMException when signal is already aborted', async () => {
      const signal = createAbortSignal(
        true,
        new DOMException('Aborted', 'AbortError'),
      );
      const results: Result<TestSuccess, TestError>[] = [Ok(successValue1)];

      await expect(collectOkAsync(results, signal)).rejects.toBeInstanceOf(
        DOMException,
      );
      await expect(collectOkAsync(results, signal)).rejects.toHaveProperty(
        'name',
        'AbortError',
      );
    });

    it('should handle abort during execution', async () => {
      const controller = new AbortController();
      const results = [
        Ok(successValue1),
        new Promise<Result<TestSuccess, never>>((resolve) => {
          setTimeout(() => resolve(Ok(successValue2)), 50);
        }),
      ];

      const promise = collectOkAsync(results, controller.signal);
      controller.abort(new DOMException('Aborted', 'AbortError'));

      await expect(promise).rejects.toBeInstanceOf(DOMException);
      await expect(promise).rejects.toHaveProperty('name', 'AbortError');
    });

    it('should preserve the order of Ok values as they appear', async () => {
      const results = [
        Err(errorValue1),
        Ok(successValue1),
        Err(errorValue2),
        Ok(successValue2),
        Err(new Error('Error 3')),
      ];

      const collected = await collectOkAsync(results);

      expect(collected).toEqual([successValue1, successValue2]);
    });
  });

  describe('collectErrAsync', () => {
    it('should collect only Err values from mixed array', async () => {
      const results = [
        Ok(successValue1),
        Err(errorValue1),
        Ok(successValue2),
        Err(errorValue2),
      ];

      const collected = await collectErrAsync(results);

      expect(collected).toHaveLength(2);
      expect(collected).toEqual([errorValue1, errorValue2]);
    });

    it('should return empty array when all results are Ok', async () => {
      const results: Result<TestSuccess, TestError>[] = [
        Ok(successValue1),
        Ok(successValue2),
      ];

      const collected = await collectErrAsync(results);

      expect(collected).toHaveLength(0);
      expect(collected).toEqual([]);
    });

    it('should return all errors when all results are Err', async () => {
      const results: Result<TestSuccess, TestError>[] = [
        Err(errorValue1),
        Err(errorValue2),
      ];

      const collected = await collectErrAsync(results);

      expect(collected).toHaveLength(2);
      expect(collected).toEqual([errorValue1, errorValue2]);
    });

    it('should handle empty input array', async () => {
      const results: Result<TestSuccess, TestError>[] = [];

      const collected = await collectErrAsync(results);

      expect(collected).toHaveLength(0);
      expect(collected).toEqual([]);
    });

    it('should handle Promise<Result> inputs', async () => {
      const results = [
        Promise.resolve(Ok(successValue1)),
        Promise.resolve(Err(errorValue1)),
        Err(errorValue2),
      ];

      const collected = await collectErrAsync(results);

      expect(collected).toHaveLength(2);
      expect(collected).toEqual([errorValue1, errorValue2]);
    });

    it('should reject with DOMException when signal is already aborted', async () => {
      const signal = createAbortSignal(true, 'Custom abort reason');
      const results: Result<TestSuccess, TestError>[] = [Err(errorValue1)];

      const promise = collectErrAsync(results, signal);
      await expect(promise).rejects.toBeInstanceOf(DOMException);

      try {
        await promise;
      } catch (error) {
        expect(error).toBeInstanceOf(DOMException);
        expect((error as DOMException).name).toBe('AbortError');
        expect((error as DOMException).cause).toBe('Custom abort reason');
      }
    });

    it('should throw signal.reason when aborted during execution', async () => {
      const controller = new AbortController();
      const results = [
        Err(errorValue1),
        new Promise<Result<TestSuccess, never>>((resolve) => {
          setTimeout(() => resolve(Ok(successValue2)), 50);
        }),
      ];

      const promise = collectErrAsync(results, controller.signal);
      controller.abort('Aborted during execution');

      await expect(promise).rejects.toBe('Aborted during execution');
    });

    it('should preserve the order of Err values as they appear', async () => {
      const results = [
        Ok(successValue1),
        Err(errorValue1),
        Ok(successValue2),
        Err(errorValue2),
        Ok(successValue1),
      ];

      const collected = await collectErrAsync(results);

      expect(collected).toEqual([errorValue1, errorValue2]);
    });
  });

  describe('partitionAsync', () => {
    it('should partition mixed array into success and error arrays', async () => {
      const results = [
        Ok(successValue1),
        Err(errorValue1),
        Ok(successValue2),
        Err(errorValue2),
      ];

      const [oks, errs] = await partitionAsync(results);

      expect(oks).toEqual([successValue1, successValue2]);
      expect(errs).toEqual([errorValue1, errorValue2]);
    });

    it('should handle all Ok results', async () => {
      const results: Result<TestSuccess, TestError>[] = [
        Ok(successValue1),
        Ok(successValue2),
      ];

      const [oks, errs] = await partitionAsync(results);

      expect(oks).toEqual([successValue1, successValue2]);
      expect(errs).toHaveLength(0);
    });

    it('should handle all Err results', async () => {
      const results: Result<TestSuccess, TestError>[] = [
        Err(errorValue1),
        Err(errorValue2),
      ];

      const [oks, errs] = await partitionAsync(results);

      expect(oks).toHaveLength(0);
      expect(errs).toEqual([errorValue1, errorValue2]);
    });

    it('should handle empty input array', async () => {
      const results: Result<TestSuccess, TestError>[] = [];

      const [oks, errs] = await partitionAsync(results);

      expect(oks).toHaveLength(0);
      expect(errs).toHaveLength(0);
    });

    it('should handle Promise<Result> inputs', async () => {
      const results = [
        Promise.resolve(Ok(successValue1)),
        Promise.resolve(Err(errorValue1)),
        Ok(successValue2),
      ];

      const [oks, errs] = await partitionAsync(results);

      expect(oks).toEqual([successValue1, successValue2]);
      expect(errs).toEqual([errorValue1]);
    });

    it('should reject with DOMException when signal is already aborted', async () => {
      const signal = createAbortSignal(
        true,
        new DOMException('Aborted', 'AbortError'),
      );
      const results: Result<TestSuccess, TestError>[] = [Ok(successValue1)];

      await expect(partitionAsync(results, signal)).rejects.toBeInstanceOf(
        DOMException,
      );
      await expect(partitionAsync(results, signal)).rejects.toHaveProperty(
        'name',
        'AbortError',
      );
    });

    it('should throw signal.reason when aborted during execution', async () => {
      const controller = new AbortController();
      const results = [
        Ok(successValue1),
        new Promise<Result<TestSuccess, never>>((resolve) => {
          setTimeout(() => resolve(Ok(successValue1)), 50);
        }),
      ];

      const promise = partitionAsync(results, controller.signal);
      controller.abort('Aborted during partition');

      await expect(promise).rejects.toBe('Aborted during partition');
    });

    it('should preserve order in both arrays', async () => {
      const results = [
        Err(errorValue1),
        Ok(successValue1),
        Err(errorValue2),
        Ok(successValue2),
        Err(new Error('Error 3')),
      ];

      const [oks, errs] = await partitionAsync(results);

      expect(oks).toEqual([successValue1, successValue2]);
      expect(errs).toEqual([errorValue1, errorValue2, new Error('Error 3')]);
    });

    it('should include UnknownError in error array when Promise rejects with DOMException', async () => {
      const results = [
        Ok(successValue1),
        Promise.reject(new DOMException('Rejected', 'AbortError')),
        Err(errorValue1),
      ];

      const [oks, errs] = await partitionAsync(results);

      expect(oks).toEqual([successValue1]);
      expect(errs).toHaveLength(2);
      expect(errs[0]).toBeInstanceOf(DOMException);
      expect(errs[1]).toEqual(errorValue1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null and undefined values in Ok results', async () => {
      const results: Result<TestSuccess | null | undefined, TestError>[] = [
        Ok(null),
        Ok(undefined),
        Err(errorValue1),
      ];

      const [oks, errs] = await partitionAsync(results);
      const collectedOks = await collectOkAsync(results);
      const collectedErrs = await collectErrAsync(results);

      expect(oks).toEqual([null, undefined]);
      expect(collectedOks).toEqual([null, undefined]);
      expect(errs).toEqual([errorValue1]);
      expect(collectedErrs).toEqual([errorValue1]);
    });
  });
});
