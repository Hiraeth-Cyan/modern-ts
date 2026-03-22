// ========================================
// ./src/Concurrent/ext/race.spec.ts
// ========================================
import {describe, it, expect, vi} from 'vitest';
import {asyncRace, asyncFirst} from './race';
import {ParameterError} from '../../Errors';
import {sleep} from '../delay';
import {flushPromises} from '../../helper';

// ============================================
// asyncRace 测试
// ============================================
describe.concurrent('asyncRace', () => {
  it('should resolve with the first fulfilled value', async () => {
    // 验证最快的 Promise 解决后返回其结果
    const result = await asyncRace([
      sleep(0).then(() => 'slow'),
      Promise.resolve('fast'),
    ]);
    expect(result).toBe('fast');
  });

  it('should reject with the first rejected error', async () => {
    // 验证最快的拒绝错误被抛出
    await expect(
      asyncRace([
        sleep(0).then(() => {
          throw new Error('slow error');
        }),
        Promise.reject(new Error('fast error')),
      ]),
    ).rejects.toThrow('fast error');
  });

  // 合并参数错误测试：空数组和非数组输入
  it.each([
    {tasks: [], description: 'empty array'},
    {tasks: () => [], description: 'non-array input'},
  ])('should throw ParameterError for $description', async ({tasks}) => {
    await expect(asyncRace(tasks)).rejects.toThrow(ParameterError);
  });

  it('should call executor function with signal and use returned tasks', async () => {
    // 测试 executor 函数被调用，并返回正确的任务数组
    const executor = vi.fn((_signal) => [Promise.resolve('value')]);
    const result = await asyncRace(executor);
    expect(executor).toHaveBeenCalledWith(expect.any(AbortSignal));
    expect(result).toBe('value');
  });

  it('should not reject if a later task rejects after first resolves', async () => {
    // 确保第一个解决后，后续任务的拒绝不会影响主 Promise
    const p = asyncRace([
      sleep(0).then(() => 'success'),
      sleep(1).then(() => {
        throw new Error('late error');
      }),
    ]);
    await expect(p).resolves.toBe('success');
    // 等待足够时间让第二个任务完成，确保没有未捕获的拒绝
    await sleep(2);
  });

  it('should handle multiple tasks where the fastest wins', async () => {
    // 验证多个异步任务中最快者获胜，且所有任务最终都会执行
    const results: string[] = [];
    const p = asyncRace([
      sleep(6).then(() => {
        results.push('A');
        return 'A';
      }),
      sleep(0).then(() => {
        results.push('B');
        return 'B';
      }),
      sleep(2).then(() => {
        results.push('C');
        return 'C';
      }),
    ]);
    await expect(p).resolves.toBe('B');
    await sleep(5);
    expect(results).toEqual(expect.arrayContaining(['A', 'B', 'C']));
  });

  it('should wrap non-Error rejections using ensureError', async () => {
    // 验证非 Error 类型的拒绝（如字符串）会被转换为 Error 实例
    await expect(
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
      asyncRace([Promise.reject('just a string')]),
    ).rejects.toBeInstanceOf(Error);
  });
});

