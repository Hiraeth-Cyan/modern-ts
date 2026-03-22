// ========================================
// ./src/Concurrent/rwlock.spec.ts
// ========================================
import {describe, it, expect, vi} from 'vitest';
import {
  ReadWriteLock,
  ReadLockGuard,
  WriteLockGuard,
  DEBUG_RW_LOCK,
} from './rwlock';
import {UseAfterFreeError, RWLockError} from '../../Errors';
import {sleep} from '../delay';
import {flushPromises} from '../../helper';

describe.concurrent('ReadWriteLock', () => {
  describe('Basic Lock/Unlock Operations', () => {
    it('should allow multiple readers and exclusive writer', async () => {
      using rwLock = new ReadWriteLock();

      // 读锁重入：第一个读锁立即成功，后续读锁可并发
      await rwLock.readLock();
      await rwLock.readLock();
      await rwLock.readLock();
      let stats = rwLock.getStats();
      expect(stats.activeReaders).toBe(3);
      expect(stats.activeWriter).toBe(false);
      rwLock.unlock();
      rwLock.unlock();
      rwLock.unlock();

      // 写锁独占获取
      await rwLock.writeLock();
      stats = rwLock.getStats();
      expect(stats.activeReaders).toBe(0);
      expect(stats.activeWriter).toBe(true);
      rwLock.unlock();

      // 解锁未锁定锁应报错
      expect(() => rwLock.unlock()).toThrow(RWLockError);
    });

    it('should block write lock when readers are active', async () => {
      using rwLock = new ReadWriteLock();
      await rwLock.readLock();
      expect(rwLock.getStats().activeReaders).toBe(1);

      const writePromise = rwLock.writeLock().then(() => {
        expect(rwLock.getStats().activeWriter).toBe(true);
        rwLock.unlock();
      });

      await flushPromises();
      expect(rwLock.getStats().waitingWriters).toBe(1);

      rwLock.unlock(); // 释放读锁，唤醒写锁
      await writePromise;
    });

    it('should block read lock when writer is active', async () => {
      using rwLock = new ReadWriteLock();
      await rwLock.writeLock();
      expect(rwLock.getStats().activeWriter).toBe(true);

      const readPromise = rwLock.readLock().then(() => {
        expect(rwLock.getStats().activeReaders).toBe(1);
        rwLock.unlock();
      });

      await flushPromises();
      expect(rwLock.getStats().waitingReaders).toBe(1);

      rwLock.unlock(); // 释放写锁，唤醒读锁
      await readPromise;
    });
  });

  describe('Getter Properties', () => {
    it('should report isLocked correctly', async () => {
      using rwLock = new ReadWriteLock();
      expect(rwLock.isLocked).toBe(false);

      await rwLock.writeLock();
      expect(rwLock.isLocked).toBe(true);
      rwLock.unlock();

      await rwLock.readLock();
      expect(rwLock.isLocked).toBe(true);
      rwLock.unlock();
    });

    it('should report isWriteLocked correctly', async () => {
      using rwLock = new ReadWriteLock();
      expect(rwLock.isWriteLocked).toBe(false);

      await rwLock.writeLock();
      expect(rwLock.isWriteLocked).toBe(true);
      rwLock.unlock();

      await rwLock.readLock();
      expect(rwLock.isWriteLocked).toBe(false);
      rwLock.unlock();
    });

    it('should report readerCount correctly', async () => {
      using rwLock = new ReadWriteLock();
      expect(rwLock.readerCount).toBe(0);

      await rwLock.readLock();
      expect(rwLock.readerCount).toBe(1);
      await rwLock.readLock();
      expect(rwLock.readerCount).toBe(2);

      rwLock.unlock();
      expect(rwLock.readerCount).toBe(1);
      rwLock.unlock();
    });
  });

  describe('TryLock Operations', () => {
    it('should succeed with tryReadLock when free or other readers hold', async () => {
      using rwLock = new ReadWriteLock();

      // 空闲时成功
      expect(rwLock.tryReadLock()).toBe(true);
      expect(rwLock.getStats().activeReaders).toBe(1);
      rwLock.unlock();

      // 有其他读者时成功
      await rwLock.readLock();
      expect(rwLock.tryReadLock()).toBe(true);
      expect(rwLock.getStats().activeReaders).toBe(2);
      rwLock.unlock();
      rwLock.unlock();
    });

    it('should fail with tryReadLock when writer holds or writer waits', async () => {
      using rwLock = new ReadWriteLock();

      // 写锁持有时失败
      await rwLock.writeLock();
      expect(rwLock.tryReadLock()).toBe(false);
      rwLock.unlock();

      // 写锁在队列中等待时失败（公平性）
      await rwLock.readLock();
      const writerWaiter = rwLock.writeLock(); // 排队一个写锁
      await flushPromises();
      expect(rwLock.tryReadLock()).toBe(false);
      rwLock.unlock();
      await writerWaiter;
      rwLock.unlock();
    });

    it('should handle tryWriteLock in free/read-locked/write-locked states', async () => {
      using rwLock = new ReadWriteLock();

      // 空闲时成功
      expect(rwLock.tryWriteLock()).toBe(true);
      rwLock.unlock();

      // 有读者时失败
      await rwLock.readLock();
      expect(rwLock.tryWriteLock()).toBe(false);
      rwLock.unlock();

      // 有写者时失败
      await rwLock.writeLock();
      expect(rwLock.tryWriteLock()).toBe(false);
      rwLock.unlock();
    });
  });

  describe('Reader/Writer Fairness & Batching', () => {
    it('should wake up all consecutive readers at queue head', async () => {
      using rwLock = new ReadWriteLock();
      await rwLock.writeLock();

      const executionOrder: number[] = [];

      const r1 = rwLock.readLock().then(() => {
        executionOrder.push(1);
        rwLock.unlock();
      });
      const r2 = rwLock.readLock().then(() => {
        executionOrder.push(2);
        rwLock.unlock();
      });
      const r3 = rwLock.readLock().then(() => {
        executionOrder.push(3);
        rwLock.unlock();
      });

      await flushPromises();
      expect(rwLock.getStats().waitingReaders).toBe(3);

      rwLock.unlock();
      await Promise.all([r1, r2, r3]);
      expect(executionOrder.sort()).toEqual([1, 2, 3]);
    });

    it('should not wake up readers if a writer is ahead of them', async () => {
      using rwLock = new ReadWriteLock();
      await rwLock.writeLock();

      let readerRan = false;
      let writerRan = false;

      const w2 = rwLock.writeLock().then(() => {
        writerRan = true;
        expect(readerRan).toBe(false);
        rwLock.unlock();
      });
      const r1 = rwLock.readLock().then(() => {
        readerRan = true;
        expect(writerRan).toBe(true);
        rwLock.unlock();
      });

      await flushPromises();
      rwLock.unlock();
      await Promise.all([w2, r1]);
      expect(writerRan).toBe(true);
      expect(readerRan).toBe(true);
    });

    it('should stop reader batching if a writer is in the middle', async () => {
      using rwLock = new ReadWriteLock();
      await rwLock.writeLock();

      const results: string[] = [];

      const p1 = rwLock.readLock().then(() => {
        results.push('R1');
        rwLock.unlock();
      });
      const p2 = rwLock.readLock().then(() => {
        results.push('R2');
        rwLock.unlock();
      });
      const p3 = rwLock.writeLock().then(() => {
        results.push('W1');
        rwLock.unlock();
      });
      const p4 = rwLock.readLock().then(() => {
        results.push('R3');
        rwLock.unlock();
      });

      await flushPromises();
      rwLock.unlock();
      await Promise.all([p1, p2, p3, p4]);

      expect(results[0]).toBe('R1');
      expect(results[1]).toBe('R2');
      expect(results[2]).toBe('W1');
      expect(results[3]).toBe('R3');
    });
  });

  describe('AbortSignal Support', () => {
    it('should abort ongoing lock acquisitions', async () => {
      using rwLock = new ReadWriteLock();

      // 读锁中止
      await rwLock.writeLock();
      const ctrl1 = new AbortController();
      const readPromise = rwLock.readLock(ctrl1.signal);
      await flushPromises();
      ctrl1.abort();
      await expect(readPromise).rejects.toThrow(DOMException);
      rwLock.unlock();

      // 写锁中止
      await rwLock.readLock();
      const ctrl2 = new AbortController();
      const writePromise = rwLock.writeLock(ctrl2.signal);
      await flushPromises();
      ctrl2.abort();
      await expect(writePromise).rejects.toThrow(DOMException);
      rwLock.unlock();
    });

    it('should throw immediately if signal is already aborted', async () => {
      using rwLock = new ReadWriteLock();
      const ctrl = new AbortController();
      ctrl.abort();

      await expect(rwLock.readLock(ctrl.signal)).rejects.toThrow(
        'This operation was aborted',
      );
      await expect(rwLock.writeLock(ctrl.signal)).rejects.toThrow(
        'This operation was aborted',
      );
    });
  });

  describe('withReadLock and withWriteLock', () => {
    it('should execute read/write tasks and release lock', async () => {
      using rwLock = new ReadWriteLock();

      const readTask = vi.fn(() => 'read-result');
      const readResult = await rwLock.withReadLock(readTask);
      expect(readResult).toBe('read-result');
      expect(readTask).toHaveBeenCalledTimes(1);
      expect(rwLock.getStats().activeReaders).toBe(0);

      const writeTask = vi.fn(() => 'write-result');
      const writeResult = await rwLock.withWriteLock(writeTask);
      expect(writeResult).toBe('write-result');
      expect(writeTask).toHaveBeenCalledTimes(1);
      expect(rwLock.getStats().activeWriter).toBe(false);
    });

    it('should release write lock even if task throws', async () => {
      using rwLock = new ReadWriteLock();
      await expect(
        rwLock.withWriteLock(() => {
          throw new Error('Oops');
        }),
      ).rejects.toThrow('Oops');
      expect(rwLock.getStats().activeWriter).toBe(false);
    });
  });

  describe('Queue Compaction Mechanism', () => {
    it('should compact queue when head advances and waste ratio high', async () => {
      using rwLock = new ReadWriteLock();
      await rwLock.writeLock();

      // 排队 65 个读锁（使 head 前移）
      const readerPromises = Array.from({length: 65}, () =>
        rwLock.readLock().then(() => rwLock.unlock()),
      );
      // 排队一个写锁（用于触发 drainQueue 中的 compact）
      const writerPromise = rwLock.writeLock().then(() => rwLock.unlock());
      // 制造一个被中止的读锁，产生 null 条目
      const ac = new AbortController();
      const abortedReader = rwLock.readLock(ac.signal).catch(() => {});
      ac.abort();

      await flushPromises();
      rwLock.unlock(); // 触发处理

      await Promise.all([...readerPromises, writerPromise, abortedReader]);
      expect(rwLock.getStats().activeReaders).toBe(0);
      expect(rwLock.getStats().activeWriter).toBe(false);
    });

    it('should not compact when queue head below minimum or waste ratio low', async () => {
      using rwLock = new ReadWriteLock();

      // 场景1：队列头 < 64
      await rwLock.writeLock();
      const smallTasks = Array.from({length: 10}, () =>
        rwLock.readLock().then(() => rwLock.unlock()),
      );
      await flushPromises();
      rwLock.unlock();
      await Promise.all(smallTasks);
      expect(rwLock.getStats().queueLength).toBe(0);

      // 场景2：浪费率 ≤ 0.65（任务数 >64 但无 null）
      await rwLock.writeLock();
      const largeTasks = Array.from({length: 65}, () =>
        rwLock.readLock().then(() => rwLock.unlock()),
      );
      const writer = rwLock.writeLock().then(() => rwLock.unlock());
      await flushPromises();
      rwLock.unlock();
      await Promise.all([...largeTasks, writer]);
      expect(rwLock.getStats().queueLength).toBe(0);
    });

    it('should reset internal queue when fully drained and length > 1024', async () => {
      using rwLock = new ReadWriteLock();
      await rwLock.writeLock();

      const promises: Promise<void>[] = [];
      const TASK_COUNT = 1100;
      for (let i = 0; i < TASK_COUNT; i++) {
        promises.push(rwLock.readLock().then(() => rwLock.unlock()));
      }

      await flushPromises();
      rwLock.unlock();
      await Promise.all(promises);

      const stats = rwLock.getStats();
      expect(stats.activeReaders).toBe(0);
      expect(stats.queueLength).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should throw UseAfterFreeError when using disposed lock', async () => {
      using rwLock = new ReadWriteLock();
      rwLock.dispose();
      await expect(rwLock.readLock()).rejects.toThrow(UseAfterFreeError);
      await expect(rwLock.writeLock()).rejects.toThrow(UseAfterFreeError);
      expect(() => rwLock.unlock()).toThrow(UseAfterFreeError);
    });

    it('should reject pending tasks and ignore nulls on dispose', async () => {
      using rwLock = new ReadWriteLock();
      await rwLock.writeLock();

      const ac = new AbortController();
      rwLock.readLock(ac.signal).catch(() => {});
      ac.abort();

      const pWait = rwLock.readLock().catch((e: unknown) => e);

      await flushPromises();
      rwLock.dispose();

      const e2 = await pWait;
      expect((e2 as Error).message).toContain('disposed');
    });

    it('should handle task cleanup without abort handler', async () => {
      using rwLock = new ReadWriteLock();
      await rwLock.writeLock();

      const taskPromise = rwLock.readLock(); // 无 signal
      rwLock.unlock();

      await taskPromise;
      expect(rwLock.getStats().activeReaders).toBe(1);
      rwLock.unlock();
    });
  });

  describe('getStats Method', () => {
    it('should report correct counts including null entries', async () => {
      using rwLock = new ReadWriteLock();

      await rwLock.readLock();
      await rwLock.readLock();
      expect(rwLock.getStats().activeReaders).toBe(2);

      const w1 = rwLock.writeLock().catch(() => {});
      const r3 = rwLock.readLock().catch(() => {});
      await flushPromises();
      expect(rwLock.getStats().waitingWriters).toBe(1);
      expect(rwLock.getStats().waitingReaders).toBe(1);

      // 制造 null 条目
      const ac = new AbortController();
      const pAbort = rwLock.readLock(ac.signal).catch(() => {});
      ac.abort();
      await flushPromises();

      // getStats 应跳过 null，所以 waitingReaders 仍为 1
      expect(rwLock.getStats().waitingReaders).toBe(1);

      rwLock.unlock();
      rwLock.unlock();
      rwLock.unlock();
      await w1;
      await r3;
      await pAbort;
    });

    it('should return default empty stats when disposed', () => {
      using rwLock = new ReadWriteLock();
      rwLock.dispose();
      expect(rwLock.getStats()).toEqual({
        activeReaders: 0,
        activeWriter: false,
        isDisposed: true,
        waitingReaders: 0,
        waitingWriters: 0,
        queueLength: 0,
      });
    });
  });

  describe('Disposable Interface', () => {
    it('should support `using` and be idempotent', () => {
      let rwLock: ReadWriteLock;
      {
        using lock = new ReadWriteLock();
        rwLock = lock;
        expect(rwLock.isDisposed).toBe(false);
      }
      expect(rwLock!.isDisposed).toBe(true);
      expect(() => rwLock!.dispose()).not.toThrow();
    });
  });
});

