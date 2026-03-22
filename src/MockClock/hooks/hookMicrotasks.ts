// ========================================
// ./src/MockClock/hooks/hookMicrotasks.ts
// ========================================

import type {HookContext, OriginalAPIs} from '../types';

export function hookMicrotasks(ctx: HookContext, orig: OriginalAPIs) {
  const _orig_next_tick = orig.nextTick;
  const _orig_queue_microtask = orig.queueMicrotask;

  const mockedNextTick = (
    callback: (...args: unknown[]) => void,
    ...args: unknown[]
  ) => {
    if (!ctx.shouldMock('nextTick')) {
      _orig_next_tick(callback, ...args);
      return;
    }

    ctx.getTimeline()!.addNextTick(callback, args);
  };
  process.nextTick = mockedNextTick as typeof process.nextTick;

  globalThis.queueMicrotask = (callback: () => void) => {
    if (!ctx.shouldMock('queueMicrotask')) {
      _orig_queue_microtask(callback);
      return;
    }

    ctx.getTimeline()!.addJob(callback, []);
  };
}

export function restoreMicrotasks(orig: OriginalAPIs) {
  globalThis.queueMicrotask = orig.queueMicrotask;
  process.nextTick = orig.nextTick;
}
