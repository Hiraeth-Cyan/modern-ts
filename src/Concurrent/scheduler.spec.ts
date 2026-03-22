// ========================================
// ./src/Concurrent/scheduler.spec.ts
// ========================================
import {describe, it, expect, vi} from 'vitest';
import {Scheduler} from './scheduler';
import {ParameterError} from '../Errors';
import {flushPromises} from '../helper';
import {sleep} from './delay';

describe.concurrent('Scheduler', () => {
  it('should initialize with correct concurrency and stats', () => {
    const scheduler = new Scheduler(3);
    expect(scheduler.stats.concurrency).toBe(3);
    expect(scheduler.stats.active).toBe(0);
    expect(scheduler.stats.pending).toBe(0);
    expect(scheduler.stats.isPaused).toBe(false);
  });

  it('should validate concurrency parameter', () => {
    // 无效参数应抛出 ParameterError
    expect(() => new Scheduler(-1)).toThrow(ParameterError);
    expect(() => new Scheduler(NaN)).toThrow(ParameterError);
    // 有效参数应正常创建
    expect(() => new Scheduler(1)).not.toThrow();
    expect(() => new Scheduler(0)).not.toThrow();
  });

  it('should hold nice Nan', () => {
    expect(() => new Scheduler(1).add(() => {}, {nice: NaN})).not.toThrow();
  });

  it('should execute synchronous tasks immediately', async () => {
    const scheduler = new Scheduler(3);
    const result = await scheduler.add(() => 42);
    expect(result).toBe(42);
    expect(scheduler.stats.active).toBe(0);
  });

  it('should execute asynchronous tasks and return results', async () => {
    const scheduler = new Scheduler(3);
    const result = await scheduler.add(async () => {
      await sleep(1);
      return 'async-result';
    });
    expect(result).toBe('async-result');
  });

  it('should handle task execution errors', async () => {
    const scheduler = new Scheduler(1);
    const error = new Error('Task failed');
    await expect(scheduler.add(() => Promise.reject(error))).rejects.toThrow(
      error,
    );
  });

  it('should enforce concurrency limit', async () => {
    const scheduler = new Scheduler(2);
    const order: string[] = [];
    const release: Array<() => void> = [];

    // 占满两个槽位
    for (let i = 0; i < 2; i++) {
      void scheduler.add(() => new Promise<void>((r) => release.push(r)));
    }
    await flushPromises();
    expect(scheduler.stats.active).toBe(2);

    // 添加排队任务
    void scheduler.add(() => order.push('queued'));
    await flushPromises();
    expect(scheduler.stats.pending).toBe(1);

    // 释放一个槽位
    release[0]();
    await flushPromises();
    await flushPromises();

    expect(scheduler.stats.active).toBe(1);
    expect(order).toContain('queued');

    // 清理
    release[1]();
    await flushPromises();
    expect(scheduler.stats.active).toBe(0);
  });

  it('should update active count correctly during task lifecycle', async () => {
    const scheduler = new Scheduler(1);
    let resolveTask: () => void;

    const promise = scheduler.add(
      () => new Promise<void>((r) => (resolveTask = r)),
    );
    await flushPromises();
    expect(scheduler.stats.active).toBe(1);

    resolveTask!();
    await promise;
    expect(scheduler.stats.active).toBe(0);
  });

  it('should prioritize tasks with lower nice values', async () => {
    const scheduler = new Scheduler(1);
    const executionOrder: string[] = [];
    let releaseBlocker: () => void;

    void scheduler.add(() => new Promise<void>((r) => (releaseBlocker = r)));
    await flushPromises();

    void scheduler.add(() => executionOrder.push('normal'), {nice: 0});
    void scheduler.add(() => executionOrder.push('high'), {nice: -10});
    void scheduler.add(() => executionOrder.push('low'), {nice: 10});

    expect(scheduler.stats.pending).toBe(3);

    releaseBlocker!();
    await scheduler.onIdle();

    expect(executionOrder).toEqual(['high', 'normal', 'low']);
  });

  it('should penalize non-guaranteed tasks (background tasks)', async () => {
    const scheduler = new Scheduler(1);
    const executionOrder: string[] = [];
    let releaseBlocker: () => void;

    void scheduler.add(() => new Promise<void>((r) => (releaseBlocker = r)));
    await flushPromises();

    void scheduler.add(() => executionOrder.push('background'), {
      nice: 0,
      guaranteed: false,
    });
    void scheduler.add(() => executionOrder.push('normal'), {
      nice: 0,
      guaranteed: true,
    });

    releaseBlocker!();
    await scheduler.onIdle();

    expect(executionOrder).toEqual(['normal', 'background']);
  });

  it('should increase concurrency and process queue', async () => {
    const scheduler = new Scheduler(1);
    const results: number[] = [];
    let release: () => void;

    void scheduler.add(() => new Promise<void>((r) => (release = r)));
    await flushPromises();

    const tasks = Array.from({length: 3}, (_, i) =>
      scheduler.add(() => results.push(i)),
    );
    await flushPromises();
    expect(scheduler.stats.pending).toBe(3);

    scheduler.resetLimits(4);
    release!(); // 释放阻塞

    await Promise.all(tasks);
    expect(scheduler.stats.active).toBe(0);
    expect(results.length).toBe(3);
  });

  it('should decrease concurrency without affecting running tasks', async () => {
    const scheduler = new Scheduler(5);
    const release: Array<() => void> = [];

    for (let i = 0; i < 5; i++) {
      void scheduler.add(() => new Promise<void>((r) => release.push(r)));
    }
    await flushPromises();
    expect(scheduler.stats.active).toBe(5);

    scheduler.resetLimits(1);
    expect(scheduler.stats.active).toBe(5); // 正在运行的任务不受影响
    expect(scheduler.stats.concurrency).toBe(1);

    release.forEach((r) => r());
    await flushPromises();
    expect(scheduler.stats.active).toBe(0);
  });

  it('should validate concurrency parameter in resetLimits', () => {
    const scheduler = new Scheduler(1);
    expect(() => scheduler.resetLimits(-1)).toThrow(ParameterError);
    expect(() => scheduler.resetLimits(NaN)).toThrow(ParameterError);
  });

  it('should reject immediately if signal is already aborted', async () => {
    const scheduler = new Scheduler(3);
    const controller = new AbortController();
    controller.abort();

    await expect(
      scheduler.add(() => {}, {signal: controller.signal}),
    ).rejects.toThrow(DOMException);
  });

  it('should abort queued tasks', async () => {
    const scheduler = new Scheduler(1);
    const controller = new AbortController();
    let release: () => void;

    void scheduler.add(() => new Promise<void>((r) => (release = r))); // 阻塞任务
    await flushPromises();

    const task = scheduler.add(() => 'never runs', {signal: controller.signal});
    await flushPromises();
    expect(scheduler.stats.pending).toBe(1);

    controller.abort();

    await expect(task).rejects.toThrow(DOMException);
    expect(scheduler.stats.pending).toBe(0);
    release!();
  });

  it('should reject running task when aborted', async () => {
    const scheduler = new Scheduler(1);
    const controller = new AbortController();

    const task = scheduler.add(
      async () => {
        await sleep(100); // 保持运行状态
      },
      {signal: controller.signal},
    );

    await flushPromises();
    expect(scheduler.stats.active).toBe(1);

    controller.abort();
    await expect(task).rejects.toThrow(DOMException);
  });

  // 修改此测试以稳定覆盖 pause 内的 heap_idx 分支
  it('should handle abort during cooperative pause', async () => {
    const scheduler = new Scheduler(1);
    const controller = new AbortController();

    // 用于同步等待任务进入暂停状态
    let pauseStarted: () => void;
    const pauseStartedPromise = new Promise<void>((r) => (pauseStarted = r));

    const task = scheduler.add(
      async (_, pause) => {
        scheduler.resetLimits(0); // 阻止 next() 弹出任务
        pauseStarted(); // 标记已进入任务逻辑
        await pause(); // 在此处挂起，此时 heap_idx 有效
      },
      {signal: controller.signal},
    );

    // 等待任务执行到 pause 调用之前
    await pauseStartedPromise;
    // 稍作等待确保任务完全挂起并推入堆中
    await flushPromises();

    // 此时任务在堆中 (heap_idx !== INVALID_HEAP_INDEX)，触发目标分支
    controller.abort();

    await expect(task).rejects.toThrow(DOMException);
    expect(scheduler.stats.pending).toBe(0);
  });

  it('should handle abort signal triggered before cooperative pause', async () => {
    const scheduler = new Scheduler(1);
    const controller = new AbortController();

    const task = scheduler.add(
      async (_, pause) => {
        controller.abort(); // 在 pause 调用前触发 abort
        await pause(); // 此时应直接抛出异常
      },
      {signal: controller.signal},
    );

    await expect(task).rejects.toThrow(DOMException);
  });

  it('should trigger heap bubble-down right child selection on abort', async () => {
    const scheduler = new Scheduler(1);
    const controller = new AbortController();
    let release: () => void;

    void scheduler.add(() => new Promise<void>((r) => (release = r)));
    await flushPromises();

    // 构建特定堆结构以触发 bubbleDown 选中右子节点
    void scheduler.add(() => {}, {nice: -20}); // Top
    const targetTask = scheduler.add(() => {}, {
      nice: -10,
      signal: controller.signal,
    }); // Target
    void scheduler.add(() => {}, {nice: 10}); // Branch
    void scheduler.add(() => {}, {nice: 5}); // Medium
    void scheduler.add(() => {}, {nice: 0}); // Small
    void scheduler.add(() => {}, {nice: 19}); // Big

    controller.abort();
    await expect(targetTask).rejects.toThrow(DOMException);

    release!();
    await scheduler.onIdle();
  });

  it('should yield control back to scheduler when paused', async () => {
    const scheduler = new Scheduler(1);
    const log: string[] = [];

    const task1 = scheduler.add(async (_, pause) => {
      log.push('t1-start');
      await pause();
      log.push('t1-resume');
    });

    const task2 = scheduler.add(() => {
      log.push('t2-start');
    });

    await Promise.all([task1, task2]);

    expect(log).toContain('t1-start');
    expect(log).toContain('t1-resume');
    expect(log).toContain('t2-start');
  });

  // 新增测试：覆盖 scheduleExecution 的 else 分支 (宏任务调度)
  it('should use macrotask scheduling when time since yield exceeds threshold', async () => {
    const scheduler = new Scheduler(1);
    const now = performance.now();
    const spy = vi.spyOn(performance, 'now');

    // 调用顺序:
    // 1. Scheduler 构造函数 -> now
    // 2. add 内部 advanceTime -> now (elapsed=0, safe)
    // 3. next 内部 advanceTime -> now (elapsed=0, safe)
    // 4. scheduleExecution -> now + 6 (触发 time_since_yield >= 5 的 else 分支)

    spy
      .mockReturnValueOnce(now) // 1
      .mockReturnValueOnce(now) // 2
      .mockReturnValueOnce(now) // 3
      .mockReturnValueOnce(now + 6); // 4

    const result = await scheduler.add(() => 'macro-task');
    expect(result).toBe('macro-task');

    spy.mockRestore();
  });

  it('should bubble up in removeFromHeap when last node is smaller than parent', async () => {
    const scheduler = new Scheduler(1);
    const order: string[] = [];
    let releaseBlocker: () => void;

    // 阻塞执行以构建堆
    void scheduler.add(() => new Promise<void>((r) => (releaseBlocker = r)));
    await flushPromises();

    // 构建堆
    // 所期望的结构：
    //      A (根节点，Nice -20，VR~0)
    //     / \
    //   B(L) C(R)
    //  / \   /
    // D   E F
    //
    // A: -20 (VR ~0)
    // B: 19  (VR ~1209) -> 左分支
    // C: -10 (VR ~310)  -> 右分支
    // D: 19  (VR ~1209) -> 左左分支
    // E: 19  (VR ~1209) -> 左右 (要移除的目标)
    // F: 0   (VR ~620)  -> 右左 (最后一个节点)
    //
    // 如果我们移除 E（索引 4）：
    // F 移动到索引 4。
    // 4 的父节点是 B（索引 1）。
    // 比较 F(620) 与 B(1209)。F < B。
    // 条件 `last_id < parent` 满足 -> bubbleUp(4)。

    void scheduler.add(() => order.push('A'), {nice: -20});
    void scheduler.add(() => order.push('B'), {nice: 19});
    void scheduler.add(() => order.push('C'), {nice: -10});
    void scheduler.add(() => order.push('D'), {nice: 19});

    const ac = new AbortController();
    // E 是需要移除的目标
    const taskE = scheduler.add(() => order.push('E'), {
      nice: 19,
      signal: ac.signal,
    });

    // F 是最后一个节点，相对于 B 具有较高优先级
    void scheduler.add(() => order.push('F'), {nice: 0});

    await flushPromises();
    expect(scheduler.stats.pending).toBe(6);

    // 触发器移除
    ac.abort();
    await expect(taskE).rejects.toThrow(DOMException);

    // 发布并验证
    releaseBlocker!();
    await scheduler.onIdle();

    // 基于 VR 的预期顺序：
    // A (0) -> C (310) -> F (620) -> B (1209) -> D (1209)
    // 注：E 已中止。
    // F 必须在 B 和 D 之前运行。

    expect(order).toEqual(['A', 'C', 'F', 'B', 'D']);
    expect(order.indexOf('F')).toBeLessThan(order.indexOf('B'));
    expect(order.indexOf('F')).toBeLessThan(order.indexOf('D'));
  });
  it('should allow dynamic priority change via pause options', async () => {
    const scheduler = new Scheduler(1);
    const log: string[] = [];
    let release: () => void;

    void scheduler.add(() => new Promise<void>((r) => (release = r)));
    await flushPromises();

    const t1 = scheduler.add(async (_, pause) => {
      log.push('t1-run');
      await pause({nice: -20});
      log.push('t1-finish');
    });

    const t2 = scheduler.add(() => log.push('t2-run'));

    release!();
    await Promise.all([t1, t2]);

    expect(log).toEqual(['t1-run', 't2-run', 't1-finish']);
  });

  it('should allow dynamic guaranteed status change via pause options', async () => {
    const scheduler = new Scheduler(1);
    const log: string[] = [];
    let release: () => void;

    void scheduler.add(() => new Promise<void>((r) => (release = r)));
    await flushPromises();

    void scheduler.add(
      async (_, pause) => {
        log.push('t1-run');
        await pause({guaranteed: true});
        log.push('t1-finish');
      },
      {guaranteed: false},
    );

    void scheduler.add(() => log.push('t2-run'));

    release!();
    await flushPromises();
    await scheduler.onIdle();

    expect(log).toContain('t1-run');
  });

  it('should resolve onIdle when no tasks are running', async () => {
    const scheduler = new Scheduler(2);
    await expect(scheduler.onIdle()).resolves.toBeUndefined();
  });

  it('should wait for active tasks to complete on onIdle', async () => {
    const scheduler = new Scheduler(2);
    let resolve: () => void;

    void scheduler.add(() => new Promise<void>((r) => (resolve = r)));

    const idlePromise = scheduler.onIdle();
    await flushPromises();

    let resolved = false;
    void idlePromise.then(() => (resolved = true));
    await flushPromises();
    expect(resolved).toBe(false);

    resolve!();
    await idlePromise;
    expect(resolved).toBe(true);
  });

  it('should pause scheduler and prevent new tasks from starting', async () => {
    const scheduler = new Scheduler(1);
    scheduler.pause();

    const task = scheduler.add(() => 'result');
    await flushPromises();

    expect(scheduler.stats.pending).toBe(1);
    expect(scheduler.stats.active).toBe(0);

    scheduler.resume();
    const result = await task;
    expect(result).toBe('result');
    expect(scheduler.stats.active).toBe(0);
  });

  it('should not pause currently active tasks', async () => {
    const scheduler = new Scheduler(1);
    let active = false;

    const promise = scheduler.add(async () => {
      active = true;
      await sleep(10);
      active = false;
    });

    await flushPromises();
    expect(active).toBe(true);

    scheduler.pause();
    expect(active).toBe(true);

    await promise;
    expect(active).toBe(false);
  });

  it('should cover resume() when scheduler is not paused', () => {
    const scheduler = new Scheduler(1);
    scheduler.resume(); // 应该直接返回，不做任何事
    expect(scheduler.stats.isPaused).toBe(false);
  });

  it('should execute the expired callback', async () => {
    const scheduler = new Scheduler(1);
    let expiredCalled = false;

    await scheduler.add((expired) => {
      if (expired()) {
        expiredCalled = true;
      }
      return 1;
    });
    expect(expiredCalled).toBe(false);
  });

  it('should handle elapsed time <= 0 in advanceTime', async () => {
    const scheduler = new Scheduler(1);
    const now = performance.now();
    const spy = vi
      .spyOn(performance, 'now')
      .mockReturnValueOnce(now) // constructor
      .mockReturnValueOnce(now - 100); // add 内部调用 advanceTime 时 elapsed < 0

    await scheduler.add(() => 'test');
    expect(scheduler.stats.min_vruntime).toBe(0); // elapsed <= 0 时不增加
    spy.mockRestore();
  });

  it('should cover applyPriorityUpdate else branches', async () => {
    const scheduler = new Scheduler(1);
    const log: string[] = [];

    await scheduler.add(
      async (_, pause) => {
        // nice 不变 (初始为 0)，options 无
        await pause({nice: 0});
        log.push('step1');
      },
      {nice: 0},
    );

    expect(log).toContain('step1');
  });

  it('should cover guaranteed switch from true to false', async () => {
    const scheduler = new Scheduler(1);
    const log: string[] = [];

    await scheduler.add(
      async (_, pause) => {
        await pause({guaranteed: false}); // 从 true 切换为 false
        log.push('done');
      },
      {guaranteed: true},
    );

    expect(log).toContain('done');
  });

  it('should use free_slots when allocating slots', async () => {
    const scheduler = new Scheduler(1);

    // 运行一个任务并让它结束，产生 free_slot
    await scheduler.add(() => 'temp');

    // 再次添加任务将使用 free_slots 中的索引
    const result = await scheduler.add(() => 'reused_slot');
    expect(result).toBe('reused_slot');
  });

  it('should trigger else branch in compareIds when vruntime is equal', async () => {
    const scheduler = new Scheduler(1);
    const now = performance.now();
    const spy = vi.spyOn(performance, 'now').mockReturnValue(now); // 锁定时间

    let releaseBlocker: () => void;
    void scheduler.add(() => new Promise<void>((r) => (releaseBlocker = r)));
    await flushPromises();

    // 两个 nice 相同的任务，vruntime 相等，触发 compareIds 的 else 分支
    const task1 = scheduler.add(() => 'task1', {nice: 5});
    const task2 = scheduler.add(() => 'task2', {nice: 5});

    expect(scheduler.stats.pending).toBe(2);

    releaseBlocker!();
    spy.mockRestore();

    await Promise.all([task1, task2]);
  });

  it('should shrink memory when idle if tasks exceed threshold', async () => {
    // 设置较低的并发数，确保任务在队列中积压，从而分配不同的 slot ID
    const scheduler = new Scheduler(1);
    const THRESHOLD = 64;
    const TASK_COUNT = THRESHOLD + 10; // 超过阈值

    // 批量添加任务，促使 handles 数组增长
    for (let i = 0; i < TASK_COUNT; i++) {
      void scheduler.add(() => {});
    }

    // 等待所有任务执行完毕并触发空闲逻辑
    await scheduler.onIdle();

    // 验证内部数组已被重置
    expect(scheduler['handles'].length).toBe(0);
    expect(scheduler['v_runtimes'].length).toBe(0);
    expect(scheduler['flags'].length).toBe(0);
    expect(scheduler['free_slots'].length).toBe(0);
  });

  it('should use fast path with macrotask scheduling when yielding without competition', async () => {
    const scheduler = new Scheduler(1);
    const log: string[] = [];
    const now = performance.now();
    const spy = vi.spyOn(performance, 'now');

    // 模拟时间流逝，使 timeSinceYield >= 5ms，触发快速路径的宏任务调度分支
    spy
      .mockReturnValueOnce(now) // constructor
      .mockReturnValueOnce(now) // add 内部 advanceTime
      .mockReturnValueOnce(now) // next 内部 advanceTime
      .mockReturnValueOnce(now) // scheduleExecution -> now (timeSinceYield < 5, 使用 queueMicrotask)
      .mockReturnValueOnce(now + 10); // pause 内部 timeSinceYield >= 5，触发快速路径的宏任务调度

    await scheduler.add(async (_, pause) => {
      log.push('before-pause');
      await pause();
      log.push('after-pause');
    });

    expect(log).toContain('before-pause');
    expect(log).toContain('after-pause');

    spy.mockRestore();
  });

  it('should abort during fast path yield using scheduleImmediate', async () => {
    const scheduler = new Scheduler(1);
    const controller = new AbortController();
    const log: string[] = [];
    const now = performance.now();
    const spy = vi.spyOn(performance, 'now');

    // 模拟时间流逝，使 timeSinceYield >= 5ms，触发快速路径的宏任务调度分支
    spy
      .mockReturnValueOnce(now) // constructor
      .mockReturnValueOnce(now) // add 内部 advanceTime
      .mockReturnValueOnce(now) // next 内部 advanceTime
      .mockReturnValueOnce(now) // scheduleExecution -> now (timeSinceYield < 5, 使用 queueMicrotask)
      .mockReturnValueOnce(now + 10); // pause 内部 timeSinceYield >= 5，触发快速路径的宏任务调度

    const task = scheduler.add(
      async (_, pause) => {
        log.push('before-pause');
        // 使用 setImmediate 确保在 scheduleImmediate 回调执行前触发 abort
        setImmediate(() => controller.abort());
        await pause();
        log.push('after-pause');
      },
      {signal: controller.signal},
    );

    await expect(task).rejects.toThrow(DOMException);
    expect(log).toContain('before-pause');
    expect(log).not.toContain('after-pause');

    spy.mockRestore();
  });

  it('should handle abort when task is not in heap (heap_idx === INVALID_HEAP_INDEX)', async () => {
    const scheduler = new Scheduler(1);
    const controller = new AbortController();
    let pauseCalled = false;

    const task = scheduler.add(
      async (_, pause) => {
        scheduler.resetLimits(0);
        await pause();
        pauseCalled = true;
      },
      {signal: controller.signal},
    );

    await flushPromises();

    // 此时任务已经暂停并推入堆中
    // 通过直接操作内部状态，将任务从堆中移除，模拟 heap_idx === INVALID_HEAP_INDEX 的情况
    const heapIndex = scheduler['getHeapIndex'](0);
    scheduler['removeFromHeap'](heapIndex);

    // 现在触发 abort，应该执行 else 路径（heap_idx === INVALID_HEAP_INDEX）
    controller.abort();

    await expect(task).rejects.toThrow(DOMException);
    expect(pauseCalled).toBe(false);
  });

  it('should handle signal already aborted before adding listener in pause', async () => {
    const scheduler = new Scheduler(1);
    const controller = new AbortController();
    let pauseReached = false;

    const task = scheduler.add(
      async (_, pause) => {
        pauseReached = true;
        controller.abort();
        await pause();
      },
      {signal: controller.signal},
    );

    await expect(task).rejects.toThrow(DOMException);
    expect(pauseReached).toBe(true);
  });

  it('should handle signal aborted when entering pause with competition', async () => {
    const scheduler = new Scheduler(1);
    const controller = new AbortController();
    let pauseReached = false;
    let abortBeforeListener = false;

    const task = scheduler.add(
      async (_, pause) => {
        pauseReached = true;
        scheduler.resetLimits(0);
        abortBeforeListener = true;
        controller.abort();
        await pause();
      },
      {signal: controller.signal},
    );

    await expect(task).rejects.toThrow(DOMException);
    expect(pauseReached).toBe(true);
    expect(abortBeforeListener).toBe(true);
  });
});
