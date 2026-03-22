// ========================================
// ./src/Utils/Functions/pace.spec.ts
// ========================================

import {describe, it, expect, vi, afterAll} from 'vitest';
import {Stop, Continue, expBackoff, expJitter, pacer, retry} from './pace';
import {isOk, isErr} from '../Result/base';
import {
  MockClock,
  runTimelineAsync,
  restoreGlobals,
} from '../MockClock/__export__';
import {type Result} from '../Result/types';
afterAll(() => {
  restoreGlobals();
});

// ============================
// 辅助函数测试
// 测试 Stop、Continue、expBackoff、expJitter
// ============================
describe.concurrent('Helper Functions', () => {
  describe('Stop', () => {
    it('should create an object with value property', () => {
      const result = Stop(42);
      expect(result).toEqual({value: 42});
    });

    it('should work with various types', () => {
      expect(Stop('hello')).toEqual({value: 'hello'});
      expect(Stop(null)).toEqual({value: null});
      expect(Stop({a: 1})).toEqual({value: {a: 1}});
    });
  });

  describe('Continue', () => {
    it('should create an object with delay property', () => {
      const result = Continue(100);
      expect(result).toEqual({delay: 100});
    });
  });

  describe('expBackoff', () => {
    it('should calculate exponential backoff correctly', () => {
      expect(expBackoff(0, 1000, 30000)).toBe(1000);
      expect(expBackoff(1, 1000, 30000)).toBe(2000);
      expect(expBackoff(2, 1000, 30000)).toBe(4000);
      expect(expBackoff(3, 1000, 30000)).toBe(8000);
    });

    it('should respect max delay cap', () => {
      expect(expBackoff(10, 1000, 5000)).toBe(5000);
      expect(expBackoff(5, 1000, 50000)).toBe(32000);
    });

    it('should use default parameters', () => {
      expect(expBackoff(0)).toBe(1000);
      expect(expBackoff(5)).toBe(30000);
    });

    it('should handle custom base delay', () => {
      expect(expBackoff(2, 500, 10000)).toBe(2000);
    });
  });

  describe('expJitter', () => {
    it('should return value less than or equal to delay for full jitter', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const result = expJitter(2, 1000, 30000, 'full');
      expect(result).toBeLessThanOrEqual(4000);
    });

    it('should return value in correct range for equal jitter', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const result = expJitter(2, 1000, 30000, 'equal');
      expect(result).toBeGreaterThanOrEqual(2000);
      expect(result).toBeLessThanOrEqual(4000);
    });

    it('should return value for decorrelated jitter', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const result = expJitter(2, 1000, 30000, 'decorrelated');
      expect(result).toBeGreaterThanOrEqual(1000);
      expect(result).toBeLessThanOrEqual(30000);
    });

    it('should respect max delay cap for all jitter types', () => {
      vi.spyOn(Math, 'random').mockReturnValue(1);
      expect(expJitter(10, 1000, 5000, 'full')).toBeLessThanOrEqual(5000);
      expect(expJitter(10, 1000, 5000, 'equal')).toBeLessThanOrEqual(5000);
      expect(expJitter(10, 1000, 5000, 'decorrelated')).toBeLessThanOrEqual(
        5000,
      );
    });

    it('should use default jitter type (full)', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const result = expJitter(2);
      expect(result).toBeGreaterThanOrEqual(0);
    });
  });
});

