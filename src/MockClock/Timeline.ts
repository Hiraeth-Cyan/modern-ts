// ========================================
// ./src/MockClock/Timeline.ts
// ========================================

import {TimerHeap} from './TimerHeap';
import {MockTimerHandle} from './TimerHandle';
import type {Timer, Job, TimerRef, MockTarget, ClockOpts} from './types';
import {DEFAULT_CONFIG, TaskType} from './types';
import {UseAfterFreeError} from '../Errors';
import {VirtualTimeManager} from './VirtualTimeManager';

/**
 * Public interface for a virtual timeline.
 *
 * Provides methods to control mocked time, manage timers, and query virtual time.
 * This interface is exposed to external users of the mock clock system.
 *
 * @example
 * ```ts
 * const clock = MockClock();
 * runTimeline(clock, () => {
 *   setTimeout(() => console.log('Timer'), 1000);
 *   clock.tick(1000); // Advances virtual time by 1000ms
 * });
 * ```
 */
export type TimelinePublic = {
  // ============================================
  // Basic Information
  // ============================================

  /**
   * Unique identifier for this timeline.
   * @readonly
   */
  id: string;

  // ============================================
  // Lifecycle Management
  // ============================================

  /**
   * Destroys the timeline and releases all resources.
   * Any operations after calling this method will throw an error.
   * @remarks Tested objects must call this method to avoid resource leaks.
   */
  destroy(): void;

  /**
   * Supports automatic disposal via the `using` statement. See {@link destroy}
   */
  [Symbol.dispose](): void;

  // ============================================
  // Mock Mode Switching
  // ============================================

  /**
   * Checks whether a specific API is currently being mocked.
   *
   * @param api - The API name to check (e.g., 'Date', 'setTimeout', 'setInterval')
   * @returns `true` if the API is mocked, `false` if using real implementation
   */
  isMocked(api: MockTarget): boolean;

  /**
   * Enables mocking for a specific API.
   *
   * @param api - The API to mock (e.g., 'Date', 'setTimeout', 'setInterval')
   */
  useMock(api: MockTarget): void;

  /**
   * Disables mocking for a specific API.
   *
   * @param api - The API to use real implementation for
   */
  useReal(api: MockTarget): void;

  // ============================================
  // Time Control
  // ============================================

  /**
   * Freezes virtual time at the current moment.
   *
   * While frozen, time-related methods return constant values until
   * `unfreeze()` is called. Timers can still be scheduled but won't fire
   * until time is advanced.
   */
  freeze(): void;

  /**
   * Advances time to the next scheduled timer and executes it.
   *
   * Useful for stepping through timers one at a time. If no timers are
   * pending, this method does nothing.
   */
  next(): void;

  /**
   * Asynchronously advances time to the next scheduled timer and executes it.
   *
   * Useful for stepping through timers one at a time. If no timers are
   * pending, this method does nothing.
   */
  nextAsync(): Promise<void>;

  /**
   * Runs all pending timers until the queue is empty.
   *
   * Executes timers synchronously in a loop. Any timers scheduled during
   * execution will also be run.
   *
   * @throws Error if the maximum loop limit is exceeded (prevents infinite loops)
   */
  runAll(): void;

  /**
   * Asynchronously runs all pending timers until the queue is empty.
   *
   * Similar to `runAll`, but flushes promises between timer executions,
   * allowing async callbacks to complete.
   *
   * @throws Error if the maximum loop limit is exceeded
   */
  runAllAsync(): Promise<void>;

  /**
   * Runs all pending timers that were scheduled before this call.
   *
   * Unlike `runAll`, this only runs timers that existed at the time
   * of the call, not timers scheduled during execution.
   *
   * @throws Error if the maximum loop limit is exceeded
   */
  runPending(): void;

  /**
   * Asynchronously runs all pending timers that were scheduled before this call.
   *
   * Similar to `runPending`, but flushes promises between timer executions,
   * allowing async callbacks to complete.
   *
   * @throws Error if the maximum loop limit is exceeded
   */
  runPendingAsync(): Promise<void>;

  /**
   * Sets the virtual system time to a specific value.
   *
   * Affects `Date.now()` and `new Date()` but does not affect monotonic
   * time sources like `performance.now()` or `process.uptime()`.
   *
   * @param time - The target time as a Date object or timestamp in milliseconds.
   *               If omitted, resets to real system time.
   */
  setSystemTime(time?: number | Date): void;

  /**
   * Advances the virtual time by the specified number of milliseconds.
   *
   * Executes all timers that would have fired during this time period,
   * including any timers scheduled by those callbacks.
   *
   * @param ms - The number of milliseconds to advance (must be non-negative)
   * @throws Error if the maximum loop limit is exceeded
   */
  tick(ms: number): void;

  /**
   * Asynchronously advances the virtual time by the specified milliseconds.
   *
   * Similar to `tick`, but flushes promises between timer executions,
   * allowing async callbacks to complete.
   *
   * @param ms - The number of milliseconds to advance (must be non-negative)
   * @throws Error if the maximum loop limit is exceeded
   */
  tickAsync(ms: number): Promise<void>;

  /**
   * Unfreezes virtual time, allowing it to progress normally.
   *
   * After unfreezing, time will advance as timers are executed.
   */
  unfreeze(): void;

  // ============================================
  // Timer Management
  // ============================================

  /**
   * Clears all pending timers and microtasks.
   *
   * Removes all scheduled timers from the queue without executing them.
   * Useful for resetting state between tests.
   */
  clearAllTimers(): void;

  /**
   * Returns the number of pending timers in the queue.
   *
   * @returns The count of timers waiting to be executed
   */
  readonly timerCount: number;

  // ============================================
  // Microtask Control
  // ============================================

  /**
   * Flushes any pending microtasks (promise callbacks) in the real environment.
   *
   * Uses the native promise resolution mechanism to process microtasks.
   */
  realFlushPromises(): Promise<void>;

  /**
   * Asynchronously pauses execution for the specified number of milliseconds.
   *
   * Uses the native `setTimeout` to delay execution.
   *
   * @param ms - The number of milliseconds to sleep (must be non-negative)
   */
  realSleep(ms: number): Promise<void>;

  /**
   * Runs all queued microtasks synchronously.
   *
   * Executes pending promise callbacks in the virtual environment.
   */
  runMicrotasks(): void;

  // ============================================
  // Virtual Time Queries
  // ============================================

  /**
   * Returns the current time offset from real time.
   *
   * @returns The offset in milliseconds (virtual time - real time)
   */
  getOffset(): number;

  /**
   * Returns the current virtual high-resolution time.
   *
   * @returns A tuple `[seconds, nanoseconds]` representing virtual time
   */
  hrtime(): [number, number];

  /**
   * Returns the current virtual high-resolution time as a bigint.
   *
   * @returns Time in nanoseconds as a bigint
   */
  hrtimeBigInt(): bigint;

  /**
   * Checks if the timeline is currently frozen.
   *
   * @returns `true` if time is frozen, `false` otherwise
   */
  isFrozen(): boolean;

  /**
   * Returns the current virtual system time in milliseconds since epoch.
   *
   * @returns Current virtual timestamp (affected by `setSystemTime`)
   */
  systemTime(): number;

  /**
   * Returns the current virtual OS uptime.
   *
   * @returns Uptime in seconds (monotonic, affected by `tick`)
   */
  osUptime(): number;

  /**
   * Returns the current virtual performance.now() value.
   *
   * @returns Time in milliseconds since virtual start (monotonic)
   */
  perfNow(): number;

  /**
   * Returns the current virtual process uptime.
   *
   * @returns Uptime in seconds (monotonic, affected by `tick`)
   */
  uptime(): number;

  // ============================================
  // Real Time Queries (Bypass Mock)
  // ============================================

  /**
   * Returns the real high-resolution time.
   *
   * Bypasses the virtual time system and returns actual system time.
   *
   * @param time - Optional tuple to calculate difference from.
   *               If provided, returns `[deltaSec, deltaNsec]`.
   * @returns Current real time as `[seconds, nanoseconds]`, or difference if `time` is provided
   */
  getRealHrtime(time?: [number, number]): [number, number];

  /**
   * Returns the real high-resolution time as a bigint.
   *
   * @returns Current real time in nanoseconds as a bigint
   */
  getRealHrtimeBigInt(): bigint;

  /**
   * Returns the current real system time.
   *
   * Bypasses the virtual time system and returns actual `Date.now()`.
   *
   * @returns Current real timestamp in milliseconds
   */
  getRealNow(): number;

  /**
   * Returns the real OS uptime.
   *
   * @returns Actual system uptime in seconds
   */
  getRealOsUptime(): number;

  /**
   * Returns the real performance.now() value.
   *
   * @returns Actual high-resolution time in milliseconds
   */
  getRealPerfNow(): number;

  /**
   * Returns the real process uptime.
   *
   * @returns Actual process uptime in seconds
   */
  getRealUptime(): number;
};

