// ========================================
// ./src/Concurrent/scheduler.ts
// ========================================

import {clamp} from 'src/Utils/Math';
import {ParameterError} from '../Errors';
import {ensureDOMException} from '../unknown-error';
import type {MaybePromise} from '../Utils/type-tool';
import {queueMacroTask} from 'src/helper';

// ========================================
// 常量与预计算表
// ========================================

// 最小时间精度，避免除零或过小增量
const EPSILON = 1e-3;

// -- 任务标志位掩码 --
const NICE_MASK = 0x3f; // 低6位存储 nice 索引 (0~39)
const GUARANTEED_FLAG = 1 << 6; // 第7位表示 guaranteed 状态
const HEAP_INDEX_SHIFT = 7; // 从第8位开始存储堆索引

// 无效堆索引标记：2^25 - 1，表示任务不在堆中
const INVALID_HEAP_INDEX = (1 << 25) - 1;

// 切换 guaranteed 时对 vruntime 的惩罚/奖励值
const STRICT_PRIORITY_PENALTY = 100000;

// 新任务初始化 vruntime 时的 nice 偏移量，防止新任务瞬间抢占
const NICE_INIT_PENALTY = 7;

// 比较 vruntime 时容忍的浮点误差
const VRUNTIME_COMPARE_EPSILON = 1e-6;

// 内存收缩阈值：空闲槽位数超过此值时重置数组释放内存
const MEMORY_SHRINK_THRESHOLD = 64;

// Linux CFS 权重表（nice -20 ~ 19 对应的权重）
const WEIGHT_TABLE = new Uint32Array([
  88761, 71755, 56483, 46273, 36291, 29154, 23254, 18705, 14949, 11916, 9548,
  7620, 6100, 4904, 3906, 3121, 2501, 1991, 1586, 1277, 1024, 820, 655, 526,
  423, 335, 272, 215, 172, 137, 110, 87, 70, 56, 45, 36, 29, 23, 18, 15,
]);

const WEIGHT_0 = WEIGHT_TABLE[20]; // nice 0 对应的权重

// 预计算权重比率（nice 0 权重 / 各 nice 权重），避免运行时除法
const WEIGHT_RATIO = new Float64Array(WEIGHT_TABLE.length);
for (let i = 0; i < WEIGHT_TABLE.length; i++) {
  WEIGHT_RATIO[i] = WEIGHT_0 / WEIGHT_TABLE[i];
}

// ========================================
// 接口定义
// ========================================

/**
 * Options for scheduling a task.
 */
interface TaskOptions {
  /** Nice value for priority adjustment (-20 to 19). Lower = higher priority. */
  nice?: number;
  /** AbortSignal to cancel the task. */
  signal?: AbortSignal;
  /**
   * If `true`, the task is guaranteed to run even under high contention.
   * Priority order: guaranteed + higher nice > guaranteed + lower nice >
   * non-guaranteed + higher nice > non-guaranteed + lower nice
   */
  guaranteed?: boolean;
}

/**
 * Guaranteed 机制：双梯队优先级隔离策略
 *
 * 解决 Linux CFS 在单线程环境（浏览器/Node.js）中的局限性：
 * 当 UI 渲染与后台计算公平竞争时，UI 响应可能因后台任务而延迟
 *
 * 核心设计：
 * - 第一梯队（guaranteed = true）：UI 响应、用户交互等关键任务
 * - 第二梯队（guaranteed = false）：后台计算、日志处理等非关键任务
 *
 * 调度策略：
 * - 第一梯队任务绝对优先于第二梯队
 * - 梯队内部仍采用 CFS 公平调度（通过 nice 值微调）
 * - 状态切换时通过 STRICT_PRIORITY_PENALTY 调整 vruntime 确保即时生效
 *
 * 使用示例：
 * ```ts
 * // 关键任务：必须保障响应性
 * scheduler.add(renderTableTask, { guaranteed: true, nice: -10 })
 *
 * // 后台任务：可让步，空闲时仍能获得时间片
 * scheduler.add(analyzeDataTask, { guaranteed: false, nice: 10 })
 * ```
 *
 * 权衡：
 * - 优势：防止关键任务被后台计算"饿死"，提升用户体验
 * - 代价：牺牲严格公平性，第二梯队任务可能延迟执行
 * - 适用：交互密集型应用（SPA、实时可视化等）
 * - 不适用：要求绝对公平的批处理系统
 *
 * 设计哲学：用户体验优先于算法公平性
 */

