// ========================================
// ./src/Concurrent/channel.spec.ts
// ========================================
import {describe, vi, it, expect} from 'vitest';
import {Channel, select, CHANNEL_CLOSED} from './channel';
import {ParameterError, UseAfterFreeError} from '../Errors';
import {sleep} from './delay';

// ============================
// 测试辅助函数
// ============================

// 创建可取消的 AbortSignal
const createAbortController = () => {
  const controller = new AbortController();
  return {
    signal: controller.signal,
    abort: (reason?: unknown) => controller.abort(reason),
  };
};

// 验证通道统计信息
const expectStats = <T>(
  channel: Channel<T>,
  expected: {
    capacity?: number;
    buffered?: number;
    waiting_senders?: number;
    waiting_receivers?: number;
    closed?: boolean;
    disposed?: boolean;
  },
) => {
  const stats = channel.stats;
  if (expected.capacity !== undefined)
    expect(stats.capacity).toBe(expected.capacity);
  if (expected.buffered !== undefined)
    expect(stats.buffered).toBe(expected.buffered);
  if (expected.waiting_senders !== undefined)
    expect(stats.waiting_senders).toBe(expected.waiting_senders);
  if (expected.waiting_receivers !== undefined)
    expect(stats.waiting_receivers).toBe(expected.waiting_receivers);
  if (expected.closed !== undefined) expect(stats.closed).toBe(expected.closed);
  if (expected.disposed !== undefined)
    expect(stats.disposed).toBe(expected.disposed);
};

