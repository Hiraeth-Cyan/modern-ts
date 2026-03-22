// ========================================
// ./src/Concurrent/semaphore.spec.ts
// ========================================
import {describe, it, expect, vi} from 'vitest';
import {Semaphore, PermitGuard, DEBUG_SEMAPHORE} from './semaphore';
import {UseAfterFreeError, LockError, ParameterError} from '../../Errors';
import {sleep} from '../delay';
import {Barrier} from '../barrier';
import {flushPromises} from '../../helper';

// ========================================
// Semaphore 基础功能测试
// ========================================
describe.concurrent('Semaphore', () => {
  describe('Constructor and Basic Operations', () => {
    it('should initialize with correct permit count (default, custom) and reject negative', () => {
      // 测试自定义许可数
      const sem1 = new Semaphore(5);
      expect(sem1.getStats().availablePermits).toBe(5);
      sem1.dispose();

      // 测试默认许可数（二进制信号量）
      const sem2 = new Semaphore();
      expect(sem2.getStats().availablePermits).toBe(1);
      sem2.dispose();

      // 负数应抛出异常
      expect(() => new Semaphore(-1)).toThrow(ParameterError);
      expect(() => new Semaphore(-100)).toThrow(ParameterError);
    });

    it('should acquire and release permits correctly (tryAcquire, release single/multiple, async acquire)', async () => {
      const sem = new Semaphore(3);

      // tryAcquire 成功
      expect(sem.tryAcquire()).toBe(true);
      expect(sem.getStats().availablePermits).toBe(2);
      expect(sem.tryAcquire()).toBe(true);
      expect(sem.tryAcquire()).toBe(true);
      expect(sem.getStats().availablePermits).toBe(0);

      // tryAcquire 失败
      expect(sem.tryAcquire()).toBe(false);

      // release 单个许可
      sem.release();
      expect(sem.getStats().availablePermits).toBe(1);

      // release 多个许可
      sem.release(2);
      expect(sem.getStats().availablePermits).toBe(3);

      // 异步 acquire/release 顺序操作
      await sem.acquire();
      expect(sem.getStats().availablePermits).toBe(2);
      sem.release();
      expect(sem.getStats().availablePermits).toBe(3);

      sem.dispose();
    });

    it('should throw ParameterError for invalid release count', () => {
      const sem = new Semaphore(3);
      expect(() => sem.release(0)).toThrow(ParameterError);
      expect(() => sem.release(-1)).toThrow(ParameterError);
      expect(() => sem.release(-100)).toThrow(ParameterError);
      sem.dispose();
    });

    it('should throw ParameterError with formatted message for invalid initialPermits', () => {
      expect(() => new Semaphore(-1)).toThrow(
        'Semaphore: `initialPermits` must be a non-negative number, but got -1',
      );
      expect(() => new Semaphore(NaN)).toThrow(
        'Semaphore: `initialPermits` must be a non-negative number, but got NaN',
      );
    });

    it('should throw ParameterError with formatted message for invalid release count', () => {
      const sem = new Semaphore(3);
      expect(() => sem.release(0)).toThrow(
        'Semaphore: `count` must be at least 1, but got 0',
      );
      expect(() => sem.release(-5)).toThrow(
        'Semaphore: `count` must be at least 1, but got -5',
      );
      sem.dispose();
    });
  });

  describe('Queueing Behavior with Multiple Permits', () => {
    it('should allow up to N concurrent acquires (N = initial permits)', async () => {
      const sem = new Semaphore(3);
      const executionOrder: number[] = [];
      const barrier = new Barrier(4);

      // 消耗所有许可
      expect(sem.tryAcquire()).toBe(true);
      expect(sem.tryAcquire()).toBe(true);
      expect(sem.tryAcquire()).toBe(true);

      // 第4个任务排队
      const task4 = sem.acquire().then(() => {
        executionOrder.push(4);
        barrier.arrive();
        sem.release();
      });

      await flushPromises();
      expect(sem.getStats().waitingQueueLength).toBe(1);

      // 释放3个许可唤醒任务4
      sem.release(3);
      await task4;

      expect(executionOrder).toEqual([4]);
      sem.dispose();
    });

    it('should queue multiple acquire requests beyond available permits', async () => {
      const sem = new Semaphore(3);
      const executionOrder: number[] = [];
      const barrier = new Barrier(6);

      // 消耗所有许可
      await sem.acquire();
      await sem.acquire();
      await sem.acquire();

      // 启动5个排队任务
      const tasks = Array.from({length: 5}, (_, i) =>
        sem.acquire().then(() => {
          executionOrder.push(i + 1);
          barrier.arrive();
          sem.release();
        }),
      );

      await flushPromises();
      expect(sem.getStats().waitingQueueLength).toBe(5);

      // 释放3个许可唤醒前3个
      sem.release(3);
      await flushPromises();
      expect(sem.getStats().waitingQueueLength).toBe(0);

      // 释放2个许可唤醒剩余
      sem.release(2);
      await Promise.all(tasks);

      expect(executionOrder).toEqual([1, 2, 3, 4, 5]);
      sem.dispose();
    });

    it('should handle release(count) waking multiple waiters', async () => {
      const sem = new Semaphore(3);
      // 消耗所有许可
      await sem.acquire();
      await sem.acquire();
      await sem.acquire();

      const releases: (() => void)[] = [];
      const tasks = Array.from({length: 4}, (_) =>
        sem.acquire().then(() => {
          releases.push(() => sem.release());
        }),
      );

      await flushPromises();
      expect(sem.getStats().waitingQueueLength).toBe(4);

      // 释放3个许可唤醒前3个
      sem.release(3);
      await flushPromises();
      expect(sem.getStats().waitingQueueLength).toBe(1);

      // 手动释放前3个任务持有的许可
      releases.slice(0, 3).forEach((fn) => fn());

      // 释放最后1个许可唤醒最后一个
      sem.release();
      await Promise.all(tasks);
      releases[3]();

      sem.dispose();
    });
  });

  describe('resetPermits and getPermits', () => {
    it('should return current permit count via getPermits', () => {
      const sem = new Semaphore(5);
      expect(sem.getPermits()).toBe(5);
      sem.tryAcquire();
      expect(sem.getPermits()).toBe(4);
      sem.release();
      expect(sem.getPermits()).toBe(5);
      sem.dispose();
    });

    it('should throw UseAfterFreeError when calling getPermits after dispose', () => {
      const sem = new Semaphore(3);
      sem.dispose();
      expect(() => sem.getPermits()).toThrow(UseAfterFreeError);
    });

    it('should dynamically increase permits and wake waiters', async () => {
      const sem = new Semaphore(1);
      await sem.acquire(); // 消耗许可

      const waiter1 = sem.acquire().then(() => 'waiter1');
      const waiter2 = sem.acquire().then(() => 'waiter2');

      await flushPromises();
      expect(sem.getStats().waitingQueueLength).toBe(2);

      // 增加到3个许可，应唤醒2个等待者
      sem.resetPermits(3);
      await flushPromises();

      expect(sem.getPermits()).toBe(1); // 3 - 2 = 1
      expect(sem.getStats().waitingQueueLength).toBe(0);

      const results = await Promise.all([waiter1, waiter2]);
      expect(results).toEqual(['waiter1', 'waiter2']);

      sem.release(2);
      sem.dispose();
    });

    it('should dynamically decrease permits', () => {
      const sem = new Semaphore(5);
      sem.resetPermits(2);
      expect(sem.getPermits()).toBe(2);

      // 减少到0
      sem.resetPermits(0);
      expect(sem.getPermits()).toBe(0);
      expect(sem.tryAcquire()).toBe(false);

      sem.dispose();
    });

    it('should throw ParameterError for invalid new_permits', () => {
      const sem = new Semaphore(3);
      expect(() => sem.resetPermits(-1)).toThrow(
        'Semaphore: `new_permits` must be a non-negative number, but got -1',
      );
      expect(() => sem.resetPermits(NaN)).toThrow(
        'Semaphore: `new_permits` must be a non-negative number, but got NaN',
      );
      sem.dispose();
    });

    it('should throw UseAfterFreeError when calling resetPermits after dispose', () => {
      const sem = new Semaphore(3);
      sem.dispose();
      expect(() => sem.resetPermits(5)).toThrow(UseAfterFreeError);
    });

    it('should not wake waiters when permits stay at zero', async () => {
      const sem = new Semaphore(2);
      await sem.acquire();
      await sem.acquire(); // 消耗所有许可

      const waiter = sem.acquire().then(() => 'waiter');
      await flushPromises();
      expect(sem.getStats().waitingQueueLength).toBe(1);

      // 重置为0，不应唤醒等待者
      sem.resetPermits(0);
      await flushPromises();
      expect(sem.getStats().waitingQueueLength).toBe(1);
      expect(sem.getPermits()).toBe(0);

      // 释放许可让等待者完成
      sem.release();
      expect(await waiter).toBe('waiter');

      sem.dispose();
    });

    it('should handle resetPermits with no waiters', () => {
      const sem = new Semaphore(2);
      sem.resetPermits(10);
      expect(sem.getPermits()).toBe(10);

      sem.tryAcquire();
      expect(sem.getPermits()).toBe(9);

      sem.dispose();
    });

    it('should skip null slots when waking waiters via resetPermits', async () => {
      const sem = new Semaphore(0);

      // 创建多个等待者，部分会被 abort
      const controllers = Array.from({length: 5}, () => new AbortController());
      const promises = controllers.map((c, i) =>
        sem
          .acquire(c.signal)
          .then(() => i)
          .catch(() => `aborted_${i}`),
      );

      await flushPromises();
      expect(sem.getStats().waitingQueueLength).toBe(5);

      // 中止中间几个任务，制造 null 槽位
      controllers[1].abort();
      controllers[3].abort();
      await flushPromises();
      expect(sem.getStats().waitingQueueLength).toBe(3);

      // 增加足够 permits 唤醒剩余等待者
      sem.resetPermits(5);
      await flushPromises();

      const results = await Promise.all(promises);
      expect(results).toEqual([0, 'aborted_1', 2, 'aborted_3', 4]);
      expect(sem.getPermits()).toBe(2); // 5 - 3 = 2

      sem.dispose();
    });

    it('should handle large queue cleanup (>1024) when waking via resetPermits', async () => {
      const sem = new Semaphore(0);
      const taskCount = 1100;

      const controllers = Array.from(
        {length: taskCount},
        () => new AbortController(),
      );
      const promises = controllers.map((c) =>
        sem
          .acquire(c.signal)
          .then(() => 'success')
          .catch(() => 'aborted'),
      );

      await flushPromises();
      expect(sem.getStats().waitingQueueLength).toBe(taskCount);

      // 中止大部分任务，只保留少量
      for (let i = 0; i < taskCount - 5; i++) controllers[i].abort();
      await flushPromises();
      expect(sem.getStats().waitingQueueLength).toBe(5);

      // 增加 permits 唤醒剩余任务
      sem.resetPermits(10);
      await Promise.all(promises);

      // 队列应该被清理（>1024 时重新分配数组）
      expect(sem.getStats().queueCapacity).toBe(0);
      expect(sem.getPermits()).toBe(5); // 10 - 5 = 5

      sem.dispose();
    });

    it('should not cleanup queue when not fully processed', async () => {
      const sem = new Semaphore(0);

      // 创建等待者
      const controllers = Array.from({length: 10}, () => new AbortController());
      const promises = controllers.map((c) =>
        sem.acquire(c.signal).catch(() => 'aborted'),
      );

      await flushPromises();
      expect(sem.getStats().waitingQueueLength).toBe(10);

      // 只增加少量 permits，不处理完整个队列
      sem.resetPermits(3);
      await flushPromises();

      // 队列应该还有剩余
      expect(sem.getStats().waitingQueueLength).toBe(7);
      expect(sem.getStats().queueCapacity).toBe(10);

      // 清理
      for (const c of controllers) c.abort();
      await Promise.allSettled(promises);
      sem.dispose();
    });
  });

  describe('AbortSignal Support', () => {
    it('should abort acquire when signal is already aborted', async () => {
      const sem = new Semaphore(3);
      const controller = new AbortController();
      controller.abort();
      await expect(sem.acquire(controller.signal)).rejects.toThrow(
        DOMException,
      );
      sem.dispose();
    });

    it('should abort acquire when signal aborts while waiting', async () => {
      const sem = new Semaphore(3);
      await sem.acquire();
      await sem.acquire();
      await sem.acquire();

      const controller = new AbortController();
      const acquirePromise = sem.acquire(controller.signal);

      await flushPromises();
      expect(sem.getStats().waitingQueueLength).toBe(1);

      controller.abort();
      await expect(acquirePromise).rejects.toThrow(DOMException);
      expect(sem.getStats().waitingQueueLength).toBe(0);

      sem.release(3);
      sem.dispose();
    });

    it('should not abort if signal is not provided', async () => {
      const sem = new Semaphore(3);
      await sem.acquire();
      await sem.acquire();
      await sem.acquire();

      const acquirePromise = sem.acquire(); // 无信号，应等待
      const timeoutPromise = sleep(50).then(() => {
        throw new Error('Acquire should not timeout without signal');
      });

      sem.release(); // 释放一个许可
      await expect(
        Promise.race([acquirePromise, timeoutPromise]),
      ).resolves.toBeUndefined();

      sem.release(2);
      sem.dispose();
    });

    it('should handle abort during multi-permit release wake-up', async () => {
      const sem = new Semaphore(3);
      await sem.acquire();
      await sem.acquire();
      await sem.acquire();

      const controller1 = new AbortController();
      const task1 = sem.acquire(controller1.signal).catch(() => 'aborted');
      const task2 = sem.acquire().then(() => {
        sem.release();
        return 'success2';
      });
      const task3 = sem.acquire().then(() => {
        sem.release();
        return 'success3';
      });

      await flushPromises();
      expect(sem.getStats().waitingQueueLength).toBe(3);

      controller1.abort();
      await flushPromises();
      expect(sem.getStats().waitingQueueLength).toBe(2);

      sem.release(2);
      const [result1, result2, result3] = await Promise.all([
        task1,
        task2,
        task3,
      ]);

      expect(result1).toBe('aborted');
      expect(result2).toBe('success2');
      expect(result3).toBe('success3');

      sem.dispose();
    });
  });

  describe('withPermit Method', () => {
    it('should manage permit automatically (normal execution, error propagation, abort support)', async () => {
      const sem = new Semaphore(3);

      // 正常执行
      const task = vi.fn(() => 'result');
      const result = await sem.withPermit(task);
      expect(result).toBe('result');
      expect(task).toHaveBeenCalledTimes(1);
      expect(sem.getStats().availablePermits).toBe(3);

      // 错误传播
      const errorTask = vi.fn(() => {
        throw new Error('Task failed');
      });
      await expect(sem.withPermit(errorTask)).rejects.toThrow('Task failed');
      expect(sem.getStats().availablePermits).toBe(3);

      // 中止信号
      await sem.acquire();
      await sem.acquire();
      await sem.acquire(); // 消耗所有许可

      const controller = new AbortController();
      const abortTask = vi.fn(() => 'result');
      const abortPromise = sem.withPermit(abortTask, controller.signal);
      controller.abort();
      await expect(abortPromise).rejects.toThrow(DOMException);
      expect(abortTask).not.toHaveBeenCalled();

      sem.release(3); // 清理
      sem.dispose();
    });
  });

  describe('Queue Compaction Mechanism', () => {
    // 这些测试涉及内部实现细节，保留原样（未合并）
    it('should correctly handle multiple holes at head and middle during release', async () => {
      const sem = new Semaphore(1);
      await sem.acquire();

      const controllers: AbortController[] = [];
      const waiters: Promise<void | string>[] = [];

      for (let i = 0; i < 100; i++) {
        const ac = new AbortController();
        controllers.push(ac);
        waiters.push(sem.acquire(ac.signal).catch(() => 'aborted'));
      }

      await flushPromises();
      expect(sem.getStats().waitingQueueLength).toBe(100);

      for (let i = 0; i < 70; i++) controllers[i].abort();
      controllers[80].abort();

      expect(sem.getStats().waitingQueueLength).toBe(29);

      sem.release();
      await flushPromises();

      expect(sem.getStats().waitingQueueLength).toBe(28);
      expect(sem.getStats().availablePermits).toBe(0);

      while (
        sem.getStats().waitingQueueLength > 0 ||
        sem.getStats().availablePermits < 1
      ) {
        try {
          sem.release();
        } catch {
          break;
        }
      }

      await Promise.all(waiters);
      const finalStats = sem.getStats();
      expect(finalStats.availablePermits).toBe(1);
      expect(finalStats.waitingQueueLength).toBe(0);

      sem.dispose();
    });

    it('should compact queue after 16 releases with high waste ratio', async () => {
      const sem = new Semaphore(0);
      const total = 200;
      const abortCount = 130;
      const controllers = Array.from(
        {length: total},
        () => new AbortController(),
      );
      const promises = controllers.map((c) =>
        sem.acquire(c.signal).catch(() => {}),
      );

      await flushPromises();
      for (let i = 0; i < abortCount; i++) controllers[i].abort();
      await flushPromises();

      for (let i = 0; i < 16; i++) {
        sem.release(1);
      }

      const stats = sem.getStats();
      expect(stats.queueCapacity).toBe(69);
      expect(stats.queueHead).toBe(15);

      sem.release(54);
      await Promise.all(promises);
      sem.dispose();
    });

    it('should deallocate large queue on release if queue is mostly empty/aborted', async () => {
      const sem = new Semaphore(0);
      const taskCount = 1100;

      const controllers = Array.from(
        {length: taskCount},
        () => new AbortController(),
      );
      controllers.forEach((c) => void sem.acquire(c.signal).catch(() => {}));
      await flushPromises();
      controllers.forEach((c) => c.abort());
      await flushPromises();

      sem.release(3);

      const stats = sem.getStats();
      expect(stats.queueCapacity).toBe(0);
      expect(stats.queueHead).toBe(0);
      expect(stats.waitingQueueLength).toBe(0);

      sem.dispose();
    });
  });

  describe('Error Handling', () => {
    it('should handle dispose correctly (pending acquires, held permits, null slots)', async () => {
      const sem = new Semaphore(3);

      // 消耗许可
      await sem.acquire();
      await sem.acquire();
      await sem.acquire();

      // 添加等待任务
      const acquirePromises = [sem.acquire(), sem.acquire()];
      await flushPromises();
      expect(sem.getStats().waitingQueueLength).toBe(2);

      // 添加一个带 abort 的任务并立即中止（制造 null 槽）
      const controller = new AbortController();
      sem.acquire(controller.signal).catch(() => {});
      await flushPromises();
      controller.abort();
      await flushPromises();
      expect(sem.getStats().waitingQueueLength).toBe(2);

      // 执行 dispose
      sem.dispose();
      expect(sem.getStats().isDisposed).toBe(true);
      expect(sem.getStats().availablePermits).toBe(0);
      expect(sem.getStats().waitingQueueLength).toBe(0);

      // 所有操作应抛出 UseAfterFreeError
      await expect(sem.acquire()).rejects.toThrow(UseAfterFreeError);
      expect(() => sem.release()).toThrow(UseAfterFreeError);
      expect(() => sem.tryAcquire()).toThrow(UseAfterFreeError);

      // 等待任务应被拒绝
      for (const p of acquirePromises) {
        await expect(p).rejects.toThrow('Semaphore disposed');
      }

      // 再次 dispose 幂等
      expect(() => sem.dispose()).not.toThrow();
      expect(sem.getStats().isDisposed).toBe(true);
    });
  });

  describe('getStats Method', () => {
    it('should provide accurate statistics in various states', async () => {
      const sem = new Semaphore(3);

      // 初始状态
      expect(sem.getStats()).toEqual({
        availablePermits: 3,
        waitingQueueLength: 0,
        queueCapacity: 0,
        queueHead: 0,
        isDisposed: false,
      });

      // 消耗许可
      await sem.acquire();
      await sem.acquire();
      await sem.acquire();
      expect(sem.getStats().availablePermits).toBe(0);
      expect(sem.getStats().waitingQueueLength).toBe(0);

      // 添加等待任务
      const p1 = sem.acquire().catch(() => {});
      const p2 = sem.acquire().catch(() => {});
      await flushPromises();
      let stats = sem.getStats();
      expect(stats.waitingQueueLength).toBe(2);
      expect(stats.queueCapacity).toBe(2);

      // 混合中止任务
      const controller = new AbortController();
      sem.acquire(controller.signal).catch(() => {});
      await flushPromises();
      stats = sem.getStats();
      expect(stats.waitingQueueLength).toBe(3);
      expect(stats.queueCapacity).toBe(3);

      // 释放许可，让等待任务完成
      sem.release(3);
      await Promise.all([p1, p2]);

      // dispose 后
      sem.dispose();
      stats = sem.getStats();
      expect(stats.isDisposed).toBe(true);
      expect(stats.availablePermits).toBe(0);
      expect(stats.waitingQueueLength).toBe(0);
      expect(stats.queueCapacity).toBe(0);
    });
  });

  describe('Disposable Interface', () => {
    it('should implement Symbol.dispose and support using keyword idempotently', () => {
      const sem = new Semaphore(2);
      expect(typeof sem[Symbol.dispose]).toBe('function');

      {
        using _ = sem;
        expect(sem.getStats().isDisposed).toBe(false);
      }
      expect(sem.getStats().isDisposed).toBe(true);

      // 再次调用幂等
      expect(() => sem[Symbol.dispose]()).not.toThrow();
    });
  });

  describe('Dispose Idempotency', () => {
    it('should be idempotent and reject all operations after dispose', async () => {
      const sem = new Semaphore(3);
      sem.dispose();

      await expect(sem.acquire()).rejects.toThrow(UseAfterFreeError);
      expect(() => sem.release()).toThrow(UseAfterFreeError);
      expect(() => sem.tryAcquire()).toThrow(UseAfterFreeError);

      sem.dispose(); // 第二次 dispose

      await expect(sem.acquire()).rejects.toThrow(UseAfterFreeError);
      expect(() => sem.release()).toThrow(UseAfterFreeError);
      expect(() => sem.tryAcquire()).toThrow(UseAfterFreeError);

      // 带等待队列的场景
      const sem2 = new Semaphore(3);
      await sem2.acquire();
      await sem2.acquire();
      await sem2.acquire();
      const acquirePromise1 = sem2.acquire();
      const acquirePromise2 = sem2.acquire();
      await flushPromises();
      expect(sem2.getStats().waitingQueueLength).toBe(2);

      sem2.dispose();
      expect(sem2.getStats().isDisposed).toBe(true);
      expect(sem2.getStats().waitingQueueLength).toBe(0);

      await expect(acquirePromise1).rejects.toThrow('Semaphore disposed');
      await expect(acquirePromise2).rejects.toThrow('Semaphore disposed');

      sem2.dispose(); // 幂等
      expect(sem2.getStats().isDisposed).toBe(true);
    });
  });
});

