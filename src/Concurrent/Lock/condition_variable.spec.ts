// ========================================
// ./src/Concurrent/Lock/condition_variable.spec.ts
// ========================================

import {describe, it, expect, vi} from 'vitest';
import {
  ConditionVariable,
  DEBUG_CONDITION_VARIABLE,
  withCondition,
} from './condition_variable';
import {Mutex} from './mutex';
import {UseAfterFreeError, LockError} from '../../Errors';
import {flushPromises} from '../../helper';
import {sleep} from '../delay';

/**
 * ConditionVariable 单元测试套件
 * 测试条件变量的基本功能、错误处理、队列管理和销毁行为
 */
describe.concurrent('ConditionVariable', () => {
  /**
   * 基本等待/通知操作测试
   * 验证条件变量的核心功能：等待、释放锁、重新获取锁
   */
  describe('Basic Wait/Notify Operations', () => {
    // 测试条件变量在等待时释放锁，通知时重新获取锁的基本流程
    it('should release lock during wait and re-acquire it on notify', async () => {
      const mutex = new Mutex();
      const cond = new ConditionVariable();

      await mutex.lock();
      expect(mutex.getStats().isLocked).toBe(true);

      const waitPromise = cond.wait(mutex);
      await flushPromises(); // 确保等待操作开始执行
      expect(mutex.getStats().isLocked).toBe(false); // 等待时应释放锁

      cond.notifyOne(); // 通知一个等待者
      await waitPromise; // 等待完成

      expect(mutex.getStats().isLocked).toBe(true); // 重新获取锁
      mutex.unlock();
      mutex.dispose();
      cond.dispose();
    });

    // 测试多个等待者按 FIFO 顺序被唤醒
    it('should handle multiple waiters with notifyOne (FIFO)', async () => {
      const mutex = new Mutex();
      const cond = new ConditionVariable();
      const order: number[] = []; // 记录执行顺序

      const createWaiter = async (id: number): Promise<void> => {
        await mutex.lock();
        order.push(id); // 记录获取锁的顺序
        await cond.wait(mutex); // 进入等待
        order.push(id + 100); // 记录被唤醒的顺序
        mutex.unlock();
      };

      // 创建三个等待者
      const p1 = createWaiter(1);
      const p2 = createWaiter(2);
      const p3 = createWaiter(3);

      await flushPromises(); // 确保所有等待者都已开始等待
      expect(cond.getStats().waitingCount).toBe(3); // 三个等待者
      expect(order).toEqual([1, 2, 3]); // 获取锁的顺序应为 1,2,3

      // 通知第一个等待者
      cond.notifyOne();
      await flushPromises();
      expect(order).toContain(101); // 第一个等待者被唤醒
      expect(order).not.toContain(102); // 第二个等待者不应被唤醒
      expect(cond.getStats().waitingCount).toBe(2); // 还剩两个等待者

      // 通知所有剩余等待者
      cond.notifyAll();
      await Promise.all([p1, p2, p3]);
      expect(order).toEqual([1, 2, 3, 101, 102, 103]); // 完整的执行顺序

      mutex.dispose();
      cond.dispose();
    });

    // 测试 notifyAll 唤醒所有等待者
    it('should handle multiple waiters with notifyAll', async () => {
      const mutex = new Mutex();
      const cond = new ConditionVariable();
      let completed = 0; // 完成计数的等待者

      const waiter = async () => {
        await mutex.lock();
        await cond.wait(mutex);
        completed++;
        mutex.unlock();
      };

      const waiters = [waiter(), waiter(), waiter()];
      await flushPromises();
      expect(cond.getStats().waitingCount).toBe(3); // 三个等待者

      cond.notifyAll(); // 通知所有等待者
      await Promise.all(waiters);
      expect(completed).toBe(3); // 所有等待者都应完成

      mutex.dispose();
      cond.dispose();
    });

    // 合并测试：没有等待者时调用 notifyOne 和 notifyAll 不应抛出异常
    it('should handle notify operations safely when there are no waiters', () => {
      const cond = new ConditionVariable();
      expect(() => cond.notifyOne()).not.toThrow();
      expect(() => cond.notifyAll()).not.toThrow();
      expect(cond.getStats().waitingCount).toBe(0);
      cond.dispose();
    });

    /**
     * 测试 notifyAll 处理混合状态等待者（活跃+已中止）
     * 验证队列清理逻辑正确处理 null 条目
     */
    it('should handle mixed active and aborted waiters in notifyAll', async () => {
      const mutex = new Mutex();
      const cond = new ConditionVariable();
      const results: {id: number; status: string}[] = [];

      const createWaiter = async (
        id: number,
        abortSignal?: AbortSignal,
      ): Promise<void> => {
        try {
          await mutex.lock();
          await cond.wait(mutex, abortSignal);
          results.push({id, status: 'resolved'}); // 正常完成
        } catch (e) {
          results.push({id, status: 'rejected'}); // 被中止
        } finally {
          // 无论成功失败，都需要确保释放锁
          if (mutex.getStats().isLocked) mutex.unlock();
        }
      };

      const ac1 = new AbortController();
      const p1 = createWaiter(1, ac1.signal); // 将被中止的等待者
      const p2 = createWaiter(2); // 活跃等待者
      const p3 = createWaiter(3); // 活跃等待者

      await flushPromises();
      expect(cond.getStats().waitingCount).toBe(3);

      // 中止第一个等待者，使其在队列中变为 null
      ac1.abort();
      await flushPromises();
      expect(cond.getStats().waitingCount).toBe(2); // 活跃等待者减少

      // notifyAll 应能正确处理队列中的 null 条目
      cond.notifyAll();

      await Promise.all([p1, p2, p3]);

      // 验证结果：第一个被拒绝，后两个正常完成
      expect(results).toEqual([
        {id: 1, status: 'rejected'},
        {id: 2, status: 'resolved'},
        {id: 3, status: 'resolved'},
      ]);

      mutex.dispose();
      cond.dispose();
    });
  });

  /**
   * 中止信号支持测试
   * 验证条件变量与 AbortSignal 的集成
   */
  describe('Signal Support in wait()', () => {
    // 测试信号已经中止时立即抛出异常
    it('should throw if signal is already aborted', async () => {
      const mutex = new Mutex();
      const cond = new ConditionVariable();

      await mutex.lock();
      const controller = new AbortController();
      controller.abort(); // 立即中止信号

      await expect(cond.wait(mutex, controller.signal)).rejects.toThrow(
        DOMException,
      );
      expect(mutex.getStats().isLocked).toBe(true); // 锁应保持锁定状态
      mutex.unlock();

      mutex.dispose();
      cond.dispose();
    });

    // 合并测试：等待期间收到中止信号（包括开始后立即中止的情况）
    it('should abort wait and re-acquire lock when signaled during wait', async () => {
      const mutex = new Mutex();
      const cond = new ConditionVariable();

      await mutex.lock();
      const controller = new AbortController();

      const waitPromise = cond.wait(mutex, controller.signal);
      await flushPromises();
      expect(mutex.getStats().isLocked).toBe(false); // 等待时释放锁

      controller.abort(); // 中止等待

      await expect(waitPromise).rejects.toThrow(DOMException);
      expect(mutex.getStats().isLocked).toBe(true); // 重新获取锁
      mutex.unlock();

      mutex.dispose();
      cond.dispose();
    });
  });

  /**
   * 错误处理测试
   * 验证条件变量在异常情况下的行为
   */
  describe('Error Handling in wait()', () => {
    // 测试未持有锁时调用 wait 应抛出异常
    it('should throw LockError if mutex is not locked', async () => {
      const mutex = new Mutex();
      const cond = new ConditionVariable();

      expect(mutex.getStats().isLocked).toBe(false);
      await expect(cond.wait(mutex)).rejects.toThrow(LockError);
      await expect(cond.wait(mutex)).rejects.toThrow(
        'without holding the mutex lock',
      );

      mutex.dispose();
      cond.dispose();
    });

    // 测试等待成功但重新获取锁失败的情况
    it('should throw lock error if wait succeeds but re-lock fails', async () => {
      const cond = new ConditionVariable();
      // 创建模拟的互斥锁，重锁操作会失败
      const badLockMutex = {
        isLocked: true,
        lock: vi
          .fn()
          .mockResolvedValueOnce(undefined) // 第一次 lock 成功
          .mockRejectedValueOnce(new Error('Re-lock failed')), // 第二次 lock 失败
        unlock: vi.fn().mockResolvedValue(undefined),
        getStats: () => ({
          isLocked: true,
          isDisposed: false,
          waitingQueueLength: 0,
          queueCapacity: 0,
          queueHead: 0,
        }),
        dispose: vi.fn(),
      } as unknown as Mutex;

      await badLockMutex.lock();
      const waitPromise = cond.wait(badLockMutex);
      await flushPromises();

      cond.notifyOne(); // 通知等待者，触发重新获取锁
      await expect(waitPromise).rejects.toThrow('Re-lock failed');

      cond.dispose();
    });

    // 测试互斥锁解锁失败的情况
    it('should handle mutex unlock failure during wait (unlock error path)', async () => {
      const mutex = new Mutex();
      const cond = new ConditionVariable();

      await mutex.lock();

      // 模拟解锁失败
      const unlockSpy = vi.spyOn(mutex, 'unlock').mockImplementationOnce(() => {
        throw new Error('Simulated Unlock Failure');
      });

      await expect(cond.wait(mutex)).rejects.toThrow(
        'Simulated Unlock Failure',
      );

      expect(cond.getStats().waitingCount).toBe(0); // 不应有等待者

      unlockSpy.mockRestore(); // 恢复原始实现
      mutex.dispose();
      cond.dispose();
    });
  });

  /**
   * 队列管理测试
   * 验证条件变量的内部队列压缩和清理机制
   */
  describe('Queue Management', () => {
    // 测试当浪费比例超过阈值时自动压缩队列
    it('should compact queue when waste ratio exceeds threshold', async () => {
      const mutex = new Mutex();
      const cond = new ConditionVariable();
      const controllers: AbortController[] = [];
      const COUNT = 40;

      // 创建大量等待者
      for (let i = 0; i < COUNT; i++) {
        const ac = new AbortController();
        controllers.push(ac);
        void mutex
          .lock()
          .then(() => cond.wait(mutex, ac.signal).catch(() => {}));
      }

      await sleep(1); // 确保所有等待者都已开始

      // 中止大部分等待者（35个）
      for (let i = 0; i < 35; i++) {
        controllers[i].abort();
      }
      await flushPromises();

      expect(cond.getStats().waitingCount).toBe(5); // 还剩5个活跃等待者

      cond.notifyOne(); // 触发队列压缩

      const stats = cond.getStats();
      expect(stats.queueCapacity).toBeLessThanOrEqual(5); // 队列容量应减小
      expect(stats.queueHead).toBe(0); // 队列头部应重置

      cond.notifyAll(); // 清理剩余等待者

      mutex.dispose();
      cond.dispose();
    });

    // 测试队列清空时重置数组大小
    it('should reset large queue array when queue becomes empty via notifyOne', async () => {
      const mutex = new Mutex();
      const cond = new ConditionVariable();
      const controllers: AbortController[] = [];
      const LARGE_COUNT = 1030;

      // 创建大量等待者
      for (let i = 0; i < LARGE_COUNT; i++) {
        const ac = new AbortController();
        controllers.push(ac);
        void mutex
          .lock()
          .then(() => cond.wait(mutex, ac.signal).catch(() => {}));
      }

      await sleep(1); // 确保所有等待者都已开始

      // 中止所有等待者
      controllers.forEach((c) => c.abort());
      await flushPromises();

      expect(cond.getStats().queueCapacity).toBe(LARGE_COUNT); // 队列容量应为大值

      cond.notifyOne(); // 触发队列重置

      expect(cond.getStats().queueCapacity).toBe(0); // 队列容量应重置为0

      mutex.dispose();
      cond.dispose();
    });

    // 测试压缩队列时跳过尾部 null 条目的情况
    it('should skip null entries in the tail during compactQueue', async () => {
      const mutex = new Mutex();
      const cond = new ConditionVariable();
      const SIZE = 100;
      const waiters: Promise<void>[] = [];
      const controllers: AbortController[] = [];
      const activeIndex = 70;
      const nullAfterActive = 71;

      // 创建大量等待者
      for (let i = 0; i < SIZE; i++) {
        const ac = new AbortController();
        controllers.push(ac);

        const p = (async () => {
          try {
            await mutex.lock();
            try {
              await cond.wait(mutex, ac.signal);
            } finally {
              // 确保释放锁，避免死锁
              if (mutex.getStats().isLocked) mutex.unlock();
            }
          } catch (e) {
            // 忽略中止错误
          }
        })();
        waiters.push(p);
      }

      await flushPromises();

      // 中止特定索引的等待者
      for (let i = 0; i < SIZE; i++) {
        if (i < activeIndex || i === nullAfterActive) {
          controllers[i].abort();
        }
      }

      await flushPromises();

      // 验证等待者数量
      expect(cond.getStats().waitingCount).toBe(SIZE - 70 - 1);

      // 触发队列压缩
      cond.notifyOne();
      await flushPromises(); // 给被唤醒的等待者执行时间

      const stats = cond.getStats();
      // 验证压缩效果
      expect(stats.queueCapacity).toBe(28);
      expect(stats.queueHead).toBe(0);

      // 清理剩余等待者
      cond.notifyAll();
      await Promise.all(waiters);

      mutex.dispose();
      cond.dispose();
    });
  });

  /**
   * 销毁行为测试
   * 验证条件变量的销毁和资源清理
   */
  describe('Disposal', () => {
    // 测试销毁后 isDisposed 状态
    it('should set isDisposed to true', () => {
      const cond = new ConditionVariable();
      cond.dispose();
      expect(cond.isDisposed).toBe(true);
    });

    // 测试使用已销毁的条件变量应抛出异常
    it('should throw UseAfterFreeError when using disposed instance', async () => {
      const mutex = new Mutex();
      const cond = new ConditionVariable();

      cond.dispose();

      await mutex.lock();
      await expect(cond.wait(mutex)).rejects.toThrow(UseAfterFreeError);
      expect(() => cond.notifyOne()).toThrow(UseAfterFreeError);
      expect(() => cond.notifyAll()).toThrow(UseAfterFreeError);

      mutex.dispose();
    });

    // 测试销毁时拒绝所有挂起的等待者
    it('should reject all pending waiters on dispose', async () => {
      const mutex = new Mutex();
      const cond = new ConditionVariable();

      await mutex.lock();
      const p1 = cond.wait(mutex).catch((e: unknown) => e);
      const p2 = cond.wait(mutex).catch((e: unknown) => e);

      await flushPromises();
      expect(cond.getStats().waitingCount).toBe(1); // 等待队列中只有一个（其他在锁队列中）

      cond.dispose(); // 销毁条件变量

      const [e1, e2] = await Promise.all([p1, p2]);
      expect(e1).toBeInstanceOf(DOMException); // 第一个等待者收到 DOMException
      expect(e2).toBeInstanceOf(LockError); // 第二个等待者收到 LockError
      expect((e1 as DOMException).message).toContain('disposed');

      mutex.dispose();
    });

    // 测试销毁操作的幂等性
    it('should be idempotent', () => {
      const cond = new ConditionVariable();
      cond.dispose();
      expect(() => cond.dispose()).not.toThrow();
      expect(cond.isDisposed).toBe(true);
    });

    // 测试 Symbol.dispose 支持
    it('should support Symbol.dispose', () => {
      const cond = new ConditionVariable();
      expect(typeof cond[Symbol.dispose]).toBe('function');
      cond[Symbol.dispose]();
      expect(cond.isDisposed).toBe(true);
    });
  });

  /**
   * 统计信息测试
   * 验证 getStats 方法的正确性
   */
  describe('getStats', () => {
    // 测试初始统计信息
    it('should return correct initial stats', () => {
      const cond = new ConditionVariable();
      const stats = cond.getStats();
      expect(stats.waitingCount).toBe(0);
      expect(stats.queueCapacity).toBe(0);
      expect(stats.queueHead).toBe(0);
      expect(stats.isDisposed).toBe(false);
      cond.dispose();
    });

    // 测试销毁后的统计信息
    it('should return disposed stats', () => {
      const cond = new ConditionVariable();
      cond.dispose();
      const stats = cond.getStats();
      expect(stats.isDisposed).toBe(true);
      expect(stats.waitingCount).toBe(0);
    });

    // 测试活跃等待者计数
    it('should count active waiters', async () => {
      const mutex = new Mutex();
      const cond = new ConditionVariable();

      await mutex.lock();
      cond.wait(mutex).catch(() => {});
      cond.wait(mutex).catch(() => {});
      await flushPromises();

      // 等待队列中只有一个，另一个在锁队列中
      expect(cond.getStats().waitingCount).toBe(1);

      mutex.dispose();
      cond.dispose();
    });
  });
});

