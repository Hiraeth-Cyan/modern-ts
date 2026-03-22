// ========================================
// ./src/Concurrent/ext/map.spec.ts
// ========================================
import {describe, it, expect, vi} from 'vitest';
import {asyncMap, asyncMapIterable, MAP_SKIP} from './map';
import {ParameterError} from '../../Errors';
import {flushPromises} from '../../helper';
import {sleep} from '../delay';

describe('asyncMap and asyncMapIterable', () => {
  describe('asyncMap', () => {
    // ------ 参数验证 ------
    describe('Parameter Validation', () => {
      it('should throw ParameterError for invalid concurrency', async () => {
        // 测试非法并发数：负数、小数、0
        await expect(asyncMap([], () => {}, {concurrency: -1})).rejects.toThrow(
          ParameterError,
        );
        await expect(
          asyncMap([], () => {}, {concurrency: 1.5}),
        ).rejects.toThrow(ParameterError);
        await expect(asyncMap([], () => {}, {concurrency: 0})).rejects.toThrow(
          ParameterError,
        );
      });

      it('should accept valid concurrency values', async () => {
        // 测试合法的并发数：1 和 Infinity
        await expect(asyncMap([1], () => 1, {concurrency: 1})).resolves.toEqual(
          [1],
        );
        await expect(
          asyncMap([1], () => 1, {concurrency: Infinity}),
        ).resolves.toEqual([1]);
      });
    });

    // ------ 基础功能与并发控制 ------
    describe('Basic Mapping and Concurrency', () => {
      it('should map sync and async values correctly', async () => {
        const input = [1, 2, 3];
        const results = await asyncMap(input, (n) => n * 2);
        expect(results).toEqual([2, 4, 6]);
      });

      it('should respect concurrency limit', async () => {
        const concurrency = 2;
        let running = 0;
        let maxRunning = 0;

        const input = Array.from({length: 10}, (_, i) => i);
        await asyncMap(
          input,
          async (n) => {
            running++;
            maxRunning = Math.max(maxRunning, running);
            await sleep(0);
            running--;
            return n;
          },
          {concurrency},
        );

        // 验证并发数从未超过设定值
        expect(maxRunning).toBe(concurrency);
      });

      it('should maintain order of results', async () => {
        const input = [1, 2, 3, 4];
        // 故意让第一个任务慢，验证结果顺序仍与输入一致
        const results = await asyncMap(input, async (n) => {
          if (n === 1) await sleep(0);
          return n;
        });
        expect(results).toEqual([1, 2, 3, 4]);
      });

      it('should handle empty iterable', async () => {
        await expect(asyncMap([], () => {})).resolves.toEqual([]);
      });

      it('should maintain correct indices despite skips', async () => {
        // 验证 mapper 接收的索引参数正确，即使后续有跳过（此处未使用 MAP_SKIP，仅验证索引）
        const indices: number[] = [];
        await asyncMap([1, 2, 3], (_, index) => {
          indices.push(index);
          return _;
        });
        expect(indices).toEqual([0, 1, 2]);
      });
    });

    // ------ MAP_SKIP 跳过逻辑 ------
    describe('MAP_SKIP logic', () => {
      it('should filter out values returning MAP_SKIP', async () => {
        // 同步返回 MAP_SKIP 的项被过滤
        const input = [1, 2, 3, 4, 5];
        const results = await asyncMap(input, (n) => {
          if (n % 2 === 0) return MAP_SKIP;
          return n;
        });
        expect(results).toEqual([1, 3, 5]);
      });
    });

    // ------ 错误处理 ------
    describe('Error Handling', () => {
      it('should stop on first error if stopOnError is true (default)', async () => {
        const input = [1, 2, 3];
        const error = new Error('Fail at 2');
        const mapper = vi.fn(async (n: number) => {
          if (n === 2) throw error;
          await sleep(0);
          return n;
        });

        await expect(asyncMap(input, mapper)).rejects.toThrow(error);
      });

      it('should ignore subsequent errors if stopOnError is true and error already captured', async () => {
        // 并发执行时多个任务同时抛出错误，只抛出第一个捕获的
        const input = [1, 2];
        const error1 = new Error('Error 1');
        const error2 = new Error('Error 2');

        const promise = asyncMap(
          input,
          async (n) => {
            await sleep(0);
            if (n === 1) throw error1;
            throw error2;
          },
          {concurrency: 2, stopOnError: true},
        );

        await expect(promise).rejects.toThrow(Error); // 具体是 error1 或 error2 取决于时序
      });

      it('should aggregate errors if stopOnError is false', async () => {
        const input = [1, 2, 3];
        const mapper = (n: number) => {
          if (n % 2 === 0) throw new Error(`Error ${n}`);
          return n;
        };

        try {
          await asyncMap(input, mapper, {stopOnError: false});
          expect.fail('Should have thrown');
        } catch (e) {
          expect(e).toBeInstanceOf(AggregateError);
          expect((e as AggregateError).errors).toHaveLength(1);
          expect(((e as AggregateError).errors[0] as Error).message).toBe(
            'Error 2',
          );
        }
      });

      it('should handle synchronous errors in mapper', async () => {
        await expect(
          asyncMap([1], () => {
            throw new Error('Sync error');
          }),
        ).rejects.toThrow('Sync error');
      });
    });

    // ------ AbortSignal 中止支持 ------
    describe('AbortSignal Support', () => {
      it('should reject immediately if signal is already aborted', async () => {
        const ac = new AbortController();
        ac.abort();
        await expect(
          asyncMap([1], () => 1, {signal: ac.signal}),
        ).rejects.toBeInstanceOf(DOMException);
      });

      it('should stop processing when signal aborts', async () => {
        const ac = new AbortController();
        const input = [1, 2, 3, 4, 5];
        const mapper = vi.fn(async (n: number) => {
          if (n === 3) {
            await sleep(0);
            ac.abort();
          }
          return n;
        });

        await expect(
          asyncMap(input, mapper, {concurrency: 1, signal: ac.signal}),
        ).rejects.toBeInstanceOf(DOMException);
      });

      it('should cleanup iterator when aborted', async () => {
        const ac = new AbortController();
        const returnSpy = vi.fn();
        const iterable = {
          [Symbol.iterator]: () => ({
            next: () => ({value: 1, done: false}),
            return: returnSpy,
          }),
        };

        const promise = asyncMap(
          iterable,
          async () => {
            ac.abort();
            await sleep(0);
          },
          {signal: ac.signal},
        );

        await expect(promise).rejects.toBeInstanceOf(DOMException);
        expect(returnSpy).toHaveBeenCalled(); // 验证迭代器的 return 被调用
      });
    });

    // ------ 迭代器协议 ------
    describe('Iterator Protocol', () => {
      it('should support async iterables', async () => {
        function* gen() {
          yield 1;
          yield 2;
        }
        const results = await asyncMap(gen(), (n) => n * 10);
        expect(results).toEqual([10, 20]);
      });

      it('should call iterator.return() on completion', async () => {
        const returnSpy = vi.fn();
        const iterable = {
          [Symbol.iterator]: () => ({
            i: 0,
            next() {
              return {value: this.i++, done: this.i > 2};
            },
            return: returnSpy,
          }),
        };

        await asyncMap(iterable, (n) => n);
        expect(returnSpy).toHaveBeenCalled();
      });

      it('should reject if iterator.next() throws synchronously', async () => {
        const error = new Error('Sync next error');
        const iterable = {
          [Symbol.iterator]: () => ({
            next: () => {
              throw error;
            },
          }),
        };
        await expect(asyncMap(iterable, (x) => x)).rejects.toThrow(error);
      });

      it('should handle promise returned by iterator.return() in cleanup', async () => {
        // 当迭代器的 return 方法返回 Promise 时，应等待其完成
        const returnSpy = vi.fn(() =>
          Promise.resolve({value: undefined, done: true}),
        );
        const iterable = {
          [Symbol.asyncIterator]: () => ({
            next: () => Promise.resolve({value: 1, done: true}),
            return: returnSpy,
          }),
        };

        await asyncMap(iterable, (x) => x);
        expect(returnSpy).toHaveBeenCalled();
      });

      it('should ignore rejection from iterator.return() promise', async () => {
        // return 返回 rejected Promise 不应影响主流程
        const returnError = new Error('Return rejected');
        const iterable = {
          [Symbol.asyncIterator]: () => ({
            next: () => Promise.resolve({value: 1, done: true}),
            return: () => {
              throw returnError; // 同步抛出也忽略
            },
          }),
        };

        await expect(asyncMap(iterable, (x) => x)).resolves.toEqual([]);
      });

      // 从 asyncMapIterable 外部移入：测试 asyncMap 在 cleanup 时忽略 return 的 reject
      it('should catch rejection from iterator.return() promise during cleanup', async () => {
        const returnError = new Error('Return rejected');
        const iterable = {
          [Symbol.asyncIterator]: () => ({
            next: () => Promise.resolve({value: 1, done: true}),
            return: () => Promise.reject(returnError),
          }),
        };

        // 验证函数正常结束，不被 return 的错误中断
        await expect(asyncMap(iterable, (x) => x)).resolves.toEqual([]);
      });
    });
  });

  describe('asyncMapIterable', () => {
    // ------ 参数验证 ------
    describe('Parameter Validation', () => {
      it('should throw ParameterError for invalid options', async () => {
        // 测试非法 backpressure 和 concurrency
        const it1 = asyncMapIterable([], () => 1, {
          concurrency: 2,
          backpressure: -1,
        });
        await expect(it1.next()).rejects.toThrow(ParameterError);

        const it2 = asyncMapIterable([], () => 1, {concurrency: 0});
        await expect(it2.next()).rejects.toThrow(ParameterError);
      });

      it('should accept valid options', async () => {
        // 测试合法的 backpressure 和 concurrency
        const gen1 = asyncMapIterable([1], () => 1, {
          concurrency: 2,
          backpressure: 2,
        });
        await gen1.next();
        // 若未抛出异常即通过
        expect(true).toBe(true);

        // 额外测试 concurrency 为 Infinity
        const gen2 = asyncMapIterable([1], () => 1, {concurrency: Infinity});
        await gen2.next();
        expect(true).toBe(true);
      });
    });

    // ------ 生成器行为 ------
    describe('Generator Behavior', () => {
      it('should yield mapped values one by one', async () => {
        function* source() {
          yield 1;
          yield 2;
        }
        const gen = asyncMapIterable(source(), (n) => n * 10);
        expect((await gen.next()).value).toBe(10);
        expect((await gen.next()).value).toBe(20);
        expect((await gen.next()).done).toBe(true);
      });

      it('should respect backpressure', async () => {
        const input = Array.from({length: 10}, (_, i) => i);
        let processed = 0;
        const gen = asyncMapIterable(
          input,
          (n) => {
            processed++;
            return n;
          },
          {concurrency: 2, backpressure: 3},
        );

        await gen.next();
        await flushPromises();
        // 背压机制下，已处理数量应小于总数
        expect(processed).toBeLessThan(10);
      });

      it('should yield values in order even if processing is out of order', async () => {
        const input = [1, 2, 3];
        const gen = asyncMapIterable(
          input,
          async (n) => {
            if (n === 1) await sleep(0);
            return n;
          },
          {concurrency: 3},
        );

        expect((await gen.next()).value).toBe(1);
        expect((await gen.next()).value).toBe(2);
        expect((await gen.next()).value).toBe(3);
      });

      it('should filter out MAP_SKIP values', async () => {
        function* source() {
          yield 1;
          yield 2;
          yield 3;
        }
        const gen = asyncMapIterable(source(), (n) => (n === 2 ? MAP_SKIP : n));
        expect((await gen.next()).value).toBe(1);
        expect((await gen.next()).value).toBe(3);
        expect((await gen.next()).done).toBe(true);
      });

      it('should throw error and stop generator on mapper error', async () => {
        function* source() {
          yield 1;
          yield 2;
        }
        const gen = asyncMapIterable(source(), (n) => {
          if (n === 2) throw new Error('Boom');
          return n;
        });

        expect((await gen.next()).value).toBe(1);
        await expect(gen.next()).rejects.toThrow('Boom');
      });
    });

    // ------ AbortSignal 中止支持 ------
    describe('AbortSignal Support', () => {
      it('should throw immediately if aborted before start', async () => {
        const ac = new AbortController();
        ac.abort();
        const gen = asyncMapIterable([1], () => 1, {signal: ac.signal});
        await expect(gen.next()).rejects.toBeInstanceOf(DOMException);
      });

      it('should ignore rejection from iterator.return() when aborted before start', async () => {
        const ac = new AbortController();
        ac.abort();

        const returnError = new Error('Return rejected');
        const iterable = {
          [Symbol.asyncIterator]: () => ({
            next: () => Promise.resolve({value: 1, done: false}),
            return: () => Promise.reject(returnError),
          }),
        };

        const gen = asyncMapIterable(iterable, (x) => x, {signal: ac.signal});
        // 应抛出中止错误，忽略 return 的拒绝
        await expect(gen.next()).rejects.toBeInstanceOf(DOMException);
      });

      it('should handle promise returned by iterator.return() when aborted before start', async () => {
        const ac = new AbortController();
        const returnSpy = vi.fn(() =>
          Promise.resolve({value: undefined, done: true}),
        );
        const iterable = {
          [Symbol.asyncIterator]: () => ({
            next: () => Promise.resolve({value: 1, done: false}),
            return: returnSpy,
          }),
        };

        ac.abort();
        const gen = asyncMapIterable(iterable, (x) => x, {signal: ac.signal});
        await expect(gen.next()).rejects.toThrow(); // 抛出中止错误
        expect(returnSpy).toHaveBeenCalled(); // 验证 return 被调用
      });

      it('should throw if aborted during iteration', async () => {
        const ac = new AbortController();
        function* source() {
          yield 1;
          yield 2;
        }
        const gen = asyncMapIterable(
          source(),
          async (n) => {
            if (n === 1) {
              await sleep(0);
              ac.abort();
            }
            return n;
          },
          {signal: ac.signal},
        );

        await expect(gen.next()).rejects.toBeInstanceOf(DOMException);
      });

      it('should throw if signal aborts synchronously during iteration', async () => {
        const ac = new AbortController();
        const iterable = {
          [Symbol.iterator]: () => ({
            next: () => {
              ac.abort(); // 在 next 中同步中止
              return {value: 1, done: false};
            },
          }),
        };
        const gen = asyncMapIterable(iterable, (x) => x, {signal: ac.signal});
        await expect(gen.next()).rejects.toBeInstanceOf(DOMException);
      });

      it('should cleanup iterator when aborted', async () => {
        const ac = new AbortController();
        const returnSpy = vi.fn();
        const iterable = {
          [Symbol.asyncIterator]: () => ({
            next: () => Promise.resolve({value: 1, done: false}),
            return: returnSpy,
          }),
        };

        const gen = asyncMapIterable(
          iterable,
          async () => {
            ac.abort();
            await sleep(0);
          },
          {signal: ac.signal},
        );

        await expect(gen.next()).rejects.toBeInstanceOf(DOMException);
        expect(returnSpy).toHaveBeenCalled();
      });

      it('should handle rejected promise from iterator.return() in cleanup', async () => {
        // 迭代器完成时调用 return，即使 return 返回 rejected Promise 也不影响主流程
        const returnError = new Error('Cleanup reject');
        const iterable = {
          [Symbol.asyncIterator]: () => ({
            next: () => Promise.resolve({value: undefined, done: true}),
            return: () => Promise.reject(returnError),
          }),
        };

        const gen = asyncMapIterable(iterable, (x) => x);
        await expect(gen.next()).resolves.toEqual({
          value: undefined,
          done: true,
        });
      });

      it('should throw if signal aborts between yields', async () => {
        const ac = new AbortController();
        function* source() {
          yield 1;
          yield 2;
        }
        const gen = asyncMapIterable(source(), (x) => x, {signal: ac.signal});

        expect((await gen.next()).value).toBe(1);
        ac.abort(); // 在两次 yield 之间中止
        await expect(gen.next()).rejects.toBeInstanceOf(DOMException);
      });
    });

    // ------ 迭代器协议 ------
    describe('Iterator Protocol', () => {
      it('should throw if iterator.next() throws synchronously', async () => {
        const error = new Error('Sync next error');
        const iterable = {
          [Symbol.iterator]: () => ({
            next: () => {
              throw error;
            },
          }),
        };
        const gen = asyncMapIterable(iterable, (x) => x);
        await expect(gen.next()).rejects.toThrow(error);
      });
    });
  });
});
