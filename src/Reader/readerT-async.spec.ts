// ========================================
// ./src/Reader/readerT-async.spec.ts
// ========================================

import type {AsyncReaderT} from './types';
import {
  ofAsync,
  askAsync,
  failAsync,
  fromResultAsync,
  fromMaybeAsync,
  fromNullableAsync,
  mapAsync,
  andThenAsync,
  apAsync,
  liftA2Async,
  liftA3Async,
  tapAsync,
  mapErrAsync,
  orElseAsync,
  traverseAsync,
  sequenceAsync,
} from './readerT-async';

import {describe, it, expect, vi} from 'vitest';
import {Ok, Err, isOk, isErr} from '../Result/base';
import type {Success} from '../Result/types';
import {Some, None} from '../Maybe/__export__';
import {UnknownError} from '../unknown-error';

// ============================
// 测试辅助类型和函数
// ============================
type TestEnv = {
  apiUrl: string;
  timeout: number;
  userId: string;
};

const mockEnv: TestEnv = {
  apiUrl: 'https://api.test.com',
  timeout: 5000,
  userId: 'user-123',
};

// 显著减少延迟时间以加快测试
const delayedSuccess = <T>(value: T, delayMs: number = 1): Promise<T> => {
  return new Promise((resolve) => setTimeout(() => resolve(value), delayMs));
};

// ============================
// 基础构造测试
// ============================
describe.concurrent('Basic Constructor Tests', () => {
  describe('ofAsync', () => {
    it('should create an AsyncReaderT that ignores environment and returns Ok with the value', async () => {
      const value = {name: 'test', count: 42};
      const reader = ofAsync<TestEnv, Error, typeof value>(value);

      const result = await reader(mockEnv);

      expect(isOk(result)).toBe(true);
      expect((result as Success<typeof value>).value).toBe(value);
    });

    it('should work with primitive types', async () => {
      const reader = ofAsync<TestEnv, string, number>(42);
      const result = await reader(mockEnv);

      expect(isOk(result)).toBe(true);
      expect((result as Success<number>).value).toBe(42);
    });
  });

  describe.concurrent('askAsync', () => {
    it('should return the environment wrapped in Ok', async () => {
      const reader = askAsync<TestEnv, Error>();
      const result = await reader(mockEnv);

      expect(isOk(result)).toBe(true);
      expect((result as Success<TestEnv>).value).toBe(mockEnv);
    });

    it('should return different environments for different calls', async () => {
      const reader = askAsync<TestEnv, Error>();
      const otherEnv = {...mockEnv, userId: 'user-456'};

      const result1 = await reader(mockEnv);
      const result2 = await reader(otherEnv);

      expect(isOk(result1)).toBe(true);
      expect(isOk(result2)).toBe(true);
      expect((result1 as Success<TestEnv>).value.userId).toBe('user-123');
      expect((result2 as Success<TestEnv>).value.userId).toBe('user-456');
    });
  });

  describe('failAsync', () => {
    it('should create an AsyncReaderT that always returns Err with the given error', async () => {
      const error = new Error('Operation failed');
      const reader = failAsync<TestEnv, Error, string>(error);

      const result = await reader(mockEnv);

      expect(isErr(result)).toBe(true);
      expect((result as {error: Error}).error).toBe(error);
    });

    it('should work with string errors', async () => {
      const error = 'Validation failed';
      const reader = failAsync<TestEnv, string, number>(error);

      const result = await reader(mockEnv);

      expect(isErr(result)).toBe(true);
      expect((result as {error: string}).error).toBe(error);
    });
  });
});

