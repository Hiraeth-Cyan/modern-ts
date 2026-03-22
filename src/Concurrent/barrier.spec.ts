// ========================================
// ./src/Concurrent/barrier.spec.ts
// ========================================
import {describe, it, expect} from 'vitest';
import {Barrier, CyclicBarrier} from './barrier';
import {ParameterError} from '../Errors';

describe.concurrent('Barrier and CyclicBarrier', () => {
  // ============================
  // Barrier 测试
  // ============================
  describe('Barrier', () => {
    describe('Constructor Tests', () => {
      it('should throw ParameterError when initial_count is negative', () => {
        // 验证负数入参抛出指定异常及错误信息
        expect(() => new Barrier(-1)).toThrow(ParameterError);
        expect(() => new Barrier(-10)).toThrow(
          'Barrier: `initial_count` must be a non-negative number.',
        );
      });

      it('should resolve immediately when initial_count is 0', async () => {
        const barrier = new Barrier(0);
        await expect(barrier.promise).resolves.toBeUndefined();
        expect(barrier.is_disposed).toBe(true);
      });

      it('should create a pending Barrier when initial_count is positive', () => {
        const barrier = new Barrier(5);
        expect(barrier.is_disposed).toBe(false);
        expect(barrier.remaining).toBe(5);
      });
    });

    describe('Arrive & Countdown Tests', () => {
      it('should resolve after calling arrive() exactly initial_count times', async () => {
        const barrier = new Barrier(3);
        expect(barrier.remaining).toBe(3);

        barrier.arrive();
        expect(barrier.remaining).toBe(2);

        barrier.arrive();
        expect(barrier.remaining).toBe(1);

        barrier.arrive(); // 最后一次 arrive，触发解决
        expect(barrier.remaining).toBe(0);

        await expect(barrier.promise).resolves.toBeUndefined();
        expect(barrier.is_disposed).toBe(true);
      });

      it('should do nothing when arrive() is called after settled', async () => {
        const barrier = new Barrier(1);
        barrier.arrive();
        await barrier.promise; // 等待解决

        // 已解决后调用 arrive 不应抛出异常，且状态不变
        expect(() => barrier.arrive()).not.toThrow();
        expect(barrier.is_disposed).toBe(true);
      });
    });

    describe('Resize & Discard Tests', () => {
      it('should update remaining count using resize()', () => {
        const barrier = new Barrier(5);
        barrier.resize(10);
        expect(barrier.remaining).toBe(10);

        barrier.resize(1);
        expect(barrier.remaining).toBe(1);
      });

      it('should trigger barrier when resize to 0', async () => {
        const barrier = new Barrier(5);
        barrier.resize(0); // resize 到 0 立即解决
        await expect(barrier.promise).resolves.toBeUndefined();
      });

      it('should clamp remaining to 0 when resize with negative value', () => {
        const barrier = new Barrier(5);
        barrier.resize(-5); // 负数应截断为 0
        expect(barrier.remaining).toBe(0);
      });

      it('should decrease remaining by given amount using discard()', () => {
        const barrier = new Barrier(5);
        barrier.discard(2);
        expect(barrier.remaining).toBe(3);

        barrier.discard(); // 默认减 1
        expect(barrier.remaining).toBe(2);
      });

      it('should increase remaining when discard with negative amount', () => {
        const barrier = new Barrier(5);
        barrier.discard(-3); // 负数相当于增加计数：5 - (-3) = 8
        expect(barrier.remaining).toBe(8);
      });

      it('should ignore resize/discard after barrier is settled', async () => {
        const barrier = new Barrier(2);
        barrier.arrive();
        barrier.arrive();
        await barrier.promise; // 已解决

        barrier.resize(100);
        expect(barrier.remaining).toBe(0); // 仍为 0，不再变化
      });
    });

    describe('Abort Signal Tests', () => {
      it('should reject promise when abort signal is triggered', async () => {
        const controller = new AbortController();
        const barrier = new Barrier(10, controller.signal);

        setTimeout(() => controller.abort(), 10);
        await expect(barrier.promise).rejects.toThrow(DOMException);
        expect(barrier.is_disposed).toBe(true);
      });

      it('should reject immediately if signal is already aborted', async () => {
        const controller = new AbortController();
        controller.abort(); // 预先中止

        const barrier = new Barrier(10, controller.signal);
        await expect(barrier.promise).rejects.toThrow();
        expect(barrier.is_disposed).toBe(true);
      });
    });

    describe('Dispose Tests', () => {
      it('should dispose using Symbol.dispose', () => {
        const barrier = new Barrier(5);
        expect(barrier.is_disposed).toBe(false);

        barrier[Symbol.dispose]();
        expect(barrier.is_disposed).toBe(true);
      });
    });
  });

  // ============================
  // CyclicBarrier 测试
  // ============================
  describe('CyclicBarrier', () => {
    describe('Constructor Tests', () => {
      it('should throw ParameterError when count is less than 1', () => {
        expect(() => new CyclicBarrier(0)).toThrow(ParameterError);
        expect(() => new CyclicBarrier(-1)).toThrow(
          'CyclicBarrier: `count` must be at least 1',
        );
      });

      it('should initialize with correct parties and remaining', () => {
        const barrier = new CyclicBarrier(3);
        expect(barrier.parties).toBe(3);
        expect(barrier.remaining).toBe(3);
        expect(barrier.broken).toBe(false);
        expect(barrier.is_disposed).toBe(false);
      });
    });

    describe('Wait & Cyclic Behavior Tests', () => {
      it('should resolve all waiting parties when count is reached', async () => {
        const barrier = new CyclicBarrier(2);
        const p1 = barrier.wait();
        const p2 = barrier.wait();

        await expect(Promise.all([p1, p2])).resolves.toEqual([
          undefined,
          undefined,
        ]);
        expect(barrier.remaining).toBe(2); // 重置后剩余恢复为 parties
      });

      it('should reset automatically after triggering', async () => {
        const barrier = new CyclicBarrier(2);

        // 第一轮
        await Promise.all([barrier.wait(), barrier.wait()]);
        expect(barrier.remaining).toBe(2);

        // 第二轮
        const p3 = barrier.wait();
        const p4 = barrier.wait();
        await expect(Promise.all([p3, p4])).resolves.toEqual([
          undefined,
          undefined,
        ]);
      });
    });

    describe('Broken/Abort Behavior Tests', () => {
      it('should break and throw error on abort signal', async () => {
        const controller = new AbortController();
        const barrier = new CyclicBarrier(3, controller.signal);

        const waitPromise = barrier.wait();
        controller.abort();

        await expect(waitPromise).rejects.toThrow(DOMException);
        expect(barrier.broken).toBe(true);
        expect(barrier.is_disposed).toBe(true);
      });

      it('should break immediately if signal is already aborted', async () => {
        const controller = new AbortController();
        controller.abort();

        const barrier = new CyclicBarrier(5, controller.signal);
        await expect(barrier.wait()).rejects.toThrow(DOMException);
        expect(barrier.broken).toBe(true);
        expect(barrier.is_disposed).toBe(true);
      });

      it('should throw immediately when wait() is called on a broken barrier', async () => {
        const controller = new AbortController();
        const barrier = new CyclicBarrier(2, controller.signal);

        // 先让 barrier broken
        const waitPromise = barrier.wait().catch(() => {});
        controller.abort();
        await waitPromise;

        // 此时 barrier 已 broken，再次调用 wait 应直接抛出
        await expect(barrier.wait()).rejects.toThrow();
        expect(barrier.broken).toBe(true);
      });

      it('should not break if resolved before abort', async () => {
        const controller = new AbortController();
        const barrier = new CyclicBarrier(1, controller.signal); // 单参与者，立即解决

        await barrier.wait(); // 等待立即完成
        expect(barrier.broken).toBe(false); // 解决时未打破

        controller.abort(); // 此时中止信号触发，broken 变为 true
        expect(barrier.broken).toBe(true);
      });

      it('should still break on abort signal in the second generation', async () => {
        const controller = new AbortController();
        const barrier = new CyclicBarrier(2, controller.signal);

        // 第一代：正常通过
        const p1 = barrier.wait();
        const p2 = barrier.wait();
        await Promise.all([p1, p2]);
        expect(barrier.broken).toBe(false);

        // 第二代：在等待时中止
        const p3 = barrier.wait();
        controller.abort();

        await expect(p3).rejects.toThrow(DOMException);
        expect(barrier.broken).toBe(true);
      });
    });

    describe('Dispose Tests', () => {
      it('should dispose using Symbol.dispose and handle multiple calls safely', () => {
        const barrier = new CyclicBarrier(3);
        expect(barrier.broken).toBe(false);
        expect(barrier.is_disposed).toBe(false);

        barrier[Symbol.dispose](); // 第一次 dispose
        expect(barrier.broken).toBe(true);
        expect(barrier.is_disposed).toBe(true);

        // 再次调用不应抛出异常，且状态不变
        expect(() => barrier[Symbol.dispose]()).not.toThrow();
        expect(barrier.broken).toBe(true);
        expect(barrier.is_disposed).toBe(true);
      });
    });

    describe('Property Access Tests', () => {
      it('should reflect state changes in properties', async () => {
        const barrier = new CyclicBarrier(3);

        expect(barrier.remaining).toBe(3);
        const waitPromise = barrier.wait();
        expect(barrier.remaining).toBe(2);

        void barrier.wait();
        expect(barrier.remaining).toBe(1);

        void barrier.wait();
        await waitPromise;

        expect(barrier.remaining).toBe(3); // 重置后恢复
      });
    });
  });
});
