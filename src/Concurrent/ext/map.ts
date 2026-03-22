// ========================================
// ./src/Concurrent/ext/map.ts
// ========================================
import {ParameterError} from 'src/Errors';
import {ensureDOMException, ensureError} from '../../unknown-error';
import type {MaybePromise} from '../../Utils/type-tool';

/** Symbol used to skip an item in the map result. */
export const MAP_SKIP = Symbol('Map Skip');
export type MapSkipType = typeof MAP_SKIP;

/** Options for {@link asyncMap}. */
interface MapOptions {
  /** Maximum number of concurrent map operations. Defaults to `Infinity`. */
  readonly concurrency?: number;
  /** If `true`, stop processing on first error and reject with that error. If `false`, collect errors and reject with `AggregateError` at the end. Defaults to `true`. */
  readonly stopOnError?: boolean;
  /** AbortSignal to cancel the operation. */
  readonly signal?: AbortSignal;
}

/**
 * Mapping function type used by {@link asyncMap} and {@link asyncMapIterable}.
 *
 * @template T - Type of the input item.
 * @template R - Type of the mapped result.
 * @param item - The current item from the iterable.
 * @param index - The index of the current item.
 * @returns The mapped value, a promise of it, or {@link MAP_SKIP} to exclude this item.
 */
type Mapper<T, R> = (
  item: T,
  index: number,
) => R | MapSkipType | PromiseLike<R | MapSkipType>;

/**
 * Asynchronously maps items from an iterable (sync/async) using a concurrency‑controlled mapper.
 *
 * The function processes items in parallel up to `concurrency`, and returns an array of results
 * in the same order as the original iterable. Items for which the mapper returns `MAP_SKIP` are
 * omitted from the final array.
 *
 * @template T - Type of items in the input iterable (may be wrapped in a promise).
 * @template R - Type of the mapped results.
 * @param iterable - Source of items. Can be synchronous, asynchronous, or contain promises.
 * @param mapper - Async mapping function applied to each item.
 * @param options - Configuration options.
 * @returns Promise resolving to an array of mapped results (excluding skipped items).
 *
 * @example
 * ```typescript
 * const result = await asyncMap([1, 2, 3], async x => x * 2, { concurrency: 2 });
 * // result = [2, 4, 6]
 * ```
 */
