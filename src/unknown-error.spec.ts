// ========================================
// ./src/unknown-error.spec.ts
// ========================================

import {describe, it, expect, vi} from 'vitest';
import {
  extractErrorInfo,
  ensureDOMException,
  ensureError,
  UnknownError,
} from './unknown-error';

// ============================
// 测试辅助函数和模拟
// ============================

// 自定义错误类型用于测试
class CustomError extends Error {
  constructor(
    message: string,
    public code?: number,
  ) {
    super(message);
    this.name = 'CustomError';
  }
}

// 带有 message 属性的非 Error 对象
const errorLikeObject = {
  message: 'This is an error-like object',
  code: 500,
  data: {timestamp: '2025-01-01'},
};

// 复杂对象（带循环引用）
function createCircularObject() {
  const obj = {name: 'circular'};
  // @ts-ignore
  obj.self = obj;
  return obj;
}

// ============================
// extractErrorInfo 测试
// ============================
describe.concurrent('extractErrorInfo Tests', () => {
  it('should trigger branch: message is a non-null object but IS an array (B=False, C=True)', () => {
    const objUndefined = {message: undefined};
    extractErrorInfo(objUndefined);
    const objNull = {message: null};
    extractErrorInfo(objNull);

    const objArray = {message: ['1', '2']};
    const resultArr = extractErrorInfo(objArray);
    expect(resultArr.message).toBe('1,2');

    const objNumber = {message: 123};
    const resultNum = extractErrorInfo(objNumber);
    expect(resultNum.message).toBe('123');
  });

  describe('Standard Error Instances (type_code: 0)', () => {
    it('should handle standard Error instances', () => {
      const error = new Error('Standard error message');
      const result = extractErrorInfo(error);

      expect(result.type_code).toBe(0);
      expect(result.message).toBe(''); // 注意：对于标准 Error，message 为空
    });

    it('should handle custom Error subclasses', () => {
      const customError = new CustomError('Custom error', 404);
      const result = extractErrorInfo(customError);

      expect(result.type_code).toBe(0);
      expect(result.message).toBe('');
    });
  });

  describe('DOMException (type_code: 1)', () => {
    it('should handle DOMException instances', () => {
      const domException = new DOMException(
        'DOM Exception occurred',
        'SyntaxError', // 不是 AbortError
      );
      const result = extractErrorInfo(domException);

      expect(result.type_code).toBe(1);
      expect(result.message).toBe('');
    });

    // 添加 AbortError 的测试
    it('should handle AbortError DOMException', () => {
      const abortError = new DOMException('AbortError occurred', 'AbortError');
      const result = extractErrorInfo(abortError);

      expect(result.type_code).toBe(1); // 只有 AbortError 返回 1
      expect(result.message).toBe('');
    });
  });

  describe('null/undefined values (type_code: 2)', () => {
    it('should handle null values', () => {
      const result = extractErrorInfo(null);

      expect(result.type_code).toBe(2);
      expect(result.message).toBe(
        'An unknown or null/undefined error occurred.',
      );
    });

    it('should handle undefined values', () => {
      const result = extractErrorInfo(undefined);

      expect(result.type_code).toBe(2);
      expect(result.message).toBe(
        'An unknown or null/undefined error occurred.',
      );
    });
  });

  describe('Error-like objects with message property (type_code: 3)', () => {
    it('should handle objects with string message property', () => {
      const result = extractErrorInfo(errorLikeObject);

      expect(result.type_code).toBe(3);
      expect(result.message).toBe('This is an error-like object');
    });

    it('should handle objects with non-string message property', () => {
      const objWithNonStringMessage = {
        message: 404, // 数字类型的 message
        status: 'Not Found',
      };

      const result = extractErrorInfo(objWithNonStringMessage);

      expect(result.type_code).toBe(3);
      expect(result.message).toBe('404');
    });

    it('should handle objects with array message property', () => {
      const objWithArrayMessage = {
        message: ['error1', 'error2'],
        errors: 2,
      };

      const result = extractErrorInfo(objWithArrayMessage);

      expect(result.type_code).toBe(3);
      expect(result.message).toBe('error1,error2');
    });

    it('should safely handle objects with getter that throws', () => {
      const objWithThrowingGetter = {
        get message() {
          throw new Error('Getter error!');
        },
        otherProp: 'value',
      };

      const result = extractErrorInfo(objWithThrowingGetter);

      // 应该回退到复杂对象处理 (type_code: 4)
      expect(result.type_code).toBe(4);
      expect(result.message).toContain('Complex Object');
    });
  });

  describe('Primitive and complex objects (type_code: 4)', () => {
    it('should handle string primitives', () => {
      const result = extractErrorInfo('Raw string error');

      expect(result.type_code).toBe(4);
      expect(result.message).toContain('Primitive [string]: Raw string error');
    });

    it('should handle number primitives', () => {
      const result = extractErrorInfo(42);

      expect(result.type_code).toBe(4);
      expect(result.message).toContain('Primitive [number]: 42');
    });

    it('should handle boolean primitives', () => {
      const result = extractErrorInfo(false);

      expect(result.type_code).toBe(4);
      expect(result.message).toContain('Primitive [boolean]: false');
    });

    it('should handle complex objects without message property', () => {
      const complexObj = {
        name: 'Test Object',
        data: {nested: 'value'},
        count: 10,
      };

      const result = extractErrorInfo(complexObj);

      expect(result.type_code).toBe(4);
      expect(result.message).toContain('Complex Object');
      expect(result.message).toContain('Test Object');
    });

    it('should handle objects with circular references', () => {
      const circularObj = createCircularObject();
      const result = extractErrorInfo(circularObj);

      expect(result.type_code).toBe(4);
      expect(result.message).toContain('Complex Object');
      expect(result.message).toContain('circular');
      expect(result.message).toContain('Serialization Failed');
    });

    it('should handle functions', () => {
      const func = () => 'test';
      const result = extractErrorInfo(func);

      expect(result.type_code).toBe(4);
      expect(result.message).toContain('Complex Object');
      expect(result.message).toContain('Function');
    });

    it('should handle BigInt', () => {
      const bigIntValue = BigInt(Number.MAX_SAFE_INTEGER) + BigInt(1);
      const objWithBigInt = {value: bigIntValue, type: 'bigint'};

      const result = extractErrorInfo(objWithBigInt);

      expect(result.type_code).toBe(4);
      expect(result.message).toContain('Complex Object');
      expect(result.message).toContain('Serialization Failed');
    });

    it('should handle Proxy objects that throw on property access', () => {
      const throwingProxy = new Proxy(
        {},
        {
          get() {
            throw new Error('Proxy access denied');
          },
          ownKeys() {
            throw new Error('Cannot enumerate keys');
          },
        },
      );

      const result = extractErrorInfo(throwingProxy);

      expect(result.type_code).toBe(4);
      expect(result.message).toContain('Complex Object');
      expect(result.message).toContain('Serialization Failed');
    });
  });
});