/**
 * Options for pausing a task.
 */
export interface PauseOptions {
  /** Update the nice value during pause. */
  nice?: number;
  /** Update the guaranteed status during pause. */
  guaranteed?: boolean;
}

/** 内部任务句柄 */
interface TaskHandle {
  fn: (
    expired: () => boolean,
    pause: (options?: PauseOptions) => Promise<void>,
  ) => unknown;
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
  signal?: AbortSignal | undefined;
  resume?: (() => void) | undefined; // 暂停时设置，用于恢复执行
}

// ========================================
// 调度器主类
// ========================================

/**
 * A cooperative scheduler implementing a CFS-like (Completely Fair Scheduler) algorithm.
 * Manages task concurrency, priorities via "nice" values, and time slicing.
 *
 * Uses hybrid microtask/macrotask strategy: within time slice use microtasks for throughput;
 * when exceeded, yield with macrotask to avoid UI blocking.
 */
export class Scheduler {
  private concurrency: number;
  private active_count = 0;

  private is_paused: boolean = false;
  private idle_resolvers: Array<() => void> = [];

  // 最小堆，存储等待运行的任务 ID，按 vruntime 排序
  private readonly heap: number[] = [];
  private min_vruntime = 0; // 全局最小虚拟运行时间
  private last_update_time = 0; // 上次更新时间戳

  private static readonly FRAME_DURATION = 1000 / 60; // 默认时间片（毫秒），约一帧
  // 混合调度时间片阈值（毫秒）
  // 小于此值用微任务最大化吞吐，大于则用宏任务避免阻塞 UI
  private static readonly SCHEDULER_YIELD_THRESHOLD =
    Scheduler.FRAME_DURATION / 4; // 取4分之一的帧时间

  // 上次让出主线程的时间戳，用于混合调度判断
  private last_yield_time = performance.now();

  // 平行数组存储任务元数据（索引 = 任务 ID）
  private v_runtimes: number[] = []; // 虚拟运行时间
  private flags: number[] = []; // 打包的标志（堆索引 + guaranteed + nice索引）
  private handles: (TaskHandle | null)[] = []; // 任务句柄
  private free_slots: number[] = []; // 可复用的空闲 ID

  /**
   * Creates a new Scheduler instance.
   * @param concurrency - Maximum number of concurrently executing tasks.
   * @throws {ParameterError} If concurrency is negative or NaN.
   */
  constructor(concurrency: number) {
    if (concurrency < 0 || Number.isNaN(concurrency)) {
      throw new ParameterError('Scheduler: `concurrency` must be non-negative');
    }
    this.concurrency = concurrency;
    this.last_update_time = performance.now();
    this.last_yield_time = this.last_update_time;
  }

  // ========================================
  // 辅助方法
  // ========================================

  /** 将 nice 值（-20～19）映射为权重表索引（0～39） */
  private getNiceIndex(nice: number): number {
    if (Number.isNaN(nice)) return 20;
    return Math.floor(clamp(nice, -20, 19)) + 20;
  }

  /**
   * 将堆索引、nice 索引和 guaranteed 标志打包成一个整数
   *
   * struct flags {
   *     uint32_t nice_idx       : 6;  // 低6位，nice 索引（0~39）
   *     uint32_t is_guaranteed  : 1;  // 第7位，是否保障优先级
   *     uint32_t heap_index     : 25; // 高25位，堆索引（0~33,554,431）
   * } [[gnu::packed]];
   * static_assert(sizeof(Flags) == 4, "4字节哟");
   */
  private packFlags(
    heap_index: number,
    nice_index: number,
    guaranteed: boolean,
  ): number {
    return (
      (heap_index << HEAP_INDEX_SHIFT) |
      nice_index |
      (guaranteed ? GUARANTEED_FLAG : 0)
    );
  }

