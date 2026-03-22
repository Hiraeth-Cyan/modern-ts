// ========================================
// ./src/Result/Consumers/inspect.spec.ts
// ========================================
/* eslint-disable @typescript-eslint/require-await */
import {beforeEach, describe, it, expect, vi} from 'vitest';
import {
  peekBoth,
  peekErr,
  peekOk,
  peekBothAsync,
  peekErrAsync,
  peekOkAsync,
} from './inspect';
import {Ok, Err} from '../base';
import {UnknownError} from '../../unknown-error';
import {type Failure} from '../types';

// ============================
// 测试辅助函数
// ============================
const successValue = {id: 1, name: 'Test'};
const errorValue = new Error('Something went wrong');

const mockOkCallback = vi.fn();
const mockErrCallback = vi.fn();

const asyncOkCallback = vi.fn(async () => {});
const asyncErrCallback = vi.fn(async () => {});

// 模拟 AbortSignal
const createAbortSignal = (aborted = false, reason?: unknown): AbortSignal => {
  const controller = new AbortController();
  if (aborted) {
    controller.abort(reason);
  }
  return controller.signal;
};

// ============================
// peekOk 函数测试
// ============================
describe('peekOk Function Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should execute callback for Ok value and return original result', () => {
    const result = Ok(successValue);
    const peeked = peekOk(result, mockOkCallback);

    expect(mockOkCallback).toHaveBeenCalledWith(successValue);
    expect(peeked).toBe(result);
    expect(peeked).toEqual(Ok(successValue));
  });

  it('should not execute callback for Err value', () => {
    const result = Err(errorValue);
    const peeked = peekOk(result, mockOkCallback);

    expect(mockOkCallback).not.toHaveBeenCalled();
    expect(peeked).toBe(result);
    expect(peeked).toEqual(Err(errorValue));
  });

  it('should propagate callback exceptions to caller', () => {
    const throwingCallback = vi.fn(() => {
      throw new Error('Callback error');
    });
    const result = Ok(successValue);

    expect(() => peekOk(result, throwingCallback)).toThrow('Callback error');
    expect(throwingCallback).toHaveBeenCalled();
  });
});

// ============================
// peekErr 函数测试
// ============================
describe('peekErr Function Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should execute callback for Err value and return original result', () => {
    const result = Err(errorValue);
    const peeked = peekErr(result, mockErrCallback);

    expect(mockErrCallback).toHaveBeenCalledWith(errorValue);
    expect(peeked).toBe(result);
    expect(peeked).toEqual(Err(errorValue));
  });

  it('should not execute callback for Ok value', () => {
    const result = Ok(successValue);
    const peeked = peekErr(result, mockErrCallback);

    expect(mockErrCallback).not.toHaveBeenCalled();
    expect(peeked).toBe(result);
    expect(peeked).toEqual(Ok(successValue));
  });

  it('should propagate callback exceptions to caller', () => {
    const throwingCallback = vi.fn(() => {
      throw new Error('Callback error');
    });
    const result = Err(errorValue);

    expect(() => peekErr(result, throwingCallback)).toThrow('Callback error');
    expect(throwingCallback).toHaveBeenCalled();
  });
});

// ============================
// peekBoth 函数测试
// ============================
describe('peekBoth Function Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should execute Ok callback for success path', () => {
    const result = Ok(successValue);
    const peeked = peekBoth(result, {
      fnOk: mockOkCallback,
      fnErr: mockErrCallback,
    });

    expect(mockOkCallback).toHaveBeenCalledWith(successValue);
    expect(mockErrCallback).not.toHaveBeenCalled();
    expect(peeked).toBe(result);
  });

  it('should execute Err callback for error path', () => {
    const result = Err(errorValue);
    const peeked = peekBoth(result, {
      fnOk: mockOkCallback,
      fnErr: mockErrCallback,
    });

    expect(mockErrCallback).toHaveBeenCalledWith(errorValue);
    expect(mockOkCallback).not.toHaveBeenCalled();
    expect(peeked).toBe(result);
  });

  it('should use default empty functions when not provided', () => {
    const okResult = Ok(successValue);
    const errResult = Err(errorValue);

    expect(() => peekBoth(okResult, {})).not.toThrow();
    expect(() => peekBoth(errResult, {})).not.toThrow();
  });

  it('should propagate callback exceptions to caller', () => {
    const throwingCallback = vi.fn(() => {
      throw new Error('Callback error');
    });
    const okResult = Ok(successValue);
    const errResult = Err(errorValue);

    expect(() => peekBoth(okResult, {fnOk: throwingCallback})).toThrow(
      'Callback error',
    );
    expect(() => peekBoth(errResult, {fnErr: throwingCallback})).toThrow(
      'Callback error',
    );
  });
});

