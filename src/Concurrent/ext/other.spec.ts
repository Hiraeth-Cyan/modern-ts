// ========================================
// ./src/Concurrent/ext/other.spec.ts
// ========================================
import {describe, it, expect, vi, afterAll} from 'vitest';
import {asyncTimeout, asyncSettle, asyncWaitFor} from './other';
import {ParameterError} from '../../Errors';
import {sleep} from '../delay';

import {
  MockClock,
  withTimelineAsync,
  restoreGlobals,
} from '../../MockClock/__export__';

// 确保测试结束后恢复全局 API
afterAll(restoreGlobals);

describe.concurrent('asyncTimeout', () => {
  describe('parameter validation', () => {
    it.each([
      {ms: 0, description: 'zero'},
      {ms: -1, description: 'negative'},
      {ms: 1.5, description: 'non-integer'},
      {ms: NaN, description: 'NaN'},
      {ms: Infinity, description: 'Infinity'},
      {ms: -Infinity, description: '-Infinity'},
    ])('should throw ParameterError for invalid ms: $description', ({ms}) => {
      expect(() => asyncTimeout(Promise.resolve('value'), {ms})).toThrow(
        ParameterError,
      );
    });

    it('should accept valid positive integer ms', () => {
      expect(asyncTimeout(Promise.resolve('value'), {ms: 1})).toBeDefined();
    });
  });

  describe('basic functionality', () => {
    it('should resolve with promise value if promise resolves before timeout', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const promise = asyncTimeout(Promise.resolve('success'), {ms: 1000});
        await clock.tickAsync(0);
        const result = await promise;
        expect(result).toBe('success');
      });
    });

    it('should reject with TimeoutError if promise does not resolve in time', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const slowPromise = new Promise(() => {});
        const promise = asyncTimeout(slowPromise, {ms: 100});
        const catchSpy = vi.fn();
        promise.catch(catchSpy);

        await clock.tickAsync(100);

        expect(catchSpy).toHaveBeenCalled();
        const e = catchSpy.mock.calls[0][0] as Error;
        expect(e).toBeInstanceOf(DOMException);
        expect(e.name).toBe('TimeoutError');
        expect(e.message).toContain('100ms');
      });
    });

    it('should reject with promise rejection if promise rejects before timeout', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const errorPromise = Promise.reject(new Error('promise error'));
        errorPromise.catch(() => {});

        const promise = asyncTimeout(errorPromise, {ms: 1000});
        const catchSpy = vi.fn();
        promise.catch(catchSpy);

        await clock.tickAsync(0);

        expect(catchSpy).toHaveBeenCalled();
        expect((catchSpy.mock.calls[0][0] as Error).message).toBe(
          'promise error',
        );
      });
    });
  });

  describe('fallback option', () => {
    it('should resolve with fallback result on timeout', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const slowPromise = new Promise(() => {});
        const fallback = vi.fn(() => 'fallback value');
        const promise = asyncTimeout(slowPromise, {ms: 100, fallback});

        await clock.tickAsync(100);
        const result = await promise;

        expect(result).toBe('fallback value');
        expect(fallback).toHaveBeenCalledTimes(1);
      });
    });

    it('should reject if fallback function throws', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const slowPromise = new Promise(() => {});
        const promise = asyncTimeout(slowPromise, {
          ms: 100,
          fallback: () => {
            throw new Error('fallback error');
          },
        });
        const catchSpy = vi.fn();
        promise.catch(catchSpy);

        await clock.tickAsync(100);

        expect(catchSpy).toHaveBeenCalled();
        expect((catchSpy.mock.calls[0][0] as Error).message).toBe(
          'fallback error',
        );
      });
    });
  });

  describe('abort signal', () => {
    it('should reject immediately if signal is already aborted', async () => {
      const controller = new AbortController();
      controller.abort('Already aborted');

      const promise = asyncTimeout(Promise.resolve('value'), {
        ms: 1000,
        signal: controller.signal,
      });

      try {
        await promise;
        expect.fail('Should have thrown');
      } catch (e) {
        expect((e as Error).message).toContain('Already aborted');
      }
    });

    it('should reject with DOMException when signal aborts midway', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const controller = new AbortController();
        const slowPromise = new Promise(() => {});
        const promise = asyncTimeout(slowPromise, {
          ms: 1000,
          signal: controller.signal,
        });

        await clock.tickAsync(500);
        controller.abort('Midway abort');

        try {
          await promise;
          expect.fail('Should have thrown');
        } catch (e) {
          expect(e).toBeInstanceOf(DOMException);
          expect((e as Error).message).toContain('Midway abort');
        }
      });
    });

    it('should cleanup event listener on completion or timeout', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const controller = new AbortController();
        const removeSpy = vi.spyOn(controller.signal, 'removeEventListener');

        // 测试正常完成时的清理
        const promise1 = asyncTimeout(Promise.resolve('value'), {
          ms: 1000,
          signal: controller.signal,
        });
        await clock.tickAsync(0);
        await promise1;
        expect(removeSpy).toHaveBeenCalledWith('abort', expect.any(Function));

        // 测试超时时的清理
        removeSpy.mockClear();
        const slowPromise = new Promise(() => {});
        const promise2 = asyncTimeout(slowPromise, {
          ms: 100,
          signal: controller.signal,
        });
        promise2.catch(() => {});
        await clock.tickAsync(100);
        expect(removeSpy).toHaveBeenCalledWith('abort', expect.any(Function));
      });
    });
  });

  describe('clear method', () => {
    it('should have a clear method on the returned promise', () => {
      const promise = asyncTimeout(Promise.resolve('value'), {ms: 1000});
      expect(typeof promise.clear).toBe('function');
    });

    it('should reject with AbortError when clear is called', async () => {
      const slowPromise = new Promise(() => {});
      const promise = asyncTimeout(slowPromise, {ms: 1000});

      promise.clear();

      try {
        await promise;
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(DOMException);
        expect((e as DOMException).name).toBe('AbortError');
        expect((e as Error).message).toContain('cleared by user');
      }
    });

    it('should cleanup timer when clear is called', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const slowPromise = new Promise(() => {});
        const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

        const promise = asyncTimeout(slowPromise, {ms: 1000});
        promise.clear();

        expect(clearTimeoutSpy).toHaveBeenCalled();
        await promise.catch(() => {});
      });
    });
  });

  describe('edge cases', () => {
    it('should handle promise that resolves exactly at timeout', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        let resolvePromise: (value: string) => void;
        const promise = new Promise<string>((resolve) => {
          resolvePromise = resolve;
        });

        const timeoutPromise = asyncTimeout(promise, {ms: 100});

        await clock.tickAsync(99);
        resolvePromise!('resolved');
        await clock.tickAsync(1);

        expect(await timeoutPromise).toBe('resolved');
      });
    });

    it('should handle multiple abort signals correctly', async () => {
      const controller1 = new AbortController();
      const controller2 = new AbortController();

      const promise1 = asyncTimeout(new Promise(() => {}), {
        ms: 1000,
        signal: controller1.signal,
      });
      const promise2 = asyncTimeout(new Promise(() => {}), {
        ms: 1000,
        signal: controller2.signal,
      });

      controller1.abort('Abort 1');
      controller2.abort('Abort 2');

      const [r1, r2] = await Promise.allSettled([promise1, promise2]);
      expect(r1.status).toBe('rejected');
      expect(r2.status).toBe('rejected');
    });
  });
});

