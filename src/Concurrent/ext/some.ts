// ========================================
// ./src/Concurrent/ext/some.ts
// ========================================

import {ParameterError} from 'src/Errors';
import {dynamicAwait} from 'src/helper';
import {ensureDOMException} from 'src/unknown-error';
import type {MaybePromise} from 'src/Utils/type-tool';

interface EveryOptions {
  readonly concurrency?: number;
  readonly signal?: AbortSignal;
}

/**
 * Tests whether all elements in the iterable pass the test implemented by the provided predicate.
 * Executes predicates concurrently with a configurable concurrency limit.
 *
 * Short-circuits immediately when any predicate returns `false` or throws.
 *
 * @template T - The type of elements in the iterable
 * @param iterable - An iterable of promises resolving to values
 * @param predicate - A function to test each element
 * @param options - Configuration options
 * @returns `true` if all elements pass the predicate, `false` otherwise
 * @throws {ParameterError} If concurrency is invalid
 * @throws {DOMException} If the abort signal is triggered
 */
export async function asyncEvery<T>(
  iterable: Iterable<Promise<T>>,
  predicate: (value: T, index: number) => MaybePromise<boolean>,
  options: EveryOptions = {},
): Promise<boolean> {
  const {concurrency = Number.POSITIVE_INFINITY, signal} = options;

  // -- 参数校验 --
  if (
    concurrency < 1 ||
    (!Number.isInteger(concurrency) && concurrency !== Number.POSITIVE_INFINITY)
  ) {
    throw new ParameterError(`asyncEvery: Invalid concurrency ${concurrency}`);
  }
  if (signal?.aborted) throw ensureDOMException(signal.reason);

  const elements = Array.isArray(iterable)
    ? (iterable as Promise<T>[])
    : [...iterable];
  if (elements.length === 0) return true;

  let is_short_circuited = false;
  let next_index = 0;

  // -- Worker：并发执行 predicate，支持短路 --
  const worker = async (): Promise<void> => {
    while (next_index < elements.length && !is_short_circuited) {
      if (signal?.aborted) throw ensureDOMException(signal.reason);

      const currentIndex = next_index++;
      const value = await elements[currentIndex];

      // 双重检查：await 期间可能已被其他 worker 短路或取消
      if (is_short_circuited || signal?.aborted) return;

      const result = await dynamicAwait(predicate(value, currentIndex));

      if (!result) {
        is_short_circuited = true;
        return;
      }
    }
  };

  // -- 启动并发池 --
  const pool_size = Math.min(concurrency, elements.length);
  const workers = Array.from({length: pool_size}, worker);

  try {
    await Promise.all(workers);
    if (signal?.aborted) throw ensureDOMException(signal.reason);
    return !is_short_circuited;
  } catch (error) {
    is_short_circuited = true;
    throw error;
  }
}

interface SomeOptions<T> {
  readonly count?: number;
  readonly concurrency?: number;
  readonly filter?: (value: T) => MaybePromise<boolean>;
  readonly signal?: AbortSignal;
}

/**
 * Collects elements that satisfy the filter predicate until the specified count is reached.
 * Executes filters concurrently with a configurable concurrency limit.
 *
 * Short-circuits immediately when enough elements are found.
 *
 * @template T - The type of elements in the iterable
 * @param iterable - An iterable of promises resolving to values
 * @param options - Configuration options including count, concurrency, filter, and abort signal
 * @returns An array of elements that passed the filter, with length equal to `count`
 * @throws {ParameterError} If count or concurrency is invalid
 * @throws {RangeError} If the iterable contains fewer elements than `count`
 * @throws {AggregateError} If insufficient elements pass the filter
 * @throws {DOMException} If the abort signal is triggered
 */