// ============================
// peekOkAsync 函数测试
// ============================
describe('peekOkAsync Function Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should execute async callback for Ok value and return original result', async () => {
    const result = Ok(successValue);
    const peeked = await peekOkAsync(result, asyncOkCallback);

    expect(asyncOkCallback).toHaveBeenCalledWith(successValue, undefined);
    expect(peeked).toEqual(Ok(successValue));
  });

  it('should handle Promise<Result> input', async () => {
    const resultPromise = Promise.resolve(Ok(successValue));
    const peeked = await peekOkAsync(resultPromise, asyncOkCallback);

    expect(asyncOkCallback).toHaveBeenCalledWith(successValue, undefined);
    expect(peeked).toEqual(Ok(successValue));
  });

  it('should not execute callback for Err value', async () => {
    const result = Err(errorValue);
    const peeked = await peekOkAsync(result, asyncOkCallback);

    expect(asyncOkCallback).not.toHaveBeenCalled();
    expect(peeked).toEqual(Err(errorValue));
  });

  it('should handle callback throwing exception', async () => {
    const throwingCallback = vi.fn(async () => {
      throw new Error('Async callback error');
    });
    const result = Ok(successValue);
    const peeked = await peekOkAsync(result, throwingCallback);

    expect(throwingCallback).toHaveBeenCalled();
    expect(peeked.ok).toBe(false);
    expect((peeked as Failure<UnknownError>).error).toBeInstanceOf(
      UnknownError,
    );
  });

  it('should handle aborted signal before execution', async () => {
    const signal = createAbortSignal(
      true,
      new DOMException('User cancelled', 'AbortError'),
    );
    const result = Ok(successValue);
    const peeked = await peekOkAsync(result, asyncOkCallback, signal);

    expect(asyncOkCallback).not.toHaveBeenCalled();
    expect(peeked.ok).toBe(false);
    // 验证是 DOMException
    expect((peeked as Failure<DOMException>).error).toBeInstanceOf(
      DOMException,
    );
    expect((peeked as Failure<DOMException>).error.name).toBe('AbortError');
  });

  it('should handle signal abort during callback execution', async () => {
    const controller = new AbortController();
    const delayedCallback = vi.fn(
      async (_value: unknown, signal?: AbortSignal) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        signal?.throwIfAborted();
      },
    );

    const result = Ok(successValue);
    const promise = peekOkAsync(result, delayedCallback, controller.signal);

    // 立即取消
    controller.abort(
      new DOMException('The operation was aborted', 'AbortError'),
    );

    const peeked = await promise;
    expect(peeked.ok).toBe(false);
    expect((peeked as Failure<DOMException>).error).toBeInstanceOf(
      DOMException,
    );
  });
});

// ============================
// peekErrAsync 函数测试
// ============================
describe('peekErrAsync Function Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should execute async callback for Err value and return original result', async () => {
    const result = Err(errorValue);
    const peeked = await peekErrAsync(result, asyncErrCallback);

    expect(asyncErrCallback).toHaveBeenCalledWith(errorValue, undefined);
    expect(peeked).toEqual(Err(errorValue));
  });

  it('should not execute callback for Ok value', async () => {
    const result = Ok(successValue);
    const peeked = await peekErrAsync(result, asyncErrCallback);

    expect(asyncErrCallback).not.toHaveBeenCalled();
    expect(peeked).toEqual(Ok(successValue));
  });

  it('should handle callback throwing exception', async () => {
    const throwingCallback = vi.fn(async () => {
      throw new Error('Async callback error');
    });
    const result = Err(errorValue);
    const peeked = await peekErrAsync(result, throwingCallback);

    expect(throwingCallback).toHaveBeenCalled();
    expect(peeked.ok).toBe(false);
    expect((peeked as Failure<UnknownError>).error).toBeInstanceOf(
      UnknownError,
    );
  });

  it('should handle aborted signal', async () => {
    const signal = createAbortSignal(true, 'User cancelled');
    const result = Err(errorValue);
    const peeked = await peekErrAsync(result, asyncErrCallback, signal);

    expect(asyncErrCallback).not.toHaveBeenCalled();
    expect(peeked.ok).toBe(false);
    expect((peeked as Failure<DOMException>).error).toBeInstanceOf(
      DOMException,
    );
  });
});

