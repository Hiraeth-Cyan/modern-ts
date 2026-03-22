// ========================================
// ./src/MockClock/test/timer-handle.spec.ts
// ========================================
/**
 * @vitest-environment-options { "isolate": true }
 */
import {describe, it, expect, afterEach, beforeEach} from 'vitest';
import {
  MockClock,
  runTimeline,
  restoreGlobals,
  MockTimerHandle,
  NativeTimerHandle,
  NativeImmedHandle,
} from '../__export__';

describe('TimerHandle', () => {
  afterEach(() => {
    restoreGlobals();
  });

  // ============================================
  // MockTimerHandle
  // ============================================
  describe('MockTimerHandle', () => {
    it.concurrent('should create handle with correct properties', () => {
      const clock = MockClock();
      let handle: MockTimerHandle | null = null;
      runTimeline(clock, () => {
        handle = setTimeout(() => {}, 100) as unknown as MockTimerHandle;
      });
      expect(handle).not.toBeNull();
      expect(handle!.id).toBeDefined();
      expect(handle!._idle_timeout).toBe(100);
      clock.destroy();
    });

    it.concurrent('should support ref, unref, refresh and close', () => {
      const clock = MockClock();
      runTimeline(clock, () => {
        const handle = setTimeout(() => {}, 100) as unknown as MockTimerHandle;
        handle.ref();
        expect(handle.hasRef()).toBe(true);
        handle.unref();
        expect(handle.hasRef()).toBe(false);
        expect(handle.refresh()).toBe(handle);
        handle.close();
        expect(handle._destroyed).toBe(true);
        // 已销毁时的操作
        expect(handle.hasRef()).toBe(false);
        expect(handle.ref()).toBe(handle);
        expect(handle.unref()).toBe(handle);
      });
      clock.destroy();
    });

    it.concurrent(
      'should support Symbol.toPrimitive and Symbol.dispose',
      () => {
        const clock = MockClock();
        runTimeline(clock, () => {
          const handle = setTimeout(
            () => {},
            100,
          ) as unknown as MockTimerHandle;
          expect(Number(handle)).toBe(handle.id);
          handle[Symbol.dispose]();
          expect(handle._destroyed).toBe(true);
        });
        clock.destroy();
      },
    );

    it.concurrent(
      'should set _repeat for interval and null for timeout',
      () => {
        const clock = MockClock();
        runTimeline(clock, () => {
          const timeoutHandle = setTimeout(
            () => {},
            100,
          ) as unknown as MockTimerHandle;
          const intervalHandle = setInterval(
            () => {},
            100,
          ) as unknown as MockTimerHandle;
          expect(timeoutHandle._repeat).toBeNull();
          expect(intervalHandle._repeat).toBe(100);
        });
        clock.destroy();
      },
    );

    it('should cover MockTimerHandle _onImmediate', () => {
      const clock = MockClock();
      let called = false;
      runTimeline(clock, () => {
        const handle = setImmediate(() => {
          called = true;
        }) as unknown as MockTimerHandle;
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(handle._onImmediate).toBeDefined();
        handle._onImmediate();
      });
      expect(called).toBe(true);
      clock.destroy();
    });

    it('should handle refresh after timer is cleared', () => {
      const clock = MockClock();
      runTimeline(clock, () => {
        const handle = setTimeout(() => {}, 100) as unknown as MockTimerHandle;
        handle.close();
        expect(() => handle.refresh()).not.toThrow();
      });
      clock.destroy();
    });
  });

  // ============================================
  // NativeTimerHandle
  // ============================================
  describe('NativeTimerHandle', () => {
    beforeEach(() => {
      restoreGlobals();
    });

    it.concurrent(
      'should create native handle when setTimeout/setInterval not mocked',
      () => {
        const clock = MockClock({setTimeout: false, setInterval: false});
        runTimeline(clock, () => {
          const timeoutHandle = setTimeout(() => {}, 100);
          const intervalHandle = setInterval(() => {}, 100);
          expect(timeoutHandle).toBeInstanceOf(NativeTimerHandle);
          expect(intervalHandle).toBeInstanceOf(NativeTimerHandle);
          clearTimeout(timeoutHandle);
          clearInterval(intervalHandle);
        });
        clock.destroy();
      },
    );

    it.concurrent(
      'should support ref, unref, refresh, close on native handle',
      () => {
        const clock = MockClock({setTimeout: false});
        runTimeline(clock, () => {
          const handle = setTimeout(
            () => {},
            100,
          ) as unknown as NativeTimerHandle;
          handle.ref();
          expect(handle.hasRef()).toBe(true);
          handle.unref();
          expect(handle.refresh()).toBe(handle);
          handle.close();
          expect(handle._destroyed).toBe(true);
        });
        clock.destroy();
      },
    );

    it.concurrent(
      'should support Symbol.toPrimitive and Symbol.dispose on native handle',
      () => {
        const clock = MockClock({setTimeout: false});
        runTimeline(clock, () => {
          const handle = setTimeout(
            () => {},
            100,
          ) as unknown as NativeTimerHandle;
          expect(Number(handle)).toBe(handle.id);
          handle[Symbol.dispose]();
          expect(handle._destroyed).toBe(true);
        });
        clock.destroy();
      },
    );

    it.concurrent('should set _repeat for native interval', () => {
      const clock = MockClock({setInterval: false});
      runTimeline(clock, () => {
        const handle = setInterval(
          () => {},
          100,
        ) as unknown as NativeTimerHandle;
        expect(handle._repeat).toBe(100);
        clearInterval(handle);
      });
      clock.destroy();
    });

    it('should cover NativeTimerHandle _onTimeout', () => {
      const clock = MockClock({setTimeout: false});
      runTimeline(clock, () => {
        const handle = setTimeout(
          () => {},
          100,
        ) as unknown as NativeTimerHandle;
        expect(() => handle._onTimeout()).not.toThrow();
        clearTimeout(handle);
      });
      clock.destroy();
    });
  });

  // ============================================
  // NativeImmedHandle
  // ============================================
  describe('NativeImmedHandle', () => {
    beforeEach(() => {
      restoreGlobals();
    });

    it.concurrent(
      'should create native immediate handle when not mocked',
      () => {
        const clock = MockClock({setImmediate: false});
        runTimeline(clock, () => {
          const handle = setImmediate(() => {}) as unknown as NativeImmedHandle;
          expect(handle).toBeInstanceOf(NativeImmedHandle);
          clearImmediate(handle);
        });
        clock.destroy();
      },
    );

    it.concurrent(
      'should support ref, unref and Symbol.toPrimitive on native immediate handle',
      () => {
        const clock = MockClock({setImmediate: false});
        runTimeline(clock, () => {
          const handle = setImmediate(() => {}) as unknown as NativeImmedHandle;
          handle.ref();
          expect(handle.hasRef()).toBe(true);
          handle.unref();
          expect(Number(handle)).toBe(handle['_id']);
          clearImmediate(handle);
        });
        clock.destroy();
      },
    );

    it('should cover NativeImmedHandle _onImmediate and Symbol.dispose', () => {
      const clock = MockClock({setImmediate: false});
      runTimeline(clock, () => {
        const handle = setImmediate(() => {}) as unknown as NativeImmedHandle;
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(handle._onImmediate).toBeDefined();
        expect(() => handle._onImmediate()).not.toThrow();
        handle[Symbol.dispose]();
      });
      clock.destroy();
    });
  });

  // ============================================
  // clear operations
  // ============================================
  describe('clear operations', () => {
    it.concurrent(
      'should handle clearTimeout/clearInterval/clearImmediate with number',
      () => {
        const clock = MockClock();
        runTimeline(clock, () => {
          const timeoutId = setTimeout(() => {}, 100);
          const intervalId = setInterval(() => {}, 100);
          const immediateId = setImmediate(() => {});
          clearTimeout(timeoutId);
          clearInterval(intervalId);
          clearImmediate(immediateId);
        });
        expect(clock.timerCount).toBe(0);
        clock.destroy();
      },
    );

    it.concurrent(
      'should handle clearTimeout/clearInterval/clearImmediate with native handle',
      () => {
        const clock = MockClock({
          setTimeout: false,
          setInterval: false,
          setImmediate: false,
        });
        runTimeline(clock, () => {
          const timeoutHandle = setTimeout(
            () => {},
            100,
          ) as unknown as NativeTimerHandle;
          const intervalHandle = setInterval(
            () => {},
            100,
          ) as unknown as NativeTimerHandle;
          const immediateHandle = setImmediate(
            () => {},
          ) as unknown as NativeImmedHandle;
          clearTimeout(timeoutHandle);
          clearInterval(intervalHandle);
          clearImmediate(immediateHandle);
        });
        clock.destroy();
      },
    );

    it.concurrent('should handle clearImmediate with MockTimerHandle', () => {
      const clock = MockClock({setImmediate: true});
      runTimeline(clock, () => {
        const handle = setImmediate(() => {}) as unknown as MockTimerHandle;
        clearImmediate(handle);
      });
      expect(clock.timerCount).toBe(0);
      clock.destroy();
    });
  });
});
