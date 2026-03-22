// ========================================
// ./src/Concurrent/ext/other.ts
// ========================================
import {ParameterError} from 'src/Errors';
import {ensureDOMException} from '../../unknown-error';
import {delaySafe} from '../delay';

/**
 * Options for timeout operations.
 * @template T - The type of the original promise result
 * @template R - The type of the fallback result (defaults to T)
 */
export interface TimeoutOptions<T, R = T> {
  /** Timeout duration in milliseconds */
  readonly ms: number;
  /** Optional fallback function to call on timeout */
  readonly fallback?: () => R;
  /** Optional abort signal for cancellation */
  readonly signal?: AbortSignal;
}

/**
 * Wraps a promise with a timeout, returning either the promise result or a fallback value.
 *
 * @template T - The type of the original promise result
 * @template R - The type of the fallback result (defaults to never if no fallback)
 * @param promise - The promise to wrap with timeout
 * @param options - Timeout options including duration, fallback, and abort signal
 * @returns A promise that resolves with the original result or fallback value, with a `clear` method to cancel
 * @throws {ParameterError} If `ms` is not a positive integer
 * @throws {DOMException} With 'TimeoutError' if timeout occurs without fallback, or 'AbortError' if cleared/cancelled
 */
export function asyncTimeout<T, R = never>(
  promise: PromiseLike<T>,
  options: TimeoutOptions<R>,
): Promise<T | R> & {clear: () => void} {
  const {ms, fallback, signal} = options;

  if (!Number.isFinite(ms) || !Number.isSafeInteger(ms) || ms <= 0)
    throw new ParameterError(
      `asyncTimeout: \`ms\` must be a positive integer, but got ${ms}`,
    );

  let timer_id: ReturnType<typeof setTimeout> | null = null;
  let abort_handler: (() => void) | null = null;
  let external_reject: (reason: unknown) => void;

  // -- 清理定时器 --
  const clear_timer = () => {
    if (timer_id !== null) {
      clearTimeout(timer_id);
      timer_id = null;
    }
  };

  // -- 完整清理（定时器 + abort 监听器） --
  const cleanup = () => {
    clear_timer();
    if (abort_handler && signal) {
      signal.removeEventListener('abort', abort_handler);
      abort_handler = null;
    }
  };

  // -- 统一的拒绝处理 --
  const do_reject = (reason: unknown) => {
    cleanup();
    external_reject!(reason);
  };

  const wrapped_promise = new Promise<T | R>((resolve, reject) => {
    external_reject = reject;

    // 如果 signal 已经 aborted，直接拒绝
    if (signal?.aborted) return do_reject(ensureDOMException(signal.reason));

    // 设置超时定时器
    timer_id = setTimeout(() => {
      if (fallback) {
        try {
          resolve(fallback());
          cleanup();
        } catch (err) {
          do_reject(err);
        }
      } else {
        do_reject(
          new DOMException(`Promise timed out after ${ms}ms`, 'TimeoutError'),
        );
      }
    }, ms);

    // 注册 abort 监听器
    if (signal) {
      abort_handler = () => do_reject(ensureDOMException(signal.reason));
      signal.addEventListener('abort', abort_handler, {once: true});
    }

    // 处理原始 promise 的结果
    promise.then(
      (val) => {
        cleanup();
        resolve(val);
      },
      (err) => {
        do_reject(err);
      },
    );
  });

  const result_promise = wrapped_promise.finally(() => {
    cleanup();
  }) as Promise<T | R> & {clear: () => void};

  // 提供外部清除接口
  result_promise.clear = () => {
    do_reject(new DOMException('Timeout cleared by user', 'AbortError'));
  };

  return result_promise;
}

/**
 * Executes an async mapper function over an array with controlled concurrency,
 * returning settled results (fulfilled or rejected) for each element.
 *
 * @template T - The type of array elements
 * @template R - The type of mapper result
 * @param array - The array to process
 * @param options - Options including concurrency limit, mapper function, and abort signal
 * @returns An array of settled results preserving the original order
 * @throws {ParameterError} If `concurrency` is not a positive integer or Infinity
 * @throws {DOMException} If the abort signal is triggered
 */
