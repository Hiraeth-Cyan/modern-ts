// ========================================
// ./src/Other/lazy.spec.ts
// ========================================
/* eslint-disable @typescript-eslint/require-await */
import {
  type LazyAsync,
  wrap,
  run,
  wrapAsync,
  runAsync,
  Memoized,
  AsyncMemoized,
  runWithCleanup,
  runAsyncWithCleanup,
  map,
  mapAsync,
  andThen,
  andThenAsync,
  zip,
  zipAsync,
} from './lazy';

import {describe, it, expect, vi} from 'vitest';
import {isOk, isErr} from '../Result/base';
import {UnknownError} from '../unknown-error';
import {type Success} from '../Result/types';

// ============================
// 测试辅助函数
// ============================
const calculateSquare = (x: number) => x * x;
const calculateCubeAsync = async (x: number) => {
  await new Promise((resolve) => setTimeout(resolve, 10));
  return x * x * x;
};

// ============================
// 构造与执行测试
// ============================
describe.concurrent('Constructor & Execution Tests', () => {
  describe('Synchronous Lazy (wrap/run)', () => {
    it('wrap should create a Lazy function that returns the value', () => {
      const data = {key: 'test'};
      const lazy_fn = wrap(data);
      expect(typeof lazy_fn).toBe('function');
      expect(run(lazy_fn)).toBe(data);
    });

    it('run should execute a Lazy function', () => {
      const mock_fn = vi.fn(() => 42);
      expect(run(mock_fn)).toBe(42);
      expect(mock_fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('Asynchronous LazyAsync (wrapAsync/runAsync)', () => {
    it('wrapAsync should create a LazyAsync function that returns the value asynchronously', async () => {
      const data = [1, 2];
      const lazy_async_fn = wrapAsync(data);
      expect(typeof lazy_async_fn).toBe('function');
      await expect(runAsync(lazy_async_fn)).resolves.toBe(data);
    });

    it('runAsync should execute a LazyAsync function', async () => {
      const mock_async_fn = vi.fn(async () => 'async data');
      await expect(runAsync(mock_async_fn)).resolves.toBe('async data');
      expect(mock_async_fn).toHaveBeenCalledTimes(1);
    });
  });
});

// ============================
// 记忆化测试
// ============================
describe.concurrent('Memoization Tests', () => {
  describe('Synchronous Memoization (Memoized)', () => {
    it('Memoized should execute the function only once', () => {
      let call_count = 0;
      const expensive_computation = () => {
        call_count++;
        return Math.random();
      };
      const memoized_lazy = Memoized(expensive_computation);

      const result1 = run(memoized_lazy);
      const result2 = run(memoized_lazy);
      const result3 = run(memoized_lazy);

      expect(call_count).toBe(1);
      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
      expect(result1).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Asynchronous Memoization (AsyncMemoized)', () => {
    it('AsyncMemoized should execute the promise function only once and cache the promise', async () => {
      let call_count = 0;
      const expensive_async_computation: LazyAsync<string> = async () => {
        call_count++;
        await new Promise((resolve) => setTimeout(resolve, 50));
        return `result-${call_count}`;
      };
      const memoized_lazy_async = AsyncMemoized(expensive_async_computation);

      const [result1, result2, result3] = await Promise.all([
        runAsync(memoized_lazy_async),
        runAsync(memoized_lazy_async),
        runAsync(memoized_lazy_async),
      ]);

      expect(call_count).toBe(1);
      expect(result1).toBe('result-1');
      expect(result2).toBe('result-1');
      expect(result3).toBe('result-1');
    });

    // 验证缓存清理逻辑
    it('AsyncMemoized should clear cache on rejection to allow retries', async () => {
      let call_count = 0;
      const failing_async_fn: LazyAsync<string> = async () => {
        call_count++;
        return new Promise((resolve, reject) => {
          // 第一次调用失败，后续成功
          if (call_count === 1) reject(new Error('First attempt failed'));
          else resolve(`success-${call_count}`);
        });
      };

      const memoized_fn = AsyncMemoized(failing_async_fn);

      // 第一次调用：预期失败
      await expect(runAsync(memoized_fn)).rejects.toThrow(
        'First attempt failed',
      );

      // 第二次调用：应该重试（缓存已清除）
      const result = await runAsync(memoized_fn);

      expect(call_count).toBe(2); // 确认原始函数被调用了两次
      expect(result).toBe('success-2'); // 确认返回了新结果
    });
  });
});

// ============================
// 清理函数执行测试
// ============================
describe.concurrent('Cleanup Execution Tests', () => {
  describe('Synchronous Cleanup (runWithCleanup)', () => {
    it('should return Ok and execute cleanup on success', () => {
      const cleanup_fn = vi.fn();
      const result = runWithCleanup(() => 123, cleanup_fn);

      expect(isOk(result)).toBe(true);
      expect((result as Success<number>).value).toBe(123);
      expect(cleanup_fn).toHaveBeenCalledTimes(1);
    });

    it('should return Err(UnknownError) and execute cleanup on throw', () => {
      const cleanup_fn = vi.fn();
      const test_error = new Error('Sync fail');
      const result = runWithCleanup(() => {
        throw test_error;
      }, cleanup_fn);

      expect(isErr(result)).toBe(true);
      const error = (result as {error: UnknownError}).error;
      expect(error).toBeInstanceOf(UnknownError);
      expect(error.cause).toBe(test_error);
      expect(cleanup_fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('Asynchronous Cleanup (runAsyncWithCleanup)', () => {
    it('should return Ok and execute sync cleanup on success', async () => {
      const cleanup_fn = vi.fn();
      const result = await runAsyncWithCleanup(
        async () => 'async success',
        cleanup_fn,
      );

      expect(isOk(result)).toBe(true);

      // @ts-ignore
      expect(result.value).toBe('async success');

      expect(cleanup_fn).toHaveBeenCalledTimes(1);
    });

    it('should return Err(UnknownError) and execute async cleanup on throw/reject', async () => {
      const async_cleanup_fn = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
      const test_error = new Error('Async fail');

      const result_throw = await runAsyncWithCleanup(async () => {
        throw test_error;
      }, async_cleanup_fn);

      const result_reject = await runAsyncWithCleanup(
        async () => Promise.reject(test_error),
        async_cleanup_fn,
      );

      expect(isErr(result_throw)).toBe(true);
      expect(isErr(result_reject)).toBe(true);
      expect(async_cleanup_fn).toHaveBeenCalledTimes(2);

      const error_throw = (result_throw as {error: UnknownError}).error;
      expect(error_throw.cause).toBe(test_error);
    });
  });
});

// ============================
// Functor & Monad 操作测试
// ============================
describe.concurrent('Functor & Monad Operations Tests', () => {
  const lazy_input = wrap(10); // Lazy<10>

  describe('Synchronous Operations (map, andThen)', () => {
    it('map should compose a new Lazy function (Functor)', () => {
      const lazy_square = map(lazy_input, calculateSquare);
      expect(run(lazy_square)).toBe(100);
    });

    it('andThen should flatten two nested Lazy functions (Monad)', () => {
      const lazy_output = andThen(lazy_input, (v) => wrap(calculateSquare(v)));
      expect(run(lazy_output)).toBe(100);
    });
  });

  describe('Asynchronous Operations (mapAsync, andThenAsync)', () => {
    it('mapAsync should compose a new LazyAsync function (Async Functor)', async () => {
      const lazy_async_input = wrapAsync(3);
      const lazy_cube = mapAsync(lazy_async_input, calculateCubeAsync);
      await expect(runAsync(lazy_cube)).resolves.toBe(27);
    });

    it('andThenAsync should flatten two nested LazyAsync functions (Async Monad)', async () => {
      const lazy_async_input = wrapAsync(2);
      const lazy_output_async = andThenAsync(lazy_async_input, (v) =>
        wrapAsync(calculateCubeAsync(v)),
      );
      await expect(runAsync(lazy_output_async)).resolves.toBe(8);
    });
  });
});

// ============================
// 组合操作测试
// ============================
describe.concurrent('Combination Operations Tests', () => {
  describe('Synchronous Combination (zip)', () => {
    it('zip should combine two Lazy functions into a Lazy tuple', () => {
      const fn_a = wrap('hello');
      const fn_b = wrap(2025);
      const zipped_fn = zip(fn_a, fn_b);

      const result = run(zipped_fn);
      expect(result).toEqual(['hello', 2025]);
      expect(result).toHaveLength(2);
    });
  });

  describe('Asynchronous Combination (zipAsync)', () => {
    it('zipAsync should combine two LazyAsync functions concurrently', async () => {
      const start_time = Date.now();

      const fn_a = async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return 'A';
      };
      const fn_b = async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return 100;
      };

      const zipped_async_fn = zipAsync(fn_a, fn_b);
      const result = await runAsync(zipped_async_fn);
      const elapsed_time = Date.now() - start_time;

      expect(result).toEqual(['A', 100]);
      expect(elapsed_time).toBeLessThan(75); // 确保并发执行
      expect(elapsed_time).toBeGreaterThan(45); // 确保确实等待
    });
  });
});
