// ========================================
// ./src/Concurrent/Valve/circuit-breaker.spec.ts
// ========================================

import {describe, it, expect, afterAll} from 'vitest';
import {
  CircuitBreaker,
  CircuitBreakerOpenError,
  CircuitState,
} from './circuit-breaker';
import {ParameterError} from '../../Errors';
import {
  MockClock,
  withTimeline,
  withTimelineAsync,
  restoreGlobals,
} from '../../MockClock/__export__';

afterAll(restoreGlobals);

describe.concurrent('CircuitBreaker', () => {
  describe('Constructor', () => {
    it('should initialize with default parameters', () => {
      const clock = MockClock();
      withTimeline(clock, () => {
        const breaker = new CircuitBreaker();
        expect(breaker).toBeDefined();
        expect(breaker.getState()).toBe(CircuitState.Closed);
      });
    });

    it('should initialize with custom parameters', () => {
      const clock = MockClock();
      withTimeline(clock, () => {
        const breaker = new CircuitBreaker({
          failure_threshold: 3,
          reset_timeout: 5000,
          success_threshold: 2,
        });
        expect(breaker).toBeDefined();
        const stats = breaker.getStats();
        expect(stats.failure_threshold).toBe(3);
        expect(stats.reset_timeout).toBe(5000);
        expect(stats.success_threshold).toBe(2);
      });
    });

    it('should validate failure_threshold parameter', () => {
      const clock = MockClock();
      withTimeline(clock, () => {
        expect(() => new CircuitBreaker({failure_threshold: -1})).toThrow(
          ParameterError,
        );
        expect(() => new CircuitBreaker({failure_threshold: 0})).toThrow(
          ParameterError,
        );
        expect(() => new CircuitBreaker({failure_threshold: NaN})).toThrow(
          ParameterError,
        );
        expect(() => new CircuitBreaker({failure_threshold: Infinity})).toThrow(
          ParameterError,
        );
        expect(() => new CircuitBreaker({failure_threshold: 5})).not.toThrow();
      });
    });

    it('should validate reset_timeout parameter', () => {
      const clock = MockClock();
      withTimeline(clock, () => {
        expect(() => new CircuitBreaker({reset_timeout: -1})).toThrow(
          ParameterError,
        );
        expect(() => new CircuitBreaker({reset_timeout: 0})).toThrow(
          ParameterError,
        );
        expect(() => new CircuitBreaker({reset_timeout: NaN})).toThrow(
          ParameterError,
        );
        expect(() => new CircuitBreaker({reset_timeout: Infinity})).toThrow(
          ParameterError,
        );
        expect(() => new CircuitBreaker({reset_timeout: 1000})).not.toThrow();
      });
    });

    it('should validate success_threshold parameter', () => {
      const clock = MockClock();
      withTimeline(clock, () => {
        expect(() => new CircuitBreaker({success_threshold: -1})).toThrow(
          ParameterError,
        );
        expect(() => new CircuitBreaker({success_threshold: 0})).toThrow(
          ParameterError,
        );
        expect(() => new CircuitBreaker({success_threshold: NaN})).toThrow(
          ParameterError,
        );
        expect(() => new CircuitBreaker({success_threshold: Infinity})).toThrow(
          ParameterError,
        );
        expect(() => new CircuitBreaker({success_threshold: 3})).not.toThrow();
      });
    });
  });

  describe('execute - closed state', () => {
    it('should execute function successfully in closed state', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const breaker = new CircuitBreaker();
        const result = await breaker.execute(() => 'success');
        expect(result).toBe('success');
        expect(breaker.getState()).toBe(CircuitState.Closed);
      });
    });

    it('should track failures in closed state', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const breaker = new CircuitBreaker({failure_threshold: 3});

        for (let i = 0; i < 2; i++) {
          try {
            await breaker.execute(() => {
              throw new Error('fail');
            });
          } catch {
            // ignore
          }
        }

        expect(breaker.getStats().failure_count).toBe(2);
        expect(breaker.getState()).toBe(CircuitState.Closed);
      });
    });

    it('should reset failure count on success', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const breaker = new CircuitBreaker({failure_threshold: 5});

        try {
          await breaker.execute(() => {
            throw new Error('fail');
          });
        } catch {
          // ignore
        }

        expect(breaker.getStats().failure_count).toBe(1);

        await breaker.execute(() => 'success');

        expect(breaker.getStats().failure_count).toBe(0);
      });
    });

    it('should open circuit after reaching failure threshold', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const breaker = new CircuitBreaker({failure_threshold: 3});

        for (let i = 0; i < 3; i++) {
          try {
            await breaker.execute(() => {
              throw new Error('fail');
            });
          } catch {
            // ignore
          }
        }

        expect(breaker.getState()).toBe(CircuitState.Open);
      });
    });
  });

  describe('execute - open state', () => {
    it('should reject requests when circuit is open', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const breaker = new CircuitBreaker({
          failure_threshold: 1,
          reset_timeout: 1000,
        });

        try {
          await breaker.execute(() => {
            throw new Error('fail');
          });
        } catch {
          // ignore
        }

        expect(breaker.getState()).toBe(CircuitState.Open);

        await expect(breaker.execute(() => 'success')).rejects.toThrow(
          CircuitBreakerOpenError,
        );
      });
    });

    it('should include remaining timeout in error', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const breaker = new CircuitBreaker({
          failure_threshold: 1,
          reset_timeout: 1000,
        });

        try {
          await breaker.execute(() => {
            throw new Error('fail');
          });
        } catch {
          // ignore
        }

        try {
          await breaker.execute(() => 'success');
        } catch (error) {
          expect(error).toBeInstanceOf(CircuitBreakerOpenError);
          expect(
            (error as CircuitBreakerOpenError).reset_timeout,
          ).toBeGreaterThan(0);
        }
      });
    });

    it('should transition to half-open after reset_timeout', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const breaker = new CircuitBreaker({
          failure_threshold: 1,
          reset_timeout: 100,
        });

        try {
          await breaker.execute(() => {
            throw new Error('fail');
          });
        } catch {
          // ignore
        }

        expect(breaker.getState()).toBe(CircuitState.Open);

        clock.tick(150);

        expect(breaker.getState()).toBe(CircuitState.HalfOpen);
      });
    });
  });

  describe('execute - half-open state', () => {
    it('should allow requests in half-open state', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const breaker = new CircuitBreaker({
          failure_threshold: 1,
          reset_timeout: 100,
          success_threshold: 2,
        });

        try {
          await breaker.execute(() => {
            throw new Error('fail');
          });
        } catch {
          // ignore
        }

        clock.tick(150);

        expect(breaker.getState()).toBe(CircuitState.HalfOpen);

        const result = await breaker.execute(() => 'success');
        expect(result).toBe('success');
      });
    });

    it('should close circuit after success threshold reached', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const breaker = new CircuitBreaker({
          failure_threshold: 1,
          reset_timeout: 100,
          success_threshold: 2,
        });

        try {
          await breaker.execute(() => {
            throw new Error('fail');
          });
        } catch {
          // ignore
        }

        clock.tick(150);

        await breaker.execute(() => 'success1');
        expect(breaker.getState()).toBe(CircuitState.HalfOpen);

        await breaker.execute(() => 'success2');
        expect(breaker.getState()).toBe(CircuitState.Closed);
      });
    });

    it('should reopen circuit on failure in half-open state', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const breaker = new CircuitBreaker({
          failure_threshold: 1,
          reset_timeout: 100,
          success_threshold: 2,
        });

        try {
          await breaker.execute(() => {
            throw new Error('fail');
          });
        } catch {
          // ignore
        }

        clock.tick(150);

        expect(breaker.getState()).toBe(CircuitState.HalfOpen);

        try {
          await breaker.execute(() => {
            throw new Error('fail again');
          });
        } catch {
          // ignore
        }

        expect(breaker.getState()).toBe(CircuitState.Open);
      });
    });

    it('should reset success count on failure in half-open state', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const breaker = new CircuitBreaker({
          failure_threshold: 1,
          reset_timeout: 100,
          success_threshold: 3,
        });

        try {
          await breaker.execute(() => {
            throw new Error('fail');
          });
        } catch {
          // ignore
        }

        clock.tick(150);

        await breaker.execute(() => 'success1');
        expect(breaker.getStats().success_count).toBe(1);

        try {
          await breaker.execute(() => {
            throw new Error('fail');
          });
        } catch {
          // ignore
        }

        expect(breaker.getState()).toBe(CircuitState.Open);

        clock.tick(150);

        expect(breaker.getState()).toBe(CircuitState.HalfOpen);
        expect(breaker.getStats().success_count).toBe(0);
      });
    });
  });

  describe('tryExecute', () => {
    it('should return success result on successful execution', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const breaker = new CircuitBreaker();
        const result = await breaker.tryExecute(() => 'success');

        expect(result.success).toBe(true);
        expect(result.value).toBe('success');
        expect(result.state).toBe(CircuitState.Closed);
      });
    });

    it('should return failure result on error', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const breaker = new CircuitBreaker();
        const result = await breaker.tryExecute(() => {
          throw new Error('fail');
        });

        expect(result.success).toBe(false);
        expect(result.error).toBeInstanceOf(Error);
        expect((result.error as Error).message).toBe('fail');
      });
    });

    it('should return failure result when circuit is open', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const breaker = new CircuitBreaker({failure_threshold: 1});

        try {
          await breaker.execute(() => {
            throw new Error('fail');
          });
        } catch {
          // ignore
        }

        const result = await breaker.tryExecute(() => 'success');

        expect(result.success).toBe(false);
        expect(result.error).toBeInstanceOf(CircuitBreakerOpenError);
        expect(result.state).toBe(CircuitState.Open);
      });
    });
  });

  describe('waitForRecovery', () => {
    it('should resolve immediately when circuit is closed', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const breaker = new CircuitBreaker();
        await breaker.waitForRecovery();
        expect(breaker.getState()).toBe(CircuitState.Closed);
      });
    });

    it('should wait until circuit transitions to half-open', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const breaker = new CircuitBreaker({
          failure_threshold: 1,
          reset_timeout: 100,
        });

        try {
          await breaker.execute(() => {
            throw new Error('fail');
          });
        } catch {
          // ignore
        }

        expect(breaker.getState()).toBe(CircuitState.Open);

        const waitPromise = breaker.waitForRecovery();
        clock.tick(150);
        await waitPromise;

        expect(breaker.getState()).toBe(CircuitState.HalfOpen);
      });
    });

    it('should be abortable', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const breaker = new CircuitBreaker({
          failure_threshold: 1,
          reset_timeout: 1000,
        });

        try {
          await breaker.execute(() => {
            throw new Error('fail');
          });
        } catch {
          // ignore
        }

        const controller = new AbortController();
        const waitPromise = breaker.waitForRecovery(controller.signal);

        clock.tick(100);
        controller.abort('cancelled');

        await expect(waitPromise).rejects.toThrow('cancelled');
      });
    });
  });

  describe('reset', () => {
    it('should reset circuit to closed state', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const breaker = new CircuitBreaker({failure_threshold: 1});

        try {
          await breaker.execute(() => {
            throw new Error('fail');
          });
        } catch {
          // ignore
        }

        expect(breaker.getState()).toBe(CircuitState.Open);

        breaker.reset();

        expect(breaker.getState()).toBe(CircuitState.Closed);
        expect(breaker.getStats().failure_count).toBe(0);
      });
    });
  });

  describe('trip', () => {
    it('should manually trip the circuit', () => {
      const clock = MockClock();
      withTimeline(clock, () => {
        const breaker = new CircuitBreaker();
        expect(breaker.getState()).toBe(CircuitState.Closed);

        breaker.trip();

        expect(breaker.getState()).toBe(CircuitState.Open);
      });
    });
  });

  describe('getStats', () => {
    it('should return correct stats in closed state', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, () => {
        const breaker = new CircuitBreaker({
          failure_threshold: 5,
          reset_timeout: 1000,
          success_threshold: 3,
        });

        const stats = breaker.getStats();

        expect(stats.state).toBe(CircuitState.Closed);
        expect(stats.failure_count).toBe(0);
        expect(stats.success_count).toBe(0);
        expect(stats.failure_threshold).toBe(5);
        expect(stats.success_threshold).toBe(3);
        expect(stats.reset_timeout).toBe(1000);
        expect(stats.remaining_timeout).toBe(0);
      });
    });

    it('should return correct stats in open state', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const breaker = new CircuitBreaker({
          failure_threshold: 1,
          reset_timeout: 1000,
        });

        try {
          await breaker.execute(() => {
            throw new Error('fail');
          });
        } catch {
          // ignore
        }

        const stats = breaker.getStats();

        expect(stats.state).toBe(CircuitState.Open);
        expect(stats.failure_count).toBe(1);
        expect(stats.remaining_timeout).toBeGreaterThan(0);
      });
    });

    it('should return correct stats in half-open state', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const breaker = new CircuitBreaker({
          failure_threshold: 1,
          reset_timeout: 100,
          success_threshold: 3,
        });

        try {
          await breaker.execute(() => {
            throw new Error('fail');
          });
        } catch {
          // ignore
        }

        clock.tick(150);
        await breaker.execute(() => 'success');

        const stats = breaker.getStats();

        expect(stats.state).toBe(CircuitState.HalfOpen);
        expect(stats.success_count).toBe(1);
      });
    });
  });

  describe('AbortSignal', () => {
    it('should throw immediately if signal is already aborted', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const breaker = new CircuitBreaker();
        const controller = new AbortController();
        controller.abort('test abort');

        await expect(
          breaker.execute(() => 'success', controller.signal),
        ).rejects.toThrow('test abort');
      });
    });

    it('should propagate abort during execution', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const breaker = new CircuitBreaker();
        const controller = new AbortController();

        const promise = breaker.execute(async (signal) => {
          await new Promise((_, reject) => {
            const handler = () =>
              reject(new DOMException('Aborted', 'AbortError'));
            signal?.addEventListener('abort', handler);
          });
        }, controller.signal);

        controller.abort();

        await expect(promise).rejects.toThrow();
      });
    });
  });

  describe('State transitions', () => {
    it('should handle complete state cycle', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const breaker = new CircuitBreaker({
          failure_threshold: 2,
          reset_timeout: 100,
          success_threshold: 2,
        });

        // closed -> open
        try {
          await breaker.execute(() => {
            throw new Error('fail1');
          });
        } catch {
          /* empty */
        }
        try {
          await breaker.execute(() => {
            throw new Error('fail2');
          });
        } catch {
          /* empty */
        }

        expect(breaker.getState()).toBe(CircuitState.Open);

        // open -> half-open
        clock.tick(150);
        expect(breaker.getState()).toBe(CircuitState.HalfOpen);

        // half-open -> open (failure)
        try {
          await breaker.execute(() => {
            throw new Error('fail3');
          });
        } catch {
          /* empty */
        }

        expect(breaker.getState()).toBe(CircuitState.Open);

        // open -> half-open
        clock.tick(150);
        expect(breaker.getState()).toBe(CircuitState.HalfOpen);

        // half-open -> closed (success threshold)
        await breaker.execute(() => 'success1');
        await breaker.execute(() => 'success2');

        expect(breaker.getState()).toBe(CircuitState.Closed);
      });
    });
  });
});
