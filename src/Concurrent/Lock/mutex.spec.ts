// ========================================
// ./src/Concurrent/Lock/mutex.spec.ts
// ========================================
import {describe, it, expect, vi} from 'vitest';
import {Mutex, LockGuard, DEBUG_MUTEX} from './mutex';
import {UseAfterFreeError, MutexError} from '../../Errors';

import {sleep} from '../delay';
import {flushPromises} from '../../helper';

describe.concurrent('Mutex', () => {
  describe('Basic Lock/Unlock & State', () => {
    it('should handle tryLock, lock status, and sequential operations', async () => {
      const mutex = new Mutex();
      // tryLock 成功
      expect(mutex.tryLock()).toBe(true);
      expect(mutex.getStats().isLocked).toBe(true);
      // tryLock 失败
      expect(mutex.tryLock()).toBe(false);
      // 解锁
      mutex.unlock();
      expect(mutex.getStats().isLocked).toBe(false);
      // 顺序锁
      await mutex.lock();
      expect(mutex.getStats().isLocked).toBe(true);
      mutex.unlock();
      expect(mutex.getStats().isLocked).toBe(false);
      mutex.dispose();
    });

    it('should queue multiple lock requests in FIFO order', async () => {
      const mutex = new Mutex();
      const executionOrder: number[] = [];
      await mutex.lock(); // 先占住锁

      const task1 = mutex.lock().then(() => {
        executionOrder.push(1);
        mutex.unlock();
      });
      const task2 = mutex.lock().then(() => {
        executionOrder.push(2);
        mutex.unlock();
      });

      await flushPromises();
      expect(mutex.getStats().waitingQueueLength).toBe(2);

      mutex.unlock(); // 释放头锁
      await Promise.all([task1, task2]);

      expect(executionOrder).toEqual([1, 2]);
      mutex.dispose();
    });
  });

  describe('AbortSignal Support', () => {
    it('should handle abort signal (immediate and pending)', async () => {
      const mutex = new Mutex();
      // 立即中止
      const controller1 = new AbortController();
      controller1.abort();
      await expect(mutex.lock(controller1.signal)).rejects.toThrow(
        DOMException,
      );

      // 等待中中止
      await mutex.lock();
      const controller2 = new AbortController();
      const lockPromise = mutex.lock(controller2.signal);
      await flushPromises();
      expect(mutex.getStats().waitingQueueLength).toBe(1);
      controller2.abort();
      await expect(lockPromise).rejects.toThrow(DOMException);
      mutex.unlock();
      mutex.dispose();
    });

    it('should wait normally if no signal provided', async () => {
      const mutex = new Mutex();
      await mutex.lock();
      const lockPromise = mutex.lock(); // 无信号

      // 竞争：稍微等待后释放，确保它正常等待而不是超时
      const timeoutPromise = sleep(10).then(() => {
        throw new Error('Should not timeout');
      });
      mutex.unlock(); // 允许锁继续

      await expect(
        Promise.race([lockPromise, timeoutPromise]),
      ).resolves.toBeUndefined();
      mutex.dispose();
    });
  });

  describe('withLock Method', () => {
    it('should manage lock automatically and handle errors', async () => {
      const mutex = new Mutex();
      // 成功情况
      const result = await mutex.withLock(() => 'result');
      expect(result).toBe('result');
      expect(mutex.getStats().isLocked).toBe(false);

      // 错误情况
      const error = new Error('Task failed');
      await expect(
        mutex.withLock(() => {
          throw error;
        }),
      ).rejects.toThrow(error);
      expect(mutex.getStats().isLocked).toBe(false);
      mutex.dispose();
    });

    it('should support abort signal in withLock', async () => {
      const mutex = new Mutex();
      await mutex.lock();
      const controller = new AbortController();
      const task = vi.fn();
      const withLockPromise = mutex.withLock(task, controller.signal);
      controller.abort();
      await expect(withLockPromise).rejects.toThrow(DOMException);
      expect(task).not.toHaveBeenCalled();
      mutex.unlock();
      mutex.dispose();
    });
  });

  describe('Queue Compaction & Stats', () => {
    it('should provide accurate statistics throughout lifecycle', async () => {
      const mutex = new Mutex();
      // 初始状态
      expect(mutex.getStats()).toMatchObject({
        isLocked: false,
        waitingQueueLength: 0,
        queueCapacity: 0,
      });
      // 锁定状态
      await mutex.lock();
      expect(mutex.getStats().isLocked).toBe(true);
      // 等待状态
      const p1 = mutex.lock();
      const p2 = mutex.lock();
      await flushPromises();
      expect(mutex.getStats()).toMatchObject({
        waitingQueueLength: 2,
        queueCapacity: 2,
      });
      // 销毁状态
      mutex.dispose();
      expect(mutex.getStats()).toMatchObject({
        isDisposed: true,
        waitingQueueLength: 0,
        queueCapacity: 0,
      });
      await Promise.allSettled([p1, p2]);
    });

    // 新增测试：覆盖 getStats 循环中的 else 逻辑（统计非 null 任务）
    it('should accurately count active tasks ignoring null slots in getStats', async () => {
      const mutex = new Mutex();
      await mutex.lock(); // 占用锁

      const c1 = new AbortController();
      const c2 = new AbortController();
      const c3 = new AbortController();

      // 排队三个任务
      const p1 = mutex.lock(c1.signal).catch(() => {});
      const p2 = mutex.lock(c2.signal).catch(() => {});
      const p3 = mutex.lock(c3.signal).catch(() => {});

      await flushPromises();
      expect(mutex.getStats().waitingQueueLength).toBe(3);

      // 中间取消一个，制造队列中的 null 洞
      c2.abort();
      await flushPromises();

      // 验证统计：队列长度应为 2（忽略 null）
      const stats = mutex.getStats();
      expect(stats.waitingQueueLength).toBe(2);

      // 再取消一个
      c1.abort();
      await flushPromises();
      expect(mutex.getStats().waitingQueueLength).toBe(1);

      // 清理
      mutex.dispose();
      await Promise.allSettled([p1, p2, p3]);
    });

    it('should handle empty queue efficiently', () => {
      const mutex = new Mutex();
      expect(mutex.getStats().queueCapacity).toBe(0);
      expect(mutex.tryLock()).toBe(true);
      mutex.unlock(); // 触发潜在的压缩/清理
      expect(mutex.getStats().waitingQueueLength).toBe(0);
      mutex.dispose();
    });

    it('should correctly handle multiple holes during unlock', async () => {
      const mutex = new Mutex();
      await mutex.lock();
      const controllers = Array.from(
        {length: 100},
        () => new AbortController(),
      );
      const waiters = controllers.map((c) =>
        mutex.lock(c.signal).catch(() => {}),
      );

      await flushPromises();
      // 中止 0-69 和 80
      controllers.slice(0, 70).forEach((c) => c.abort());
      controllers[80].abort();
      await flushPromises();

      mutex.unlock(); // 应跳过 null 并处理压缩
      await flushPromises();

      expect(mutex.getStats().isLocked).toBe(true);
      expect(mutex.getStats().waitingQueueLength).toBe(28); // 100 - 70 - 1 - 1(acquired)

      // 清理剩余
      while (mutex.getStats().isLocked) mutex.unlock();
      await Promise.allSettled(waiters);
      expect(mutex.getStats().waitingQueueLength).toBe(0);
      mutex.dispose();
    });

    it('should deallocate large queue on unlock if queue is mostly empty/aborted', async () => {
      const mutex = new Mutex();
      await mutex.lock();
      const controllers = Array.from(
        {length: 1100},
        () => new AbortController(),
      );
      void controllers.map((c) => mutex.lock(c.signal).catch(() => {}));
      await flushPromises();

      expect(mutex.getStats().queueCapacity).toBeGreaterThanOrEqual(1100);
      controllers.forEach((c) => c.abort()); // 全部变为 null
      await flushPromises();

      mutex.unlock(); // 应发现巨大空队列并重置
      expect(mutex.getStats().queueCapacity).toBe(0);
      mutex.dispose();
    });
  });

  describe('Error Handling & Disposal', () => {
    it('should throw MutexError when unlocking unlocked mutex', () => {
      const mutex = new Mutex();
      expect(() => mutex.unlock()).toThrow(MutexError);
      mutex.dispose();
    });

    it('should be idempotent and reject operations after dispose', async () => {
      const mutex = new Mutex();
      mutex.dispose();
      expect(mutex.getStats().isDisposed).toBe(true);

      // 幂等性
      expect(() => mutex.dispose()).not.toThrow();

      // 拒绝操作
      await expect(mutex.lock()).rejects.toThrow(UseAfterFreeError);
      expect(() => mutex.tryLock()).toThrow(UseAfterFreeError);
      expect(() => mutex.unlock()).toThrow(UseAfterFreeError);
    });

    it('should reject pending locks and clean up when disposed', async () => {
      const mutex = new Mutex();
      await mutex.lock();
      const p1 = mutex.lock();
      const p2 = mutex.lock();

      await flushPromises();
      expect(mutex.getStats().waitingQueueLength).toBe(2);

      mutex.dispose(); // 应拒绝等待者

      await expect(p1).rejects.toThrow('Mutex disposed');
      await expect(p2).rejects.toThrow('Mutex disposed');
      expect(mutex.getStats()).toMatchObject({
        isDisposed: true,
        waitingQueueLength: 0,
        isLocked: false,
      });
    });

    it('should skip null slots in queue during dispose', async () => {
      const mutex = new Mutex();
      await mutex.lock();
      const c1 = new AbortController();
      const c2 = new AbortController();

      const p1 = mutex.lock(c1.signal).catch((e: unknown) => e);
      const p2 = mutex.lock(c2.signal).catch((e: unknown) => e);

      await flushPromises();
      c1.abort(); // 制造洞
      await flushPromises();

      mutex.dispose();

      const [r1, r2] = await Promise.all([p1, p2]);
      expect((r1 as Error).name).toBe('AbortError');
      expect((r2 as Error).message).toContain('Mutex disposed');
      mutex.dispose();
    });
  });

  describe('Disposable Interface', () => {
    it('should support `using` keyword and Symbol.dispose', () => {
      const localMutex = new Mutex();
      expect(localMutex.getStats().isDisposed).toBe(false);
      {
        using _ = localMutex;
        expect(localMutex.getStats().isDisposed).toBe(false);
      }
      expect(localMutex.getStats().isDisposed).toBe(true);
      // 幂等性
      expect(() => localMutex[Symbol.dispose]()).not.toThrow();
    });
  });
});

