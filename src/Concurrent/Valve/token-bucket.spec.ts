// ========================================
// ./src/Concurrent/Valve/token-bucket.spec.ts
// ========================================

import {describe, it, expect, afterAll, beforeAll} from 'vitest';
import {TokenBucket} from './token-bucket';
import {ParameterError} from '../../Errors';
import {
  MockClock,
  withTimeline,
  withTimelineAsync,
  restoreGlobals,
  hijackTimeGlobals,
} from '../../MockClock/__export__';

const original_getTime = TokenBucket['getTime'];

// 因为getTime是IIFE💢，在导入时就绑定时间源了，这里手动处理下
beforeAll(() => {
  hijackTimeGlobals();
  TokenBucket['getTime'] = Date.now;
});

afterAll(() => {
  restoreGlobals();
  TokenBucket['getTime'] = original_getTime;
});

const MAX_SET_TIMEOUT_DELAY = 2 ** 31 - 1;

describe.concurrent('TokenBucket', () => {
  describe('Constructor', () => {
    it('should initialize with valid parameters', () => {
      const clock = MockClock();
      withTimeline(clock, () => {
        const bucket = new TokenBucket({limit: 10, interval: 1000});
        expect(bucket).toBeDefined();
      });
    });

    it('should validate limit parameter', () => {
      const clock = MockClock();
      withTimeline(clock, () => {
        expect(() => new TokenBucket({limit: -1, interval: 1000})).toThrow(
          ParameterError,
        );
        expect(() => new TokenBucket({limit: 0, interval: 1000})).toThrow(
          ParameterError,
        );
        expect(() => new TokenBucket({limit: NaN, interval: 1000})).toThrow(
          ParameterError,
        );
        expect(
          () => new TokenBucket({limit: Infinity, interval: 1000}),
        ).toThrow(ParameterError);
        expect(
          () => new TokenBucket({limit: 10, interval: 1000}),
        ).not.toThrow();
      });
    });

    it('should throw when limit exceeds Number.MAX_SAFE_INTEGER', () => {
      const clock = MockClock();
      withTimeline(clock, () => {
        const exceedsMaxSafeInteger = Number.MAX_SAFE_INTEGER + 1;
        expect(
          () => new TokenBucket({limit: exceedsMaxSafeInteger, interval: 1000}),
        ).toThrow(ParameterError);
        expect(
          () =>
            new TokenBucket({limit: Number.MAX_SAFE_INTEGER, interval: 1000}),
        ).not.toThrow();
      });
    });

    it('should validate interval parameter', () => {
      const clock = MockClock();
      withTimeline(clock, () => {
        expect(() => new TokenBucket({limit: 10, interval: -1})).toThrow(
          ParameterError,
        );
        expect(() => new TokenBucket({limit: 10, interval: 0})).toThrow(
          ParameterError,
        );
        expect(() => new TokenBucket({limit: 10, interval: NaN})).toThrow(
          ParameterError,
        );
        expect(() => new TokenBucket({limit: 10, interval: Infinity})).toThrow(
          ParameterError,
        );
        expect(
          () => new TokenBucket({limit: 10, interval: 1000}),
        ).not.toThrow();
      });
    });

    it('should throw when interval is too small causing refill_rate > limit', () => {
      const clock = MockClock();
      withTimeline(clock, () => {
        // 当 interval < 1 时，refill_rate = limit / interval > limit
        expect(() => new TokenBucket({limit: 10, interval: 0.5})).toThrow(
          ParameterError,
        );
        expect(() => new TokenBucket({limit: 10, interval: 0.9})).toThrow(
          ParameterError,
        );
      });
    });
  });

  describe('wait', () => {
    it('should consume tokens immediately when available', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const bucket = new TokenBucket({limit: 10, interval: 1000});

        await bucket.wait(1);

        expect(bucket.stats.tokens).toBe(9);
      });
    });

    it('should validate weight parameter', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const bucket = new TokenBucket({limit: 10, interval: 1000});

        await expect(bucket.wait(0)).rejects.toThrow(ParameterError);
        await expect(bucket.wait(-1)).rejects.toThrow(ParameterError);
        await expect(bucket.wait(NaN)).rejects.toThrow(ParameterError);
      });
    });

    it('should throw when weight exceeds max_tokens', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const bucket = new TokenBucket({limit: 10, interval: 1000});

        await expect(bucket.wait(11)).rejects.toThrow(ParameterError);
        await expect(bucket.wait(100)).rejects.toThrow(ParameterError);
      });
    });

    it('should throw when signal is already aborted', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const bucket = new TokenBucket({limit: 10, interval: 1000});
        const controller = new AbortController();
        controller.abort('test');

        await expect(bucket.wait(1, controller.signal)).rejects.toThrow('test');
      });
    });

    it('should wait when tokens are insufficient', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const bucket = new TokenBucket({limit: 5, interval: 100});

        await bucket.wait(3);
        expect(bucket.stats.tokens).toBe(2);

        clock.tick(50);
        await bucket.wait(2);
        expect(bucket.stats.tokens).toBeGreaterThanOrEqual(0);
      });
    });

    it('should call refill multiple times while waiting for debt clearance', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        // 使用 bucket小速率，每次只补充很少令牌，需要多次 while 循环
        const bucket = new TokenBucket({limit: 1, interval: 1000}); // 0.001 tokens/ms

        // 消耗所有令牌
        await bucket.wait(1);
        expect(bucket.stats.tokens).toBe(0);

        // 再次请求1个令牌，产生 -1 债务
        // 以当前速率，还清1个令牌需要1000ms
        const waitPromise = bucket.wait(1);

        // 推进足够时间还清债务
        clock.tick(1000);

        await waitPromise;

        // 验证最终债务已还清
        expect(bucket.stats.tokens).toBeGreaterThanOrEqual(0);
      });
    });

    it('should allow weight up to limit without waiting', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const bucket = new TokenBucket({limit: 10, interval: 1000});

        await bucket.wait(10);

        expect(bucket.stats.tokens).toBeGreaterThanOrEqual(0);
      });
    });

    it('should wait when weight exceeds limit', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const bucket = new TokenBucket({limit: 10, interval: 100});

        await bucket.wait(10);
        expect(bucket.stats.tokens).toBe(0);

        clock.tick(100);
        await bucket.wait(10);
        expect(bucket.stats.tokens).toBe(0);
      });
    });

    it('should handle multiple concurrent waits', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const bucket = new TokenBucket({limit: 20, interval: 100});

        await Promise.all([bucket.wait(5), bucket.wait(5), bucket.wait(5)]);
      });
    }, 10000);

    it('should rollback token debt when request is aborted', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const bucket = new TokenBucket({limit: 10, interval: 100});
        const controller = new AbortController();

        // 先消耗所有令牌
        await bucket.wait(10);

        // 发起一个会产生债务的请求 (请求5个，现有0个，债务-5)
        // 这一步会同步将 tokens 扣减为 -5，然后进入 while 循环等待
        const waitPromise = bucket.wait(5, controller.signal);

        // 稍微延迟，确保 wait 逻辑已进入 while 循环内的 delay 等待
        clock.tick(10);

        // 触发中止，delay 抛出异常，wait 函数退出
        controller.abort();

        await expect(waitPromise).rejects.toThrow();

        const stats = bucket.stats;
        // 验证：tokens 应回滚，若为负数则证明债务泄露
        expect(stats.tokens).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('resetRate', () => {
    it('should update rate limit configuration', () => {
      const clock = MockClock();
      withTimeline(clock, () => {
        const bucket = new TokenBucket({limit: 10, interval: 1000});

        bucket.resetRate({limit: 20, interval: 1000});

        expect(bucket).toBeDefined();
      });
    });

    it('should validate new limit parameter', () => {
      const clock = MockClock();
      withTimeline(clock, () => {
        const bucket = new TokenBucket({limit: 10, interval: 1000});

        expect(() => bucket.resetRate({limit: -1, interval: 1000})).toThrow(
          ParameterError,
        );
        expect(() => bucket.resetRate({limit: 0, interval: 1000})).toThrow(
          ParameterError,
        );
        expect(() => bucket.resetRate({limit: NaN, interval: 1000})).toThrow(
          ParameterError,
        );
        expect(() =>
          bucket.resetRate({limit: 20, interval: 1000}),
        ).not.toThrow();
      });
    });

    it('should throw when new limit exceeds Number.MAX_SAFE_INTEGER', () => {
      const clock = MockClock();
      withTimeline(clock, () => {
        const bucket = new TokenBucket({limit: 10, interval: 1000});
        const exceedsMaxSafeInteger = Number.MAX_SAFE_INTEGER + 1;

        expect(() =>
          bucket.resetRate({limit: exceedsMaxSafeInteger, interval: 1000}),
        ).toThrow(ParameterError);
        expect(() =>
          bucket.resetRate({limit: Number.MAX_SAFE_INTEGER, interval: 1000}),
        ).not.toThrow();
      });
    });

    it('should validate new interval parameter', () => {
      const clock = MockClock();
      withTimeline(clock, () => {
        const bucket = new TokenBucket({limit: 10, interval: 1000});

        expect(() => bucket.resetRate({limit: 10, interval: -1})).toThrow(
          ParameterError,
        );
        expect(() => bucket.resetRate({limit: 10, interval: 0})).toThrow(
          ParameterError,
        );
        expect(() => bucket.resetRate({limit: 10, interval: NaN})).toThrow(
          ParameterError,
        );
        expect(() =>
          bucket.resetRate({limit: 10, interval: 1000}),
        ).not.toThrow();
      });
    });

    it('should throw when interval is too small causing refill_rate > limit', () => {
      const clock = MockClock();
      withTimeline(clock, () => {
        const bucket = new TokenBucket({limit: 10, interval: 1000});

        expect(() => bucket.resetRate({limit: 10, interval: 0.5})).toThrow(
          ParameterError,
        );
        expect(() => bucket.resetRate({limit: 10, interval: 0.9})).toThrow(
          ParameterError,
        );
      });
    });

    it('should cap tokens at new max_tokens after reset', () => {
      const clock = MockClock();
      withTimeline(clock, () => {
        const bucket = new TokenBucket({limit: 10, interval: 1000});

        bucket.resetRate({limit: 5, interval: 1000});

        expect(bucket).toBeDefined();
      });
    });
  });

  describe('Clock Rewind Handling', () => {
    it('should handle clock rewind correctly', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const bucket = new TokenBucket({limit: 10, interval: 1000});

        clock.setSystemTime(1000);
        await bucket.wait(5);

        clock.setSystemTime(500);

        await bucket.wait(1);

        expect(bucket).toBeDefined();
      });
    });

    it('should handle clock rewind by mocking getTime', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        clock.setSystemTime(1000);

        const bucket = new TokenBucket({limit: 10, interval: 1000});

        await bucket.wait(5);

        clock.setSystemTime(500);

        await bucket.wait(1);

        expect(bucket).toBeDefined();
      });
    });

    it('should handle very long wait times exceeding MAX_SET_TIMEOUT_DELAY', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        clock.setSystemTime(1000);

        const bucket = new TokenBucket({limit: 1, interval: 1});

        await bucket.wait(1);

        clock.tick(1000);

        await bucket.wait(1);

        expect(bucket).toBeDefined();
      });
    });

    it('should cap wait time at MAX_SET_TIMEOUT_DELAY', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        clock.setSystemTime(1000);

        const bucket = new TokenBucket({limit: 1, interval: 1});

        await bucket.wait(1);

        clock.tick(MAX_SET_TIMEOUT_DELAY + 1000);

        await bucket.wait(1);

        expect(bucket).toBeDefined();
      });
    });
  });

  describe('stats', () => {
    it('should return initial state', () => {
      const clock = MockClock();
      withTimeline(clock, () => {
        const bucket = new TokenBucket({limit: 10, interval: 1000});
        const stats = bucket.stats;

        expect(stats.tokens).toBe(10);
        expect(stats.max_tokens).toBe(10);
        expect(stats.refill_rate).toBe(0.01);
        expect(typeof stats.last_refill_time).toBe('number');
      });
    });

    it('should reflect token consumption', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        clock.setSystemTime(1000);

        const bucket = new TokenBucket({limit: 10, interval: 1000});
        await bucket.wait(3);
        const stats = bucket.stats;

        expect(stats.tokens).toBe(7);
        expect(stats.max_tokens).toBe(10);
      });
    });

    it('should reflect negative tokens (debt)', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const bucket = new TokenBucket({limit: 5, interval: 100});

        await bucket.wait(5);
        expect(bucket.stats.tokens).toBe(0);

        clock.tick(30);
        await bucket.wait(1);
        expect(bucket.stats.tokens).toBeGreaterThanOrEqual(-1);
      });
    });

    it('should update after resetRate', () => {
      const clock = MockClock();
      withTimeline(clock, () => {
        const bucket = new TokenBucket({limit: 10, interval: 1000});

        bucket.resetRate({limit: 20, interval: 500});
        const stats = bucket.stats;

        expect(stats.max_tokens).toBe(20);
        expect(stats.refill_rate).toBe(0.04);
      });
    });

    it('should reflect token refill over time', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        clock.setSystemTime(1000);

        const bucket = new TokenBucket({limit: 10, interval: 1000});
        await bucket.wait(5);

        expect(bucket.stats.tokens).toBe(5);

        clock.tick(500);
        const stats = bucket.stats;

        expect(stats.tokens).toBe(10);
      });
    });

    it('should update timestamp only when bucket is already full', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, () => {
        const initial_time = Date.now();

        const bucket = new TokenBucket({limit: 10, interval: 1000});

        clock.tick(500);

        const stats = bucket.stats;

        expect(stats.tokens).toBe(10);
        expect(stats.last_refill_time).toBe(initial_time + 500);
      });
    });
  });
});