/**
 * 虚拟时间线，管理模拟时间和定时器。
 * 内部实现类，外部应通过 TimelinePublic 接口使用。
 */
export class Timeline implements TimelinePublic {
  public readonly id: string; // 时间线的唯一标识符
  private manager: VirtualTimeManager; // 链接到虚拟时间管理器

  private mocks: Record<MockTarget, boolean>; // 管理需要mock的API

  // 记录起始时间
  private readonly start_ts: number;
  private readonly start_perf: number;
  private readonly start_hr: [number, number];
  private readonly start_uptime: number;
  private readonly start_os_uptime: number;

  // 系统时间偏移，用于 now()，受 setSystemTime 影响
  private system_offset: number = 0;
  // 虚拟时间流逝偏移，用于 perfNow/uptime 等，只受 tick 影响
  private virtual_offset: number = 0;

  // 冻结状态：只在冻结时才分配此对象，节省内存
  private frozen_state: {
    time: number;
    perf: number;
    hr: [number, number];
    uptime: number;
    os_uptime: number;
  } | null = null;

  private heap = new TimerHeap(); // 最小堆，快速取出到期的定时器
  public readonly max_loop: number; // 最大宏循环次数，防止死循环

  // nextTick 队列（优先级高于 microtask）
  private next_ticks = new Array<Job>();
  private next_tick_head: number = 0;
  private next_tick_tail: number = 0;