describe.concurrent('LockGuard', () => {
  describe('Acquisition', () => {
    it('should acquire lock via tryLock and acquireAsync', async () => {
      const mutex = new Mutex();
      // tryLock 成功
      const guard = LockGuard.acquire(mutex);
      expect(mutex.getStats().isLocked).toBe(true);
      guard.release();
      expect(mutex.getStats().isLocked).toBe(false);
      // tryLock 失败
      mutex.tryLock();
      expect(() => LockGuard.acquire(mutex)).toThrow(MutexError);
      mutex.unlock();
      // acquireAsync
      const asyncGuard = await LockGuard.acquireAsync(mutex);
      expect(mutex.getStats().isLocked).toBe(true);
      asyncGuard.release();
      mutex.dispose();
    });

    it('should support abort signal in acquireAsync', async () => {
      const mutex = new Mutex();
      await mutex.lock();
      const controller = new AbortController();
      const promise = LockGuard.acquireAsync(mutex, controller.signal);
      controller.abort();
      await expect(promise).rejects.toThrow(DOMException);
      mutex.unlock();
      mutex.dispose();
    });
  });

  describe('Release & Disposable', () => {
    it('should support `using` and be idempotent on release', () => {
      const mutex = new Mutex();
      {
        using guard = LockGuard.acquire(mutex);
        expect(mutex.getStats().isLocked).toBe(true);
        // 手动释放 inside using
        guard.release();
        expect(mutex.getStats().isLocked).toBe(false);
      } // 这里调用 disposer
      expect(mutex.getStats().isLocked).toBe(false);

      // 再次手动释放
      const guard2 = LockGuard.acquire(mutex);
      guard2.release();
      guard2.release(); // 幂等
      expect(mutex.getStats().isLocked).toBe(false);
      mutex.dispose();
    });
  });
});