// ============================
// peekBothAsync 函数测试
// ============================
describe('peekBothAsync Function Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should execute Ok callback for success path', async () => {
    const result = Ok(successValue);
    const peeked = await peekBothAsync(result, {
      fnOk: asyncOkCallback,
      fnErr: asyncErrCallback,
    });

    expect(asyncOkCallback).toHaveBeenCalledWith(successValue, undefined);
    expect(asyncErrCallback).not.toHaveBeenCalled();
    expect(peeked).toEqual(Ok(successValue));
  });

  it('should execute Err callback for error path', async () => {
    const result = Err(errorValue);
    const peeked = await peekBothAsync(result, {
      fnOk: asyncOkCallback,
      fnErr: asyncErrCallback,
    });

    expect(asyncErrCallback).toHaveBeenCalledWith(errorValue, undefined);
    expect(asyncOkCallback).not.toHaveBeenCalled();
    expect(peeked).toEqual(Err(errorValue));
  });

  it('should use default empty functions when not provided', async () => {
    const okResult = Ok(successValue);
    const errResult = Err(errorValue);

    const okPeeked = await peekBothAsync(okResult, {});
    const errPeeked = await peekBothAsync(errResult, {});

    expect(okPeeked).toEqual(Ok(successValue));
    expect(errPeeked).toEqual(Err(errorValue));
  });

  it('should handle callback throwing exception on Ok path', async () => {
    const throwingCallback = vi.fn(async () => {
      throw new Error('Async callback error');
    });
    const result = Ok(successValue);
    const peeked = await peekBothAsync(result, {fnOk: throwingCallback});

    expect(throwingCallback).toHaveBeenCalled();
    expect(peeked.ok).toBe(false);
    expect((peeked as Failure<UnknownError>).error).toBeInstanceOf(
      UnknownError,
    );
  });

  it('should handle callback throwing exception on Err path', async () => {
    const throwingCallback = vi.fn(async () => {
      throw new Error('Async callback error');
    });
    const result = Err(errorValue);
    const peeked = await peekBothAsync(result, {fnErr: throwingCallback});

    expect(throwingCallback).toHaveBeenCalled();
    expect(peeked.ok).toBe(false);
    expect((peeked as Failure<UnknownError>).error).toBeInstanceOf(
      UnknownError,
    );
  });

  it('should handle aborted signal', async () => {
    const signal = createAbortSignal(true, 'User cancelled');
    const result = Ok(successValue);
    const peeked = await peekBothAsync(result, {fnOk: asyncOkCallback}, signal);

    expect(asyncOkCallback).not.toHaveBeenCalled();
    expect(peeked.ok).toBe(false);
    expect((peeked as Failure<DOMException>).error).toBeInstanceOf(
      DOMException,
    );
  });

  it('should pass abort signal to callback functions', async () => {
    const signal = createAbortSignal(false);
    const callbackWithSignalCheck = vi.fn(
      async (_value: unknown, s?: AbortSignal) => {
        expect(s).toBe(signal);
      },
    );

    const result = Ok(successValue);
    await peekBothAsync(result, {fnOk: callbackWithSignalCheck}, signal);

    expect(callbackWithSignalCheck).toHaveBeenCalledWith(successValue, signal);
  });
});

// ============================
// 边界情况测试
// ============================
describe('Edge Cases', () => {
  it('should handle null and undefined values in callbacks', async () => {
    const nullResult = Ok(null);
    const undefinedResult = Ok(undefined);

    const nullCallback = vi.fn();
    const undefinedCallback = vi.fn();

    // 同步
    peekOk(nullResult, nullCallback);
    peekOk(undefinedResult, undefinedCallback);

    expect(nullCallback).toHaveBeenCalledWith(null);
    expect(undefinedCallback).toHaveBeenCalledWith(undefined);

    // 异步
    const asyncNullCallback = vi.fn(async () => {});
    await peekOkAsync(nullResult, asyncNullCallback);
    expect(asyncNullCallback).toHaveBeenCalledWith(null, undefined);
  });

  it('should preserve original error type after async peek', async () => {
    const customError = new TypeError('Type error');
    const result = Err(customError);
    const peeked = await peekErrAsync(result, asyncErrCallback);

    // 回调没有抛出异常，应该返回原始错误
    expect(peeked).toEqual(Err(customError));
  });

  it('should wrap non-DOMException errors in UnknownError', async () => {
    const throwingCallback = vi.fn(async () => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw 'Plain string error'; // 非 Error 对象
    });

    const result = Ok(successValue);
    const peeked = await peekOkAsync(result, throwingCallback);

    expect(peeked.ok).toBe(false);
    expect((peeked as Failure<UnknownError>).error).toBeInstanceOf(
      UnknownError,
    );
  });

  it('should preserve DOMException AbortError', async () => {
    const throwingCallback = vi.fn(async () => {
      throw new DOMException('Aborted', 'AbortError');
    });

    const result = Ok(successValue);
    const peeked = await peekOkAsync(result, throwingCallback);

    expect(peeked.ok).toBe(false);
    expect((peeked as Failure<DOMException>).error).toBeInstanceOf(
      DOMException,
    );
    expect((peeked as Failure<DOMException>).error.name).toBe('AbortError');
  });
});
