// ============================================
// ./src/Reactive/flow-combination.ts
// ============================================

import {noop} from 'src/Utils/Functions/base';
import {Flow, fromProducer, type Observer, type Unsubscribable} from './flow';

type FlowInputValue<T> = T extends FlowInput<infer R> ? R : never;
type FlowInputTuple<T extends readonly FlowInput<unknown>[]> = {
  [K in keyof T]: FlowInputValue<T[K]>;
};
type PrependTuple<T, R extends readonly unknown[]> = [T, ...R];

interface FlowInput<T> {
  subscribe(observer: Observer<T>): Unsubscribable;
}

/**
 * Merges multiple Flow sources into a single Flow that emits values
 * from all sources concurrently. Completes when all sources complete.
 * @template T The value type emitted by the sources
 * @param sources Flow sources to merge
 * @returns A Flow emitting values from all sources as they arrive
 */
export function mergeFlow<T>(
  ...sources: [FlowInput<T>, ...FlowInput<T>[]]
): Flow<T> {
  return fromProducer((dest) => {
    // -- 追踪完成状态 --
    let completedCount = 0;
    const subscriptions: Unsubscribable[] = [];

    sources.forEach((source) => {
      const sub = source.subscribe({
        next: (v) => dest.next(v),
        error: (err) => dest.error(err),
        complete: () => {
          completedCount++;
          // 所有源都完成后，才完成目标流
          if (completedCount === sources.length) {
            dest.complete();
          }
        },
      });
      subscriptions.push(sub);
    });

    // 取消订阅时，清理所有子订阅
    return () => subscriptions.forEach((sub) => sub.unsubscribe());
  });
}

/**
 * Concatenates multiple Flow sources sequentially, subscribing to each
 * source only after the previous one completes.
 * @template T The value type emitted by the sources
 * @param sources Flow sources to concatenate
 * @returns A Flow emitting values from each source in order
 */
export function concatFlow<T>(
  ...sources: [FlowInput<T>, ...FlowInput<T>[]]
): Flow<T> {
  return fromProducer((dest) => {
    let index = 0;
    let currentSub: Unsubscribable | null = null;

    // 顺序订阅下一个源
    const subscribeNext = () => {
      // 所有源都已处理完毕
      if (index >= sources.length) {
        dest.complete();
        return;
      }

      const source = sources[index++];
      currentSub = source.subscribe({
        next: (v) => dest.next(v),
        error: (err) => dest.error(err),
        // 当前源完成后，继续订阅下一个
        complete: () => {
          subscribeNext();
        },
      });
    };

    subscribeNext();

    return () => currentSub?.unsubscribe();
  });
}

/**
 * Races multiple Flow sources, emitting the first value, error, or completion
 * from any source and immediately unsubscribing from all others.
 * @template T The value type emitted by the sources
 * @param sources Flow sources to race
 * @returns A Flow mirroring the first source to emit
 */
export function raceFlow<T>(
  ...sources: [FlowInput<T>, ...FlowInput<T>[]]
): Flow<T> {
  return fromProducer((dest) => {
    const subscriptions: Unsubscribable[] = [];
    let finished = false;

    // 取消所有订阅并标记完成
    const unsubscribeAll = () => {
      finished = true;
      subscriptions.forEach((sub) => sub.unsubscribe());
    };

    sources.forEach((source) => {
      const sub = source.subscribe({
        // 第一个发射的值胜出
        next: (v) => {
          if (finished) return;
          unsubscribeAll();
          dest.next(v);
          dest.complete();
        },
        // 第一个错误胜出
        error: (err) => {
          if (finished) return;
          unsubscribeAll();
          dest.error(err);
        },
        // 第一个完成胜出
        complete: () => {
          if (finished) return;
          unsubscribeAll();
          dest.complete();
        },
      });
      subscriptions.push(sub);
    });

    return unsubscribeAll;
  });
}

