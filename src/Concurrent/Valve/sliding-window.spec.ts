// ========================================
// ./src/Concurrent/Valve/sliding-window.spec.ts
// ========================================

import {describe, it, expect, afterAll} from 'vitest';
import {SlidingWindow} from './sliding-window';
import {ParameterError} from '../../Errors';
import {
  MockClock,
  withTimeline,
  withTimelineAsync,
  restoreGlobals,
} from '../../MockClock/__export__';

afterAll(restoreGlobals);

describe.concurrent('SlidingWindow', () => {
  describe('Constructor', () => {
    it('should initialize with valid parameters', () => {
      const clock = MockClock();
      withTimeline(clock, () => {
        const limiter = new SlidingWindow({limit: 10, window_size: 1000});
        expect(limiter).toBeDefined();
        expect(limiter.available).toBe(10);
        expect(limiter.current).toBe(0);
      });
    });

    it('should validate limit parameter', () => {
      const clock = MockClock();
      withTimeline(clock, () => {
        expect(() => new SlidingWindow({limit: -1, window_size: 1000})).toThrow(
          ParameterError,
        );
        expect(() => new SlidingWindow({limit: 0, window_size: 1000})).toThrow(
          ParameterError,
        );
        expect(
          () => new SlidingWindow({limit: NaN, window_size: 1000}),
        ).toThrow(ParameterError);
        expect(
          () => new SlidingWindow({limit: Infinity, window_size: 1000}),
        ).toThrow(ParameterError);
        expect(
          () => new SlidingWindow({limit: 1.5, window_size: 1000}),
        ).toThrow(ParameterError);
        expect(
          () => new SlidingWindow({limit: 10, window_size: 1000}),
        ).not.toThrow();
      });
    });

    it('should validate window_size parameter', () => {
      const clock = MockClock();
      withTimeline(clock, () => {
        expect(() => new SlidingWindow({limit: 10, window_size: -1})).toThrow(
          ParameterError,
        );
        expect(() => new SlidingWindow({limit: 10, window_size: 0})).toThrow(
          ParameterError,
        );
        expect(() => new SlidingWindow({limit: 10, window_size: NaN})).toThrow(
          ParameterError,
        );
        expect(
          () => new SlidingWindow({limit: 10, window_size: Infinity}),
        ).toThrow(ParameterError);
        expect(
          () => new SlidingWindow({limit: 10, window_size: 1000}),
        ).not.toThrow();
      });
    });
  });

  describe('tryAcquire', () => {
    it('should acquire slot immediately when available', () => {
      const clock = MockClock();
      withTimeline(clock, () => {
        const limiter = new SlidingWindow({limit: 5, window_size: 1000});

        expect(limiter.tryAcquire()).toBe(true);
        expect(limiter.available).toBe(4);
        expect(limiter.current).toBe(1);
      });
    });

    it('should validate weight parameter', () => {
      const clock = MockClock();
      withTimeline(clock, () => {
        const limiter = new SlidingWindow({limit: 10, window_size: 1000});

        expect(() => limiter.tryAcquire(0)).toThrow(ParameterError);
        expect(() => limiter.tryAcquire(-1)).toThrow(ParameterError);
        expect(() => limiter.tryAcquire(NaN)).toThrow(ParameterError);
        expect(() => limiter.tryAcquire(1.5)).toThrow(ParameterError);
        expect(() => limiter.tryAcquire(5)).not.toThrow();
      });
    });

    it('should reject when limit is reached', () => {
      const clock = MockClock();
      withTimeline(clock, () => {
        const limiter = new SlidingWindow({limit: 3, window_size: 1000});

        expect(limiter.tryAcquire()).toBe(true);
        expect(limiter.tryAcquire()).toBe(true);
        expect(limiter.tryAcquire()).toBe(true);
        expect(limiter.tryAcquire()).toBe(false);
        expect(limiter.available).toBe(0);
        expect(limiter.current).toBe(3);
      });
    });

    it('should support weight parameter', () => {
      const clock = MockClock();
      withTimeline(clock, () => {
        const limiter = new SlidingWindow({limit: 5, window_size: 1000});

        expect(limiter.tryAcquire(3)).toBe(true);
        expect(limiter.available).toBe(2);
        expect(limiter.tryAcquire(3)).toBe(false);
      });
    });

    it('should allow requests after window slides', () => {
      const clock = MockClock();
      withTimeline(clock, () => {
        const limiter = new SlidingWindow({limit: 2, window_size: 100});

        expect(limiter.tryAcquire()).toBe(true);
        expect(limiter.tryAcquire()).toBe(true);
        expect(limiter.tryAcquire()).toBe(false);

        // 模拟时间流逝，超出窗口大小
        clock.tick(150);

        // 旧请求已过期，应该允许新请求
        expect(limiter.tryAcquire()).toBe(true);
      });
    });
  });

  describe('wait', () => {
    it('should acquire immediately when slots available', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const limiter = new SlidingWindow({limit: 5, window_size: 1000});

        await limiter.wait(1);

        expect(limiter.current).toBe(1);
      });
    });

    it('should validate weight parameter', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const limiter = new SlidingWindow({limit: 10, window_size: 1000});

        await expect(limiter.wait(0)).rejects.toThrow(ParameterError);
        await expect(limiter.wait(-1)).rejects.toThrow(ParameterError);
        await expect(limiter.wait(NaN)).rejects.toThrow(ParameterError);
        await expect(limiter.wait(1.5)).rejects.toThrow(ParameterError);
        await expect(limiter.wait(11)).rejects.toThrow(ParameterError);
      });
    });

    it('should throw when signal is already aborted', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const limiter = new SlidingWindow({limit: 10, window_size: 1000});
        const controller = new AbortController();
        controller.abort('test');

        await expect(limiter.wait(1, controller.signal)).rejects.toThrow(
          'test',
        );
      });
    });

    it('should acquire immediately after old requests expire', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const limiter = new SlidingWindow({limit: 2, window_size: 200});

        await limiter.wait(1);
        await limiter.wait(1);
        expect(limiter.current).toBe(2);

        // 模拟时间流逝，让之前的请求过期
        // 窗口大小为 200，我们让时间前进 250ms
        clock.tick(250);

        // 旧请求已过期，此时应该能立即获取
        await limiter.wait(1);

        // 旧请求已过期，新请求被记录
        expect(limiter.current).toBe(1);
      });
    });

    it('should reject when signal is aborted during wait', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const limiter = new SlidingWindow({limit: 1, window_size: 1000});
        const controller = new AbortController();

        await limiter.wait(1);

        // 发起一个会被挂起的请求
        const waitPromise = limiter.wait(1, controller.signal);

        // 触发中止
        controller.abort('cancelled');

        // 应该抛出中止错误
        await expect(waitPromise).rejects.toThrow('cancelled');
      });
    });

    it('should complete wait without abort when signal is provided', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const limiter = new SlidingWindow({limit: 1, window_size: 100});
        const controller = new AbortController();

        await limiter.wait(1);

        // 发起一个会等待的请求，传入 signal 但不触发 abort
        const waitPromise = limiter.wait(1, controller.signal);

        // 让时间前进，使第一个请求过期
        clock.tick(150);

        // 应该成功完成，不会抛出 abort 错误
        await waitPromise;
        expect(limiter.current).toBe(1);
      });
    });
  });

  describe('resetRate', () => {
    it('should update limit and window size', () => {
      const clock = MockClock();
      withTimeline(clock, () => {
        const limiter = new SlidingWindow({limit: 5, window_size: 1000});

        limiter.resetRate({limit: 10, window_size: 2000});

        expect(limiter.available).toBe(10);
      });
    });

    it('should validate parameters', () => {
      const clock = MockClock();
      withTimeline(clock, () => {
        const limiter = new SlidingWindow({limit: 5, window_size: 1000});

        expect(() => limiter.resetRate({limit: -1, window_size: 1000})).toThrow(
          ParameterError,
        );
        expect(() => limiter.resetRate({limit: 0, window_size: 1000})).toThrow(
          ParameterError,
        );
        expect(() =>
          limiter.resetRate({limit: 1.5, window_size: 1000}),
        ).toThrow(ParameterError);
        expect(() => limiter.resetRate({limit: 10, window_size: -1})).toThrow(
          ParameterError,
        );
        expect(() => limiter.resetRate({limit: 10, window_size: 0})).toThrow(
          ParameterError,
        );
        expect(() =>
          limiter.resetRate({limit: 10, window_size: 2000}),
        ).not.toThrow();
      });
    });

    it('should preserve valid timestamps when resizing', () => {
      const clock = MockClock();
      withTimeline(clock, () => {
        const limiter = new SlidingWindow({limit: 5, window_size: 1000});

        limiter.tryAcquire(3);
        expect(limiter.current).toBe(3);

        limiter.resetRate({limit: 10, window_size: 1000});
        expect(limiter.current).toBe(3);
        expect(limiter.available).toBe(7);
      });
    });

    it('should skip reallocation when limit unchanged', () => {
      const clock = MockClock();
      withTimeline(clock, () => {
        const limiter = new SlidingWindow({limit: 5, window_size: 1000});

        limiter.tryAcquire(3);
        expect(limiter.current).toBe(3);

        // limit 不变，不会触发重新分配
        limiter.resetRate({limit: 5, window_size: 2000});
        expect(limiter.current).toBe(3);
        expect(limiter.available).toBe(2);
      });
    });

    it('should filter out expired timestamps when resizing', () => {
      const clock = MockClock();
      withTimeline(clock, () => {
        const limiter = new SlidingWindow({limit: 5, window_size: 100});

        // 记录3个请求
        limiter.tryAcquire(3);
        expect(limiter.current).toBe(3);

        // 时间前进，让之前的时间戳过期
        clock.tick(200);

        // 缩小 limit，触发重新分配，过期时间戳会被过滤掉
        limiter.resetRate({limit: 3, window_size: 100});
        expect(limiter.current).toBe(0);
        expect(limiter.available).toBe(3);
      });
    });

    it('should truncate timestamps when new limit is smaller than current count', () => {
      const clock = MockClock();
      withTimeline(clock, () => {
        const limiter = new SlidingWindow({limit: 10, window_size: 1000});

        // 记录5个请求
        limiter.tryAcquire(5);
        expect(limiter.current).toBe(5);

        // 缩小 limit 到 2，应该只保留最新的 2 个时间戳
        limiter.resetRate({limit: 2, window_size: 1000});
        expect(limiter.current).toBe(2);
        expect(limiter.available).toBe(0);
      });
    });
  });

  describe('available and current getters', () => {
    it('should reflect accurate state', () => {
      const clock = MockClock();
      withTimeline(clock, () => {
        const limiter = new SlidingWindow({limit: 5, window_size: 1000});

        expect(limiter.available).toBe(5);
        expect(limiter.current).toBe(0);

        limiter.tryAcquire(2);

        expect(limiter.available).toBe(3);
        expect(limiter.current).toBe(2);
      });
    });

    it('should auto-clean expired entries', () => {
      const clock = MockClock();
      withTimeline(clock, () => {
        const limiter = new SlidingWindow({limit: 5, window_size: 100});

        limiter.tryAcquire(3);
        expect(limiter.current).toBe(3);

        // 模拟时间流逝
        clock.tick(150);

        // 再次访问 getter 时应该触发清理逻辑
        expect(limiter.current).toBe(0);
        expect(limiter.available).toBe(5);
      });
    });
  });

  describe('stats', () => {
    it('should return initial state', () => {
      const clock = MockClock();
      withTimeline(clock, () => {
        const limiter = new SlidingWindow({limit: 10, window_size: 1000});
        const stats = limiter.stats;

        expect(stats.limit).toBe(10);
        expect(stats.window_size).toBe(1000);
        expect(stats.count).toBe(0);
        expect(stats.available).toBe(10);
        expect(stats.head).toBe(0);
      });
    });

    it('should reflect acquired requests', () => {
      const clock = MockClock();
      withTimeline(clock, () => {
        const limiter = new SlidingWindow({limit: 5, window_size: 1000});

        limiter.tryAcquire(2);
        const stats = limiter.stats;

        expect(stats.count).toBe(2);
        expect(stats.available).toBe(3);
        expect(stats.head).toBe(2);
      });
    });

    it('should update after resetRate', () => {
      const clock = MockClock();
      withTimeline(clock, () => {
        const limiter = new SlidingWindow({limit: 5, window_size: 1000});

        limiter.tryAcquire(3);
        limiter.resetRate({limit: 10, window_size: 2000});
        const stats = limiter.stats;

        expect(stats.limit).toBe(10);
        expect(stats.window_size).toBe(2000);
        expect(stats.count).toBe(3);
        expect(stats.available).toBe(7);
      });
    });

    it('should clean expired entries when getting stats', () => {
      const clock = MockClock();
      withTimeline(clock, () => {
        const limiter = new SlidingWindow({limit: 5, window_size: 100});

        limiter.tryAcquire(3);
        expect(limiter.stats.count).toBe(3);

        // 模拟时间流逝
        clock.tick(150);

        const stats = limiter.stats;
        expect(stats.count).toBe(0);
        expect(stats.available).toBe(5);
      });
    });

    it('should reflect head position correctly', () => {
      const clock = MockClock();
      withTimeline(clock, () => {
        const limiter = new SlidingWindow({limit: 5, window_size: 1000});

        limiter.tryAcquire(3);
        expect(limiter.stats.head).toBe(3);

        limiter.tryAcquire(1);
        expect(limiter.stats.head).toBe(4);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid acquire/release cycles', () => {
      const clock = MockClock();
      withTimeline(clock, () => {
        const limiter = new SlidingWindow({limit: 100, window_size: 1000});

        for (let i = 0; i < 100; i++) {
          expect(limiter.tryAcquire()).toBe(true);
        }
        expect(limiter.tryAcquire()).toBe(false);
      });
    });

    it('should handle weight equal to limit', () => {
      const clock = MockClock();
      withTimeline(clock, () => {
        const limiter = new SlidingWindow({limit: 5, window_size: 1000});

        expect(limiter.tryAcquire(5)).toBe(true);
        expect(limiter.available).toBe(0);
        expect(limiter.tryAcquire(1)).toBe(false);
      });
    });

    it('should handle weight exceeding limit', () => {
      const clock = MockClock();
      withTimeline(clock, () => {
        const limiter = new SlidingWindow({limit: 5, window_size: 1000});

        expect(() => limiter.tryAcquire(6)).toThrow(ParameterError);
        expect(limiter.available).toBe(5);
        expect(limiter.current).toBe(0);
      });
    });

    it('should handle clock adjustments gracefully', () => {
      const clock = MockClock();
      withTimeline(clock, () => {
        const limiter = new SlidingWindow({limit: 2, window_size: 100});

        expect(limiter.tryAcquire()).toBe(true);
        expect(limiter.tryAcquire()).toBe(true);
        expect(limiter.tryAcquire()).toBe(false);

        // 模拟时间调整（前进）
        clock.tick(150);

        expect(limiter.tryAcquire()).toBe(true);
      });
    });
  });
});