export async function asyncMap<T, R>(
  iterable: Iterable<MaybePromise<T>> | AsyncIterable<MaybePromise<T>>,
  mapper: Mapper<T, R>,
  {concurrency = Infinity, stopOnError = true, signal}: MapOptions = {},
): Promise<Array<R>> {
  // -- 参数校验 --
  if (
    !(
      (Number.isSafeInteger(concurrency) && concurrency >= 1) ||
      concurrency === Infinity
    )
  ) {
    throw new ParameterError(
      `asyncMap: Expected \`concurrency\` to be an integer from 1 and up or \`Infinity\`, got \`${concurrency}\``,
    );
  }

  // ------ 核心逻辑：包装为 Promise 以精细控制异步流程 ------
  return new Promise((resolve, reject) => {
    // 获取迭代器（优先使用异步迭代器，否则回退到同步）
    const iterator =
      (iterable as AsyncIterable<T>)[Symbol.asyncIterator]?.() ??
      (iterable as Iterable<T>)[Symbol.iterator]();

    // 最终结果数组（可能含有空位，最后过滤）
    const results: R[] = [];
    // 当 stopOnError = false 时，收集所有错误
    const errors: unknown[] = [];
    // 当前正在执行的任务集合（用于并发控制）
    const running_tasks = new Set<Promise<void>>();

    let is_stopped = false;
    // 记录第一个错误的原因（stopOnError = true 时立即停止，无需遍历后续）
    let rejection_reason: unknown = null;

    // ------ 清理函数：移除监听、关闭迭代器（避免内存泄漏） ------
    const cleanup = () => {
      signal?.removeEventListener('abort', on_abort);
      if (typeof iterator.return === 'function') {
        try {
          const res = iterator.return();
          // 如果迭代器返回 promise，忽略其后续（仅确保被调用）
          if (res instanceof Promise) {
            void res.catch(() => {});
          }
        } catch {
          /* empty */
        }
      }
    };

    // ------ 中止信号处理 ------
    const on_abort = () => {
      cleanup();
      // DOMException 更适合表示中止原因
      reject(ensureDOMException(signal!.reason));
    };

    if (signal) {
      if (signal.aborted) {
        on_abort();
        return;
      }
      signal.addEventListener('abort', on_abort, {once: true});
    }

    // 主处理循环（立即执行，不阻塞外部 promise 构造）
    void (async () => {
      let index = 0;
      try {
        // ------ 并发控制循环：当未停止且并发未满时继续拉取 ------
        while (true) {
          // 每次迭代前检查停止状态（外部中止或内部 stopOnError 触发）
          if (signal?.aborted || is_stopped) {
            break;
          }

          // 若当前并发数已达上限，等待任意一个任务完成
          if (running_tasks.size >= concurrency) {
            await Promise.race(running_tasks);
          }

          // 等待后再次检查（等待期间可能被中止或 stopOnError 触发）
          if (signal?.aborted || is_stopped) break;

          // 拉取下一个项
          const {done, value} = (await iterator.next()) as IteratorResult<
            MaybePromise<T>,
            unknown
          >;
          if (done) break;

          const currentIndex = index++;

          // ------ 为当前项创建映射任务 ------
          const task = (async () => {
            try {
              const item = await value;
              // 再次检查停止状态，避免无意义的 mapper 执行（尤其是当前任务排队较久时）
              if (signal?.aborted || is_stopped) return;

              const mapped = await mapper(item, currentIndex);

              // 处理结果：跳过或按索引存储（直接赋值保证最终顺序）
              if (mapped !== MAP_SKIP) {
                // 即使前面的索引尚未填充，数组也会保留空位，最后过滤
                results[currentIndex] = mapped as Awaited<R>;
              }
            } catch (error) {
              if (stopOnError) {
                // 触发内部停止，并记录第一个错误原因
                is_stopped = true;
                if (!rejection_reason) {
                  rejection_reason = error;
                }
              } else {
                // 继续执行，但收集错误
                errors.push(error);
              }
            }
          })();

          running_tasks.add(task);
          // 任务无论成功/失败都需从 running_tasks 移除，使用 finally 确保删除
          // 并用 void 避免未处理的 promise 警告
          void task.finally(() => running_tasks.delete(task));
        }

        // 等待所有正在运行的任务结束（使用 allSettled 避免因某个任务失败而提前中断等待）
        await Promise.allSettled(running_tasks);

        // ------ 根据错误状态决定最终结果 ------
        if (rejection_reason) {
          reject(ensureError(rejection_reason));
        } else if (errors.length > 0) {
          reject(new AggregateError(errors));
        } else {
          // 过滤掉因跳过项而产生的空位（filter(() => true) 会跳过空位）
          resolve(results.filter(() => true));
        }
      } catch (error) {
        // 捕获 iterator.next() 或其他同步错误
        reject(ensureError(error));
      } finally {
        cleanup();
      }
    })();
  });
}

/** Options for {@link asyncMapIterable}. */
interface MapIterableOptions {
  /** Maximum number of concurrent map operations. Defaults to `Infinity`. */
  readonly concurrency?: number;
  /**
   * Maximum number of pending results buffered ahead of consumption.
   * Must be at least `concurrency`. Helps to prevent the producer from outrunning the consumer.
   * Defaults to `concurrency`.
   */
  readonly backpressure?: number;
  /** AbortSignal to cancel the operation. */
  readonly signal?: AbortSignal;
}

/**
 * Asynchronously maps items from an iterable (sync/async) into an async generator,
 * with concurrency control and backpressure.
 *
 * Items are processed in parallel up to `concurrency`, and results are yielded as soon as they
 * become available (preserving the original order). Use `backpressure` to limit how many results
 * are buffered ahead of consumption, preventing uncontrolled memory growth.
 *
 * @template T - Type of items in the input iterable (may be wrapped in a promise).
 * @template R - Type of the mapped results.
 * @param iterable - Source of items. Can be synchronous, asynchronous, or contain promises.
 * @param mapper - Async mapping function applied to each item.
 * @param options - Configuration options.
 * @returns AsyncGenerator yielding mapped results (excluding skipped items).
 *
 * @example
 * ```typescript
 * const gen = asyncMapIterable([1, 2, 3], async x => x * 2, { concurrency: 2 });
 * for await (const val of gen) {
 *   console.log(val); // 2, 4, 6 (in order)
 * }
 * ```
 */
