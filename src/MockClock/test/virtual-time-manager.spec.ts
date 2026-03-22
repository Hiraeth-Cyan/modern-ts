// ========================================
// ./src/MockClock/test/virtual-time-manager.spec.ts
// ========================================
/**
 * @vitest-environment-options { "isolate": true }
 */
import {describe, it, expect, afterEach} from 'vitest';
import os from 'os';
import {MockClock, runTimeline, restoreGlobals} from '../__export__';
import {VirtualTimeManager} from '../VirtualTimeManager';
import {Timeline} from '../Timeline';

describe('VirtualTimeManager', () => {
  afterEach(() => {
    restoreGlobals();
  });

  // ============================================
  // singleton
  // ============================================
  describe('singleton', () => {
    it('getInstance should return singleton and destroyInstance should clear it', () => {
      const instance1 = VirtualTimeManager.getInstance();
      const instance2 = VirtualTimeManager.getInstance();
      expect(instance1).toBe(instance2);
      VirtualTimeManager.destroyInstance();
      const new_instance = VirtualTimeManager.getInstance();
      expect(new_instance).toBeDefined();
      restoreGlobals();
    });
  });

  // ============================================
  // fork management
  // ============================================
  describe('fork management', () => {
    it.concurrent('should create fork with options', () => {
      const manager = VirtualTimeManager.getInstance();
      const fork = manager.createFork({frozen: true, Date: false});
      expect(fork).toBeInstanceOf(Timeline);
      expect(fork.isFrozen()).toBe(true);
      fork.destroy();
    });

    it.concurrent('should remove fork', () => {
      const manager = VirtualTimeManager.getInstance();
      const fork = manager.createFork();
      manager.removeFork(fork.id);
      fork.destroy();
    });

    it.concurrent('should run with fork (sync and async)', async () => {
      const manager = VirtualTimeManager.getInstance();
      const fork = manager.createFork();
      let executed = false;
      manager.run(fork, () => {
        executed = true;
      });
      expect(executed).toBe(true);

      let async_executed = false;
      await manager.runAsync(fork, async () => {
        await Promise.resolve();
        async_executed = true;
      });
      expect(async_executed).toBe(true);
      fork.destroy();
    });
  });

  // ============================================
  // mock targets without timeline
  // ============================================
  describe('mock targets without timeline', () => {
    it('should handle mocked targets with no timeline', () => {
      restoreGlobals();
      const manager = VirtualTimeManager.getInstance();

      // queueMicrotask
      const fork_queue = manager.createFork({queueMicrotask: true});
      let queue_executed = false;
      queueMicrotask(() => {
        queue_executed = true;
      });
      expect(queue_executed).toBe(false);
      fork_queue.destroy();

      // nextTick
      restoreGlobals();
      const fork_next = manager.createFork({nextTick: true});
      let next_executed = false;
      process.nextTick(() => {
        next_executed = true;
      });
      expect(next_executed).toBe(false);
      fork_next.destroy();

      // setImmediate
      restoreGlobals();
      const fork_immed = manager.createFork({setImmediate: true});
      const handle = setImmediate(() => {});
      expect(typeof handle).toBe('object');
      clearImmediate(handle);
      fork_immed.destroy();

      // AbortSignal
      restoreGlobals();
      const fork_abort = manager.createFork({AbortSignal: true});
      const signal = AbortSignal.timeout(100);
      expect(signal).toBeInstanceOf(AbortSignal);
      fork_abort.destroy();
    });
  });

  // ============================================
  // Date hooks
  // ============================================
  describe('Date hooks', () => {
    it.concurrent(
      'should hook Date constructor without new and with args',
      () => {
        const clock = MockClock();
        clock.setSystemTime(1000000000000);
        runTimeline(clock, () => {
          const dateStr = Date();
          expect(typeof dateStr).toBe('string');
          const date = new Date(2020, 0, 1);
          expect(date.getFullYear()).toBe(2020);
        });
        clock.destroy();
      },
    );
  });

  // ============================================
  // Intl.DateTimeFormat hooks
  // ============================================
  describe('Intl.DateTimeFormat hooks', () => {
    it.concurrent(
      'should hook Intl.DateTimeFormat format and formatToParts with date',
      () => {
        const clock = MockClock();
        runTimeline(clock, () => {
          const dtf = new Intl.DateTimeFormat();
          const formatted = dtf.format(1000000000000);
          expect(typeof formatted).toBe('string');
          const parts = dtf.formatToParts(1000000000000);
          expect(Array.isArray(parts)).toBe(true);
        });
        clock.destroy();
      },
    );
  });

  // ============================================
  // process.hrtime hooks
  // ============================================
  describe('process.hrtime hooks', () => {
    it.concurrent('should hook process.hrtime with diff and bigint', () => {
      const clock = MockClock({process: true});
      runTimeline(clock, () => {
        const start = process.hrtime();
        clock.tick(100);
        const diff = process.hrtime(start);
        expect(diff[0]).toBeGreaterThanOrEqual(0);
        const hr = process.hrtime.bigint();
        expect(hr).toBeGreaterThan(BigInt(0));
      });
      clock.destroy();
    });

    it.concurrent(
      'should handle hrtime diff when nsec >= 0 (no borrow needed)',
      () => {
        const clock = MockClock({process: true});
        runTimeline(clock, () => {
          const start = process.hrtime();
          // 推进恰好 1 秒，使得 now[1] == start[1]，nsec = 0，触发 else 分支
          clock.tick(1000);
          const diff = process.hrtime(start);
          expect(diff[0]).toBe(1);
          expect(diff[1]).toBe(0);
        });
        clock.destroy();
      },
    );
  });

  // ============================================
  // os.uptime hook
  // ============================================
  describe('os.uptime hook', () => {
    it.concurrent('should hook os.uptime', () => {
      const clock = MockClock({os: true});
      runTimeline(clock, () => {
        const uptime = os.uptime();
        expect(uptime).toBeGreaterThan(0);
      });
      clock.destroy();
    });
  });

  // ============================================
  // getTimeline edge cases
  // ============================================
  describe('getTimeline edge cases', () => {
    it('should return null when fork is removed but store context exists', () => {
      const manager = VirtualTimeManager.getInstance();
      const fork = manager.createFork({Date: true});
      manager.removeFork(fork.id);
      let date_now_result: number;
      manager.run(fork, () => {
        date_now_result = Date.now();
      });
      expect(date_now_result!).toBeGreaterThan(0);
      fork.destroy();
    });
  });

  // ============================================
  // setTimeout without mock
  // ============================================
  describe('setTimeout without mock', () => {
    it('should use native setTimeout when setTimeout is not mocked', async () => {
      restoreGlobals();
      const manager = VirtualTimeManager.getInstance();
      const fork = manager.createFork({setTimeout: false});
      let executed = false;
      await new Promise<void>((resolve) => {
        manager.run(fork, () => {
          const handle = setTimeout(() => {
            executed = true;
            resolve();
          });
          expect(handle).toBeDefined();
        });
      });
      expect(executed).toBe(true);
      fork.destroy();
    });

    it('should use delay ?? 0 when delay is undefined', async () => {
      restoreGlobals();
      const manager = VirtualTimeManager.getInstance();
      const fork = manager.createFork({setTimeout: false});
      let executed = false;
      await new Promise<void>((resolve) => {
        manager.run(fork, () => {
          const handle = setTimeout(() => {
            executed = true;
            resolve();
          }, undefined);
          expect(handle).toBeDefined();
        });
      });
      expect(executed).toBe(true);
      fork.destroy();
    });
  });

  // ============================================
  // setInterval without mock
  // ============================================
  describe('setInterval without mock', () => {
    it('should use native setInterval when setInterval is not mocked', async () => {
      restoreGlobals();
      const manager = VirtualTimeManager.getInstance();
      const fork = manager.createFork({setInterval: false});
      let count = 0;
      await new Promise<void>((resolve) => {
        manager.run(fork, () => {
          const handle = setInterval(() => {
            count++;
            if (count >= 2) {
              clearInterval(handle);
              resolve();
            }
          }, 10);
          expect(handle).toBeDefined();
        });
      });
      expect(count).toBeGreaterThanOrEqual(2);
      fork.destroy();
    });

    it('should use delay ?? 0 when delay is undefined (not mocked)', async () => {
      restoreGlobals();
      const manager = VirtualTimeManager.getInstance();
      const fork = manager.createFork({setInterval: false});
      let executed = false;
      await new Promise<void>((resolve) => {
        manager.run(fork, () => {
          const handle = setInterval(() => {
            executed = true;
            clearInterval(handle);
            resolve();
          }, undefined);
          expect(handle).toBeDefined();
        });
      });
      expect(executed).toBe(true);
      fork.destroy();
    });
  });

  // ============================================
  // setInterval with mock
  // ============================================
  describe('setInterval with mock', () => {
    it('should use delay ?? 0 when delay is undefined (mocked)', () => {
      const clock = MockClock({setInterval: true});
      let count = 0;
      runTimeline(clock, () => {
        setInterval(() => {
          count++;
        });
        clock.tick(0);
      });
      expect(count).toBe(1);
      clock.destroy();
    });
  });

  // ============================================
  // clearInterval edge cases
  // ============================================
  describe('clearInterval edge cases', () => {
    it('should clear NativeTimerHandle when setInterval is not mocked', async () => {
      restoreGlobals();
      const manager = VirtualTimeManager.getInstance();
      const fork = manager.createFork({setInterval: false});
      let executed = false;
      await new Promise<void>((resolve) => {
        manager.run(fork, () => {
          const handle = setInterval(() => {
            executed = true;
          }, 1000);
          clearInterval(handle);
          resolve();
        });
      });
      await new Promise((r) => setTimeout(r, 5));
      expect(executed).toBe(false);
      fork.destroy();
    });

    it('should clear raw NodeJS.Timeout when setInterval is not mocked', async () => {
      restoreGlobals();
      const origSetInterval = globalThis.setInterval;
      const origClearInterval = globalThis.clearInterval;
      const raw_handle = origSetInterval(() => {}, 10000);

      const manager = VirtualTimeManager.getInstance();
      const fork = manager.createFork({setInterval: false});
      let cleared = false;
      await new Promise<void>((resolve) => {
        manager.run(fork, () => {
          clearInterval(raw_handle);
          cleared = true;
          resolve();
        });
      });
      expect(cleared).toBe(true);
      origClearInterval(raw_handle);
      fork.destroy();
    });

    it('should call native clearInterval for unknown id type when setInterval is mocked', () => {
      const clock = MockClock({setInterval: true});
      runTimeline(clock, () => {
        expect(() =>
          clearInterval(undefined as unknown as NodeJS.Timeout),
        ).not.toThrow();
        expect(() =>
          clearInterval({} as unknown as NodeJS.Timeout),
        ).not.toThrow();
      });
      clock.destroy();
    });
  });

  // ============================================
  // clearImmediate edge cases
  // ============================================
  describe('clearImmediate edge cases', () => {
    it('should clear NativeImmedHandle when setImmediate is not mocked', async () => {
      restoreGlobals();
      const manager = VirtualTimeManager.getInstance();
      const fork = manager.createFork({setImmediate: false});
      let executed = false;
      await new Promise<void>((resolve) => {
        manager.run(fork, () => {
          const handle = setImmediate(() => {
            executed = true;
          });
          clearImmediate(handle);
          resolve();
        });
      });
      await new Promise((r) => setTimeout(r, 5));
      expect(executed).toBe(false);
      fork.destroy();
    });

    it('should clear raw NodeJS.Immediate when setImmediate is not mocked', async () => {
      restoreGlobals();
      const origSetImmediate = globalThis.setImmediate;
      const origClearImmediate = globalThis.clearImmediate;
      const raw_handle = origSetImmediate(() => {});

      const manager = VirtualTimeManager.getInstance();
      const fork = manager.createFork({setImmediate: false});
      let cleared = false;
      await new Promise<void>((resolve) => {
        manager.run(fork, () => {
          clearImmediate(raw_handle);
          cleared = true;
          resolve();
        });
      });
      expect(cleared).toBe(true);
      origClearImmediate(raw_handle);
      fork.destroy();
    });

    it('should call native clearImmediate for unknown id type when setImmediate is mocked', () => {
      const clock = MockClock({setImmediate: true});
      runTimeline(clock, () => {
        expect(() => clearImmediate(undefined)).not.toThrow();
      });
      clock.destroy();
    });
  });

  // ============================================
  // MessageChannel edge cases
  // ============================================
  describe('MessageChannel edge cases', () => {
    it('should handle MessagePort.postMessage with no timeline', () => {
      restoreGlobals();
      const manager = VirtualTimeManager.getInstance();
      const fork = manager.createFork({MessageChannel: true});
      let message_received = false;
      manager.run(fork, () => {
        const channel = new MessageChannel();
        channel.port1.onmessage = () => {
          message_received = true;
        };
        manager.removeFork(fork.id);
        expect(() => channel.port2.postMessage('test')).not.toThrow();
      });
      expect(message_received).toBe(false);
      fork.destroy();
    });

    it('should filter MessagePort in transfer when target port is started', () => {
      const NativeMessageChannel = globalThis.MessageChannel;
      restoreGlobals();
      const native_channel = new NativeMessageChannel();
      const native_port = native_channel.port1;

      const clock = MockClock({MessageChannel: true});
      let received_ports: readonly MessagePort[] = [];
      runTimeline(clock, () => {
        const channel1 = new MessageChannel();
        channel1.port1.onmessage = (e) => {
          received_ports = e.ports;
        };
        channel1.port2.postMessage('test', [native_port]);
        clock.runAll();
      });
      expect(received_ports.length).toBe(1);
      expect(received_ports[0]).toBe(native_port);
      clock.destroy();
    });

    it('should call start() method on MessagePort', () => {
      const clock = MockClock({MessageChannel: true});
      let message_received = false;
      runTimeline(clock, () => {
        const channel = new MessageChannel();
        channel.port1.addEventListener('message', () => {
          message_received = true;
        });
        (channel.port1 as {start: () => void}).start();
        (channel.port1 as {start: () => void}).start();
        channel.port2.postMessage('test');
        clock.runAll();
      });
      expect(message_received).toBe(true);
      clock.destroy();
    });

    it('should flush queue with transfer containing MessagePort', () => {
      const NativeMessageChannel = globalThis.MessageChannel;
      restoreGlobals();
      const native_channel = new NativeMessageChannel();
      const native_port = native_channel.port1;

      const clock = MockClock({MessageChannel: true});
      let received_ports: readonly MessagePort[] = [];
      runTimeline(clock, () => {
        const channel1 = new MessageChannel();
        channel1.port2.postMessage('test', [native_port]);
        channel1.port1.addEventListener('message', (e) => {
          received_ports = e.ports;
        });
        clock.runAll();
      });
      expect(received_ports.length).toBe(1);
      expect(received_ports[0]).toBe(native_port);
      clock.destroy();
    });

    it('should return early when close() is called on already closed port', () => {
      const clock = MockClock({MessageChannel: true});
      runTimeline(clock, () => {
        const channel = new MessageChannel();
        const port = channel.port1 as unknown as {
          _closed: boolean;
          close: () => void;
        };
        port.close();
        expect(port._closed).toBe(true);
        expect(() => port.close()).not.toThrow();
        expect(port._closed).toBe(true);
      });
      clock.destroy();
    });

    it('should not deliver message when target port is closed in timer callback', () => {
      const clock = MockClock({MessageChannel: true});
      let message_received = false;
      runTimeline(clock, () => {
        const channel = new MessageChannel();
        channel.port1.onmessage = () => {
          message_received = true;
        };
        channel.port2.postMessage('test');
        (channel.port1 as unknown as {close: () => void}).close();
        clock.runAll();
      });
      expect(message_received).toBe(false);
      clock.destroy();
    });

    it('should return early when start() is called on started or closed port', () => {
      const clock = MockClock({MessageChannel: true});
      runTimeline(clock, () => {
        const channel = new MessageChannel();
        const port = channel.port1 as unknown as {
          _started: boolean;
          _closed: boolean;
          close: () => void;
          start: () => void;
        };
        // 已启动
        channel.port1.onmessage = () => {};
        expect(port._started).toBe(true);
        expect(() => port.start()).not.toThrow();
        expect(port._started).toBe(true);

        // 已关闭
        const channel2 = new MessageChannel();
        const port2 = channel2.port1 as unknown as {
          _closed: boolean;
          _started: boolean;
          close: () => void;
          start: () => void;
        };
        port2.close();
        expect(port2._closed).toBe(true);
        expect(port2._started).toBe(false);
        expect(() => port2.start()).not.toThrow();
        expect(port2._started).toBe(false);
      });
      clock.destroy();
    });

    it('should set _started and flush queue when start() is called', () => {
      const clock = MockClock({MessageChannel: true});
      let message_received = false;
      runTimeline(clock, () => {
        const channel = new MessageChannel();
        const port = channel.port1 as unknown as {
          _started: boolean;
          _closed: boolean;
          _message_queue: Array<{message: unknown}>;
          start: () => void;
        };
        EventTarget.prototype.addEventListener.call(
          channel.port1,
          'message',
          () => {
            message_received = true;
          },
        );
        expect(port._started).toBe(false);
        expect(port._closed).toBe(false);
        channel.port2.postMessage('test');
        expect(port._message_queue.length).toBe(1);
        port.start();
        expect(port._started).toBe(true);
        expect(port._message_queue.length).toBe(0);
        expect(message_received).toBe(true);
      });
      clock.destroy();
    });
  });
});