describe.concurrent('ReadLockGuard', () => {
  it('should acquire asynchronously, support using, and release idempotently', async () => {
    using rwLock = new ReadWriteLock();

    // 异步获取
    const guard = await ReadLockGuard.acquire(rwLock);
    expect(rwLock.getStats().activeReaders).toBe(1);

    // 释放幂等
    guard.release();
    expect(() => guard.release()).not.toThrow();
    expect(rwLock.getStats().activeReaders).toBe(0);

    // using 自动释放
    {
      using _guard2 = await ReadLockGuard.acquire(rwLock);
      expect(rwLock.getStats().activeReaders).toBe(1);
    }
    expect(rwLock.getStats().activeReaders).toBe(0);
  });

  it('should handle tryAcquire success and failure', async () => {
    using rwLock = new ReadWriteLock();

    // 成功
    const guard1 = ReadLockGuard.tryAcquire(rwLock);
    expect(guard1).not.toBeNull();
    expect(rwLock.getStats().activeReaders).toBe(1);
    guard1!.release();

    // 失败（写锁持有）
    await rwLock.writeLock();
    const guard2 = ReadLockGuard.tryAcquire(rwLock);
    expect(guard2).toBeNull();
    rwLock.unlock();
  });
});

describe.concurrent('WriteLockGuard', () => {
  it('should acquire asynchronously, support using, and release idempotently', async () => {
    using rwLock = new ReadWriteLock();

    const guard = await WriteLockGuard.acquire(rwLock);
    expect(rwLock.getStats().activeWriter).toBe(true);

    guard.release();
    expect(() => guard.release()).not.toThrow();
    expect(rwLock.getStats().activeWriter).toBe(false);

    {
      using _guard2 = await WriteLockGuard.acquire(rwLock);
      expect(rwLock.getStats().activeWriter).toBe(true);
    }
    expect(rwLock.getStats().activeWriter).toBe(false);
  });

  it('should handle tryAcquire success and failure', async () => {
    using rwLock = new ReadWriteLock();

    const guard1 = WriteLockGuard.tryAcquire(rwLock);
    expect(guard1).not.toBeNull();
    expect(rwLock.getStats().activeWriter).toBe(true);
    guard1!.release();

    await rwLock.readLock();
    const guard2 = WriteLockGuard.tryAcquire(rwLock);
    expect(guard2).toBeNull();
    rwLock.unlock();
  });
});

