// ========================================
// ./src/Reader/readerT.spec.ts
// ========================================
import {describe, it, expect, vi} from 'vitest';
import {Ok, Err} from '../Result/base';
import {isOk, isErr} from '../Result/base';
import type {Success} from '../Result/types';

// 导入要测试的模块
import {
  of,
  ask,
  fail,
  fromResult,
  fromMaybe,
  fromNullable,
  map,
  andThen,
  ap,
  liftA2,
  liftA3,
  tap,
  mapErr,
  orElse,
  traverse,
  sequence,
} from './readerT';

import type {ReaderT} from './types';
import {type Maybe} from '../Maybe/__export__';

// ============================
// 测试辅助类型和函数
// ============================
type TestEnv = {
  apiKey: string;
  timeout: number;
  baseUrl: string;
};

type TestError =
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'VALIDATION_ERROR'
  | 'NETWORK_ERROR'
  | 'CONFIG_MISSING';

const testEnv: TestEnv = {
  apiKey: 'test-key-123',
  timeout: 5000,
  baseUrl: 'https://api.example.com',
};

const toUpperCase = (s: string) => s.toUpperCase();
const addSuffix = (suffix: string) => (s: string) => s + suffix;
const multiplyBy = (factor: number) => (x: number) => x * factor;

// ============================
// 构造函数测试
// ============================
describe.concurrent('Constructor Tests', () => {
  describe('of', () => {
    it('should create a ReaderT that always returns Ok with the given value', () => {
      const reader = of<TestEnv, TestError, number>(42);
      const result = reader(testEnv);

      expect(isOk(result)).toBe(true);
      expect((result as Success<number>).value).toBe(42);
    });

    it('should ignore the environment', () => {
      const reader = of<TestEnv, TestError, string>('constant');
      const result1 = reader(testEnv);
      const result2 = reader({...testEnv, apiKey: 'different'});

      expect(isOk(result1)).toBe(true);
      expect(isOk(result2)).toBe(true);
      expect((result1 as Success<string>).value).toBe('constant');
      expect((result2 as Success<string>).value).toBe('constant');
    });
  });

  describe('ask', () => {
    it('should create a ReaderT that returns the environment as Ok', () => {
      const reader = ask<TestEnv, TestError>();
      const result = reader(testEnv);

      expect(isOk(result)).toBe(true);
      expect((result as Success<TestEnv>).value).toBe(testEnv);
    });

    it('should return different environments when called with different env', () => {
      const reader = ask<TestEnv, TestError>();
      const env1 = {apiKey: 'key1', timeout: 1000, baseUrl: 'url1'};
      const env2 = {apiKey: 'key2', timeout: 2000, baseUrl: 'url2'};

      expect((reader(env1) as Success<TestEnv>).value).toBe(env1);
      expect((reader(env2) as Success<TestEnv>).value).toBe(env2);
    });
  });

  describe('fail', () => {
    it('should create a ReaderT that always returns Err with the given error', () => {
      const reader = fail<TestEnv, TestError, string>('NOT_FOUND');
      const result = reader(testEnv);

      expect(isErr(result)).toBe(true);
      expect((result as {error: TestError}).error).toBe('NOT_FOUND');
    });

    it('should ignore the environment', () => {
      const reader = fail<TestEnv, TestError, number>('VALIDATION_ERROR');
      const result1 = reader(testEnv);
      const result2 = reader({...testEnv, apiKey: 'different'});

      expect(isErr(result1)).toBe(true);
      expect(isErr(result2)).toBe(true);
      expect((result1 as {error: TestError}).error).toBe('VALIDATION_ERROR');
      expect((result2 as {error: TestError}).error).toBe('VALIDATION_ERROR');
    });
  });

  describe('fromResult', () => {
    it('should lift an Ok Result into ReaderT', () => {
      const result = Ok<string, TestError>('success');
      const reader = fromResult<TestEnv, TestError, string>(result);

      const readerResult = reader(testEnv);
      expect(readerResult).toBe(result);
    });

    it('should lift an Err Result into ReaderT', () => {
      const result = Err<string, TestError>('NETWORK_ERROR');
      const reader = fromResult<TestEnv, TestError, string>(result);

      const readerResult = reader(testEnv);
      expect(readerResult).toBe(result);
    });

    it('should ignore the environment', () => {
      const result = Ok<number, TestError>(999);
      const reader = fromResult<TestEnv, TestError, number>(result);

      const env1 = {...testEnv, timeout: 1};
      const env2 = {...testEnv, timeout: 2};

      expect(reader(env1)).toBe(result);
      expect(reader(env2)).toBe(result);
    });
  });

  describe('fromMaybe', () => {
    it('should return Ok when Maybe is Some', () => {
      const maybe: Maybe<string> = 'some value';
      const reader = fromMaybe<TestEnv, TestError, string>(maybe, 'NOT_FOUND');
      const result = reader(testEnv);

      expect(isOk(result)).toBe(true);
      expect((result as Success<string>).value).toBe('some value');
    });

    it('should return Err when Maybe is None (null)', () => {
      const maybe: Maybe<string> = null;
      const reader = fromMaybe<TestEnv, TestError, string>(maybe, 'NOT_FOUND');
      const result = reader(testEnv);

      expect(isErr(result)).toBe(true);
      expect((result as {error: TestError}).error).toBe('NOT_FOUND');
    });

    it('should return Err when Maybe is None (undefined)', () => {
      const maybe: Maybe<string> = undefined;
      const reader = fromMaybe<TestEnv, TestError, string>(maybe, 'NOT_FOUND');
      const result = reader(testEnv);

      expect(isErr(result)).toBe(true);
      expect((result as {error: TestError}).error).toBe('NOT_FOUND');
    });
  });

  describe('fromNullable', () => {
    it('should behave identically to fromMaybe', () => {
      // fromNullable is just an alias for fromMaybe
      const value = 'test';
      const reader1 = fromMaybe<TestEnv, TestError, string>(value, 'NOT_FOUND');
      const reader2 = fromNullable<TestEnv, TestError, string>(
        value,
        'NOT_FOUND',
      );

      expect(reader1(testEnv)).toEqual(reader2(testEnv));
    });
  });
});