  // microtask 队列
  private jobs = new Array<Job>();
  private job_head: number = 0;
  private job_tail: number = 0;

  // UAF检测
  private is_disposed: boolean = false;

  // ============================================
  // 构造与生命周期
  // ============================================

  constructor(
    id: string,
    manager: VirtualTimeManager,
    real_now: number,
    real_perf: number,
    real_hr: [number, number],
    real_proc_up: number,
    real_os_up: number,
    options: ClockOpts,
  ) {
    this.id = id;
    this.manager = manager;
    // 初始化系统时间、性能时间、高分辨率时间、进程 uptime 和 OS uptime
    this.start_ts = real_now;
    this.start_perf = real_perf;
    this.start_hr = real_hr;
    this.start_uptime = real_proc_up;
    this.start_os_uptime = real_os_up;

    this.max_loop = options.loop_limit ?? 1314;

    this.mocks = {...DEFAULT_CONFIG};
    // 初始化模拟配置，根据 options 覆盖默认值
    (Object.keys(options) as (keyof ClockOpts)[]).forEach((key) => {
      if (
        key !== 'loop_limit' &&
        key !== 'frozen' &&
        typeof options[key] === 'boolean'
      )
        this.mocks[key] = options[key];
    });

    if (options.frozen !== false) this.freeze(); // 初始冻结状态
  }