// ============================
// Channel 测试套件
// ============================
describe.concurrent('Channel', () => {
  // ============================
  // 构造函数与基本属性
  // ============================
  describe('Construction and Basic Properties', () => {
    it('should create a channel with default capacity of 0 (unbuffered)', () => {
      const channel = new Channel();
      expect(channel.capacity).toBe(0);
      expect(channel.isClosed).toBe(false);
      expect(channel.isDisposed).toBe(false);
      expect(channel.buffered).toBe(0);
      // 验证 unbuffered 特性
      expect(channel.trySend(1)).toBe(false);
    });

    it('should create a channel with specified positive capacity', () => {
      const channel = new Channel(5);
      expect(channel.capacity).toBe(5);
      expectStats(channel, {capacity: 5, buffered: 0});
      expect(channel.trySend(1)).toBe(true);
      expect(channel.buffered).toBe(1);
    });
    it('should create a channel with specified positive capacity', () => {
      const channel = new Channel(5);
      channel.resize(0);
    });
  });

  // ============================
  // 同步发送与接收操作
  // ============================
  describe('Synchronous Operations', () => {
    describe('trySend() and tryReceive()', () => {
      it('should send and receive immediately with buffer space', () => {
        const channel = new Channel<number>(3);
        expect(channel.trySend(1)).toBe(true);
        expect(channel.trySend(2)).toBe(true);
        expect(channel.buffered).toBe(2);

        expect(channel.tryReceive()).toBe(1);
        expect(channel.tryReceive()).toBe(2);
        expect(channel.tryReceive()).toBe(undefined);
      });

      it('should fail to send when buffer is full', () => {
        const channel = new Channel<number>(2);
        expect(channel.trySend(1)).toBe(true);
        expect(channel.trySend(2)).toBe(true);
        expect(channel.trySend(3)).toBe(false);
        expect(channel.buffered).toBe(2);
      });

      it('should return undefined when buffer is empty and no pending senders', () => {
        const channel = new Channel<number>(2);
        expect(channel.tryReceive()).toBe(undefined);
      });

      it('should match pending senders immediately in unbuffered channel', async () => {
        const channel = new Channel<number>(0);
        const sendPromise = channel.send(42);
        const value = channel.tryReceive();
        expect(value).toBe(42);
        await expect(sendPromise).resolves.toBeUndefined();
      });

      it('should match pending senders immediately (async version)', async () => {
        const channel = new Channel<number>(0);
        const receivePromise = channel.receive();
        expect(channel.trySend(42)).toBe(true);
        return expect(receivePromise).resolves.toBe(42);
      });

      // 覆盖 tryReceive 中循环跳过 null (分支覆盖)
      it('should skip aborted senders (nulls) in queue', async () => {
        const channel = new Channel<number>(0);
        const ctrl1 = new AbortController();

        const s1 = channel.send(1, ctrl1.signal);
        const s2 = channel.send(2);

        ctrl1.abort();

        const val = channel.tryReceive();
        expect(val).toBe(2);

        await expect(s1).rejects.toThrow();
        await expect(s2).resolves.toBeUndefined();
      });
    });

    describe('sendSync()', () => {
      it('should behave identically to trySend', () => {
        const channel = new Channel<number>(2);
        expect(channel.sendSync(1)).toBe(true);
        expect(channel.sendSync(2)).toBe(true);
        expect(channel.sendSync(3)).toBe(false);
        expect(channel.buffered).toBe(2);
      });
    });
  });

  // ============================
  // 异步发送与接收操作
  // ============================
  describe('Asynchronous Operations', () => {
    describe('send() method', () => {
      it('should resolve immediately when buffer has space', async () => {
        const channel = new Channel<number>(2);
        await expect(channel.send(1)).resolves.toBeUndefined();
        await expect(channel.send(2)).resolves.toBeUndefined();
        expect(channel.buffered).toBe(2);
      });

      it('should wait when buffer is full', async () => {
        const channel = new Channel<number>(1);
        await channel.send(1);
        expect(channel.buffered).toBe(1);

        let secondSendResolved = false;
        void channel.send(2).then(() => {
          secondSendResolved = true;
        });

        await sleep(0);
        expect(secondSendResolved).toBe(false);
        expect(channel.buffered).toBe(1);

        expect(channel.tryReceive()).toBe(1);
        await sleep(0);
        expect(secondSendResolved).toBe(true);
        expect(channel.buffered).toBe(1);
      });

      it('should match with waiting receiver immediately in unbuffered channel', async () => {
        const channel = new Channel<number>(0);
        const receivePromise = channel.receive();
        const sendPromise = channel.send(42);
        await expect(sendPromise).resolves.toBeUndefined();
        await expect(receivePromise).resolves.toBe(42);
      });
    });

    describe('receive() method', () => {
      it('should skip aborted senders in receive loop', async () => {
        const channel = new Channel<number>(0);
        const controller = new AbortController();
        const s1 = channel.send(1, controller.signal);
        const s2 = channel.send(2);

        controller.abort(new Error('Aborted'));

        await expect(channel.receive()).resolves.toBe(2);
        await expect(s1).rejects.toThrow('Aborted');
        await expect(s2).resolves.toBeUndefined();
      });

      it('should resolve immediately when buffer has items', async () => {
        const channel = new Channel<number>(2);
        await channel.send(1);
        await expect(channel.receive()).resolves.toBe(1);
      });

      it('should wait when buffer is empty', async () => {
        const channel = new Channel<number>(1);
        let receiveResolved = false;
        let receivedValue: number | typeof CHANNEL_CLOSED = 0;
        void channel.receive().then((value) => {
          receiveResolved = true;
          receivedValue = value;
        });

        await sleep(0);
        expect(receiveResolved).toBe(false);

        await channel.send(42);
        await sleep(0);
        expect(receiveResolved).toBe(true);
        expect(receivedValue).toBe(42);
      });

      it('should return CHANNEL_CLOSED when channel is closed and empty', async () => {
        const channel = new Channel<number>(2);
        channel.close();
        await expect(channel.receive()).resolves.toBe(CHANNEL_CLOSED);
      });

      // 覆盖 receive/tryReceive 中跳过 null senders (分支覆盖)
      it('should skip aborted senders (nulls) in queue', async () => {
        const channel = new Channel<number>(0);
        const ctrl1 = new AbortController();

        const s1 = channel.send(1, ctrl1.signal);
        const s2 = channel.send(2);

        ctrl1.abort();

        const val = await channel.receive();
        expect(val).toBe(2);

        await expect(s1).rejects.toThrow();
        await expect(s2).resolves.toBeUndefined();
      });
    });
  });

  // ============================
  // 生命周期：关闭、清理与统计
  // ============================
  describe('Lifecycle: Close, Dispose and Drain', () => {
    describe('close() method', () => {
      it('should mark channel as closed', () => {
        const channel = new Channel<number>(2);
        expect(channel.isClosed).toBe(false);
        channel.close();
        expect(channel.isClosed).toBe(true);
      });

      it('should be idempotent - calling close on a closed channel', () => {
        const channel = new Channel<number>(2);
        channel.close();
        expect(() => channel.close()).not.toThrow();
        expect(channel.isClosed).toBe(true);
      });

      it('should handle close call on a disposed channel', () => {
        const channel = new Channel<number>(2);
        channel.dispose();
        expect(channel.isDisposed).toBe(true);
        expect(() => channel.close()).not.toThrow();
      });

      it('should handle receivers without abort handlers during close', async () => {
        const channel = new Channel<number>(0);
        const receivePromise = channel.receive();
        channel.close();
        await expect(receivePromise).resolves.toBe(CHANNEL_CLOSED);
      });

      it('should reject pending senders', async () => {
        const channel = new Channel<number>(1);
        await channel.send(1);
        const pendingSend = channel.send(2);
        channel.close();
        await expect(pendingSend).rejects.toThrow(UseAfterFreeError);
      });

      it('should resolve pending receivers with CHANNEL_CLOSED', async () => {
        const channel = new Channel<number>(0);
        const pendingReceive = channel.receive();
        channel.close();
        await expect(pendingReceive).resolves.toBe(CHANNEL_CLOSED);
      });

      it('should allow receiving remaining buffered items', async () => {
        const channel = new Channel<number>(3);
        await channel.send(1);
        await channel.send(2);
        channel.close();
        expect(await channel.receive()).toBe(1);
        expect(await channel.receive()).toBe(2);
        expect(await channel.receive()).toBe(CHANNEL_CLOSED);
      });

      it('should prevent new sends', () => {
        const channel = new Channel<number>(2);
        channel.close();
        expect(() => channel.sendSync(1)).toThrow(UseAfterFreeError);
        expect(channel.trySend(1)).toBe(false);
      });

      it('should skip null senders during close', async () => {
        const channel = new Channel<number>(0);
        const controller = new AbortController();

        const s1 = channel.send(1, controller.signal);
        const s2 = channel.send(2);

        controller.abort();
        await expect(s1).rejects.toThrow();

        channel.close();
        await expect(s2).rejects.toThrow(UseAfterFreeError);
      });

      it('should skip null receivers during close', async () => {
        const channel = new Channel<number>(0);
        const controller = new AbortController();

        const r1 = channel.receive(controller.signal);
        const r2 = channel.receive();

        controller.abort();
        await expect(r1).rejects.toThrow();

        channel.close();
        await expect(r2).resolves.toBe(CHANNEL_CLOSED);
      });
    });

    describe('dispose() method', () => {
      it('should be idempotent - calling dispose on a disposed channel', () => {
        const channel = new Channel<number>(2);
        channel.dispose();
        expect(() => channel.dispose()).not.toThrow();
        expect(channel.isDisposed).toBe(true);
      });

      it('should mark channel as disposed and closed', () => {
        const channel = new Channel<number>(2);
        channel.dispose();
        expect(channel.isDisposed).toBe(true);
        expect(channel.isClosed).toBe(true);
      });

      it('should clear all internal buffers and queues (senders)', async () => {
        const channel = new Channel<number>(0);
        const sendPromise = channel.send(1);
        channel.dispose();
        await expect(sendPromise).rejects.toThrow(UseAfterFreeError);
      });

      it('should clear all internal buffers and queues (receivers)', async () => {
        const channel = new Channel<number>(0);
        const receivePromise = channel.receive();
        channel.dispose();
        expect(await receivePromise).toBe(CHANNEL_CLOSED);
      });

      it('should support Symbol.dispose', () => {
        const channel = new Channel<number>(2);
        channel[Symbol.dispose]();
        expect(channel.isDisposed).toBe(true);
        expect(channel.isClosed).toBe(true);
      });

      it('should reject pending receiver resolve if disposed before microtask', async () => {
        const channel = new Channel<number>(0);
        void channel.receive();
        const sendPromise = channel.send(1);
        channel.dispose();
        await Promise.resolve();
        await expect(sendPromise).resolves.toBeUndefined();
      });
    });

    describe('drain() method', () => {
      it('should drain buffer correctly', () => {
        const channel = new Channel<number>(5);
        for (let i = 1; i <= 3; i++) channel.sendSync(i);
        const drained = channel.drain();
        expect(drained).toBe(3);
        expect(channel.buffered).toBe(0);
        expect(channel.tryReceive()).toBe(undefined);
      });

      it('should move pending senders to buffer after draining', async () => {
        const channel = new Channel<number>(1);
        channel.sendSync(1);
        expect(channel.buffered).toBe(1);

        const pendingSend = channel.send(2);
        const drainedCount = channel.drain();
        expect(drainedCount).toBe(1);
        expect(channel.buffered).toBe(1);

        const val = channel.tryReceive();
        expect(val).toBe(2);

        await expect(pendingSend).resolves.toBeUndefined();
      });

      // 覆盖 compactQueue 中 remaining === 0 的分支
      it('should reset queue array length when compacting an empty queue via drain', async () => {
        const capacity = 300;
        const channel = new Channel<number>(capacity);

        for (let i = 0; i < capacity; i++) {
          channel.sendSync(i);
        }

        const queueSize = 200;
        const sendPromises = Array.from({length: queueSize}, () =>
          channel.send(999),
        );

        channel.drain();

        expect(channel.stats.waiting_senders).toBe(0);
        expect(channel.buffered).toBe(200);

        channel.close();
        await Promise.allSettled(sendPromises);
      });
    });

    describe('Stats', () => {
      it('should calculate stats correctly with pending operations', async () => {
        const channel = new Channel<number>(0);
        const sendPromises = Array.from({length: 5}, () => channel.send(1));
        const stats = channel.stats;
        expect(stats.waiting_senders).toBe(5);
        expect(stats.waiting_receivers).toBe(0);

        channel.close();
        const results = await Promise.allSettled(sendPromises);
        results.forEach((r) => expect(r.status).toBe('rejected'));
      });

      it('should calculate stats correctly for waiting receivers', () => {
        const channel = new Channel<number>(0);
        void channel.receive();
        void channel.receive();
        void channel.receive();
        expect(channel.stats.waiting_receivers).toBe(3);
        channel.close();
      });

      // 验证 stats 在队列包含 null 节点时的计数准确性 (分支覆盖)
      it('should accurately count when queue contains null nodes', async () => {
        const channel = new Channel<number>(0);

        const p1 = channel.receive();
        const p2 = channel.receive();
        const p3 = channel.receive();

        const ctrl = new AbortController();
        const pToAbort = channel.receive(ctrl.signal);
        ctrl.abort();

        const stats = channel.stats;
        expect(stats.waiting_receivers).toBe(3);

        channel.sendSync(1);
        channel.sendSync(2);
        channel.sendSync(3);
        await Promise.all([p1, p2, p3]);
        try {
          await pToAbort;
        } catch {
          /* empty */
        }

        const s1 = channel.send(10);
        const s2 = channel.send(20);
        const ctrl2 = new AbortController();
        const sToAbort = channel.send(30, ctrl2.signal);
        ctrl2.abort();

        expect(channel.stats.waiting_senders).toBe(2);

        channel.close();
        await Promise.allSettled([s1, s2, sToAbort]);
      });
    });
  });

  // ============================
  // 缓冲区管理：扩容、缩容与调整大小
  // ============================
  describe('Buffer Management and Resizing', () => {
    describe('resize() method', () => {
      it('should return true immediately if capacity is unchanged', () => {
        const channel = new Channel<number>(5);
        for (let i = 0; i < 5; i++) channel.sendSync(i);
        expect(channel.resize(5)).toBe(true);
        expect(channel.capacity).toBe(5);
        expect(channel.buffered).toBe(5);
        expect(channel.tryReceive()).toBe(0);
      });

      it('should increase capacity successfully', () => {
        const channel = new Channel<number>(2);
        channel.sendSync(1);
        channel.sendSync(2);
        expect(channel.resize(5)).toBe(true);
        expect(channel.capacity).toBe(5);
        expect(channel.sendSync(3)).toBe(true);
      });

      it('should decrease capacity with discard-oldest strategy', () => {
        const channel = new Channel<number>(5);
        for (let i = 1; i <= 5; i++) channel.sendSync(i);
        channel.resize(3, {strategy: 'discard-oldest'});
        expect(channel.capacity).toBe(3);
        expect(channel.tryReceive()).toBe(3);
      });

      it('should decrease capacity with discard-newest strategy', () => {
        const channel = new Channel<number>(5);
        for (let i = 1; i <= 5; i++) channel.sendSync(i);
        channel.resize(3, {strategy: 'discard-newest'});
        expect(channel.capacity).toBe(3);
        expect(channel.tryReceive()).toBe(1);
      });

      it('should throw error when decreasing capacity without strategy', () => {
        const channel = new Channel<number>(5);
        channel.sendSync(1);
        channel.sendSync(2);
        channel.sendSync(3);
        expect(() => channel.resize(2)).toThrow(ParameterError);
      });

      it('should process pending senders after increasing capacity with flush_pending', async () => {
        const channel = new Channel<number>(1);
        await channel.send(1);
        let pendingSendResolved = false;
        void channel.send(2).then(() => {
          pendingSendResolved = true;
        });

        await sleep(0);
        expect(pendingSendResolved).toBe(false);

        channel.resize(3, {flush_pending: true});
        await sleep(0);
        expect(pendingSendResolved).toBe(true);
        expect(channel.buffered).toBe(2);
      });

      it('should handle wrap-around buffer copy during resize', () => {
        const capacity = 5;
        const channel = new Channel<number>(capacity);

        for (let i = 1; i <= capacity; i++) channel.sendSync(i);
        channel.tryReceive();
        channel.tryReceive();
        channel.sendSync(6);
        channel.sendSync(7);

        channel.resize(10);

        expect(channel.tryReceive()).toBe(3);
        expect(channel.tryReceive()).toBe(4);
        expect(channel.tryReceive()).toBe(5);
        expect(channel.tryReceive()).toBe(6);
        expect(channel.tryReceive()).toBe(7);
        expect(channel.tryReceive()).toBe(undefined);
      });

      // 覆盖 processPendingSenders 中跳过 aborted senders (分支覆盖)
      it('should skip aborted senders when filling buffer during flush_pending', async () => {
        const channel = new Channel<number>(0);
        const ctrl1 = new AbortController();

        const s1 = channel.send(1, ctrl1.signal);
        const s2 = channel.send(2);

        ctrl1.abort();

        channel.resize(1, {flush_pending: true});

        expect(channel.buffered).toBe(1);
        expect(channel.tryReceive()).toBe(2);

        await expect(s1).rejects.toThrow();
        await expect(s2).resolves.toBeUndefined();
      });
    });

    describe('tryResize() method', () => {
      it('should return true on successful resize', () => {
        const channel = new Channel<number>(2);
        expect(channel.tryResize(5)).toBe(true);
        expect(channel.capacity).toBe(5);
      });

      it('should return false on failed resize', () => {
        const channel = new Channel<number>(3);
        for (let i = 1; i <= 3; i++) channel.sendSync(i);
        expect(channel.tryResize(2)).toBe(false);
        expect(channel.capacity).toBe(3);
      });
    });
  });

  // ============================
  // 迭代器与批量接收
  // ============================
  describe('Iterators and Batch Receiving', () => {
    describe('async iterator', () => {
      it('should iterate through all values until channel closes', async () => {
        const channel = new Channel<number>(3);
        const sendValues = async () => {
          await channel.send(1);
          await channel.send(2);
          await channel.send(3);
          channel.close();
        };
        void sendValues();

        const received: number[] = [];
        for await (const value of channel) received.push(value);
        expect(received).toEqual([1, 2, 3]);
      });

      it('should exit loop immediately when channel is already closed', async () => {
        const channel = new Channel<number>(2);
        channel.close();
        const received: number[] = [];
        for await (const value of channel) received.push(value);
        expect(received).toEqual([]);
      });

      it('should handle interleaved sends and iteration', async () => {
        const channel = new Channel<number>(2);
        const iterationPromise = (async () => {
          const received: number[] = [];
          for await (const value of channel) {
            received.push(value);
            if (received.length >= 3) break;
          }
          return received;
        })();

        void channel.send(1);
        void channel.send(2);
        void channel.send(3);
        channel.close();

        const result = await iterationPromise;
        expect(result).toEqual([1, 2, 3]);
      });
    });

    describe('receiveBatch() method', () => {
      it('should yield batches of specified max size', async () => {
        const channel = new Channel<number>(10);
        for (let i = 1; i <= 7; i++) channel.sendSync(i);
        channel.close();

        const batches: number[][] = [];
        for await (const batch of channel.receiveBatch(3)) batches.push(batch);
        expect(batches).toEqual([[1, 2, 3], [4, 5, 6], [7]]);
      });

      it('should yield final partial batch', async () => {
        const channel = new Channel<number>(5);
        channel.sendSync(1);
        channel.sendSync(2);
        channel.close();

        const batches: number[][] = [];
        for await (const batch of channel.receiveBatch(5)) batches.push(batch);
        expect(batches).toEqual([[1, 2]]);
      });

      it('should handle empty channel', async () => {
        const channel = new Channel<number>(2);
        channel.close();
        const batches: number[][] = [];
        for await (const batch of channel.receiveBatch(3)) batches.push(batch);
        expect(batches).toEqual([]);
      });

      it('should respect abort signal', async () => {
        const channel = new Channel<number>(5);
        const controller = createAbortController();
        const batchPromise = (async () => {
          const batches: number[][] = [];
          for await (const batch of channel.receiveBatch(
            2,
            controller.signal,
          )) {
            batches.push(batch);
          }
          return batches;
        })();

        queueMicrotask(() => controller.abort(new Error('Aborted')));
        await expect(batchPromise).rejects.toThrow('Aborted');
      });

      // receiveBatch 循环内部的 signal.aborted 检查
      it('should abort between iterations', async () => {
        const channel = new Channel<number>(5);
        const controller = new AbortController();

        channel.sendSync(1);
        channel.sendSync(2);
        channel.sendSync(3);
        channel.sendSync(4);

        const batches: number[][] = [];
        const batchPromise = (async () => {
          for await (const batch of channel.receiveBatch(
            2,
            controller.signal,
          )) {
            batches.push(batch);
            if (batches.length === 1) {
              controller.abort(new Error('Aborted between batches'));
            }
          }
        })();

        await expect(batchPromise).rejects.toThrow('Aborted between batches');
        expect(batches).toEqual([[1, 2]]);
      });
    });
  });

  // ============================
  // 取消信号支持
  // ============================
  describe('AbortSignal Support', () => {
    it('should cleanup abort handler when sender resolves via processPendingSenders', async () => {
      const channel = new Channel<number>(1);
      const controller = new AbortController();

      // 填满缓冲区
      await channel.send(1);

      // 发送第二个消息，会被阻塞，并提供 signal
      const sendPromise = channel.send(2, controller.signal);

      // 接收消息，触发 processPendingSenders，解决等待的发送者
      expect(await channel.receive()).toBe(1);

      // 验证发送成功
      await expect(sendPromise).resolves.toBeUndefined();
      expect(channel.buffered).toBe(1);
      expect(await channel.receive()).toBe(2);
    });

    it('should clean up abort handler when receiver resolves before abort', async () => {
      const channel = new Channel<number>(0);
      const controller = new AbortController();

      const receivePromise = channel.receive(controller.signal);
      await channel.send(42);

      await expect(receivePromise).resolves.toBe(42);
    });

    it('should abort pending send operation', async () => {
      const channel = new Channel<number>(1);
      const controller = createAbortController();
      await channel.send(1);
      const sendPromise = channel.send(2, controller.signal);
      queueMicrotask(() => controller.abort(new Error('Send aborted')));
      await expect(sendPromise).rejects.toThrow('Send aborted');
      expect(channel.buffered).toBe(1);
      expect(channel.isClosed).toBe(false);
    });

    it('should abort pending receive operation', async () => {
      const channel = new Channel<number>(0);
      const controller = createAbortController();
      const receivePromise = channel.receive(controller.signal);
      queueMicrotask(() => controller.abort(new Error('Receive aborted')));
      await expect(receivePromise).rejects.toThrow('Receive aborted');
    });

    it('should throw immediately if signal is already aborted', async () => {
      const channel = new Channel<number>(1);
      const controller = new AbortController();
      controller.abort(new Error('Already aborted'));
      const signal = controller.signal;
      await expect(channel.send(1, signal)).rejects.toThrow('Already aborted');
      await expect(channel.receive(signal)).rejects.toThrow('Already aborted');
    });

    it('should clean up abort handlers after operation completes', async () => {
      const channel = new Channel<number>(1);
      const controller = createAbortController();
      await channel.send(1, controller.signal);
      controller.abort(new Error('Test'));
      expect(channel.buffered).toBe(1);
    });

    it('should handle receiver already removed from queue during abort', async () => {
      const channel = new Channel<number>(1);
      const controller = new AbortController();

      await channel.send(42);
      const receivePromise = channel.receive(controller.signal);

      controller.abort();

      await expect(receivePromise).resolves.toBe(42);
      expect(channel.stats.waiting_receivers).toBe(0);
    });
  });

  // ============================
  // 并发与竞态条件
  // ============================
  describe('Concurrency and Race Conditions', () => {
    it('should handle multiple concurrent senders and receivers', async () => {
      const channel = new Channel<number>(2);
      const numOperations = 10;
      const sendPromises = Array.from({length: numOperations}, (_, i) =>
        channel.send(i).then(() => i),
      );
      const receivePromises = Array.from({length: numOperations}, () =>
        channel.receive(),
      );

      const sent = await Promise.all(sendPromises);
      const received = await Promise.all(receivePromises);

      expect(sent.sort()).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
      expect(received.sort()).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });

    it('should maintain order in buffered channel', async () => {
      const channel = new Channel<number>(10);
      const sendPromises: Promise<void>[] = [];
      for (let i = 0; i < 5; i++) sendPromises.push(channel.send(i));
      await Promise.all(sendPromises);

      const received: (number | symbol)[] = [];
      for (let i = 0; i < 5; i++) received.push(await channel.receive());
      expect(received).toEqual([0, 1, 2, 3, 4]);
    });

    it('should handle rapid open/close cycles', async () => {
      const channel = new Channel<number>(2);
      channel.sendSync(1);
      channel.sendSync(2);
      channel.close();
      expect(() => channel.sendSync(3)).toThrow(UseAfterFreeError);
      expect(await channel.receive()).toBe(1);
    });

    it('should not lose messages during resize', async () => {
      const channel = new Channel<number>(2);
      const received: number[] = [];
      channel.sendSync(1);
      channel.sendSync(2);

      const receivePromise = channel.receive().then((val) => {
        if (val !== CHANNEL_CLOSED) received.push(val);
      });

      channel.resize(4, {flush_pending: true});
      channel.sendSync(3);
      channel.sendSync(4);
      channel.close();

      await receivePromise;
      for await (const value of channel) received.push(value);
      expect(received).toEqual([1, 2, 3, 4]);
    });
  });

  // ============================
  // 内部机制与边缘情况
  // ============================
  describe('Internal Mechanics and Edge Cases', () => {
    it('should throw UseAfterFreeError when using disposed channel', () => {
      const channel = new Channel<number>(2);
      channel.dispose();
      expect(() => channel.sendSync(1)).toThrow(UseAfterFreeError);
      expect(() => channel.tryReceive()).toThrow(UseAfterFreeError);
      expect(() => channel.resize(5)).toThrow(UseAfterFreeError);
      expect(() => channel.drain()).toThrow(UseAfterFreeError);
    });

    it('should handle tryReceive on closed empty channel', () => {
      const channel = new Channel<number>(2);
      channel.sendSync(1);
      channel.close();
      expect(channel.tryReceive()).toBe(1);
      expect(channel.tryReceive()).toBe(CHANNEL_CLOSED);
    });

    it('should compact receiver queue correctly when thresholds met', () => {
      const COUNT = 2500;
      const channelRecv = new Channel<number>(0);
      const receivers = Array.from({length: COUNT}, () =>
        channelRecv.receive(),
      );

      for (let i = 0; i < COUNT; i++) channelRecv.sendSync(i);

      expect(channelRecv.stats.waiting_receivers).toBe(0);
      return Promise.all(receivers);
    });

    it('should compact sender queue inside processPendingSenders', async () => {
      const COUNT = 2500;
      const channelSend = new Channel<number>(2000);

      const senders = Array.from({length: COUNT}, (_, i) =>
        channelSend.send(i),
      );

      const val = await channelSend.receive();
      expect(val).toBe(0);

      for (let i = 0; i < 1999; i++) await channelSend.receive();

      const nextVal = await channelSend.receive();
      expect(nextVal).toBe(2000);

      for (let i = 1; i < 500; i++) await channelSend.receive();
      await Promise.all(senders);
    });

    it('should empty queue in compactQueue if remaining is 0', async () => {
      const channelBuf = new Channel<number>(5000);

      for (let i = 0; i < 5000; i++) channelBuf.sendSync(i);

      const pending = Array.from({length: 2500}, () => channelBuf.send(100));

      for (let i = 0; i < 5000; i++) void channelBuf.receive();

      void channelBuf.receive();

      expect(channelBuf.stats.waiting_senders).toBe(0);
      channelBuf.close();
      await Promise.allSettled(pending);
    });

    it('should compact sender queue when threshold met', async () => {
      const channelBuf2 = new Channel<number>(1);
      channelBuf2.sendSync(0);
      const bigSenderList = Array.from({length: 2500}, (_, i) =>
        channelBuf2.send(i),
      );

      for (let i = 0; i < 1100; i++) void channelBuf2.receive();

      channelBuf2.close();
      await Promise.allSettled(bigSenderList);
    });

    it('should handle zero-capacity channel with many concurrent operations', async () => {
      const channel = new Channel<number>(0);
      const numOperations = 100;
      const sendPromises = Array.from({length: numOperations}, (_, i) =>
        channel.send(i),
      );
      const receivePromises = Array.from({length: numOperations}, () =>
        channel.receive(),
      );
      await Promise.all([...sendPromises, ...receivePromises]);
      expect(channel.buffered).toBe(0);
    });

    it('should handle null nodes during compaction', async () => {
      const channel = new Channel<number>(100);

      for (let i = 0; i < 100; i++) {
        channel.sendSync(i);
      }

      const sendPromises = Array.from({length: 150}, (_, i) =>
        channel.send(i + 100),
      );

      const abortController = new AbortController();
      const abortedSender = channel.send(999, abortController.signal);
      abortController.abort();

      for (let i = 0; i < 70; i++) {
        await channel.receive();
      }

      const newSender = channel.send(1);

      channel.close();
      await Promise.allSettled([...sendPromises, abortedSender, newSender]);
    });

    it('should update node indices so aborts work correctly after compact', async () => {
      const channel = new Channel<number>(0);
      const controllers: AbortController[] = [];

      const receives = Array.from({length: 150}, () => {
        const c = new AbortController();
        controllers.push(c);
        return channel.receive(c.signal);
      });

      for (let i = 0; i < 100; i++) {
        channel.sendSync(i);
      }

      controllers[100].abort(new Error('Abort'));

      channel.sendSync(999);

      await expect(receives[100]).rejects.toThrow();
      await expect(receives[101]).resolves.toBe(999);
    });
  });

  describe('select', () => {
    // ============================
    // 同步选择 (非阻塞)
    // ============================
    describe('Synchronous Selection (Non-blocking)', () => {
      it('should select a ready send operation immediately', async () => {
        const ch = new Channel<number>(1);
        const result = await select([{op: 'send', channel: ch, value: 42}]);

        expect(result.op).toBe('send');
        // 修复类型: 使用类型守卫缩小类型范围
        if (result.op === 'send') {
          expect(result.value).toBe(42);
        }
        expect(ch.buffered).toBe(1);
        expect(await ch.receive()).toBe(42); // 验证值确实被发送了
      });

      it('should select a ready receive operation immediately', async () => {
        const ch = new Channel<number>(1);
        ch.sendSync(42);

        const result = await select([{op: 'receive', channel: ch}]);

        expect(result.op).toBe('receive');
        if (result.op === 'receive') {
          expect(result.value).toBe(42);
        }
        expect(ch.buffered).toBe(0);
      });

      it('should distribute selections fairly among multiple ready cases (random balance)', async () => {
        const ch1 = new Channel<number>(100);
        const ch2 = new Channel<number>(100);

        // 1. 准备好大量数据，确保两个通道一直处于 Ready 状态
        for (let i = 0; i < 100; i++) {
          ch1.sendSync(1);
          ch2.sendSync(2);
        }

        let countCh1 = 0;
        let countCh2 = 0;
        const iterations = 100;

        // 2. 连续进行多次 select 采样
        for (let i = 0; i < iterations; i++) {
          const result = await select([
            {op: 'receive', channel: ch1},
            {op: 'receive', channel: ch2},
          ]);

          if (result.op === 'receive') {
            if (result.value === 1) countCh1++;
            if (result.value === 2) countCh2++;
          }
        }

        // 3. 统计学断言：在 100 次迭代中，不应该出现某一方完全被压制的情况
        expect(countCh1).toBeGreaterThan(0);
        expect(countCh2).toBeGreaterThan(0);
        expect(countCh1 + countCh2).toBe(iterations);

        // 稍微严格一点的均匀性检查
        expect(Math.abs(countCh1 - countCh2)).toBeLessThan(iterations * 0.6);
      });

      it('should return CHANNEL_CLOSED immediately if channel is closed (sync check)', async () => {
        const ch = new Channel<number>(0);
        ch.close();

        const result = await select([{op: 'receive', channel: ch}]);

        expect(result.op).toBe('receive');
        if (result.op === 'receive') {
          expect(result.value).toBe(CHANNEL_CLOSED);
        }
      });
    });

    // ============================
    // Default 子句 (非阻塞)
    // ============================
    describe('Default Clause (Non-blocking)', () => {
      it('should execute default callback and return default result if no case is ready', async () => {
        const ch = new Channel<number>(0); // 空 channel，无缓冲
        const mockDefault = vi.fn();

        const result = await select(
          [{op: 'receive', channel: ch}], // receive 会阻塞
          undefined,
          {default: mockDefault},
        );

        expect(result.op).toBe('default');
        expect(mockDefault).toHaveBeenCalledTimes(1);
      });

      it('should NOT execute default if a case is ready synchronously', async () => {
        const ch = new Channel<number>(1);
        ch.sendSync(42); // 准备好数据
        const mockDefault = vi.fn();

        const result = await select([{op: 'receive', channel: ch}], undefined, {
          default: mockDefault,
        });

        // 应该走 receive 分支，而不是 default
        expect(result.op).toBe('receive');
        if (result.op === 'receive') {
          expect(result.value).toBe(42);
        }
        expect(mockDefault).not.toHaveBeenCalled();
      });

      it('should prefer ready send over default', async () => {
        const ch = new Channel<number>(1); // 缓冲区有空位
        const mockDefault = vi.fn();

        const result = await select(
          [{op: 'send', channel: ch, value: 100}],
          undefined,
          {default: mockDefault},
        );

        expect(result.op).toBe('send');
        if (result.op === 'send') {
          expect(result.value).toBe(100);
        }
        expect(mockDefault).not.toHaveBeenCalled();
      });

      it('should throw immediately if signal is aborted, even if default is provided', async () => {
        const ch = new Channel<number>(0);
        const controller = new AbortController();
        controller.abort(); // 预先中止
        const mockDefault = vi.fn();

        // 实现逻辑中，abort 检查优先于 default 检查
        await expect(
          select([{op: 'receive', channel: ch}], controller.signal, {
            default: mockDefault,
          }),
        ).rejects.toThrow(DOMException);

        expect(mockDefault).not.toHaveBeenCalled();
      });
    });

    // ============================
    // 异步选择 (阻塞与竞态)
    // ============================
    describe('Asynchronous Selection (Blocking & Racing)', () => {
      it('should wait asynchronously for a receive operation', async () => {
        const ch = new Channel<number>(0);
        const selectPromise = select([{op: 'receive', channel: ch}]);

        // 延迟发送，确保 select 进入等待状态
        queueMicrotask(() => ch.sendSync(42));

        const result = await selectPromise;
        expect(result.op).toBe('receive');
        if (result.op === 'receive') {
          expect(result.value).toBe(42);
        }
      });

      it('should wait asynchronously for a send operation', async () => {
        const ch = new Channel<number>(0);
        const selectPromise = select([{op: 'send', channel: ch, value: 42}]);

        // 通过接收解除阻塞
        queueMicrotask(() => {
          const val = ch.tryReceive();
          expect(val).toBe(42);
        });

        const result = await selectPromise;
        expect(result.op).toBe('send');
        if (result.op === 'send') {
          expect(result.value).toBe(42);
        }
      });

      it('should race multiple async operations and return the winner', async () => {
        const ch1 = new Channel<number>(0);
        const ch2 = new Channel<number>(0);

        const selectPromise = select([
          {op: 'receive', channel: ch1},
          {op: 'receive', channel: ch2},
        ]);

        // 先解除 ch2 的阻塞
        queueMicrotask(() => ch2.sendSync(100));

        const result = await selectPromise;
        expect(result.op).toBe('receive');
        if (result.op === 'receive') {
          expect(result.value).toBe(100); // 胜者
        }
      });

      it('should handle mixed send and receive cases', async () => {
        const ch1 = new Channel<number>(0);
        const ch2 = new Channel<number>(0);

        const selectPromise = select([
          {op: 'receive', channel: ch1},
          {op: 'send', channel: ch2, value: 99},
        ]);

        void ch1.send(1);

        const result = await selectPromise;
        expect(result.op).toBe('receive');
        if (result.op === 'receive') {
          expect(result.value).toBe(1);
        }

        await sleep(0);
        expect(ch2.stats.waiting_senders).toBe(0);
      });
    });

    // ============================
    // 取消与清理
    // ============================
    describe('Cancellation and Cleanup', () => {
      it('should cancel pending operations when one case wins', async () => {
        const ch1 = new Channel<number>(0);
        const ch2 = new Channel<number>(0);
        const ch3 = new Channel<number>(0);

        const selectPromise = select([
          {op: 'receive', channel: ch1},
          {op: 'receive', channel: ch2},
          {op: 'receive', channel: ch3},
        ]);

        await sleep(0);

        expect(ch1.stats.waiting_receivers).toBe(1);
        expect(ch2.stats.waiting_receivers).toBe(1);
        expect(ch3.stats.waiting_receivers).toBe(1);

        ch1.sendSync(1);
        await selectPromise;

        await sleep(0);
        expect(ch1.stats.waiting_receivers).toBe(0);
        expect(ch2.stats.waiting_receivers).toBe(0);
        expect(ch3.stats.waiting_receivers).toBe(0);
      });

      it('should abort select when external signal is provided and aborted', async () => {
        const ch = new Channel<number>(0);
        const controller = new AbortController();

        const selectPromise = select(
          [{op: 'receive', channel: ch}],
          controller.signal,
        );

        controller.abort(new Error('External Abort'));

        await expect(selectPromise).rejects.toThrow(DOMException);
        expect(ch.stats.waiting_receivers).toBe(0);
      });

      it('should throw immediately if signal is already aborted', async () => {
        const ch = new Channel<number>(0);
        const controller = new AbortController();
        controller.abort();

        await expect(
          select([{op: 'receive', channel: ch}], controller.signal),
        ).rejects.toThrow(DOMException);
      });

      it('should handle channel close while waiting (send case)', async () => {
        const ch = new Channel<number>(0);
        const selectPromise = select([{op: 'send', channel: ch, value: 1}]);

        queueMicrotask(() => ch.close());

        await expect(selectPromise).rejects.toThrow(UseAfterFreeError);
      });

      it('should handle channel close while waiting (receive case)', async () => {
        const ch = new Channel<number>(0);
        const selectPromise = select([{op: 'receive', channel: ch}]);

        queueMicrotask(() => ch.close());

        const result = await selectPromise;
        expect(result.op).toBe('receive');
        if (result.op === 'receive') {
          expect(result.value).toBe(CHANNEL_CLOSED);
        }
      });
    });

    // ============================
    // 错误处理与边缘情况
    // ============================
    describe('Error Handling and Edge Cases', () => {
      it('should skip aborted operations during sync check', async () => {
        const ch = new Channel<number>(0);
        ch.close(); // 故意关闭，用来测试如果不跳过就会报错

        // 1. 创建一个已经 abort 的控制器
        const controller = new AbortController();
        controller.abort();

        // 2. 将 signal 传入操作项
        // 注意：标准 select 不支持 case 级别的 signal，这里假设测试意图是外部 signal
        const result = select(
          [{op: 'send', channel: ch, value: 1}],
          controller.signal,
        );

        // 3. 既然 signal 已中止，select 应该立即抛出中止异常
        await expect(result).rejects.toThrow();
      });

      it('should allow reusing the same channel in multiple cases (weird but valid)', async () => {
        const ch = new Channel<number>(0);

        const send_promise = ch.send(1);

        const result = await select([
          {op: 'receive', channel: ch},
          {op: 'receive', channel: ch},
        ]);

        if (result.op === 'receive') {
          expect(result.value).toBe(1);
        }
        expect(ch.buffered).toBe(0);

        await send_promise;
      });
    });
  });
});
