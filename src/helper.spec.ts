// ========================================
// ./__tests__/helper.spec.ts
// ========================================

/* eslint-disable @typescript-eslint/no-unsafe-function-type */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */

import {isPromiseLike, isResultLike, wrapError, dynamicAwait} from './helper';
import {describe, it, expect, vi} from 'vitest';

// ============================
// 参数验证与边界测试
// ============================
describe.concurrent('Parameter Validation and Edge Case Tests', () => {
  describe('isPromiseLike Function', () => {
    // 测试null和undefined输入
    it('should return false for null or undefined', () => {
      expect(isPromiseLike(null)).toBe(false);
      expect(isPromiseLike(undefined)).toBe(false);
    });

    // 测试非对象输入
    it('should return false for primitive types', () => {
      expect(isPromiseLike('a string')).toBe(false);
      expect(isPromiseLike(123)).toBe(false);
      expect(isPromiseLike(true)).toBe(false);
      expect(isPromiseLike(Symbol('sym'))).toBe(false);
    });
  });

  describe('isResultLike Function', () => {
    // 测试null和undefined输入
    it('should return false for null or undefined', () => {
      expect(isResultLike(null)).toBe(false);
      expect(isResultLike(undefined)).toBe(false);
    });

    // 测试非对象输入
    it('should return false for primitives and functions', () => {
      expect(isResultLike('result')).toBe(false);
      expect(isResultLike(100)).toBe(false);
      expect(isResultLike(vi.fn())).toBe(false);
    });
  });
});

// ============================
// dynamicAwait Function Tests
// ============================
describe.concurrent('dynamicAwait Function', () => {
  describe('synchronous values', () => {
    it('should return the same value when passed a primitive', async () => {
      const result = await dynamicAwait(42);
      expect(result).toBe(42);
    });

    it('should return the same object when passed an object', async () => {
      const obj = {foo: 'bar'};
      const result = await dynamicAwait(obj);
      expect(result).toBe(obj); // reference equality
    });

    it('should return the same array when passed an array', async () => {
      const arr = [1, 2, 3];
      const result = await dynamicAwait(arr);
      expect(result).toBe(arr); // reference equality
    });

    it('should return undefined when passed undefined', async () => {
      const result = await dynamicAwait(undefined);
      expect(result).toBeUndefined();
    });

    it('should return null when passed null', async () => {
      const result = await dynamicAwait(null);
      expect(result).toBeNull();
    });
  });

  describe('Promise values', () => {
    it('should await and return resolved value of a Promise', async () => {
      const promise = Promise.resolve('resolved value');
      const result = await dynamicAwait(promise);
      expect(result).toBe('resolved value');
    });

    it('should await and return resolved value of a rejected Promise', async () => {
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
      const promise = Promise.reject('rejected reason');
      await expect(dynamicAwait(promise)).rejects.toBe('rejected reason');
    });

    it('should handle already resolved Promise', async () => {
      const result = await dynamicAwait(Promise.resolve(123));
      expect(result).toBe(123);
    });
  });

  describe('thenable objects', () => {
    it('should await and return resolved value of a thenable object', async () => {
      const thenable = {
        then: (resolve: (value: string) => void) => resolve('thenable value'),
      };
      const result = await dynamicAwait(thenable as PromiseLike<string>);
      expect(result).toBe('thenable value');
    });

    it('should handle thenable that rejects', async () => {
      const thenable = {
        then: (
          _resolve: (value: unknown) => void,
          reject: (reason: string) => void,
        ) => reject('thenable rejection'),
      };
      await expect(dynamicAwait(thenable)).rejects.toBe('thenable rejection');
    });
  });
});

// ============================
// 核心行为测试
// 测试各种配置和模式下的行为
// ============================
describe.concurrent('Core Behavior Tests', () => {
  describe('isPromiseLike Function', () => {
    // 测试标准Promise实例
    it('should return true for a native Promise instance', () => {
      const promise = Promise.resolve(1);
      expect(isPromiseLike(promise)).toBe(true);
    });

    // 测试有效的thenable对象
    it('should return true for a valid thenable object', () => {
      const thenable_object = {
        then: (resolve: Function) => resolve('success'),
      };
      expect(isPromiseLike(thenable_object)).toBe(true);

      const thenable_function = function () {};
      thenable_function.then = (resolve: Function) => resolve('success');
      expect(isPromiseLike(thenable_function)).toBe(true);
    });

    // 测试Class实例的thenable检查
    it('should return true for a Class instance that is thenable', () => {
      class Thenable {
        then(resolve: Function) {
          resolve('class success');
        }
      }
      expect(isPromiseLike(new Thenable())).toBe(true);
    });
  });

  describe('isResultLike Function', () => {
    // 测试成功的Result对象
    it('should return true for a standard success Result object', () => {
      const success_result = {ok: true, value: 42};
      expect(isResultLike(success_result)).toBe(true);
    });

    // 测试失败的Result对象
    it('should return true for a standard failure Result object', () => {
      const failure_result = {ok: false, error: new Error('fail')};
      expect(isResultLike(failure_result)).toBe(true);
    });

    // 测试null或undefined作为value/error的情况
    it('should handle null or undefined for value/error when structural rules met', () => {
      // 成功，值为null
      expect(isResultLike({ok: true, value: null})).toBe(true);
      // 失败，错误为undefined
      expect(isResultLike({ok: false, error: undefined})).toBe(true);
    });
  });
});

