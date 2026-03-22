// ========================================
// ./src/MockClock/hooks/hookProcess.ts
// ========================================

import type {HookContext, OriginalAPIs} from '../types';

export function hookProcess(ctx: HookContext, orig: OriginalAPIs) {
  const _orig_uptime = orig.processUptime;
  const _orig_hrtime = orig.processHrtime;
  const _orig_hrtime_big_int = orig.processHrtimeBigInt;

  process.uptime = () => {
    if (!ctx.shouldMock('process')) return _orig_uptime();
    return ctx.getTimeline()!.uptime();
  };

  const newHrtime = (time?: [number, number]): [number, number] => {
    if (!ctx.shouldMock('process')) return _orig_hrtime(time);

    const now = ctx.getTimeline()!.hrtime();
    if (!time) return now;
    let sec = now[0] - time[0];
    let nsec = now[1] - time[1];
    if (nsec < 0) {
      sec -= 1;
      nsec += 1e9;
    }
    return [sec, nsec];
  };

  newHrtime.bigint = (): bigint => {
    if (!ctx.shouldMock('process')) return _orig_hrtime_big_int();
    return ctx.getTimeline()!.hrtimeBigInt();
  };

  process.hrtime = newHrtime;
}

export function restoreProcess(orig: OriginalAPIs) {
  process.uptime = orig.processUptime;
  const hrtime_fn = orig.processHrtime as NodeJS.HRTime;
  hrtime_fn.bigint = orig.processHrtimeBigInt;
  process.hrtime = hrtime_fn;
}