/**
 * Combines multiple Flow sources to emit tuples of the latest values
 * from all sources whenever any source emits. Waits for all sources
 * to emit at least once before emitting.
 * @template T A tuple type of Flow sources
 * @param sources Flow sources to combine
 * @returns A Flow emitting tuples of the latest values from all sources
 */
export function combineLatestFlow<
  T extends readonly [FlowInput<unknown>, ...FlowInput<unknown>[]],
>(...sources: T): Flow<FlowInputTuple<T>> {
  return fromProducer((dest) => {
    const subscriptions: Unsubscribable[] = [];
    // 存储每个源的最新值
    const values = new Array<FlowInputValue<T[number]>>(sources.length);
    // 标记每个源是否已发射过值
    const hasValue = new Array<boolean>(sources.length).fill(false);
    let hasValueCount = 0;
    let completedCount = 0;

    sources.forEach((source, i) => {
      values[i] = undefined as FlowInputValue<T[number]>;

      const sub = source.subscribe({
        next: (v) => {
          values[i] = v as FlowInputValue<T[number]>;
          // 首次收到该源的值
          if (!hasValue[i]) {
            hasValue[i] = true;
            hasValueCount++;
          }

          // 所有源都至少发射过一次值后，才发射组合值
          if (hasValueCount === sources.length) {
            dest.next([...values] as FlowInputTuple<T>);
          }
        },
        error: (err) => dest.error(err),
        complete: () => {
          completedCount++;
          if (completedCount === sources.length) {
            dest.complete();
          }
        },
      });
      subscriptions.push(sub);
    });

    return () => subscriptions.forEach((s) => s.unsubscribe());
  });
}

/**
 * Combines a source Flow with other Flows, emitting a tuple of the source value
 * and the latest values from other sources whenever the source emits.
 * Waits for all other sources to emit at least once.
 * @template T The value type emitted by the main source
 * @template R A tuple type of other Flow sources
 * @param source The main Flow that triggers emissions
 * @param others Other Flow sources to combine with
 * @returns A Flow emitting tuples with the source value prepended to other values
 */
export function withLatestFromFlow<
  T,
  R extends readonly [FlowInput<unknown>, ...FlowInput<unknown>[]],
>(
  source: FlowInput<T>,
  ...others: R
): Flow<PrependTuple<T, FlowInputTuple<R>>> {
  return fromProducer((dest) => {
    // 存储其他源的最新值
    const otherValues = new Array<FlowInputValue<R[number]>>(others.length);
    const hasOthersValue = new Array<boolean>(others.length).fill(false);
    let hasOthersValueCount = 0;
    const subs: Unsubscribable[] = [];

    // 先订阅其他源，持续收集它们的最新值
    others.forEach((other, i) => {
      otherValues[i] = undefined as FlowInputValue<R[number]>;
      const sub = other.subscribe({
        next: (v) => {
          otherValues[i] = v as FlowInputValue<R[number]>;
          if (!hasOthersValue[i]) {
            hasOthersValue[i] = true;
            hasOthersValueCount++;
          }
        },
        error: (err) => dest.error(err),
        // 其他源完成不影响主源的行为
        complete: noop,
      });
      subs.push(sub);
    });

    // 订阅主源，每次发射时组合其他源的最新值
    const mainSub = source.subscribe({
      next: (v) => {
        // 确保所有其他源都已发射过值
        if (hasOthersValueCount === others.length) {
          dest.next([v, ...otherValues] as unknown as PrependTuple<
            T,
            FlowInputTuple<R>
          >);
        }
      },
      error: (err) => dest.error(err),
      complete: () => dest.complete(),
    });
    subs.push(mainSub);

    return () => subs.forEach((s) => s.unsubscribe());
  });
}

/**
 * Waits for all Flow sources to complete, then emits a tuple of their last values.
 * Emits once when all sources complete. Completes without emitting if any
 * source completes without emitting.
 * @template T A tuple type of Flow sources
 * @param sources Flow sources to join
 * @returns A Flow emitting a single tuple of last values when all sources complete
 */