describe.concurrent('DEBUG_MUTEX', () => {
  describe('Deadlock Detection', () => {
    it('should throw MutexError with stack trace on timeout', async () => {
      const debugMutex = new DEBUG_MUTEX(10);
      await debugMutex.lock();
      // 触发超时
      await expect(debugMutex.lock()).rejects.toThrow(
        /Mutex Deadlock\/Timeout/,
      );
      await expect(debugMutex.lock()).rejects.toThrow(
        /Current Request Location/,
      );
      debugMutex.unlock();
      debugMutex.dispose();
    });

    it('should report Unknown holder if lock acquired via tryLock', async () => {
      const debugMutex = new DEBUG_MUTEX(10);
      expect(debugMutex.tryLock()).toBe(true);
      // tryLock 不捕获栈，持有者为 Unknown
      await expect(debugMutex.lock()).rejects.toThrow(/Holder stack: Unknown/);
      debugMutex.unlock();
      debugMutex.dispose();
    });

    it('should support abort signal alongside timeout', async () => {
      const debugMutex = new DEBUG_MUTEX(10);
      await debugMutex.lock();
      const controller = new AbortController();
      const promise = debugMutex.lock(controller.signal);
      controller.abort(); // 中止应先于超时发生
      await expect(promise).rejects.toThrow(DOMException);
      debugMutex.unlock();
      debugMutex.dispose();
    });
  });

  describe('Owner Stack & Disposal', () => {
    it('should track and clear owner stack correctly', async () => {
      const debugMutex = new DEBUG_MUTEX(10);
      await debugMutex.lock();
      expect(debugMutex.tryLock()).toBe(false); // 已锁定
      debugMutex.unlock();
      expect(debugMutex.tryLock()).toBe(true); // 已解锁
      debugMutex.unlock();
      debugMutex.dispose();
    });

    it('should handle dispose and Symbol.dispose idempotently', async () => {
      const debugMutex = new DEBUG_MUTEX(10);
      await debugMutex.lock();
      debugMutex[Symbol.dispose](); // 锁定状态下销毁
      expect(debugMutex.getStats()).toMatchObject({
        isDisposed: true,
        isLocked: false,
      });

      // 幂等性
      debugMutex.dispose();
      expect(debugMutex.getStats().isDisposed).toBe(true);
      debugMutex[Symbol.dispose]();
      expect(debugMutex.getStats().isDisposed).toBe(true);
    });

    it('should support `using` keyword', () => {
      const localDebugMutex = new DEBUG_MUTEX(50);
      {
        using _ = localDebugMutex;
        expect(localDebugMutex.getStats().isDisposed).toBe(false);
      }
      expect(localDebugMutex.getStats().isDisposed).toBe(true);
    });
  });
});