// ========================================
// PermitGuard 测试
// ========================================
describe.concurrent('PermitGuard', () => {
  it('should acquire permit via tryAcquire and acquireAsync with abort support', async () => {
    const sem = new Semaphore(2);

    // tryAcquire 成功
    const guard = PermitGuard.acquire(sem);
    expect(sem.getStats().availablePermits).toBe(1);
    guard.release();
    expect(sem.getStats().availablePermits).toBe(2);

    // tryAcquire 失败
    sem.tryAcquire();
    sem.tryAcquire();
    expect(() => PermitGuard.acquire(sem)).toThrow(LockError);
    sem.release(2);

    // acquireAsync 成功
    const guard2 = await PermitGuard.acquireAsync(sem);
    expect(sem.getStats().availablePermits).toBe(1);
    guard2.release();

    // acquireAsync 带中止信号
    await sem.acquire();
    await sem.acquire(); // 消耗许可
    const controller = new AbortController();
    const acquirePromise = PermitGuard.acquireAsync(sem, controller.signal);
    controller.abort();
    await expect(acquirePromise).rejects.toThrow(DOMException);
    sem.release(2);

    sem.dispose();
  });

  it('should implement Symbol.dispose and support using, and be idempotent', () => {
    const sem = new Semaphore(2);

    // 验证 Symbol.dispose 存在
    const guard = PermitGuard.acquire(sem);
    expect(typeof guard[Symbol.dispose]).toBe('function');

    // using 块自动释放
    {
      using _g = PermitGuard.acquire(sem);
      expect(sem.getStats().availablePermits).toBe(0);
    }
    expect(sem.getStats().availablePermits).toBe(1);

    // 手动释放幂等
    guard.release();
    guard.release(); // 第二次不抛异常
    expect(sem.getStats().availablePermits).toBe(2);

    // 先 dispose 再 release
    const guard2 = PermitGuard.acquire(sem);
    guard2[Symbol.dispose]();
    guard2.release(); // 幂等
    expect(sem.getStats().availablePermits).toBe(2);

    sem.dispose();
  });

  it('should release permit and be idempotent', () => {
    const sem = new Semaphore(2);
    const guard = PermitGuard.acquire(sem);
    guard.release();
    expect(sem.getStats().availablePermits).toBe(2);
    guard.release(); // 第二次幂等
    expect(sem.getStats().availablePermits).toBe(2);

    // 在 dispose 后调用 release
    const guard2 = PermitGuard.acquire(sem);
    guard2[Symbol.dispose](); // 先 dispose
    guard2.release(); // 再 release
    expect(sem.getStats().availablePermits).toBe(2);

    sem.dispose();
  });
});