// ============================
// Pacer 核心功能测试
// ============================
describe.concurrent('pacer', () => {
  describe('Basic Behavior', () => {
    it('should execute function and stop immediately when Stop is returned', async () => {
      const mock_fn = vi.fn().mockReturnValue('result');
      const pace_fn = vi.fn().mockReturnValue(Stop('final'));

      const result = await pacer(mock_fn, pace_fn);

      expect(result).toBe('final');
      expect(mock_fn).toHaveBeenCalledTimes(1);
      expect(pace_fn).toHaveBeenCalledTimes(1);
    });

    it('should pass Result to pace function', async () => {
      const mock_fn = vi.fn().mockReturnValue(42);
      const pace_fn = vi.fn().mockReturnValue(Stop('done'));

      await pacer(mock_fn, pace_fn);

      expect(pace_fn).toHaveBeenCalledTimes(1);
      const call_arg = pace_fn.mock.calls[0][0] as Result<number, unknown>;
      expect(isOk(call_arg)).toBe(true);
      if (isOk(call_arg)) {
        expect(call_arg.value).toBe(42);
      }
    });

    it('should wrap thrown error in Err Result', async () => {
      const error = new Error('boom');
      const mock_fn = vi.fn().mockImplementation(() => {
        throw error;
      });
      const pace_fn = vi.fn().mockReturnValue(Stop('handled'));

      await pacer(mock_fn, pace_fn);

      expect(pace_fn).toHaveBeenCalledTimes(1);
      const call_arg = pace_fn.mock.calls[0][0] as Result<unknown, Error>;
      expect(isErr(call_arg)).toBe(true);
      if (isErr(call_arg)) {
        expect(call_arg.error).toBe(error);
      }
    });
  });

  describe('Iteration Control', () => {
    it('should continue when Continue is returned', async () => {
      const clock = MockClock();
      return runTimelineAsync(clock, async () => {
        let call_count = 0;
        const mock_fn = vi.fn().mockImplementation(() => ++call_count);
        let iteration = 0;
        const pace_fn = vi.fn().mockImplementation(() => {
          iteration++;
          if (iteration < 3) return Continue(10);
          return Stop('done');
        });

        const promise = pacer(mock_fn, pace_fn);
        await clock.tickAsync(30);
        const result = await promise;

        expect(result).toBe('done');
        expect(mock_fn).toHaveBeenCalledTimes(3);
      });
    });

    it('should track interval correctly', async () => {
      const clock = MockClock();
      return runTimelineAsync(clock, async () => {
        const intervals: number[] = [];
        const pace_fn = vi
          .fn()
          .mockImplementation(
            (_r: Result<string, unknown>, _i: number, interval: number) => {
              intervals.push(interval);
              if (intervals.length < 3) return Continue(50);
              return Stop('done');
            },
          );

        const promise = pacer(() => 'x', pace_fn);
        await clock.tickAsync(150);
        await promise;

        expect(intervals).toEqual([0, 50, 50]);
      });
    });

    it('should pass correct iteration number', async () => {
      const clock = MockClock();
      return runTimelineAsync(clock, async () => {
        const iterations: number[] = [];
        const pace_fn = vi
          .fn()
          .mockImplementation((_r: Result<string, unknown>, iter: number) => {
            iterations.push(iter);
            if (iter < 2) return Continue(10);
            return Stop('done');
          });

        const promise = pacer(() => 'x', pace_fn);
        await clock.tickAsync(30);
        await promise;

        expect(iterations).toEqual([0, 1, 2]);
      });
    });

    it('should skip delay when Continue(0) is returned', async () => {
      const clock = MockClock();
      return runTimelineAsync(clock, async () => {
        const mock_fn = vi.fn().mockReturnValue('x');
        let count = 0;
        const pace_fn = vi.fn().mockImplementation(() => {
          count++;
          if (count < 3) return Continue(0);
          return Stop('done');
        });

        const promise = pacer(mock_fn, pace_fn);
        await clock.tickAsync(0);
        await promise;

        expect(mock_fn).toHaveBeenCalledTimes(3);
      });
    });
  });

  describe('AbortSignal Support', () => {
    it('should throw if signal is already aborted', async () => {
      const controller = new AbortController();
      controller.abort('cancelled');

      await expect(
        pacer(
          () => 'x',
          () => Stop('done'),
          controller.signal,
        ),
      ).rejects.toThrow('cancelled');
    });
  });

  describe('Async Support', () => {
    it('should handle async function', async () => {
      const clock = MockClock();
      return runTimelineAsync(clock, async () => {
        const mock_fn = vi.fn().mockImplementation(() => {
          return Promise.resolve('async result');
        });
        const pace_fn = vi.fn().mockReturnValue(Stop('done'));

        await pacer(mock_fn, pace_fn);

        expect(mock_fn).toHaveBeenCalledTimes(1);
      });
    });

    it('should handle async pace function', async () => {
      const clock = MockClock();
      return runTimelineAsync(clock, async () => {
        let count = 0;
        const pace_fn = vi.fn().mockImplementation(() => {
          count++;
          if (count < 2) return Promise.resolve(Continue(10));
          return Promise.resolve(Stop('done'));
        });

        const promise = pacer(() => 'x', pace_fn);
        await clock.tickAsync(20);
        await promise;

        expect(count).toBe(2);
      });
    });
  });

  describe('Type Transformation', () => {
    it('should allow transforming result type', async () => {
      const mock_fn = vi.fn().mockReturnValue(42);
      const pace_fn = vi
        .fn()
        .mockImplementation((result: Result<number, unknown>) => {
          if (isOk(result)) {
            return Stop(result.value * 2);
          }
          return Stop(0);
        });

      const result = await pacer<number, number>(mock_fn, pace_fn);

      expect(result).toBe(84);
    });
  });
});