// ============================
// 错误路径测试
// 测试各种无效输入和错误情况
// ============================
describe.concurrent('Error Path and Invalid Input Tests', () => {
  describe('isPromiseLike Function', () => {
    // 测试存在then属性但不是函数的情况
    it('should return false if then property exists but is not a function', () => {
      expect(isPromiseLike({then: null})).toBe(false);
      expect(isPromiseLike({then: 'not a function'})).toBe(false);
      expect(isPromiseLike({then: 123})).toBe(false);
    });

    // 测试缺少then属性的对象
    it('should return false if then property is missing', () => {
      expect(isPromiseLike({})).toBe(false);
      expect(isPromiseLike({then: undefined})).toBe(false);
    });

    // 测试非thenable的Class实例
    it('should return false for a Class instance without then method', () => {
      class NotThenable {}
      expect(isPromiseLike(new NotThenable())).toBe(false);
    });
  });

  describe('isResultLike Function', () => {
    // 测试缺少必要属性的对象
    it('should return false if ok is missing', () => {
      expect(isResultLike({value: 1})).toBe(false);
      expect(isResultLike({error: 'err'})).toBe(false);
    });

    // 测试ok不是boolean的情况
    it('should return false if ok is not a boolean', () => {
      expect(isResultLike({ok: 'true', value: 1})).toBe(false);
      expect(isResultLike({ok: 1, error: 'err'})).toBe(false);
    });

    // 测试成功状态但缺少value
    it('should return false if success (true) but missing value', () => {
      expect(isResultLike({ok: true})).toBe(false);
      expect(isResultLike({ok: true, error: null})).toBe(false);
    });

    // 测试成功状态但包含error属性
    it('should return false if success (true) but also contains error property', () => {
      expect(isResultLike({ok: true, value: 1, error: 'oops'})).toBe(false);
    });

    // 测试失败状态但缺少error
    it('should return false if failure (false) but missing error', () => {
      expect(isResultLike({ok: false})).toBe(false);
      expect(isResultLike({ok: false, value: 1})).toBe(false);
    });

    // 测试失败状态但包含value属性
    it('should return false if failure (false) but also contains value property', () => {
      expect(isResultLike({ok: false, error: 'err', value: 1})).toBe(false);
    });
  });
});

describe.concurrent('wrapError', () => {
  it('should return the original error if it is an AbortError DOMException', () => {
    const abortError = new DOMException(
      'The operation was aborted',
      'AbortError',
    );

    const result = wrapError(abortError);

    expect(result).toBe(abortError);
    expect(result instanceof DOMException).toBe(true);
    expect((result as DOMException).name).toBe('AbortError');
  });

  it('should wrap a standard Error into UnknownError', () => {
    const standardError = new Error('Something went wrong');

    const result = wrapError(standardError);
    expect(result).not.toBe(standardError);
  });
});

// 边界和异常情况测试
// 测试极端情况和异常行为
// ============================
describe.concurrent('Edge Cases and Exception Handling Tests', () => {
  describe('isPromiseLike Function', () => {
    // 测试访问then属性时抛出异常的情况
    it('should return false if accessing the then property throws an exception', () => {
      const evil_thenable = {
        get then() {
          throw new Error('Access Denied!');
        },
      };
      expect(isPromiseLike(evil_thenable)).toBe(false);
    });
  });

  describe('isResultLike Function', () => {
    // 测试深层嵌套或复杂对象
    it('should handle deeply nested objects correctly', () => {
      const complex_success = {
        ok: true,
        value: {
          nested: {
            data: [1, 2, 3],
          },
        },
      };
      expect(isResultLike(complex_success)).toBe(true);

      const complex_failure = {
        ok: false,
        error: {
          message: 'Deep error',
          code: 500,
          details: {
            timestamp: Date.now(),
          },
        },
      };
      expect(isResultLike(complex_failure)).toBe(true);
    });

    // 测试边缘数据类型
    it('should handle edge data types in value/error', () => {
      // 函数作为value
      expect(isResultLike({ok: true, value: vi.fn()})).toBe(true);
      // Symbol作为error
      expect(isResultLike({ok: false, error: Symbol('error')})).toBe(true);
      // 数组作为value
      expect(isResultLike({ok: true, value: [1, 2, 3]})).toBe(true);
    });
  });
});