  // 检查是否已销毁，若已销毁则抛出异常
  private throwIfDisposed() {
    if (this.is_disposed)
      throw new UseAfterFreeError(
        `${this.id}: Timeline has been destroyed and cannot be used.`,
      );
  }

  // 检查循环次数是否超过限制，防止死循环
  private checkLoopLimit(count: number, task_type: string) {
    if (count > this.max_loop)
      throw new Error(
        `${this.id}: Aborting after running ${this.max_loop} ${task_type}, assuming an infinite loop!`,
      );
  }

  // ============================================
  // Mock 配置
  // ============================================

  /** 检查指定 API 是否被模拟 */
  public isMocked(api: MockTarget): boolean {
    this.throwIfDisposed();
    return this.mocks[api];
  }

  /** 对指定 API 使用真实实现 */
  public useReal(api: MockTarget): void {
    this.throwIfDisposed();
    this.mocks[api] = false;
  }

  /** 对指定 API 启用模拟 */
  public useMock(api: MockTarget): void {
    this.throwIfDisposed();
    this.mocks[api] = true;
  }

  // ============================================
  // 定时器管理
  // ============================================

  /** 返回等待中的定时器数量 */
  public get timerCount() {
    this.throwIfDisposed();
    return this.heap.size;
  }

  /** 清除所有等待中的定时器和微任务 */
  public clearAllTimers() {
    this.throwIfDisposed();
    this.clear();
  }

  /** 添加 nextTick 到队列 */
  addNextTick(callback: (...args: unknown[]) => void, args: unknown[]) {
    this.throwIfDisposed();
    this.next_ticks[this.next_tick_tail++] = {callback, args};
  }

  /** 添加微任务到队列 */
  addJob(callback: (...args: unknown[]) => void, args: unknown[]) {
    this.throwIfDisposed();
    this.jobs[this.job_tail++] = {callback, args};
  }

  // 运行当前队列中的所有 nextTick
  private runNextTicks() {
    let count = 0;
    while (this.next_tick_head < this.next_tick_tail) {
      this.checkLoopLimit(count++, 'nextTicks');
      const job = this.next_ticks[this.next_tick_head++];
      try {
        job.callback(...job.args);
      } catch (e) {
        console.error(`${this.id}: Error in nextTick callback:`, e);
      }
    }
    this.next_ticks.length = 0;
    this.next_tick_head = 0;
    this.next_tick_tail = 0;
  }

  // 运行当前队列中的所有 microtask
  private runJobs() {
    let count = 0;
    while (this.job_head < this.job_tail) {
      this.checkLoopLimit(count++, 'microtasks');
      const job = this.jobs[this.job_head++];
      try {
        job.callback(...job.args);
      } catch (e) {
        console.error(`${this.id}: Error in microtask callback:`, e);
      }
    }
    this.jobs.length = 0;
    this.job_head = 0;
    this.job_tail = 0;
  }

  /** 运行所有微任务（包括 nextTick 和 queueMicrotask） */
  public runMicrotasks() {
    this.throwIfDisposed();

    // nextTick 优先级高于 microtask，循环执行直到两个队列都为空
    while (
      this.next_tick_head < this.next_tick_tail ||
      this.job_head < this.job_tail
    ) {
      this.runNextTicks();
      this.runJobs();
    }
  }

  /** 运行所有微任务并刷新 Promise，循环直到队列为空 */
  private async runMicrotasksAndFlushPromises() {
    // 这里的循环是为了处理Promise.then中产生的nextTick、queueMicrotask
    do {
      this.runMicrotasks();
      await this.manager.realFlushPromises();
    } while (
      this.next_tick_head < this.next_tick_tail ||
      this.job_head < this.job_tail
    );
  }