export async function* asyncMapIterable<T, R>(
  iterable: Iterable<MaybePromise<T>> | AsyncIterable<MaybePromise<T>>,
  mapper: Mapper<T, R>,
  {
    concurrency = Infinity,
    backpressure = concurrency,
    signal,
  }: MapIterableOptions = {},
): AsyncGenerator<R, void, void> {
  // -- 参数校验 --
  if (
    !(
      (Number.isSafeInteger(concurrency) && concurrency >= 1) ||
      concurrency === Infinity
    )
  ) {
    throw new ParameterError(
      `asyncMapIterable: Expected \`concurrency\` to be an integer from 1 and up or \`Infinity\`, got \`${concurrency}\``,
    );
  }

  if (
    !(
      (Number.isSafeInteger(backpressure) && backpressure >= concurrency) ||
      backpressure === Infinity
    )
  ) {
    throw new ParameterError(
      `asyncMapIterable: Expected \`backpressure\` to be an integer >= \`concurrency\` or \`Infinity\`, got \`${backpressure}\``,
    );
  }

  // 获取迭代器（优先异步）
  const iterator =
    (iterable as AsyncIterable<T>)[Symbol.asyncIterator]?.() ??
    (iterable as Iterable<T>)[Symbol.iterator]();

  // 缓冲区存放正在处理的任务的 Promise，每个任务解析为 { value?, skip?, error? }
  const buffer: Array<
    Promise<{value?: R | symbol; skip?: boolean; error?: unknown}>
  > = [];

  let running = 0; // 当前正在执行的任务数
  let index = 0;
  let is_done = false; // 输入迭代器是否已耗尽

  // 中止相关的 Promise 和监听器
  let abort_promise: Promise<never> | undefined;
  let onAbortListener: (() => void) | undefined;

  if (signal) {
    if (signal.aborted) {
      const res = iterator.return?.();
      if (res instanceof Promise) void res.catch(() => {});
      throw ensureDOMException(signal.reason);
    }

    // 创建一个永不 resolved 的 Promise，一旦中止就 reject
    abort_promise = new Promise<never>((_, reject) => {
      onAbortListener = () => reject(ensureDOMException(signal.reason));
      signal.addEventListener('abort', onAbortListener);
    });
  }

  // ------ 清理函数（与 asyncMap 类似） ------
  const cleanup = () => {
    if (signal && onAbortListener) {
      signal.removeEventListener('abort', onAbortListener);
    }
    if (typeof iterator.return === 'function') {
      const res = iterator.return();
      if (res instanceof Promise) {
        void res.catch(() => {});
      }
    }
  };

  /**
   * 填充缓冲区：只要未耗尽、未中止、并发未满且缓冲区未达背压上限，
   * 就继续拉取输入并创建映射任务。
   */
  const fillBuffer = async () => {
    while (
      !is_done &&
      !signal?.aborted &&
      running < concurrency &&
      buffer.length < backpressure
    ) {
      // 拉取下一项，同时监听中止信号（若存在）
      const next_promise = iterator.next();
      const {done, value} = (await (abort_promise
        ? Promise.race([next_promise, abort_promise])
        : next_promise)) as IteratorResult<MaybePromise<T>, unknown>;

      if (done) {
        is_done = true;
        break;
      }

      running++;
      const currentIndex = index++;

      // 创建映射任务，其结果将被推入缓冲区
      const task = Promise.resolve(value)
        .then(async (item) => {
          // 执行 mapper，同时响应中止
          const mapped = await (abort_promise
            ? Promise.race([mapper(item, currentIndex), abort_promise])
            : mapper(item, currentIndex));

          return {value: mapped, skip: mapped === MAP_SKIP};
        })
        .catch((error: unknown) => ({error}))
        .finally(() => {
          running--; // 任务结束，减少运行计数
        });

      buffer.push(task);
    }
  };

  try {
    // ------ 消费者循环：从缓冲区取结果并 yield ------
    while (true) {
      if (signal?.aborted) {
        throw ensureDOMException(signal.reason);
      }

      // 尽可能填满缓冲区
      await fillBuffer();

      // 无缓冲项且输入已耗尽 → 结束
      if (buffer.length === 0) {
        return;
      }

      // 取出下一个缓冲任务，同时响应中止
      const buffer_task = buffer.shift()!;
      const result = await (abort_promise
        ? Promise.race([buffer_task, abort_promise])
        : buffer_task);

      // 如果任务出错，抛出（停止生成）
      if (result.error) {
        throw ensureError(result.error);
      }

      // 非跳过项才 yield
      if (!result.skip) {
        yield result.value! as R;
      }
    }
  } finally {
    cleanup();
  }
}
