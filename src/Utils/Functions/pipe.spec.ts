// ========================================
// ./__tests__/Utils/Functions/pipe.spec.ts
// ========================================
/* eslint-disable @typescript-eslint/require-await */

import {describe, it, expect} from 'vitest';
import {isPromiseLike} from '../../helper';

// 导入所有导出的函数和类型
import {run, pipe, runAsync, pipeAsync} from './pipe';

// --- 辅助函数 ---
const delay = <T>(value: T, ms = 10): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

// --- 同步函数 ---
const sync_add_one = (x: number) => x + 1;
const sync_to_string = (x: number) => `Value: ${x}`;
const sync_initial_fn = (a: number, b: number) => a + b;
const sync_throw = (x: number) => {
  throw new Error(`Sync Throw at ${x}`);
};
const sync_div_five = (x: number) => x / 5;

// --- 异步函数 ---
const async_add_two = (x: number) => delay(x + 2, 5);
const async_mul_ten = (x: number) => x * 10; // 返回同步值的异步函数类型
const async_error = (x: number) =>
  Promise.reject(new Error(`Async Reject at ${x}`));
const async_initial_fn = (a: number, b: number) => delay(a * b, 5);

// ========================================
// 运行时测试：同步 (run / pipe)
// ========================================
describe.concurrent('A. Runtime: Sync Operators (run, pipe)', () => {
  // --- run ---
  it('run should execute a full sync chain correctly', () => {
    const result = run(10, sync_add_one, sync_to_string);
    expect(result).toBe('Value: 11');
  });

  it('run should handle an empty function array (though types limit this)', () => {
    const fns = [sync_add_one] as const;
    const result = run(10, ...fns);
    expect(result).toBe(11);
  });

  it('run should propagate exceptions', () => {
    expect(() => run(10, sync_add_one, sync_throw)).toThrow('Sync Throw at 11');
  });

  // --- pipe ---
  it('pipe() should return the identity function', () => {
    const piped_fn = pipe();
    expect(piped_fn(42)).toBe(42);
  });

  it('pipe should execute a full sync chain correctly', () => {
    const piped_fn = pipe(sync_initial_fn, sync_add_one, sync_to_string);
    // (1, 2) -> 3 -> 4 -> 'Value: 4'
    const result = piped_fn(1, 2);
    expect(result).toBe('Value: 4');
  });

  it('pipe should propagate exceptions in the chain', () => {
    const piped_fn = pipe(sync_initial_fn, sync_throw);
    expect(() => piped_fn(10, 2)).toThrow('Sync Throw at 12');
  });
});

// ========================================
// 运行时测试：异步 (runAsync / pipeAsync)
// ========================================
describe.concurrent('B. Runtime: Async Operators (runAsync, pipeAsync)', () => {
  // --- runAsync ---
  it('runAsync: All Sync -> return sync value', async () => {
    const result = runAsync(10, async_mul_ten, sync_to_string);
    expect(isPromiseLike(result)).toBe(false); // 预期不返回 Promise
    expect(result).toBe('Value: 100');
  });

  it('runAsync: First func is Async -> returns Promise', async () => {
    const result = runAsync(10, async_add_two, async_mul_ten);
    expect(isPromiseLike(result)).toBe(true);
    // 10 -> 12 (async) -> 120 (sync)
    await expect(result).resolves.toBe(120);
  });

  it('runAsync: Sync chain with Async switch in the middle', async () => {
    // [sync, async, sync]
    const result = runAsync(
      10,
      sync_add_one, // 10 -> 11 (sync)
      async_add_two, // 11 -> 13 (async, triggers takeover)
      async_mul_ten, // 13 -> 130 (async takeover)
    );
    expect(isPromiseLike(result)).toBe(true);
    await expect(result).resolves.toBe(130);
  });

  it('runAsync: All Async', async () => {
    const result = runAsync(10, async_add_two, async_add_two, async_add_two);
    await expect(result).resolves.toBe(16);
  });

  it('runAsync: handle async rejection', async () => {
    const result = runAsync(10, async_add_two, async_error);
    await expect(result).rejects.toThrow('Async Reject at 12');
  });

  it('runAsync: Async takeover followed by a Sync then an Async', async () => {
    // [sync (10), async (11->13), sync-but-async-typed (13->2.6), async (2.6->4.6)]
    const result = runAsync(
      10,
      sync_add_one, // 1. 10 -> 11 (sync)
      async_add_two, // 2. 11 -> Promise<13> (async, triggers takeover)
      sync_div_five, // 3. 接管中：await 13 -> 13。执行：13 -> 2.6 (sync)
      async_add_two, // 4. 接管中：2.6 -> Promise<4.6> (async)
    );
    expect(isPromiseLike(result)).toBe(true);
    await expect(result).resolves.toBeCloseTo(4.6);
  });

  // --- pipeAsync ---
  it('pipeAsync(): should return the identity function', () => {
    const piped_fn = pipeAsync();
    expect(piped_fn(42)).toBe(42);
  });

  it('pipeAsync: All Sync -> returns sync function', () => {
    const piped_fn = pipeAsync(sync_initial_fn, sync_add_one, sync_to_string);
    const result = piped_fn(1, 2);
    expect(isPromiseLike(result)).toBe(false);
    expect(result).toBe('Value: 4');
  });

  it('pipeAsync: First func is Async -> returns Promise', async () => {
    const piped_fn = pipeAsync(
      async_initial_fn, // (1, 2) -> 2 (async)
      async_add_two, // 2 -> 4 (async)
      async_mul_ten, // 4 -> 40 (sync, but in async context)
    );
    const result = piped_fn(1, 2);
    expect(isPromiseLike(result)).toBe(true);
    await expect(result).resolves.toBe(40);
  });

  it('pipeAsync: Sync start with Async switch in the middle', async () => {
    const piped_fn = pipeAsync(
      sync_initial_fn, // (1, 2) -> 3 (sync)
      sync_add_one, // 3 -> 4 (sync)
      async_add_two, // 4 -> 6 (async, triggers takeover)
      async_mul_ten, // 6 -> 60 (async takeover)
    );
    const result = piped_fn(1, 2);
    expect(isPromiseLike(result)).toBe(true);
    await expect(result).resolves.toBe(60);
  });

  it('pipeAsync: handle async rejection', async () => {
    const piped_fn = pipeAsync(
      sync_initial_fn,
      async_error, // Rejects here
    );
    const result = piped_fn(10, 2);
    await expect(result).rejects.toThrow('Async Reject at 12');
  });

  it('pipeAsync: Sync start, Async switch, then Sync/Async/Sync', async () => {
    const piped_fn = pipeAsync(
      sync_initial_fn, // 1. (1, 2) -> 3 (sync)
      async_add_two, // 2. 3 -> Promise<5> (async, triggers takeover)
      sync_div_five, // 3. 接管中：await 5 -> 5。执行：5 -> 1 (sync)
      async_mul_ten, // 4. 接管中：1 -> 10 (sync)
      async_add_two, // 5. 接管中：10 -> Promise<12> (async)
    );
    const result = piped_fn(1, 2);
    expect(isPromiseLike(result)).toBe(true);
    await expect(result).resolves.toBe(12);
  });
});
