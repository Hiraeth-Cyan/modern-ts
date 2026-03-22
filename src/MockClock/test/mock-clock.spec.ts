// ========================================
// ./src/MockClock/test/mock-clock.spec.ts
// ========================================
/**
 * @vitest-environment-options { "isolate": true }
 */

import {describe, it, expect, afterEach} from 'vitest';
import {
  MockClock,
  runTimeline,
  runTimelineAsync,
  restoreGlobals,
  withTimeline,
  withTimelineAsync,
  hijackTimeGlobals,
} from '../__export__';
import type {ClockOpts} from '../types';
import {Timeline} from '../Timeline';

describe('MockClock', () => {
  afterEach(() => {
    restoreGlobals();
  });

  // ============================================
  // MockClock 工厂函数
  // ============================================
  describe('MockClock factory', () => {
    it.concurrent('should accept options parameter', () => {
      const options: ClockOpts = {
        loop_limit: 500,
        frozen: true,
        Date: true,
        setTimeout: true,
      };
      const clock = MockClock(options) as Timeline;
      expect(clock).toBeInstanceOf(Timeline);
      expect(clock['max_loop']).toBe(500);
      clock.destroy();
    });

    it.concurrent('should create independent clocks', () => {
      const clock1 = MockClock();
      const clock2 = MockClock();
      expect(clock1.id).not.toBe(clock2.id);
      clock1.destroy();
      clock2.destroy();
    });
  });

  // ============================================
  // runTimeline
  // ============================================
  describe('runTimeline', () => {
    it.concurrent('should execute callback within timeline context', () => {
      const clock = MockClock();
      let executed = false;
      runTimeline(clock, () => {
        executed = true;
      });
      expect(executed).toBe(true);
      clock.destroy();
    });

    it.concurrent(
      'should allow Date.now() to return mocked time and support tick',
      () => {
        const clock = MockClock();
        const start_time = clock.systemTime();
        let captured_time: number | null = null;
        let timer_called = false;
        runTimeline(clock, () => {
          captured_time = Date.now();
          setTimeout(() => {
            timer_called = true;
          }, 1000);
          clock.tick(1000);
        });
        expect(captured_time).toBe(start_time);
        expect(timer_called).toBe(true);
        clock.destroy();
      },
    );

    it.concurrent('should handle async callback', () => {
      const clock = MockClock();
      let value = 0;
      runTimeline(clock, () => {
        value = 42;
        return Promise.resolve();
      });
      expect(value).toBe(42);
      clock.destroy();
    });
  });

  // ============================================
  // runTimelineAsync
  // ============================================
  describe('runTimelineAsync', () => {
    it.concurrent(
      'should execute async callback with timer operations',
      async () => {
        const clock = MockClock();
        let result = 0;
        await runTimelineAsync(clock, () => {
          setTimeout(() => {
            result = 100;
          }, 100);
          clock.tick(100);
        });
        expect(result).toBe(100);
        clock.destroy();
      },
    );

    it.concurrent('should handle nested async operations', async () => {
      const clock = MockClock();
      const values: number[] = [];
      await runTimelineAsync(clock, async () => {
        values.push(1);
        await Promise.resolve();
        values.push(2);
      });
      expect(values).toEqual([1, 2]);
      clock.destroy();
    });
  });

  // ============================================
  // restoreGlobals
  // ============================================
  describe('restoreGlobals', () => {
    it('should restore original Date after mocking', () => {
      const clock = MockClock();
      clock.setSystemTime(1000000000000);
      runTimeline(clock, () => {
        const inside_time = Date.now();
        expect(inside_time).toBe(1000000000000);
      });
      restoreGlobals();
      const real_time = Date.now();
      expect(real_time).toBeGreaterThan(1000000000000);
    });

    it.concurrent('should be safe to call multiple times', () => {
      restoreGlobals();
      restoreGlobals();
      restoreGlobals();
    });
  });

  // ============================================
  // withTimeline
  // ============================================
  describe('withTimeline', () => {
    it.concurrent('should execute callback and auto-destroy timeline', () => {
      let executed = false;
      const clock = MockClock() as Timeline;
      withTimeline(clock, () => {
        executed = true;
      });
      expect(executed).toBe(true);
      // 验证 timeline 已被销毁（通过检查内部状态）
      expect(clock['is_disposed']).toBe(true);
    });

    it.concurrent('should destroy timeline even if callback throws', () => {
      const clock = MockClock() as Timeline;
      expect(() => {
        withTimeline(clock, () => {
          throw new Error('Test error');
        });
      }).toThrow('Test error');
      // 即使抛出异常，timeline 也应该被销毁
      expect(clock['is_disposed']).toBe(true);
    });

    it.concurrent('should support timer operations within callback', () => {
      const clock = MockClock();
      let timer_called = false;
      withTimeline(clock, () => {
        setTimeout(() => {
          timer_called = true;
        }, 1000);
        clock.tick(1000);
      });
      expect(timer_called).toBe(true);
    });
  });

  // ============================================
  // withTimelineAsync
  // ============================================
  describe('withTimelineAsync', () => {
    it.concurrent(
      'should execute async callback and auto-destroy timeline',
      async () => {
        let executed = false;
        const clock = MockClock() as Timeline;
        await withTimelineAsync(clock, async () => {
          await Promise.resolve();
          executed = true;
        });
        expect(executed).toBe(true);
        expect(clock['is_disposed']).toBe(true);
      },
    );

    it.concurrent(
      'should destroy timeline even if async callback throws',
      async () => {
        const clock = MockClock() as Timeline;
        await expect(
          withTimelineAsync(clock, async () => {
            await Promise.resolve();
            throw new Error('Async error');
          }),
        ).rejects.toThrow('Async error');
        // 即使抛出异常，timeline 也应该被销毁
        expect(clock['is_disposed']).toBe(true);
      },
    );

    it.concurrent('should support async timer operations', async () => {
      const clock = MockClock();
      let result = 0;
      await withTimelineAsync(clock, async () => {
        setTimeout(() => {
          result = 42;
        }, 100);
        clock.tick(100);
        await Promise.resolve();
      });
      expect(result).toBe(42);
    });
  });

  // ============================================
  // HijackingTimeGlobals
  // ============================================
  describe('HijackingTimeGlobals', () => {
    it.concurrent('should return true when first called', () => {
      restoreGlobals();
      const result = hijackTimeGlobals();
      expect(result).toBe(true);
    });

    it.concurrent(
      'should return false when called again without restore',
      () => {
        restoreGlobals();
        hijackTimeGlobals();
        const result = hijackTimeGlobals();
        expect(result).toBe(false);
      },
    );

    it('should enable global time mocking when called', () => {
      restoreGlobals();
      const original_now = Date.now();
      hijackTimeGlobals();
      // 创建 timeline 并设置系统时间
      const clock = MockClock();
      clock.setSystemTime(1234567890000);
      runTimeline(clock, () => {
        // 全局 Date.now() 应该返回虚拟时间
        expect(Date.now()).toBe(1234567890000);
      });
      restoreGlobals();
      // 恢复后应该返回真实时间
      expect(Date.now()).toBeGreaterThanOrEqual(original_now);
    });
  });
});
