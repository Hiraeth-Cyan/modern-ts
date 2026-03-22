// ========================================
// ./src/MockClock/hooks/hookDate.ts
// ========================================

import type {HookContext, OriginalAPIs} from '../types';

export function hookDate(ctx: HookContext, orig: OriginalAPIs) {
  const _orig_date = orig.Date;

  const getVirtualTime = () => {
    if (!ctx.shouldMock('Date')) return orig.DateNow();
    return ctx.getTimeline()!.systemTime();
  };

  globalThis.Date = function (this: Date, ...args: unknown[]) {
    if (!(this instanceof Date))
      return new _orig_date(getVirtualTime()).toString();

    if (args.length === 0 && !ctx.shouldMock('Date')) return new _orig_date();

    if (args.length === 0) return new _orig_date(getVirtualTime());

    return Reflect.construct(_orig_date, args) as Date;
  } as unknown as DateConstructor;

  Date.now = getVirtualTime;
  Date.UTC = _orig_date.UTC;
  Date.parse = _orig_date.parse;
  Object.setPrototypeOf(Date, _orig_date);
}

export function restoreDate(orig: OriginalAPIs) {
  globalThis.Date = orig.Date;
}