  /** 添加定时器到堆中 */
  addTimer(
    type: Timer['type'],
    callback: (...args: unknown[]) => void,
    delay: number,
    args: unknown[],
  ): TimerRef {
    this.throwIfDisposed();

    const id = this.heap.allocId(); // 分配一个堆位置
    const now = this.systemTime(); // 注意这里拿的是虚拟时间

    const timer: Timer = {
      id,
      type,
      callback,
      args,
      delay,
      deadline: now + delay, // 死线是虚拟时间加延迟
      ref: true,
      heap_index: -1,
    };

    if (type === TaskType.interval) timer.repeat = delay; // 额外的重复延迟

    this.heap.add(timer);
    return new MockTimerHandle(this, timer); // 返回一个匹配NodeJS.Timeout的句柄
  }

  /** 获取指定 ID 的定时器 */
  getTimer(id: number): Timer | undefined {
    this.throwIfDisposed();
    return this.heap.get(id);
  }

  /** 移除指定 ID 的定时器 */
  removeTimer(id: number) {
    this.throwIfDisposed();
    this.heap.remove(id);
  }

  /** 刷新定时器（重新计算 deadline） */
  refreshTimer(id: number) {
    this.throwIfDisposed();
    const timer = this.heap.get(id);
    if (timer) {
      const now = this.systemTime();
      timer.deadline = now + timer.delay;
      this.heap.update(id);
    }
  }

  // 查看堆顶定时器
  private peekTimer(): Timer | null {
    return this.heap.peek();
  }

  // 执行定时器回调，若是 interval 则重新调度
  private execTimer(timer: Timer) {
    if (timer.type === TaskType.interval && timer.repeat) {
      timer.deadline += timer.repeat;
      this.heap.update(timer.id);
    } else this.heap.remove(timer.id);

    try {
      // 若是RAF则传递入队时间（匹配返回值）
      if (timer.type === TaskType.animationFrame)
        timer.callback(timer.deadline - timer.delay);
      else timer.callback(...timer.args);
    } catch (e) {
      console.error(
        `${this.id}: Error in timer callback (ID: ${timer.id}):`,
        e,
      );
    }
  }

  // ============================================
  // 时间推进
  // ============================================

  /** 推进虚拟时间指定毫秒，执行期间到期的定时器 */
  public tick(ms: number) {
    this.throwIfDisposed();

    if (ms < 0) {
      this.system_offset += ms;
      if (this.frozen_state) this.frozen_state.time = this.calcNow(); // 更新时间
      return;
    }

    const start_time = this.systemTime(); // 取出当前的虚拟时间
    const target_time = start_time + ms; // 计算偏移
    const start_virtual = this.virtual_offset; // 取出流逝时间

    let count = 0;
    this.runMicrotasks();

    while (true) {
      this.checkLoopLimit(count++, 'timers');

      const next_timer = this.peekTimer(); // 取出一个接近死线的定时器
      if (!next_timer || next_timer.deadline > target_time) break; // 如果没有（堆为空）或未到时间则结束

      this.virtual_offset =
        next_timer.deadline - this.start_ts - this.system_offset; // 当定时器执行时，应该更新至定时器触发时间
      if (this.frozen_state) this.frozen_state.time = next_timer.deadline;

      this.execTimer(next_timer); // 执行定时器
      this.runMicrotasks();
    }

    this.virtual_offset = start_virtual + ms;
    if (this.frozen_state) this.updateFrozenState(target_time);
  }