  /** 结算任务执行耗时，按权重更新其 vruntime（权重越小，vruntime 增长越慢） */
  private recordExecution(id: number, duration: number): void {
    const v_runtimes = this.v_runtimes;
    const flags = this.flags;
    const nice_index = flags[id] & NICE_MASK;
    const delta = Math.max(duration, EPSILON) * WEIGHT_RATIO[nice_index];
    v_runtimes[id] += delta;
    // 更新全局最小 vruntime，防止新任务因历史值过大而饥饿
    this.min_vruntime = Math.max(this.min_vruntime, v_runtimes[id]);
  }

  /** 动态调整任务优先级：修改 vruntime 以"惩罚"或"奖励"任务 */
  private applyPriorityUpdate(id: number, options?: PauseOptions): void {
    if (!options) return;

    const v_runtimes = this.v_runtimes;
    const flags = this.flags;
    const old_flags = flags[id];
    let nice_index = old_flags & NICE_MASK;
    let guaranteed = (old_flags & GUARANTEED_FLAG) !== 0;
    let changed = false;

    if (options.nice !== undefined && !Number.isNaN(options.nice)) {
      const new_index = this.getNiceIndex(options.nice);
      if (new_index !== nice_index) {
        nice_index = new_index;
        changed = true;
      }
    }

    if (options.guaranteed !== undefined && options.guaranteed !== guaranteed) {
      guaranteed = options.guaranteed;
      // 变为 guaranteed：奖励（减少 vruntime）；变为 non-guaranteed：惩罚（增加）
      v_runtimes[id] += guaranteed
        ? -STRICT_PRIORITY_PENALTY
        : STRICT_PRIORITY_PENALTY;
      changed = true;
    }

    if (changed) {
      // 保留堆索引部分，只更新低7位
      flags[id] =
        (old_flags & ~NICE_MASK & ~GUARANTEED_FLAG) |
        nice_index |
        (guaranteed ? GUARANTEED_FLAG : 0);
    }
  }

  /**
   * 智能调度执行器：根据距上次让出主线程的时间决定使用微任务还是宏任务
   * - 小于阈值：queueMicrotask，当前事件循环继续执行，提高吞吐
   * - 超过阈值：queueMacroTask 让出主线程，防止阻塞 UI
   */
  private scheduleExecution(callback: () => void): void {
    const now = performance.now();
    const time_since_yield = now - this.last_yield_time;

    if (time_since_yield < Scheduler.SCHEDULER_YIELD_THRESHOLD)
      queueMicrotask(callback);
    else
      queueMacroTask(() => {
        this.last_yield_time = performance.now();
        callback();
      });
  }

  // ========================================
  // 公开 API
  // ========================================

  /**
   * Updates the concurrency limit. If increased, triggers next scheduling cycle.
   * @param new_concurrency - The new concurrency limit.
   * @throws {ParameterError} If the new limit is negative or NaN.
   */
  public resetLimits(new_concurrency: number): void {
    if (new_concurrency < 0 || Number.isNaN(new_concurrency))
      throw new ParameterError(
        'Scheduler: `new_concurrency` must be non-negative',
      );

    this.concurrency = new_concurrency;
    this.next();
  }