// ============================================
// asyncFirst 测试
// ============================================
describe.concurrent('asyncFirst', () => {
  it('should resolve with the first available value (synchronous or resolved promise)', async () => {
    // 测试混合同步值与异步任务时，最先可用的值（同步值）被返回
    const result = await asyncFirst([
      sleep(1).then(() => 1),
      2,
      Promise.resolve(3),
    ]);
    expect(result).toBe(2);
  });

  it('should reject if first item rejects', async () => {
    // 验证如果迭代器的第一个项拒绝，则返回的 Promise 拒绝
    await expect(
      asyncFirst([Promise.reject(new Error('oops')), sleep(0).then(() => 2)]),
    ).rejects.toThrow('oops');
  });

  it('should throw ParameterError if iterable is empty', async () => {
    // 空数组或空异步迭代器应抛出 ParameterError
    await expect(asyncFirst([])).rejects.toThrow(ParameterError);

    async function* emptyAsync() {}
    await expect(asyncFirst(emptyAsync())).rejects.toThrow(ParameterError);
  });

  it('should work with async iterable', async () => {
    // 验证异步生成器作为输入时的基本功能
    async function* gen() {
      yield sleep(0).then(() => 1);
      yield 2;
      yield 3;
    }
    const result = await asyncFirst(gen());
    expect(result).toBe(1);
  });

  it('should abort iteration when first value resolves', async () => {
    // 验证一旦第一个值解决，后续的 next() 调用不会发生
    let callCount = 0;
    const iterable = {
      [Symbol.asyncIterator]() {
        return {
          async next() {
            callCount++;
            if (callCount === 1) {
              await sleep(0);
              return {value: 'first', done: false};
            }
            return {value: 'second', done: false};
          },
        };
      },
    };

    const result = await asyncFirst(iterable);
    expect(result).toBe('first');
    expect(callCount).toBe(2); // 只调用了第一次和第二次（第二次因 done 而停止）
  });

  it('should respect external abort signal', async () => {
    // 验证外部传入的 AbortSignal 可以中止操作
    const controller = new AbortController();
    const p = asyncFirst([sleep(1).then(() => 'done')], controller.signal);
    controller.abort();
    await expect(p).rejects.toBeInstanceOf(DOMException);
  });

  it('should reject immediately if external signal is already aborted', async () => {
    // 验证如果传入的信号已经中止，则立即拒绝
    const controller = new AbortController();
    controller.abort();
    await expect(
      asyncFirst([1, 2, 3], controller.signal),
    ).rejects.toBeInstanceOf(DOMException);
  });

  it('should clean up event listener on completion', async () => {
    // 验证完成（解决或拒绝）后，信号上的事件监听器被移除
    const controller = new AbortController();
    const removeEventListenerSpy = vi.spyOn(
      controller.signal,
      'removeEventListener',
    );
    const result = await asyncFirst([1], controller.signal);
    expect(result).toBe(1);
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'abort',
      expect.any(Function),
    );
  });

  it('should not reject with "No tasks were provided" if there are pending tasks', async () => {
    // 边界情况：迭代器产生一个慢任务后立即结束，此时仍有 pending 任务，不应错误地拒绝
    async function* gen() {
      yield sleep(0).then(() => 1);
    }
    const p = asyncFirst(gen());
    await flushPromises(); // 让迭代器开始并启动任务
    await expect(p).resolves.toBe(1);
  });

  it('should reject if iterator throws error', async () => {
    // 验证迭代器本身抛出错误时，asyncFirst 会拒绝并传递该错误
    const iterable = {
      [Symbol.asyncIterator]() {
        return {
          next() {
            throw new Error('iterator error');
          },
        };
      },
    };
    await expect(asyncFirst(iterable)).rejects.toThrow('iterator error');
  });

  it('should correctly handle multiple pending tasks and resolve with the fastest', async () => {
    // 验证多个异步任务中最快者获胜，且所有任务最终都会执行
    // 注意：时间间隔必须足够大（>=10ms），避免 Windows 定时器精度问题（约 4ms）
    const order: number[] = [];
    const p = asyncFirst([
      sleep(50).then(() => {
        order.push(1);
        return 1;
      }),
      sleep(10).then(() => {
        order.push(2);
        return 2;
      }),
      sleep(30).then(() => {
        order.push(3);
        return 3;
      }),
    ]);

    await expect(p).resolves.toBe(2);
    await sleep(60);
    expect(order).toEqual(expect.arrayContaining([1, 2, 3]));
  });

  it('should wrap non-Error rejections using ensureError', async () => {
    // 验证非 Error 类型的拒绝（如字符串）会被转换为 Error 实例
    await expect(
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
      asyncFirst([Promise.reject('string error')]),
    ).rejects.toBeInstanceOf(Error);
  });

  it('should not start next iteration if aborted during pending', async () => {
    // 验证在 pending 期间收到中止信号后，不会继续下一次迭代
    const controller = new AbortController();
    let nextCalledAfterAbort = false;

    const iterable = {
      [Symbol.asyncIterator]() {
        let count = 0;
        return {
          async next() {
            count++;
            if (count === 1) {
              await sleep(5);
              controller.abort(); // 模拟在第一个值处理过程中外部中止
              return {value: 'first', done: false};
            } else {
              nextCalledAfterAbort = true;
              return {value: 'second', done: false};
            }
          },
        };
      },
    };

    await expect(
      asyncFirst(iterable, controller.signal),
    ).rejects.toBeInstanceOf(DOMException);
    expect(nextCalledAfterAbort).toBe(false);
  });

  it('should handle rejection after external abort and cover active_tasks decrement', async () => {
    // 验证中止后仍有任务拒绝时，计数器正确递减且不会导致未捕获的拒绝
    const controller = new AbortController();

    const p = asyncFirst(
      [
        sleep(1).then(() => {
          throw new Error('late error');
        }),
      ],
      controller.signal,
    );

    await flushPromises(); // 确保任务已启动
    controller.abort();

    await expect(p).rejects.toBeInstanceOf(DOMException);
  });
});
