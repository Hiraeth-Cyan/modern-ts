// ========================================
// ./src/Concurrent/ext/race.ts
// ========================================
import {ParameterError} from 'src/Errors';
import {ensureDOMException, ensureError} from '../../unknown-error';
import type {MaybePromise} from '../../Utils/type-tool';

type RaceExecutor<T> = (signal?: AbortSignal) => MaybePromise<T>[];

/**
 * Race multiple tasks and return the result of the first settled task (resolve or reject).
 *
 * Accepts either an array of tasks or an executor function that returns an array of tasks.
 * When the first task settles, all other pending tasks are aborted via the provided AbortSignal.
 *
 * @template T - The type of the resolved value.
 * @param executor_or_tasks - An array of tasks (each can be a value or a Promise-like), or a function that receives an AbortSignal and returns such an array.
 * @returns A Promise that resolves or rejects with the result of the first settled task.
 * @throws {ParameterError} If the provided tasks array is empty or not an array.
 */
export async function asyncRace<T>(
  executor_or_tasks: MaybePromise<T>[] | RaceExecutor<T>,
): Promise<T> {
  const abort_controller = new AbortController();
  const signal = abort_controller.signal;

  // 若传入的是执行器函数，则调用它并传入 signal，以便任务生成过程中也能响应中止
  const tasks =
    typeof executor_or_tasks === 'function'
      ? executor_or_tasks(signal)
      : executor_or_tasks;

  // 确保任务数组非空，否则抛出参数错误
  if (!Array.isArray(tasks) || tasks.length === 0)
    throw new ParameterError(
      'asyncRace: Must provide a non-empty array of tasks for a fair race!',
    );

  return new Promise<T>((resolve, reject) => {
    // 当第一个任务完成时，中止其他任务并执行最终的 resolve/reject
    const settle = (handler: () => void) => {
      if (signal.aborted) return; // 若已中止，忽略后续处理
      abort_controller.abort(); // 中止所有未完成的任务
      handler();
    };

    // 启动所有任务，最先 settled 的将触发 settle
    for (const item of tasks) {
      Promise.resolve(item).then(
        (val: T) => settle(() => resolve(val)),
        (err: unknown) => settle(() => reject(ensureError(err))), // 统一转换为 Error 类型
      );
    }
  });
}

type FirstSource<T> =
  | Iterable<MaybePromise<T>>
  | AsyncIterable<MaybePromise<T>>;

/**
 * Resolves with the first successfully fulfilled value from an (async) iterable source.
 *
 * Iterates over the source sequentially, starting each task (each element may be a value or a Promise-like).
 * If any task resolves successfully, that value becomes the result and all remaining tasks are aborted.
 * If all tasks reject, the function rejects with the last error encountered.
 *
 * @template T - The type of the resolved value.
 * @param source - An iterable or async iterable where each item can be a value or a Promise-like.
 * @param signal - Optional AbortSignal to cancel the operation externally.
 * @returns A Promise that resolves with the first successful value, or rejects if all fail or no tasks are provided.
 * @throws {ParameterError} If the source yields no tasks (empty iterable).
 * @throws {DOMException} If the provided signal is already aborted (synchronously).
 */
export async function asyncFirst<T>(
  source: FirstSource<T>,
  signal?: AbortSignal,
): Promise<T> {
  const abort_controller = new AbortController(); // 内部中止控制器，用于主动中止所有待处理任务

  return new Promise((resolve, reject) => {
    // ------ 处理外部信号 ------
    const onSignalAbort = () => {
      abort_controller.abort();
      reject(ensureDOMException(signal!.reason));
    };

    if (signal) {
      if (signal.aborted) {
        abort_controller.abort();
        throw ensureDOMException(signal.reason); // 外部信号已中止，同步抛出
      }
      signal.addEventListener('abort', onSignalAbort, {once: true});
    }

    // ------ 定义内部状态与辅助函数 ------
    let active_tasks = 0; // 记录当前正在等待的任务数量，用于判断是否所有任务都已失败

    // 当某个任务成功或失败时，取消所有其他任务，并最终解决/拒绝外部 Promise
    const settle = (handler: () => void) => {
      if (signal && !signal.aborted) {
        signal.removeEventListener('abort', onSignalAbort);
      }
      if (abort_controller.signal.aborted) return;
      handler();
      abort_controller.abort(); // 主动中止所有未完成的任务
    };

    // ------ 启动消费过程，遍历 source 并启动所有任务，等待第一个成功 ------
    const consume = async () => {
      try {
        // 不能使用 for await，因为它会等待每一项的 Promise 解决，导致串行化
        // 我们需要手动获取迭代器，尽快取出所有元素并同时启动
        const iterator =
          (source as AsyncIterable<T>)[Symbol.asyncIterator]?.() ??
          (source as Iterable<T>)[Symbol.iterator]();

        while (true) {
          if (abort_controller.signal.aborted) return;

          // 获取下一个元素（不等待值的解决）
          const {value, done} = (await iterator.next()) as IteratorResult<
            MaybePromise<T>,
            unknown
          >;
          if (done) break;

          active_tasks++;

          // value 可能是 Promise 或普通值，Promise.resolve 统一处理，且不会阻塞循环继续获取下一个
          Promise.resolve(value).then(
            (val: T) => settle(() => resolve(val)),
            (err: unknown) => {
              active_tasks--; // 任务失败，计数减一
              settle(() => reject(ensureError(err)));
            },
          );
        }

        // 循环结束后，若没有启动任何任务（source 为空）且未中止，则拒绝并提示无任务
        if (active_tasks === 0 && !abort_controller.signal.aborted) {
          reject(new ParameterError('asyncFirst: No tasks were provided.'));
        }
      } catch (err) {
        settle(() => reject(ensureError(err))); // 迭代过程中发生同步错误
      }
    };

    void consume(); // 不阻塞，启动消费
  });
}
