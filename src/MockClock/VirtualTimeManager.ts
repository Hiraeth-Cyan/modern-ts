// ========================================
// ./src/MockClock/VirtualTimeManager.ts
// ========================================

import {AsyncLocalStorage} from 'async_hooks';
import os from 'os';
import type {MaybePromise} from '../Utils/type-tool';
import {Timeline, type TimelinePublic} from './Timeline';
import type {MockTarget, ClockOpts, TimeStore, OriginalAPIs} from './types';
import {
  hookDate,
  hookIntl,
  hookPerformance,
  hookProcess,
  hookOs,
  hookTimers,
  hookMicrotasks,
  hookAbortSignal,
  hookMessageChannel,
  restoreDate,
  restoreIntl,
  restorePerformance,
  restoreProcess,
  restoreOs,
  restoreTimers,
  restoreMicrotasks,
  restoreAbortSignal,
  restoreMessageChannel,
} from './hooks/__export__';

export class VirtualTimeManager {
  private static instance: VirtualTimeManager | null = null; // 单例模式
  private forks = new Map<string, Timeline>(); // 管理所有时间线
  private store = new AsyncLocalStorage<TimeStore>(); // 管理并发上下文
  private timeline_id_counter = 0; // 时间线id计数器，确保时间线不重复

  public readonly orig: OriginalAPIs;
  private constructor() {
    this.orig = {
      Date: globalThis.Date,
      DateNow: Date.now.bind(Date),
      DateTimeFormat: Intl.DateTimeFormat,
      perfNow: performance.now.bind(performance),
      processUptime: process.uptime.bind(process),
      processHrtime: process.hrtime.bind(process),
      processHrtimeBigInt: process.hrtime.bigint.bind(process),
      osUptime: os.uptime.bind(os),
      setTimeout: globalThis.setTimeout,
      setInterval: globalThis.setInterval,
      setImmediate: globalThis.setImmediate,
      clearTimeout: globalThis.clearTimeout,
      clearInterval: globalThis.clearInterval,
      clearImmediate: globalThis.clearImmediate,
      queueMicrotask: globalThis.queueMicrotask,
      nextTick: process.nextTick.bind(process),
      timeout: AbortSignal.timeout.bind(AbortSignal),
      cancelAnimationFrame: globalThis.cancelAnimationFrame,
      requestAnimationFrame: globalThis.requestAnimationFrame,
      MessageChannel: globalThis.MessageChannel,
    };
    this.setupHooks();
  }

  // 获取单例
  public static getInstance(): VirtualTimeManager {
    if (!VirtualTimeManager.instance)
      VirtualTimeManager.instance = new VirtualTimeManager();
    return VirtualTimeManager.instance;
  }

  // 检查是否存在单例
  public static hasInstance(): boolean {
    return VirtualTimeManager.instance !== null;
  }

  // 销毁并还原
  public static destroyInstance() {
    if (!VirtualTimeManager.instance) return;
    const manager = VirtualTimeManager.instance;
    for (const fork of manager.forks.values()) fork.destroy();

    restoreDate(manager.orig);
    restoreIntl(manager.orig);
    restorePerformance(manager.orig);
    restoreProcess(manager.orig);
    restoreOs(manager.orig);
    restoreTimers(manager.orig);
    restoreMicrotasks(manager.orig);
    restoreAbortSignal(manager.orig);
    restoreMessageChannel(manager.orig);

    manager.forks.clear();
    VirtualTimeManager.instance = null;
  }

  // 获取当前时间线
  private getTimeline(): Timeline | null {
    const store = this.store.getStore();
    if (!store?.id) return null;
    return this.forks.get(store.id) ?? null;
  }

  // 检查是否需要模拟
  private shouldMock(api: MockTarget): boolean {
    const timeline = this.getTimeline();
    if (!timeline) return false;
    return timeline.isMocked(api);
  }

  // 设置钩子
  private setupHooks() {
    const ctx = {
      getTimeline: () => this.getTimeline(),
      shouldMock: (api: MockTarget) => this.shouldMock(api),
    };

    hookDate(ctx, this.orig);
    hookIntl(ctx, this.orig);
    hookPerformance(ctx, this.orig);
    hookProcess(ctx, this.orig);
    hookOs(ctx, this.orig);
    hookTimers(ctx, this.orig);
    hookMicrotasks(ctx, this.orig);
    hookAbortSignal(ctx, this.orig);
    hookMessageChannel(ctx, this.orig);
  }

  // ============================================
  // 时间线管理
  // ============================================

  public createFork(options?: ClockOpts): Timeline {
    const hex_id = (this.timeline_id_counter++)
      .toString(16)
      .toUpperCase()
      .padStart(4, '0');
    const id = `TimeLine-${hex_id}`;
    const fork = new Timeline(
      id,
      this,
      this.orig.DateNow(),
      this.orig.perfNow(),
      this.orig.processHrtime(),
      this.orig.processUptime(),
      this.orig.osUptime(),
      options ?? {},
    );
    this.forks.set(id, fork);
    return fork;
  }

  public removeFork(id: string) {
    this.forks.delete(id);
  }

  /* v8 ignore next -- @preserve */
  public realFlushPromises(): Promise<void> {
    if (typeof this.orig.setImmediate === 'function')
      return new Promise((resolve) => {
        this.orig.setImmediate!(resolve);
      });

    if (typeof this.orig.MessageChannel !== 'undefined')
      return new Promise((resolve) => {
        const channel = new this.orig.MessageChannel();
        channel.port1.onmessage = () => {
          resolve();
        };
        channel.port2.postMessage(null);
      });

    return new Promise((resolve) => {
      this.orig.setTimeout(resolve, 0);
    });
  }

  public realSleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.orig.setTimeout(resolve, ms);
    });
  }

  // ============================================
  // 上下文执行
  // ============================================

  public run(
    fork: Timeline | TimelinePublic,
    callback: () => MaybePromise<void>,
  ) {
    this.store.run({id: fork.id}, callback);
  }

  public async runAsync(
    fork: Timeline | TimelinePublic,
    callback: () => MaybePromise<void>,
  ): Promise<void> {
    await this.store.run({id: fork.id}, async () => {
      await callback();
    });
  }
}