// ========================================
// DEBUG_SEMAPHORE 测试
// ========================================
describe.concurrent('DEBUG_SEMAPHORE', () => {
  it('should extend Semaphore and add timeout functionality', async () => {
    const debugSem = new DEBUG_SEMAPHORE(3, 50);

    // 继承 Semaphore 方法
    expect(debugSem).toBeInstanceOf(Semaphore);
    expect(typeof debugSem.acquire).toBe('function');
    expect(typeof debugSem.release).toBe('function');

    // 正常操作（无超时）
    await debugSem.acquire();
    expect(debugSem.getStats().availablePermits).toBe(2);
    debugSem.release();
    expect(debugSem.getStats().availablePermits).toBe(3);

    // 超时场景
    await debugSem.acquire();
    await debugSem.acquire();
    await debugSem.acquire(); // 消耗所有许可
    const timeoutPromise = debugSem.acquire();
    await expect(timeoutPromise).rejects.toThrow(LockError);
    debugSem.release(3); // 清理

    // 中止信号优先于超时
    await debugSem.acquire();
    await debugSem.acquire();
    await debugSem.acquire(); // 消耗所有许可
    const controller = new AbortController();
    const abortPromise = debugSem.acquire(controller.signal);
    controller.abort();
    await expect(abortPromise).rejects.toThrow(DOMException);
    debugSem.release(3);

    // Dispose 行为
    expect(typeof debugSem[Symbol.dispose]).toBe('function');
    debugSem.dispose();
    expect(debugSem.getStats().isDisposed).toBe(true);
    debugSem.dispose(); // 幂等
    expect(debugSem.getStats().isDisposed).toBe(true);
  });
});

