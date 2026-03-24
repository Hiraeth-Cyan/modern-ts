// ========================================
// ./src/helper.ts
// ========================================

import {UnknownError} from './unknown-error';
import type {MaybePromise} from './Utils/type-tool';

/**
 * Checks if a value is a Promise-like object (i.e., "thenable").
 *
 * A value is considered Promise-like if it meets the following conditions:
 * 1. It is non-null.
 * 2. Its type is 'object' or 'function'.
 * 3. It possesses a property named 'then', and the value of this property is a function.
 * 4. Attempting to access the 'then' property does not throw an exception.
 *
 * This function also returns true when a native {@link Promise} instance is passed.
 *
 * @param value - The value to check.
 * @returns True if the value is Promise-like; otherwise, false.
 */
export const isPromiseLike = (
  value: unknown,
): value is PromiseLike<unknown> => {
  if (
    value == null ||
    (typeof value !== 'object' && typeof value !== 'function')
  )
    return false;
  const thenable = value as {then?: unknown};
  try {
    return typeof thenable.then === 'function';
  } catch (e) {
    return false;
  }
};

/**
 * Checks if a value conforms to the standard "Result object" structure (Result-like).
 *
 * A value is considered Result-like if it meets the following conditions:
 * 1. It is a non-null 'object' type.
 * 2. It must contain a boolean property 'ok'.
 * 3. In the success state (ok: true), it must contain the 'value' property and must not contain the 'error' property.
 * 4. In the failure state (ok: false), it must contain the 'error' property and must not contain the 'value' property.
 *
 * @param value - The value to check.
 * @returns True if the value conforms to the Result-like structure; otherwise, false.
 */
export const isResultLike = (
  value: unknown,
): value is {ok: boolean; value?: unknown; error?: unknown} =>
  // 快速排除非对象和 null
  typeof value !== 'object' || value === null
    ? false
    : (() => {
        const v = value as Record<string, unknown>;
        const ok = v.ok;
        if (typeof ok !== 'boolean') return false;
        return ok
          ? 'value' in v && !('error' in v)
          : 'error' in v && !('value' in v);
      })();

export const wrapError = (e: unknown) =>
  e instanceof DOMException && e.name === 'AbortError'
    ? e
    : UnknownError.from(e);

/**
 * Flushes all pending microtasks and macroscheduled tasks.
 *
 *
 * This utility is particularly useful in testing environments to ensure that all
 * asynchronous operations (like Promises or API calls) and their subsequent
 * DOM updates have been processed before making assertions.
 * It uses `MessageChannel` to bypass the 4ms minimum delay typically
 * associated with `setTimeout(fn, 0)` in browsers.
 * @returns {Promise<void>} A promise that resolves after the task queue is cleared.
 * @example
 * ```typescript
 * await flushPromises();
 * expect(wrapper.text()).toContain('Data Loaded');
 * ```
 */
/* v8 ignore next -- @preserve */
export const flushPromises = (): Promise<void> => {
  return new Promise((resolve) => queueMacroTask(resolve));
};

/**
 * Dynamically awaits a value based on whether it's PromiseLike or synchronous.
 * If the input is PromiseLike, it awaits the value; otherwise, returns the value directly.
 * @param value - The value to await or return synchronously
 * @returns A Promise containing the resolved value
 */
export const dynamicAwait = async <T>(value: MaybePromise<T>): Promise<T> =>
  isPromiseLike(value) ? await value : value;

/**
 * Queues a callback to be executed in the next macro task.
 *
 * This function provides an optimized way to schedule callbacks with minimal delay:
 * 1. In Node.js: Uses `setImmediate` (optimal performance).
 * 2. In modern browsers: Uses `MessageChannel` to bypass the 4ms minimum delay of `setTimeout`.
 * 3. Fallback: Uses `setTimeout(callback, 0)` for legacy environments.
 *
 * The implementation batches multiple callbacks into a single macro task to improve performance.
 *
 * @param callback - The function to execute in the next macro task.
 */
/* v8 ignore next -- @preserve */
export const queueMacroTask = (() => {
  // Node.js 优先使用 setImmediate，性能最优
  if (typeof setImmediate === 'function') return setImmediate;

  // 浏览器环境用 MessageChannel 模拟，性能优于 setTimeout（无4ms最小延迟）
  if (typeof MessageChannel !== 'undefined') {
    let queue: Array<() => void> = [];
    const channel = new MessageChannel();
    let is_pending = false;

    // 批量执行队列中的所有回调，避免多次触发宏任务
    const flush = () => {
      is_pending = false;
      const local_queue = queue;
      queue = [];
      for (let i = 0; i < local_queue.length; i++) local_queue[i]();
    };

    channel.port1.onmessage = flush;

    // 将回调加入队列，仅在队列为空时触发一次宏任务
    return (callback: VoidFunction) => {
      queue.push(callback);
      if (!is_pending) {
        is_pending = true;
        channel.port2.postMessage(null);
      }
    };
  }

  // 降级：老旧环境用 setTimeout，存在4ms最小延迟
  return (callback: VoidFunction) => setTimeout(callback, 0);
})();
