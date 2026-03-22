// ========================================
// ./src/Concurrent/task-scope.spec.ts
// ========================================

import {describe, it, expect, vi} from 'vitest';
import {TaskScope} from './task-scope';
import {UseAfterFreeError} from '../Errors';
import {flushPromises} from '../helper';

async function isPending(promise: Promise<unknown>): Promise<boolean> {
  return Promise.race([promise, Promise.resolve('PENDING')]).then(
    (v) => v === 'PENDING',
  );
}

describe.concurrent('TaskScope', () => {
  describe('Lifecycle & Basic State', () => {
    it('should initialize with clean state', () => {
      const scope = new TaskScope();
      expect(scope.signal.aborted).toBe(false);
      expect(scope['tasks'].size).toBe(0);
      expect(scope['finalizers'].length).toBe(0);
    });

    it('should work with await using (Symbol.asyncDispose)', async () => {
      let disposed = false;
      {
        await using innerScope = new TaskScope();
        innerScope.defer(() => {
          disposed = true;
        });
        expect(disposed).toBe(false);
      }
      expect(disposed).toBe(true);
    });

    it('should be idempotent on multiple dispose calls', async () => {
      const scope = new TaskScope();
      const deferSpy = vi.fn();
      scope.defer(deferSpy);

      await scope.dispose();
      await scope.dispose();
      await scope.dispose();

      expect(deferSpy).toHaveBeenCalledTimes(1);
    });

    it('should clean up parent listener on manual dispose', async () => {
      const controller = new AbortController();
      const removeSpy = vi.spyOn(controller.signal, 'removeEventListener');
      const childScope = new TaskScope(controller.signal);

      await childScope.dispose();
      expect(removeSpy).toHaveBeenCalledOnce();
    });
  });

  describe('Abortion & Inheritance', () => {
    it('should inherit aborted state from parent signal', () => {
      const controller = new AbortController();
      controller.abort(new Error('parent aborted'));
      const childScope = new TaskScope(controller.signal);

      expect(childScope.signal.aborted).toBe(true);
      expect((childScope.signal.reason as Error).message).toBe(
        'parent aborted',
      );
    });

    it('should abort when parent signal aborts', async () => {
      const controller = new AbortController();
      const childScope = new TaskScope(controller.signal);
      const abortSpy = vi.fn();
      childScope.signal.addEventListener('abort', abortSpy, {once: true});

      controller.abort();
      await flushPromises();

      expect(abortSpy).toHaveBeenCalledOnce();
      expect(childScope.signal.aborted).toBe(true);
    });

    it('should throw in run() when signal aborted but not disposed', async () => {
      const scope = new TaskScope();

      expect(scope.isDisposed).toBe(false);
      expect(scope.signal.aborted).toBe(false);

      scope['controller'].abort();

      expect(scope.isDisposed).toBe(false);
      expect(scope.signal.aborted).toBe(true);

      await expect(scope.run(() => 'result')).rejects.toThrow(DOMException);
    });

    it('should reject run() if signal is aborted immediately', async () => {
      const controller = new AbortController();
      controller.abort();
      const abortedScope = new TaskScope(controller.signal);

      await expect(abortedScope.run(() => 'result')).rejects.toThrow(
        UseAfterFreeError,
      );
    });

    it('should reject wait() if signal is aborted immediately', async () => {
      const scope = new TaskScope();
      scope['controller'].abort();

      await expect(scope.wait()).rejects.toThrow(DOMException);
    });

    it('should call go() onError with AbortError if already aborted', async () => {
      const scope = new TaskScope();
      const onErrorSpy = vi.fn();
      scope['controller'].abort();

      scope.go(() => expect.unreachable(), onErrorSpy);
      await flushPromises();

      expect(onErrorSpy).toHaveBeenCalledTimes(1);
      expect(onErrorSpy.mock.calls[0][0]).toBeInstanceOf(DOMException);
    });

    it('should ignore go() without onError if already aborted', async () => {
      const scope = new TaskScope();
      scope['controller'].abort();

      scope.go(() => expect.unreachable());
      await flushPromises();
    });
  });

  describe('Invalid State (UseAfterFree)', () => {
    it('should throw UseAfterFreeError for run()', async () => {
      const scope = new TaskScope();
      await scope.dispose();
      await expect(scope.run(() => {})).rejects.toThrow(UseAfterFreeError);
    });

    it('should throw UseAfterFreeError for go()', async () => {
      const scope = new TaskScope();
      await scope.dispose();
      expect(() => scope.go(() => {})).toThrow(UseAfterFreeError);
    });

    it('should throw UseAfterFreeError for defer()', async () => {
      const scope = new TaskScope();
      await scope.dispose();
      expect(() => scope.defer(() => {})).toThrow(UseAfterFreeError);
    });

    it('should throw UseAfterFreeError for wait()', async () => {
      const scope = new TaskScope();
      await scope.dispose();
      await expect(scope.wait()).rejects.toThrow(UseAfterFreeError);
    });

    it('should throw UseAfterFreeError for link()', async () => {
      const scope = new TaskScope();
      await scope.dispose();
      await expect(scope.link(new AbortController().signal)).rejects.toThrow(
        UseAfterFreeError,
      );
    });
  });

  describe('Task Execution (run, go, wait)', () => {
    it('should execute task with run() and return result', async () => {
      const scope = new TaskScope();
      const result = await scope.run(() => 'success');
      expect(result).toBe('success');
    });

    it('should cleanup tasks set even if task fails in run()', async () => {
      const scope = new TaskScope();
      expect(scope['tasks'].size).toBe(0);
      await expect(
        scope.run(() => Promise.reject(new Error('task failed'))),
      ).rejects.toThrow('task failed');

      expect(scope['tasks'].size).toBe(0);
    });

    it('should handle concurrent run() calls', async () => {
      const scope = new TaskScope();
      const results = await Promise.all([
        scope.run(() => Promise.resolve(1)),
        scope.run(() => 2),
        scope.run(async () => {
          await flushPromises();
          return 3;
        }),
      ]);
      expect(results).toEqual([1, 2, 3]);
    });

    it('should abort run() immediately when disposed during execution', async () => {
      const scope = new TaskScope();
      const controller = new AbortController();

      await scope.link(controller.signal);

      const p = scope.run(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      void scope.dispose(new Error('abort'));

      await expect(p).rejects.toThrow(DOMException);
    });

    it('should fire and forget with go()', async () => {
      const scope = new TaskScope();
      let taskExecuted = false;
      scope.go(() => {
        taskExecuted = true;
      });
      await flushPromises();
      expect(taskExecuted).toBe(true);
    });

    it('should handle go() errors with onError callback', async () => {
      const scope = new TaskScope();
      const error = new Error('task error');
      const errorSpy = vi.fn();

      scope.go(() => Promise.reject(error), errorSpy);
      await flushPromises();

      expect(errorSpy).toHaveBeenCalledWith(error);
    });

    it('should cleanup tasks set when go() fails without onError', async () => {
      const scope = new TaskScope();
      scope.go(() => Promise.reject(new Error('go error')));
      await flushPromises();
      expect(scope['tasks'].size).toBe(0);
    });

    it('should wait for all tasks to complete', async () => {
      const scope = new TaskScope();
      let completed = 0;
      scope.go(() => {
        completed++;
      });
      scope.go(() => {
        completed++;
      });

      await scope.wait();
      expect(completed).toBe(2);
    });

    it('should resolve wait() immediately if no tasks', async () => {
      const scope = new TaskScope();
      await expect(scope.wait()).resolves.toBeUndefined();
    });

    it('should handle multiple wait() calls concurrently', async () => {
      const scope = new TaskScope();
      let resolveTask: (() => void) | undefined;
      scope.go(
        () =>
          new Promise<void>((res) => {
            resolveTask = res;
          }),
      );

      const wait1 = scope.wait();
      const wait2 = scope.wait();

      resolveTask!();
      await flushPromises();

      await expect(Promise.all([wait1, wait2])).resolves.toBeDefined();
    });

    it('should wait for dynamically added tasks', async () => {
      const scope = new TaskScope();
      let resolveTask1: (() => void) | undefined;
      let resolveTask2: (() => void) | undefined;

      scope.go(
        () =>
          new Promise<void>((resolve) => {
            resolveTask1 = resolve;
          }),
      );

      const waitPromise = scope.wait();
      expect(await isPending(waitPromise)).toBe(true);

      scope.go(
        () =>
          new Promise<void>((resolve) => {
            resolveTask2 = resolve;
          }),
      );

      resolveTask1!();
      await flushPromises();
      expect(await isPending(waitPromise)).toBe(true);

      resolveTask2!();
      await flushPromises();
      await expect(waitPromise).resolves.toBeUndefined();
    });

    it('should resolve pending wait() immediately when disposed', async () => {
      const scope = new TaskScope();
      scope.go((signal) => {
        return new Promise((_, reject) => {
          signal.addEventListener('abort', () =>
            reject(signal.reason as Error),
          );
        });
      });

      const waitPromise = scope.wait();
      await scope.dispose();
      await expect(waitPromise).resolves.toBeUndefined();
    });

    it('should resolve wait() even if task rejects (ensuring cleanup)', async () => {
      const scope = new TaskScope();
      scope.go(() => Promise.reject(new Error('err')));
      await expect(scope.wait()).resolves.toBeUndefined();
      expect(scope['tasks'].size).toBe(0);
    });

    it('should swallow task errors during dispose (fire and forget)', async () => {
      const scope = new TaskScope();
      const taskError = new Error('task error during dispose');
      scope.go(
        () => new Promise((_, rej) => setTimeout(() => rej(taskError), 0)),
      );
      await flushPromises();

      await expect(scope.dispose()).resolves.toBeUndefined();
    });

    it('should wait for pending tasks to finish during dispose', async () => {
      const scope = new TaskScope();
      let taskCompleted = false;
      scope.go(async () => {
        await new Promise((r) => setTimeout(r, 5));
        taskCompleted = true;
      });

      await scope.dispose();
      expect(taskCompleted).toBe(true);
    });
  });

  describe('Cleanup Resources (defer)', () => {
    it('should execute defer callbacks in reverse order (LIFO)', async () => {
      const scope = new TaskScope();
      const order: number[] = [];
      scope.defer(() => {
        order.push(1);
      });
      scope.defer(() => {
        order.push(2);
      });
      scope.defer(() => {
        order.push(3);
      });

      await scope.dispose();
      expect(order).toEqual([3, 2, 1]);
    });

    it('should remove defer callback when cleanup function is called', async () => {
      const scope = new TaskScope();
      const deferSpy = vi.fn();
      const cleanup = scope.defer(deferSpy);

      cleanup();
      await scope.dispose();
      expect(deferSpy).not.toHaveBeenCalled();
    });

    it('should handle defer errors as AggregateError', async () => {
      const scope = new TaskScope();
      const error1 = new Error('defer error 1');
      const error2 = new Error('defer error 2');

      scope.defer(() => Promise.reject(error1));
      scope.defer(() => Promise.reject(error2));

      try {
        await scope.dispose();
        expect.unreachable('Should have thrown AggregateError');
      } catch (e) {
        expect(e).toBeInstanceOf(AggregateError);
        expect((e as AggregateError).errors).toEqual([error2, error1]);
      }
    });
  });

  describe('Signal Linking', () => {
    it('should link multiple signals and dispose when any aborts', async () => {
      const scope = new TaskScope();
      const controller1 = new AbortController();
      const controller2 = new AbortController();

      await scope.link(controller1.signal, controller2.signal);
      controller1.abort(new Error('signal1 aborted'));

      await flushPromises();
      expect(scope.signal.aborted).toBe(true);
    });

    it('should abort immediately if any linked signal is already aborted', async () => {
      const scope = new TaskScope();
      const controller1 = new AbortController();
      const controller2 = new AbortController();
      controller2.abort(new Error('already aborted'));

      await scope.link(controller1.signal, controller2.signal);
      expect(scope.signal.aborted).toBe(true);
    });

    it('should cleanup linked listeners on manual dispose', async () => {
      const scope = new TaskScope();
      const controller = new AbortController();
      await scope.link(controller.signal);
      expect(scope['link_groups'].length).toBe(1);

      await scope.dispose();
      expect(scope['link_groups'].length).toBe(0);
    });

    it('should cleanup link group when cleanup function is called', async () => {
      const scope = new TaskScope();
      const controller = new AbortController();
      const abortSpy = vi.fn();

      const cleanup = await scope.link(controller.signal);
      scope.signal.addEventListener('abort', abortSpy);

      cleanup();
      controller.abort();

      await flushPromises();
      expect(abortSpy).not.toHaveBeenCalled();
    });

    it('should handle link cleanup function being called multiple times', async () => {
      const scope = new TaskScope();
      const controller = new AbortController();
      const cleanup = await scope.link(controller.signal);

      cleanup();
      expect(() => cleanup()).not.toThrow();

      controller.abort();
      await flushPromises();
      expect(scope.signal.aborted).toBe(false);
    });
  });

  describe('Concurrency Primitives (all, race, any, select)', () => {
    it('should execute all() with multiple tasks', async () => {
      const scope = new TaskScope();
      const results = await scope.all([
        () => 1,
        () => Promise.resolve(2),
        async () => {
          await flushPromises();
          return 3;
        },
      ] as const);
      expect(results).toEqual([1, 2, 3]);
    });

    it('should cleanup tasks in all() even if one rejects', async () => {
      const scope = new TaskScope();
      const error = new Error('fail');
      await expect(
        scope.all([() => 1, () => Promise.reject(error)] as const),
      ).rejects.toThrow(error);

      expect(scope['tasks'].size).toBe(0);
    });

    it('should reject all() if scope is already aborted', async () => {
      const scope = new TaskScope();
      scope['controller'].abort();
      await expect(scope.all([() => 1] as const)).rejects.toThrow(DOMException);
    });

    it('should abort all() immediately when disposed during execution', async () => {
      const scope = new TaskScope();
      const controller = new AbortController();

      await scope.link(controller.signal);

      const p = scope.all([
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return 1;
        },
      ]);

      void scope.dispose(new Error('abort'));

      await expect(p).rejects.toThrow(DOMException);
    });

    it('should handle allSettled() with mixed success/failure', async () => {
      const scope = new TaskScope();
      const error = new Error('task failed');
      const results = await scope.allSettled([
        () => 'success',
        () => Promise.reject(error),
        () => 'also success',
      ] as const);

      expect(results).toEqual([
        {status: 'fulfilled', value: 'success'},
        {status: 'rejected', reason: error},
        {status: 'fulfilled', value: 'also success'},
      ]);
    });

    it('should reject allSettled() if scope is already aborted', async () => {
      const scope = new TaskScope();
      scope['controller'].abort();
      await expect(scope.allSettled([() => 'a'] as const)).rejects.toThrow(
        DOMException,
      );
    });

    it('should abort allSettled() immediately when disposed during execution', async () => {
      const scope = new TaskScope();
      const controller = new AbortController();

      await scope.link(controller.signal);

      const p = scope.allSettled([
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return 'result';
        },
      ]);

      void scope.dispose(new Error('abort'));

      await expect(p).rejects.toThrow(DOMException);
    });

    it('should execute race() with first resolved task', async () => {
      const scope = new TaskScope();
      const result = await scope.race([
        () => new Promise((res) => setTimeout(() => res(1), 10)),
        () => 2,
        () => 3,
      ] as const);
      expect(result).toBe(2);
    });

    it('should reject race() if scope is already aborted', async () => {
      const scope = new TaskScope();
      scope['controller'].abort();
      await expect(scope.race([() => 1] as const)).rejects.toThrow(
        DOMException,
      );
    });

    it('should abort race() immediately when disposed during execution', async () => {
      const scope = new TaskScope();
      const controller = new AbortController();

      await scope.link(controller.signal);

      const p = scope.race([
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return 1;
        },
      ]);

      void scope.dispose(new Error('abort'));

      await expect(p).rejects.toThrow(DOMException);
    });

    it('should execute any() with first fulfilled task', async () => {
      const scope = new TaskScope();
      const result = await scope.any([
        () => Promise.reject(new Error('error1')),
        () => 'success',
        () => Promise.reject(new Error('error2')),
      ] as const);
      expect(result).toBe('success');
    });

    it('should reject any() if all tasks reject', async () => {
      const scope = new TaskScope();
      const error1 = new Error('error1');
      const error2 = new Error('error2');
      await expect(
        scope.any([
          () => Promise.reject(error1),
          () => Promise.reject(error2),
        ] as const),
      ).rejects.toThrow(AggregateError);
    });

    it('should reject any() if scope is already aborted', async () => {
      const scope = new TaskScope();
      scope['controller'].abort();
      await expect(scope.any([() => 1] as const)).rejects.toThrow(DOMException);
    });

    it('should abort any() immediately when disposed during execution', async () => {
      const scope = new TaskScope();
      const controller = new AbortController();

      await scope.link(controller.signal);

      const p = scope.any([
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return 1;
        },
      ]);

      void scope.dispose(new Error('abort'));

      await expect(p).rejects.toThrow(DOMException);
    });

    it('should select() with index and status (fulfilled)', async () => {
      const scope = new TaskScope();
      const result = await scope.select([
        () => 'first',
        () => Promise.resolve('second'),
      ] as const);

      expect(result).toHaveProperty('index');
      expect(result).toHaveProperty('status');
      expect(result.status).toBe('fulfilled');
      expect((result as PromiseFulfilledResult<string>).value).toBeTruthy();
    });

    it('should select() when first task rejects', async () => {
      const scope = new TaskScope();
      const error = new Error('failed task');
      const result = await scope.select([
        () => Promise.reject(error),
        () => new Promise((resolve) => setTimeout(() => resolve('slow'), 1)),
      ] as const);

      expect(result).toEqual({
        index: 0,
        status: 'rejected',
        reason: error,
      });
    });

    it('should reject select() if scope is already aborted', async () => {
      const scope = new TaskScope();
      scope['controller'].abort();
      await expect(scope.select([() => 1] as const)).rejects.toThrow(
        DOMException,
      );
    });

    it('should abort select() immediately when disposed during execution', async () => {
      const scope = new TaskScope();
      const controller = new AbortController();

      await scope.link(controller.signal);

      const p = scope.select([
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return 'result';
        },
      ]);

      void scope.dispose(new Error('abort'));

      await expect(p).rejects.toThrow(DOMException);
    });
  });

  describe('Forking & Generators', () => {
    it('should spawn generator tasks', async () => {
      const scope = new TaskScope();
      const genTask = function* (
        _signal: AbortSignal,
      ): Generator<Promise<number>, number, number> {
        const a = yield Promise.resolve(1);
        const b = yield Promise.resolve(2);
        return a + b;
      };

      const result = await scope.spawn(genTask);
      expect(result).toBe(3);
    });

    it('should handle generator throw via try/catch', async () => {
      const scope = new TaskScope();
      const genTask = function* () {
        try {
          yield Promise.reject(new Error('generator error'));
        } catch (e) {
          return 'caught';
        }
      };

      const result = await scope.spawn(genTask);
      expect(result).toBe('caught');
    });

    it('should reject spawn promise if generator throws uncaught error', async () => {
      const scope = new TaskScope();
      const error = new Error('uncaught generator error');
      const genTask = function* (_signal: AbortSignal) {
        yield 1;
        yield Promise.reject(error);
        return 1;
      };

      await expect(scope.spawn(genTask)).rejects.toThrow(error);
    });

    it('Should forcibly terminate the generator and trigger the finally block when the signal aborts.', async () => {
      const scope = new TaskScope();
      let finalized = false;

      // 1. 启动 spawn 任务
      const task = scope.spawn(function* () {
        try {
          while (true) {
            // 模拟一个永远不会结束的异步循环
            yield new Promise((res) => setTimeout(res, 10));
          }
        } finally {
          // 如果 g.return() 被成功调用，这里一定会被执行
          finalized = true;
        }
      });

      // 2. 等待一小会儿让生成器跑起来，然后突然背刺（中止）它！
      await new Promise((res) => setTimeout(res, 15));
      await scope.dispose('主人命令中止喵！');

      // 3. 断言结果
      await expect(task).rejects.toThrow(); // 应该抛出中止异常
      expect(finalized).toBe(true); // 验证 finally 块是否跑过
    });

    it('should create forked sub-scope', async () => {
      const scope = new TaskScope();
      let subTaskCompleted = false;
      const subScope = scope.fork();

      subScope.go(async () => {
        await flushPromises();
        subTaskCompleted = true;
      });

      await subScope.wait();
      await scope.wait();
      expect(subTaskCompleted).toBe(true);
    });

    it('should abort forked scope when parent aborts', async () => {
      const controller = new AbortController();
      const parentScope = new TaskScope(controller.signal);
      const subScope = parentScope.fork();

      controller.abort();
      await flushPromises();

      expect(subScope.signal.aborted).toBe(true);
    });

    it('should detach forked scope when sub-scope completes', async () => {
      const scope = new TaskScope();
      const subScope = scope.fork();
      expect(scope['tasks'].size).toBe(1);

      await subScope.dispose();
      await flushPromises();
      expect(scope['tasks'].size).toBe(0);
    });
  });
});