// ========================================
// 并发场景测试
// ========================================
describe.concurrent('Concurrent Scenarios', () => {
  it('should maintain permit limits under high concurrency', async () => {
    const sem = new Semaphore(5);
    const concurrentTasks = 20;
    let activeCount = 0;
    let maxActiveCount = 0;
    const results: number[] = [];

    const tasks = Array.from({length: concurrentTasks}, (_) =>
      sem.withPermit(async () => {
        activeCount++;
        maxActiveCount = Math.max(maxActiveCount, activeCount);
        await flushPromises();
        results.push(activeCount);
        activeCount--;
      }),
    );

    await Promise.all(tasks);
    expect(maxActiveCount).toBeLessThanOrEqual(5);
    expect(results.length).toBe(concurrentTasks);
    sem.dispose();
  });

  it('should handle mixed sync/async operations correctly', async () => {
    const sem = new Semaphore(2);
    const operations: string[] = [];

    operations.push('sync_start');
    if (sem.tryAcquire()) {
      operations.push('sync_acquire_1');
      if (sem.tryAcquire()) {
        operations.push('sync_acquire_2');
        await flushPromises();
        sem.release(2);
        operations.push('sync_release_both');
      }
    }

    operations.push('async_start');
    await sem.withPermit(async () => {
      operations.push('async_acquire');
      await flushPromises();
      operations.push('async_work_done');
    });
    operations.push('async_complete');

    expect(operations).toEqual([
      'sync_start',
      'sync_acquire_1',
      'sync_acquire_2',
      'sync_release_both',
      'async_start',
      'async_acquire',
      'async_work_done',
      'async_complete',
    ]);

    sem.dispose();
  });

  it('should handle dispose during high concurrency', async () => {
    const sem = new Semaphore(3);
    const concurrentTasks = 10;
    const results: Array<'success' | 'disposed' | 'error'> = [];

    const tasks = Array.from({length: concurrentTasks}, () =>
      sem
        .acquire()
        .then(() => {
          results.push('success');
          sem.release();
        })
        .catch((e) => {
          if ((e as Error).message.includes('Semaphore disposed')) {
            results.push('disposed');
          } else {
            results.push('error');
          }
        }),
    );

    await flushPromises();
    sem.dispose();

    await Promise.all(tasks);
    expect(results.length).toBe(concurrentTasks);
    const successCount = results.filter((r) => r === 'success').length;
    const disposedCount = results.filter((r) => r === 'disposed').length;
    expect(successCount).toBeGreaterThanOrEqual(3);
    expect(disposedCount).toBeGreaterThanOrEqual(
      concurrentTasks - successCount,
    );

    sem.dispose(); // 幂等
  });

  it('should correctly handle release(count) with count > waiting tasks', async () => {
    const sem = new Semaphore(1);
    await sem.acquire(); // 消耗唯一许可

    const releases: (() => void)[] = [];
    const task1 = sem.acquire().then(() => {
      releases.push(() => sem.release());
    });
    const task2 = sem.acquire().then(() => {
      releases.push(() => sem.release());
    });

    await flushPromises();
    expect(sem.getStats().waitingQueueLength).toBe(2);

    // 释放3个许可：唤醒2个任务 + 累加1个许可
    sem.release(3);
    await flushPromises();

    // 此时2个任务已被唤醒但未释放许可，可用许可 = 1（累加）
    expect(sem.getStats().availablePermits).toBe(1);

    // 任务释放许可
    releases.forEach((fn) => fn());
    await Promise.all([task1, task2]);

    // 任务释放后，许可数 = 1 + 2 = 3
    expect(sem.getStats().availablePermits).toBe(3);

    sem.dispose();
  });
});