  /** 异步推进虚拟时间，每次定时器执行后等待 Promise 完成 */
  public async tickAsync(ms: number) {
    this.throwIfDisposed();

    if (ms < 0) {
      this.system_offset += ms;
      if (this.frozen_state) this.frozen_state.time = this.calcNow();
      return;
    }

    const start_time = this.systemTime();
    const target_time = start_time + ms;
    const start_virtual = this.virtual_offset;
    let count = 0;

    /*
     注意：理论上queueMicrotask和Promise.then是同级的，它们之间是FIFO，但因为我们无法Hook Promise.then（容易起连锁反应死循环，像这里我们自己也在用async和await呢）
     所以当前的事件循环顺序会是：nextTick（包括其产出自身） -> queueMicrotask（包括其产出自身，若产出nextTick则会继续上一步） -> Promise.then（上一步queueMicrotask和nextTick中产出的Promise.then都会在此执行） -> 假宏任务（注意这里的宏任务是在微任务的环境执行的）
     简而言之：
     - 真实的：nextTick -> queueMicrotask/Promiese.then（FIFO）-> 宏任务 
     - 模拟的：假nextTick -> 假queueMicrotask -> 真Promiese.then -> 假宏任务
     */
    await this.runMicrotasksAndFlushPromises();

    while (true) {
      this.checkLoopLimit(count++, 'timers');

      const next_timer = this.peekTimer();
      if (!next_timer || next_timer.deadline > target_time) break;

      this.virtual_offset =
        next_timer.deadline - this.start_ts - this.system_offset;
      if (this.frozen_state) this.frozen_state.time = next_timer.deadline;

      // 因为前面有个await this.manager.realFlushPromises
      this.execTimer(next_timer); // 所以这里的同步代码实际上是在微任务环境中执行的
      // 但这无伤大雅，实际上顺序是对的，但回调的运行环境可能有些不一致
      // 只有在极其底层依赖任务环境的Node.js API或依赖调用栈的用户代码中会出问题
      await this.runMicrotasksAndFlushPromises();
    }

    this.virtual_offset = start_virtual + ms;
    if (this.frozen_state) this.updateFrozenState(target_time);
  }

  /** 运行所有定时器直到队列为空 */
  public runAll() {
    this.throwIfDisposed();

    let count = 0;
    this.runMicrotasks();

    while (this.heap.size > 0) {
      this.checkLoopLimit(count++, 'timers');
      const next_timer = this.peekTimer()!;
      this.virtual_offset =
        next_timer.deadline - this.start_ts - this.system_offset;
      if (this.frozen_state) this.frozen_state.time = next_timer.deadline;
      this.execTimer(next_timer);
      this.runMicrotasks();
    }
  }

  /** 异步运行所有定时器，每次执行后等待 Promise 完成 */
  public async runAllAsync() {
    this.throwIfDisposed();

    let count = 0;
    await this.runMicrotasksAndFlushPromises();

    while (this.heap.size > 0) {
      this.checkLoopLimit(count++, 'timers');

      const next_timer = this.peekTimer()!;
      this.virtual_offset =
        next_timer.deadline - this.start_ts - this.system_offset;
      if (this.frozen_state) this.frozen_state.time = next_timer.deadline;
      this.execTimer(next_timer);

      await this.runMicrotasksAndFlushPromises();
    }
  }

  /** 前进到下一个定时器并执行 */
  public next() {
    this.throwIfDisposed();

    this.runMicrotasks();

    const next_timer = this.peekTimer();
    if (!next_timer) return;
    this.virtual_offset =
      next_timer.deadline - this.start_ts - this.system_offset;
    if (this.frozen_state) this.frozen_state.time = next_timer.deadline;
    this.execTimer(next_timer);

    this.runMicrotasks();
  }

  public async nextAsync() {
    this.throwIfDisposed();

    await this.runMicrotasksAndFlushPromises();

    const next_timer = this.peekTimer();
    if (!next_timer) return;
    this.virtual_offset =
      next_timer.deadline - this.start_ts - this.system_offset;
    if (this.frozen_state) this.frozen_state.time = next_timer.deadline;
    this.execTimer(next_timer);

    await this.runMicrotasksAndFlushPromises();
  }

  /** 刷新真实环境中的 Promise */
  public async realFlushPromises() {
    return this.manager.realFlushPromises();
  }
  /** 异步等待真实环境中的 Promise 完成 */
  public async realSleep(ms: number) {
    return this.manager.realSleep(ms);
  }

  // ============================================
  // 时间冻结控制
  // ============================================