export async function asyncSettle<T, R>(
  array: T[],
  options: {
    concurrency?: number;
    mapper: (element: T, index: number) => Promise<R> | R;
    signal?: AbortSignal;
  },
): Promise<
  ({status: 'fulfilled'; value: R} | {status: 'rejected'; reason: unknown})[]
> {
  const {concurrency = Infinity, mapper, signal} = options;
  if (
    !(
      (Number.isSafeInteger(concurrency) && concurrency >= 1) ||
      concurrency === Infinity
    )
  ) {
    throw new ParameterError(
      `asyncSettle: Expected \`concurrency\` to be an integer from 1 and up or \`Infinity\`, got \`${concurrency}\``,
    );
  }

  // 校验 abort signal
  if (signal?.aborted) throw ensureDOMException(signal.reason);

  const results = new Array<
    {status: 'fulfilled'; value: R} | {status: 'rejected'; reason: unknown}
  >(array.length);
  let currentIndex = 0;

  // -- 单个 worker 的执行逻辑 --
  const runTask = async () => {
    while (currentIndex < array.length && !signal?.aborted) {
      const index = currentIndex++;
      try {
        const value = await mapper(array[index], index);
        results[index] = {status: 'fulfilled', value};
      } catch (reason) {
        results[index] = {status: 'rejected', reason};
      }
    }
  };

  // 根据并发数启动并行的 worker
  const workers = Array.from(
    {length: Math.min(concurrency, array.length)},
    () => runTask(),
  );

  await Promise.all(workers);

  // 若执行过程中发生中断，抛出错误
  if (signal?.aborted) throw ensureDOMException(signal.reason);

  return results;
}

// 用于标记 asyncWaitFor 的特殊返回值，表示"已完成并返回指定值"
const doneValue = Symbol('done value');

/**
 * Internal interface for resolving asyncWaitFor with a specific value.
 * @template T - The type of the resolved value
 */
interface ResolveWithValue<T> {
  [doneValue]: T;
}

/**
 * Options for waitFor timeout behavior.
 * @template T - The type of the fallback return value
 */
export interface WaitForTimeoutOptions<T> {
  /** Timeout duration in milliseconds */
  readonly ms: number;
  /** Optional fallback function to call on timeout */
  readonly fallback?: () => T | Promise<T>;
  /** Optional custom error message or Error object for timeout */
  readonly message?: string;
}

/**
 * Timeout option type - either a simple number or detailed options.
 * @template T - The type of the fallback return value
 */
export type TimeoutOption<T> = number | WaitForTimeoutOptions<T>;

/**
 * Options for asyncWaitFor function.
 * @template T - The type of the value to resolve with
 */
export interface WaitForOptions<T> {
  /** Interval between condition checks in milliseconds (default: 20) */
  readonly interval?: number;
  /** Timeout configuration - either milliseconds or detailed options */
  readonly timeout?: TimeoutOption<T>;
  /** Whether to check condition before first delay (default: true) */
  readonly before?: boolean;
  /** Optional abort signal for cancellation */
  readonly signal?: AbortSignal;
}

/**
 * Waits for a condition to become true, polling at specified intervals.
 *
 * @param condition - A function that returns true when the wait should end, or an object with doneValue
 * @param options - Wait options including interval, timeout, and abort signal
 * @throws {ParameterError} If interval or timeout values are invalid
 * @throws {DOMException} With 'TimeoutError' if timeout occurs, or 'AbortError' if cancelled
 */
export async function asyncWaitFor(
  condition: () => boolean | Promise<boolean>,
  options?: WaitForOptions<void>,
): Promise<void>;

