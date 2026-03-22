// ========================================
// ./src/MockClock/test/raf.spec.ts
// ========================================
/**
 * @vitest-environment-options { "isolate": true }
 */

import {describe, it, expect, afterEach, beforeEach} from 'vitest';
import {MockClock, runTimeline, restoreGlobals} from '../__export__';
import {VirtualTimeManager} from '../VirtualTimeManager';

describe('requestAnimationFrame', () => {
  let _orig_raf: typeof requestAnimationFrame | undefined;
  let _orig_cancel_raf: typeof cancelAnimationFrame | undefined;

  beforeEach(() => {
    _orig_raf = globalThis.requestAnimationFrame;
    _orig_cancel_raf = globalThis.cancelAnimationFrame;
    let _raf_id = 0;
    globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => {
      const id = ++_raf_id;
      setTimeout(() => cb(Date.now()), 16);
      return id;
    };
    globalThis.cancelAnimationFrame = () => {};
  });

  afterEach(() => {
    restoreGlobals();
    if (_orig_raf === undefined) {
      // @ts-expect-error 取消动画帧可能不存在
      delete globalThis.requestAnimationFrame;
    } else {
      globalThis.requestAnimationFrame = _orig_raf;
    }
    if (_orig_cancel_raf === undefined) {
      // @ts-expect-error 取消动画帧可能不存在
      delete globalThis.cancelAnimationFrame;
    } else {
      globalThis.cancelAnimationFrame = _orig_cancel_raf;
    }
  });

  // ============================================
  // Timeline 中的 RAF
  // ============================================
  describe('in Timeline', () => {
    it.concurrent('should handle requestAnimationFrame when mocked', () => {
      const clock = MockClock();
      let frame_time: number | null = null;
      runTimeline(clock, () => {
        requestAnimationFrame((time) => {
          frame_time = time;
        });
        clock.tick(16);
      });
      expect(frame_time).toBe(clock.systemTime() - 16);
      clock.destroy();
    });

    it.concurrent('should handle requestAnimationFrame when not mocked', () => {
      const clock = MockClock({requestAnimationFrame: false});
      runTimeline(clock, () => {
        const id = requestAnimationFrame(() => {});
        cancelAnimationFrame(id);
      });
      clock.destroy();
    });

    it.concurrent('should handle cancelAnimationFrame when mocked', () => {
      const clock = MockClock({requestAnimationFrame: true});
      runTimeline(clock, () => {
        const id = requestAnimationFrame(() => {});
        cancelAnimationFrame(id);
      });
      expect(clock.timerCount).toBe(0);
      clock.destroy();
    });
  });

  // ============================================
  // 无 Timeline 时的 RAF
  // ============================================
  describe('without timeline', () => {
    it('should handle mocked requestAnimationFrame with no timeline', () => {
      restoreGlobals();
      const manager = VirtualTimeManager.getInstance();
      const fork = manager.createFork({requestAnimationFrame: true});
      const id = requestAnimationFrame(() => {});
      expect(typeof id).toBe('number');
      fork.destroy();
    });
  });
});