// ============================
// ensureDOMException 测试
// ============================
describe.concurrent('ensureDOMException Tests', () => {
  describe('When DOMException constructor is available', () => {
    it('should return DOMException unchanged (type_code: 1)', () => {
      const originalDOMException = new DOMException('Original', 'AbortError');
      originalDOMException.cause = {some: 'data'};

      const result = ensureDOMException(originalDOMException);

      expect(result).toBe(originalDOMException);
      expect(result.name).toBe('AbortError'); // 应该是 AbortError
      expect(result.message).toBe('Original');
      expect(result.cause).toEqual({some: 'data'});
    });

    it('should wrap non-AbortError DOMException (type_code: 1)', () => {
      const domException = new DOMException('Error', 'SyntaxError');
      const result = ensureDOMException(domException);

      expect(result).toBe(domException);
      expect(result).toBeInstanceOf(DOMException);
    });

    it('should wrap standard Error with stack trace preserved (type_code: 0)', () => {
      const originalError = new Error('Standard error');
      originalError.stack = 'Error stack trace line 1\nline 2';

      const result = ensureDOMException(originalError);

      expect(result).toBeInstanceOf(DOMException);
      expect(result.message).toBe('Standard error');
      expect(result.stack).toBe('Error stack trace line 1\nline 2');
      expect(result.cause).toBe(originalError);
    });

    it('should wrap null/undefined with informative message (type_code: 2)', () => {
      const resultFromNull = ensureDOMException(null);
      const resultFromUndefined = ensureDOMException(undefined);

      expect(resultFromNull).toBeInstanceOf(DOMException);
      expect(resultFromNull.message).toContain('DOMException Wrapped');
      expect(resultFromNull.message).toContain('null/undefined error');
      expect(resultFromNull.cause).toBeNull();

      expect(resultFromUndefined.cause).toBeUndefined();
    });

    it('should wrap error-like objects with message property (type_code: 3)', () => {
      const result = ensureDOMException(errorLikeObject);

      expect(result).toBeInstanceOf(DOMException);
      expect(result.message).toContain('DOMException Wrapped');
      expect(result.message).toContain('This is an error-like object');
      expect(result.cause).toBe(errorLikeObject);
    });

    it('should wrap primitive values (type_code: 4)', () => {
      const result = ensureDOMException('Simple string error');

      expect(result).toBeInstanceOf(DOMException);
      expect(result.message).toContain('DOMException Wrapped');
      expect(result.message).toContain('Primitive [string]');
      expect(result.cause).toBe('Simple string error');
    });

    it('should wrap complex objects (type_code: 4)', () => {
      const complexObj = {data: 'test', nested: {value: 1}};
      const result = ensureDOMException(complexObj);

      expect(result).toBeInstanceOf(DOMException);
      expect(result.message).toContain('DOMException Wrapped');
      expect(result.message).toContain('Complex Object');
      expect(result.cause).toBe(complexObj);
    });
  });

  describe('Edge Cases and Security', () => {
    it('should skip stack assignment if stack is missing or not a string', () => {
      const errorWithoutStack = new Error('No stack here');
      // 暴力删掉 stack 属性，或者设置成非字符串
      // @ts-ignore
      delete errorWithoutStack.stack;

      const result = ensureDOMException(errorWithoutStack);

      expect(result).toBeInstanceOf(DOMException);
      expect(result.message).toBe('No stack here');
      // 此时 result.stack 应该是 DOMException 默认生成的，而不是来自原 error
    });

    it('should skip stack assignment if stack is not a string', () => {
      const errorWithFakeStack = new Error('Fake stack');
      // @ts-ignore
      errorWithFakeStack.stack = {not: 'a string'};

      const result = ensureDOMException(errorWithFakeStack);
      expect(result.stack).not.toEqual(errorWithFakeStack.stack);
    });

    it('should handle objects with Symbol.toStringTag', () => {
      const exoticObject = {
        [Symbol.toStringTag]: 'ExoticObject',
        data: 'secret',
      };

      const result = ensureDOMException(exoticObject);

      expect(result).toBeInstanceOf(DOMException);
      expect(result.message).toContain('ExoticObject');
    });
  });
});