/**
 * 调试版条件变量测试
 * 验证 DEBUG_CONDITION_VARIABLE 的特殊功能
 */
describe.concurrent('DEBUG_CONDITION_VARIABLE', () => {
  // 测试继承关系
  it('should extend ConditionVariable', () => {
    const cond = new DEBUG_CONDITION_VARIABLE(10);
    expect(cond).toBeInstanceOf(ConditionVariable);
    cond.dispose();
  });

  // 测试超时功能
  it('should throw LockError on timeout', async () => {
    const mutex = new Mutex();
    const cond = new DEBUG_CONDITION_VARIABLE(10); // 10毫秒超时

    await mutex.lock();

    await expect(cond.wait(mutex)).rejects.toThrow(LockError);
    await expect(cond.wait(mutex)).rejects.toThrow('Timeout');

    // 验证错误消息包含堆栈跟踪信息
    try {
      await cond.wait(mutex);
    } catch (e) {
      expect((e as Error).message).toContain('Waiting at:');
      expect((e as Error).message).toContain('Last notify at:');
    }

    mutex.dispose();
    cond.dispose();
  });

  // 测试 notifyAll 时捕获堆栈跟踪
  it('should capture stack trace in notifyAll', async () => {
    const mutex = new Mutex();
    const cond = new DEBUG_CONDITION_VARIABLE(10);

    await mutex.lock();
    const p = cond.wait(mutex);
    await flushPromises();

    cond.notifyAll(); // 应捕获堆栈跟踪

    await p;
    mutex.unlock();

    mutex.dispose();
    cond.dispose();
  });

  // 测试超时前收到通知的情况
  it('should work normally if notified before timeout', async () => {
    const mutex = new Mutex();
    const cond = new DEBUG_CONDITION_VARIABLE(50);

    await mutex.lock();

    const p = cond.wait(mutex);
    await flushPromises();

    setTimeout(() => cond.notifyOne(), 10); // 3毫秒后通知

    await expect(p).resolves.toBeUndefined(); // 应正常完成
    expect(mutex.getStats().isLocked).toBe(true);
    mutex.unlock();

    mutex.dispose();
    cond.dispose();
  });

  // 测试用户中止优先于超时
  it('should prioritize user abort over timeout', async () => {
    const mutex = new Mutex();
    const cond = new DEBUG_CONDITION_VARIABLE(20);
    const controller = new AbortController();

    await mutex.lock();

    const p = cond.wait(mutex, controller.signal);
    await flushPromises();

    setTimeout(() => controller.abort(), 5); // 3毫秒后中止

    await expect(p).rejects.toThrow(DOMException); // 应被中止而不是超时
    mutex.unlock();

    mutex.dispose();
    cond.dispose();
  });
});