// 并发场景测试
describe.concurrent('Concurrent Scenarios', () => {
  it('should guarantee FIFO order and mutual exclusion', async () => {
    const mutex = new Mutex();
    let counter = 0;
    const results: number[] = [];
    const tasks = Array.from({length: 10}, (_) =>
      mutex.withLock(async () => {
        const current = counter;
        await sleep(Math.random() * 5);
        counter = current + 1;
        results.push(counter);
      }),
    );
    await Promise.all(tasks);
    expect(results).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    mutex.dispose();
  });

  it('should handle mixed sync/async operations', async () => {
    const mutex = new Mutex();
    const ops: string[] = [];
    // 同步操作
    if (mutex.tryLock()) {
      ops.push('sync_lock');
      mutex.unlock();
    }
    // 异步操作
    await mutex.withLock(async () => {
      ops.push('async_lock');
      await sleep(0);
    });
    expect(ops).toEqual(['sync_lock', 'async_lock']);
    mutex.dispose();
  });

  it('should handle dispose during high concurrency', async () => {
    const mutex = new Mutex();
    const results: string[] = [];
    const tasks = Array.from({length: 10}, () =>
      mutex
        .lock()
        .then(() => {
          results.push('success');
          mutex.unlock();
        })
        .catch(() => results.push('disposed')),
    );
    await flushPromises();
    mutex.dispose();
    await Promise.allSettled(tasks);
    expect(results.length).toBe(10); // 所有任务都应有结果
    mutex.dispose();
  });
});

describe.concurrent('Explicit Resource Management Integration', () => {
  it('should work with `using` for Mutex', () => {
    const m = new Mutex();
    {
      using _ = m;
      expect(m.getStats().isDisposed).toBe(false);
    }
    expect(m.getStats().isDisposed).toBe(true);
  });

  it('should work with `using` for DEBUG_MUTEX', () => {
    const m = new DEBUG_MUTEX(100);
    {
      using _ = m;
      expect(m.getStats().isDisposed).toBe(false);
    }
    expect(m.isDisposed).toBe(true);
  });

  it('should automatically release lock when LockGuard is used with `using`', () => {
    const mutex = new Mutex();
    {
      using _guard = LockGuard.acquire(mutex);
      expect(mutex.getStats().isLocked).toBe(true);
    }
    expect(mutex.isLocked).toBe(false);
    mutex.dispose();
  });
});