  /** 冻结虚拟时间 */
  public freeze() {
    this.throwIfDisposed();
    if (this.frozen_state) return;
    this.frozen_state = {
      time: this.calcNow(),
      perf: this.calcPerf(),
      hr: this.calcHrtime(),
      uptime: this.calcUptime(),
      os_uptime: this.calcOsUptime(),
    };
  }

  /** 解冻虚拟时间 */
  public unfreeze() {
    this.throwIfDisposed();
    if (!this.frozen_state) return;
    this.frozen_state = null;
  }

  // 更新冻结状态
  private updateFrozenState(virtual_time: number) {
    const frozen_state = this.frozen_state!;

    const virtual_elapsed = this.virtual_offset;
    frozen_state.time = virtual_time;
    frozen_state.perf = this.start_perf + virtual_elapsed; // 性能时间只受偏移影响

    // 更新高精度时间（JS浮点数的精度足够表达了）
    const elapsed_ns = virtual_elapsed * 1e6;
    const start_ns = this.start_hr[0] * 1e9 + this.start_hr[1];
    const current_ns = start_ns + elapsed_ns;
    frozen_state.hr = [Math.floor(current_ns / 1e9), current_ns % 1e9];

    frozen_state.uptime = this.start_uptime + virtual_elapsed / 1000;
    frozen_state.os_uptime = this.start_os_uptime + virtual_elapsed / 1000;
  }

  // ============================================
  // 时间计算（内部方法）
  // ============================================

  // 计算当前虚拟时间（非冻结状态）
  private calcNow(): number {
    return this.start_ts + this.virtual_offset + this.system_offset;
  }

  /** 返回当前虚拟系统时间戳（毫秒） */
  public systemTime(): number {
    this.throwIfDisposed();
    if (this.frozen_state) return this.frozen_state.time;
    return this.calcNow();
  }

  // 计算当前虚拟性能时间（非冻结状态）
  private calcPerf(): number {
    return this.start_perf + this.virtual_offset;
  }

  /** 返回当前虚拟 performance.now() 值 */
  public perfNow(): number {
    this.throwIfDisposed();
    if (this.frozen_state) return this.frozen_state.perf;
    return this.calcPerf();
  }

  // 计算当前虚拟高精度时间（非冻结状态）
  private calcHrtime(): [number, number] {
    const elapsed_ns = this.virtual_offset * 1e6;
    const start_ns = this.start_hr[0] * 1e9 + this.start_hr[1];
    const current_ns = start_ns + elapsed_ns;
    return [Math.floor(current_ns / 1e9), current_ns % 1e9];
  }

  /** 返回虚拟高精度时间 [秒, 纳秒] */
  public hrtime(): [number, number] {
    this.throwIfDisposed();
    if (this.frozen_state) return this.frozen_state.hr;
    return this.calcHrtime();
  }

  /** 返回虚拟高精度时间（bigint 纳秒） */
  public hrtimeBigInt(): bigint {
    this.throwIfDisposed();
    const [s, ns] = this.hrtime();
    return BigInt(s) * BigInt(1000000000n) + BigInt(ns);
  }

  // 计算当前虚拟进程运行时间（非冻结状态）
  private calcUptime(): number {
    return this.start_uptime + this.virtual_offset / 1000;
  }

  /** 返回虚拟进程运行时间（秒） */
  public uptime(): number {
    this.throwIfDisposed();
    if (this.frozen_state) return this.frozen_state.uptime;
    return this.calcUptime();
  }

  // 计算当前虚拟系统运行时间（非冻结状态）
  private calcOsUptime(): number {
    return this.start_os_uptime + this.virtual_offset / 1000;
  }

  /** 返回虚拟系统运行时间（秒） */
  public osUptime(): number {
    this.throwIfDisposed();
    if (this.frozen_state) return this.frozen_state.os_uptime;
    return this.calcOsUptime();
  }

  // ============================================
  // 系统时间设置
  // ============================================

