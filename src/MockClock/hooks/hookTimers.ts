// ========================================
// ./src/MockClock/hooks/hookTimers.ts
// ========================================

import type {HookContext, OriginalAPIs} from '../types';
import {TaskType} from '../types';
import {
  MockTimerHandle,
  NativeTimerHandle,
  NativeImmedHandle,
} from '../TimerHandle';
import type {TimerRef, ImmedRef} from '../types';

export function hookTimers(ctx: HookContext, orig: OriginalAPIs) {
  const _orig_set_timeout = orig.setTimeout;
  const _orig_clear_timeout = orig.clearTimeout;
  const _orig_set_interval = orig.setInterval;
  const _orig_clear_interval = orig.clearInterval;

  const mockedSetTimeout = Object.assign(
    <TArgs extends unknown[]>(
      callback: (...args: TArgs) => void,
      delay?: number,
      ...args: TArgs
    ): TimerRef => {
      if (!ctx.shouldMock('setTimeout')) {
        const cb = callback as (...args: unknown[]) => void;
        const handle = _orig_set_timeout(cb, delay, ...args);
        return new NativeTimerHandle(handle, delay ?? 0, cb);
      }

      return ctx
        .getTimeline()!
        .addTimer(
          TaskType.timeout,
          callback as (...args: unknown[]) => void,
          delay ?? 0,
          args,
        );
    },
    {__promisify__: _orig_set_timeout.__promisify__},
  );
  globalThis.setTimeout = mockedSetTimeout as unknown as typeof setTimeout;

  const mockedClearTimeout = (id?: unknown) => {
    if (
      id instanceof NativeTimerHandle ||
      (id && !ctx.shouldMock('setTimeout'))
    ) {
      if (id instanceof NativeTimerHandle) _orig_clear_timeout(id.handle);
      else _orig_clear_timeout(id as NodeJS.Timeout);
      return;
    }

    const timeline = ctx.getTimeline();
    if (id instanceof MockTimerHandle) {
      timeline?.removeTimer(id.id);
      return;
    }
    if (typeof id === 'number') {
      timeline?.removeTimer(id);
      return;
    }
    _orig_clear_timeout(id as NodeJS.Timeout);
  };
  globalThis.clearTimeout = mockedClearTimeout as typeof clearTimeout;

  const mockedSetInterval = (
    callback: (...args: unknown[]) => void,
    delay?: number,
    ...args: unknown[]
  ): TimerRef => {
    if (!ctx.shouldMock('setInterval')) {
      const handle = _orig_set_interval(callback, delay, ...args);
      const result = new NativeTimerHandle(handle, delay ?? 0, callback);
      result._repeat = delay ?? 0;
      return result;
    }

    return ctx
      .getTimeline()!
      .addTimer(TaskType.interval, callback, delay ?? 0, args);
  };
  globalThis.setInterval = mockedSetInterval as unknown as typeof setInterval;

  const mockedClearInterval = (id?: unknown) => {
    if (
      id instanceof NativeTimerHandle ||
      (id && !ctx.shouldMock('setInterval'))
    ) {
      if (id instanceof NativeTimerHandle) _orig_clear_interval(id.handle);
      else _orig_clear_interval(id as NodeJS.Timeout);
      return;
    }

    const timeline = ctx.getTimeline();
    if (id instanceof MockTimerHandle) {
      timeline?.removeTimer(id.id);
      return;
    }
    if (typeof id === 'number') {
      timeline?.removeTimer(id);
      return;
    }
    _orig_clear_interval(id as NodeJS.Timeout);
  };
  globalThis.clearInterval = mockedClearInterval as typeof clearInterval;

  if (orig.setImmediate) {
    hookImmediate(ctx, orig);
  }

  if (orig.requestAnimationFrame) {
    hookRAF(ctx, orig);
  }
}

function hookImmediate(ctx: HookContext, orig: OriginalAPIs) {
  const _orig_set_immediate = orig.setImmediate!;
  const _orig_clear_immediate = orig.clearImmediate!;

  const mockedSetImmediate = Object.assign(
    <TArgs extends unknown[]>(
      callback: (...args: TArgs) => void,
      ...args: TArgs
    ): ImmedRef => {
      if (!ctx.shouldMock('setImmediate')) {
        const handle = _orig_set_immediate(
          callback as (...args: unknown[]) => void,
          ...args,
        );
        return new NativeImmedHandle(handle);
      }

      return ctx
        .getTimeline()!
        .addTimer(
          TaskType.immediate,
          callback as (...args: unknown[]) => void,
          0,
          args,
        );
    },
    {__promisify__: _orig_set_immediate.__promisify__},
  );
  globalThis.setImmediate =
    mockedSetImmediate as unknown as typeof setImmediate;

  const mockedClearImmediate = (id?: unknown) => {
    if (
      id instanceof NativeImmedHandle ||
      (id && !ctx.shouldMock('setImmediate'))
    ) {
      if (id instanceof NativeImmedHandle) _orig_clear_immediate(id.handle);
      else _orig_clear_immediate(id as NodeJS.Immediate);
      return;
    }

    const timeline = ctx.getTimeline();
    if (id instanceof MockTimerHandle) {
      timeline?.removeTimer(id.id);
      return;
    }
    _orig_clear_immediate(id as NodeJS.Immediate);
  };
  globalThis.clearImmediate = mockedClearImmediate as typeof clearImmediate;
}

function hookRAF(ctx: HookContext, orig: OriginalAPIs) {
  const _orig_raf = orig.requestAnimationFrame!;
  const _orig_cancel_raf = orig.cancelAnimationFrame!;

  const mockedRAF = (callback: FrameRequestCallback): number => {
    if (!ctx.shouldMock('requestAnimationFrame')) {
      return _orig_raf(callback);
    }

    return ctx
      .getTimeline()!
      .addTimer(
        TaskType.animationFrame,
        (time: unknown) => callback(time as number),
        16,
        [],
      ).id;
  };
  globalThis.requestAnimationFrame = mockedRAF as typeof requestAnimationFrame;

  globalThis.cancelAnimationFrame = (id: number) => {
    if (!ctx.shouldMock('requestAnimationFrame')) {
      _orig_cancel_raf(id);
      return;
    }

    ctx.getTimeline()!.removeTimer(id);
  };
}

export function restoreTimers(orig: OriginalAPIs) {
  globalThis.setTimeout = orig.setTimeout;
  globalThis.clearTimeout = orig.clearTimeout;
  globalThis.setInterval = orig.setInterval;
  globalThis.clearInterval = orig.clearInterval;

  if (orig.setImmediate) {
    globalThis.setImmediate = orig.setImmediate;
    globalThis.clearImmediate = orig.clearImmediate!;
  }
  if (orig.requestAnimationFrame) {
    globalThis.requestAnimationFrame = orig.requestAnimationFrame;
    globalThis.cancelAnimationFrame = orig.cancelAnimationFrame!;
  }
}