describe.concurrent('DEBUG_RW_LOCK', () => {
  describe('Deadlock Detection & Abort Logic', () => {
    it('should timeout read/write and include stack, abort faster than timeout', async () => {
      using debugLock = new DEBUG_RW_LOCK(8); // 短超时

      // 读超时（写锁持有）
      await debugLock.writeLock();
      const readPromise = debugLock.readLock();
      await expect(readPromise).rejects.toThrow(RWLockError);
      await expect(readPromise).rejects.toThrow(/Active Readers/);
      debugLock.unlock();

      // 写超时（写锁持有）
      await debugLock.writeLock();
      const writePromise = debugLock.writeLock();
      await expect(writePromise).rejects.toThrow(RWLockError);
      await expect(writePromise).rejects.toThrow(/Writer Holder/);
      debugLock.unlock();

      // 堆栈信息检查
      await debugLock.writeLock();
      try {
        await debugLock.readLock();
        expect(true).toBe(false);
      } catch (e) {
        expect((e as Error).message).toContain('Request Location');
      }
      debugLock.unlock();

      // 中止优先于超时
      await debugLock.writeLock();
      const ctrl = new AbortController();
      const lockPromise = debugLock.readLock(ctrl.signal);
      ctrl.abort();
      await expect(lockPromise).rejects.toThrow(DOMException);
      debugLock.unlock();

      // 内部超时信号（无用户 signal）
      await debugLock.writeLock();
      await expect(debugLock.writeLock()).rejects.toThrow(RWLockError);
      debugLock.unlock();

      // combined_signal 逻辑：用户 signal 中止
      await debugLock.writeLock();
      const ctrl2 = new AbortController();
      const secondWrite = debugLock.writeLock(ctrl2.signal);
      ctrl2.abort();
      await expect(secondWrite).rejects.toThrow(DOMException);
      debugLock.unlock();
    });
  });

  describe('Internal State Management', () => {
    it('should manage reader stacks, unlock errors, and writer holder info', async () => {
      using debugLock = new DEBUG_RW_LOCK(8);

      // reader stacks
      await debugLock.readLock();
      expect(debugLock.readerCount).toBe(1);
      debugLock.unlock();
      expect(debugLock.readerCount).toBe(0);

      // 无锁时 unlock 报错
      expect(() => debugLock.unlock()).toThrow(RWLockError);

      // 写锁超时显示 "Writer Holder: None"（当读锁持有时）
      await debugLock.readLock();
      const writePromise = debugLock.writeLock();
      await expect(writePromise).rejects.toThrow(/Writer Holder: None/);
      debugLock.unlock();
    });
  });
});

