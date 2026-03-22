// ========================================
// ./src/MockClock/types.ts
// ========================================

import type {Timeline} from './Timeline';

// 可被 Mock 的 API 列表名称
export type MockTarget =
  | 'Date'
  | 'performance'
  | 'process'
  | 'os'
  | 'setTimeout'
  | 'setInterval'
  | 'setImmediate'
  | 'requestAnimationFrame'
  | 'nextTick'
  | 'queueMicrotask'
  | 'AbortSignal'
  | 'MessageChannel';

export type TimeStore = {
  id: string;
};

// 定时器类型枚举，用于区分不同类型的定时任务
export const enum TaskType {
  timeout,
  interval,
  immediate,
  animationFrame,
  messageChannel,
}

// ============================================
// Hook 上下文接口
// ============================================

export interface HookContext {
  getTimeline(): Timeline | null;
  shouldMock(api: MockTarget): boolean;
}

// ============================================
// 原始 API 存储接口
// ============================================

export interface OriginalAPIs {
  Date: DateConstructor;
  DateNow: () => number;
  DateTimeFormat: typeof Intl.DateTimeFormat;
  perfNow: () => number;
  processUptime: () => number;
  processHrtime: (time?: [number, number]) => [number, number];
  processHrtimeBigInt: () => bigint;
  osUptime: () => number;
  setTimeout: typeof setTimeout;
  setInterval: typeof setInterval;
  setImmediate: typeof setImmediate | undefined;
  clearTimeout: typeof clearTimeout;
  clearInterval: typeof clearInterval;
  clearImmediate: typeof clearImmediate | undefined;
  queueMicrotask: typeof queueMicrotask;
  nextTick: typeof process.nextTick;
  timeout: (delay: number) => AbortSignal;
  cancelAnimationFrame: typeof cancelAnimationFrame | undefined;
  requestAnimationFrame: typeof requestAnimationFrame | undefined;
  MessageChannel: typeof MessageChannel;
}

// ============================================
// 时间线构造参数
// ============================================

export interface TimelineInit {
  real_now: number;
  real_perf: number;
  real_hr: [number, number];
  real_proc_up: number;
  real_os_up: number;
}

// 定时器结构定义，表示一个宏任务
export interface Timer {
  id: number;
  type: TaskType;
  callback: (...args: unknown[]) => void;
  args: unknown[];
  delay: number;
  deadline: number;
  repeat?: number;
  ref: boolean;
  heap_index: number;
}

// 微任务结构定义
export type Job = {
  callback: (...args: unknown[]) => void;
  args: unknown[];
};

// 定时器引用接口，兼容 NodeJS.Timeout
export interface TimerRef {
  readonly id: number;
  ref(): this;
  unref(): this;
  hasRef(): boolean;
  refresh(): this;
  [Symbol.toPrimitive](): number;
  _idle_timeout: number;
  _repeat: number | null;
  _destroyed: boolean;
  _on_timeout?: (...args: unknown[]) => void;
  close(): void;
  [Symbol.dispose](): void;
}

// setImmediate 返回的引用接口
export interface ImmedRef {
  ref(): this;
  unref(): this;
  hasRef(): boolean;
  [Symbol.toPrimitive](): number;
}

// MessagePort 引用接口
export interface MessagePortRef {
  readonly id: number;
  close(): void;
  postMessage(message: unknown, transfer?: Transferable[]): void;
  start(): void;
}

// 默认 Mock 配置：大部分 API 默认开启 mock，微任务相关默认关闭
export const DEFAULT_CONFIG: Record<MockTarget, boolean> = {
  Date: true,
  performance: true,
  process: true,
  os: true,
  setTimeout: true,
  setInterval: true,
  setImmediate: true,
  requestAnimationFrame: true,
  AbortSignal: true,
  nextTick: false,
  queueMicrotask: false,
  MessageChannel: false,
};

// MockClock 初始化配置选项
export interface ClockOpts {
  loop_limit?: number;
  frozen?: boolean;
  Date?: boolean;
  performance?: boolean;
  process?: boolean;
  os?: boolean;
  setTimeout?: boolean;
  setInterval?: boolean;
  setImmediate?: boolean;
  requestAnimationFrame?: boolean;
  nextTick?: boolean;
  queueMicrotask?: boolean;
  AbortSignal?: boolean;
  MessageChannel?: boolean;
}