/**
 * Waits for a condition to resolve with a specific value.
 *
 * @template T - The type of the value to resolve with
 * @param condition - A function that returns true, false, or an object with doneValue
 * @param options - Wait options including interval, timeout, and abort signal
 * @returns The value from doneValue if condition returns one, otherwise undefined
 * @throws {ParameterError} If interval or timeout values are invalid, or condition returns invalid type
 * @throws {DOMException} With 'TimeoutError' if timeout occurs, or 'AbortError' if cancelled
 */
export async function asyncWaitFor<T>(
  condition: () =>
    | (boolean | ResolveWithValue<T>)
    | Promise<boolean | ResolveWithValue<T>>,
  options?: WaitForOptions<T>,
): Promise<T>;

export async function asyncWaitFor<T = void>(
  condition: () =>
    | (boolean | ResolveWithValue<T>)
    | Promise<boolean | ResolveWithValue<T>>,
  options: WaitForOptions<T> = {},
): Promise<T | void> {
  const {
    interval = 20,
    timeout = Number.POSITIVE_INFINITY,
    before = true,
    signal,
  } = options;

  // 参数校验
  if (!Number.isFinite(interval) || interval < 0)
    throw new ParameterError(
      'asyncWaitFor: Expected `interval` to be a finite non-negative number',
    );

  const timeout_ms =
    typeof timeout === 'number'
      ? timeout
      : (timeout?.ms ?? Number.POSITIVE_INFINITY);

  if (Number.isNaN(timeout_ms) || timeout_ms < 0)
    throw new ParameterError(
      'asyncWaitFor: Expected `timeout` to be a non-negative number',
    );

  // 校验 abort signal
  if (signal?.aborted) throw ensureDOMException(signal.reason);

  // -- 构建超时 signal --
  const timeout_signal =
    timeout_ms === Number.POSITIVE_INFINITY
      ? undefined
      : AbortSignal.timeout(timeout_ms);

  // 合并外部 signal 和 timeout signal
  const combined_signal =
    timeout_signal && signal
      ? AbortSignal.any([timeout_signal, signal])
      : (timeout_signal ?? signal);

  // -- 处理超时/中断错误 --
  const handleAbortError = (): T | Promise<T> => {
    if (timeout_signal?.aborted) {
      const fallback =
        typeof timeout === 'object' ? timeout.fallback : undefined;
      if (fallback) return fallback();
      throw new DOMException(
        typeof timeout === 'object' && timeout.message
          ? timeout.message
          : `Promise timed out after ${timeout_ms}ms`,
        'TimeoutError',
      );
    }
    throw ensureDOMException(combined_signal!.reason);
  };

  // 如果 before 为 false，先延迟再检查条件
  if (!before) {
    const delay_result = await delaySafe(interval, combined_signal);
    if (delay_result !== undefined) return handleAbortError();
  }

  // ------ 主循环 ------
  while (true) {
    let condition_result;
    try {
      condition_result = await condition();
    } catch (error) {
      // 如果 condition 内部因为 signal 而抛出，按中断处理
      if (error === combined_signal?.reason) return handleAbortError();
      throw error;
    }

    // 检查是否返回了 doneValue（表示已完成并返回特定值）
    if (
      typeof condition_result === 'object' &&
      condition_result !== null &&
      doneValue in condition_result
    ) {
      return condition_result[doneValue];
    }

    // 条件满足，返回 void
    if (condition_result === true) {
      return undefined;
    }

    // 条件不满足，等待 interval 后继续检查
    if (condition_result === false) {
      const delay_result = await delaySafe(interval, combined_signal);
      if (delay_result !== undefined) return handleAbortError();
      continue;
    }

    throw new ParameterError(
      'asyncWaitFor: Expected condition to return a boolean',
    );
  }
}

/**
 * Creates a special return value for asyncWaitFor condition function.
 * When the condition function returns this object, asyncWaitFor will
 * resolve with the provided value instead of void.
 *
 * @template T - The type of the value to resolve with
 * @param value - The value to resolve with
 * @returns An object that signals asyncWaitFor to resolve with the given value
 */
asyncWaitFor.done = <T>(value: T): ResolveWithValue<T> => {
  return {[doneValue]: value};
};


