import {describe, it, expect, vi} from 'vitest';
import {
  Ok,
  Err,
  isOk,
  isErr,
  isOkAnd,
  isErrAnd,
  safeExecute,
  safeExecuteAsync,
  toPromise,
  fromPromise,
  normalizeToResult,
} from './base';
import {UnknownError} from '../unknown-error';
import type {Result, Success, Failure, AsyncResult} from './types';

// ============================
// 测试辅助函数（保持不变）
// ============================
const divide = (numerator: number, denominator: number): number => {
  if (denominator === 0) throw new Error('Division by zero');
  return numerator / denominator;
};

const asyncDivide = async (
  numerator: number,
  denominator: number,
): Promise<number> => {
  await new Promise((resolve) => setTimeout(resolve, 10));
  if (denominator === 0) throw new Error('Division by zero');
  return numerator / denominator;
};

class CustomError extends Error {
  constructor(
    message: string,
    public readonly code: number,
  ) {
    super(message);
    this.name = 'CustomError';
  }
}

const isCustomError = (error: unknown): error is CustomError =>
  error instanceof CustomError;

describe.concurrent('Result Library', () => {
  // ============================
  // 构造函数测试（合并相似用例）
  // ============================
  describe('Constructor Tests', () => {
    // Ok 构造函数：参数化测试多种值类型
    it.each([
      [42, 'number'],
      [{id: 1, name: 'test', items: [1, 2, 3]}, 'complex object'],
      [null, 'null'],
      [undefined, 'undefined'],
    ])('should create Success with %s', (value, _desc) => {
      const result = Ok(value);
      expect(result.ok).toBe(true);
      // 通过类型断言访问 value
      expect((result as Success<typeof value>).value).toBe(value);
    });

    // Err 构造函数：参数化测试多种错误类型
    it.each([
      [new Error('Something went wrong'), 'Error instance'],
      ['simple error string', 'string'],
      [null, 'null'],
      [undefined, 'undefined'],
    ])('should create Failure with %s', (error, _desc) => {
      const result = Err(error);
      expect(result.ok).toBe(false);
      expect((result as Failure<typeof error>).error).toBe(error);
    });
  });

  // ============================
  // 判断函数测试（合并相似，保留类型守卫）
  // ============================
  describe('Predicate Functions Tests', () => {
    describe('isOk', () => {
      it('should return true for Ok results and false for Err', () => {
        expect(isOk(Ok(42))).toBe(true);
        expect(isOk(Err('error'))).toBe(false);
      });

      it('should act as a type guard for Success', () => {
        const result: Result<number, string> =
          Math.random() > 0.5 ? Ok(42) : Err('error');

        if (isOk(result)) {
          // TypeScript 应推断此处为 Success<number>
          expect(result.value).toBe(42);
        }
      });
    });

    describe('isErr', () => {
      it('should return true for Err results and false for Ok', () => {
        expect(isErr(Err(new Error('failed')))).toBe(true);
        expect(isErr(Ok('success'))).toBe(false);
      });

      it('should act as a type guard for Failure', () => {
        const result: Result<string, Error> =
          Math.random() > 0.5 ? Ok('success') : Err(new Error('failed'));

        if (isErr(result)) {
          // TypeScript 应推断此处为 Failure<Error>
          expect(result.error).toBeInstanceOf(Error);
        }
      });
    });

    describe('isOkAnd', () => {
      it('should evaluate predicate only on Ok results', () => {
        const predicate = vi.fn((x: number) => x > 0);

        // Ok + 满足条件
        expect(isOkAnd(Ok(42), predicate)).toBe(true);
        expect(predicate).toHaveBeenCalledWith(42);
        predicate.mockClear();

        // Ok + 不满足条件
        expect(isOkAnd(Ok(-5), predicate)).toBe(false);
        expect(predicate).toHaveBeenCalledWith(-5);
        predicate.mockClear();

        // Err 不调用 predicate
        expect(isOkAnd(Err('error'), predicate)).toBe(false);
        expect(predicate).not.toHaveBeenCalled();
      });
    });

    describe('isErrAnd', () => {
      it('should evaluate predicate only on Err results', () => {
        const predicate = vi.fn((e: CustomError) => e.code === 404);
        const customErr200 = new CustomError('test', 200);
        const customErr404 = new CustomError('test', 404);

        // Err + 满足条件
        expect(isErrAnd(Err(customErr404), predicate)).toBe(true);
        expect(predicate).toHaveBeenCalledWith(customErr404);
        predicate.mockClear();

        // Err + 不满足条件
        expect(isErrAnd(Err(customErr200), predicate)).toBe(false);
        expect(predicate).toHaveBeenCalledWith(customErr200);
        predicate.mockClear();

        // Ok 不调用 predicate
        expect(isErrAnd(Ok('success'), predicate)).toBe(false);
        expect(predicate).not.toHaveBeenCalled();
      });
    });
  });

  // ============================
  // 安全执行器测试（保持结构，独立 it）
  // ============================
  describe('Safe Execution Tests', () => {
    describe('safeExecute (synchronous)', () => {
      describe('without expected error type guard', () => {
        it('should return Ok with value when function succeeds', () => {
          const result = safeExecute(() => divide(10, 2), 'division failed');
          expect(isOk(result)).toBe(true);
          expect((result as Success<number>).value).toBe(5);
        });

        it('should return Err(UnknownError) when function throws', () => {
          const errorMessage = 'division failed';
          const result = safeExecute(() => divide(10, 0), errorMessage);
          expect(isErr(result)).toBe(true);
          const error = (result as Failure<UnknownError>).error;
          expect(error).toBeInstanceOf(UnknownError);
          expect(error.message).toBe(errorMessage);
          // @ts-ignore
          expect(error.cause?.message).toBe('Division by zero');
        });

        it('should use default message when none provided', () => {
          const result = safeExecute(() => {
            throw new Error('original error');
          });
          expect(isErr(result)).toBe(true);
          const error = (result as Failure<UnknownError>).error;
          expect(error).toBeInstanceOf(UnknownError);
          expect(error.message).toBeDefined(); // 默认消息不应为空
        });
      });

      describe('with expected error type guard', () => {
        it('should return Ok when function succeeds', () => {
          const result = safeExecute(
            () => divide(10, 2),
            'unexpected error',
            isCustomError,
          );
          expect(isOk(result)).toBe(true);
          expect((result as Success<number>).value).toBe(5);
        });

        it('should return Err(CustomError) when function throws CustomError', () => {
          const customError = new CustomError('business error', 400);
          const result = safeExecute(
            () => {
              throw customError;
            },
            'unexpected error',
            isCustomError,
          );
          expect(isErr(result)).toBe(true);
          const error = (result as Failure<CustomError | UnknownError>).error;
          expect(error).toBe(customError); // 直接返回原错误，不包装
          expect(error).toBeInstanceOf(CustomError);
        });

        it('should return Err(UnknownError) when function throws unexpected error', () => {
          const unexpectedError = new Error('not a custom error');
          const result = safeExecute(
            () => {
              throw unexpectedError;
            },
            'unexpected error',
            isCustomError,
          );
          expect(isErr(result)).toBe(true);
          const error = (result as Failure<CustomError | UnknownError>).error;
          expect(error).toBeInstanceOf(UnknownError);
          expect((error as UnknownError).cause).toBe(unexpectedError);
        });
      });
    });

    describe('safeExecuteAsync (asynchronous)', () => {
      describe('without expected error type guard', () => {
        it('should return Ok with value when async function resolves', async () => {
          const result = await safeExecuteAsync(
            () => asyncDivide(10, 2),
            'async division failed',
          );
          expect(isOk(result)).toBe(true);
          expect((result as Success<number>).value).toBe(5);
        });

        it('should return Err(UnknownError) when async function rejects', async () => {
          const errorMessage = 'async division failed';
          const result = await safeExecuteAsync(
            () => asyncDivide(10, 0),
            errorMessage,
          );
          expect(isErr(result)).toBe(true);
          const error = (result as Failure<UnknownError>).error;
          expect(error).toBeInstanceOf(UnknownError);
          expect(error.message).toBe(errorMessage);
          // @ts-ignore
          expect(error.cause.message).toBe('Division by zero');
        });

        it('should return Err(UnknownError) when async function throws synchronously', async () => {
          const result = await safeExecuteAsync(() => {
            throw new Error('sync throw in async function');
          }, 'async error');
          expect(isErr(result)).toBe(true);
          const error = (result as Failure<UnknownError>).error;
          expect(error).toBeInstanceOf(UnknownError);
        });
      });

      describe('with expected error type guard', () => {
        it('should return Err(CustomError) when async function rejects with CustomError', async () => {
          const customError = new CustomError('async business error', 500);
          const result = await safeExecuteAsync(
            () => Promise.reject(customError),
            'unexpected async error',
            isCustomError,
          );
          expect(isErr(result)).toBe(true);
          const error = (result as Failure<CustomError | UnknownError>).error;
          expect(error).toBe(customError);
          expect(error).toBeInstanceOf(CustomError);
        });

        it('should handle sync throws inside async function', async () => {
          const customError = new CustomError('sync error', 400);
          const result = await safeExecuteAsync(
            () => {
              throw customError;
            },
            'unexpected error',
            isCustomError,
          );
          expect(isErr(result)).toBe(true);
          const error = (result as Failure<CustomError | UnknownError>).error;
          expect(error).toBe(customError);
        });

        it('should wrap unexpected errors (non-CustomError) as UnknownError', async () => {
          const result = await safeExecuteAsync(
            // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
            () => Promise.reject('string error'),
            'unexpected error',
            isCustomError,
          );
          expect(isErr(result)).toBe(true);
          const error = (result as Failure<CustomError | UnknownError>).error;
          expect(error).toBeInstanceOf(UnknownError);
          expect((error as UnknownError).cause).toBe('string error');
        });
      });
    });
  });

  // ============================
  // 转换函数测试（合并相似用例）
  // ============================
  describe('Conversion Functions Tests', () => {
    describe('toPromise', () => {
      it('should resolve with value for Ok result', async () => {
        const result = Ok('success value');
        await expect(toPromise(result)).resolves.toBe('success value');
      });

      // 合并错误场景：Error 对象和普通值
      it.each([
        [new Error('failure'), 'Error object'],
        ['string error', 'non-Error value'],
      ])(
        'should reject with error for Err result (input: %s)',
        async (error, _desc) => {
          const result = Err(error);
          const promise = toPromise(result);
          await expect(promise).rejects.toThrow(); // 保证 reject
          // 对于非 Error 值，会被 ensureError 包装成 Error 实例
          const caught = await promise.catch((e: unknown) => e);
          expect(caught).toBeInstanceOf(Error);
        },
      );
    });

    describe('fromPromise', () => {
      it('should convert resolved promise to Ok', async () => {
        const promise = Promise.resolve('async success');
        const asyncResult = fromPromise(promise);
        await expect(asyncResult).resolves.toMatchObject({
          ok: true,
          value: 'async success',
        });
      });

      // 合并 rejected 场景：Error 和普通值
      it.each([
        [new Error('async failure'), 'Error'],
        ['rejection string', 'string'],
      ])(
        'should convert rejected promise to Err(UnknownError) (rejection: %s)',
        async (rejection, _desc) => {
          // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
          const promise = Promise.reject(rejection);
          const asyncResult = fromPromise(promise);
          const result = await asyncResult;
          expect(isErr(result)).toBe(true);
          const error = (result as Failure<UnknownError>).error;
          expect(error).toBeInstanceOf(UnknownError);
          expect(error.cause).toBe(rejection);
        },
      );
    });

    describe('normalizeToResult', () => {
      it('should return synchronous Result unchanged', async () => {
        const syncResult = Ok(42);
        const normalized = await normalizeToResult(syncResult);
        expect(normalized).toBe(syncResult);
        expect(isOk(normalized)).toBe(true);
      });

      it('should resolve Promise<Result> to Result', async () => {
        const asyncResult: AsyncResult<number, string> = Promise.resolve(
          Ok(100),
        );
        const normalized = await normalizeToResult(asyncResult);
        expect(isOk(normalized)).toBe(true);
        expect((normalized as Success<number>).value).toBe(100);
      });

      // 合并 Promise rejection 的不同类型
      it.each([
        [new Error('promise rejection'), 'Error'],
        ['string rejection', 'string'],
        [
          new DOMException('DOM error', 'InvalidStateError'),
          'DOMException (non-Abort)',
        ],
      ])(
        'should handle rejected Promise and wrap as UnknownError (cause: %s)',
        async (rejection, _desc) => {
          // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
          const rejectedPromise = Promise.reject(rejection);
          const normalized = await normalizeToResult(rejectedPromise);
          expect(isErr(normalized)).toBe(true);
          const error = (normalized as Failure<UnknownError>).error;
          expect(error).toBeInstanceOf(UnknownError);
          expect(error.cause).toBe(rejection);
        },
      );

      it('should preserve AbortError DOMException without wrapping', async () => {
        const abortError = new DOMException(
          'The operation was aborted',
          'AbortError',
        );
        const normalized = await normalizeToResult(Promise.reject(abortError));
        expect(isErr(normalized)).toBe(true);
        const error = (normalized as Failure<DOMException>).error;
        expect(error).toBe(abortError); // 直接返回原错误
      });

      it('should handle Thenable objects', async () => {
        const thenable: PromiseLike<Result<number, string>> = {
          then: (onfulfilled) => {
            if (onfulfilled) {
              const result = onfulfilled(Ok(999));
              return Promise.resolve(result);
            }
            return new Promise(() => {});
          },
        };
        const normalized = await normalizeToResult(thenable);
        expect(isOk(normalized)).toBe(true);
        expect((normalized as Success<number>).value).toBe(999);
      });

      // 合并：同步 Result 保持错误类型 + 直接传入 Err
      it('should maintain error types when given synchronous Err', async () => {
        const typedError = new CustomError('typed', 400);
        const result: Result<number, CustomError> = Err(typedError);
        const normalized = await normalizeToResult(result);
        expect(isErr(normalized)).toBe(true);
        expect((normalized as Failure<CustomError>).error).toBe(typedError);
      });
    });
  });

  // ============================
  // 边界情况测试
  // ============================
  describe('Edge Cases Tests', () => {
    // 无限递归测试：验证 predicate 只调用一次
    it('should call predicate exactly once in isOkAnd', () => {
      const result = Ok(42);
      const predicate = vi.fn((x: number) => x > 0);
      expect(isOkAnd(result, predicate)).toBe(true);
      expect(predicate).toHaveBeenCalledTimes(1);
      expect(predicate).toHaveBeenCalledWith(42);
    });
  });
});