// ============================
// 从其他类型转换的测试
// ============================
describe.concurrent('Conversion Tests', () => {
  describe('fromResultAsync', () => {
    it('should lift an Ok result into AsyncReaderT', async () => {
      const okResult = Ok<string, Error>('success');
      const reader = fromResultAsync<TestEnv, Error, string>(okResult);

      const result = await reader(mockEnv);

      expect(result).toBe(okResult);
      expect(isOk(result)).toBe(true);
      expect((result as Success<string>).value).toBe('success');
    });

    it('should lift an Err result into AsyncReaderT', async () => {
      const error = new Error('Failed');
      const errResult = Err<string, Error>(error);
      const reader = fromResultAsync<TestEnv, Error, string>(errResult);

      const result = await reader(mockEnv);

      expect(result).toBe(errResult);
      expect(isErr(result)).toBe(true);
      expect((result as {error: Error}).error).toBe(error);
    });
  });

  describe.concurrent('fromMaybeAsync', () => {
    it('should convert Some to Ok', async () => {
      const maybe = Some<string>('value');
      const reader = fromMaybeAsync<TestEnv, string, string>(
        maybe,
        'not found',
      );

      const result = await reader(mockEnv);

      expect(isOk(result)).toBe(true);
      expect((result as Success<string>).value).toBe('value');
    });

    it('should convert None to Err with given error', async () => {
      const maybe = None();
      const error = 'Value is missing';
      const reader = fromMaybeAsync<TestEnv, string, string>(maybe, error);

      const result = await reader(mockEnv);

      expect(isErr(result)).toBe(true);
      expect((result as {error: string}).error).toBe(error);
    });
  });

  describe('fromNullableAsync', () => {
    it('should convert non-null value to Ok', async () => {
      const reader = fromNullableAsync<TestEnv, string, string>(
        'value',
        'null error',
      );

      const result = await reader(mockEnv);

      expect(isOk(result)).toBe(true);
      expect((result as Success<string>).value).toBe('value');
    });

    it('should convert null to Err', async () => {
      const error = 'Value is null';
      const reader = fromNullableAsync<TestEnv, string, string>(null, error);

      const result = await reader(mockEnv);

      expect(isErr(result)).toBe(true);
      expect((result as {error: string}).error).toBe(error);
    });

    it('should convert undefined to Err', async () => {
      const error = 'Value is undefined';
      const reader = fromNullableAsync<TestEnv, string, string>(
        undefined,
        error,
      );

      const result = await reader(mockEnv);

      expect(isErr(result)).toBe(true);
      expect((result as {error: string}).error).toBe(error);
    });
  });
});

// ============================
// Functor操作测试 (mapAsync)
// ============================
describe.concurrent('Functor Operations (mapAsync)', () => {
  it('should map successful value using synchronous function', async () => {
    const reader = ofAsync<TestEnv, Error, number>(5);
    const mapped = mapAsync(reader, (x) => x * 2);

    const result = await mapped(mockEnv);

    expect(isOk(result)).toBe(true);
    expect((result as Success<number>).value).toBe(10);
  });

  it('should propagate errors without calling mapping function', async () => {
    const error = new Error('Original error');
    const reader = failAsync<TestEnv, Error, number>(error);
    const mockFn = vi.fn((x: number) => x * 2);
    const mapped = mapAsync(reader, mockFn);

    const result = await mapped(mockEnv);

    expect(isErr(result)).toBe(true);
    expect((result as {error: Error}).error).toBe(error);
    expect(mockFn).not.toHaveBeenCalled();
  });

  it('should handle mapping function that throws', async () => {
    const reader = ofAsync<TestEnv, Error, number>(5);
    const throwingFn = vi.fn(() => {
      throw new DOMException('DOM error', 'InvalidStateError');
    });
    const mapped = mapAsync(reader, throwingFn);

    const result = await mapped(mockEnv);

    expect(isErr(result)).toBe(true);
    expect(throwingFn).toHaveBeenCalledWith(5, undefined);

    const error = (result as {error: unknown}).error;
    expect(error).toBeInstanceOf(UnknownError);
  });

  it('should work with async readers', async () => {
    const asyncReader: AsyncReaderT<TestEnv, Error, number> = async (env) => {
      await delayedSuccess(null, 1);
      return Ok(env.timeout);
    };

    const mapped = mapAsync(asyncReader, (timeout) => `${timeout}ms`);

    const result = await mapped(mockEnv);

    expect(isOk(result)).toBe(true);
    expect((result as Success<string>).value).toBe('5000ms');
  });
});

