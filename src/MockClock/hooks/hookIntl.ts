// ========================================
// ./src/MockClock/hooks/hookIntl.ts
// ========================================

import type {HookContext, OriginalAPIs} from '../types';

export function hookIntl(ctx: HookContext, orig: OriginalAPIs) {
  const _orig_dtf = orig.DateTimeFormat;

  class MockDateTimeFormat extends _orig_dtf {
    constructor(
      locales?: string | string[],
      options?: Intl.DateTimeFormatOptions,
    ) {
      super(locales, options);
    }

    format(date?: number | Date): string {
      if (arguments.length === 0) {
        if (ctx.shouldMock('Date')) {
          return super.format(ctx.getTimeline()!.systemTime());
        }
        return super.format(orig.DateNow());
      }
      return super.format(date);
    }

    formatToParts(date?: number | Date): Intl.DateTimeFormatPart[] {
      if (arguments.length === 0) {
        if (ctx.shouldMock('Date')) {
          return super.formatToParts(ctx.getTimeline()!.systemTime());
        }
        return super.formatToParts(orig.DateNow());
      }
      return super.formatToParts(date);
    }
  }

  const Wrapper = function (
    locales?: string | string[],
    options?: Intl.DateTimeFormatOptions,
  ) {
    if (new.target) {
      return new MockDateTimeFormat(locales, options);
    }
    return new MockDateTimeFormat(locales, options);
  };

  Object.setPrototypeOf(Wrapper, _orig_dtf);
  Wrapper.prototype = MockDateTimeFormat.prototype;
  globalThis.Intl.DateTimeFormat =
    Wrapper as unknown as typeof Intl.DateTimeFormat;
}

export function restoreIntl(orig: OriginalAPIs) {
  Intl.DateTimeFormat = orig.DateTimeFormat;
}
