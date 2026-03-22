// ========================================
// ./src/Concurrent/delay.ts
// ========================================
import {ensureDOMException} from '../unknown-error';

/**
 * Delays the execution for a specified number of milliseconds.
 * @param ms - The duration to wait in milliseconds.
 * @param signal - An optional `AbortSignal` to cancel the delay.
 * If the signal is aborted, the promise rejects with a `DOMException`.
 * @returns A promise that resolves after the timeout or rejects if aborted.
 * @example
 * ```ts
 * try {
 * await delay(1000, controller.signal);
 * } catch (err) {
 * console.error("Delayed action was cancelled!");
 * }
 * ```
 */
export function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(ensureDOMException(signal.reason));

    const timeoutId = setTimeout(() => {
      signal?.removeEventListener('abort', abortHandler);
      resolve();
    }, ms);

    function abortHandler() {
      clearTimeout(timeoutId);
      reject(ensureDOMException(signal?.reason));
    }

    signal?.addEventListener('abort', abortHandler, {once: true});
  });
}

/**
 * A safe version of the delay function that never rejects.
 * Instead of rejecting on abort, it resolves with a DOMException.
 * @param ms - The duration to wait in milliseconds.
 * @param signal - An optional `AbortSignal` to cancel the delay.
 * If the signal is aborted, the promise resolves with a `DOMException` instead of rejecting.
 * @returns A promise that resolves after the timeout or resolves with a DOMException if aborted.
 * This is useful when you want to handle abort conditions without try-catch blocks.
 * @example
 * ```ts
 * const result = await delaySafe(1000, controller.signal);
 * if (result instanceof DOMException) {
 *   console.log("Delay was aborted:", result.message);
 * } else {
 *   console.log("Delay completed successfully");
 * }
 * ```
 */
export function delaySafe(
  ms: number,
  signal?: AbortSignal,
): Promise<undefined | DOMException> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve(ensureDOMException(signal.reason));

    const timeoutId = setTimeout(() => {
      signal?.removeEventListener('abort', abortHandler);
      resolve(undefined);
    }, ms);

    function abortHandler() {
      clearTimeout(timeoutId);
      resolve(ensureDOMException(signal?.reason));
    }

    signal?.addEventListener('abort', abortHandler, {once: true});
  });
}

/**
 * A simplified, non-cancelable version of {@link delay}.
 * Useful for basic pauses where abort logic is not required.
 * @param ms - The duration to sleep in milliseconds.
 * @returns A promise that resolves after the timeout.
 */
export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));