// ============================
// Functor & Monad 操作测试
// ============================
describe.concurrent('Functor & Monad Operations Tests', () => {
  describe('map', () => {
    it('should transform successful ReaderT values', () => {
      const reader = of<TestEnv, TestError, string>('hello');
      const transformed = map(reader, toUpperCase);
      const result = transformed(testEnv);

      expect(isOk(result)).toBe(true);
      expect((result as Success<string>).value).toBe('HELLO');
    });

    it('should preserve errors', () => {
      const reader = fail<TestEnv, TestError, string>('UNAUTHORIZED');
      const transformed = map(reader, toUpperCase);
      const result = transformed(testEnv);

      expect(isErr(result)).toBe(true);
      expect((result as {error: TestError}).error).toBe('UNAUTHORIZED');
    });

    it('should propagate environment to inner reader', () => {
      const reader = ask<TestEnv, TestError>();
      const transformed = map(reader, (env) => env.apiKey.length);
      const result = transformed(testEnv);

      expect(isOk(result)).toBe(true);
      expect((result as Success<number>).value).toBe(testEnv.apiKey.length);
    });
  });

  describe('andThen', () => {
    it('should chain successful ReaderT computations', () => {
      const reader1 = of<TestEnv, TestError, number>(5);
      const reader2 = andThen(reader1, (n) =>
        of<TestEnv, TestError, number>(n * 2),
      );
      const result = reader2(testEnv);

      expect(isOk(result)).toBe(true);
      expect((result as Success<number>).value).toBe(10);
    });

    it('should stop chain on error', () => {
      const reader1 = fail<TestEnv, TestError, number>('VALIDATION_ERROR');
      const nextFn = vi.fn((n: number) =>
        of<TestEnv, TestError, number>(n * 2),
      );
      const reader2 = andThen(reader1, nextFn);
      const result = reader2(testEnv);

      expect(isErr(result)).toBe(true);
      expect((result as {error: TestError}).error).toBe('VALIDATION_ERROR');
      expect(nextFn).not.toHaveBeenCalled();
    });

    it('should pass environment through chain', () => {
      const reader1 = ask<TestEnv, TestError>();
      const reader2 = andThen(reader1, (env) =>
        of<TestEnv, TestError, string>(env.apiKey),
      );
      const result = reader2(testEnv);

      expect(isOk(result)).toBe(true);
      expect((result as Success<string>).value).toBe(testEnv.apiKey);
    });

    it('should allow error type change in chain', () => {
      // 为这个特定测试定义新的错误类型
      type Error1 = 'NOT_FOUND';
      type Error2 = 'UNAUTHORIZED';

      const reader1: ReaderT<TestEnv, Error1, number> = (_env) =>
        Err('NOT_FOUND');

      const reader2 = andThen(
        reader1,
        (n): ReaderT<TestEnv, Error2, string> =>
          (_env) =>
            Ok(n.toString()),
      );

      const result = reader2(testEnv);
      expect(isErr(result)).toBe(true);
    });
  });

  describe('ap', () => {
    it('should apply function from one ReaderT to value from another', () => {
      const readerFunc = of<TestEnv, TestError, (a: number) => number>(
        multiplyBy(3),
      );
      const readerValue = of<TestEnv, TestError, number>(7);
      const readerResult = ap(readerFunc, readerValue);
      const result = readerResult(testEnv);

      expect(isOk(result)).toBe(true);
      expect((result as Success<number>).value).toBe(21);
    });

    it('should fail if function ReaderT fails', () => {
      const readerFunc = fail<TestEnv, TestError, (a: string) => string>(
        'UNAUTHORIZED',
      );
      const readerValue = of<TestEnv, TestError, string>('test');
      const readerResult = ap(readerFunc, readerValue);
      const result = readerResult(testEnv);

      expect(isErr(result)).toBe(true);
      expect((result as {error: TestError}).error).toBe('UNAUTHORIZED');
    });

    it('should fail if value ReaderT fails', () => {
      const readerFunc = of<TestEnv, TestError, (a: string) => string>(
        addSuffix('!'),
      );
      const readerValue = fail<TestEnv, TestError, string>('NOT_FOUND');
      const readerResult = ap(readerFunc, readerValue);
      const result = readerResult(testEnv);

      expect(isErr(result)).toBe(true);
      expect((result as {error: TestError}).error).toBe('NOT_FOUND');
    });
  });

  describe('liftA2', () => {
    it('should lift binary function and apply to two ReaderTs', () => {
      const add = (a: number, b: number) => a + b;
      const readerA = of<TestEnv, TestError, number>(10);
      const readerB = of<TestEnv, TestError, number>(20);

      const lifted = liftA2<TestEnv, TestError, number, number, number>(add);
      const readerResult = lifted(readerA, readerB);
      const result = readerResult(testEnv);

      expect(isOk(result)).toBe(true);
      expect((result as Success<number>).value).toBe(30);
    });

    it('should fail if first ReaderT fails', () => {
      const concat = (a: string, b: string) => a + b;
      const readerA = fail<TestEnv, TestError, string>('NOT_FOUND');
      const readerB = of<TestEnv, TestError, string>('world');

      const lifted = liftA2<TestEnv, TestError, string, string, string>(concat);
      const readerResult = lifted(readerA, readerB);
      const result = readerResult(testEnv);

      expect(isErr(result)).toBe(true);
    });

    it('should fail if second ReaderT fails', () => {
      const concat = (a: string, b: string) => a + b;
      const readerA = of<TestEnv, TestError, string>('hello');
      const readerB = fail<TestEnv, TestError, string>('UNAUTHORIZED');

      const lifted = liftA2<TestEnv, TestError, string, string, string>(concat);
      const readerResult = lifted(readerA, readerB);
      const result = readerResult(testEnv);

      expect(isErr(result)).toBe(true);
    });
  });

  describe('liftA3', () => {
    it('should lift ternary function and apply to three ReaderTs', () => {
      const sum3 = (a: number, b: number, c: number) => a + b + c;
      const readerA = of<TestEnv, TestError, number>(1);
      const readerB = of<TestEnv, TestError, number>(2);
      const readerC = of<TestEnv, TestError, number>(3);

      const lifted = liftA3<TestEnv, TestError, number, number, number, number>(
        sum3,
      );
      const readerResult = lifted(readerA, readerB, readerC);
      const result = readerResult(testEnv);

      expect(isOk(result)).toBe(true);
      expect((result as Success<number>).value).toBe(6);
    });

    it('should fail if any ReaderT fails', () => {
      const format = (a: string, b: string, c: string) => `${a}-${b}-${c}`;
      const readerA = of<TestEnv, TestError, string>('A');
      const readerB = fail<TestEnv, TestError, string>('VALIDATION_ERROR');
      const readerC = of<TestEnv, TestError, string>('C');

      const lifted = liftA3<TestEnv, TestError, string, string, string, string>(
        format,
      );
      const readerResult = lifted(readerA, readerB, readerC);
      const result = readerResult(testEnv);

      expect(isErr(result)).toBe(true);
    });
  });
});

