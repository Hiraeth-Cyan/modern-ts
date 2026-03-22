// ========================================
// ./src/Concurrent/Valve/leaky-bucket.spec.ts
// ========================================

import {describe, it, expect, afterAll} from 'vitest';
import {LeakyBucket, LeakyBucketReject} from './leaky-bucket';
import {ParameterError, UseAfterFreeError} from '../../Errors';
import {
  MockClock,
  withTimeline,
  withTimelineAsync,
  restoreGlobals,
} from '../../MockClock/__export__';

afterAll(restoreGlobals);

describe.concurrent('LeakyBucket', () => {
  describe('Constructor', () => {
    it('should initialize with valid parameters', () => {
      const clock = MockClock();
      withTimeline(clock, () => {
        const bucket = new LeakyBucket({limit: 10, interval: 1000});
        expect(bucket).toBeDefined();
        expect(bucket.isDisposed).toBe(false);
      });
    });

    it('should validate limit parameter', () => {
      const clock = MockClock();
      withTimeline(clock, () => {
        expect(() => new LeakyBucket({limit: -1, interval: 1000})).toThrow(
          ParameterError,
        );
        expect(() => new LeakyBucket({limit: 0, interval: 1000})).toThrow(
          ParameterError,
        );
        expect(() => new LeakyBucket({limit: NaN, interval: 1000})).toThrow(
          ParameterError,
        );
        expect(
          () => new LeakyBucket({limit: Infinity, interval: 1000}),
        ).toThrow(ParameterError);
        expect(
          () => new LeakyBucket({limit: 10, interval: 1000}),
        ).not.toThrow();
      });
    });

    it('should throw when limit exceeds Number.MAX_SAFE_INTEGER', () => {
      const clock = MockClock();
      withTimeline(clock, () => {
        const exceedsMaxSafeInteger = Number.MAX_SAFE_INTEGER + 1;
        expect(
          () => new LeakyBucket({limit: exceedsMaxSafeInteger, interval: 1000}),
        ).toThrow(ParameterError);
        expect(
          () =>
            new LeakyBucket({limit: Number.MAX_SAFE_INTEGER, interval: 1000}),
        ).not.toThrow();
      });
    });

    it('should validate interval parameter', () => {
      const clock = MockClock();
      withTimeline(clock, () => {
        expect(() => new LeakyBucket({limit: 10, interval: -1})).toThrow(
          ParameterError,
        );
        expect(() => new LeakyBucket({limit: 10, interval: 0})).toThrow(
          ParameterError,
        );
        expect(() => new LeakyBucket({limit: 10, interval: NaN})).toThrow(
          ParameterError,
        );
        expect(() => new LeakyBucket({limit: 10, interval: Infinity})).toThrow(
          ParameterError,
        );
        expect(
          () => new LeakyBucket({limit: 10, interval: 1000}),
        ).not.toThrow();
      });
    });
  });

  describe('wait', () => {
    it('should enqueue request when queue is not full', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const bucket = new LeakyBucket({limit: 5, interval: 100});

        const waitPromise = bucket.wait();

        expect(bucket.getStats().queue_size).toBe(1);

        clock.tick(100);
        await waitPromise;
      });
    });

    it('should reject when queue is full', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const bucket = new LeakyBucket({limit: 2, interval: 100});

        const p1 = bucket.wait();
        const p2 = bucket.wait();

        await expect(bucket.wait()).rejects.toThrow(LeakyBucketReject);

        clock.tick(100);
        await p1;
        clock.tick(100);
        await p2;
      });
    });

    it('should include queue size in rejection message', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const bucket = new LeakyBucket({limit: 1, interval: 100});

        const p1 = bucket.wait();

        await expect(bucket.wait()).rejects.toThrow('queue is full (1)');

        clock.tick(100);
        await p1;
      });
    });

    it('should throw when signal is already aborted', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const bucket = new LeakyBucket({limit: 10, interval: 1000});
        const controller = new AbortController();
        controller.abort('test');

        await expect(bucket.wait(controller.signal)).rejects.toThrow('test');
      });
    });

    it('should support abort signal during wait', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const bucket = new LeakyBucket({limit: 2, interval: 1000});
        const controller = new AbortController();

        const p1 = bucket.wait();

        const waitPromise = bucket.wait(controller.signal);
        expect(bucket.getStats().queue_size).toBe(2);

        controller.abort('cancelled');

        await expect(waitPromise).rejects.toThrow('cancelled');
        expect(bucket.getStats().queue_size).toBe(1);

        bucket.dispose();
        await expect(p1).rejects.toThrow('LeakyBucket disposed');
      });
    });

    it('should remove task from queue when aborted', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const bucket = new LeakyBucket({limit: 2, interval: 1000});
        const controller = new AbortController();

        const p1 = bucket.wait();

        const statsBefore = bucket.getStats();
        expect(statsBefore.queue_size).toBe(1);

        const waitPromise = bucket.wait(controller.signal);
        const statsAfterEnqueue = bucket.getStats();
        expect(statsAfterEnqueue.queue_size).toBe(2);

        controller.abort('cancelled');

        await expect(waitPromise).rejects.toThrow('cancelled');

        const statsAfterAbort = bucket.getStats();
        expect(statsAfterAbort.queue_size).toBe(1);

        bucket.dispose();
        await expect(p1).rejects.toThrow('LeakyBucket disposed');
      });
    });
  });

  describe('tryWait', () => {
    it('should return Promise when queue is not full', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const bucket = new LeakyBucket({limit: 5, interval: 100});

        const result = bucket.tryWait();

        expect(result).not.toBe(false);
        expect(bucket.getStats().queue_size).toBe(1);

        clock.tick(100);
        await result;
      });
    });

    it('should return false when queue is full', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const bucket = new LeakyBucket({limit: 1, interval: 100});

        const p1 = bucket.wait();

        const result = bucket.tryWait();

        expect(result).toBe(false);

        clock.tick(100);
        await p1;
      });
    });

    it('should reject with UseAfterFreeError when disposed', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const bucket = new LeakyBucket({limit: 5, interval: 100});
        bucket.dispose();

        const result = bucket.tryWait();

        expect(result).not.toBe(false);
        await expect(result).rejects.toThrow(UseAfterFreeError);
      });
    });

    it('should reject when signal is already aborted', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const bucket = new LeakyBucket({limit: 10, interval: 1000});
        const controller = new AbortController();
        controller.abort('test');

        const result = bucket.tryWait(controller.signal);

        expect(result).not.toBe(false);
        await expect(result).rejects.toThrow('test');
      });
    });
  });

  describe('resetRate', () => {
    it('should update rate limit configuration', () => {
      const clock = MockClock();
      withTimeline(clock, () => {
        const bucket = new LeakyBucket({limit: 10, interval: 1000});

        bucket.resetRate({limit: 20, interval: 500});

        const stats = bucket.getStats();
        expect(stats.max_queue_size).toBe(20);
        expect(stats.interval).toBe(500);
      });
    });

    it('should validate new limit parameter', () => {
      const clock = MockClock();
      withTimeline(clock, () => {
        const bucket = new LeakyBucket({limit: 10, interval: 1000});

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
        const bucket = new LeakyBucket({limit: 10, interval: 1000});
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
        const bucket = new LeakyBucket({limit: 10, interval: 1000});

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

    it('should skip update when disposed', () => {
      const clock = MockClock();
      withTimeline(clock, () => {
        const bucket = new LeakyBucket({limit: 10, interval: 1000});
        bucket.dispose();

        bucket.resetRate({limit: 20, interval: 500});

        const stats = bucket.getStats();
        expect(stats.max_queue_size).toBe(10);
      });
    });
  });

  describe('getStats', () => {
    it('should return initial state', () => {
      const clock = MockClock();
      withTimeline(clock, () => {
        const bucket = new LeakyBucket({limit: 10, interval: 1000});
        const stats = bucket.getStats();

        expect(stats.queue_size).toBe(0);
        expect(stats.queue_capacity).toBe(0);
        expect(stats.max_queue_size).toBe(10);
        expect(stats.interval).toBe(1000);
        expect(stats.isDisposed).toBe(false);
      });
    });

    it('should reflect queued requests', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const bucket = new LeakyBucket({limit: 5, interval: 1000});

        const p1 = bucket.wait();
        const p2 = bucket.wait();

        const stats = bucket.getStats();
        expect(stats.queue_size).toBe(2);

        clock.tick(1000);
        await p1;
        clock.tick(1000);
        await p2;
      });
    });

    it('should reflect disposed state', () => {
      const clock = MockClock();
      withTimeline(clock, () => {
        const bucket = new LeakyBucket({limit: 10, interval: 1000});
        bucket.dispose();

        const stats = bucket.getStats();
        expect(stats.isDisposed).toBe(true);
      });
    });
  });

  describe('dispose', () => {
    it('should mark bucket as disposed', () => {
      const clock = MockClock();
      withTimeline(clock, () => {
        const bucket = new LeakyBucket({limit: 10, interval: 1000});

        bucket.dispose();

        expect(bucket.isDisposed).toBe(true);
      });
    });

    it('should reject all pending waiters', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const bucket = new LeakyBucket({limit: 2, interval: 1000});

        const p1 = bucket.wait();
        const waitPromise = bucket.wait();

        bucket.dispose();

        await expect(waitPromise).rejects.toThrow('LeakyBucket disposed');
        await expect(p1).rejects.toThrow('LeakyBucket disposed');
      });
    });

    it('should be idempotent', () => {
      const clock = MockClock();
      withTimeline(clock, () => {
        const bucket = new LeakyBucket({limit: 10, interval: 1000});

        bucket.dispose();
        bucket.dispose();

        expect(bucket.isDisposed).toBe(true);
      });
    });

    it('should reject wait after disposal', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const bucket = new LeakyBucket({limit: 10, interval: 1000});
        bucket.dispose();

        await expect(bucket.wait()).rejects.toThrow(UseAfterFreeError);
      });
    });

    it('should work with Symbol.dispose', () => {
      const clock = MockClock();
      withTimeline(clock, () => {
        const bucket = new LeakyBucket({limit: 10, interval: 1000});

        using bucketRef = bucket;

        expect(bucketRef.isDisposed).toBe(false);
      });
    });
  });

  describe('Queue Processing', () => {
    it('should process requests at specified interval', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const bucket = new LeakyBucket({limit: 5, interval: 10});

        const p1 = bucket.wait();
        const p2 = bucket.wait();

        expect(bucket.getStats().queue_size).toBe(2);

        await clock.tickAsync(0);
        await p1;
        expect(bucket.getStats().queue_size).toBe(1);

        await clock.tickAsync(10);
        await p2;
        expect(bucket.getStats().queue_size).toBe(0);
      });
    });

    it('should resolve waits in order', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const bucket = new LeakyBucket({limit: 5, interval: 10});

        const order: number[] = [];
        const p1 = bucket.wait().then(() => order.push(1));
        const p2 = bucket.wait().then(() => order.push(2));
        const p3 = bucket.wait().then(() => order.push(3));

        await clock.tickAsync(0);
        await p1;
        expect(order).toEqual([1]);

        await clock.tickAsync(10);
        await p2;
        expect(order).toEqual([1, 2]);

        await clock.tickAsync(10);
        await p3;
        expect(order).toEqual([1, 2, 3]);
      });
    });
  });

  describe('Queue Compaction', () => {
    it('should handle multiple aborted tasks correctly', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const bucket = new LeakyBucket({limit: 10, interval: 10});

        const controllers = new Array<AbortController>();
        const promises = new Array<Promise<void>>();
        for (let i = 0; i < 5; i++) {
          const controller = new AbortController();
          controllers.push(controller);
          promises.push(bucket.wait(controller.signal));
        }

        for (let i = 0; i < 3; i++) {
          controllers[i].abort('test');
        }

        clock.tick(50);
        const results = await Promise.allSettled(promises);
        let rejected = 0;
        let fulfilled = 0;
        for (const r of results) {
          if (r.status === 'rejected') rejected++;
          else fulfilled++;
        }
        expect(rejected).toBe(3);
        expect(fulfilled).toBe(2);
      });
    });

    it('should reset queue when all tasks are aborted during processing', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const bucket = new LeakyBucket({limit: 200, interval: 100});

        const controllers = new Array<AbortController>();
        const promises = new Array<Promise<void>>();

        for (let i = 0; i < 100; i++) {
          const controller = new AbortController();
          controllers.push(controller);
          promises.push(bucket.wait(controller.signal));
        }

        for (let i = 0; i < 100; i++) {
          controllers[i].abort('test');
        }

        const results = await Promise.allSettled(promises);
        let rejected = 0;
        for (const r of results) {
          if (r.status === 'rejected') rejected++;
        }
        expect(rejected).toBe(100);

        clock.tick(100);
        await Promise.resolve();

        expect(bucket.getStats().queue_size).toBe(0);
      });
    });

    it('should trigger compaction when waste ratio exceeds threshold', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const bucket = new LeakyBucket({limit: 200, interval: 1});

        const controllers = new Array<AbortController>();
        const promises = new Array<Promise<void>>();

        // 创建足够多的任务以触发压缩条件
        // 需要超过 64 个已处理任务，且浪费比率 > 0.65
        for (let i = 0; i < 100; i++) {
          const controller = new AbortController();
          controllers.push(controller);
          promises.push(bucket.wait(controller.signal));
        }

        // 中止前 70 个任务，产生 null 槽位
        for (let i = 0; i < 70; i++) {
          controllers[i].abort('test');
        }

        // 等待所有中止完成
        await Promise.allSettled(promises.slice(0, 70));

        // 处理剩余任务，触发压缩检查
        clock.tick(100);
        await Promise.allSettled(promises.slice(70));

        expect(bucket.getStats().queue_size).toBe(0);
      });
    });

    it('should compact queue and update task indices correctly', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const bucket = new LeakyBucket({limit: 200, interval: 1});

        const controllers = new Array<AbortController>();
        const promises = new Array<Promise<void>>();

        // 创建大量任务
        for (let i = 0; i < 150; i++) {
          const controller = new AbortController();
          controllers.push(controller);
          promises.push(bucket.wait(controller.signal));
        }

        // 中止中间部分任务，产生空洞
        for (let i = 20; i < 120; i++) {
          controllers[i].abort('test');
        }

        // 等待中止完成
        await Promise.allSettled(promises.slice(20, 120));

        // 处理前 20 个任务
        clock.tick(30);
        await Promise.allSettled(promises.slice(0, 20));

        // 处理剩余任务
        clock.tick(50);
        await Promise.allSettled(promises.slice(120));

        expect(bucket.getStats().queue_size).toBe(0);
      });
    });

    it('should skip null slots during queue compaction', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const bucket = new LeakyBucket({limit: 200, interval: 1});

        const controllers = new Array<AbortController>();
        const promises = new Array<Promise<void>>();

        // 创建 100 个任务
        for (let i = 0; i < 100; i++) {
          const controller = new AbortController();
          controllers.push(controller);
          promises.push(bucket.wait(controller.signal));
        }

        // 中止索引 70-80 的任务，在 queue_head 之后产生 null 槽位
        for (let i = 70; i < 80; i++) {
          controllers[i].abort('test');
        }
        await Promise.allSettled(promises.slice(70, 80));

        // 处理前 65 个任务，此时 queue_head = 65
        clock.tick(70);
        await Promise.allSettled(promises.slice(0, 65));

        // 处理第 66 个任务时，queue_head 变为 66
        // waste_ratio = 66/100 = 0.66 > 0.65，触发压缩
        // 压缩时遍历从 queue_head=66 开始，会遇到索引 70-79 的 null
        clock.tick(10);
        await Promise.allSettled(promises.slice(65, 66));

        // 继续处理剩余任务
        clock.tick(50);
        await Promise.allSettled(promises.slice(66, 70));
        await Promise.allSettled(promises.slice(80));

        expect(bucket.getStats().queue_size).toBe(0);

        // 验证压缩后队列仍能正常工作
        const p1 = bucket.wait();
        const p2 = bucket.wait();
        clock.tick(20);
        await p1;
        clock.tick(10);
        await p2;
        expect(bucket.getStats().queue_size).toBe(0);
      });
    });

    it('should reset queue when active count becomes zero with large capacity', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const bucket = new LeakyBucket({limit: 200, interval: 100});

        const controllers = new Array<AbortController>();
        const promises = new Array<Promise<void>>();

        // 创建超过 1024 个任务以触发队列重置
        for (let i = 0; i < 1100; i++) {
          const controller = new AbortController();
          controllers.push(controller);
          promises.push(bucket.wait(controller.signal));
        }

        // 中止所有任务
        for (let i = 0; i < 1100; i++) {
          controllers[i].abort('test');
        }

        const results = await Promise.allSettled(promises);
        let rejected = 0;
        for (const r of results) {
          if (r.status === 'rejected') rejected++;
        }
        expect(rejected).toBe(1100);

        // 验证队列被重置
        const stats = bucket.getStats();
        expect(stats.queue_size).toBe(0);
        expect(stats.queue_capacity).toBeLessThanOrEqual(1024);
      });
    });

    it('should handle removeTaskFromQueue with invalid queue_index', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const bucket = new LeakyBucket({limit: 10, interval: 10});

        const p1 = bucket.wait();

        clock.tick(10);
        await p1;

        // 获取已完成的任务（queue_index 已被设为 -1）
        // @ts-expect-error - 访问私有属性
        const queue = bucket.waiting_queue;
        // @ts-expect-error - 访问私有方法
        const removeTaskFromQueue = bucket.removeTaskFromQueue.bind(bucket);

        // 创建一个模拟的已完成任务对象
        const completedTask = {
          queue_index: -1,
          resolve: () => {},
          reject: () => {},
        };

        // 调用 removeTaskFromQueue，此时 if 条件为 false
        // 因为 queue_index (-1) < queue_head (1)
        const beforeCount = bucket.getStats().queue_size;
        removeTaskFromQueue(completedTask);
        const afterCount = bucket.getStats().queue_size;

        // 验证 active_count 没有变化（false 分支不执行任何操作）
        expect(beforeCount).toBe(afterCount);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle limit of 1', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const bucket = new LeakyBucket({limit: 1, interval: 100});

        const p1 = bucket.wait();
        await expect(bucket.wait()).rejects.toThrow(LeakyBucketReject);

        clock.tick(100);
        await p1;
      });
    });

    it('should handle very small interval', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const bucket = new LeakyBucket({limit: 5, interval: 1});

        const p1 = bucket.wait();
        const p2 = bucket.wait();

        expect(bucket.getStats().queue_size).toBe(2);

        clock.tick(1);
        await p1;
        clock.tick(1);
        await p2;
      });
    });

    it('should handle large limit', () => {
      const clock = MockClock();
      withTimeline(clock, () => {
        const bucket = new LeakyBucket({
          limit: Number.MAX_SAFE_INTEGER,
          interval: 1000,
        });

        expect(bucket.getStats().max_queue_size).toBe(Number.MAX_SAFE_INTEGER);
      });
    });

    it('should handle clock adjustments gracefully', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const bucket = new LeakyBucket({limit: 2, interval: 100});

        const p1 = bucket.wait();
        const p2 = bucket.wait();

        expect(bucket.getStats().queue_size).toBe(2);

        await clock.tickAsync(0);
        await p1;
        await clock.tickAsync(100);
        await p2;

        expect(bucket.getStats().queue_size).toBe(0);
      });
    });

    it('should handle queue reset after all tasks processed', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const bucket = new LeakyBucket({limit: 5, interval: 5});

        const promises = new Array<Promise<void>>();
        for (let i = 0; i < 3; i++) {
          promises.push(bucket.wait());
        }

        clock.tick(20);
        await Promise.all(promises);

        expect(bucket.getStats().queue_size).toBe(0);
      });
    });

    it('should handle abort before process starts', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const bucket = new LeakyBucket({limit: 5, interval: 1000});
        const controller = new AbortController();

        const p1 = bucket.wait(controller.signal);
        controller.abort('cancelled');

        await expect(p1).rejects.toThrow('cancelled');
        expect(bucket.getStats().queue_size).toBe(0);
      });
    });

    it('should stop scheduling when all tasks aborted', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const bucket = new LeakyBucket({limit: 5, interval: 100});
        const controller = new AbortController();

        const p1 = bucket.wait(controller.signal);

        controller.abort('cancelled');
        await expect(p1).rejects.toThrow('cancelled');

        clock.tick(100);
        await Promise.resolve();

        expect(bucket.getStats().queue_size).toBe(0);
      });
    });

    it('should stop scheduling when all tasks aborted before timer fires', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const bucket = new LeakyBucket({limit: 5, interval: 100});

        const controller1 = new AbortController();
        const controller2 = new AbortController();

        const p1 = bucket.wait(controller1.signal);
        const p2 = bucket.wait(controller2.signal);

        expect(bucket.getStats().queue_size).toBe(2);

        controller1.abort('cancelled1');
        controller2.abort('cancelled2');

        await expect(p1).rejects.toThrow('cancelled1');
        await expect(p2).rejects.toThrow('cancelled2');

        clock.tick(100);
        await Promise.resolve();

        expect(bucket.getStats().queue_size).toBe(0);
      });
    });

    it('should handle dispose during processing', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const bucket = new LeakyBucket({limit: 5, interval: 100});

        const p1 = bucket.wait();
        const p2 = bucket.wait();

        bucket.dispose();

        await expect(p1).rejects.toThrow('LeakyBucket disposed');
        await expect(p2).rejects.toThrow('LeakyBucket disposed');
      });
    });

    it('should throw when interval exceeds MAX_SET_TIMEOUT_DELAY in constructor', () => {
      const clock = MockClock();
      withTimeline(clock, () => {
        const MAX_SET_TIMEOUT_DELAY = 2147483647;
        const exceedsMax = MAX_SET_TIMEOUT_DELAY + 1;

        expect(
          () => new LeakyBucket({limit: 10, interval: exceedsMax}),
        ).toThrow(ParameterError);
        expect(
          () => new LeakyBucket({limit: 10, interval: exceedsMax}),
        ).toThrow(`exceeds the maximum safe timer delay`);

        expect(
          () => new LeakyBucket({limit: 10, interval: MAX_SET_TIMEOUT_DELAY}),
        ).not.toThrow();
      });
    });

    it('should throw when interval exceeds MAX_SET_TIMEOUT_DELAY in resetRate', () => {
      const clock = MockClock();
      withTimeline(clock, () => {
        const bucket = new LeakyBucket({limit: 10, interval: 1000});
        const MAX_SET_TIMEOUT_DELAY = 2147483647;
        const exceedsMax = MAX_SET_TIMEOUT_DELAY + 1;

        expect(() =>
          bucket.resetRate({limit: 10, interval: exceedsMax}),
        ).toThrow(ParameterError);
        expect(() =>
          bucket.resetRate({limit: 10, interval: exceedsMax}),
        ).toThrow(`exceeds the maximum safe timer delay`);

        expect(() =>
          bucket.resetRate({limit: 10, interval: MAX_SET_TIMEOUT_DELAY}),
        ).not.toThrow();
      });
    });

    it('should reset queue array when active_count becomes zero with large capacity', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const bucket = new LeakyBucket({limit: 2000, interval: 100});

        const controllers = new Array<AbortController>();
        const promises = new Array<Promise<void>>();

        for (let i = 0; i < 1100; i++) {
          const controller = new AbortController();
          controllers.push(controller);
          promises.push(bucket.wait(controller.signal));
        }

        expect(bucket.getStats().queue_capacity).toBeGreaterThanOrEqual(1100);

        for (let i = 0; i < 1100; i++) {
          controllers[i].abort('test');
        }

        await Promise.allSettled(promises);

        const stats = bucket.getStats();
        expect(stats.queue_size).toBe(0);
        expect(stats.queue_capacity).toBe(0);
      });
    });
  });
});
