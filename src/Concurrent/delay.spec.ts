// ========================================
// ./src/Concurrent/delay.spec.ts
// ========================================

import {describe, it, expect, afterAll, vi} from 'vitest';
import {delay, delaySafe, sleep} from './delay';
import {
  MockClock,
  runTimelineAsync,
  restoreGlobals,
} from '../MockClock/__export__';

afterAll(() => {
  restoreGlobals();
});

describe.concurrent('Delay & Sleep', () => {
  // -- Sleep 测试 --
  describe('sleep', () => {
    it('should resolve after the specified time', async () => {
      const clock = MockClock();
      await runTimelineAsync(clock, async () => {
        let resolved = false;
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        sleep(1000).then(() => {
          resolved = true;
        });

        expect(resolved).toBe(false);

        clock.tick(1000);
        await Promise.resolve();

        expect(resolved).toBe(true);
      });
    });

    it('should resolve with undefined', async () => {
      const clock = MockClock();
      await runTimelineAsync(clock, async () => {
        const promise = sleep(500);
        clock.tick(500);
        await expect(promise).resolves.toBeUndefined();
      });
    });
  });

  // -- Delay 测试 --
  describe('delay', () => {
    it('should resolve normally if not aborted', async () => {
      const clock = MockClock();
      await runTimelineAsync(clock, async () => {
        const controller = new AbortController();
        const promise = delay(500, controller.signal);
        clock.tick(500);
        await expect(promise).resolves.toBeUndefined();
      });
    });

    it('should reject immediately if signal is already aborted', async () => {
      const clock = MockClock();
      await runTimelineAsync(clock, async () => {
        const controller = new AbortController();
        controller.abort('Meow!');

        await expect(delay(1000, controller.signal)).rejects.toThrow('Meow!');
      });
    });

    it('should reject with DOMException when aborted with string reason', async () => {
      const clock = MockClock();
      await runTimelineAsync(clock, async () => {
        const controller = new AbortController();
        controller.abort('Custom abort reason');

        try {
          await delay(1000, controller.signal);
        } catch (error) {
          expect(error).toBeInstanceOf(DOMException);
          expect((error as Error).message).toContain('Custom abort reason');
        }
      });
    });

    it('should reject with DOMException when aborted with Error', async () => {
      const clock = MockClock();
      await runTimelineAsync(clock, async () => {
        const controller = new AbortController();
        const error = new Error('Stop!');
        controller.abort(error);

        await expect(delay(1000, controller.signal)).rejects.toThrow('Stop!');
      });
    });

    it('should cancel the timeout when signal aborts midway', async () => {
      const clock = MockClock();
      await runTimelineAsync(clock, async () => {
        const controller = new AbortController();
        const promise = delay(1000, controller.signal);
        let resolved = false;
        let rejected = false;

        promise.then(() => (resolved = true)).catch(() => (rejected = true));

        clock.tick(500);
        controller.abort(new Error('Stop!'));

        await Promise.resolve();
        await Promise.resolve();

        expect(rejected).toBe(true);
        expect(resolved).toBe(false);
      });
    });

    it('should cleanup event listener after resolution', async () => {
      const clock = MockClock();
      await runTimelineAsync(clock, async () => {
        const controller = new AbortController();
        const removeSpy = vi.spyOn(controller.signal, 'removeEventListener');

        const promise = delay(100, controller.signal);
        clock.tick(100);
        await promise;

        expect(removeSpy).toHaveBeenCalledWith('abort', expect.any(Function));
      });
    });

    it('should handle multiple delays with same signal', async () => {
      const clock = MockClock();
      await runTimelineAsync(clock, async () => {
        const controller = new AbortController();
        const delay1 = delay(100, controller.signal);
        const delay2 = delay(200, controller.signal);

        clock.tick(50);
        controller.abort('Cancel all');

        await expect(delay1).rejects.toThrow('Cancel all');
        await expect(delay2).rejects.toThrow('Cancel all');
      });
    });

    it('should work without signal parameter', async () => {
      const clock = MockClock();
      await runTimelineAsync(clock, async () => {
        const promise = delay(100);
        clock.tick(100);
        await expect(promise).resolves.toBeUndefined();
      });
    });
  });

  // -- Delay Safe 测试 --
  describe('delaySafe', () => {
    it('should resolve normally if not aborted', async () => {
      const clock = MockClock();
      await runTimelineAsync(clock, async () => {
        const controller = new AbortController();
        const promise = delaySafe(500, controller.signal);
        clock.tick(500);
        await expect(promise).resolves.toBeUndefined();
      });
    });

    it('should resolve with DOMException immediately if signal is already aborted', async () => {
      const clock = MockClock();
      await runTimelineAsync(clock, async () => {
        const controller = new AbortController();
        controller.abort('Already aborted');

        const result = await delaySafe(1000, controller.signal);
        expect(result).toBeInstanceOf(DOMException);
        expect((result as DOMException).message).toContain('Already aborted');
      });
    });

    it('should resolve with DOMException when aborted midway', async () => {
      const clock = MockClock();
      await runTimelineAsync(clock, async () => {
        const controller = new AbortController();
        const promise = delaySafe(1000, controller.signal);

        clock.tick(500);
        controller.abort('Midway abort');

        const result = await promise;
        expect(result).toBeInstanceOf(DOMException);
        expect((result as DOMException).message).toContain('Midway abort');
      });
    });

    it('should cleanup timeout when aborted', async () => {
      const clock = MockClock();
      await runTimelineAsync(clock, async () => {
        const controller = new AbortController();
        const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
        const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

        const promise = delaySafe(1000, controller.signal);

        clock.tick(500);
        controller.abort();
        await promise;

        expect(setTimeoutSpy).toHaveBeenCalled();
        expect(clearTimeoutSpy).toHaveBeenCalled();
      });
    });

    it('should not reject on abort (safe behavior)', async () => {
      const clock = MockClock();
      await runTimelineAsync(clock, async () => {
        const controller = new AbortController();
        const promise = delaySafe(1000, controller.signal);

        controller.abort('Safe abort');

        await expect(promise).resolves.toBeDefined();
        const result = await promise;
        expect(result).toBeInstanceOf(DOMException);
      });
    });

    it('should resolve with undefined when completed successfully', async () => {
      const clock = MockClock();
      await runTimelineAsync(clock, async () => {
        const controller = new AbortController();
        const promise = delaySafe(200, controller.signal);

        clock.tick(200);
        const result = await promise;

        expect(result).toBeUndefined();
      });
    });
  });

  // -- 边界条件测试 --
  describe('edge cases', () => {
    it('should handle zero delay', async () => {
      const clock = MockClock();
      await runTimelineAsync(clock, async () => {
        const controller = new AbortController();
        const promise = delay(0, controller.signal);

        clock.tick(0);
        await expect(promise).resolves.toBeUndefined();
      });
    });

    it('should handle negative delay (should still work)', async () => {
      const clock = MockClock();
      await runTimelineAsync(clock, async () => {
        const controller = new AbortController();
        const promise = delay(-100, controller.signal);

        clock.tick(0);
        await expect(promise).resolves.toBeUndefined();
      });
    });

    it('should handle very large delay', async () => {
      const clock = MockClock();
      await runTimelineAsync(clock, async () => {
        const controller = new AbortController();
        const promise = delay(2147483647, controller.signal);

        clock.tick(1000);
        controller.abort('Too long');

        await expect(promise).rejects.toThrow('Too long');
      });
    });

    it('should work with AbortSignal.timeout()', async () => {
      const clock = MockClock();
      await runTimelineAsync(clock, async () => {
        const signal = AbortSignal.timeout(10);
        const promise = delay(50, signal);

        clock.tick(10);
        await expect(promise).rejects.toThrow();
      });
    });
  });
});