  /**
   * Adds a task to the scheduler.
   * @template T - Return type of the task function.
   * @param fn - Task function receiving `expired()` checker and `pause()` function.
   * @param options - Scheduling options (nice, signal, guaranteed).
   * @returns Promise resolving with the task's result.
   */
  public async add<T>(
    fn: (
      expired: () => boolean,
      pause: (options?: PauseOptions) => Promise<void>,
    ) => MaybePromise<T>,
    options?: TaskOptions,
  ): Promise<T> {
    const {signal, nice = 0, guaranteed = false} = options ?? {};
    if (signal?.aborted)
      return Promise.reject(ensureDOMException(signal.reason));

    const nice_index = this.getNiceIndex(nice);

    return new Promise((resolve, reject) => {
      const id = this.allocSlot();
      this.advanceTime();

      // 初始化 vruntime：基于全局最小值，加上 nice 偏移和 guaranteed 奖惩
      const nice_penalty = nice_index * NICE_INIT_PENALTY;
      const guaranteed_bonus = guaranteed ? -STRICT_PRIORITY_PENALTY : 0;

      const v_runtimes = this.v_runtimes;
      const flags = this.flags;
      const handles = this.handles;

      v_runtimes[id] = this.min_vruntime + nice_penalty + guaranteed_bonus;
      flags[id] = this.packFlags(INVALID_HEAP_INDEX, nice_index, guaranteed);

      const on_abort = () => {
        // 若任务已暂停（存在 resume 回调），终止逻辑由 pause 内部处理
        if (handles[id]?.resume) return;

        const heap_index = this.getHeapIndex(id);
        if (heap_index !== INVALID_HEAP_INDEX) {
          // 任务在堆中等待：移除并清理
          this.removeFromHeap(heap_index);
          signal?.removeEventListener('abort', on_abort);
          reject(ensureDOMException(signal!.reason));
          this.cleanupHandle(id);
          this.next();
        } // 任务正在运行，直接拒绝
        else reject(ensureDOMException(signal!.reason));
      };

      handles[id] = {
        fn: fn,
        resolve: (value) => {
          signal?.removeEventListener('abort', on_abort);
          resolve(value as T);
        },
        reject: (reason) => {
          signal?.removeEventListener('abort', on_abort);
          reject(reason as Error);
        },
        signal,
      };

      signal?.addEventListener('abort', on_abort, {once: true});
      this.push(id);
      this.next();
    });
  }

  /** Pauses the scheduler. No new tasks will be dispatched. */
  public pause(): void {
    this.is_paused = true;
  }

  /** Resumes the scheduler if it was paused. */
  public resume(): void {
    if (!this.is_paused) return;
    this.is_paused = false;
    this.next();
  }

