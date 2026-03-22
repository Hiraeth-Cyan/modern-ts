import {describe, it, expect, vi} from 'vitest';
import {
  apAsync,
  zipAsync,
  allAsync,
  sequenceAsync,
  andAsync,
  orAsync,
} from './combine-async';
import {Ok, Err} from '../../base';
import {UnknownError} from '../../../unknown-error';
import type {Failure, Result, Success} from '../../types';

describe.concurrent('Async Combination Operators', () => {
  const successValue1 = {id: 1, name: 'Item 1'};
  const successValue2 = {id: 2, name: 'Item 2'};
  const errorValue1 = new Error('First error');
  const errorValue2 = new TypeError('Second error');
  const customError = new DOMException('Custom abort', 'AbortError');

  const createAbortSignal = (
    aborted = false,
    reason?: unknown,
  ): AbortSignal => {
    const controller = new AbortController();
    if (aborted) controller.abort(reason);
    return controller.signal;
  };

  // ============================
  // apAsync 函数测试
  // ============================
  describe('apAsync', () => {
    it('should return AbortError even if the function completes after signal is aborted', async () => {
      // 创建一个不检查 signal 的函数，即使 signal 已中止仍返回结果
      const controller = new AbortController();
      const naughtyFunction = vi.fn(
        async (value: unknown, _signal?: AbortSignal) => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          return `Late result: ${String(value)}`;
        },
      );

      const resultFn = Ok(naughtyFunction);
      const resultValue = Ok('test');

      setTimeout(() => {
        controller.abort(customError);
      }, 20);

      const result = await apAsync(resultFn, resultValue, controller.signal);

      expect(result.ok).toBe(false);
      expect((result as Failure<DOMException>).error).toBe(customError);
    });

    it('should return first error when function Result is Err', async () => {
      const resultFn = Err(errorValue1);
      const resultValue = Ok(successValue1);
      const result = await apAsync(resultFn, resultValue);

      expect(result.ok).toBe(false);
      expect((result as Failure<Error>).error).toBe(errorValue1);
    });

    it('should return first error when value Result is Err', async () => {
      const mockFn = vi.fn(); // 不会被调用
      const resultFn = Ok(mockFn);
      const resultValue = Err(errorValue2);
      const result = await apAsync(resultFn, resultValue);

      expect(result.ok).toBe(false);
      expect((result as Failure<TypeError>).error).toBe(errorValue2);
      expect(mockFn).not.toHaveBeenCalled();
    });

    it('should handle aborted signal before execution', async () => {
      const signal = createAbortSignal(true, customError);
      const mockFn = vi.fn();
      const resultFn = Ok(mockFn);
      const resultValue = Ok(successValue1);
      const result = await apAsync(resultFn, resultValue, signal);

      expect(result.ok).toBe(false);
      expect((result as Failure<DOMException>).error).toBeInstanceOf(
        DOMException,
      );
      expect((result as Failure<DOMException>).error.name).toBe('AbortError');
      expect(mockFn).not.toHaveBeenCalled();
    });

    it('should handle function throwing exception', async () => {
      const throwingFn = vi.fn((_value: unknown, signal?: AbortSignal) => {
        signal?.throwIfAborted();
        throw new Error('Function execution failed');
      });
      const resultFn = Ok(throwingFn);
      const resultValue = Ok(successValue1);
      const result = await apAsync(resultFn, resultValue);

      expect(throwingFn).toHaveBeenCalled();
      expect(result.ok).toBe(false);
      expect((result as Failure<UnknownError>).error).toBeInstanceOf(
        UnknownError,
      );
    });

    it('should handle aborted signal during function execution', async () => {
      const controller = new AbortController();
      const abortableFn = vi.fn(
        async (value: unknown, signal?: AbortSignal) => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          signal?.throwIfAborted();
          return value;
        },
      );
      const resultFn = Ok(abortableFn);
      const resultValue = Ok(successValue1);

      setTimeout(() => {
        controller.abort(customError);
      }, 10);

      const result = await apAsync(resultFn, resultValue, controller.signal);

      expect(result.ok).toBe(false);
      expect((result as Failure<DOMException>).error).toBeInstanceOf(
        DOMException,
      );
      expect((result as Failure<DOMException>).error.name).toBe('AbortError');
    });

    it('should handle Promise<Result> inputs', async () => {
      const mockFn = vi.fn(
        (value: unknown) => `Processed: ${JSON.stringify(value)}`,
      );
      const resultFn = Promise.resolve(Ok(mockFn));
      const resultValue = Promise.resolve(Ok(successValue1));
      const result = await apAsync(resultFn, resultValue);

      expect(mockFn).toHaveBeenCalled();
      expect(result.ok).toBe(true);
    });
  });

  // ============================
  // zipAsync 函数测试
  // ============================
  describe('zipAsync', () => {
    it('should combine two Ok values into tuple', async () => {
      const result1 = Ok(successValue1);
      const result2 = Ok(successValue2);
      const result = await zipAsync(result1, result2);

      expect(result.ok).toBe(true);
      expect(
        (result as Success<[typeof successValue1, typeof successValue2]>).value,
      ).toEqual([successValue1, successValue2]);
    });

    it('should return first error from first Err', async () => {
      const result1 = Err(errorValue1);
      const result2 = Ok(successValue2);
      const result = await zipAsync(result1, result2);

      expect(result.ok).toBe(false);
      expect((result as Failure<Error>).error).toBe(errorValue1);
    });

    it('should return first error from second Err', async () => {
      const result1 = Ok(successValue1);
      const result2 = Err(errorValue2);
      const result = await zipAsync(result1, result2);

      expect(result.ok).toBe(false);
      expect((result as Failure<TypeError>).error).toBe(errorValue2);
    });

    it('should handle aborted signal', async () => {
      const signal = createAbortSignal(true, customError);
      const result1 = Ok(successValue1);
      const result2 = Ok(successValue2);
      const result = await zipAsync(result1, result2, signal);

      expect(result.ok).toBe(false);
      expect((result as Failure<DOMException>).error).toBeInstanceOf(
        DOMException,
      );
    });

    it('should handle Promise<Result> inputs', async () => {
      const result1 = Promise.resolve(Ok(successValue1));
      const result2 = Promise.resolve(Ok(successValue2));
      const result = await zipAsync(result1, result2);

      expect(result.ok).toBe(true);
      expect(
        (result as Success<[typeof successValue1, typeof successValue2]>).value,
      ).toEqual([successValue1, successValue2]);
    });
  });

  // ============================
  // allAsync 函数测试
  // ============================
  describe('allAsync', () => {
    it('should return empty array for empty input', async () => {
      const result = await allAsync([]);

      expect(result.ok).toBe(true);
      expect((result as Success<unknown[]>).value).toEqual([]);
    });

    it('should combine all Ok values into array', async () => {
      const results = [Ok(successValue1), Ok(successValue2)];
      const result = await allAsync(results);

      expect(result.ok).toBe(true);
      expect((result as Success<(typeof successValue1)[]>).value).toEqual([
        successValue1,
        successValue2,
      ]);
    });

    it('should short-circuit on first error', async () => {
      const results = [Ok(successValue1), Err(errorValue1), Ok(successValue2)];
      const result = await allAsync(results);

      expect(result.ok).toBe(false);
      expect((result as Failure<Error>).error).toBe(errorValue1);
    });

    it('should handle aborted signal', async () => {
      const signal = createAbortSignal(true, customError);
      const results = [Ok(successValue1), Ok(successValue2)];
      const result = await allAsync(results, signal);

      expect(result.ok).toBe(false);
      expect((result as Failure<DOMException>).error).toBeInstanceOf(
        DOMException,
      );
    });

    it('should handle mixed sync and async Results', async () => {
      const results = [
        Ok(successValue1),
        Promise.resolve(Ok(successValue2)),
        Err(errorValue1),
      ];
      const result = await allAsync(results);

      expect(result.ok).toBe(false);
      expect((result as Failure<Error>).error).toBe(errorValue1);
    });

    it('should preserve order of values', async () => {
      const slowValue = new Promise<Result<number, never>>((resolve) =>
        setTimeout(() => resolve(Ok(3)), 30),
      );
      const fastValue = Promise.resolve(Ok(1));
      const mediumValue = new Promise<Result<number, never>>((resolve) =>
        setTimeout(() => resolve(Ok(2)), 10),
      );

      const results = [fastValue, mediumValue, slowValue];
      const result = await allAsync(results);

      expect(result.ok).toBe(true);
      expect((result as Success<number[]>).value).toEqual([1, 2, 3]);
    });
  });

  // ============================
  // sequenceAsync 函数测试
  // ============================
  describe('sequenceAsync', () => {
    it('should abort immediately if signal is already aborted before starting', async () => {
      const signal = createAbortSignal(true, customError);
      const mockTask = vi.fn().mockResolvedValue(Ok(1));
      const results = [mockTask()];

      const result = await sequenceAsync(results, signal);

      expect(result.ok).toBe(false);
      expect((result as Failure<DOMException>).error).toBe(customError);
    });

    it('should short-circuit on first error', async () => {
      const executionOrder: number[] = [];
      const results = [
        new Promise<Result<number, never>>((resolve) => {
          setTimeout(() => {
            executionOrder.push(1);
            resolve(Ok(1));
          }, 5);
        }),
        Promise.resolve(Err(errorValue1)),
        new Promise<Result<number, never>>((resolve) => {
          setTimeout(() => {
            executionOrder.push(3);
            resolve(Ok(3));
          }, 5);
        }),
      ];

      const result = await sequenceAsync(results);

      expect(result.ok).toBe(false);
      expect((result as Failure<Error>).error).toBe(errorValue1);
      expect(executionOrder).toEqual([1]); // 只执行了第一个
    });

    it('should handle aborted signal between iterations', async () => {
      const controller = new AbortController();
      const executionOrder: number[] = [];
      const results = [
        new Promise<Result<number, never>>((resolve) => {
          setTimeout(() => {
            executionOrder.push(1);
            resolve(Ok(1));
          }, 30);
        }),
        new Promise<Result<number, never>>((resolve) => {
          setTimeout(() => {
            executionOrder.push(2);
            resolve(Ok(2));
          }, 30);
        }),
      ];

      setTimeout(() => {
        controller.abort(customError);
      }, 15);

      const result = await sequenceAsync(results, controller.signal);

      expect(result.ok).toBe(false);
      expect((result as Failure<DOMException>).error).toBeInstanceOf(
        DOMException,
      );
      expect(executionOrder).toEqual([1]); // 只执行了第一个
    });

    it('should return Ok when all promises resolve successfully', async () => {
      const results = [Promise.resolve(Ok(1)), Promise.resolve(Ok(2))];
      const result = await sequenceAsync(results);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual([1, 2]);
      }
    });
  });

  // ============================
  // andAsync 函数测试
  // ============================
  describe('andAsync', () => {
    it('should return second Result when first is Ok', async () => {
      const result1 = Ok(successValue1);
      const result2 = Ok(successValue2);
      const result = await andAsync(result1, result2);

      expect(result.ok).toBe(true);
      expect((result as Success<typeof successValue2>).value).toBe(
        successValue2,
      );
    });

    it('should return first error when first is Err', async () => {
      const result1 = Err(errorValue1);
      const result2 = Ok(successValue2);
      const result = await andAsync(result1, result2);

      expect(result.ok).toBe(false);
      expect((result as Failure<Error>).error).toBe(errorValue1);
    });

    it('should not evaluate second Result when first is Err', async () => {
      const mockFn = vi.fn(() => Ok(successValue2));
      const result1 = Err(errorValue1);
      const result2 = mockFn(); // 创建 Result，但注意 mockFn 被调用
      const result = await andAsync(result1, result2);

      expect(result.ok).toBe(false);
      expect((result as Failure<Error>).error).toBe(errorValue1);
      expect(mockFn).toHaveBeenCalled(); // 虽然被调用，但返回的 Result 不会被等待
    });

    it('should handle aborted signal', async () => {
      const signal = createAbortSignal(true, customError);
      const result1 = Ok(successValue1);
      const result2 = Ok(successValue2);
      const result = await andAsync(result1, result2, signal);

      expect(result.ok).toBe(false);
      expect((result as Failure<DOMException>).error).toBeInstanceOf(
        DOMException,
      );
    });

    it('should handle Promise<Result> inputs', async () => {
      const result1 = Promise.resolve(Ok(successValue1));
      const result2 = Promise.resolve(Err(errorValue2));
      const result = await andAsync(result1, result2);

      expect(result.ok).toBe(false);
      expect((result as Failure<TypeError>).error).toBe(errorValue2);
    });
  });

  // ============================
  // orAsync 函数测试
  // ============================
  describe('orAsync', () => {
    it('should return first Result when first is Ok', async () => {
      const result1 = Ok(successValue1);
      const result2 = Err(errorValue2);
      const result = await orAsync(result1, result2);

      expect(result.ok).toBe(true);
      expect((result as Success<typeof successValue1>).value).toBe(
        successValue1,
      );
    });

    it('should return second Result when first is Err', async () => {
      const result1 = Err(errorValue1);
      const result2 = Ok(successValue2);
      const result = await orAsync(result1, result2);

      expect(result.ok).toBe(true);
      expect((result as Success<typeof successValue2>).value).toBe(
        successValue2,
      );
    });

    it('should return second error when both are Err', async () => {
      const result1 = Err(errorValue1);
      const result2 = Err(errorValue2);
      const result = await orAsync(result1, result2);

      expect(result.ok).toBe(false);
      expect((result as Failure<TypeError>).error).toBe(errorValue2);
    });

    it('should handle aborted signal', async () => {
      const signal = createAbortSignal(true, customError);
      const result1 = Err(errorValue1);
      const result2 = Ok(successValue2);
      const result = await orAsync(result1, result2, signal);

      expect(result.ok).toBe(false);
      expect((result as Failure<DOMException>).error).toBeInstanceOf(
        DOMException,
      );
    });

    it('should not evaluate second Result when first is Ok', async () => {
      const mockFn = vi.fn(() => Err(errorValue2));
      const result1 = Ok(successValue1);
      const result2 = mockFn();
      const result = await orAsync(result1, result2);

      expect(result.ok).toBe(true);
      expect((result as Success<typeof successValue1>).value).toBe(
        successValue1,
      );
      expect(mockFn).toHaveBeenCalled(); // 虽然被调用，但返回的 Result 不会被等待
    });
  });

  // ============================
  // 边界情况测试
  // ============================
  describe('Edge Cases', () => {
    it('should handle null and undefined values in Results', async () => {
      const nullResult = Ok(null);
      const undefinedResult = Ok(undefined);
      const result = await zipAsync(nullResult, undefinedResult);

      expect(result.ok).toBe(true);
      expect((result as Success<[null, undefined]>).value).toEqual([
        null,
        undefined,
      ]);
    });

    it('should wrap non-Error exceptions in UnknownError', async () => {
      const throwingFn = vi.fn(() => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw 'Plain string error';
      });
      const resultFn = Ok(throwingFn);
      const resultValue = Ok(successValue1);
      const result = await apAsync(resultFn, resultValue);

      expect(result.ok).toBe(false);
      expect((result as Failure<UnknownError>).error).toBeInstanceOf(
        UnknownError,
      );
    });

    it('should preserve DOMException AbortError type', async () => {
      const signal = createAbortSignal(true, customError);
      const result = await allAsync([Ok(1), Ok(2)], signal);

      expect(result.ok).toBe(false);
      expect((result as Failure<DOMException>).error).toBeInstanceOf(
        DOMException,
      );
      expect((result as Failure<DOMException>).error.name).toBe('AbortError');
    });

    it('should handle large number of concurrent operations', async () => {
      const count = 100;
      const results = Array.from({length: count}, (_, i) => Ok(i));
      const result = await allAsync(results);

      expect(result.ok).toBe(true);
      expect((result as Success<number[]>).value).toHaveLength(count);
      expect((result as Success<number[]>).value[0]).toBe(0);
      expect((result as Success<number[]>).value[count - 1]).toBe(count - 1);
    });

    it('should handle Results with different error types', async () => {
      const result1 = Err(new Error('Error 1'));
      const result2 = Err(new TypeError('Error 2'));
      const result = await orAsync(result1, result2);

      expect(result.ok).toBe(false);
      expect((result as Failure<Error>).error).toBeInstanceOf(TypeError);
      expect((result as Failure<TypeError>).error.message).toBe('Error 2');
    });
  });
});