  /** 设置虚拟系统时间 */
  public setSystemTime(time?: number | Date): void {
    this.throwIfDisposed();

    const target_time =
      time === undefined
        ? this.start_ts + this.virtual_offset
        : typeof time === 'number'
          ? time
          : time.getTime();

    // system_offset 是相对于 start_ts + virtual_offset 的偏移
    this.system_offset = target_time - (this.start_ts + this.virtual_offset);
    if (this.frozen_state) this.updateFrozenState(target_time);
  }

  /** 运行调用前已存在的所有定时器（不包括执行中新加的） */
  public runPending() {
    this.throwIfDisposed();

    // 收集快照中的定时器并按 deadline 排序，确保时间顺序正确
    const pending_timers = [...this.heap.values()].sort(
      (a, b) => a.deadline - b.deadline,
    );

    let count = 0;
    this.runMicrotasks();

    for (const timer of pending_timers) {
      this.checkLoopLimit(count++, 'timers');

      // 跳过已被 clear 的定时器
      if (!this.heap.get(timer.id)) continue;

      this.virtual_offset = timer.deadline - this.start_ts - this.system_offset;
      this.execTimer(timer);
      this.runMicrotasks();
    }
  }

  /** 运行调用前已存在的所有定时器 */
  public async runPendingAsync() {
    this.throwIfDisposed();

    // 收集快照中的定时器并按 deadline 排序，确保时间顺序正确
    const pending_timers = [...this.heap.values()].sort(
      (a, b) => a.deadline - b.deadline,
    );

    let count = 0;
    await this.runMicrotasksAndFlushPromises();

    for (const timer of pending_timers) {
      this.checkLoopLimit(count++, 'timers');

      // 跳过已被 clear 的定时器
      if (!this.heap.get(timer.id)) continue;

      this.virtual_offset = timer.deadline - this.start_ts - this.system_offset;
      this.execTimer(timer);
      await this.runMicrotasksAndFlushPromises();
    }
  }

  // ============================================
  // 真实时间访问
  // ============================================

  /** 获取真实当前时间戳（毫秒） */
  public getRealNow(): number {
    this.throwIfDisposed();
    return this.manager.orig.DateNow();
  }

  /** 获取真实 performance.now() 值 */
  public getRealPerfNow(): number {
    this.throwIfDisposed();
    return this.manager.orig.perfNow();
  }

  /** 获取真实进程运行时间（秒） */
  public getRealUptime(): number {
    this.throwIfDisposed();
    return this.manager.orig.processUptime();
  }

  /** 获取真实高精度时间 */
  public getRealHrtime(time?: [number, number]): [number, number] {
    this.throwIfDisposed();
    return this.manager.orig.processHrtime(time);
  }

  /** 获取真实高精度时间（bigint） */
  public getRealHrtimeBigInt(): bigint {
    this.throwIfDisposed();
    return this.manager.orig.processHrtimeBigInt();
  }

  /** 获取真实系统运行时间（秒） */
  public getRealOsUptime(): number {
    this.throwIfDisposed();
    return this.manager.orig.osUptime();
  }

  // ============================================
  // 状态查询
  // ============================================

  /** 返回当前时间偏移量 */
  public getOffset(): number {
    this.throwIfDisposed();
    return this.system_offset;
  }

  /** 检查时间线是否冻结 */
  public isFrozen(): boolean {
    this.throwIfDisposed();
    return this.frozen_state !== null;
  }

  /** 销毁时间线 */
  public destroy() {
    if (this.is_disposed) return; // 确保幂等
    this.is_disposed = true;
    this.manager.removeFork(this.id);
    this.clear();
  }

  private clear() {
    this.heap.clear();

    // 清除 nextTick 队列
    this.next_tick_head = 0;
    this.next_tick_tail = 0;
    this.next_ticks.length = 0;

    // 清除 microtask 队列
    this.job_head = 0;
    this.job_tail = 0;
    this.jobs.length = 0;
  }

  [Symbol.dispose]() {
    this.destroy();
  }
}