// ============================
// 副作用与错误处理测试
// ============================
describe.concurrent('Side Effects & Error Handling Tests', () => {
  describe('tap', () => {
    it('should execute side effect and return original value on success', () => {
      const sideEffect = vi.fn(() =>
        of<TestEnv, TestError, unknown>(undefined),
      );

      const reader = of<TestEnv, TestError, string>('test');
      const tapped = tap(reader, sideEffect);
      const result = tapped(testEnv);

      expect(isOk(result)).toBe(true);
      expect((result as Success<string>).value).toBe('test');
      expect(sideEffect).toHaveBeenCalledWith('test');
    });

    it('should fail if side effect fails', () => {
      const sideEffect = () =>
        fail<TestEnv, TestError, unknown>('CONFIG_MISSING');

      const reader = of<TestEnv, TestError, string>('test');
      const tapped = tap(reader, sideEffect);
      const result = tapped(testEnv);

      expect(isErr(result)).toBe(true);
      expect((result as {error: TestError}).error).toBe('CONFIG_MISSING');
    });

    it('should preserve original error', () => {
      const sideEffect = vi.fn(() =>
        of<TestEnv, TestError, unknown>(undefined),
      );

      const reader = fail<TestEnv, TestError, string>('NOT_FOUND');
      const tapped = tap(reader, sideEffect);
      const result = tapped(testEnv);

      expect(isErr(result)).toBe(true);
      expect((result as {error: TestError}).error).toBe('NOT_FOUND');
      expect(sideEffect).not.toHaveBeenCalled();
    });
  });

  describe('mapErr', () => {
    it('should transform error type', () => {
      // 为这个测试定义独立的错误类型
      type OldError = 'OLD_ERROR';
      type NewError = 'NEW_ERROR';

      const reader: ReaderT<TestEnv, OldError, string> = (_env) =>
        Err('OLD_ERROR');

      const transformError = (): NewError => 'NEW_ERROR';
      const transformed = mapErr(reader, transformError);
      const result = transformed(testEnv);

      expect(isErr(result)).toBe(true);
      expect((result as {error: NewError}).error).toBe('NEW_ERROR');
    });

    it('should preserve success values', () => {
      type OldError = 'OLD_ERROR';
      type NewError = 'NEW_ERROR';

      const reader: ReaderT<TestEnv, OldError, string> = (_env) =>
        Ok('success');

      const transformError = (): NewError => 'NEW_ERROR';
      const transformed = mapErr(reader, transformError);
      const result = transformed(testEnv);

      expect(isOk(result)).toBe(true);
      expect((result as Success<string>).value).toBe('success');
    });
  });

  describe('orElse', () => {
    it('should return original result on success', () => {
      // 使用TestError的子集
      type Error1 = 'NOT_FOUND';
      type Error2 = 'UNAUTHORIZED';

      const reader = of<TestEnv, Error1, string>('success');
      const fallback = (): ReaderT<TestEnv, Error2, string> =>
        of<TestEnv, Error2, string>('fallback');

      const recovered = orElse(reader, fallback);
      const result = recovered(testEnv);

      expect(isOk(result)).toBe(true);
      expect((result as Success<string>).value).toBe('success');
    });

    it('should use fallback on error', () => {
      type Error1 = 'NOT_FOUND';
      type Error2 = 'UNAUTHORIZED';

      const reader = fail<TestEnv, Error1, string>('NOT_FOUND');
      const fallback = (): ReaderT<TestEnv, Error2, string> =>
        of<TestEnv, Error2, string>('recovered');

      const recovered = orElse(reader, fallback);
      const result = recovered(testEnv);

      expect(isOk(result)).toBe(true);
      expect((result as Success<string>).value).toBe('recovered');
    });

    it('should allow error type change', () => {
      type Error1 = 'NOT_FOUND' | 'UNAUTHORIZED';
      type Error3 = 'NETWORK_ERROR';

      const reader: ReaderT<TestEnv, Error1, string> = (_env) =>
        Err('NOT_FOUND');

      const fallback = (): ReaderT<TestEnv, Error3, string> =>
        fail<TestEnv, Error3, string>('NETWORK_ERROR');

      const recovered = orElse(reader, fallback);
      const result = recovered(testEnv);

      expect(isErr(result)).toBe(true);
      expect((result as {error: Error3}).error).toBe('NETWORK_ERROR');
    });
  });
});