export async function asyncSome<T>(
  iterable: Iterable<Promise<T>>,
  options: SomeOptions<T>,
): Promise<T[]> {
  const {
    count = 1,
    concurrency = Number.POSITIVE_INFINITY,
    filter = () => true,
    signal,
  } = options;

  // -- 参数校验 --
  if (count < 1 || !Number.isInteger(count))
    throw new ParameterError(`asyncSome: Invalid count ${count}`);

  if (
    concurrency < 1 ||
    (!Number.isInteger(concurrency) && concurrency !== Number.POSITIVE_INFINITY)
  )
    throw new ParameterError(`asyncSome: Invalid concurrency ${concurrency}`);

  if (signal?.aborted) throw ensureDOMException(signal.reason);

  const elements = Array.isArray(iterable)
    ? (iterable as Promise<T>[])
    : [...iterable];

  // 前置边界检查：总数不足时直接失败，避免无意义的并发执行
  if (elements.length < count) {
    throw new RangeError(
      `asyncSome: Expected at least ${count} items, but only ${elements.length} provided`,
    );
  }

  const results: T[] = [];
  const errors: unknown[] = [];
  let is_finished = false;
  let next_index = 0;
  let pending_count = elements.length;

  // -- Worker：并发过滤，收集满足条件的元素 --
  const worker = async (): Promise<void> => {
    while (next_index < elements.length && !is_finished) {
      if (signal?.aborted) throw ensureDOMException(signal.reason);

      const current_index = next_index++;

      try {
        const value = await elements[current_index];
        if (is_finished || signal?.aborted) return;

        const is_included = await dynamicAwait(filter(value));

        if (is_included && !is_finished) {
          results.push(value);
          // 达到目标数量，触发全局短路
          if (results.length === count) {
            is_finished = true;
            return;
          }
        }
      } catch (error) {
        if (!is_finished) errors.push(error);
      } finally {
        pending_count--;

        // 可行性检查：剩余任务数 + 已收集结果 < 目标数，则不可能完成
        if (!is_finished && pending_count + results.length < count) {
          is_finished = true;
        }
      }
    }
  };

  // -- 启动并发池 --
  const pool_size = Math.min(concurrency, elements.length);
  const workers = Array.from({length: pool_size}, worker);

  try {
    await Promise.all(workers);

    if (signal?.aborted) throw ensureDOMException(signal.reason);

    if (results.length === count) return results;

    // 未达目标，抛出收集到的错误信息
    throw new AggregateError(
      errors,
      `asyncSome: Could not collect ${count} valid values`,
    );
  } catch (error) {
    is_finished = true;
    throw error;
  }
}

interface AnyOptions<T> {
  readonly concurrency?: number;
  readonly filter?: (value: T) => MaybePromise<boolean>;
  readonly signal?: AbortSignal;
}

/**
 * Returns the first element that satisfies the filter predicate.
 * Executes filters concurrently with a configurable concurrency limit.
 *
 * Short-circuits immediately when a matching element is found.
 * Similar to Promise.any but with support for filtering and concurrency control.
 *
 * @template T - The type of elements in the iterable
 * @param iterable - An iterable of promises resolving to values
 * @param options - Configuration options including concurrency, filter, and abort signal
 * @returns The first element that passed the filter
 * @throws {ParameterError} If concurrency is invalid
 * @throws {AggregateError} If no elements pass the filter or all promises reject
 * @throws {DOMException} If the abort signal is triggered
 */
export async function asyncAny<T>(
  iterable: Iterable<Promise<T>>,
  options: AnyOptions<T> = {},
): Promise<T> {
  const {
    concurrency = Number.POSITIVE_INFINITY,
    filter = () => true,
    signal,
  } = options;

  // -- 参数校验 --
  if (
    concurrency < 1 ||
    (!Number.isInteger(concurrency) && concurrency !== Number.POSITIVE_INFINITY)
  ) {
    throw new ParameterError(`asyncAny: Invalid concurrency ${concurrency}`);
  }
  if (signal?.aborted) throw ensureDOMException(signal.reason);

  const elements = Array.isArray(iterable)
    ? (iterable as Promise<T>[])
    : [...iterable];

  if (elements.length === 0) {
    throw new AggregateError([], 'asyncAny: No elements provided');
  }

  const errors: unknown[] = [];
  let is_finished = false;
  let next_index = 0;
  let pending_count = elements.length;
  let result_value: T | undefined;
  let has_result = false;

  // -- Worker：并发过滤，寻找第一个满足条件的元素 --
  const worker = async (): Promise<void> => {
    while (next_index < elements.length && !is_finished) {
      if (signal?.aborted) throw ensureDOMException(signal.reason);

      const current_index = next_index++;

      try {
        const value = await elements[current_index];
        if (is_finished || signal?.aborted) return;

        const is_included = await dynamicAwait(filter(value));

        if (is_included && !is_finished) {
          result_value = value;
          has_result = true;
          is_finished = true;
          return;
        }
      } catch (error) {
        if (!is_finished) errors.push(error);
      } finally {
        pending_count--;

        // 可行性检查：如果所有任务都完成了还没有结果，则结束
        if (!is_finished && pending_count === 0) {
          is_finished = true;
        }
      }
    }
  };

  // -- 启动并发池 --
  const pool_size = Math.min(concurrency, elements.length);
  const workers = Array.from({length: pool_size}, worker);

  try {
    await Promise.all(workers);

    if (signal?.aborted) throw ensureDOMException(signal.reason);

    if (has_result) return result_value as T;

    // 没有找到任何满足条件的元素
    throw new AggregateError(
      errors.length > 0 ? errors : [],
      'asyncAny: No elements passed the filter',
    );
  } catch (error) {
    is_finished = true;
    throw error;
  }
}
