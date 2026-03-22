// ========================================
// ./src/Reactive/flow.spec.ts
// ========================================
import {describe, it, expect, vi, afterAll} from 'vitest';
import {
  Flow,
  FlowContinue,
  FlowStop,
  SerialFlow,
  BehaviorFlow,
  ColdFlow,
  SerialColdFlow,
  fromProducer,
  fromSerialProducer,
  of,
  from,
} from './flow';
import {FlowCompletionError, UseAfterFreeError} from 'src/Errors';
import {delay, sleep} from 'src/Concurrent/delay';
import {
  MockClock,
  withTimelineAsync,
  restoreGlobals,
} from 'src/MockClock/__export__';

afterAll(restoreGlobals);

describe.concurrent('Flow', () => {
  // ============================================
  // FlowContinue and FlowStop
  // ============================================
  describe('FlowContinue and FlowStop', () => {
    it('should return FlowContinue symbol', () => {
      expect(typeof FlowContinue).toBe('symbol');
    });

    it('should return the value passed to FlowStop', () => {
      expect(FlowStop(42)).toBe(42);
      expect(FlowStop('hello')).toBe('hello');
      expect(FlowStop({a: 1})).toEqual({a: 1});
    });
  });

  // ============================================
  // Flow Basic Operations
  // ============================================
  describe('Basic operations', () => {
    it('should emit values to subscribers', () => {
      const flow = new Flow<number>();
      const handler = vi.fn();
      flow.subscribe(handler);
      flow.next(1);
      flow.next(2);
      expect(handler).toHaveBeenCalledTimes(2);
      expect(handler).toHaveBeenCalledWith(1);
      expect(handler).toHaveBeenCalledWith(2);
    });

    it('should support observer object subscription', () => {
      const flow = new Flow<number>();
      const nextHandler = vi.fn();
      flow.subscribe({next: nextHandler});
      flow.next(42);
      expect(nextHandler).toHaveBeenCalledWith(42);
    });

    it('should unsubscribe correctly', () => {
      const flow = new Flow<number>();
      const handler = vi.fn();
      const sub = flow.subscribe(handler);
      flow.next(1);
      sub.unsubscribe();
      flow.next(2);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should support Symbol.dispose for unsubscribe', () => {
      const flow = new Flow<number>();
      const handler = vi.fn();
      const sub = flow.subscribe(handler);
      flow.next(1);
      sub[Symbol.dispose]();
      flow.next(2);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple subscribers', () => {
      const flow = new Flow<number>();
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      flow.subscribe(handler1);
      flow.subscribe(handler2);
      flow.next(42);
      expect(handler1).toHaveBeenCalledWith(42);
      expect(handler2).toHaveBeenCalledWith(42);
    });
  });

  // ============================================
  // Error Handling
  // ============================================
  describe('Error handling', () => {
    it('should broadcast error to subscribers', () => {
      const flow = new Flow<number>();
      const errorHandler = vi.fn();
      flow.subscribe({error: errorHandler});
      const err = new Error('test error');
      flow.error(err);
      expect(errorHandler).toHaveBeenCalledWith(err);
    });

    it('should mark flow as closed after error', () => {
      const flow = new Flow<number>();
      expect(flow.closed).toBe(false);
      flow.error(new Error('test'));
      expect(flow.closed).toBe(true);
    });

    it('should not emit after error', () => {
      const flow = new Flow<number>();
      const handler = vi.fn();
      flow.subscribe(handler);
      flow.error(new Error('test'));
      flow.next(1);
      expect(handler).not.toHaveBeenCalled();
    });

    it('should ignore subsequent errors after closed', () => {
      const flow = new Flow<number>();
      const errorHandler = vi.fn();
      flow.subscribe({error: errorHandler});
      flow.error(new Error('first'));
      flow.error(new Error('second'));
      expect(errorHandler).toHaveBeenCalledTimes(1);
    });

    it('should call error handler immediately when subscribing to errored flow', () => {
      const flow = new Flow<number>();
      const err = new Error('test');
      flow.error(err);
      const errorHandler = vi.fn();
      const sub = flow.subscribe({error: errorHandler});
      expect(errorHandler).toHaveBeenCalledWith(err);
      expect(sub.unsubscribe).toBeInstanceOf(Function);
    });
  });

  // ============================================
  // Complete Handling
  // ============================================
  describe('Complete handling', () => {
    it('should broadcast complete to subscribers', () => {
      const flow = new Flow<number>();
      const completeHandler = vi.fn();
      flow.subscribe({complete: completeHandler});
      flow.complete();
      expect(completeHandler).toHaveBeenCalledTimes(1);
    });

    it('should mark flow as closed after complete', () => {
      const flow = new Flow<number>();
      expect(flow.closed).toBe(false);
      flow.complete();
      expect(flow.closed).toBe(true);
    });

    it('should not emit after complete', () => {
      const flow = new Flow<number>();
      const handler = vi.fn();
      flow.subscribe(handler);
      flow.complete();
      flow.next(1);
      expect(handler).not.toHaveBeenCalled();
    });

    it('should ignore subsequent completes after closed', () => {
      const flow = new Flow<number>();
      const completeHandler = vi.fn();
      flow.subscribe({complete: completeHandler});
      flow.complete();
      flow.complete();
      expect(completeHandler).toHaveBeenCalledTimes(1);
    });

    it('should call complete handler immediately when subscribing to completed flow', () => {
      const flow = new Flow<number>();
      flow.complete();
      const completeHandler = vi.fn();
      const sub = flow.subscribe({complete: completeHandler});
      expect(completeHandler).toHaveBeenCalledTimes(1);
      expect(sub.unsubscribe).toBeInstanceOf(Function);
    });
  });

  // ============================================
  // Teardown
  // ============================================
  describe('addTeardown', () => {
    it('should call teardown on error, complete, and when added to closed flow', () => {
      // error
      const flow1 = new Flow<number>();
      const teardown1 = vi.fn();
      flow1.addTeardown(teardown1);
      flow1.error(new Error('test'));
      expect(teardown1).toHaveBeenCalledTimes(1);

      // complete
      const flow2 = new Flow<number>();
      const teardown2 = vi.fn();
      flow2.addTeardown(teardown2);
      flow2.complete();
      expect(teardown2).toHaveBeenCalledTimes(1);

      // closed flow
      const flow3 = new Flow<number>();
      flow3.complete();
      const teardown3 = vi.fn();
      flow3.addTeardown(teardown3);
      expect(teardown3).toHaveBeenCalledTimes(1);
    });

    it('should call multiple teardowns in order', () => {
      const flow = new Flow<number>();
      const order: number[] = [];
      flow.addTeardown(() => order.push(1));
      flow.addTeardown(() => order.push(2));
      flow.complete();
      expect(order).toEqual([1, 2]);
    });
  });

  // ============================================
  // consume
  // ============================================
  describe('consume()', () => {
    it('should resolve when controller returns non-FlowContinue value', async () => {
      const flow = new Flow<number>();
      const promise = flow.consume((value) => {
        if (value === 3) return FlowStop('done');
        return FlowContinue;
      });
      flow.next(1);
      flow.next(2);
      flow.next(3);
      expect(await promise).toBe('done');
    });

    it('should pass iteration number to controller', async () => {
      const flow = new Flow<number>();
      const iterations: number[] = [];
      const promise = flow.consume((value, iteration) => {
        iterations.push(iteration);
        if (value === 3) return FlowStop('done');
        return FlowContinue;
      });
      flow.next(1);
      flow.next(2);
      flow.next(3);
      await promise;
      expect(iterations).toEqual([0, 1, 2]);
    });

    it('should reject when flow errors and support on_error callback', async () => {
      const flow = new Flow<number>();
      const err = new Error('test error');

      // 无 on_error 时抛出错误
      const promise1 = flow.consume(() => FlowContinue);
      flow.error(err);
      await expect(promise1).rejects.toThrow(err);

      // 有 on_error 时返回 fallback
      const flow2 = new Flow<number>();
      const on_error = vi.fn().mockReturnValue('fallback');
      const promise2 = flow2.consume<string>(() => FlowContinue, {on_error});
      flow2.error(err);
      expect(await promise2).toBe('fallback');
      expect(on_error).toHaveBeenCalledWith(err);
    });

    it('should reject with FlowCompletionError when flow completes and support on_complete callback', async () => {
      // 无 on_complete 时抛出 FlowCompletionError
      const flow1 = new Flow<number>();
      const promise1 = flow1.consume(() => FlowContinue);
      flow1.complete();
      await expect(promise1).rejects.toThrow(FlowCompletionError);

      // 有 on_complete 时返回结果
      const flow2 = new Flow<number>();
      const on_complete = vi.fn().mockReturnValue('completed');
      const promise2 = flow2.consume<string>(() => FlowContinue, {on_complete});
      flow2.complete();
      expect(await promise2).toBe('completed');
      expect(on_complete).toHaveBeenCalledTimes(1);
    });

    it('should throw UseAfterFreeError when consuming closed flow', async () => {
      const flow = new Flow<number>();
      flow.complete();
      await expect(flow.consume(() => FlowContinue)).rejects.toThrow(
        UseAfterFreeError,
      );
    });

    it('should support async controller', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const flow = new Flow<number>();
        const promise = flow.consume(async (value, _i, signal) => {
          await delay(1, signal);
          if (value === 2) return FlowStop('async done');
          return FlowContinue;
        });
        flow.next(1);
        flow.next(2);
        await clock.tickAsync(5);
        expect(await promise).toBe('async done');
      });
    });

    it('should reject when controller throws', async () => {
      const flow = new Flow<number>();
      const err = new Error('controller error');
      const promise = flow.consume(() => {
        throw err;
      });
      flow.next(1);
      await expect(promise).rejects.toThrow(err);
    });

    it('should handle abort signal correctly', async () => {
      // 已中止的信号
      const flow1 = new Flow<number>();
      const controller1 = new AbortController();
      controller1.abort(new Error('aborted'));
      await expect(
        flow1.consume(() => FlowContinue, {signal: controller1.signal}),
      ).rejects.toThrow('aborted');

      // 消费过程中中止
      const flow2 = new Flow<number>();
      const controller2 = new AbortController();
      const promise2 = flow2.consume(() => FlowContinue, {
        signal: controller2.signal,
      });
      controller2.abort(new Error('aborted'));
      await expect(promise2).rejects.toThrow('aborted');

      // 传递信号给 controller
      const flow3 = new Flow<number>();
      const controller3 = new AbortController();
      const signals: AbortSignal[] = [];
      const promise3 = flow3.consume(
        (value, _iter, signal) => {
          if (signal) signals.push(signal);
          if (value === 2) return FlowStop('done');
          return FlowContinue;
        },
        {signal: controller3.signal},
      );
      flow3.next(1);
      flow3.next(2);
      await promise3;
      expect(signals).toHaveLength(2);
      expect(signals[0]).toBe(controller3.signal);
    });

    it('should clean up when controller returns result', async () => {
      const flow = new Flow<number>();
      const handler = vi.fn();
      flow.subscribe(handler);
      const promise = flow.consume((v) =>
        v === 1 ? FlowStop('done') : FlowContinue,
      );
      flow.next(1);
      await promise;
      flow.next(2);
      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('should support async on_error and on_complete callbacks', async () => {
      // async on_error
      const flow1 = new Flow<number>();
      const on_error = vi.fn().mockResolvedValue('async fallback');
      const promise1 = flow1.consume<string>(() => FlowContinue, {on_error});
      flow1.error(new Error('test'));
      expect(await promise1).toBe('async fallback');

      // async on_complete
      const flow2 = new Flow<number>();
      const on_complete = vi.fn().mockResolvedValue('async completed');
      const promise2 = flow2.consume<string>(() => FlowContinue, {on_complete});
      flow2.complete();
      expect(await promise2).toBe('async completed');
    });

    it('should handle multiple pending items with error, complete, and callbacks', async () => {
      // error
      const flow1 = new Flow<number>();
      const promise1a = flow1.consume(() => FlowContinue);
      const promise1b = flow1.consume(() => FlowContinue);
      const err = new Error('test');
      flow1.error(err);
      await expect(promise1a).rejects.toThrow(err);
      await expect(promise1b).rejects.toThrow(err);

      // complete without callback
      const flow2 = new Flow<number>();
      const promise2a = flow2.consume(() => FlowContinue);
      const promise2b = flow2.consume(() => FlowContinue);
      flow2.complete();
      await expect(promise2a).rejects.toThrow(FlowCompletionError);
      await expect(promise2b).rejects.toThrow(FlowCompletionError);

      // complete with callbacks
      const flow3 = new Flow<number>();
      const promise3a = flow3.consume(() => FlowContinue, {
        on_complete: () => 'completed1',
      });
      const promise3b = flow3.consume(() => FlowContinue, {
        on_complete: () => 'completed2',
      });
      flow3.complete();
      expect(await promise3a).toBe('completed1');
      expect(await promise3b).toBe('completed2');

      // error with callbacks
      const flow4 = new Flow<number>();
      const promise4a = flow4.consume(() => FlowContinue, {
        on_error: () => 'error1',
      });
      const promise4b = flow4.consume(() => FlowContinue, {
        on_error: () => 'error2',
      });
      flow4.error(new Error('test'));
      expect(await promise4a).toBe('error1');
      expect(await promise4b).toBe('error2');
    });
  });

  // ============================================
  // switchConsume
  // ============================================
  describe('switchConsume()', () => {
    it('should switch to latest value and resolve with it', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const flow = new Flow<number>();
        const started: number[] = [];
        const promise = flow.switchConsume(async (value, _iter, signal) => {
          started.push(value);
          try {
            await delay(50, signal);
          } catch {
            return FlowContinue;
          }
          return FlowStop(value);
        });
        flow.next(1);
        clock.tick(10);
        flow.next(2);
        clock.tick(10);
        flow.next(3);
        await clock.tickAsync(60);
        expect(await promise).toBe(3);
        expect(started).toEqual([1, 2, 3]);
      });
    });

    it('should throw UseAfterFreeError when consuming closed flow', async () => {
      const flow = new Flow<number>();
      flow.complete();
      await expect(flow.switchConsume(() => FlowContinue)).rejects.toThrow(
        UseAfterFreeError,
      );
    });

    it('should handle abort signal correctly', async () => {
      // 已中止的信号
      const flow1 = new Flow<number>();
      const controller1 = new AbortController();
      controller1.abort(new Error('aborted'));
      await expect(
        flow1.switchConsume(() => FlowContinue, {signal: controller1.signal}),
      ).rejects.toThrow('aborted');

      // 外部信号中止
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const flow = new Flow<number>();
        const controller = new AbortController();
        const promise = flow.switchConsume(
          async (_v, _i, signal) => {
            await delay(100, signal);
            return FlowContinue;
          },
          {signal: controller.signal},
        );
        flow.next(1);
        setTimeout(() => controller.abort(new Error('external abort')), 10);
        clock.tick(20);
        await expect(promise).rejects.toThrow('external abort');
      });
    });

    it('should support on_error and on_complete callbacks', async () => {
      // on_error
      const flow1 = new Flow<number>();
      const on_error = vi.fn().mockReturnValue('fallback');
      const promise1 = flow1.switchConsume<string>(() => FlowContinue, {
        on_error,
      });
      flow1.error(new Error('test'));
      expect(await promise1).toBe('fallback');
      expect(on_error).toHaveBeenCalledTimes(1);

      // on_complete
      const flow2 = new Flow<number>();
      const on_complete = vi.fn().mockReturnValue('completed');
      const promise2 = flow2.switchConsume<string>(() => FlowContinue, {
        on_complete,
      });
      flow2.complete();
      expect(await promise2).toBe('completed');
      expect(on_complete).toHaveBeenCalledTimes(1);
    });

    it('should reject when controller throws non-AbortError', async () => {
      const flow = new Flow<number>();
      const err = new Error('controller error');
      const promise = flow.switchConsume(() => {
        throw err;
      });
      flow.next(1);
      await expect(promise).rejects.toThrow(err);
    });

    it('should handle fast consecutive values', async () => {
      const flow = new Flow<number>();
      const results: number[] = [];
      const promise = flow.switchConsume(async (value, _iter, signal) => {
        try {
          await delay(10, signal);
          results.push(value);
          return FlowStop(value);
        } catch {
          return FlowContinue;
        }
      });
      flow.next(1);
      flow.next(2);
      flow.next(3);
      expect(await promise).toBe(3);
    });

    it('should support async on_error and on_complete callbacks', async () => {
      // async on_error
      const flow1 = new Flow<number>();
      const on_error = vi.fn().mockResolvedValue('async fallback');
      const promise1 = flow1.switchConsume<string>(() => FlowContinue, {
        on_error,
      });
      flow1.error(new Error('test'));
      expect(await promise1).toBe('async fallback');

      // async on_complete
      const flow2 = new Flow<number>();
      const on_complete = vi.fn().mockResolvedValue('async completed');
      const promise2 = flow2.switchConsume<string>(() => FlowContinue, {
        on_complete,
      });
      flow2.complete();
      expect(await promise2).toBe('async completed');
    });

    it('should continue after FlowContinue and handle settled state', async () => {
      const flow = new Flow<number>();
      const results: number[] = [];
      const promise = flow.switchConsume((v) => {
        results.push(v);
        if (v === 3) return v;
        return FlowContinue;
      });
      flow.next(1);
      flow.next(2);
      flow.next(3);
      expect(await promise).toBe(3);
      expect(results).toEqual([1, 2, 3]);
    });

    it('should handle FlowContinue without subsequent values', async () => {
      const flow = new Flow<number>();
      const results: number[] = [];
      const promise = flow.switchConsume(async (v) => {
        results.push(v);
        await sleep(1);
        if (v === 1) return FlowContinue;
        return v;
      });
      flow.next(1);
      await sleep(5);
      flow.next(2);
      expect(await promise).toBe(2);
      expect(results).toEqual([1, 2]);
    });
  });

  // ============================================
  // AsyncIterator
  // ============================================
  describe('Symbol.asyncIterator', () => {
    it('should iterate over emitted values', async () => {
      const flow = new Flow<number>();
      const values: number[] = [];
      const iterPromise = (async () => {
        for await (const value of flow) {
          values.push(value);
          if (value === 3) break;
        }
      })();
      flow.next(1);
      flow.next(2);
      flow.next(3);
      await iterPromise;
      expect(values).toEqual([1, 2, 3]);
    });

    it('should handle error during iteration', async () => {
      const flow = new Flow<number>();
      const err = new Error('iteration error');
      const iterPromise = (async () => {
        for await (const _ of flow) {
          /* empty */
        }
      })();
      flow.next(1);
      flow.error(err);
      await expect(iterPromise).rejects.toThrow(err);
    });

    it('should handle complete during iteration', async () => {
      const flow = new Flow<number>();
      const values: number[] = [];
      const iterPromise = (async () => {
        for await (const value of flow) {
          values.push(value);
        }
      })();
      flow.next(1);
      flow.next(2);
      flow.complete();
      await iterPromise;
      expect(values).toEqual([1, 2]);
    });

    it('should handle early return', async () => {
      const flow = new Flow<number>();
      const handler = vi.fn();
      flow.subscribe(handler);
      const iter = flow[Symbol.asyncIterator]();
      flow.next(1);
      await iter.next();
      await iter.return?.();
      flow.next(2);
      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('should buffer values during iteration', async () => {
      const flow = new Flow<number>();
      const values: number[] = [];
      const iterPromise = (async () => {
        for await (const value of flow) {
          values.push(value);
          if (value === 2) break;
        }
      })();
      flow.next(1);
      flow.next(2);
      await iterPromise;
      expect(values).toEqual([1, 2]);
    });

    it('should handle pending values and error/complete with pending resolve', async () => {
      // pending values
      const flow1 = new Flow<number>();
      const iter1 = flow1[Symbol.asyncIterator]();
      flow1.next(1);
      flow1.next(2);
      expect(await iter1.next()).toEqual({value: 1, done: false});
      expect(await iter1.next()).toEqual({value: 2, done: false});

      // error with pending resolve
      const flow2 = new Flow<number>();
      const iter2 = flow2[Symbol.asyncIterator]();
      const nextPromise = iter2.next();
      flow2.error(new Error('test'));
      expect((await nextPromise).done).toBe(true);
      await expect(iter2.next()).rejects.toThrow('test');

      // complete with pending resolve
      const flow3 = new Flow<number>();
      const iter3 = flow3[Symbol.asyncIterator]();
      const nextPromise3 = iter3.next();
      flow3.complete();
      expect(await nextPromise3).toEqual({value: undefined, done: true});
    });
  });

  // ============================================
  // SerialFlow
  // ============================================
  describe('SerialFlow', () => {
    it('should throw on switchConsume', () => {
      const flow = new SerialFlow<number>();
      expect(() => flow.switchConsume()).toThrow(
        'SerialFlow does not support switchConsume. Use consume() instead.',
      );
    });

    it('should throw UseAfterFreeError when consuming closed flow', async () => {
      const flow = new SerialFlow<number>();
      flow.complete();
      await expect(flow.consume(() => FlowContinue)).rejects.toThrow(
        UseAfterFreeError,
      );
    });

    it('should handle abort signal correctly', async () => {
      // 已中止的信号
      const flow1 = new SerialFlow<number>();
      const controller1 = new AbortController();
      controller1.abort(new Error('aborted'));
      await expect(
        flow1.consume(() => FlowContinue, {signal: controller1.signal}),
      ).rejects.toThrow('aborted');

      // 消费过程中中止
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const flow = new SerialFlow<number>();
        const controller = new AbortController();
        const promise = flow.consume(
          async (_v, _i, signal) => {
            await delay(100, signal);
            return FlowContinue;
          },
          {signal: controller.signal},
        );
        flow.next(1);
        setTimeout(() => controller.abort(new Error('aborted')), 10);
        clock.tick(20);
        await expect(promise).rejects.toThrow('aborted');
      });
    });

    it('should handle error during consume', async () => {
      const flow = new SerialFlow<number>();
      const err = new Error('consume error');
      const promise = flow.consume(() => {
        throw err;
      });
      flow.next(1);
      await expect(promise).rejects.toThrow(err);
    });

    it('should support on_error and on_complete callbacks', async () => {
      // on_error
      const flow1 = new SerialFlow<number>();
      const on_error = vi.fn().mockReturnValue('fallback');
      const promise1 = flow1.consume<string>(() => FlowContinue, {on_error});
      flow1.error(new Error('test'));
      expect(await promise1).toBe('fallback');
      expect(on_error).toHaveBeenCalledTimes(1);

      // on_complete
      const flow2 = new SerialFlow<number>();
      const on_complete = vi.fn().mockReturnValue('completed');
      const promise2 = flow2.consume<string>(() => FlowContinue, {on_complete});
      flow2.complete();
      expect(await promise2).toBe('completed');
      expect(on_complete).toHaveBeenCalledTimes(1);
    });

    it('should queue values while consuming', async () => {
      const flow = new SerialFlow<number>();
      const processed: number[] = [];
      const promise = flow.consume((value) => {
        processed.push(value);
        if (value === 3) return FlowStop('done');
        return FlowContinue;
      });
      flow.next(1);
      flow.next(2);
      flow.next(3);
      expect(await promise).toBe('done');
      expect(processed).toEqual([1, 2, 3]);
    });

    it('should support async on_error and on_complete callbacks', async () => {
      // async on_error
      const flow1 = new SerialFlow<number>();
      const on_error = vi.fn().mockResolvedValue('async fallback');
      const promise1 = flow1.consume<string>(() => FlowContinue, {on_error});
      flow1.error(new Error('test'));
      expect(await promise1).toBe('async fallback');

      // async on_complete
      const flow2 = new SerialFlow<number>();
      const on_complete = vi.fn().mockResolvedValue('async completed');
      const promise2 = flow2.consume<string>(() => FlowContinue, {on_complete});
      flow2.complete();
      expect(await promise2).toBe('async completed');
    });

    it('should handle queue compaction during consume', async () => {
      const flow = new SerialFlow<number>();
      const processed: number[] = [];
      const promise = flow.consume((value) => {
        processed.push(value);
        if (value === 70) return FlowStop('done');
        return FlowContinue;
      });
      for (let i = 0; i <= 70; i++) {
        flow.next(i);
      }
      await promise;
      expect(processed.length).toBe(71);
    });

    it('should compact queue after error', async () => {
      const flow = new SerialFlow<number>();
      const processed: number[] = [];
      const promise = flow.consume((value) => {
        processed.push(value);
        if (value === 3) throw new Error('test error');
        return FlowContinue;
      });
      for (let i = 0; i <= 10; i++) {
        flow.next(i);
      }
      await expect(promise).rejects.toThrow('test error');
      expect(processed.length).toBe(4);
    });

    it('should handle signal abort during processing', async () => {
      const flow = new SerialFlow<number>();
      const controller = new AbortController();
      const processed: number[] = [];
      const promise = flow.consume(
        (value) => {
          processed.push(value);
          return FlowContinue;
        },
        {signal: controller.signal},
      );
      for (let i = 0; i < 5; i++) {
        flow.next(i);
      }
      controller.abort(new Error('aborted'));
      await expect(promise).rejects.toThrow('aborted');
    });

    it('should compact queue in consume cleanup', async () => {
      const flow = new SerialFlow<number>();
      const results: number[] = [];
      const promise = flow.consume((v) => {
        results.push(v);
        if (v === 69) return v;
        return FlowContinue;
      });
      for (let i = 0; i < 70; i++) {
        flow.next(i);
      }
      expect(await promise).toBe(69);
      expect(results.length).toBe(70);
    });

    it('should compact queue after loop ends', async () => {
      const flow = new SerialFlow<number>();
      const promise = flow.consume(async (v) => {
        if (v < 10) {
          await sleep(1);
        }
        return FlowContinue;
      });
      for (let i = 0; i < 70; i++) {
        flow.next(i);
      }
      await sleep(5);
      flow.complete();
      await expect(promise).rejects.toThrow(FlowCompletionError);
    });

    it('should handle consume cleanup with compaction on abort', async () => {
      const flow = new SerialFlow<number>();
      const abort_controller = new AbortController();
      const promise = flow.consume(
        async () => {
          await sleep(1);
          return FlowContinue;
        },
        {signal: abort_controller.signal},
      );
      for (let i = 0; i < 70; i++) {
        flow.next(i);
      }
      await sleep(5);
      abort_controller.abort();
      await expect(promise).rejects.toThrow();
    });
  });

  // ============================================
  // BehaviorFlow
  // ============================================
  describe('BehaviorFlow', () => {
    it('should emit initial value on subscribe', () => {
      const flow = new BehaviorFlow<number>(42);
      const handler = vi.fn();
      flow.subscribe(handler);
      expect(handler).toHaveBeenCalledWith(42);
    });

    it('should update value on next', () => {
      const flow = new BehaviorFlow<number>(1);
      const handler = vi.fn();
      flow.subscribe(handler);
      flow.next(2);
      expect(handler).toHaveBeenCalledTimes(2);
      expect(handler).toHaveBeenNthCalledWith(1, 1);
      expect(handler).toHaveBeenNthCalledWith(2, 2);
    });

    it('should return current value via value getter', () => {
      const flow = new BehaviorFlow<number>(1);
      expect(flow.value).toBe(1);
      flow.next(2);
      expect(flow.value).toBe(2);
    });

    it('should call error/complete handler immediately when subscribing to errored/completed flow', () => {
      // error
      const flow1 = new BehaviorFlow<number>(1);
      const err = new Error('test');
      flow1.error(err);
      const errorHandler = vi.fn();
      flow1.subscribe({error: errorHandler});
      expect(errorHandler).toHaveBeenCalledWith(err);

      // complete
      const flow2 = new BehaviorFlow<number>(1);
      flow2.complete();
      const completeHandler = vi.fn();
      flow2.subscribe({complete: completeHandler});
      expect(completeHandler).toHaveBeenCalledTimes(1);
    });

    it('should not emit initial value after error or complete', () => {
      // error
      const flow1 = new BehaviorFlow<number>(1);
      flow1.error(new Error('test'));
      const handler1 = vi.fn();
      flow1.subscribe(handler1);
      expect(handler1).not.toHaveBeenCalled();

      // complete
      const flow2 = new BehaviorFlow<number>(1);
      flow2.complete();
      const handler2 = vi.fn();
      flow2.subscribe(handler2);
      expect(handler2).not.toHaveBeenCalled();
    });

    it('should handle unsubscribe via returned subscription', () => {
      const flow = new BehaviorFlow<number>(1);
      const handler = vi.fn();
      const sub = flow.subscribe(handler);
      expect(handler).toHaveBeenCalledTimes(1);
      sub.unsubscribe();
      flow.next(2);
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================
  // ColdFlow and SerialColdFlow
  // ============================================
  describe('ColdFlow and SerialColdFlow', () => {
    it('should execute producer on subscribe', () => {
      // ColdFlow
      let executed1 = false;
      const flow1 = new ColdFlow<number>((dest) => {
        executed1 = true;
        dest.next(1);
      });
      expect(executed1).toBe(false);
      flow1.subscribe(() => {});
      expect(executed1).toBe(true);

      // SerialColdFlow
      let executed2 = false;
      const flow2 = new SerialColdFlow<number>((dest) => {
        executed2 = true;
        dest.next(1);
      });
      expect(executed2).toBe(false);
      flow2.subscribe(() => {});
      expect(executed2).toBe(true);
    });

    it('should call teardown on complete and error', () => {
      // ColdFlow complete
      const teardown1 = vi.fn();
      const flow1 = new ColdFlow<number>((dest) => {
        dest.next(1);
        return teardown1;
      });
      flow1.subscribe({});
      flow1.complete();
      expect(teardown1).toHaveBeenCalledTimes(1);

      // ColdFlow error
      const teardown2 = vi.fn();
      const flow2 = new ColdFlow<number>((dest) => {
        dest.next(1);
        return teardown2;
      });
      flow2.subscribe({});
      flow2.error(new Error('test'));
      expect(teardown2).toHaveBeenCalledTimes(1);

      // SerialColdFlow complete
      const teardown3 = vi.fn();
      const flow3 = new SerialColdFlow<number>((dest) => {
        dest.next(1);
        return teardown3;
      });
      flow3.subscribe({});
      flow3.complete();
      expect(teardown3).toHaveBeenCalledTimes(1);
    });

    it('should error when producer throws', () => {
      // ColdFlow
      const err1 = new Error('producer error');
      const flow1 = new ColdFlow<number>(() => {
        throw err1;
      });
      const errorHandler1 = vi.fn();
      flow1.subscribe({error: errorHandler1});
      expect(errorHandler1).toHaveBeenCalledWith(err1);

      // SerialColdFlow
      const err2 = new Error('SerialColdFlow producer error');
      const flow2 = new SerialColdFlow<number>(() => {
        throw err2;
      });
      const errorHandler2 = vi.fn();
      const sub = flow2.subscribe({error: errorHandler2});
      expect(errorHandler2).toHaveBeenCalledWith(err2);
      expect(sub).toBeDefined();
    });

    it('should execute producer on each subscribe', () => {
      let executions = 0;
      const flow = new ColdFlow<number>((dest) => {
        executions++;
        dest.next(1);
      });
      flow.subscribe(() => {});
      flow.subscribe(() => {});
      expect(executions).toBe(2);
    });

    it('should handle closed flow subscribe', () => {
      // ColdFlow
      const flow1 = new ColdFlow<number>((dest) => {
        dest.next(1);
        dest.complete();
      });
      const handler1a = vi.fn();
      const handler1b = vi.fn();
      flow1.subscribe(handler1a);
      flow1.subscribe(handler1b);
      expect(handler1a).toHaveBeenCalledWith(1);
      expect(handler1b).not.toHaveBeenCalled();

      // SerialColdFlow
      const flow2 = new SerialColdFlow<number>((dest) => {
        dest.next(1);
      });
      flow2.complete();
      const handler2 = vi.fn();
      const sub = flow2.subscribe(handler2);
      expect(sub).toBeDefined();
      expect(handler2).not.toHaveBeenCalled();
    });

    it('should handle producer returning teardown', () => {
      // ColdFlow
      const teardown1 = vi.fn();
      const flow1 = new ColdFlow<number>((dest) => {
        dest.next(1);
        dest.next(2);
        return teardown1;
      });
      const handler1 = vi.fn();
      flow1.subscribe(handler1);
      expect(handler1).toHaveBeenCalledTimes(2);
      flow1.complete();
      expect(teardown1).toHaveBeenCalledTimes(1);

      // SerialColdFlow
      const teardown2 = vi.fn();
      const flow2 = new SerialColdFlow<number>((dest) => {
        dest.next(1);
        return teardown2;
      });
      const handler2 = vi.fn();
      flow2.subscribe(handler2);
      expect(handler2).toHaveBeenCalledWith(1);
      flow2.complete();
      expect(teardown2).toHaveBeenCalledTimes(1);
    });

    it('should handle producer error with teardown', () => {
      const teardown = vi.fn();
      const flow = new ColdFlow<number>((dest) => {
        dest.next(1);
        return teardown;
      });
      const errorHandler = vi.fn();
      flow.subscribe({error: errorHandler});
      flow.error(new Error('test'));
      expect(teardown).toHaveBeenCalledTimes(1);
      expect(errorHandler).toHaveBeenCalledTimes(1);
    });

    it('should handle producer throwing during subscribe', () => {
      const err = new Error('producer error during subscribe');
      const flow = new ColdFlow<number>(() => {
        throw err;
      });
      const errorHandler = vi.fn();
      const sub = flow.subscribe({error: errorHandler});
      expect(errorHandler).toHaveBeenCalledWith(err);
      expect(sub).toBeDefined();
    });

    it('should handle teardown that throws', () => {
      const flow = new ColdFlow<number>((dest) => {
        dest.next(1);
        return () => {
          throw new Error('teardown error');
        };
      });
      const handler = vi.fn();
      flow.subscribe(handler);
      expect(() => flow.complete()).toThrow('teardown error');
    });
  });

  // ============================================
  // Factory Functions
  // ============================================
  describe('Factory functions', () => {
    describe('fromProducer()', () => {
      it('should create ColdFlow from producer', () => {
        const flow = fromProducer((dest) => {
          dest.next(1);
          dest.next(2);
        });
        expect(flow).toBeInstanceOf(ColdFlow);
        const handler = vi.fn();
        flow.subscribe(handler);
        expect(handler).toHaveBeenCalledTimes(2);
      });
    });

    describe('fromSerialProducer()', () => {
      it('should create SerialColdFlow from producer', () => {
        const flow = fromSerialProducer((dest) => {
          dest.next(1);
          dest.next(2);
        });
        expect(flow).toBeInstanceOf(SerialColdFlow);
        const handler = vi.fn();
        flow.subscribe(handler);
        expect(handler).toHaveBeenCalledTimes(2);
      });
    });

    describe('of()', () => {
      it('should create flow from values', () => {
        const flow = of(1, 2, 3);
        const values: number[] = [];
        const completeHandler = vi.fn();
        flow.subscribe({
          next: (v) => values.push(v),
          complete: completeHandler,
        });
        expect(values).toEqual([1, 2, 3]);
        expect(completeHandler).toHaveBeenCalledTimes(1);
      });

      it('should create empty flow', () => {
        const flow = of();
        const handler = vi.fn();
        const completeHandler = vi.fn();
        flow.subscribe({
          next: handler,
          complete: completeHandler,
        });
        expect(handler).not.toHaveBeenCalled();
        expect(completeHandler).toHaveBeenCalledTimes(1);
      });

      it('should stop emitting when flow is closed', () => {
        const flow = of(1, 2, 3, 4, 5);
        const handler = vi.fn((v: number) => {
          if (v === 2) flow.complete();
        });
        flow.subscribe(handler);
        expect(handler).toHaveBeenCalledTimes(2);
      });
    });

    describe('from()', () => {
      it('should create flow from iterable', () => {
        const flow = from([1, 2, 3]);
        const values: number[] = [];
        const completeHandler = vi.fn();
        flow.subscribe({
          next: (v) => values.push(v),
          complete: completeHandler,
        });
        expect(values).toEqual([1, 2, 3]);
        expect(completeHandler).toHaveBeenCalledTimes(1);
      });

      it('should create flow from string (iterable)', () => {
        const flow = from('abc');
        const values: string[] = [];
        flow.subscribe({next: (v) => values.push(v)});
        expect(values).toEqual(['a', 'b', 'c']);
      });

      it('should create flow from ArrayLike', () => {
        const arrayLike: ArrayLike<number> = {
          length: 3,
          0: 1,
          1: 2,
          2: 3,
        };
        const flow = from(arrayLike);
        const values: number[] = [];
        flow.subscribe({next: (v) => values.push(v)});
        expect(values).toEqual([1, 2, 3]);
      });

      it('should stop emitting from ArrayLike when flow is closed', () => {
        const arrayLike = {0: 1, 1: 2, 2: 3, 3: 4, length: 4};
        const flow = from(arrayLike);
        const handler = vi.fn((v: number) => {
          if (v === 2) flow.complete();
        });
        flow.subscribe(handler);
        expect(handler).toHaveBeenCalledTimes(2);
      });

      it('should create flow from Promise', async () => {
        const flow = from(Promise.resolve(42));
        const values: number[] = [];
        const completeHandler = vi.fn();
        flow.subscribe({
          next: (v) => values.push(v),
          complete: completeHandler,
        });
        await Promise.resolve();
        expect(values).toEqual([42]);
        expect(completeHandler).toHaveBeenCalledTimes(1);
      });

      it('should handle rejected Promise', async () => {
        const flow = from(Promise.reject(new Error('promise error')));
        const errorHandler = vi.fn();
        flow.subscribe({error: errorHandler});
        await Promise.resolve().then(() => {});
        expect(errorHandler).toHaveBeenCalledTimes(1);
      });

      it('should create flow from generator', () => {
        function* gen() {
          yield 1;
          yield 2;
          yield 3;
        }
        const flow = from(gen());
        const values: number[] = [];
        const completeHandler = vi.fn();
        flow.subscribe({
          next: (v) => values.push(v),
          complete: completeHandler,
        });
        expect(values).toEqual([1, 2, 3]);
        expect(completeHandler).toHaveBeenCalledTimes(1);
      });

      it('should handle generator error', () => {
        function* gen() {
          yield 1;
          throw new Error('iterable error');
        }
        const flow = from(gen());
        const handler = vi.fn();
        const errorHandler = vi.fn();
        flow.subscribe({next: handler, error: errorHandler});
        expect(handler).toHaveBeenCalledTimes(1);
        expect(errorHandler).toHaveBeenCalledTimes(1);
      });

      it('should complete after async iterable finishes', async () => {
        const clock = MockClock();
        await withTimelineAsync(clock, async () => {
          async function* asyncGen() {
            yield 1;
            await sleep(0);
            yield 2;
          }
          const flow = from(asyncGen());
          const values: number[] = [];
          const completeHandler = vi.fn();
          flow.subscribe({
            next: (v) => values.push(v),
            complete: completeHandler,
          });
          await clock.tickAsync(5);
          expect(values).toEqual([1, 2]);
          expect(completeHandler).toHaveBeenCalledTimes(1);
        });
      });

      it('should throw TypeError for invalid source', () => {
        expect(() => from({} as never)).toThrow(TypeError);
      });

      it('should stop emitting when flow is closed during iteration', () => {
        let callCount = 0;
        const flow = from({
          [Symbol.iterator]: function* () {
            for (let i = 0; i < 10; i++) {
              callCount++;
              yield i;
            }
          },
        });
        const values: number[] = [];
        flow.subscribe({
          next: (v) => {
            values.push(v);
            if (v === 2) flow.complete();
          },
        });
        expect(values.length).toBe(3);
        expect(callCount).toBeLessThanOrEqual(4);
      });

      it('should not emit Promise value/error when flow is closed', async () => {
        const clock = MockClock();
        await withTimelineAsync(clock, async () => {
          // value
          const flow1 = from(Promise.resolve(42));
          const handler1 = vi.fn();
          flow1.subscribe(handler1);
          flow1.complete();
          await clock.tickAsync(5);
          expect(handler1).not.toHaveBeenCalled();

          // error
          const flow2 = from(Promise.reject(new Error('test error')));
          const errorHandler = vi.fn();
          flow2.subscribe({error: errorHandler});
          flow2.complete();
          await clock.tickAsync(5);
          expect(errorHandler).not.toHaveBeenCalled();
        });
      });

      it('should handle async iterable cancellation and error', async () => {
        const clock = MockClock();
        await withTimelineAsync(clock, async () => {
          // cancellation
          async function* asyncGen1() {
            yield 1;
            await sleep(5);
            yield 2;
          }
          const flow1 = from(asyncGen1());
          const handler1 = vi.fn();
          const sub1 = flow1.subscribe(handler1);
          await clock.tickAsync(1);
          sub1.unsubscribe();
          await clock.tickAsync(5);
          expect(handler1.mock.calls.length).toBeLessThanOrEqual(2);

          // error after cancellation
          async function* asyncGen2() {
            yield 1;
            await sleep(1);
            throw new Error('async error');
          }
          const flow2 = from(asyncGen2());
          const errorHandler = vi.fn();
          const sub2 = flow2.subscribe({error: errorHandler});
          await clock.tickAsync(1);
          sub2.unsubscribe();
          await clock.tickAsync(2);
        });
      });

      it('should not propagate async iterable error after flow closed', async () => {
        const clock = MockClock();
        await withTimelineAsync(clock, async () => {
          async function* asyncGen() {
            yield 1;
            await sleep(1);
            throw new Error('async error');
          }
          const flow = from(asyncGen());
          const errorHandler = vi.fn();
          flow.subscribe({error: errorHandler});
          flow.complete();
          await clock.tickAsync(5);
          expect(errorHandler).not.toHaveBeenCalled();
        });
      });

      it('should call complete/error when async iterable finishes normally or throws', async () => {
        const clock = MockClock();
        await withTimelineAsync(clock, async () => {
          // complete
          async function* asyncGen1() {
            yield 1;
            await sleep(1);
            yield 2;
          }
          const flow1 = from(asyncGen1());
          const completeHandler = vi.fn();
          flow1.subscribe({complete: completeHandler});
          await clock.tickAsync(5);
          expect(completeHandler).toHaveBeenCalledTimes(1);

          // error
          async function* asyncGen2() {
            yield 1;
            await sleep(1);
            throw new Error('async error');
          }
          const flow2 = from(asyncGen2());
          const errorHandler = vi.fn();
          flow2.subscribe({error: errorHandler});
          await clock.tickAsync(5);
          expect(errorHandler).toHaveBeenCalledTimes(1);
        });
      });

      it('should handle async iterable with cancelled flag', async () => {
        const clock = MockClock();
        await withTimelineAsync(clock, async () => {
          let iterations = 0;
          async function* asyncGen() {
            while (iterations < 5) {
              iterations++;
              yield iterations;
              await sleep(1);
            }
          }
          const flow = from(asyncGen());
          const handler = vi.fn();
          const sub = flow.subscribe(handler);
          await clock.tickAsync(2);
          sub.unsubscribe();
          await clock.tickAsync(10);
          expect(handler.mock.calls.length).toBeLessThan(5);
        });
      });
    });
  });

  // ============================================
  // Edge Cases and Coverage
  // ============================================
  describe('Edge cases and coverage', () => {
    it('should handle consume with multiple values', async () => {
      const flow = new Flow<number>();
      const promise = flow.consume((v) =>
        v === 5 ? FlowStop(`done-${v}`) : FlowContinue,
      );
      for (let i = 0; i <= 5; i++) {
        flow.next(i);
      }
      expect(await promise).toBe('done-5');
    });

    it('should handle switchConsume with multiple values', async () => {
      const flow = new Flow<number>();
      const promise = flow.switchConsume((v) =>
        v === 5 ? FlowStop(`done-${v}`) : FlowContinue,
      );
      for (let i = 0; i <= 5; i++) {
        flow.next(i);
      }
      expect(await promise).toBe('done-5');
    });

    it('should handle SerialFlow with multiple values', async () => {
      const flow = new SerialFlow<number>();
      const processed: number[] = [];
      const promise = flow.consume((value) => {
        processed.push(value);
        if (value === 10) return FlowStop('done');
        return FlowContinue;
      });
      for (let i = 0; i <= 10; i++) {
        flow.next(i);
      }
      await promise;
      expect(processed.length).toBe(11);
    });

    it('should handle settled flag in switchConsume', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const flow = new Flow<number>();
        const promise = flow.switchConsume(async (value, _iter, signal) => {
          await delay(10, signal);
          return FlowStop(value);
        });
        flow.next(1);
        clock.tick(5);
        flow.next(2);
        clock.tick(20);
        expect(await promise).toBe(2);
      });
    });

    it('should handle signal abort during async controller', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const flow = new Flow<number>();
        const controller = new AbortController();
        const promise = flow.consume(
          async (_v, _i, signal) => {
            await delay(100, signal);
            return FlowContinue;
          },
          {signal: controller.signal},
        );
        flow.next(1);
        setTimeout(() => controller.abort(new Error('timeout')), 10);
        clock.tick(20);
        await expect(promise).rejects.toThrow('timeout');
      });
    });

    it('should handle switchConsume with external signal abort during async operation', async () => {
      const flow = new Flow<number>();
      const controller = new AbortController();
      const promise = flow.switchConsume(
        async (_v, _i, signal) => {
          await delay(10, signal);
          return FlowContinue;
        },
        {signal: controller.signal},
      );
      flow.next(1);
      controller.abort(new Error('external abort'));
      await expect(promise).rejects.toThrow('external abort');
    });

    it('should handle switchConsume with fast values and cancellation', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const flow = new Flow<number>();
        const results: number[] = [];
        const promise = flow.switchConsume(async (value, _iter, signal) => {
          try {
            await delay(1, signal);
            results.push(value);
            return FlowStop(value);
          } catch {
            return FlowContinue;
          }
        });
        flow.next(1);
        flow.next(2);
        flow.next(3);
        clock.tick(5);
        expect(await promise).toBe(3);
      });
    });

    it('should trigger queue compaction with many pending items', async () => {
      // consume
      const flow1 = new Flow<number>();
      const promises1: Promise<number>[] = [];
      for (let i = 0; i < 70; i++) {
        promises1.push(flow1.consume((v) => v));
      }
      for (let i = 0; i < 70; i++) {
        flow1.next(i);
      }
      expect((await Promise.all(promises1)).length).toBe(70);

      // switchConsume
      const flow2 = new Flow<number>();
      const promises2: Promise<number>[] = [];
      for (let i = 0; i < 70; i++) {
        promises2.push(flow2.switchConsume((v) => v));
      }
      for (let i = 0; i < 70; i++) {
        flow2.next(i);
      }
      expect((await Promise.all(promises2)).length).toBe(70);
    });

    it('should trigger compactNullableArray through abort with many pending', async () => {
      const flow = new Flow<number>();
      const controller = new AbortController();
      const promises: Promise<number>[] = [];
      for (let i = 0; i < 70; i++) {
        promises.push(
          flow.consume(() => new Promise(() => {}), {
            signal: controller.signal,
          }),
        );
      }
      for (let i = 0; i < 70; i++) {
        flow.next(i);
      }
      controller.abort(new Error('aborted'));
      const results = await Promise.allSettled(promises);
      const rejected = results.filter((r) => r.status === 'rejected');
      expect(rejected.length).toBeGreaterThan(0);
    });

    it('should trigger compactArray on SerialFlow error with large queue', async () => {
      const flow = new SerialFlow<number>();
      const processed: number[] = [];
      const promise = flow.consume((value) => {
        processed.push(value);
        if (value === 70) throw new Error('test error');
        return FlowContinue;
      });
      for (let i = 0; i <= 80; i++) {
        flow.next(i);
      }
      await expect(promise).rejects.toThrow('test error');
      expect(processed.length).toBe(71);
    });

    it('should return early in consume/switchConsume when already settled', async () => {
      // consume
      const flow1 = new Flow<number>();
      let callCount1 = 0;
      const promise1 = flow1.consume((v) => {
        callCount1++;
        return v;
      });
      flow1.next(1);
      await promise1;
      flow1.next(2);
      expect(callCount1).toBe(1);

      // switchConsume
      const flow2 = new Flow<number>();
      let callCount2 = 0;
      const promise2 = flow2.switchConsume((v) => {
        callCount2++;
        return v;
      });
      flow2.next(1);
      await promise2;
      flow2.next(2);
      expect(callCount2).toBe(1);
    });
  });
});
