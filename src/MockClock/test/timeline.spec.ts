// ========================================
// ./src/MockClock/test/timeline.spec.ts
// ========================================
/**
 * @vitest-environment-options { "isolate": true }
 */

import {describe, it, expect, afterEach, vi} from 'vitest';
import os from 'os';
import {
  MockClock,
  runTimeline,
  restoreGlobals,
  MockTimerHandle,
  NativeTimerHandle,
  NativeImmedHandle,
  runTimelineAsync,
} from '../__export__';
import {TimerHeap} from '../TimerHeap';
import {VirtualTimeManager} from '../VirtualTimeManager';

describe('Timeline', () => {
  afterEach(() => {
    restoreGlobals();
  });

  // ============================================
  // destroy
  // ============================================
  describe('destroy', () => {
    it('should throw UseAfterFreeError after destroy', () => {
      const clock = MockClock();
      clock.destroy();
      expect(() => clock.systemTime()).toThrow('Timeline has been destroyed');
    });

    it.concurrent('should not throw when destroy called twice', () => {
      const clock = MockClock();
      clock.destroy();
      expect(() => clock.destroy()).not.toThrow();
    });

    it.concurrent('should support Symbol.dispose', () => {
      const clock = MockClock();
      clock[Symbol.dispose]();
      expect(() => clock.systemTime()).toThrow('Timeline has been destroyed');
    });
  });

  // ============================================
  // mock control
  // ============================================
  describe('mock control', () => {
    it.concurrent('should support isMocked, useReal and useMock', () => {
      const clock = MockClock({Date: true, setTimeout: false});
      expect(clock.isMocked('Date')).toBe(true);
      expect(clock.isMocked('setTimeout')).toBe(false);
      clock.useReal('Date');
      expect(clock.isMocked('Date')).toBe(false);
      clock.useMock('Date');
      expect(clock.isMocked('Date')).toBe(true);
      clock.destroy();
    });
  });

  // ============================================
  // setTimeout
  // ============================================
  describe('setTimeout', () => {
    it.concurrent('should mock setTimeout correctly', () => {
      const clock = MockClock();
      let called = false;
      runTimeline(clock, () => {
        setTimeout(() => {
          called = true;
        }, 100);
        clock.tick(100);
      });
      expect(called).toBe(true);
      clock.destroy();
    });

    it.concurrent('should handle multiple timers in order', () => {
      const clock = MockClock();
      const order: number[] = [];
      runTimeline(clock, () => {
        setTimeout(() => order.push(2), 200);
        setTimeout(() => order.push(1), 100);
        setTimeout(() => order.push(3), 300);
        clock.tick(300);
      });
      expect(order).toEqual([1, 2, 3]);
      clock.destroy();
    });

    it.concurrent('should handle nested setTimeout calls', () => {
      const clock = MockClock();
      const order: string[] = [];
      runTimeline(clock, () => {
        setTimeout(() => {
          order.push('outer');
          setTimeout(() => {
            order.push('inner');
          }, 50);
        }, 100);
        clock.tick(150);
      });
      expect(order).toEqual(['outer', 'inner']);
      clock.destroy();
    });

    it.concurrent('should support clearTimeout', () => {
      const clock = MockClock();
      let called = false;
      runTimeline(clock, () => {
        const id = setTimeout(() => {
          called = true;
        }, 100);
        clearTimeout(id);
        clock.tick(100);
      });
      expect(called).toBe(false);
      clock.destroy();
    });

    it.concurrent('should use real timers when not mocked', () => {
      const clock = MockClock({setTimeout: false});
      runTimeline(clock, () => {
        const handle = setTimeout(() => {}, 100);
        expect(handle).toBeInstanceOf(NativeTimerHandle);
        clearTimeout(handle);
      });
      clock.destroy();
    });

    it.concurrent('should handle setTimeout without delay parameter', () => {
      const clock = MockClock();
      let called = false;
      runTimeline(clock, () => {
        setTimeout(() => {
          called = true;
        });
        clock.tick(0);
      });
      expect(called).toBe(true);
      clock.destroy();
    });

    it('should cover setTimeout with shouldMock true but no timeline', () => {
      restoreGlobals();
      const manager = VirtualTimeManager.getInstance();
      const fork = manager.createFork({setTimeout: true});
      manager.removeFork(fork.id);
      let handle: unknown;
      manager.run(fork, () => {
        handle = setTimeout(() => {}, 100);
      });
      expect(handle).toBeDefined();
      fork.destroy();
    });

    it('should cover clearTimeout with various id types', () => {
      const clock = MockClock({setTimeout: true});
      runTimeline(clock, () => {
        clearTimeout({} as NodeJS.Timeout);
        clearTimeout('invalid' as unknown as NodeJS.Timeout);
        const handle = setTimeout(() => {}, 100);
        clearTimeout(Number(handle));
      });
      expect(clock.timerCount).toBe(0);
      clock.destroy();
    });

    it('should cover clearTimeout with MockTimerHandle when shouldMock is false', () => {
      const manager = VirtualTimeManager.getInstance();
      const forkMock = manager.createFork({setTimeout: true});
      const forkReal = manager.createFork({setTimeout: false});
      let mockHandle: MockTimerHandle | undefined;
      manager.run(forkMock, () => {
        mockHandle = setTimeout(() => {}, 100) as unknown as MockTimerHandle;
      });
      expect(mockHandle).toBeInstanceOf(MockTimerHandle);
      manager.run(forkReal, () => {
        clearTimeout(mockHandle as unknown as NodeJS.Timeout);
      });
      forkMock.destroy();
      forkReal.destroy();
    });
  });

  // ============================================
  // setInterval
  // ============================================
  describe('setInterval', () => {
    it.concurrent('should mock setInterval correctly', () => {
      const clock = MockClock();
      let count = 0;
      runTimeline(clock, () => {
        setInterval(() => {
          count++;
        }, 50);
        clock.tick(150);
      });
      expect(count).toBe(3);
      clock.destroy();
    });

    it.concurrent('should support clearInterval', () => {
      const clock = MockClock();
      let count = 0;
      runTimeline(clock, () => {
        const id = setInterval(() => {
          count++;
        }, 50);
        clock.tick(100);
        clearInterval(id);
        clock.tick(100);
      });
      expect(count).toBe(2);
      clock.destroy();
    });

    it.concurrent('should use real setInterval when not mocked', () => {
      const clock = MockClock({setInterval: false});
      runTimeline(clock, () => {
        const handle = setInterval(() => {}, 100);
        expect(handle).toBeInstanceOf(NativeTimerHandle);
        clearInterval(handle);
      });
      clock.destroy();
    });

    it('should cover clearInterval with number id', () => {
      const clock = MockClock({setInterval: true});
      runTimeline(clock, () => {
        const handle = setInterval(() => {}, 100);
        clearInterval(Number(handle));
      });
      expect(clock.timerCount).toBe(0);
      clock.destroy();
    });
  });

  // ============================================
  // runPending
  // ============================================
  describe('runPending', () => {
    it('should handle runPending with no timers', () => {
      const clock = MockClock();
      runTimeline(clock, () => {
        expect(() => clock.runPending()).not.toThrow();
      });
      clock.destroy();
    });
  });

  // ============================================
  // setImmediate
  // ============================================
  describe('setImmediate', () => {
    it.concurrent('should mock setImmediate correctly', () => {
      const clock = MockClock();
      let called = false;
      runTimeline(clock, () => {
        setImmediate(() => {
          called = true;
        });
        clock.tick(0);
      });
      expect(called).toBe(true);
      clock.destroy();
    });

    it.concurrent('should use real setImmediate when not mocked', () => {
      const clock = MockClock({setImmediate: false});
      runTimeline(clock, () => {
        const handle = setImmediate(() => {});
        expect(handle).toBeInstanceOf(NativeImmedHandle);
        clearImmediate(handle);
      });
      clock.destroy();
    });
  });

  // ============================================
  // Date
  // ============================================
  describe('Date', () => {
    it.concurrent('should mock Date correctly', () => {
      const clock = MockClock();
      const target_time = 1000000000000;
      runTimeline(clock, () => {
        clock.setSystemTime(target_time);
        expect(Date.now()).toBe(target_time);
      });
      clock.destroy();
    });

    it('should cover new Date() with Date: false and true in timeline context', () => {
      const clock_false = MockClock({Date: false});
      let date_result_false: Date;
      runTimeline(clock_false, () => {
        date_result_false = new Date();
      });
      expect(date_result_false!.getTime()).toBeGreaterThan(0);
      clock_false.destroy();

      const clock_true = MockClock({Date: true});
      clock_true.setSystemTime(1000000000000);
      let date_result_true: Date;
      runTimeline(clock_true, () => {
        date_result_true = new Date();
      });
      expect(date_result_true!.getTime()).toBe(1000000000000);
      clock_true.destroy();
    });

    it('should cover getVirtualTime with shouldMock true but no timeline', () => {
      restoreGlobals();
      const manager = VirtualTimeManager.getInstance();
      const fork = manager.createFork({Date: true});
      manager.removeFork(fork.id);
      let captured_time: number;
      manager.run(fork, () => {
        captured_time = Date.now();
      });
      expect(captured_time!).toBeGreaterThan(0);
      fork.destroy();
    });
  });

  // ============================================
  // Intl.DateTimeFormat
  // ============================================
  describe('Intl.DateTimeFormat', () => {
    it.concurrent('should hook Intl.DateTimeFormat methods', () => {
      const clock = MockClock();
      clock.setSystemTime(1000000000000);
      runTimeline(clock, () => {
        const dtf = new Intl.DateTimeFormat();
        const formatted = dtf.format();
        expect(typeof formatted).toBe('string');
        const dtf2 = Intl.DateTimeFormat();
        expect(dtf2).toBeInstanceOf(Intl.DateTimeFormat);
        const parts = dtf.formatToParts();
        expect(Array.isArray(parts)).toBe(true);
      });
      clock.destroy();
    });

    it('should cover format() and formatToParts() with Date: false', () => {
      const clock = MockClock({Date: false});
      let formatted: string;
      let parts: Intl.DateTimeFormatPart[];
      runTimeline(clock, () => {
        const dtf = new Intl.DateTimeFormat();
        formatted = dtf.format();
        parts = dtf.formatToParts();
      });
      expect(formatted!).toBeDefined();
      expect(parts!).toBeDefined();
      clock.destroy();
    });
  });

  // ============================================
  // performance.now
  // ============================================
  describe('performance.now', () => {
    it.concurrent('should mock performance.now correctly', () => {
      const clock = MockClock();
      runTimeline(clock, () => {
        const start = performance.now();
        clock.tick(100);
        const end = performance.now();
        expect(end - start).toBeCloseTo(100, 0);
      });
      clock.destroy();
    });

    it('should cover performance.now with performance: false', () => {
      const clock = MockClock({performance: false});
      let perf_now: number;
      runTimeline(clock, () => {
        perf_now = performance.now();
      });
      expect(perf_now!).toBeGreaterThan(0);
      clock.destroy();
    });
  });

  // ============================================
  // process hooks
  // ============================================
  describe('process hooks', () => {
    it('should cover process.uptime with process: false and true', () => {
      const clock_false = MockClock({process: false});
      let uptime_false: number;
      runTimeline(clock_false, () => {
        uptime_false = process.uptime();
      });
      expect(uptime_false!).toBeGreaterThan(0);
      clock_false.destroy();

      const clock_true = MockClock({process: true});
      let uptime_true: number;
      runTimeline(clock_true, () => {
        uptime_true = process.uptime();
      });
      expect(uptime_true!).toBeGreaterThan(0);
      clock_true.destroy();
    });

    it('should cover process.hrtime with process: false', () => {
      const clock = MockClock({process: false});
      let hrtime: [number, number];
      let hr_bigint: bigint;
      runTimeline(clock, () => {
        hrtime = process.hrtime();
        hr_bigint = process.hrtime.bigint();
      });
      expect(hrtime!).toBeDefined();
      expect(hr_bigint!).toBeGreaterThan(BigInt(0));
      clock.destroy();
    });

    it('should cover process.hrtime diff with nsec < 0 branch', () => {
      const clock = MockClock({process: true, frozen: true});
      runTimeline(clock, () => {
        const now = process.hrtime();
        const start: [number, number] = [now[0], now[1] + 500000000];
        const diff = process.hrtime(start);
        expect(diff[0]).toBe(-1);
        expect(diff[1]).toBeCloseTo(1e9 - 500000000, -5);
      });
      clock.destroy();
    });
  });

  // ============================================
  // os.uptime
  // ============================================
  describe('os.uptime', () => {
    it('should cover os.uptime with os: false', () => {
      const clock = MockClock({os: false});
      let os_uptime: number;
      runTimeline(clock, () => {
        os_uptime = os.uptime();
      });
      expect(os_uptime!).toBeGreaterThan(0);
      clock.destroy();
    });
  });

  // ============================================
  // nextTick
  // ============================================
  describe('nextTick', () => {
    it.concurrent('should handle mocked and real nextTick', () => {
      const clock_mocked = MockClock({nextTick: true});
      let executed_mocked = false;
      runTimeline(clock_mocked, () => {
        process.nextTick(() => {
          executed_mocked = true;
        });
        clock_mocked.runMicrotasks();
      });
      expect(executed_mocked).toBe(true);
      clock_mocked.destroy();

      const clock_real = MockClock({nextTick: false});
      let executed_real = false;
      runTimeline(clock_real, () => {
        process.nextTick(() => {
          executed_real = true;
        });
      });
      expect(executed_real).toBe(false);
      clock_real.destroy();
    });

    it('should catch and log error in nextTick callback', () => {
      const clock = MockClock({nextTick: true});
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      runTimeline(clock, () => {
        process.nextTick(() => {
          throw new Error('nextTick error');
        });
        clock.runMicrotasks();
      });
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error in nextTick callback:'),
        expect.any(Error),
      );
      errorSpy.mockRestore();
      clock.destroy();
    });

    it('should throw on infinite loop in nextTick', () => {
      const clock = MockClock({nextTick: true, loop_limit: 5});
      runTimeline(clock, () => {
        const recursive = () => {
          process.nextTick(recursive);
        };
        process.nextTick(recursive);
        expect(() => clock.runMicrotasks()).toThrow(
          'Aborting after running 5 nextTicks',
        );
      });
      clock.destroy();
    });
  });

  // ============================================
  // queueMicrotask
  // ============================================
  describe('queueMicrotask', () => {
    it.concurrent('should handle mocked and real queueMicrotask', () => {
      const clock_mocked = MockClock({queueMicrotask: true});
      let executed_mocked = false;
      runTimeline(clock_mocked, () => {
        queueMicrotask(() => {
          executed_mocked = true;
        });
        clock_mocked.runMicrotasks();
      });
      expect(executed_mocked).toBe(true);
      clock_mocked.destroy();

      const clock_real = MockClock({queueMicrotask: false});
      let executed_real = false;
      runTimeline(clock_real, () => {
        queueMicrotask(() => {
          executed_real = true;
        });
      });
      expect(executed_real).toBe(false);
      clock_real.destroy();
    });

    it('should throw on infinite loop in microtask', () => {
      const clock = MockClock({queueMicrotask: true, loop_limit: 5});
      runTimeline(clock, () => {
        const recursive = () => {
          queueMicrotask(recursive);
        };
        queueMicrotask(recursive);
        expect(() => clock.runMicrotasks()).toThrow(
          'Aborting after running 5 microtasks',
        );
      });
      clock.destroy();
    });
  });

  // ============================================
  // AbortSignal
  // ============================================
  describe('AbortSignal', () => {
    it.concurrent('should mock and use real AbortSignal.timeout', () => {
      const clock_mocked = MockClock({AbortSignal: true});
      let aborted = false;
      runTimeline(clock_mocked, () => {
        const signal = AbortSignal.timeout(100);
        signal.addEventListener('abort', () => {
          aborted = true;
        });
        clock_mocked.tick(100);
      });
      expect(aborted).toBe(true);
      clock_mocked.destroy();

      const clock_real = MockClock({AbortSignal: false});
      runTimeline(clock_real, () => {
        const signal = AbortSignal.timeout(100);
        expect(signal).toBeInstanceOf(AbortSignal);
      });
      clock_real.destroy();
    });
  });

  // ============================================
  // MessageChannel
  // ============================================
  describe('MessageChannel', () => {
    it('should cover MessageChannel with MessageChannel: false and true', () => {
      const clock_false = MockClock({MessageChannel: false});
      let channel_false: MessageChannel;
      runTimeline(clock_false, () => {
        channel_false = new MessageChannel();
      });
      expect(channel_false!).toBeDefined();
      clock_false.destroy();

      const clock_true = MockClock({MessageChannel: true});
      let channel_true: MessageChannel;
      runTimeline(clock_true, () => {
        channel_true = new MessageChannel();
      });
      expect(channel_true!).toBeDefined();
      clock_true.destroy();
    });

    it('should cover MessagePort postMessage, onmessage and close', () => {
      const clock = MockClock({MessageChannel: true});
      runTimeline(clock, () => {
        const channel = new MessageChannel();
        let received: unknown;
        channel.port1.onmessage = (e) => {
          received = e.data;
        };
        channel.port2.postMessage('hello');
        clock.tick(0);
        expect(received).toBe('hello');
        // 关闭后不再接收
        channel.port1.close();
        received = undefined;
        channel.port1.onmessage = () => {
          received = true;
        };
        channel.port2.postMessage('world');
        clock.tick(0);
        expect(received).toBeUndefined();
      });
      clock.destroy();
    });

    it('should cover MessagePort addEventListener and removeEventListener', () => {
      const clock = MockClock({MessageChannel: true});
      runTimeline(clock, () => {
        const channel = new MessageChannel();
        let received = '';
        const handler = (e: MessageEvent) => {
          received = e.data as string;
        };
        channel.port1.addEventListener('message', handler);
        channel.port2.postMessage('hello');
        clock.tick(0);
        expect(received).toBe('hello');
        channel.port1.removeEventListener('message', handler);
        received = '';
        channel.port2.postMessage('world');
        clock.tick(0);
        expect(received).toBe('');
      });
      clock.destroy();
    });

    it('should cover MessageChannel with shouldMock true but no timeline', () => {
      restoreGlobals();
      const manager = VirtualTimeManager.getInstance();
      const fork = manager.createFork({MessageChannel: true});
      manager.removeFork(fork.id);
      let channel: MessageChannel | undefined;
      manager.run(fork, () => {
        channel = new MessageChannel();
      });
      expect(channel).toBeDefined();
      fork.destroy();
    });

    it('should support multiple addEventListener listeners', () => {
      const clock = MockClock({MessageChannel: true});
      runTimeline(clock, () => {
        const channel = new MessageChannel();
        const received: string[] = [];
        const handler1 = (e: MessageEvent) => received.push(`1:${e.data}`);
        const handler2 = (e: MessageEvent) => received.push(`2:${e.data}`);
        channel.port1.addEventListener('message', handler1);
        channel.port1.addEventListener('message', handler2);
        channel.port2.postMessage('hello');
        clock.tick(0);
        expect(received).toEqual(['1:hello', '2:hello']);
      });
      clock.destroy();
    });

    it('should queue messages before start() is called', () => {
      const clock = MockClock({MessageChannel: true});
      runTimeline(clock, () => {
        const channel = new MessageChannel();
        let received: unknown;
        channel.port2.postMessage('before-start');
        channel.port1.onmessage = (e) => {
          received = e.data;
        };
        clock.tick(0);
        expect(received).toBe('before-start');
      });
      clock.destroy();
    });

    it('should dispatch event via dispatchEvent and handle messageerror', () => {
      const clock = MockClock({MessageChannel: true});
      runTimeline(clock, () => {
        const channel = new MessageChannel();
        let received: unknown;
        let error_received = false;
        channel.port1.onmessage = (e) => {
          received = e.data;
        };
        channel.port1.onmessageerror = () => {
          error_received = true;
        };
        const event = new MessageEvent('message', {data: 'dispatched'});
        channel.port1.dispatchEvent(event);
        expect(received).toBe('dispatched');
        const error_event = new MessageEvent('messageerror', {data: 'error'});
        channel.port1.dispatchEvent(error_event);
        expect(error_received).toBe(true);
      });
      clock.destroy();
    });

    it('should get onmessage and onmessageerror getters', () => {
      const clock = MockClock({MessageChannel: true});
      runTimeline(clock, () => {
        const channel = new MessageChannel();
        expect(channel.port1.onmessage).toBeNull();
        expect(channel.port1.onmessageerror).toBeNull();
        const handler = (_e: MessageEvent) => {};
        channel.port1.onmessage = handler;
        expect(channel.port1.onmessage).toBe(handler);
        const errorHandler = (_e: MessageEvent) => {};
        channel.port1.onmessageerror = errorHandler;
        expect(channel.port1.onmessageerror).toBe(errorHandler);
        // 替换 handler
        const handler2 = (_e: MessageEvent) => {};
        channel.port1.onmessage = handler2;
        expect(channel.port1.onmessage).toBe(handler2);
        channel.port1.onmessage = null;
        expect(channel.port1.onmessage).toBeNull();
        // 替换 onmessageerror handler
        const errorHandler2 = (_e: MessageEvent) => {};
        channel.port1.onmessageerror = errorHandler2;
        expect(channel.port1.onmessageerror).toBe(errorHandler2);
        channel.port1.onmessageerror = null;
        expect(channel.port1.onmessageerror).toBeNull();
      });
      clock.destroy();
    });

    it('should return early when postMessage has no timeline', () => {
      restoreGlobals();
      const manager = VirtualTimeManager.getInstance();
      const fork = manager.createFork({MessageChannel: true});
      manager.removeFork(fork.id);
      manager.run(fork, () => {
        const channel = new MessageChannel();
        expect(() => channel.port1.postMessage('test')).not.toThrow();
      });
      fork.destroy();
    });

    it('should return early when postMessage on closed port', () => {
      const clock = MockClock({MessageChannel: true});
      runTimeline(clock, () => {
        const channel = new MessageChannel();
        let received: unknown;
        channel.port1.onmessage = (e) => {
          received = e.data;
        };
        channel.port2.postMessage('before-close');
        clock.tick(0);
        expect(received).toBe('before-close');
        // 关闭发送端口后再调用 postMessage
        channel.port2.close();
        received = undefined;
        channel.port2.postMessage('after-close');
        clock.tick(0);
        expect(received).toBeUndefined();
      });
      clock.destroy();
    });

    it('should return early when _other_port is null', () => {
      const clock = MockClock({MessageChannel: true});
      runTimeline(clock, () => {
        const channel = new MessageChannel();
        // 通过 hack 将 _other_port 设为 null
        (channel.port1 as unknown as Record<string, unknown>)._other_port =
          null;
        expect(() => channel.port1.postMessage('test')).not.toThrow();
      });
      clock.destroy();
    });
  });

  // ============================================
  // frozen clock
  // ============================================
  describe('frozen clock', () => {
    it.concurrent('should work with frozen clock', () => {
      const clock = MockClock({frozen: true});
      const time1 = clock.systemTime();
      clock.tick(1000);
      const time2 = clock.systemTime();
      expect(time2 - time1).toBe(1000);
      clock.destroy();
    });

    it('should cover tick frozen time updates', () => {
      const clock = MockClock({frozen: true});
      const initialHr = clock.hrtime();
      const initialUptime = clock.uptime();
      const initialOsUptime = clock.osUptime();
      clock.tick(1000);
      const newHr = clock.hrtime();
      const newUptime = clock.uptime();
      const newOsUptime = clock.osUptime();
      const hrDiffNs =
        (newHr[0] - initialHr[0]) * 1e9 + (newHr[1] - initialHr[1]);
      expect(hrDiffNs).toBeCloseTo(1000 * 1e6, -5);
      expect(newUptime - initialUptime).toBeCloseTo(1, 1);
      expect(newOsUptime - initialOsUptime).toBeCloseTo(1, 1);
      clock.destroy();
    });

    it('should cover freeze calculation from non-frozen state', () => {
      const clock = MockClock({frozen: false});
      clock.tick(100);
      clock.freeze();
      expect(clock.isFrozen()).toBe(true);
      const frozenTime = clock.systemTime();
      const frozenPerf = clock.perfNow();
      const frozenHr = clock.hrtime();
      const frozenUptime = clock.uptime();
      const frozenOsUptime = clock.osUptime();
      expect(frozenTime).toBeGreaterThan(0);
      expect(frozenPerf).toBeGreaterThan(0);
      expect(frozenHr[0]).toBeGreaterThanOrEqual(0);
      expect(frozenUptime).toBeGreaterThan(0);
      expect(frozenOsUptime).toBeGreaterThan(0);
      clock.destroy();
    });
  });

  // ============================================
  // non-frozen time calculations
  // ============================================
  describe('non-frozen time calculations', () => {
    it.concurrent('should cover time calculations in non-frozen state', () => {
      const clock = MockClock({frozen: false});
      const time1 = clock.systemTime();
      const perf1 = clock.perfNow();
      const hr1 = clock.hrtime();
      const hrBig1 = clock.hrtimeBigInt();
      const up1 = clock.uptime();
      const osUp1 = clock.osUptime();
      clock.tick(100);
      const time2 = clock.systemTime();
      const perf2 = clock.perfNow();
      const hr2 = clock.hrtime();
      const hrBig2 = clock.hrtimeBigInt();
      const up2 = clock.uptime();
      const osUp2 = clock.osUptime();
      expect(time2 - time1).toBeGreaterThanOrEqual(100);
      expect(time2 - time1).toBeLessThan(110);
      expect(perf2 - perf1).toBeCloseTo(100, 0);
      expect(perf2 - perf1).toBeLessThan(110);
      const diffNs = (hr2[0] - hr1[0]) * 1e9 + (hr2[1] - hr1[1]);
      expect(diffNs).toBeCloseTo(100 * 1e6, -7);
      expect(Number(hrBig2 - hrBig1)).toBeCloseTo(100 * 1e6, -6);
      expect(up2 - up1).toBeCloseTo(0.1, 1);
      expect(osUp2 - osUp1).toBeCloseTo(0.1, 1);
      clock.destroy();
    });
  });

  // ============================================
  // timer management
  // ============================================
  describe('timer management', () => {
    it.concurrent('should manage timers correctly', () => {
      const clock = MockClock();
      runTimeline(clock, () => {
        setTimeout(() => {}, 100);
        setTimeout(() => {}, 200);
      });
      expect(clock.timerCount).toBe(2);
      clock.clearAllTimers();
      expect(clock.timerCount).toBe(0);
      clock.destroy();
    });

    it.concurrent('should remove timer via clearTimeout', () => {
      const clock = MockClock();
      runTimeline(clock, () => {
        const handle = setTimeout(() => {}, 100);
        expect(clock.timerCount).toBe(1);
        clearTimeout(handle);
        expect(clock.timerCount).toBe(0);
      });
      clock.destroy();
    });

    it.concurrent('should refresh timer via handle.refresh()', () => {
      const clock = MockClock();
      let handle: ReturnType<typeof setTimeout>;
      runTimeline(clock, () => {
        handle = setTimeout(() => {}, 100);
        clock.tick(50);
      });
      const count_before = clock.timerCount;
      handle!.refresh();
      expect(clock.timerCount).toBe(count_before);
      clock.destroy();
    });

    it.concurrent('should handle refresh for non-existent timer', () => {
      const clock = MockClock();
      runTimeline(clock, () => {
        const fake_handle = {refresh: () => {}} as unknown as ReturnType<
          typeof setTimeout
        >;
        expect(() =>
          (fake_handle as unknown as MockTimerHandle).refresh(),
        ).not.toThrow();
      });
      clock.destroy();
    });
  });

  // ============================================
  // tick and runAll
  // ============================================
  describe('tick and runAll', () => {
    it.concurrent('should throw on infinite loop in tick and runAll', () => {
      const clock_tick = MockClock({loop_limit: 10});
      runTimeline(clock_tick, () => {
        setInterval(() => {}, 1);
      });
      expect(() => clock_tick.tick(1000)).toThrow(
        'Aborting after running 10 timers',
      );
      clock_tick.destroy();

      const clock_runAll = MockClock({loop_limit: 10});
      runTimeline(clock_runAll, () => {
        setInterval(() => {}, 1);
      });
      expect(() => clock_runAll.runAll()).toThrow(
        'Aborting after running 10 timers',
      );
      clock_runAll.destroy();
    });

    it.concurrent('should run all timers', () => {
      const clock = MockClock();
      const order: number[] = [];
      runTimeline(clock, () => {
        setTimeout(() => order.push(1), 100);
        setTimeout(() => order.push(2), 200);
        setTimeout(() => order.push(3), 300);
      });
      clock.runAll();
      expect(order).toEqual([1, 2, 3]);
      clock.destroy();
    });

    it.concurrent('should run next timer', () => {
      const clock = MockClock();
      const order: number[] = [];
      runTimeline(clock, () => {
        setTimeout(() => order.push(1), 100);
        setTimeout(() => order.push(2), 200);
      });
      clock.next();
      expect(order).toEqual([1]);
      clock.next();
      expect(order).toEqual([1, 2]);
      clock.destroy();
    });

    it.concurrent('should handle next with no timers', () => {
      const clock = MockClock();
      expect(() => clock.next()).not.toThrow();
      clock.destroy();
    });

    it('should cover runAll with frozen state', () => {
      const clock = MockClock({frozen: true});
      const order: number[] = [];
      runTimeline(clock, () => {
        setTimeout(() => order.push(1), 100);
        setTimeout(() => order.push(2), 200);
      });
      clock.runAll();
      expect(order).toEqual([1, 2]);
      clock.destroy();
    });
    it('should cover runAll with no frozen state', () => {
      const clock = MockClock({frozen: false});
      const order: number[] = [];
      runTimeline(clock, () => {
        setTimeout(() => order.push(1), 100);
        setTimeout(() => order.push(2), 200);
      });
      clock.runAll();
      expect(order).toEqual([1, 2]);
      clock.destroy();
    });
  });

  // ============================================
  // nextAsync
  // ============================================
  describe('nextAsync', () => {
    it('should run next timer asynchronously', async () => {
      const clock = MockClock();
      const order: number[] = [];
      runTimeline(clock, () => {
        setTimeout(() => order.push(1), 100);
        setTimeout(() => order.push(2), 200);
      });
      await clock.nextAsync();
      expect(order).toEqual([1]);
      await clock.nextAsync();
      expect(order).toEqual([1, 2]);
      clock.destroy();
    });

    it('should handle nextAsync with no timers', async () => {
      const clock = MockClock();
      await expect(clock.nextAsync()).resolves.not.toThrow();
      clock.destroy();
    });

    it('should update frozen state when frozen', async () => {
      const clock = MockClock({frozen: true});
      const start_time = clock.systemTime();
      runTimeline(clock, () => {
        setTimeout(() => {}, 100);
      });
      await clock.nextAsync();
      expect(clock.systemTime()).toBe(start_time + 100);
      expect(clock.isFrozen()).toBe(true);
      clock.destroy();
    });

    it('should work correctly when not frozen', async () => {
      const clock = MockClock({frozen: false});
      const start_time = clock.systemTime();
      runTimeline(clock, () => {
        setTimeout(() => {}, 100);
      });
      await clock.nextAsync();
      expect(clock.systemTime()).toBe(start_time + 100);
      expect(clock.isFrozen()).toBe(false);
      clock.destroy();
    });
  });

  // ============================================
  // tickAsync
  // ============================================
  describe('tickAsync', () => {
    it('should advance time and run timers asynchronously', async () => {
      const clock = MockClock();
      const order: number[] = [];
      runTimeline(clock, () => {
        setTimeout(() => order.push(1), 100);
        setTimeout(() => order.push(2), 200);
      });
      await clock.tickAsync(200);
      expect(order).toEqual([1, 2]);
      clock.destroy();
    });

    it('should throw on infinite loop in tickAsync', async () => {
      const clock = MockClock({loop_limit: 10});
      runTimeline(clock, () => {
        setInterval(() => {}, 1);
      });
      await expect(clock.tickAsync(1000)).rejects.toThrow(
        'Aborting after running 10 timers',
      );
      clock.destroy();
    });

    it('should update frozen state when frozen', async () => {
      const clock = MockClock({frozen: true});
      const start_time = clock.systemTime();
      await clock.tickAsync(100);
      expect(clock.systemTime()).toBe(start_time + 100);
      expect(clock.isFrozen()).toBe(true);
      clock.destroy();
    });

    it('should work correctly when not frozen', async () => {
      const clock = MockClock({frozen: false});
      const start_time = clock.systemTime();
      await clock.tickAsync(100);
      expect(clock.systemTime()).toBe(start_time + 100);
      expect(clock.isFrozen()).toBe(false);
      clock.destroy();
    });
  });

  // ============================================
  // runAllAsync
  // ============================================
  describe('runAllAsync', () => {
    it('should run all timers asynchronously', async () => {
      const clock = MockClock();
      const order: number[] = [];
      runTimeline(clock, () => {
        setTimeout(() => order.push(1), 100);
        setTimeout(() => order.push(2), 200);
        setTimeout(() => order.push(3), 300);
      });
      await clock.runAllAsync();
      expect(order).toEqual([1, 2, 3]);
      clock.destroy();
    });

    it('should throw on infinite loop in runAllAsync', async () => {
      const clock = MockClock({loop_limit: 10});
      runTimeline(clock, () => {
        setInterval(() => {}, 1);
      });
      await expect(clock.runAllAsync()).rejects.toThrow(
        'Aborting after running 10 timers',
      );
      clock.destroy();
    });

    it('should handle runAllAsync with no timers', async () => {
      const clock = MockClock();
      await expect(clock.runAllAsync()).resolves.not.toThrow();
      clock.destroy();
    });

    it('should expose realFlushPromises method', async () => {
      const clock = MockClock();
      await expect(clock.realFlushPromises()).resolves.not.toThrow();
      clock.destroy();
    });
    it('should expose realSleep method', async () => {
      const clock = MockClock();
      await expect(clock.realSleep(5)).resolves.not.toThrow();
      clock.destroy();
    });
  });

  // ============================================
  // runPending
  // ============================================
  describe('runPending', () => {
    it.concurrent('should run pending timers', () => {
      const clock = MockClock();
      const order: number[] = [];
      runTimeline(clock, () => {
        setTimeout(() => order.push(1), 100);
        setTimeout(() => order.push(2), 200);
        setTimeout(() => {
          order.push(3);
          setTimeout(() => order.push(4), 50);
        }, 150);
      });
      clock.runPending();
      expect(order).toEqual([1, 3, 2]);
      clock.destroy();
    });

    it.concurrent('should handle runPending with interval', () => {
      const clock = MockClock();
      let count = 0;
      runTimeline(clock, () => {
        setInterval(() => {
          count++;
        }, 1);
      });
      clock.runPending();
      expect(count).toBe(1);
      clock.destroy();
    });

    it.concurrent('should throw on infinite loop in runPending', () => {
      const clock = MockClock({loop_limit: 5});
      runTimeline(clock, () => {
        for (let i = 0; i < 20; i++) setTimeout(() => {}, i);
      });
      expect(() => clock.runPending()).toThrow(
        'Aborting after running 5 timers',
      );
      clock.destroy();
    });

    it.concurrent('should handle runPending with no timers', () => {
      const clock = MockClock();
      const order: number[] = [];
      runTimeline(clock, () => {
        setTimeout(() => order.push(1), 100);
      });
      clock.clearAllTimers();
      clock.runPending();
      expect(order).toEqual([]);
      clock.destroy();
    });

    it('should skip cleared timers during runPending', () => {
      const clock = MockClock({nextTick: true});
      const order: number[] = [];
      let timer_id: NodeJS.Timeout;
      runTimeline(clock, () => {
        setTimeout(() => {
          order.push(1);
          process.nextTick(() => {
            clearTimeout(timer_id);
          });
        }, 100);
        timer_id = setTimeout(() => {
          order.push(2);
        }, 200);
        setTimeout(() => order.push(3), 300);
        clock.runPending();
      });
      expect(order).toEqual([1, 3]);
      clock.destroy();
    });
  });

  // ============================================
  // runPendingAsync
  // ============================================
  describe('runPendingAsync', () => {
    it('should run pending timers asynchronously', async () => {
      const clock = MockClock();
      const order: number[] = [];
      runTimeline(clock, () => {
        setTimeout(() => order.push(1), 100);
        setTimeout(() => order.push(2), 200);
        setTimeout(() => {
          order.push(3);
          setTimeout(() => order.push(4), 50);
        }, 150);
      });
      await clock.runPendingAsync();
      expect(order).toEqual([1, 3, 2]);
      clock.destroy();
    });

    it('should handle runPendingAsync with no timers', async () => {
      const clock = MockClock();
      await expect(clock.runPendingAsync()).resolves.not.toThrow();
      clock.destroy();
    });

    it('should throw on infinite loop in runPendingAsync', async () => {
      const clock = MockClock({loop_limit: 5});
      runTimeline(clock, () => {
        for (let i = 0; i < 20; i++) setTimeout(() => {}, i);
      });
      await expect(clock.runPendingAsync()).rejects.toThrow(
        'Aborting after running 5 timers',
      );
      clock.destroy();
    });

    it('should handle runPendingAsync with interval', async () => {
      const clock = MockClock();
      let count = 0;
      runTimeline(clock, () => {
        setInterval(() => {
          count++;
        }, 1);
      });
      await clock.runPendingAsync();
      expect(count).toBe(1);
      clock.destroy();
    });

    it('should skip cleared timers during runPendingAsync', async () => {
      const clock = MockClock({nextTick: true});
      const order: number[] = [];
      let timer_id: NodeJS.Timeout;
      await runTimelineAsync(clock, async () => {
        setTimeout(() => {
          order.push(1);
          process.nextTick(() => {
            clearTimeout(timer_id);
          });
        }, 100);
        timer_id = setTimeout(() => {
          order.push(2);
        }, 200);
        setTimeout(() => order.push(3), 300);
        await clock.runPendingAsync();
      });
      expect(order).toEqual([1, 3]);
      clock.destroy();
    });
  });

  // ============================================
  // freeze and unfreeze
  // ============================================
  describe('freeze and unfreeze', () => {
    it.concurrent('should freeze and unfreeze correctly', () => {
      const clock = MockClock({frozen: false});
      expect(clock.isFrozen()).toBe(false);
      clock.freeze();
      expect(clock.isFrozen()).toBe(true);
      clock.unfreeze();
      expect(clock.isFrozen()).toBe(false);
      clock.destroy();
    });

    it.concurrent('should not double freeze or unfreeze', () => {
      const clock_frozen = MockClock({frozen: true});
      clock_frozen.freeze();
      expect(clock_frozen.isFrozen()).toBe(true);
      clock_frozen.destroy();

      const clock_unfrozen = MockClock({frozen: false});
      clock_unfrozen.unfreeze();
      expect(clock_unfrozen.isFrozen()).toBe(false);
      clock_unfrozen.destroy();
    });

    it.concurrent('should return correct time when frozen', () => {
      const clock = MockClock({frozen: true});
      const time1 = clock.systemTime();
      clock.tick(1000);
      const time2 = clock.systemTime();
      expect(time2 - time1).toBe(1000);
      clock.destroy();
    });

    it.concurrent('should handle unfreeze correctly', () => {
      const clock = MockClock({frozen: true});
      clock.setSystemTime(1000000000000);
      clock.unfreeze();
      expect(clock.isFrozen()).toBe(false);
      clock.destroy();
    });

    it('should cover non-frozen timer execution in tick', () => {
      const clock = MockClock({frozen: false});
      let executed = false;
      runTimeline(clock, () => {
        setTimeout(() => {
          executed = true;
        }, 100);
      });
      clock.tick(100);
      expect(executed).toBe(true);
      expect(clock.isFrozen()).toBe(false);
      clock.destroy();
    });

    it('should cover non-frozen timer execution in tickAsync', async () => {
      const clock = MockClock({frozen: false});
      let executed = false;
      runTimeline(clock, () => {
        setTimeout(() => {
          executed = true;
        }, 100);
      });
      await clock.tickAsync(100);
      expect(executed).toBe(true);
      expect(clock.isFrozen()).toBe(false);
      clock.destroy();
    });

    it('should cover non-frozen timer execution in runAllAsync', async () => {
      const clock = MockClock({frozen: false});
      let executed = false;
      runTimeline(clock, () => {
        setTimeout(() => {
          executed = true;
        }, 100);
      });
      await clock.runAllAsync();
      expect(executed).toBe(true);
      expect(clock.isFrozen()).toBe(false);
      clock.destroy();
    });

    it('should cover non-frozen timer execution in next', () => {
      const clock = MockClock({frozen: false});
      let executed = false;
      runTimeline(clock, () => {
        setTimeout(() => {
          executed = true;
        }, 100);
      });
      clock.next();
      expect(executed).toBe(true);
      expect(clock.isFrozen()).toBe(false);
      clock.destroy();
    });
  });

  // ============================================
  // time getters
  // ============================================
  describe('time getters', () => {
    it.concurrent('should return correct time values', () => {
      const clock = MockClock();
      const perf1 = clock.perfNow();
      const hr1 = clock.hrtime();
      const hrBig1 = clock.hrtimeBigInt();
      const up1 = clock.uptime();
      const osUp1 = clock.osUptime();
      clock.tick(100);
      const perf2 = clock.perfNow();
      const hr2 = clock.hrtime();
      const hrBig2 = clock.hrtimeBigInt();
      const up2 = clock.uptime();
      const osUp2 = clock.osUptime();
      expect(perf2 - perf1).toBeCloseTo(100, 0);
      const diffNs = (hr2[0] - hr1[0]) * 1e9 + (hr2[1] - hr1[1]);
      expect(diffNs).toBeCloseTo(100 * 1e6, -5);
      expect(Number(hrBig2 - hrBig1)).toBeCloseTo(100 * 1e6, -5);
      expect(up2 - up1).toBeCloseTo(0.1, 1);
      expect(osUp2 - osUp1).toBeCloseTo(0.1, 1);
      clock.destroy();
    });

    it.concurrent('should return correct time values when frozen', () => {
      const clock = MockClock({frozen: true});
      const perf1 = clock.perfNow();
      const hr1 = clock.hrtime();
      const up1 = clock.uptime();
      const osUp1 = clock.osUptime();
      clock.tick(100);
      const perf2 = clock.perfNow();
      const hr2 = clock.hrtime();
      const up2 = clock.uptime();
      const osUp2 = clock.osUptime();
      expect(perf2 - perf1).toBeCloseTo(100, 0);
      const diffNs = (hr2[0] - hr1[0]) * 1e9 + (hr2[1] - hr1[1]);
      expect(diffNs).toBeCloseTo(100 * 1e6, -5);
      expect(up2 - up1).toBeCloseTo(0.1, 1);
      expect(osUp2 - osUp1).toBeCloseTo(0.1, 1);
      clock.destroy();
    });
  });

  // ============================================
  // setSystemTime
  // ============================================
  describe('setSystemTime', () => {
    it.concurrent(
      'should set system time with number, Date and undefined',
      () => {
        const clock = MockClock();
        clock.setSystemTime(1000000000000);
        expect(clock.systemTime()).toBe(1000000000000);

        const targetDate = new Date(2000000000000);
        clock.setSystemTime(targetDate);
        expect(clock.systemTime()).toBe(2000000000000);

        clock.setSystemTime();
        expect(clock.systemTime()).toBeGreaterThan(0);
        clock.destroy();
      },
    );

    it.concurrent('should set system time when frozen and not frozen', () => {
      const clock_frozen = MockClock({frozen: true});
      clock_frozen.setSystemTime(1000000000000);
      expect(clock_frozen.systemTime()).toBe(1000000000000);
      expect(clock_frozen.perfNow()).toBeGreaterThan(0);
      clock_frozen.destroy();

      const clock_unfrozen = MockClock({frozen: false});
      clock_unfrozen.setSystemTime(1000000000000);
      expect(clock_unfrozen.systemTime()).toBe(1000000000000);
      expect(clock_unfrozen.isFrozen()).toBe(false);
      clock_unfrozen.destroy();
    });

    it.concurrent('should get mocked system time and offset', () => {
      const clock = MockClock();
      clock.setSystemTime(1000000000000);
      const date = clock.systemTime();
      expect(date).toBe(1000000000000);
      const offset = clock.getOffset();
      expect(typeof offset).toBe('number');
      clock.destroy();
    });
  });

  // ============================================
  // real time getters
  // ============================================
  describe('real time getters', () => {
    it.concurrent('should get real time values', () => {
      const clock = MockClock();
      expect(clock.getRealNow()).toBeGreaterThan(0);
      expect(clock.getRealPerfNow()).toBeGreaterThan(0);
      expect(clock.getRealUptime()).toBeGreaterThan(0);
      const hr = clock.getRealHrtime();
      expect(hr[0]).toBeGreaterThanOrEqual(0);
      const hrDiff = clock.getRealHrtime(hr);
      expect(hrDiff[0]).toBeGreaterThanOrEqual(0);
      expect(clock.getRealHrtimeBigInt()).toBeGreaterThan(BigInt(0));
      expect(clock.getRealOsUptime()).toBeGreaterThan(0);
      clock.destroy();
    });
  });

  // ============================================
  // runMicrotasks
  // ============================================
  describe('runMicrotasks', () => {
    it.concurrent('should run microtasks', () => {
      const clock = MockClock({queueMicrotask: true});
      let executed = false;
      runTimeline(clock, () => {
        queueMicrotask(() => {
          executed = true;
        });
        clock.runMicrotasks();
      });
      expect(executed).toBe(true);
      clock.destroy();
    });

    it.concurrent('should handle error in microtask callback', () => {
      const clock = MockClock({queueMicrotask: true});
      let afterError = false;
      const originalError = console.error;
      console.error = () => {};
      runTimeline(clock, () => {
        queueMicrotask(() => {
          throw new Error('test error');
        });
        queueMicrotask(() => {
          afterError = true;
        });
        clock.runMicrotasks();
      });
      console.error = originalError;
      expect(afterError).toBe(true);
      clock.destroy();
    });
  });

  // ============================================
  // error handling
  // ============================================
  describe('error handling', () => {
    it('should cover microtask and timer error console.error line', () => {
      const clock = MockClock({queueMicrotask: true});
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      runTimeline(clock, () => {
        queueMicrotask(() => {
          throw new Error('microtask error');
        });
        clock.runMicrotasks();
        setTimeout(() => {
          throw new Error('timer error');
        }, 50);
        clock.tick(50);
      });
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error in microtask callback:'),
        expect.any(Error),
      );
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error in timer callback'),
        expect.any(Error),
      );
      errorSpy.mockRestore();
      clock.destroy();
    });

    it.concurrent('should handle error in timer callback', () => {
      const clock = MockClock();
      let afterError = false;
      const originalError = console.error;
      console.error = () => {};
      runTimeline(clock, () => {
        setTimeout(() => {
          throw new Error('timer error');
        }, 50);
        setTimeout(() => {
          afterError = true;
        }, 100);
        clock.tick(100);
      });
      console.error = originalError;
      expect(afterError).toBe(true);
      clock.destroy();
    });

    it('should handle tick with negative ms when frozen', () => {
      const clock = MockClock({frozen: true});
      let time_after_tick: number;
      runTimeline(clock, () => {
        const initial_time = clock.systemTime();
        clock.tick(-1000);
        time_after_tick = clock.systemTime();
        expect(time_after_tick!).toBe(initial_time - 1000);
      });
      clock.destroy();
    });

    it('should handle tickAsync with negative ms when frozen', async () => {
      const clock = MockClock({frozen: true});
      await runTimelineAsync(clock, async () => {
        const initial_time = clock.systemTime();
        await clock.tickAsync(-1000);
        const time_after_tick = clock.systemTime();
        expect(time_after_tick).toBe(initial_time - 1000);
      });
      clock.destroy();
    });

    it('should handle tick with negative ms when not frozen', () => {
      const clock = MockClock({frozen: false});
      let time_after_tick: number;
      runTimeline(clock, () => {
        const initial_time = clock.systemTime();
        clock.tick(-1000);
        time_after_tick = clock.systemTime();
        expect(time_after_tick!).toBe(initial_time - 1000);
      });
      clock.destroy();
    });

    it('should handle tickAsync with negative ms when not frozen', async () => {
      const clock = MockClock({frozen: false});
      await runTimelineAsync(clock, async () => {
        const initial_time = clock.systemTime();
        await clock.tickAsync(-1000);
        const time_after_tick = clock.systemTime();
        expect(time_after_tick).toBe(initial_time - 1000);
      });
      clock.destroy();
    });
  });

  // ============================================
  // TimerHeap coverage
  // ============================================
  describe('TimerHeap coverage', () => {
    it.concurrent('should cover peek with undefined id', () => {
      const heap = new TimerHeap();
      heap['heap'].push(999);
      expect(heap.peek()).toBeNull();
    });
  });
});
