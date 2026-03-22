// ========================================
// ./src/Maybe/consumers-async.spec.ts
// ========================================
/* eslint-disable @typescript-eslint/require-await */
import {describe, it, expect, vi} from 'vitest';
import {
  matchAsync,
  ifSomeAsync,
  ifNoneAsync,
  peekAsync,
  peekNoneAsync,
  peekBothAsync,
} from './consumers-async';
import {isSome} from './base';

// ============================
// 测试辅助函数
// ============================
const delayed = <T>(value: T, ms = 10): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

const createController = () => {
  const controller = new AbortController();
  return {controller, signal: controller.signal};
};

// ============================
// matchAsync 测试
// ============================
describe.concurrent('matchAsync', () => {
  it('should call onSome with Some value', async () => {
    const onSome = vi.fn(async (x: number) => x * 2);
    const onNone = vi.fn(async () => 0);

    const result = await matchAsync(Promise.resolve(42), onSome, onNone);

    expect(onSome).toHaveBeenCalledWith(42, undefined);
    expect(onNone).not.toHaveBeenCalled();
    expect(result).toBe(84);
  });

  it('should call onNone with None value', async () => {
    const onSome = vi.fn(async (x: number) => x * 2);
    const onNone = vi.fn(async () => -1);

    const result = await matchAsync(Promise.resolve(null), onSome, onNone);

    expect(onSome).not.toHaveBeenCalled();
    expect(onNone).toHaveBeenCalledWith(undefined);
    expect(result).toBe(-1);
  });

  it('should respect AbortSignal', async () => {
    const {controller, signal} = createController();

    const onSome = vi.fn(async (x: number, s?: AbortSignal) => {
      s?.throwIfAborted();
      return x * 2;
    });
    const onNone = vi.fn(async (s?: AbortSignal) => {
      s?.throwIfAborted();
      return -1;
    });

    controller.abort('Aborted');

    await expect(
      matchAsync(Promise.resolve(42), onSome, onNone, signal),
    ).rejects.toThrow('Aborted');
  });
});

// ============================
// ifSomeAsync 测试
// ============================
describe.concurrent('ifSomeAsync', () => {
  it('should execute onSome when value is Some', async () => {
    const onSome = vi.fn(async (x: number) => `value: ${x}`);
    const onElse = vi.fn(async () => 'none');

    const result = await ifSomeAsync(Promise.resolve(42), onSome, onElse);

    expect(onSome).toHaveBeenCalledWith(42);
    expect(onElse).not.toHaveBeenCalled();
    expect(result).toBe('value: 42');
  });

  it('should execute onElse when value is None', async () => {
    const onSome = vi.fn(async (x: number) => `value: ${x}`);
    const onElse = vi.fn(async () => 'none');

    const result = await ifSomeAsync(Promise.resolve(null), onSome, onElse);

    expect(onSome).not.toHaveBeenCalled();
    expect(onElse).toHaveBeenCalled();
    expect(result).toBe('none');
  });

  it('should return void when no onElse provided', async () => {
    const onSome = vi.fn(async (x: number) => `value: ${x}`);

    const result = await ifSomeAsync(Promise.resolve(null), onSome);

    expect(result).toBeUndefined();
  });
});

// ============================
// ifNoneAsync 测试
// ============================
describe.concurrent('ifNoneAsync', () => {
  it('should return void when value is Some and no onElse provided', async () => {
    // 有值但没有提供 onElse，应该返回 void
    const onNone = vi.fn(async () => 'should not be called');

    const result = await ifNoneAsync(Promise.resolve(42), onNone);

    expect(onNone).not.toHaveBeenCalled();
    expect(result).toBeUndefined(); // 应该返回 undefined/void
  });

  it('should execute onNone when value is None', async () => {
    const onNone = vi.fn(async () => 'was none');
    const onElse = vi.fn(async (x: number) => `value: ${x}`);

    const result = await ifNoneAsync(Promise.resolve(null), onNone, onElse);

    expect(onNone).toHaveBeenCalled();
    expect(onElse).not.toHaveBeenCalled();
    expect(result).toBe('was none');
  });

  it('should execute onElse when value is Some', async () => {
    const onNone = vi.fn(async () => 'was none');
    const onElse = vi.fn(async (x: number) => `value: ${x}`);

    const result = await ifNoneAsync(Promise.resolve(42), onNone, onElse);

    expect(onNone).not.toHaveBeenCalled();
    expect(onElse).toHaveBeenCalledWith(42);
    expect(result).toBe('value: 42');
  });
});

