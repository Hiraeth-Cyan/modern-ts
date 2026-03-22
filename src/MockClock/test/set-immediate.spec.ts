// ========================================
// ./src/MockClock/test/set-immediate.spec.ts
// ========================================
/**
 * @vitest-environment-options { "isolate": true }
 */
import {describe, it, expect, afterEach, beforeEach} from 'vitest';
import {MockClock, runTimeline, restoreGlobals} from '../__export__';
import {VirtualTimeManager} from '../VirtualTimeManager';

describe('setImmediate', () => {
  let _orig_set_immediate: typeof setImmediate | undefined;
  let _orig_clear_immediate: typeof clearImmediate | undefined;

  beforeEach(() => {
    _orig_set_immediate = globalThis.setImmediate;
    _orig_clear_immediate = globalThis.clearImmediate;
    // @ts-expect-error 取消立即执行可能不存在
    delete globalThis.setImmediate;
    // @ts-expect-error 取消立即执行可能不存在
    delete globalThis.clearImmediate;
  });

  afterEach(() => {
    restoreGlobals();
    if (_orig_set_immediate === undefined) {
      // @ts-expect-error 取消立即执行可能不存在
      delete globalThis.setImmediate;
    } else {
      globalThis.setImmediate = _orig_set_immediate;
    }
    if (_orig_clear_immediate === undefined) {
      // @ts-expect-error 取消立即执行可能不存在
      delete globalThis.clearImmediate;
    } else {
      globalThis.clearImmediate = _orig_clear_immediate;
    }
  });

  // ============================================
  // setImmediate 不存在时的行为
  // ============================================
  describe('when setImmediate does not exist', () => {
    it('should work without setImmediate', () => {
      const clock = MockClock();
      let executed = false;
      runTimeline(clock, () => {
        setTimeout(() => {
          executed = true;
        }, 0);
        clock.tick(0);
      });
      expect(executed).toBe(true);
      clock.destroy();
    });

    it('should not have setImmediate available', () => {
      MockClock();
      expect(globalThis.setImmediate).toBeUndefined();
      restoreGlobals();
      expect(globalThis.setImmediate).toBeUndefined();
    });
  });

  // ============================================
  // 无 Timeline 时
  // ============================================
  describe('without timeline', () => {
    it('should work with other timers when setImmediate is absent', () => {
      restoreGlobals();
      const manager = VirtualTimeManager.getInstance();
      const fork = manager.createFork({setTimeout: true});
      let executed = false;
      manager.run(fork, () => {
        setTimeout(() => {
          executed = true;
        }, 10);
        fork.tick(10);
      });
      expect(executed).toBe(true);
      fork.destroy();
    });
  });
});