describe.concurrent('Concurrent Scenarios', () => {
  it('should handle complex read/write interleaving correctly', async () => {
    using rw = new ReadWriteLock();
    const results: string[] = [];

    const readers = Array.from({length: 5}, (_, i) =>
      rw.withReadLock(async () => {
        results.push(`R${i}_start`);
        await sleep(Math.random() * 10);
        results.push(`R${i}_end`);
      }),
    );
    await Promise.all(readers);

    await rw.withWriteLock(async () => {
      results.push('W_start');
      await sleep(Math.random() * 10);
      results.push('W_end');
    });

    const readers2 = Array.from({length: 3}, (_, i) =>
      rw.withReadLock(async () => {
        results.push(`R2_${i}_start`);
        await sleep(Math.random() * 10);
        results.push(`R2_${i}_end`);
      }),
    );
    await Promise.all(readers2);

    const wIndex = results.indexOf('W_start');
    expect(wIndex).toBeGreaterThan(-1);
    for (let i = 0; i < 5; i++) {
      expect(results.indexOf(`R${i}_end`)).toBeLessThan(wIndex);
    }
    for (let i = 0; i < 3; i++) {
      expect(results.indexOf(`R2_${i}_start`)).toBeGreaterThan(
        results.indexOf('W_end'),
      );
    }
  });

  it('should handle rapid acquisition and release of locks', async () => {
    using rw = new ReadWriteLock();
    const iterations = 100;
    const results: number[] = [];

    const promises = Array.from({length: iterations}, (_, i) =>
      rw.withReadLock(async () => {
        await sleep(Math.random() * 10);
        results.push(i);
      }),
    );
    await Promise.all(promises);

    expect(results.length).toBe(iterations);
    expect(rw.getStats().activeReaders).toBe(0);
  });

  it('should maintain fairness with mixed read/write patterns', async () => {
    using rw = new ReadWriteLock();
    const executionOrder: string[] = [];

    const promises = [
      rw.withReadLock(() => executionOrder.push('R1')),
      rw.withReadLock(() => executionOrder.push('R2')),
      rw.withWriteLock(() => executionOrder.push('W1')),
      rw.withReadLock(() => executionOrder.push('R3')),
      rw.withWriteLock(() => executionOrder.push('W2')),
      rw.withReadLock(() => executionOrder.push('R4')),
      rw.withReadLock(() => executionOrder.push('R5')),
      rw.withWriteLock(() => executionOrder.push('W3')),
    ];
    await Promise.all(promises);

    expect(executionOrder).toHaveLength(8);
    expect(executionOrder).toContain('W1');
    expect(executionOrder).toContain('W2');
    expect(executionOrder).toContain('W3');
  });
});