describe.concurrent('asyncWaitFor', () => {
  describe('parameter validation', () => {
    it.each([
      {interval: -1, description: 'negative interval'},
      {interval: NaN, description: 'NaN interval'},
      {interval: Infinity, description: 'Infinity interval'},
    ])('should throw ParameterError for $description', async ({interval}) => {
      try {
        await asyncWaitFor(() => true, {interval});
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(ParameterError);
      }
    });

    it.each([
      {timeout: -1, description: 'negative timeout'},
      {timeout: NaN, description: 'NaN timeout'},
    ])('should throw ParameterError for $description', async ({timeout}) => {
      try {
        await asyncWaitFor(() => true, {timeout});
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(ParameterError);
      }
    });

    it('should accept valid interval and timeout', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        let counter = 0;
        const promise = asyncWaitFor(() => ++counter >= 3, {
          interval: 1,
          timeout: 100,
        });
        await clock.runAllAsync();
        await promise;
        expect(counter).toBeGreaterThanOrEqual(3);
      });
    });
  });

  describe('basic functionality', () => {
    it('should resolve immediately if condition is already true', async () => {
      expect(await asyncWaitFor(() => true)).toBeUndefined();
    });

    it('should wait until condition becomes true', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        let counter = 0;
        const promise = asyncWaitFor(() => ++counter >= 3, {interval: 1});
        await clock.runAllAsync();
        await promise;
        expect(counter).toBeGreaterThanOrEqual(3);
      });
    });

    it('should work with async condition', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        let counter = 0;
        const promise = asyncWaitFor(
          () => {
            counter++;
            return counter >= 3;
          },
          {interval: 10},
        );
        await clock.runAllAsync();
        const result = await promise;
        expect(result).toBeUndefined();
        expect(counter).toBeGreaterThanOrEqual(3);
      });
    });
  });

  describe('before option', () => {
    it('should check condition before first delay when before is true (default)', async () => {
      let checked = false;
      await asyncWaitFor(
        () => {
          checked = true;
          return true;
        },
        {before: true, interval: 100},
      );
      expect(checked).toBe(true);
    });

    it('should delay before first check when before is false', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        let checked = false;
        const promise = asyncWaitFor(
          () => {
            checked = true;
            return true;
          },
          {before: false, interval: 50},
        );
        expect(checked).toBe(false);
        await clock.tickAsync(50);
        await promise;
        expect(checked).toBe(true);
      });
    });

    it('should abort during initial delay when before is false', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const controller = new AbortController();
        const promise = asyncWaitFor(() => true, {
          before: false,
          interval: 50,
          signal: controller.signal,
        });
        const catchSpy = vi.fn();
        promise.catch(catchSpy);

        await clock.tickAsync(5);
        controller.abort('Aborted during initial delay');
        await clock.runAllAsync();

        expect(catchSpy).toHaveBeenCalled();
        expect((catchSpy.mock.calls[0][0] as Error).message).toContain(
          'Aborted during initial delay',
        );
      });
    });
  });

  describe('timeout option', () => {
    it('should reject with TimeoutError when timeout is reached', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const promise = asyncWaitFor(() => false, {interval: 5, timeout: 10});
        const catchSpy = vi.fn();
        promise.catch(catchSpy);

        await clock.tickAsync(10);

        expect(catchSpy).toHaveBeenCalled();
        const e = catchSpy.mock.calls[0][0] as Error;
        expect(e).toBeInstanceOf(DOMException);
        expect((e as DOMException).name).toBe('TimeoutError');
        expect(e.message).toContain('10ms');
      });
    });

    it('should use custom timeout message or Error instance', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        // 测试字符串消息
        const promise1 = asyncWaitFor(() => false, {
          interval: 5,
          timeout: {ms: 10, message: 'Custom timeout message'},
        });
        const catchSpy1 = vi.fn();
        promise1.catch(catchSpy1);
        await clock.tickAsync(10);
        expect(catchSpy1).toHaveBeenCalled();
        expect((catchSpy1.mock.calls[0][0] as Error).message).toContain(
          'Custom timeout message',
        );
      });
    });

    it('should use fallback function on timeout', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const promise = asyncWaitFor(() => false, {
          interval: 5,
          timeout: {ms: 10, fallback: () => 'fallback result'},
        });
        await clock.tickAsync(10);
        const result = await promise;
        expect(result).toBe('fallback result');
      });
    });

    it('should accept Infinity as timeout and handle timeout object without ms', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        let counter = 0;
        const promise1 = asyncWaitFor(() => ++counter >= 3, {
          interval: 10,
          timeout: Infinity,
        });
        await clock.runAllAsync();
        await promise1;
        expect(counter).toBeGreaterThanOrEqual(3);
      });

      const clock2 = MockClock();
      await withTimelineAsync(clock2, async () => {
        let counter = 0;
        const promise2 = asyncWaitFor(() => ++counter >= 3, {
          interval: 10,
          timeout: {} as {ms: number},
        });
        await clock2.runAllAsync();
        await promise2;
        expect(counter).toBeGreaterThanOrEqual(3);
      });
    });
  });

  describe('abort signal', () => {
    it('should throw immediately if signal is already aborted', async () => {
      const controller = new AbortController();
      controller.abort('Already aborted');

      try {
        await asyncWaitFor(() => true, {signal: controller.signal});
        expect.fail('Should have thrown');
      } catch (e) {
        expect((e as Error).message).toContain('Already aborted');
      }
    });

    it('should abort during waiting and throw DOMException', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const controller = new AbortController();

        const promise = asyncWaitFor(() => false, {
          interval: 5,
          signal: controller.signal,
        });
        const catchSpy = vi.fn();
        promise.catch(catchSpy);

        await clock.tickAsync(10);
        controller.abort('Midway abort');
        await clock.runAllAsync();

        expect(catchSpy).toHaveBeenCalled();
        expect(catchSpy.mock.calls[0][0]).toBeInstanceOf(DOMException);
        expect((catchSpy.mock.calls[0][0] as Error).message).toContain(
          'Midway abort',
        );
      });
    });
  });

  describe('asyncWaitFor.done', () => {
    it('should return a value using done()', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        let counter = 0;
        const promise = asyncWaitFor(
          () => {
            counter++;
            if (counter >= 3) return asyncWaitFor.done('final value');
            return false;
          },
          {interval: 10},
        );
        await clock.runAllAsync();
        const result = await promise;
        expect(result).toBe('final value');
      });
    });

    it('should work with async condition and done()', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const promise = asyncWaitFor(() => asyncWaitFor.done(42));
        await clock.runAllAsync();
        const result = await promise;
        expect(result).toBe(42);
      });
    });

    it('should return undefined for void type when condition is true', async () => {
      expect(await asyncWaitFor(() => true)).toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('should propagate error from condition function', async () => {
      try {
        await asyncWaitFor(() => {
          throw new Error('Condition error');
        });
        expect.fail('Should have thrown');
      } catch (e) {
        expect((e as Error).message).toBe('Condition error');
      }
    });

    it('should throw ParameterError for invalid return type', async () => {
      const invalidReturns = [
        () => 'invalid' as unknown as boolean,
        () => ({some: 'object'}) as unknown as boolean,
        () => null as unknown as boolean,
        () => 0 as unknown as boolean,
        () => '' as unknown as boolean,
      ];

      for (const condition of invalidReturns) {
        try {
          await asyncWaitFor(condition);
          expect.fail('Should have thrown');
        } catch (e) {
          expect(e).toBeInstanceOf(ParameterError);
        }
      }
    });

    it('should handle condition throwing signal.reason error', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const controller = new AbortController();
        const abortReason = new Error('Abort reason');

        const promise = asyncWaitFor(
          () => {
            controller.abort(abortReason);
            throw abortReason;
          },
          {interval: 10, timeout: 50, signal: controller.signal},
        );
        const catchSpy = vi.fn();
        promise.catch(catchSpy);

        await clock.runAllAsync();

        expect(catchSpy).toHaveBeenCalled();
        expect(catchSpy.mock.calls[0][0]).toBeInstanceOf(DOMException);
      });
    });

    it('should detect abort at loop start after condition returns false', async () => {
      const controller = new AbortController();
      let call_count = 0;

      try {
        await asyncWaitFor(
          () => {
            call_count++;
            if (call_count === 1) {
              controller.abort('Abort after first check');
              return false;
            }
            return true;
          },
          {signal: controller.signal},
        );
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(DOMException);
        expect((e as Error).message).toContain('Abort after first check');
      }
    });

    it('should detect abort at loop start for sync condition that aborts and returns false', async () => {
      const controller = new AbortController();

      try {
        await asyncWaitFor(
          () => {
            controller.abort('Abort in sync condition');
            return false;
          },
          {interval: 1, signal: controller.signal},
        );
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(DOMException);
        expect((e as Error).message).toContain('Abort in sync condition');
      }
    });

    it('should detect abort at loop start with before=false and zero interval', async () => {
      const controller = new AbortController();
      let call_count = 0;

      try {
        await asyncWaitFor(
          () => {
            call_count++;
            if (call_count === 1) {
              controller.abort('Abort in first call');
            }
            return false;
          },
          {before: false, interval: 0, signal: controller.signal},
        );
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(DOMException);
      }
    });

    it('should detect abort at loop start after async condition returns false', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const controller = new AbortController();

        const promise = asyncWaitFor(
          () => {
            controller.abort('Abort during async condition');
            return false;
          },
          {interval: 10, signal: controller.signal},
        );
        const catchSpy = vi.fn();
        promise.catch(catchSpy);

        await clock.runAllAsync();

        expect(catchSpy).toHaveBeenCalled();
        expect(catchSpy.mock.calls[0][0]).toBeInstanceOf(DOMException);
        expect((catchSpy.mock.calls[0][0] as Error).message).toContain(
          'Abort during async condition',
        );
      });
    });
  });

  describe('combined signals (timeout + abort)', () => {
    it('should handle both timeout signal and abort signal', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const controller = new AbortController();

        const promise = asyncWaitFor(() => false, {
          interval: 5,
          timeout: 20,
          signal: controller.signal,
        });
        const catchSpy = vi.fn();
        promise.catch(catchSpy);

        await clock.tickAsync(10);
        controller.abort('User abort');
        await clock.runAllAsync();

        expect(catchSpy).toHaveBeenCalled();
        expect((catchSpy.mock.calls[0][0] as Error).message).toContain(
          'User abort',
        );
      });
    });

    it('should timeout before abort', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const controller = new AbortController();

        const promise = asyncWaitFor(() => false, {
          interval: 5,
          timeout: 10,
          signal: controller.signal,
        });
        const catchSpy = vi.fn();
        promise.catch(catchSpy);

        await clock.tickAsync(10);

        expect(catchSpy).toHaveBeenCalled();
        const e = catchSpy.mock.calls[0][0] as Error;
        expect(e).toBeInstanceOf(DOMException);
        expect((e as DOMException).name).toBe('TimeoutError');
      });
    });
  });

  describe('edge cases', () => {
    it('should handle zero interval', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        let counter = 0;
        const promise = asyncWaitFor(() => ++counter >= 3, {interval: 0});
        await clock.runAllAsync();
        await promise;
        expect(counter).toBeGreaterThanOrEqual(3);
      });
    });

    it('should handle fallback returning undefined', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const promise = asyncWaitFor(() => false, {
          interval: 5,
          timeout: {ms: 10, fallback: () => undefined},
        });
        await clock.tickAsync(10);
        const result = await promise;
        expect(result).toBeUndefined();
      });
    });

    it('should handle AbortSignal.timeout()', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const signal = AbortSignal.timeout(5);
        const promise = asyncWaitFor(() => false, {interval: 1, signal});
        const catchSpy = vi.fn();
        promise.catch(catchSpy);
        await clock.tickAsync(10);
        expect(catchSpy).toHaveBeenCalled();
      });
    });

    it('should handle condition throwing abort signal reason', async () => {
      const controller = new AbortController();
      controller.abort('Abort reason');

      try {
        await asyncWaitFor(
          () => {
            throw controller.signal.reason;
          },
          {signal: controller.signal},
        );
        expect.fail('Should have thrown');
      } catch (e) {
        expect((e as Error).message).toContain('Abort reason');
      }
    });

    it('should handle condition throwing error equal to signal reason during execution', async () => {
      const controller = new AbortController();
      const custom_reason = new Error('Custom abort reason');

      const promise = asyncWaitFor(
        () => {
          controller.abort(custom_reason);
          throw custom_reason;
        },
        {signal: controller.signal},
      );

      try {
        await promise;
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(DOMException);
        expect((e as Error).message).toContain('Custom abort reason');
      }
    });
  });
});

