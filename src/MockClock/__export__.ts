// ========================================
// ./src/MockClock/MockClock.ts
// ========================================

export {
  MockTimerHandle,
  NativeTimerHandle,
  NativeImmedHandle,
} from './TimerHandle';
export {DEFAULT_CONFIG} from './types';
export {type Timeline} from './Timeline';

import {VirtualTimeManager} from './VirtualTimeManager';
import type {MaybePromise} from '../Utils/type-tool';
import type {ClockOpts} from './types';
import {type TimelinePublic} from './Timeline';

/**
 * Creates a virtual timeline for mocking time-based APIs.
 *
 * @param options - Configuration options for the mock clock
 * @returns A new Timeline instance
 *
 * @example
 * ```ts
 * const clock = MockClock();
 * runTimeline(clock, () => {
 *   // Your test code here
 * });
 * ```
 */
export const MockClock = (options?: ClockOpts) =>
  VirtualTimeManager.getInstance().createFork(options) as TimelinePublic; // 用断言来保证封装

/**
 * Runs a callback within a virtual timeline context.
 *
 * @param fork - The Timeline instance to with
 * @param callback - The function to execute within the timeline context
 *
 * @example
 * ```ts
 * const clock = MockClock();
 * runTimeline(clock, () => {
 *   setTimeout(() => console.log('Hello'), 1000);
 *   clock.tick(1000);
 * });
 * ```
 */
export const runTimeline = (
  fork: TimelinePublic,
  callback: () => MaybePromise<void>,
) => VirtualTimeManager.getInstance().run(fork, callback);

/**
 * Asynchronously runs a callback within a virtual timeline context.
 *
 * @param fork - The Timeline instance to with
 * @param callback - The async function to execute within the timeline context
 * @returns A Promise that resolves when the callback completes
 *
 * @example
 * ```ts
 * const clock = MockClock();
 * await runTimelineAsync(clock, async () => {
 *   await someAsyncOperation();
 *   clock.tick(1000);
 * });
 * ```
 */
export const runTimelineAsync = async (
  fork: TimelinePublic,
  callback: () => MaybePromise<void>,
): Promise<void> => VirtualTimeManager.getInstance().runAsync(fork, callback);

/**
 * Runs a callback within a virtual timeline and automatically cleans up.
 *
 * @param fork - The Timeline instance to with
 * @param callback - The function to execute within the timeline context
 *
 * @example
 * ```ts
 * withTimeline(MockClock(), () => {
 *   setTimeout(() => console.log('Hello'), 1000);
 *   clock.tick(1000);
 * });
 * // Timeline is automatically destroyed after callback completes
 * ```
 */
export const withTimeline = (
  fork: TimelinePublic,
  callback: () => MaybePromise<void>,
): void => {
  try {
    runTimeline(fork, callback);
  } finally {
    fork.destroy();
  }
};

/**
 * Asynchronously runs a callback within a virtual timeline and cleans up.
 *
 * @param fork - The Timeline instance to with
 * @param callback - The async function to execute within the timeline context
 * @returns A Promise that resolves when the callback completes
 *
 * @example
 * ```ts
 * await withTimelineAsync(MockClock(), async () => {
 *   await someAsyncOperation();
 *   clock.tick(1000);
 * });
 * // Timeline is automatically destroyed after callback completes
 * ```
 */
export const withTimelineAsync = async (
  fork: TimelinePublic,
  callback: () => MaybePromise<void>,
): Promise<void> => {
  try {
    return await runTimelineAsync(fork, callback);
  } finally {
    fork.destroy();
  }
};

/**
 * Restores all global time-related APIs to their original implementations.
 *
 * @example
 * ```ts
 * afterAll(() => {
 *   restoreGlobals();
 * });
 * ```
 */
export const restoreGlobals = () => VirtualTimeManager.destroyInstance();

/**
 * Hijacks global time-related APIs to with the virtual timeline.
 *
 * @returns True if hijacking was successful, false if already hijacked
 */
export const hijackTimeGlobals = () => {
  // 已经劫持了，不需要重复
  if (VirtualTimeManager.hasInstance()) return false;
  VirtualTimeManager.getInstance();
  return true;
};