// ============================
// Monad操作测试 (andThenAsync)
// ============================
describe.concurrent('Monad Operations (andThenAsync)', () => {
  it('should chain two successful async readers', async () => {
    const reader1 = askAsync<TestEnv, Error>();
    const reader2 = andThenAsync(reader1, (env) =>
      ofAsync(`User: ${env.userId}`),
    );

    const result = await reader2(mockEnv);

    expect(isOk(result)).toBe(true);
    expect((result as Success<string>).value).toBe('User: user-123');
  });

  it('should propagate error from first reader', async () => {
    const error = new Error('First failed');
    const reader1 = failAsync<TestEnv, Error, TestEnv>(error);
    const mockFn = vi.fn((env: TestEnv) => ofAsync(`User: ${env.userId}`));
    const reader2 = andThenAsync(reader1, mockFn);

    const result = await reader2(mockEnv);

    expect(isErr(result)).toBe(true);
    expect((result as {error: Error}).error).toBe(error);
    expect(mockFn).not.toHaveBeenCalled();
  });

  it('should propagate error from second reader', async () => {
    const reader1 = askAsync<TestEnv, Error>();
    const error = new Error('Second failed');
    const reader2 = andThenAsync(reader1, () =>
      failAsync<TestEnv, Error, string>(error),
    );

    const result = await reader2(mockEnv);

    expect(isErr(result)).toBe(true);
    expect((result as {error: Error}).error).toBe(error);
  });

  it('should handle async operations in chain', async () => {
    const reader1: AsyncReaderT<TestEnv, Error, number> = async (env) => {
      await delayedSuccess(null, 1);
      return Ok(env.timeout);
    };

    const reader2 = andThenAsync(reader1, (timeout) => async () => {
      await delayedSuccess(null, 1);
      return Ok(timeout * 2);
    });

    const result = await reader2(mockEnv);

    expect(isOk(result)).toBe(true);
    expect((result as Success<number>).value).toBe(10000);
  });
});

// ============================
// Applicative操作测试 (apAsync, liftA2Async, liftA3Async)
// ============================
describe.concurrent('Applicative Operations', () => {
  describe('apAsync', () => {
    it('should apply function from one reader to value from another', async () => {
      const readerFn = ofAsync<TestEnv, Error, (x: number) => string>(
        (x) => `Value: ${x}`,
      );
      const readerValue = ofAsync<TestEnv, Error, number>(42);

      const applied = apAsync(readerFn, readerValue);
      const result = await applied(mockEnv);

      expect(isOk(result)).toBe(true);
      expect((result as Success<string>).value).toBe('Value: 42');
    });

    it('should fail if function reader fails', async () => {
      const error = new Error('Function error');
      const readerFn = failAsync<TestEnv, Error, (x: number) => string>(error);
      const readerValue = ofAsync<TestEnv, Error, number>(42);

      const applied = apAsync(readerFn, readerValue);
      const result = await applied(mockEnv);

      expect(isErr(result)).toBe(true);
      expect((result as {error: Error}).error).toBe(error);
    });

    it('should fail if value reader fails', async () => {
      const error = new Error('Value error');
      const readerFn = ofAsync<TestEnv, Error, (x: number) => string>(
        (x) => `Value: ${x}`,
      );
      const readerValue = failAsync<TestEnv, Error, number>(error);

      const applied = apAsync(readerFn, readerValue);
      const result = await applied(mockEnv);

      expect(isErr(result)).toBe(true);
      expect((result as {error: Error}).error).toBe(error);
    });
  });

  describe.concurrent('liftA2Async', () => {
    it('should lift binary function and apply to two readers', async () => {
      const add = (a: number, b: number) => a + b;
      const readerA = ofAsync<TestEnv, Error, number>(10);
      const readerB = ofAsync<TestEnv, Error, number>(32);

      const lifted = liftA2Async(add);
      const resultReader = lifted(readerA, readerB);
      const result = await resultReader(mockEnv);

      expect(isOk(result)).toBe(true);
      expect((result as Success<number>).value).toBe(42);
    });

    it('should handle different value types', async () => {
      const concat = (a: string, b: number) => `${a}-${b}`;
      const readerA = ofAsync<TestEnv, Error, string>('test');
      const readerB = ofAsync<TestEnv, Error, number>(123);

      const lifted = liftA2Async(concat);
      const result = await lifted(readerA, readerB)(mockEnv);

      expect(isOk(result)).toBe(true);
      expect((result as Success<string>).value).toBe('test-123');
    });
  });

  describe('liftA3Async', () => {
    it('should lift ternary function and apply to three readers', async () => {
      const format = (a: string, b: number, c: boolean) => `${a}: ${b} (${c})`;
      const readerA = ofAsync<TestEnv, Error, string>('Count');
      const readerB = ofAsync<TestEnv, Error, number>(42);
      const readerC = ofAsync<TestEnv, Error, boolean>(true);

      const lifted = liftA3Async(format);
      const result = await lifted(readerA, readerB, readerC)(mockEnv);

      expect(isOk(result)).toBe(true);
      expect((result as Success<string>).value).toBe('Count: 42 (true)');
    });
  });
});

