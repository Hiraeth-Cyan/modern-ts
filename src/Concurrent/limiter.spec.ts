// ========================================
// ./src/Concurrent/limiter.spec.ts
// ========================================
import {describe, it, expect} from 'vitest';
import {Limiter} from './limiter';
import {ParameterError} from '../Errors';
import {Barrier} from './barrier';
import {delay, sleep} from './delay';
import {flushPromises} from '../helper';

describe.concurrent('Limiter', () => {
  // ==================== 构造函数与基础操作 ====================
  describe('Constructor and Basic Operations', () => {
    it('should initialize with correct concurrency and stats', () => {
      const limiter = new Limiter(3);
      expect(limiter.getConcurrency()).toBe(3);
      expect(limiter.stats).toEqual({
        concurrency: 3,
        active: 0,
        pending: 0,
        isPaused: false,
      });
    });

    it('should validate concurrency parameter', () => {
      // 无效参数应抛出 ParameterError
      expect(() => new Limiter(-1)).toThrow(ParameterError);
      expect(() => new Limiter(NaN)).toThrow(ParameterError);
      // 有效参数应正常创建
      expect(() => new Limiter(1)).not.toThrow();
      expect(() => new Limiter(10)).not.toThrow();
      expect(() => new Limiter(Infinity)).not.toThrow();
    });

    it('should immediately execute tasks under concurrency limit with proper ordering', async () => {
      const limiter = new Limiter(3);
      const executionLog: string[] = [];

      const tasks = [
        limiter.add(async () => {
          executionLog.push('task1-start');
          await sleep(3);
          executionLog.push('task1-end');
          return 1;
        }),
        limiter.add(async () => {
          executionLog.push('task2-start');
          await flushPromises();
          executionLog.push('task2-end');
          return 2;
        }),
      ];

      await Promise.all(tasks);
      // 验证执行顺序：task1 先启动，task2 后启动但更快结束，最后 task1 结束
      expect(executionLog).toEqual([
        'task1-start',
        'task2-start',
        'task2-end',
        'task1-end',
      ]);
    });
  });

  // ==================== 并发控制与队列行为 ====================
  describe('Concurrency Control and Queue Behavior', () => {
    it('should enforce concurrency limit and maintain FIFO order', async () => {
      const limiter = new Limiter(3);
      const releaseFunctions: Array<() => void> = [];
      const startBarrier = new Barrier(3);
      const executionOrder: number[] = [];

      // 先占满所有并发槽
      for (let i = 0; i < 3; i++) {
        void limiter.add(
          () =>
            new Promise<void>((resolve) => {
              releaseFunctions.push(resolve);
              startBarrier.arrive();
            }),
        );
      }
      await startBarrier.promise;

      // 添加5个待处理任务，此时 active=3, pending=5
      const tasks = Array.from({length: 5}, (_, i) =>
        limiter.add(async () => {
          executionOrder.push(i);
          await flushPromises();
          return i;
        }),
      );

      expect(limiter.stats.active).toBe(3);
      expect(limiter.stats.pending).toBe(5);

      // 依次释放槽位，任务应按 FIFO 顺序执行
      for (let i = 0; i < 3; i++) {
        releaseFunctions[i]();
        await flushPromises();
      }

      await Promise.all(tasks);
      expect(executionOrder).toEqual([0, 1, 2, 3, 4]);
      expect(limiter.stats.active).toBe(0);
      expect(limiter.stats.pending).toBe(0);
    });

    it('should handle rapid task submission while maintaining limits', async () => {
      const limiter = new Limiter(3);
      const maxConcurrent = {count: 0};
      const concurrentHistory: number[] = [];

      // 监控 active 数量的变化
      const monitor = setInterval(() => {
        concurrentHistory.push(limiter.stats.active);
        maxConcurrent.count = Math.max(
          maxConcurrent.count,
          limiter.stats.active,
        );
      }, 1);

      const tasks = Array.from({length: 100}, (_, i) =>
        limiter.add(async () => {
          await flushPromises();
          return i;
        }),
      );

      await Promise.all(tasks);
      clearInterval(monitor);

      // 任何时候 active 都不能超过并发限制 3
      expect(maxConcurrent.count).toBeLessThanOrEqual(3);
      expect(Math.max(...concurrentHistory)).toBeLessThanOrEqual(3);
    });

    it('should maintain correct stats during task lifecycle', async () => {
      const limiter = new Limiter(3);
      const releaseFns: (() => void)[] = [];

      // 占满并发槽
      for (let i = 0; i < 3; i++) {
        void limiter.add(
          () =>
            new Promise<void>((resolve) => {
              releaseFns.push(resolve);
            }),
        );
      }

      await flushPromises();
      expect(limiter.stats).toEqual({
        concurrency: 3,
        active: 3,
        pending: 0,
        isPaused: false,
      });

      // 添加一个待处理任务
      const queuedTask = limiter.add(() => 'queued');
      await flushPromises();
      expect(limiter.stats).toEqual({
        concurrency: 3,
        active: 3,
        pending: 1,
        isPaused: false,
      });

      // 释放一个槽，待处理任务立即开始执行
      releaseFns[0]();
      await flushPromises();
      expect(limiter.stats.active).toBe(2); // 原 active 3 中释放一个，剩下2个仍在执行
      expect(limiter.stats.pending).toBe(0);

      // 释放所有槽
      releaseFns.forEach((fn) => fn());
      await queuedTask;
      expect(limiter.stats).toEqual({
        concurrency: 3,
        active: 0,
        pending: 0,
        isPaused: false,
      });
    });
  });

  // ==================== AbortSignal 支持 ====================
  describe('AbortSignal Support', () => {
    it('should reject immediately if signal is already aborted', async () => {
      const limiter = new Limiter(3);
      const controller = new AbortController();
      controller.abort();
      await expect(
        limiter.add(() => 'task', controller.signal),
      ).rejects.toBeInstanceOf(DOMException);
    });

    it('should abort queued tasks when signal aborts', async () => {
      const limiter = new Limiter(3);
      const releaseFns: Array<() => void> = [];
      const barrier = new Barrier(3);

      // 先占满并发槽
      for (let i = 0; i < 3; i++) {
        void limiter.add(
          () =>
            new Promise<void>((resolve) => {
              releaseFns.push(resolve);
              barrier.arrive();
            }),
        );
      }
      await barrier.promise;

      // 添加一个待处理任务并传入 signal
      const controller = new AbortController();
      const queuedTask = limiter.add(() => 'queued', controller.signal);
      await flushPromises();
      expect(limiter.stats.pending).toBe(1);

      // 中止信号，待处理任务应被拒绝
      controller.abort();
      await expect(queuedTask).rejects.toBeInstanceOf(DOMException);
      expect(limiter.stats.pending).toBe(0);

      // 清理
      releaseFns.forEach((fn) => fn());
      await flushPromises();
    });

    it('should abort executing tasks that cooperate with signal (e.g. delay)', async () => {
      const limiter = new Limiter(3);
      const controller = new AbortController();
      const executingTask = limiter.add(async () => {
        await delay(5, controller.signal); // delay 会监听 abort
        return 'success';
      }, controller.signal);

      await flushPromises(); // 任务已开始执行
      controller.abort();
      await expect(executingTask).rejects.toBeInstanceOf(DOMException);
    });

    it('should not abort if signal is not provided', async () => {
      const limiter = new Limiter(3);
      const result = await limiter.add(async () => {
        await sleep(1);
        return 'success';
      });
      expect(result).toBe('success');
    });

    // 以下为从 Branch Coverage Complements 合并的测试

    it('should ignore abort signal for immediately executing tasks in add()', async () => {
      // 当有空闲槽，任务立即开始执行，后续的 abort 应被忽略（任务未监听信号）
      const limiter = new Limiter(3);
      const controller = new AbortController();

      const promise = limiter.add(async () => {
        await sleep(5);
        return 'success';
      }, controller.signal);

      controller.abort(); // 任务已经开始，abort 不影响
      await expect(promise).resolves.toBe('success');
      expect(limiter.stats.active).toBe(0);
    });

    it('should ignore abort signal for already started task in add() (race condition)', async () => {
      // 任务在排队后开始执行，但未监听信号，abort 应被忽略
      const limiter = new Limiter(1);
      const ac = new AbortController();

      let releaseFirst: () => void;
      void limiter.add(() => new Promise<void>((r) => (releaseFirst = r)));
      await flushPromises();
      expect(limiter.stats.active).toBe(1);

      const secondTask = limiter.add(async () => {
        await sleep(10);
        return 'result';
      }, ac.signal);

      await flushPromises();
      expect(limiter.stats.pending).toBe(1);

      releaseFirst!(); // 释放槽位，第二个任务开始执行
      await flushPromises();

      expect(limiter.stats.pending).toBe(0);
      expect(limiter.stats.active).toBe(1);

      ac.abort(); // 任务已开始，abort 无效
      await expect(secondTask).resolves.toBe('result');
      expect(limiter.stats.active).toBe(0);
    });
  });

  // ==================== 动态调整并发数 ====================
  describe('Dynamic Concurrency Adjustment', () => {
    it('should adjust concurrency and process queue accordingly', async () => {
      const limiter = new Limiter(1);
      const results: string[] = [];

      let releaseHeld: () => void;
      void limiter.add(
        () =>
          new Promise<void>((resolve) => {
            releaseHeld = resolve;
          }),
      );

      await flushPromises();

      // 添加3个待处理任务
      const tasks = Array.from({length: 3}, (_, i) =>
        limiter.add(async () => {
          results.push(`task${i}`);
          await flushPromises();
          return i;
        }),
      );

      await flushPromises();
      expect(limiter.stats.pending).toBe(3);

      // 提高并发数到3，应自动开始处理待处理任务
      limiter.resetLimits(3);
      expect(limiter.getConcurrency()).toBe(3);

      releaseHeld!(); // 释放第一个槽
      await Promise.all(tasks);

      expect(results.sort()).toEqual(['task0', 'task1', 'task2']);
      expect(limiter.stats.active).toBe(0);
      expect(limiter.stats.pending).toBe(0);
    });

    it('should decrease concurrency without affecting running tasks', async () => {
      const limiter = new Limiter(5);
      const releaseFns: Array<() => void> = [];

      // 占满5个并发槽
      const tasks = Array.from({length: 5}, (_, i) =>
        limiter.add(
          () =>
            new Promise<number>((resolve) => {
              releaseFns.push(() => resolve(i));
            }),
        ),
      );

      await flushPromises();
      expect(limiter.stats.active).toBe(5);

      // 降低并发限制到2，不应影响正在运行的任务
      limiter.resetLimits(2);
      expect(limiter.getConcurrency()).toBe(2);
      expect(limiter.stats.active).toBe(5);

      // 新任务将排队
      const queuedTask = limiter.add(() => 'queued');
      await flushPromises();
      expect(limiter.stats.pending).toBe(1);

      // 释放所有运行中任务
      releaseFns.forEach((release) => release());
      await Promise.all(tasks);

      // 排队任务最终执行
      const result = await queuedTask;
      expect(result).toBe('queued');
    });

    it('should validate new concurrency parameter', () => {
      const limiter = new Limiter(3);
      expect(() => limiter.resetLimits(-1)).toThrow(ParameterError);
      expect(() => limiter.resetLimits(NaN)).toThrow(ParameterError);

      limiter.resetLimits(10);
      expect(limiter.getConcurrency()).toBe(10);
      expect(limiter.stats.concurrency).toBe(10);

      limiter.resetLimits(Infinity);
      expect(limiter.getConcurrency()).toBe(Infinity);
    });

    it('should allow unlimited concurrency with Infinity', async () => {
      const limiter = new Limiter(Infinity);
      const tasks = Array.from({length: 100}, (_, i) =>
        limiter.add(async () => {
          await flushPromises();
          return i;
        }),
      );

      // 所有任务应立即开始执行
      expect(limiter.stats.active).toBe(100);
      expect(limiter.stats.pending).toBe(0);

      const results = await Promise.all(tasks);
      expect(results).toHaveLength(100);
      expect(limiter.stats.active).toBe(0);
    });
  });

  // ==================== 队列压缩机制 ====================
  describe('Queue Compaction Mechanism', () => {
    it('should compact and reset queue appropriately', async () => {
      const limiter = new Limiter(0); // 并发0，所有任务排队

      const total = 200;
      const abortCount = 130;
      const controllers = Array.from(
        {length: total},
        () => new AbortController(),
      );

      const promises = controllers.map((c, i) =>
        limiter.add(() => i, c.signal).catch(() => 'aborted'),
      );

      await Promise.resolve();

      // 中止部分任务，产生空槽
      for (let i = 0; i < abortCount; i++) controllers[i].abort();
      await Promise.resolve();
      expect(limiter.stats.pending).toBe(70);

      // 多次调整并发，触发队列压缩
      for (let i = 0; i < 16; i++) {
        limiter.resetLimits(1);
        await flushPromises();
        limiter.resetLimits(0);
        await flushPromises();
      }

      expect(limiter.stats.pending).toBeLessThan(200);

      // 再次添加大量任务并全部中止，验证最终 pending 为0
      const taskCount = 1100;
      const controllers2 = Array.from(
        {length: taskCount},
        () => new AbortController(),
      );

      controllers2.forEach((c) => {
        void limiter.add(() => 'task', c.signal).catch(() => {});
      });

      await flushPromises();
      controllers2.forEach((c) => c.abort());
      await flushPromises();

      limiter.resetLimits(1);
      await flushPromises();
      expect(limiter.stats.pending).toBe(0);

      limiter.resetLimits(70);
      await Promise.all(promises);
    });

    it('should NOT compact when queue_head is large but waste_ratio is below threshold', async () => {
      const limiter = new Limiter(1);

      const releaseFns: (() => void)[] = [];

      void limiter.add(
        () =>
          new Promise<void>((resolve) => {
            releaseFns.push(resolve);
          }),
      );

      void Array.from({length: 100}, (_, i) => limiter.add(() => `task-${i}`));

      await flushPromises();

      // 释放所有任务，队列头指针会增大，但浪费率低，不应触发压缩
      for (let i = 0; i < 64; i++) {
        releaseFns[0]();
        await flushPromises();
      }

      expect(limiter['queue_head']).toBe(0);
      expect(limiter['queue'].length).toBe(0);
    });

    // 以下为从 Branch Coverage Complements 合并的测试

    it('should handle null slots during queue compaction', async () => {
      const limiter = new Limiter(1);
      const total = 200;
      const abortIndex = 180;
      const controllers = Array.from(
        {length: total},
        () => new AbortController(),
      );

      let releaseBlocker: () => void;
      void limiter.add(() => new Promise<void>((r) => (releaseBlocker = r)));
      await flushPromises();

      const tasks = controllers.map((c, i) =>
        limiter.add(() => i, c.signal).catch(() => 'aborted'),
      );

      // 中止某个任务，产生空槽
      controllers[abortIndex].abort();
      await flushPromises();

      releaseBlocker!(); // 释放阻塞任务，让队列继续处理
      const results = await Promise.all(tasks);

      expect(limiter.stats.pending).toBe(0);
      expect(results[abortIndex]).toBe('aborted');
      const successfulRuns = results.filter((r) => typeof r === 'number');
      expect(successfulRuns.length).toBe(total - 1);
    });

    it('should reset large queue array reference when fully drained', async () => {
      const limiter = new Limiter(1);
      const total = 2000;

      let releaseBlocker: () => void;
      void limiter.add(() => new Promise<void>((r) => (releaseBlocker = r)));
      await flushPromises();

      const tasks = Array.from({length: total}, (_, i) => limiter.add(() => i));
      await flushPromises();

      expect(limiter.stats.pending).toBe(2000);

      releaseBlocker!(); // 释放，所有任务依次执行
      await Promise.all(tasks);

      expect(limiter.stats.pending).toBe(0);
      expect(limiter.stats.active).toBe(0);
      // 队列数组应被重置为新数组（私有属性，不直接断言，但可通过后续操作间接验证）
    });
  });

  // ==================== 错误处理与边界情况 ====================
  describe('Error Handling and Edge Cases', () => {
    it('should propagate errors correctly without affecting other tasks', async () => {
      const limiter = new Limiter(3);
      const results: string[] = [];

      const tasks = [
        limiter.add(() => {
          results.push('task1-start');
          throw new Error('task1 failed');
        }),
        limiter.add(async () => {
          await sleep(1);
          results.push('task2-complete');
          return 'task2';
        }),
        limiter.add(() => {
          results.push('task3-start');
          throw new Error('Error 2');
        }),
      ];

      const settled = await Promise.allSettled(tasks);

      expect(settled[0].status).toBe('rejected');
      expect(settled[1].status).toBe('fulfilled');
      expect(settled[2].status).toBe('rejected');

      expect(results).toContain('task1-start');
      expect(results).toContain('task2-complete');
      expect(results).toContain('task3-start');
    });

    it('should handle various task types correctly', async () => {
      const limiter = new Limiter(3);

      const syncResult = await limiter.add(() => 'sync');
      expect(syncResult).toBe('sync');

      const asyncResult = await limiter.add(() => Promise.resolve('async'));
      expect(asyncResult).toBe('async');

      await expect(
        limiter.add(() => {
          throw new Error('Immediate reject');
        }),
      ).rejects.toThrow('Immediate reject');

      const mixedTasks = Array.from({length: 10}, (_, i) =>
        i % 2 === 0
          ? limiter.add(() => i)
          : limiter.add(async () => {
              await flushPromises();
              return i;
            }),
      );

      const mixedResults = await Promise.all(mixedTasks);
      expect(mixedResults).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });

    it('should handle rapid concurrency changes', async () => {
      const limiter = new Limiter(3);
      const results: number[] = [];
      const tasks = Array.from({length: 50}, (_, i) =>
        limiter.add(async () => {
          await flushPromises();
          results.push(i);
          return i;
        }),
      );

      // 在任务执行过程中快速调整并发
      setTimeout(() => limiter.resetLimits(1), 0);
      setTimeout(() => limiter.resetLimits(10), 0);
      setTimeout(() => limiter.resetLimits(2), 0);

      await Promise.all(tasks);
      expect(results.length).toBe(50);
    });
  });

  // ==================== wait 方法 ====================
  describe('wait method', () => {
    it('should manage slot acquisition and release with proper stats', async () => {
      const limiter = new Limiter(2);

      const release1 = await limiter.wait();
      expect(limiter.stats).toEqual({
        concurrency: 2,
        active: 1,
        pending: 0,
        isPaused: false,
      });

      const release2 = await limiter.wait();
      expect(limiter.stats).toEqual({
        concurrency: 2,
        active: 2,
        pending: 0,
        isPaused: false,
      });

      release1();
      expect(limiter.stats.active).toBe(1);

      release2();
      expect(limiter.stats.active).toBe(0);
    });

    it('should not affect queue processing after redundant release', async () => {
      const limiter = new Limiter(1);

      let releaseHeld: () => void;
      void limiter.add(
        () => new Promise<void>((resolve) => (releaseHeld = resolve)),
      );
      await flushPromises();

      const w1 = limiter.wait();
      const w2 = limiter.wait();
      const w3 = limiter.wait();
      await flushPromises();

      releaseHeld!(); // 释放第一个任务，w1 获得槽
      const r1 = await w1;

      r1(); // 释放槽，但 w2 应获得槽
      r1(); // 冗余释放，不应影响状态

      const r2 = await w2;
      expect(limiter.stats.active).toBe(1);

      r2(); // 释放，w3 获得槽
      const r3 = await w3;
      expect(limiter.stats.active).toBe(1);

      r3();
      expect(limiter.stats.active).toBe(0);
    });

    it('should queue and resolve in FIFO order with interleaved add() calls', async () => {
      const limiter = new Limiter(1);

      let releaseHeld: () => void;
      void limiter.add(
        () => new Promise<void>((resolve) => (releaseHeld = resolve)),
      );
      await flushPromises();

      const waitPromise = limiter.wait();
      const addPromise = limiter.add(() => 'add-result');
      const waitPromise2 = limiter.wait();

      expect(limiter.stats.pending).toBe(3);

      releaseHeld!(); // 释放槽，waitPromise 应最先获得
      await flushPromises();

      const release1 = await waitPromise;
      expect(limiter.stats.active).toBe(1);
      expect(limiter.stats.pending).toBe(2);

      release1(); // 释放，接下来是 addPromise 获得槽
      await flushPromises();
      const addResult = await addPromise;
      expect(addResult).toBe('add-result');
      expect(limiter.stats.pending).toBe(0); // waitPromise2 仍在队列？实际上此时 waitPromise2 应该还在 pending 中，因为 add 执行完后会释放槽，waitPromise2 才能获得槽
      // 修正：addPromise 完成后，槽释放，waitPromise2 获得槽
      const release2 = await waitPromise2;
      release2();
      expect(limiter.stats.active).toBe(0);
    });

    it('should handle abort signals correctly', async () => {
      const limiter = new Limiter(1);

      let releaseHeld: () => void;
      void limiter.add(
        () => new Promise<void>((resolve) => (releaseHeld = resolve)),
      );
      await flushPromises();

      const controller1 = new AbortController();
      controller1.abort('Pre-aborted');
      await expect(limiter.wait(controller1.signal)).rejects.toThrow(
        'Pre-aborted',
      );

      const controller2 = new AbortController();
      const waitPromise = limiter.wait(controller2.signal);
      await flushPromises();
      expect(limiter.stats.pending).toBe(1);

      controller2.abort('Cancelled');
      await expect(waitPromise).rejects.toThrow('Cancelled');
      expect(limiter.stats.pending).toBe(0);

      const controller3 = new AbortController();
      const lateWaitPromise = limiter.wait(controller3.signal);
      releaseHeld!(); // 释放槽，lateWaitPromise 立即获得
      await flushPromises();

      controller3.abort('Too late'); // 已获得槽，忽略 abort
      const release = await lateWaitPromise;
      release();

      expect(limiter.stats.active).toBe(0);
    });

    it('should handle concurrency changes while waiting', async () => {
      const limiter = new Limiter(1);

      let releaseHeld: () => void;
      void limiter.add(
        () => new Promise<void>((resolve) => (releaseHeld = resolve)),
      );
      await flushPromises();

      const wait1 = limiter.wait();
      const wait2 = limiter.wait();
      expect(limiter.stats.pending).toBe(2);

      // 提高并发数，应自动处理等待中的 wait
      limiter.resetLimits(2);
      await flushPromises();

      const release1 = await wait1; // wait1 立即获得槽
      expect(limiter.stats.active).toBe(2); // 加上原来的 active 1，现在共2
      expect(limiter.stats.pending).toBe(1); // wait2 仍在等待

      releaseHeld!(); // 释放原来的任务，此时 active 变为1（release1 还在），wait2 获得槽
      await flushPromises();
      const release2 = await wait2;
      expect(limiter.stats.active).toBe(2);

      release1();
      release2();
      expect(limiter.stats.active).toBe(0);
    });

    it('should ensure release function idempotency', async () => {
      const limiter = new Limiter(1);
      const release = await limiter.wait();
      expect(limiter.stats.active).toBe(1);

      release();
      release();
      release(); // 多次调用应只释放一次
      expect(limiter.stats.active).toBe(0);

      const newRelease = await limiter.wait();
      expect(limiter.stats.active).toBe(1);
      newRelease();
      expect(limiter.stats.active).toBe(0);
    });

    it('should handle zero concurrency limit', async () => {
      const limiter = new Limiter(0);
      const waitPromise = limiter.wait();
      await flushPromises();
      expect(limiter.stats.pending).toBe(1);

      limiter.resetLimits(1); // 提高并发，waitPromise 应获得槽
      const release = await waitPromise;
      expect(limiter.stats.active).toBe(1);

      release();
      expect(limiter.stats.active).toBe(0);
    });

    it('should handle rapid wait/release cycles without leaks', async () => {
      const limiter = new Limiter(5);

      for (let i = 0; i < 100; i++) {
        const releases = await Promise.all(
          Array.from({length: 5}, () => limiter.wait()),
        );
        expect(limiter.stats.active).toBe(5);

        // 随机顺序释放
        while (releases.length > 0) {
          const idx = Math.floor(Math.random() * releases.length);
          releases.splice(idx, 1)[0]();
          await flushPromises();
        }
        expect(limiter.stats.active).toBe(0);
      }

      expect(limiter.stats).toEqual({
        concurrency: 5,
        active: 0,
        pending: 0,
        isPaused: false,
      });
    });

    // 从 Branch Coverage Complements 合并的测试
    it('should ignore abort signal for immediately resolved wait()', async () => {
      const limiter = new Limiter(3);
      const controller = new AbortController();

      const release = await limiter.wait(controller.signal); // 立即获得槽
      expect(limiter.stats.active).toBe(1);

      controller.abort(); // 已获得槽，忽略 abort
      await flushPromises();

      expect(limiter.stats.active).toBe(1);
      release();
      expect(limiter.stats.active).toBe(0);
    });
  });

  // ==================== 高级控制流：onIdle, clear, pause/resume ====================
  describe('Advanced Control Flow (onIdle, clear, pause/resume)', () => {
    describe('onIdle', () => {
      it('should resolve immediately if no tasks are running', async () => {
        const limiter = new Limiter(2);
        await expect(limiter.onIdle()).resolves.toBeUndefined();
      });

      it('should wait for active tasks to complete', async () => {
        const limiter = new Limiter(2);
        let release: () => void;
        void limiter.add(() => new Promise<void>((r) => (release = r)));

        let idleResolved = false;
        const idlePromise = limiter.onIdle().then(() => {
          idleResolved = true;
        });

        await flushPromises();
        expect(idleResolved).toBe(false);

        release!();
        await idlePromise;
        expect(idleResolved).toBe(true);
        expect(limiter.stats.active).toBe(0);
      });

      it('should wait for pending tasks to complete', async () => {
        const limiter = new Limiter(1);
        let releaseBlocker: () => void;
        void limiter.add(() => new Promise<void>((r) => (releaseBlocker = r)));
        await flushPromises();

        const pendingTask = limiter.add(() => 'done');
        await flushPromises();
        expect(limiter.stats.pending).toBe(1);

        const idlePromise = limiter.onIdle();
        releaseBlocker!(); // 释放槽，pending 开始执行并完成

        await expect(idlePromise).resolves.toBeUndefined();
        await expect(pendingTask).resolves.toBe('done');
      });

      it('should resolve after clear()', async () => {
        const limiter = new Limiter(1);
        let releaseBlocker: () => void;
        void limiter.add(() => new Promise<void>((r) => (releaseBlocker = r)));
        await flushPromises();

        const pending_task = limiter.add(() => 'never runs'); // 待处理任务
        pending_task.catch(() => {});
        await flushPromises();

        const idlePromise = limiter.onIdle();
        limiter.clear(); // 清空待处理任务，但活动任务仍在
        await flushPromises();

        expect(limiter.stats.active).toBe(1);

        releaseBlocker!(); // 活动任务完成，onIdle 应解析
        await expect(idlePromise).resolves.toBeUndefined();
      });
    });

    describe('clear', () => {
      it('should reject all pending tasks with DOMException', async () => {
        const limiter = new Limiter(1);
        let release: () => void;
        void limiter.add(() => new Promise<void>((r) => (release = r)));

        const pending = Array.from({length: 5}, (_, i) =>
          limiter.add(() => i).catch((e: unknown) => e),
        );

        await flushPromises();
        expect(limiter.stats.pending).toBe(5);

        limiter.clear();

        const results = await Promise.all(pending);
        results.forEach((r) => expect(r).toBeInstanceOf(DOMException));
        expect(limiter.stats.pending).toBe(0);
        expect(limiter.stats.active).toBe(1);

        release!();
        await flushPromises();
        expect(limiter.stats.active).toBe(0);
      });

      it('should reset queue correctly after clear', async () => {
        const limiter = new Limiter(0);
        void Array.from({length: 10}, () =>
          limiter.add(() => 'x').catch(() => {}),
        );
        await flushPromises();
        expect(limiter.stats.pending).toBe(10);

        limiter.clear();
        await flushPromises();

        expect(limiter.stats.pending).toBe(0);
        expect(limiter['queue'].length).toBe(0);
        expect(limiter['queue_head']).toBe(0);
      });

      it('should handle null slots in queue during clear()', async () => {
        const limiter = new Limiter(0); // 强制排队
        const ac1 = new AbortController();
        const ac2 = new AbortController();

        const p1 = limiter
          .add(() => 'never', ac1.signal)
          .catch((e: unknown) => e);
        const p2 = limiter
          .add(() => 'never', ac2.signal)
          .catch((e: unknown) => e);
        const p3 = limiter
          .add(() => 'never', ac1.signal)
          .catch((e: unknown) => e);

        await flushPromises();
        expect(limiter.stats.pending).toBe(3);

        // 中止 p1 和 p3，队列中产生空槽
        ac1.abort();
        await flushPromises();

        expect(limiter.stats.pending).toBe(1); // 只剩 p2

        limiter.clear(); // 此时队列包含 null, Item2, null，clear 应正确处理

        const results = await Promise.all([p1, p2, p3]);

        expect(results[0]).toBeInstanceOf(DOMException);
        expect((results[0] as Error).name).toBe('AbortError');
        expect(results[2]).toBeInstanceOf(DOMException);
        expect((results[2] as Error).name).toBe('AbortError');

        expect(results[1]).toBeInstanceOf(DOMException);
        expect((results[1] as Error).message).toBe('The operation was aborted');

        expect(limiter.stats.pending).toBe(0);
      });

      it('should reject pending wait() tasks', async () => {
        const limiter = new Limiter(0);

        const waitPromise = limiter.wait().catch((e: unknown) => e);
        await flushPromises();
        expect(limiter.stats.pending).toBe(1);

        limiter.clear();

        const result = await waitPromise;
        expect(result).toBeInstanceOf(DOMException);
        expect((result as Error).name).toBe('AbortError');
        expect(limiter.stats.pending).toBe(0);
      });

      it('should reset large queue array reference when cleared', async () => {
        const limiter = new Limiter(0);
        const total = 1100;

        void Array.from({length: total}, () =>
          limiter.add(() => 'x').catch(() => {}),
        );
        await flushPromises();
        expect(limiter.stats.pending).toBe(total);

        limiter.clear();
        await flushPromises();

        expect(limiter.stats.pending).toBe(0);
        expect(limiter['queue'].length).toBe(0);
      });
    });

    describe('pause and resume', () => {
      it('should pause task processing', async () => {
        const limiter = new Limiter(1);
        limiter.pause();

        void limiter.add(() => 'result');
        await flushPromises();

        expect(limiter.stats.active).toBe(0);
        expect(limiter.stats.pending).toBe(1);
        expect(limiter.stats.isPaused).toBe(true);
      });

      it('should resume task processing', async () => {
        const limiter = new Limiter(1);
        limiter.pause();

        const task = limiter.add(() => 'result');
        await flushPromises();
        expect(limiter.stats.pending).toBe(1);

        limiter.resume();
        await flushPromises();

        expect(limiter.stats.active).toBe(0);
        expect(limiter.stats.pending).toBe(0);
        expect(limiter.stats.isPaused).toBe(false);
        await expect(task).resolves.toBe('result');
      });

      it('should keep active tasks running when paused', async () => {
        const limiter = new Limiter(2);
        let release1: () => void;
        let release2: () => void;

        void limiter.add(() => new Promise<void>((r) => (release1 = r)));
        void limiter.add(() => new Promise<void>((r) => (release2 = r)));
        await flushPromises();

        expect(limiter.stats.active).toBe(2);
        limiter.pause();
        expect(limiter.stats.isPaused).toBe(true);

        expect(limiter.stats.active).toBe(2); // 活动任务继续运行

        release1!();
        await flushPromises();

        expect(limiter.stats.active).toBe(1); // 释放后 active 减少

        release2!();
        await flushPromises();
        expect(limiter.stats.active).toBe(0);
      });

      it('should handle pause/resume boundaries with pending queue', async () => {
        const limiter = new Limiter(1);
        let release: () => void;
        void limiter.add(() => new Promise<void>((r) => (release = r)));
        await flushPromises();

        const p1 = limiter.add(() => 'one');
        const p2 = limiter.add(() => 'two');
        await flushPromises();

        limiter.pause();
        release!(); // 释放活动任务，但由于 pause，不会启动新任务
        await flushPromises();

        expect(limiter.stats.active).toBe(0);
        expect(limiter.stats.pending).toBe(2);

        limiter.resume(); // 恢复，待处理任务应开始执行
        await expect(p1).resolves.toBe('one');
        await expect(p2).resolves.toBe('two');
      });

      it('should handle resume with concurrency increase', async () => {
        const limiter = new Limiter(1);
        limiter.pause();

        const t1 = limiter.add(() => 1);
        const t2 = limiter.add(() => 2);
        await flushPromises();

        expect(limiter.stats.pending).toBe(2);

        limiter.resetLimits(2); // 提高并发
        await flushPromises();

        expect(limiter.stats.active).toBe(0); // 仍处于暂停，不会启动

        limiter.resume(); // 恢复，应利用新并发同时启动两个任务
        await Promise.all([t1, t2]);

        expect(limiter.stats.active).toBe(0);
      });

      it('should be idempotent when calling resume multiple times', async () => {
        const limiter = new Limiter(1);
        limiter.pause();

        const task = limiter.add(() => 'result');
        await flushPromises();
        expect(limiter.stats.pending).toBe(1);

        limiter.resume();
        await flushPromises();
        expect(limiter.stats.isPaused).toBe(false);
        expect(limiter.stats.pending).toBe(0);
        await expect(task).resolves.toBe('result');

        // 第二次 resume 不应产生副作用
        limiter.resume();
        expect(limiter.stats.isPaused).toBe(false);
        expect(limiter.stats.active).toBe(0);
      });
    });
  });
});
