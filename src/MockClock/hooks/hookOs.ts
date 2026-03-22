// ========================================
// ./src/MockClock/hooks/hookOs.ts
// ========================================

import os from 'os';
import type {HookContext, OriginalAPIs} from '../types';

export function hookOs(ctx: HookContext, orig: OriginalAPIs) {
  const _orig_os_uptime = orig.osUptime;

  os.uptime = () => {
    if (!ctx.shouldMock('os')) return _orig_os_uptime();
    return ctx.getTimeline()!.osUptime();
  };
}

export function restoreOs(orig: OriginalAPIs) {
  os.uptime = orig.osUptime;
}