// ============================
// 副作用和错误处理测试 (tapAsync, mapErrAsync, orElseAsync)
// ============================
describe.concurrent('Side Effects & Error Handling', () => {
  describe('tapAsync', () => {
    it('should execute side effect and return original value', async () => {
      const sideEffect = vi.fn(() => ofAsync(undefined));

      const reader = ofAsync<TestEnv, Error, number>(100);
      const tapped = tapAsync(reader, sideEffect);

      const result = await tapped(mockEnv);

      expect(isOk(result)).toBe(true);
      expect((result as Success<number>).value).toBe(100);
      expect(sideEffect).toHaveBeenCalledWith(100);
    });

    it('should propagate error if side effect fails', async () => {
      const error = new Error('Side effect failed');
      const sideEffect = vi.fn(() => failAsync<TestEnv, Error, void>(error));

      const reader = ofAsync<TestEnv, Error, number>(100);
      const tapped = tapAsync(reader, sideEffect);

      const result = await tapped(mockEnv);

      expect(isErr(result)).toBe(true);
      expect((result as {error: Error}).error).toBe(error);
      expect(sideEffect).toHaveBeenCalledWith(100);
    });

    it('should not execute side effect if original reader fails', async () => {
      const sideEffect = vi.fn(() => ofAsync(undefined));
      const error = new Error('Original failed');
      const reader = failAsync<TestEnv, Error, number>(error);

      const tapped = tapAsync(reader, sideEffect);
      const result = await tapped(mockEnv);

      expect(isErr(result)).toBe(true);
      expect((result as {error: Error}).error).toBe(error);
      expect(sideEffect).not.toHaveBeenCalled();
    });
  });

  describe.concurrent('mapErrAsync', () => {
    it('should transform error using synchronous function', async () => {
      const originalError = new Error('Original');
      const reader = failAsync<TestEnv, Error, number>(originalError);
      const mapped = mapErrAsync(
        reader,
        (err) => `Transformed: ${err.message}`,
      );

      const result = await mapped(mockEnv);

      expect(isErr(result)).toBe(true);
      expect((result as {error: string}).error).toBe('Transformed: Original');
    });

    it('should transform error using async function', async () => {
      const originalError = new Error('Original');
      const reader = failAsync<TestEnv, Error, number>(originalError);
      const mapped = mapErrAsync(reader, async (err) => {
        await delayedSuccess(null, 1);
        return {message: err.message, code: 500};
      });

      const result = await mapped(mockEnv);

      expect(isErr(result)).toBe(true);
      const error = (result as {error: {message: string; code: number}}).error;
      expect(error.message).toBe('Original');
      expect(error.code).toBe(500);
    });

    it('should pass through success without transformation', async () => {
      const reader = ofAsync<TestEnv, Error, number>(42);
      const errorTransform = vi.fn();
      const mapped = mapErrAsync(reader, errorTransform);

      const result = await mapped(mockEnv);

      expect(isOk(result)).toBe(true);
      expect((result as Success<number>).value).toBe(42);
      expect(errorTransform).not.toHaveBeenCalled();
    });
  });

  describe('orElseAsync', () => {
    it('should return original result if it succeeds', async () => {
      const reader = ofAsync<TestEnv, Error, string>('success');
      const fallback = vi.fn(() =>
        ofAsync<TestEnv, string, string>('fallback'),
      );
      const recovered = orElseAsync(reader, fallback);

      const result = await recovered(mockEnv);

      expect(isOk(result)).toBe(true);
      expect((result as Success<string>).value).toBe('success');
      expect(fallback).not.toHaveBeenCalled();
    });

    it('should use fallback if original fails', async () => {
      const error = new Error('Original failed');
      const reader = failAsync<TestEnv, Error, string>(error);
      const fallback = vi.fn((err: Error) =>
        ofAsync(`Recovered from: ${err.message}`),
      );
      const recovered = orElseAsync(reader, fallback);

      const result = await recovered(mockEnv);

      expect(isOk(result)).toBe(true);
      expect((result as Success<string>).value).toBe(
        'Recovered from: Original failed',
      );
      expect(fallback).toHaveBeenCalledWith(error);
    });

    it('should propagate error if both original and fallback fail', async () => {
      const originalError = new Error('Original failed');
      const fallbackError = new Error('Fallback also failed');

      const reader = failAsync<TestEnv, Error, string>(originalError);
      const fallback = vi.fn(() =>
        failAsync<TestEnv, Error, string>(fallbackError),
      );
      const recovered = orElseAsync(reader, fallback);

      const result = await recovered(mockEnv);

      expect(isErr(result)).toBe(true);
      expect((result as {error: Error}).error).toBe(fallbackError);
      expect(fallback).toHaveBeenCalledWith(originalError);
    });
  });
});