// ============================
// peekAsync 测试
// ============================
describe.concurrent('peekAsync', () => {
  it('should call fn with Some value and return original', async () => {
    const fn = vi.fn(async () => {
      await delayed(undefined);
    });

    const result = await peekAsync(Promise.resolve(42), fn);

    expect(fn).toHaveBeenCalledWith(42, undefined);
    expect(result).toBe(42);
  });

  it('should not call fn when None', async () => {
    const fn = vi.fn<() => void>();
    const result = await peekAsync(Promise.resolve(null), fn);

    expect(fn).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });
});

// ============================
// peekNoneAsync 测试
// ============================
describe.concurrent('peekNoneAsync', () => {
  it('should call fn when None and return original', async () => {
    const fn = vi.fn(async () => {
      await delayed(undefined);
    });

    const result = await peekNoneAsync(Promise.resolve(null), fn);

    expect(fn).toHaveBeenCalledWith(undefined);
    expect(result).toBeNull();
  });

  it('should not call fn when Some', async () => {
    const fn = vi.fn();
    const result = await peekNoneAsync(Promise.resolve(42), fn);

    expect(fn).not.toHaveBeenCalled();
    expect(result).toBe(42);
  });
});

// ============================
// peekBothAsync 测试
// ============================
describe.concurrent('peekBothAsync', () => {
  it('should work correctly when only fnSome is provided (fnNone uses default)', async () => {
    const fnSome = vi.fn(async () => {
      await delayed(undefined, 5);
    });

    // 只传递 fnSome，不传递 fnNone，使用默认的 fnNone = () => {}
    const result = await peekBothAsync(Promise.resolve(42), {fnSome});

    expect(fnSome).toHaveBeenCalledWith(42, undefined);
    expect(result).toBe(42);
  });

  it('should work correctly when only fnNone is provided (fnSome uses default)', async () => {
    const fnNone = vi.fn(async () => {
      await delayed(undefined, 5);
    });

    // 只传递 fnNone，不传递 fnSome，使用默认的 fnSome = () => {}
    const result = await peekBothAsync(Promise.resolve(null), {fnNone});

    expect(fnNone).toHaveBeenCalledWith(undefined);
    expect(result).toBeNull();
  });

  it('should handle both functions using defaults (empty object config)', async () => {
    // 传入空对象，两个函数都使用默认的空函数
    const result1 = await peekBothAsync(Promise.resolve(42), {});
    const result2 = await peekBothAsync(Promise.resolve(null), {});

    expect(result1).toBe(42);
    expect(result2).toBeNull();
  });

  it('should handle AbortSignal correctly with default functions', async () => {
    const {controller, signal} = createController();

    const resultPromise = peekBothAsync(
      delayed(42, 20),
      {}, // 使用默认函数
      signal,
    );

    // 在异步操作完成前中断
    setTimeout(() => controller.abort('Aborted'), 10);

    await expect(resultPromise).rejects.toThrow('Aborted');
  });
  it('should call fnSome when Some', async () => {
    const fnSome = vi.fn(async () => {});
    const fnNone = vi.fn(async () => {});

    const result = await peekBothAsync(Promise.resolve(42), {fnSome, fnNone});

    expect(fnSome).toHaveBeenCalledWith(42, undefined);
    expect(fnNone).not.toHaveBeenCalled();
    expect(result).toBe(42);
  });

  it('should call fnNone when None', async () => {
    const fnSome = vi.fn<() => void>();
    const fnNone = vi.fn(async () => {});

    const result = await peekBothAsync(Promise.resolve(null), {fnSome, fnNone});

    expect(fnSome).not.toHaveBeenCalled();
    expect(fnNone).toHaveBeenCalledWith(undefined);
    expect(result).toBeNull();
  });

  it('should use default empty functions', async () => {
    const result = await peekBothAsync(Promise.resolve(42), {});
    expect(result).toBe(42);
  });
});

// ============================
// 边界情况测试
// ============================
describe.concurrent('Edge Cases', () => {
  it('should handle promise-like values', async () => {
    const promiseLike = Promise.resolve(42);
    const result = await ifSomeAsync(promiseLike, async (x) => x * 2);
    expect(result).toBe(84);
  });

  it('should handle synchronous callbacks', async () => {
    const result = await matchAsync(
      Promise.resolve(42),
      (x) => x * 2, // 同步函数
      () => 0,
    );

    expect(result).toBe(84);
  });

  it('should preserve Maybe type in peek functions', async () => {
    const value: number | null = 42;
    const result = await peekAsync(Promise.resolve(value), async (x) => {
      expect(typeof x).toBe('number');
    });

    expect(isSome(result)).toBe(true);
  });
});