/**
 * withCondition 辅助函数测试
 * 验证条件等待模式的便捷函数
 */
describe.concurrent('withCondition helper', () => {
  // 测试条件初始为真时直接执行任务
  it('should execute task if predicate is initially true', async () => {
    const mutex = new Mutex();
    const cond = new ConditionVariable();

    const task = vi.fn().mockResolvedValue('done');
    const predicate = vi.fn().mockResolvedValue(true);

    const result = await withCondition<string>(mutex, cond, predicate, task);

    expect(result).toBe('done');
    expect(predicate).toHaveBeenCalledTimes(1); // 只调用一次谓词
    expect(task).toHaveBeenCalledTimes(1); // 执行一次任务

    mutex.dispose();
    cond.dispose();
  });

  // 测试条件初始为假时等待并重试
  it('should wait and retry if predicate is false', async () => {
    const mutex = new Mutex();
    const cond = new ConditionVariable();

    const predicate = vi.fn().mockReturnValueOnce(false).mockReturnValue(true);
    const task = vi.fn().mockResolvedValue('done');

    const p = withCondition<string>(mutex, cond, predicate, task);

    await sleep(10); // 等待一段时间

    cond.notifyOne(); // 通知以触发条件重检查

    const result = await p;
    expect(result).toBe('done');
    expect(predicate).toHaveBeenCalledTimes(2); // 调用两次谓词
    expect(task).toHaveBeenCalledTimes(1); // 执行一次任务

    mutex.dispose();
    cond.dispose();
  });

  // 测试任务抛出异常时仍能释放锁
  it('should unlock mutex even if task throws', async () => {
    const mutex = new Mutex();
    const cond = new ConditionVariable();

    const predicate = () => true;
    const task = () => {
      throw new Error('Task error');
    };

    await expect(withCondition(mutex, cond, predicate, task)).rejects.toThrow(
      'Task error',
    );
    expect(mutex.getStats().isLocked).toBe(false); // 确保锁已释放

    mutex.dispose();
    cond.dispose();
  });

  // 测试中止信号传播
  it('should propagate signal to lock and wait', async () => {
    const mutex = new Mutex();
    const cond = new ConditionVariable();

    const predicate = () => false;
    const task = vi.fn();
    const controller = new AbortController();

    const p = withCondition(mutex, cond, predicate, task, controller.signal);

    await flushPromises();
    controller.abort(); // 中止操作

    await expect(p).rejects.toThrow();
    expect(task).not.toHaveBeenCalled(); // 任务不应执行
    expect(mutex.getStats().isLocked).toBe(false); // 锁应已释放

    mutex.dispose();
    cond.dispose();
  });
});
