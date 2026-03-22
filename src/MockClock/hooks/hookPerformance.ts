// ========================================
// ./src/MockClock/hooks/hookPerformance.ts
// ========================================

import type {HookContext, OriginalAPIs} from '../types';

export function hookPerformance(ctx: HookContext, orig: OriginalAPIs) {
  const _orig_perf_now = orig.perfNow;

  performance.now = () => {
    if (!ctx.shouldMock('performance')) return _orig_perf_now();
    return ctx.getTimeline()!.perfNow();
  };
}

export function restorePerformance(orig: OriginalAPIs) {
  performance.now = orig.perfNow;
}