// ============================
// Retry 功能测试
// ============================
describe.concurrent('retry', () => {
  describe('Successful Execution', () => {
    it('should return result on first successful attempt', async () => {
      const clock = MockClock();
      return runTimelineAsync(clock, async () => {
        const mock_task = vi
          .fn<() => Promise<string>>()
          .mockResolvedValue('success');

        const promise = retry(mock_task);
        await clock.tickAsync(0);
        const result = await promise;

        expect(result).toBe('success');
        expect(mock_task).toHaveBeenCalledTimes(1);
      });
    });

    it('should retry on failure and eventually succeed', async () => {
      const clock = MockClock();
      return runTimelineAsync(clock, async () => {
        let attempts = 0;
        const mock_task = vi
          .fn<() => Promise<string>>()
          .mockImplementation(() => {
            attempts++;
            if (attempts < 3) return Promise.reject(new Error('fail'));
            return Promise.resolve('success');
          });

        const promise = retry(mock_task, {maxRetries: 5, baseDelayMs: 100});
        await clock.tickAsync(1000);
        const result = await promise;

        expect(result).toBe('success');
        expect(mock_task).toHaveBeenCalledTimes(3);
      });
    });
  });

  describe('Options', () => {
    it('should use custom baseDelayMs', async () => {
      const clock = MockClock();
      return runTimelineAsync(clock, async () => {
        let attempts = 0;
        const mock_task = vi.fn().mockImplementation(() => {
          attempts++;
          if (attempts < 2) return Promise.reject(new Error('fail'));
          return Promise.resolve('ok');
        });

        const start = clock.systemTime();
        const promise = retry(mock_task, {maxRetries: 5, baseDelayMs: 500});
        await clock.tickAsync(1000);
        await promise;

        const elapsed = clock.systemTime() - start;
        expect(elapsed).toBeGreaterThanOrEqual(500);
      });
    });

    it('should work with no options', async () => {
      const clock = MockClock();
      return runTimelineAsync(clock, async () => {
        const mock_task = vi
          .fn<() => Promise<string>>()
          .mockResolvedValue('ok');

        const promise = retry(mock_task);
        await clock.tickAsync(0);
        const result = await promise;

        expect(result).toBe('ok');
      });
    });
  });

  describe('AbortSignal Support', () => {
    it('should throw immediately if signal is already aborted', async () => {
      const controller = new AbortController();
      controller.abort('cancelled');

      await expect(
        retry(() => 'x', {signal: controller.signal}),
      ).rejects.toThrow('cancelled');
    });
  });

  describe('Sync Function Support', () => {
    it('should work with sync function', async () => {
      const clock = MockClock();
      return runTimelineAsync(clock, async () => {
        const mock_task = vi.fn<() => string>().mockReturnValue('sync result');

        const promise = retry(mock_task);
        await clock.tickAsync(0);
        const result = await promise;

        expect(result).toBe('sync result');
      });
    });

    it('should retry sync function that throws', async () => {
      const clock = MockClock();
      return runTimelineAsync(clock, async () => {
        let attempts = 0;
        const mock_task = vi.fn<() => string>().mockImplementation(() => {
          attempts++;
          if (attempts < 3) throw new Error('sync fail');
          return 'sync success';
        });

        const promise = retry(mock_task, {maxRetries: 5, baseDelayMs: 10});
        await clock.tickAsync(100);
        const result = await promise;

        expect(result).toBe('sync success');
        expect(mock_task).toHaveBeenCalledTimes(3);
      });
    });
  });

  describe('All Retries Failed', () => {
    it('should throw last error when all retries fail', async () => {
      const clock = MockClock();
      const last_error = new Error('final error');
      const mock_task = vi
        .fn<() => Promise<string>>()
        .mockRejectedValue(last_error);

      await runTimelineAsync(clock, async () => {
        const promise = retry(mock_task, {maxRetries: 2, baseDelayMs: 10});
        await Promise.all([
          clock.tickAsync(100),
          expect(promise).rejects.toThrow('final error'),
        ]);
        expect(mock_task).toHaveBeenCalledTimes(3);
      });
    });
  });
});