// ========================================
// 显式资源管理集成测试
// ========================================
describe.concurrent('Explicit Resource Management Integration', () => {
  it('should work with `using` for Semaphore, DEBUG_SEMAPHORE, and PermitGuard', () => {
    // Semaphore
    const sem = new Semaphore(2);
    {
      using _ = sem;
      expect(sem.isDisposed).toBe(false);
    }
    expect(sem.getStats().isDisposed).toBe(true);

    // DEBUG_SEMAPHORE
    const debugSem = new DEBUG_SEMAPHORE(2, 100);
    {
      using _ = debugSem;
      expect(debugSem.getStats().isDisposed).toBe(false);
    }
    expect(debugSem.getStats().isDisposed).toBe(true);

    // PermitGuard
    const sem2 = new Semaphore(2);
    {
      using _guard = PermitGuard.acquire(sem2);
      expect(sem2.getStats().availablePermits).toBe(1);
    }
    expect(sem2.getStats().availablePermits).toBe(2);
    sem2.dispose();
  });

  it('should handle binary semaphore (1 permit) like mutex', async () => {
    const binarySem = new Semaphore(1);
    const executionOrder: number[] = [];

    const tasks = [
      binarySem.withPermit(async () => {
        executionOrder.push(1);
        await flushPromises();
      }),
      binarySem.withPermit(async () => {
        executionOrder.push(2);
        await flushPromises();
      }),
      binarySem.withPermit(async () => {
        executionOrder.push(3);
        await flushPromises();
      }),
    ];

    await Promise.all(tasks);
    expect(executionOrder).toEqual([1, 2, 3]);
    binarySem.dispose();
  });
});