// ============================
// ensureError 测试
// ============================
describe.concurrent('ensureError Tests', () => {
  it('should return DOMException unchanged (type_code: 1)', () => {
    const domException = new DOMException('Test', 'AbortError'); // 必须是 AbortError
    const result = ensureError(domException);

    expect(result).toBe(domException);
    expect(result).toBeInstanceOf(DOMException);
  });

  it('should return non-AbortError DOMException unchanged', () => {
    const domException = new DOMException('Test', 'SyntaxError');
    const result = ensureError(domException);

    expect(result).toBe(domException); // 直接返回，因为 type_code 是 0
    expect(result).toBeInstanceOf(DOMException);
  });

  it('should return standard Error unchanged (type_code: 0)', () => {
    const standardError = new Error('Standard');
    const result = ensureError(standardError);

    expect(result).toBe(standardError);
    expect(result).toBeInstanceOf(Error);
  });

  it('should wrap null/undefined values (type_code: 2)', () => {
    const resultFromNull = ensureError(null);
    const resultFromUndefined = ensureError(undefined);

    expect(resultFromNull).toBeInstanceOf(Error);
    expect(resultFromNull.message).toContain(
      'An unknown or null/undefined error occurred.',
    );
    expect(resultFromNull.cause).toBeNull();

    expect(resultFromUndefined.cause).toBeUndefined();
  });

  it('should wrap error-like objects (type_code: 3)', () => {
    const result = ensureError(errorLikeObject);

    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe('This is an error-like object');
    expect(result.cause).toBe(errorLikeObject);
  });

  it('should wrap primitive values with "Wrapped:" prefix (type_code: 4)', () => {
    const result = ensureError(12345);

    expect(result).toBeInstanceOf(Error);
    expect(result.message).toContain('Wrapped:');
    expect(result.message).toContain('Primitive [number]');
    expect(result.cause).toBe(12345);
  });

  it('should wrap complex objects with "Wrapped:" prefix (type_code: 4)', () => {
    const complexObj = {complex: true, data: [1, 2, 3]};
    const result = ensureError(complexObj);

    expect(result).toBeInstanceOf(Error);
    expect(result.message).toContain('Wrapped:');
    expect(result.message).toContain('Complex Object');
    expect(result.cause).toBe(complexObj);
  });
});

