// ========================================
// ./src/MockClock/hooks/hookAbortSignal.ts
// ========================================

import type {HookContext, OriginalAPIs} from '../types';
import {TaskType} from '../types';

export function hookAbortSignal(ctx: HookContext, orig: OriginalAPIs) {
  const _orig_timeout = orig.timeout;

  AbortSignal.timeout = (delay: number): AbortSignal => {
    if (!ctx.shouldMock('AbortSignal')) return _orig_timeout(delay);

    const controller = new AbortController();
    const signal = controller.signal;

    // 清理函数：移除定时器和事件监听器
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      timer_ref.close();
      signal.removeEventListener('abort', on_abort);
    };

    const timer_ref = ctx.getTimeline()!.addTimer(
      TaskType.timeout,
      () => {
        controller.abort(
          new DOMException(
            'The operation was aborted due to timeout',
            'TimeoutError',
          ),
        );
        cleanup();
      },
      delay,
      [],
    );

    // 外部主动 abort 时清理定时器
    const on_abort = () => cleanup();
    signal.addEventListener('abort', on_abort);

    return signal;
  };
}

export function restoreAbortSignal(orig: OriginalAPIs) {
  AbortSignal.timeout = orig.timeout;
}