  /**
   * Returns a promise that resolves when the scheduler becomes idle.
   * @returns Promise resolving when all tasks are settled and queue is empty.
   */
  public onIdle(): Promise<void> {
    if (this.active_count === 0 && this.heap.length === 0) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      this.idle_resolvers.push(resolve);
    });
  }

  /** Returns current statistics of the scheduler. */
  public get stats() {
    const next_id = this.heap[0];
    return {
      concurrency: this.concurrency,
      active: this.active_count,
      pending: this.heap.length,
      isPaused: this.is_paused,
      min_vruntime: this.min_vruntime,
      next_task_nice:
        next_id !== undefined
          ? (this.flags[next_id] & NICE_MASK) - 20
          : undefined,
      next_task_vruntime:
        next_id !== undefined ? this.v_runtimes[next_id] : undefined,
    };
  }

  // ========================================
  // 核心调度逻辑
  // ========================================

  /** 推进调度器时钟：若空闲且堆空，重置 min_vruntime 并返回 true */
  private advanceTime(): boolean {
    if (this.active_count === 0 && this.heap.length === 0) {
      const now = performance.now();
      this.last_update_time = now;
      this.last_yield_time = now;
      this.min_vruntime = 0; // 重置防止无限增长
      return true;
    }

    const now = performance.now();
    const elapsed = now - this.last_update_time;
    this.last_update_time = now;

    // 全局时间流逝累加到 min_vruntime，等价于所有任务 vruntime 同步增长
    if (this.active_count === 0 && elapsed > 0) this.min_vruntime += elapsed;

    return false;
  }

  /** 核心调度循环：从堆中取出任务并执行，直到并发数饱和或堆空 */
  private next(): void {
    if (this.advanceTime()) {
      this.resolveIdle();
      return;
    }

    if (this.is_paused) return;

    while (this.active_count < this.concurrency) {
      const id = this.heap[0];
      if (id === undefined) break;

      this.pop();
      this.active_count++;

      const handle = this.handles[id];
      if (handle?.resume) {
        // 任务曾被暂停，现在恢复
        const resume = handle.resume;
        handle.resume = undefined;
        this.scheduleExecution(resume);
      } else this.scheduleExecution(() => void this.runTask(id));
    }
  }

  /** 执行单个任务：时间片管理、暂停恢复和异常处理 */
  private async runTask(id: number): Promise<void> {
    const handles = this.handles;
    const handle = handles[id]!;
    let task_start_time = performance.now();
    let deadline = task_start_time + Scheduler.FRAME_DURATION;

    const pause = async (options?: PauseOptions) => {
      const now = performance.now();
      const duration = now - task_start_time;

      // 结算当前时间片
      this.recordExecution(id, duration);
      this.applyPriorityUpdate(id, options);

      // ========================================
      // 吞吐量优化路径
      // ========================================
      const has_competition = this.heap.length > 0;
      const time_since_yield = now - this.last_yield_time;

      // 只有当 concurrency > 0 时才允许快速路径。
      // 如果 concurrency 为 0 (调度器被暂停)，必须走标准流程，将任务挂起，
      // 否则任务会无视暂停限制继续执行，且无法响应 abort。
      const can_use_fast_path = !has_competition && this.concurrency > 0;

      // 场景 A: 无竞争 + 调度器运行中 + 尚未达到宏任务让出阈值
      if (
        can_use_fast_path &&
        time_since_yield < Scheduler.SCHEDULER_YIELD_THRESHOLD
      ) {
        // 直接重置时间片，继续执行，不挂起也不让出主线程
        task_start_time = performance.now();
        deadline = task_start_time + Scheduler.FRAME_DURATION;
        return;
      }

      // 场景 B: 无竞争 + 调度器运行中 + 需要让出主线程
      if (can_use_fast_path) {
        // 即使在快速路径，也需要监听 abort，防止在 yield 期间发生中断被忽略
        await new Promise<void>((resolve, reject) => {
          let on_abort: () => void;

          if (handle.signal) {
            on_abort = () => reject(ensureDOMException(handle.signal?.reason));
            handle.signal.addEventListener('abort', on_abort, {once: true});
          }

          queueMacroTask(() => {
            if (on_abort) handle.signal?.removeEventListener('abort', on_abort);
            this.last_yield_time = performance.now();
            resolve();
          });
        });

        task_start_time = performance.now();
        deadline = task_start_time + Scheduler.FRAME_DURATION;
        return;
      }

      // 场景 C: 有竞争 OR 调度器被暂停 (concurrency === 0)
      let on_abort: () => void;

      try {
        await new Promise<void>((resolve, reject) => {
          handle.resume = resolve;

          on_abort = () => {
            const heap_idx = this.getHeapIndex(id);
            if (heap_idx !== INVALID_HEAP_INDEX) {
              this.removeFromHeap(heap_idx);
              this.cleanupHandle(id);
              this.next(); // 任务终止，释放槽位，尝试调度下一个
            }
            handle.resume = undefined;
            reject(ensureDOMException(handle.signal?.reason));
          };

          if (handle.signal?.aborted) return on_abort();

          handle.signal?.addEventListener('abort', on_abort, {once: true});

          // 正式挂起：将任务放回堆中，减少活跃计数，并触发调度
          this.push(id);
          this.active_count--;
          this.next();
        });
      } finally {
        handle.signal?.removeEventListener('abort', on_abort!);
      }

      // 恢复执行：重置时间片起始点
      task_start_time = performance.now();
      deadline = task_start_time + Scheduler.FRAME_DURATION;
    };

    const expired = () => performance.now() >= deadline;

    try {
      const result = await handle.fn(expired, pause);
      handle.resolve(result);
    } catch (err) {
      handle.reject(err);
    } finally {
      // 若句柄已被清理（如在 pause 中 abort），则跳过
      if (this.handles[id]) {
        this.recordExecution(id, performance.now() - task_start_time);
        this.active_count--;
        this.cleanupHandle(id);
        this.next();
      }
    }
  }

  /** 比较两个任务的优先级：vruntime 小的优先；相等则 nice 小的优先 */
  private compareIds(id_a: number, id_b: number): number {
    const v_runtimes = this.v_runtimes;
    const flags = this.flags;
    const diff = v_runtimes[id_a] - v_runtimes[id_b];

    if (diff > VRUNTIME_COMPARE_EPSILON) return 1;
    if (diff < -VRUNTIME_COMPARE_EPSILON) return -1;

    // 仅在 vruntime 极度接近时才解引用 flags 进行次级比较
    return (flags[id_a] & NICE_MASK) - (flags[id_b] & NICE_MASK);
  }

  /** 触发所有等待 onIdle 的 Promise，并在必要时回收内存 */
  private resolveIdle(): void {
    if (this.idle_resolvers.length > 0) {
      const resolvers = this.idle_resolvers;
      this.idle_resolvers = [];
      for (let i = 0; i < resolvers.length; i++) resolvers[i]();
    }

    // 若闲置槽位过多，重置数组释放内存，防止长期运行内存泄漏
    if (this.handles.length > MEMORY_SHRINK_THRESHOLD) {
      this.handles.length = 0;
      this.v_runtimes.length = 0;
      this.flags.length = 0;
      this.free_slots.length = 0;
    }
  }

  // ========================================
  // 底层存储操作（堆与空闲槽管理）
  // ========================================

  /** 从 flags 中提取堆索引 */
  private getHeapIndex(id: number): number {
    return this.flags[id] >>> HEAP_INDEX_SHIFT;
  }

  /** 设置 flags 中的堆索引 */
  private setHeapIndex(id: number, index: number): void {
    const flags = this.flags;
    flags[id] =
      (index << HEAP_INDEX_SHIFT) | (flags[id] & ((1 << HEAP_INDEX_SHIFT) - 1));
  }

  /** 分配任务槽位：优先复用空闲槽，否则扩展数组 */
  private allocSlot(): number {
    return this.free_slots.length > 0
      ? this.free_slots.pop()!
      : this.handles.length;
  }

  /** 清理任务句柄，将槽位归还到空闲列表 */
  private cleanupHandle(id: number): void {
    const handles = this.handles;
    const v_runtimes = this.v_runtimes;
    const flags = this.flags;

    handles[id] = null;
    v_runtimes[id] = 0;
    flags[id] = 0;
    this.free_slots.push(id);
  }

  /** 从堆顶取出最小 vruntime 的任务 */
  private pop(): number | undefined {
    const heap = this.heap;
    const top_id = heap[0];
    const last_id = heap.pop()!;
    if (heap.length > 0) {
      heap[0] = last_id;
      this.setHeapIndex(last_id, 0);
      this.bubbleDown(0);
    }
    this.setHeapIndex(top_id, INVALID_HEAP_INDEX);
    return top_id;
  }

  /** 向堆中插入新任务 */
  private push(id: number): void {
    const heap = this.heap;
    const index = heap.length;
    heap.push(id);
    this.setHeapIndex(id, index);
    this.bubbleUp(index);
  }

  /** 从指定堆索引移除任务 */
  private removeFromHeap(index: number): void {
    const heap = this.heap;
    const removed_id = heap[index];
    const last_id = heap.pop()!;

    if (index < heap.length) {
      heap[index] = last_id;
      this.setHeapIndex(last_id, index);

      // 重新调整：若比父节点小则上浮，否则下沉
      const parent_idx = (index - 1) >> 1;
      if (index > 0 && this.compareIds(last_id, heap[parent_idx]) < 0)
        this.bubbleUp(index);
      else this.bubbleDown(index);
    }

    this.setHeapIndex(removed_id, INVALID_HEAP_INDEX);
  }

  /** 上浮操作（挖坑填位法减少写次数） */
  private bubbleUp(index: number): void {
    const heap = this.heap;
    const node_id = heap[index];

    while (index > 0) {
      const parent_idx = (index - 1) >> 1;
      const parent_id = heap[parent_idx];

      if (this.compareIds(parent_id, node_id) <= 0) break;

      heap[index] = parent_id;
      this.setHeapIndex(parent_id, index);
      index = parent_idx;
    }

    heap[index] = node_id;
    this.setHeapIndex(node_id, index);
  }

  /** 下沉操作（挖坑填位法） */
  private bubbleDown(index: number): void {
    const heap = this.heap;
    const length = heap.length;
    const node_id = heap[index];

    while (true) {
      const left_idx = (index << 1) + 1;
      const right_idx = left_idx + 1;
      let smallest_idx = index;

      if (left_idx < length && this.compareIds(heap[left_idx], node_id) < 0)
        smallest_idx = left_idx;

      if (
        right_idx < length &&
        this.compareIds(heap[right_idx], heap[smallest_idx]) < 0
      )
        smallest_idx = right_idx;

      if (smallest_idx === index) break;

      const child_id = heap[smallest_idx];
      heap[index] = child_id;
      this.setHeapIndex(child_id, index);
      index = smallest_idx;
    }

    heap[index] = node_id;
    this.setHeapIndex(node_id, index);
  }
}