// ============================
// 集合操作测试
// ============================
describe.concurrent('Collection Operations Tests', () => {
  describe('traverse', () => {
    it('should process all items successfully', () => {
      const items = [1, 2, 3, 4, 5];
      const process = (n: number): ReaderT<TestEnv, TestError, string> =>
        of<TestEnv, TestError, string>(`Item ${n}`);

      const traversed = traverse(process)(items);
      const result = traversed(testEnv);

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

    it('should fail on first error and stop processing', () => {
      const processCalls: number[] = [];
      const items = [1, 2, 3];

      const process = (n: number): ReaderT<TestEnv, TestError, string> => {
        processCalls.push(n);
        if (n === 2) {
          return fail<TestEnv, TestError, string>('VALIDATION_ERROR');
        }
        return of<TestEnv, TestError, string>(`Item ${n}`);
      };

      const traversed = traverse(process)(items);
      const result = traversed(testEnv);

      expect(isErr(result)).toBe(true);
      expect((result as {error: TestError}).error).toBe('VALIDATION_ERROR');
      expect(processCalls).toEqual([1, 2, 3]); // Should stop after error
    });

    it('should work with empty array', () => {
      const items: number[] = [];
      const process = (n: number): ReaderT<TestEnv, TestError, string> =>
        of<TestEnv, TestError, string>(`Item ${n}`);

      const traversed = traverse(process)(items);
      const result = traversed(testEnv);

      expect(isOk(result)).toBe(true);
      expect((result as Success<string[]>).value).toEqual([]);
    });
  });

  describe('sequence', () => {
    it('should execute all readers and collect results', () => {
      const readers: Array<ReaderT<TestEnv, TestError, number>> = [
        of<TestEnv, TestError, number>(1),
        of<TestEnv, TestError, number>(2),
        of<TestEnv, TestError, number>(3),
      ];

      const sequenced = sequence(readers);
      const result = sequenced(testEnv);

      expect(isOk(result)).toBe(true);
      expect((result as Success<number[]>).value).toEqual([1, 2, 3]);
    });

    it('should fail on first error', () => {
      const readers: Array<ReaderT<TestEnv, TestError, number>> = [
        of<TestEnv, TestError, number>(1),
        fail<TestEnv, TestError, number>('NETWORK_ERROR'),
        of<TestEnv, TestError, number>(3),
      ];

      const sequenced = sequence(readers);
      const result = sequenced(testEnv);

      expect(isErr(result)).toBe(true);
      expect((result as {error: TestError}).error).toBe('NETWORK_ERROR');
    });

    it('should handle empty array', () => {
      const readers: Array<ReaderT<TestEnv, TestError, number>> = [];
      const sequenced = sequence(readers);
      const result = sequenced(testEnv);

      expect(isOk(result)).toBe(true);
      expect((result as Success<number[]>).value).toEqual([]);
    });
  });
});

// ============================
// 环境传播测试
// ============================
describe.concurrent('Environment Propagation Tests', () => {
  it('should properly propagate environment through computations', () => {
    const getApiKey: ReaderT<TestEnv, TestError, string> = (env) =>
      Ok(env.apiKey);

    const getTimeout: ReaderT<TestEnv, TestError, number> = (env) =>
      Ok(env.timeout);

    const createConfig = liftA2<
      TestEnv,
      TestError,
      string,
      number,
      {key: string; timeout: number}
    >((key, timeout) => ({key, timeout}));

    const configReader = createConfig(getApiKey, getTimeout);
    const result = configReader(testEnv);

    expect(isOk(result)).toBe(true);
    const config = (result as Success<{key: string; timeout: number}>).value;
    expect(config).toEqual({
      key: testEnv.apiKey,
      timeout: testEnv.timeout,
    });
  });

  it('should allow environment-dependent fallbacks', () => {
    const getApiKey: ReaderT<TestEnv, TestError, string> = (env) => {
      if (env.apiKey.startsWith('test-')) {
        return Ok(env.apiKey);
      }
      return Err('UNAUTHORIZED');
    };

    const fallbackKey: ReaderT<TestEnv, TestError, string> = (env) =>
      Ok(`fallback-${env.baseUrl}`);

    const readerWithFallback = orElse(getApiKey, () => fallbackKey);

    // Test with valid API key
    const result1 = readerWithFallback(testEnv);
    expect(isOk(result1)).toBe(true);
    expect((result1 as Success<string>).value).toBe(testEnv.apiKey);

    // Test with invalid API key
    const invalidEnv = {...testEnv, apiKey: 'invalid'};
    const result2 = readerWithFallback(invalidEnv);
    expect(isOk(result2)).toBe(true);
    expect((result2 as Success<string>).value).toBe(
      `fallback-${testEnv.baseUrl}`,
    );
  });
});