// ============================
// 遍历和序列测试 (traverseAsync, sequenceAsync)
// ============================
describe.concurrent('Traversal & Sequencing', () => {
  describe('traverseAsync', () => {
    it('should process all items successfully', async () => {
      const items = [1, 2, 3, 4, 5];
      const transform = (n: number) =>
        ofAsync<TestEnv, Error, string>(`Item ${n}`);

      const traversed = traverseAsync(transform);
      const resultReader = traversed(items);
      const result = await resultReader(mockEnv);

      expect(isOk(result)).toBe(true);
      const values = (result as Success<string[]>).value;
      expect(values).toEqual([
        'Item 1',
        'Item 2',
        'Item 3',
        'Item 4',
        'Item 5',
      ]);
    });

    it('should fail fast on first error', async () => {
      const items = [1, 2, 3, 4];
      const error = new Error('Failed at 3');

      const transform = vi.fn((n: number) => {
        if (n === 3) {
          return failAsync<TestEnv, Error, string>(error);
        }
        return ofAsync(`Item ${n}`);
      });

      const traversed = traverseAsync(transform);
      const result = await traversed(items)(mockEnv);

      expect(isErr(result)).toBe(true);
      expect((result as {error: Error}).error).toBe(error);
      expect(transform).toHaveBeenCalledWith(3);
    });
  });

  describe.concurrent('sequenceAsync', () => {
    it('should sequence an array of readers', async () => {
      const readers = [
        ofAsync<TestEnv, Error, number>(1),
        ofAsync<TestEnv, Error, number>(2),
        ofAsync<TestEnv, Error, number>(3),
      ];

      const sequenced = sequenceAsync(readers);
      const result = await sequenced(mockEnv);

      expect(isOk(result)).toBe(true);
      expect((result as Success<number[]>).value).toEqual([1, 2, 3]);
    });

    it('should handle empty array', async () => {
      const readers: AsyncReaderT<TestEnv, Error, number>[] = [];
      const sequenced = sequenceAsync(readers);
      const result = await sequenced(mockEnv);

      expect(isOk(result)).toBe(true);
      expect((result as Success<number[]>).value).toEqual([]);
    });

    it('should propagate error if any reader fails', async () => {
      const error = new Error('Reader 2 failed');
      const readers = [
        ofAsync<TestEnv, Error, number>(1),
        failAsync<TestEnv, Error, number>(error),
        ofAsync<TestEnv, Error, number>(3),
      ];

      const sequenced = sequenceAsync(readers);
      const result = await sequenced(mockEnv);

      expect(isErr(result)).toBe(true);
      expect((result as {error: Error}).error).toBe(error);
    });
  });
});

// ============================
// 环境依赖测试
// ============================
describe.concurrent('Environment Dependency Tests', () => {
  it('should allow composition of environment-dependent operations', async () => {
    const fetchUserData: AsyncReaderT<TestEnv, Error, string> = async (env) => {
      await delayedSuccess(null, 2); // 减少延迟
      return Ok(`Data from ${env.apiUrl} for ${env.userId}`);
    };

    const processData = andThenAsync(fetchUserData, (data) =>
      mapAsync(
        askAsync<TestEnv, Error>(),
        (env) => `${data} processed with timeout ${env.timeout}`,
      ),
    );

    const result = await processData(mockEnv);

    expect(isOk(result)).toBe(true);
    expect((result as Success<string>).value).toBe(
      'Data from https://api.test.com for user-123 processed with timeout 5000',
    );
  });

  it('should work with different environment implementations', async () => {
    const reader = askAsync<TestEnv, Error>();
    const devEnv: TestEnv = {
      apiUrl: 'https://dev.api.test.com',
      timeout: 10000,
      userId: 'dev-user',
    };

    const prodResult = await reader(mockEnv);
    const devResult = await reader(devEnv);

    expect(isOk(prodResult)).toBe(true);
    expect(isOk(devResult)).toBe(true);
    expect((prodResult as Success<TestEnv>).value.apiUrl).toBe(
      'https://api.test.com',
    );
    expect((devResult as Success<TestEnv>).value.apiUrl).toBe(
      'https://dev.api.test.com',
    );
  });
});