describe.concurrent('asyncSettle', () => {
  describe('parameter validation', () => {
    it.each([
      {concurrency: 0, description: 'zero'},
      {concurrency: -1, description: 'negative'},
      {concurrency: 1.5, description: 'non-integer'},
      {concurrency: NaN, description: 'NaN'},
    ])(
      'should throw ParameterError for invalid concurrency: $description',
      async ({concurrency}) => {
        try {
          await asyncSettle([1, 2, 3], {mapper: (x) => x, concurrency});
          expect.fail('Should have thrown');
        } catch (e) {
          expect(e).toBeInstanceOf(ParameterError);
        }
      },
    );

    it('should accept valid concurrency values including Infinity', async () => {
      const result1 = await asyncSettle([1, 2, 3], {
        mapper: (x) => x * 2,
        concurrency: 1,
      });
      expect(result1).toHaveLength(3);

      const result2 = await asyncSettle([1, 2, 3], {
        mapper: (x) => x,
        concurrency: Infinity,
      });
      expect(result2).toHaveLength(3);
    });
  });

  describe('basic functionality', () => {
    it('should return settled results for all elements with order preserved', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const resultPromise = asyncSettle([3, 1, 2], {
          mapper: async (x) => {
            await sleep(x * 10);
            return x;
          },
          concurrency: 1,
        });

        await clock.runAllAsync();
        const result = await resultPromise;

        expect(result[0]).toEqual({status: 'fulfilled', value: 3});
        expect(result[1]).toEqual({status: 'fulfilled', value: 1});
        expect(result[2]).toEqual({status: 'fulfilled', value: 2});
      });
    });

    it('should handle mixed fulfilled and rejected results', async () => {
      const result = await asyncSettle([1, 2, 3], {
        mapper: (x) => {
          if (x === 2) throw new Error('Failed at 2');
          return x * 10;
        },
      });

      expect(result[0]).toEqual({status: 'fulfilled', value: 10});
      expect(result[1].status).toBe('rejected');
      if (result[1].status === 'rejected') {
        expect((result[1].reason as Error).message).toBe('Failed at 2');
      }
      expect(result[2]).toEqual({status: 'fulfilled', value: 30});
    });
  });

  describe('concurrency control', () => {
    it('should respect concurrency limit', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        let running = 0;
        let maxRunning = 0;

        const result = asyncSettle([1, 2, 3, 4, 5], {
          mapper: async (x) => {
            running++;
            maxRunning = Math.max(maxRunning, running);
            await sleep(10);
            running--;
            return x;
          },
          concurrency: 2,
        });

        await clock.runAllAsync();
        await result;

        expect(maxRunning).toBeLessThanOrEqual(2);
      });
    });

    it('should process all items even with low concurrency', async () => {
      const processed: number[] = [];

      const result = await asyncSettle([1, 2, 3, 4, 5], {
        mapper: (x) => {
          processed.push(x);
          return x;
        },
        concurrency: 1,
      });

      expect(processed).toHaveLength(5);
      expect(result).toHaveLength(5);
    });
  });

  describe('abort signal', () => {
    it('should throw immediately if signal is already aborted', async () => {
      const controller = new AbortController();
      controller.abort('Already aborted');

      try {
        await asyncSettle([1, 2, 3], {
          mapper: (x) => x,
          signal: controller.signal,
        });
        expect.fail('Should have thrown');
      } catch (e) {
        expect((e as Error).message).toContain('Already aborted');
      }
    });

    it('should abort during processing and throw DOMException', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const controller = new AbortController();

        const promise = asyncSettle([1, 2, 3, 4, 5], {
          mapper: async (x) => {
            await sleep(100);
            return x;
          },
          concurrency: 1,
          signal: controller.signal,
        });
        const catchSpy = vi.fn();
        promise.catch(catchSpy);

        await clock.tickAsync(50);
        controller.abort('Midway abort');
        await clock.runAllAsync();

        expect(catchSpy).toHaveBeenCalled();
        expect(catchSpy.mock.calls[0][0]).toBeInstanceOf(DOMException);
        expect((catchSpy.mock.calls[0][0] as Error).message).toContain(
          'Midway abort',
        );
      });
    });
  });

  describe('edge cases', () => {
    it('should handle empty array and single element', async () => {
      expect(await asyncSettle([], {mapper: (x) => x})).toEqual([]);
      expect(await asyncSettle([42], {mapper: (x) => x})).toEqual([
        {status: 'fulfilled', value: 42},
      ]);
    });

    it('should pass index to mapper', async () => {
      const indices: number[] = [];

      await asyncSettle([10, 20, 30], {
        mapper: (_x, index) => {
          indices.push(index);
          return index;
        },
      });

      expect(indices).toEqual([0, 1, 2]);
    });

    it('should handle mapper that returns undefined', async () => {
      const result = await asyncSettle([1, 2, 3], {mapper: () => undefined});

      expect(result).toEqual([
        {status: 'fulfilled', value: undefined},
        {status: 'fulfilled', value: undefined},
        {status: 'fulfilled', value: undefined},
      ]);
    });
  });
});