// ============================
// UnknownError 类测试
// ============================
describe.concurrent('UnknownError Class Tests', () => {
  describe('Constructor', () => {
    it('should wrap primitive values', () => {
      const unknownError = new UnknownError('String error');

      expect(unknownError).toBeInstanceOf(UnknownError);
      expect(unknownError).toBeInstanceOf(Error);
      expect(unknownError.name).toBe('UnknownError');
      expect(unknownError.message).toContain('String error');
      expect(unknownError.cause).toBe('String error');
      expect(unknownError.stack).toBeDefined();
    });

    it('should use custom message when provided', () => {
      const unknownError = new UnknownError(
        new Error('Internal error'),
        'Custom: Something went wrong',
      );

      expect(unknownError.message).toBe('Custom: Something went wrong');
      expect(unknownError.cause).toBeInstanceOf(Error);
    });

    it('should handle null/undefined raw_error with default message', () => {
      const unknownError1 = new UnknownError(null);
      const unknownError2 = new UnknownError(undefined, 'Explicit message');

      expect(unknownError1.message).toContain('null/undefined error');
      expect(unknownError1.cause).toBeNull();

      expect(unknownError2.message).toBe('Explicit message');
      expect(unknownError2.cause).toBeUndefined();
    });

    it('should capture stack trace when Error.captureStackTrace is available', () => {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const originalCaptureStackTrace = Error.captureStackTrace;
      const mockCaptureStackTrace = vi.fn();
      Error.captureStackTrace = mockCaptureStackTrace;

      try {
        const unknownError = new UnknownError('test');
        expect(mockCaptureStackTrace).toHaveBeenCalledWith(
          unknownError,
          UnknownError,
        );
      } finally {
        Error.captureStackTrace = originalCaptureStackTrace;
      }
    });
  });

  describe('Static from() method', () => {
    it('should create UnknownError instance using static method', () => {
      const error = new Error('Test');
      const unknownError = UnknownError.from(error, 'Wrapped error');

      expect(unknownError).toBeInstanceOf(UnknownError);
      expect(unknownError.cause).toBe(error);
      expect(unknownError.message).toBe('Wrapped error');
    });

    it('should be equivalent to constructor call', () => {
      const rawError = 'error string';
      const fromResult = UnknownError.from(rawError, 'Message');
      const constructorResult = new UnknownError(rawError, 'Message');

      expect(fromResult).toBeInstanceOf(UnknownError);
      expect(fromResult.constructor).toBe(constructorResult.constructor);
      expect(fromResult.cause).toBe(constructorResult.cause);
    });
  });

  describe('toString() method', () => {
    it('should format error with Error cause correctly', () => {
      const cause = new Error('Root cause');
      cause.stack = 'Stack trace'; // 模拟 stack

      const unknownError = new UnknownError(cause, 'Top level');
      const stringRepresentation = unknownError.toString();

      expect(stringRepresentation).toContain('UnknownError: Top level');
      expect(stringRepresentation).toContain('Caused by:');
      expect(stringRepresentation).toContain('Error: Root cause');
    });

    it('should format error with non-Error cause correctly', () => {
      const unknownError = new UnknownError({code: 500, message: 'Internal'});
      const stringRepresentation = unknownError.toString();

      expect(stringRepresentation).toContain('UnknownError');
      expect(stringRepresentation).toContain('Caused by:');
      expect(stringRepresentation).toContain('[object Object]');
    });

    it('should handle primitive causes', () => {
      const unknownError = new UnknownError('Simple string');
      const stringRepresentation = unknownError.toString();

      expect(stringRepresentation).toContain('Caused by: Simple string');
    });
  });

  describe('Error Chain Preservation', () => {
    it('should maintain full error chain', () => {
      const rootCause = new Error('Root');
      const middleError = new UnknownError(rootCause, 'Middle');
      const topError = new UnknownError(middleError, 'Top');

      expect(topError.cause).toBe(middleError);
      expect(middleError.cause).toBe(rootCause);

      const topString = topError.toString();
      expect(topString).toContain('Top');
      expect(topString).toContain('Middle');
      expect(topString).toContain('Root');
    });

    it('should work with complex nested causes', () => {
      const complexCause = {
        original: new Error('Original'),
        metadata: {time: 'now', user: 'test'},
      };

      const wrapped1 = new UnknownError(complexCause, 'First wrap');
      const wrapped2 = new UnknownError(wrapped1, 'Second wrap');

      expect(wrapped2.cause).toBe(wrapped1);
      expect(wrapped1.cause).toBe(complexCause);
    });
  });
});