export function forkJoinFlow<
  T extends readonly [FlowInput<unknown>, ...FlowInput<unknown>[]],
>(...sources: T): Flow<FlowInputTuple<T>> {
  return fromProducer((dest) => {
    // 存储每个源的最后值
    const lastValues = new Array<FlowInputValue<T[number]>>(sources.length);
    const hasEmitted = new Array<boolean>(sources.length).fill(false);
    let completedCount = 0;
    const subs: Unsubscribable[] = [];

    sources.forEach((source, i) => {
      const sub = source.subscribe({
        // 只记录最后收到的值，不立即发射
        next: (v) => {
          lastValues[i] = v as FlowInputValue<T[number]>;
          hasEmitted[i] = true;
        },
        error: (err) => dest.error(err),
        complete: () => {
          completedCount++;
          // 如果有源完成但从未发射值，则不发射任何值直接完成
          if (!hasEmitted[i]) {
            dest.complete();
            return;
          }

          // 所有源都完成后，发射所有最后值的元组
          if (completedCount === sources.length) {
            dest.next([...lastValues] as FlowInputTuple<T>);
            dest.complete();
          }
        },
      });
      subs.push(sub);
    });

    return () => subs.forEach((s) => s.unsubscribe());
  });
}

/**
 * Zips multiple Flow sources by index, emitting tuples containing the nth
 * value from each source. Completes when any source completes and its
 * buffer is empty.
 * @template T A tuple type of Flow sources
 * @param sources Flow sources to zip
 * @returns A Flow emitting tuples of values at the same index from each source
 */
export function zipFlow<
  T extends readonly [FlowInput<unknown>, ...FlowInput<unknown>[]],
>(
  ...sources: T
): Flow<{[K in keyof T]: T[K] extends FlowInput<infer R> ? R : never}> {
  return fromProducer((dest) => {
    // 每个源的值缓冲区
    const buffers: unknown[][] = sources.map(() => []);
    // 标记每个源是否已完成
    const doneFlags: boolean[] = sources.map(() => false);
    // 已准备好（缓冲区非空）的源数量
    let readyCount = 0;
    // 已耗尽（完成且缓冲区空）的源数量
    let deadSourceCount = 0;
    const subs: Unsubscribable[] = [];

    // 尝试消费缓冲区中的值
    const tryConsume = () => {
      // 当所有源都有值时，按索引配对发射
      while (readyCount === sources.length) {
        const tuple = buffers.map((buf) => buf.shift()!);
        dest.next(
          tuple as {
            [K in keyof T]: T[K] extends FlowInput<infer R> ? R : never;
          },
        );

        // 重新计算就绪数量
        let newReadyCount = 0;
        for (let i = 0; i < buffers.length; i++) {
          if (buffers[i].length > 0) newReadyCount++;
          else if (doneFlags[i]) {
            // 缓冲区空且源已完成，该源已耗尽
            deadSourceCount++;
          }
        }
        readyCount = newReadyCount;

        // 有源耗尽时，整个 zip 完成
        if (deadSourceCount > 0) {
          dest.complete();
          return;
        }
      }
    };

    sources.forEach((source, i) => {
      if (dest.closed) return;

      const sub = source.subscribe({
        next: (v) => {
          const wasEmpty = buffers[i].length === 0;
          buffers[i].push(v);
          // 缓冲区从空变非空，增加就绪计数
          if (wasEmpty) readyCount++;
          tryConsume();
        },
        error: (err) => dest.error(err),
        complete: () => {
          doneFlags[i] = true;
          // 源完成且缓冲区空，标记为耗尽
          if (buffers[i].length === 0) {
            deadSourceCount++;
            dest.complete();
          }
        },
      });
      subs.push(sub);
    });

    return () => subs.forEach((s) => s.unsubscribe());
  });
}
