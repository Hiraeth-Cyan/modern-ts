// ========================================
// ./src/Other/secret.spec.ts
// ========================================

import {describe, it, expect, vi} from 'vitest';
import {Secret, SecretError} from './secret';

// ============================
// 构造函数与静态方法测试
// ============================
describe.concurrent('Constructor & Static Methods Tests', () => {
  describe('Secret.make', () => {
    it('should create a Secret instance using make factory method', () => {
      const secret = Secret.make('test-value');
      expect(secret).toBeInstanceOf(Secret);
    });

    it('should create a Secret instance using constructor', () => {
      const secret = new Secret('constructor-value');
      expect(secret).toBeInstanceOf(Secret);
    });

    it('should handle different value types', () => {
      const stringSecret = Secret.make('string');
      const numberSecret = Secret.make(42);
      const objectSecret = Secret.make({key: 'value'});
      const arraySecret = Secret.make([1, 2, 3]);
      const nullSecret = Secret.make(null);
      const undefinedSecret = Secret.make(undefined);

      expect(Secret.reveal(stringSecret)).toBe('string');
      expect(Secret.reveal(numberSecret)).toBe(42);
      expect(Secret.reveal(objectSecret)).toEqual({key: 'value'});
      expect(Secret.reveal(arraySecret)).toEqual([1, 2, 3]);
      expect(Secret.reveal(nullSecret)).toBeNull();
      expect(Secret.reveal(undefinedSecret)).toBeUndefined();
    });
  });

  describe('Secret.reveal', () => {
    it('should reveal the original stored value', () => {
      const testValue = 'top-secret';
      const secret = Secret.make(testValue);
      expect(Secret.reveal(secret)).toBe(testValue);
    });

    it('should throw SecretError when revealing destroyed secret', () => {
      const secret = Secret.make('to-be-destroyed');
      Secret.destroy(secret);

      expect(() => Secret.reveal(secret)).toThrow(SecretError);
      expect(() => Secret.reveal(secret)).toThrow(
        'Attempt to access the deleted secret value.',
      );
    });
  });

  describe('Secret.destroy', () => {
    it('should destroy the secret value', () => {
      const secret = Secret.make('temporary-secret');
      expect(Secret.reveal(secret)).toBe('temporary-secret');

      Secret.destroy(secret);
      expect(() => Secret.reveal(secret)).toThrow(SecretError);
    });

    it('should handle multiple destroy calls gracefully', () => {
      const secret = Secret.make('multi-destroy');
      Secret.destroy(secret);
      Secret.destroy(secret); // Should not throw
      expect(() => Secret.reveal(secret)).toThrow(SecretError);
    });
  });
});

// ============================
// 清理函数执行测试
// ============================
describe.concurrent('Cleanup Execution Tests', () => {
  describe('Synchronous Cleanup (dispose)', () => {
    it('should execute callback with revealed value', () => {
      const secret = Secret.make('dispose-test');
      const mockCallback = vi.fn((value: string) => value.toUpperCase());

      const result = Secret.dispose(secret, mockCallback);

      expect(mockCallback).toHaveBeenCalledTimes(1);
      expect(mockCallback).toHaveBeenCalledWith('dispose-test');
      expect(result).toBe('DISPOSE-TEST');
    });

    it('should destroy secret after callback execution', () => {
      const secret = Secret.make('post-dispose');

      Secret.dispose(secret, (value) => {
        expect(value).toBe('post-dispose');
        return null;
      });

      expect(() => Secret.reveal(secret)).toThrow(SecretError);
    });

    it('should destroy secret even when callback throws', () => {
      const secret = Secret.make('error-handling');
      const error = new Error('Callback failed');

      expect(() => {
        Secret.dispose(secret, () => {
          throw error;
        });
      }).toThrow(error);

      expect(() => Secret.reveal(secret)).toThrow(SecretError);
    });

    it('should work with complex return types', () => {
      const secret = Secret.make({username: 'admin', password: '123'});

      const result = Secret.dispose(secret, (credentials) => ({
        ...credentials,
        authenticated: true,
        timestamp: Date.now(),
      }));

      expect(result).toMatchObject({
        username: 'admin',
        password: '123',
        authenticated: true,
      });
      expect(typeof result.timestamp).toBe('number');
    });
  });

  describe('Asynchronous Cleanup (disposeAsync)', () => {
    it('should execute async callback with revealed value', async () => {
      const secret = Secret.make('async-test');
      const mockAsyncCallback = vi.fn(async (value) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return value + '-processed';
      });

      const result = await Secret.disposeAsync(secret, mockAsyncCallback);

      expect(mockAsyncCallback).toHaveBeenCalledTimes(1);
      expect(mockAsyncCallback).toHaveBeenCalledWith('async-test');
      expect(result).toBe('async-test-processed');
    });

    it('should destroy secret after async callback resolves', async () => {
      const secret = Secret.make('async-cleanup');

      await Secret.disposeAsync(secret, async (value) => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        return value.length;
      });

      expect(() => Secret.reveal(secret)).toThrow(SecretError);
    });

    it('should destroy secret when async callback rejects', async () => {
      const secret = Secret.make('async-reject');
      const error = new Error('Async failure');

      await expect(
        Secret.disposeAsync(secret, async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          throw error;
        }),
      ).rejects.toThrow(error);

      expect(() => Secret.reveal(secret)).toThrow(SecretError);
    });

    it('should handle multiple concurrent disposals independently', async () => {
      const secret1 = Secret.make('secret-1');
      const secret2 = Secret.make('secret-2');

      const [result1, result2] = await Promise.all([
        Secret.disposeAsync(secret1, async (val) => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          return val + '-a';
        }),
        Secret.disposeAsync(secret2, async (val) => {
          await new Promise((resolve) => setTimeout(resolve, 30));
          return val + '-b';
        }),
      ]);

      expect(result1).toBe('secret-1-a');
      expect(result2).toBe('secret-2-b');
      expect(() => Secret.reveal(secret1)).toThrow(SecretError);
      expect(() => Secret.reveal(secret2)).toThrow(SecretError);
    });
  });
});

// ============================
// 防止意外转换和序列化测试
// ============================
describe.concurrent('Protection Against Accidental Exposure Tests', () => {
  describe('JSON Serialization Protection', () => {
    it('should throw SecretError when calling toJSON', () => {
      const secret = Secret.make('no-json');

      expect(() => secret.toJSON()).toThrow(SecretError);
      expect(() => secret.toJSON()).toThrow(
        'Secret values cannot be serialized via toJSON()',
      );
    });

    it('should prevent JSON.stringify serialization', () => {
      const secret = Secret.make({sensitive: 'data'});
      const objectContainingSecret = {
        public: 'info',
        secret: secret,
      };

      expect(() => JSON.stringify(objectContainingSecret)).toThrow(SecretError);
    });
  });

  describe('String Conversion Protection', () => {
    it('should throw SecretError when calling toString', () => {
      const secret = Secret.make('no-string');

      expect(() => secret.toString()).toThrow(SecretError);
      expect(() => secret.toString()).toThrow(
        'Secret values cannot be converted to String via toString()',
      );
    });

    it('should throw SecretError when using String() constructor', () => {
      const secret = Secret.make('no-string-constructor');

      expect(() => String(secret)).toThrow(SecretError);
    });
  });

  describe('Primitive Conversion Protection', () => {
    it('should throw SecretError when calling valueOf', () => {
      const secret = Secret.make(42);

      expect(() => secret.valueOf()).toThrow(SecretError);
      expect(() => secret.valueOf()).toThrow(
        'Secret values cannot be converted to Primitive via valueOf()',
      );
    });

    it('should throw SecretError for Symbol.toPrimitive with different hints', () => {
      const secret = Secret.make('primitive-test');

      // Test with 'string' hint
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      expect(() => `${secret}`).toThrow(SecretError);
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      expect(() => `${secret}`).toThrow(
        'Secret values cannot be converted to Primitive via [Symbol.toPrimitive] (Hint: string)',
      );

      // Test with 'number' hint
      expect(() => +secret).toThrow(SecretError);
      expect(() => +secret).toThrow(
        'Secret values cannot be converted to Primitive via [Symbol.toPrimitive] (Hint: number)',
      );

      // Test with 'default' hint
      // @ts-ignore
      expect(() => secret == 'anything').toThrow(SecretError);
      // @ts-ignore
      expect(() => secret == 'anything').toThrow(
        'Secret values cannot be converted to Primitive via [Symbol.toPrimitive] (Hint: default)',
      );
    });

    it('should prevent Number() and other conversions', () => {
      const secret = Secret.make(123);

      expect(() => Number(secret)).toThrow(SecretError);
      expect(() => +secret).toThrow(SecretError);
    });
  });

  describe('Inspection Protection', () => {
    it('should throw SecretError when accessing Symbol.toStringTag', () => {
      const secret = Secret.make('no-inspect');

      expect(() => secret[Symbol.toStringTag]).toThrow(SecretError);
      expect(() => secret[Symbol.toStringTag]).toThrow(
        'Secret values cannot be inspected via [Symbol.toStringTag]',
      );
    });

    it('should prevent Object.prototype.toString.call inspection', () => {
      const secret = Secret.make('hidden');

      expect(() => Object.prototype.toString.call(secret)).toThrow(SecretError);
    });
  });

  describe('Console and Logging Protection', () => {
    it('should prevent exposure in console.log', () => {
      const secret = Secret.make('console-secret');

      expect(() => console.log(secret)).toThrow(SecretError);
      expect(() => console.log('Secret:', secret)).toThrow(SecretError);
    });

    it('should prevent exposure in console.dir', () => {
      const secret = Secret.make('dir-secret');

      expect(() =>
        console.dir(secret, {showHidden: true, customInspect: true}),
      ).toThrow(SecretError);
    });

    it('should prevent exposure in template literals', () => {
      const secret = Secret.make('template-secret');
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      expect(() => `Secret is: ${secret}`).toThrow(SecretError);
    });
  });
});

// ============================
// Using声明测试
// ============================
describe.concurrent('Using Declaration Tests', () => {
  describe('Synchronous using', () => {
    it('should automatically destroy secret when using block exits normally', () => {
      let secretRef: Secret<string>;

      {
        using secret = Secret.make('using-test');
        secretRef = secret;
        expect(Secret.reveal(secret)).toBe('using-test');
      } // Symbol.dispose should be called here

      expect(() => Secret.reveal(secretRef!)).toThrow(SecretError);
    });

    it('should automatically destroy secret when using block throws', () => {
      let secretRef: Secret<string>;

      try {
        using secret = Secret.make('using-error');
        secretRef = secret;
        throw new Error('Intentional error');
      } catch (error) {
        // Symbol.dispose should have been called during stack unwinding
        expect(() => Secret.reveal(secretRef!)).toThrow(SecretError);
        expect((error as Error).message).toBe('Intentional error');
      }
    });

    it('should allow nested using blocks', () => {
      const outerSecretRefs: Secret<string>[] = [];

      {
        using outerSecret = Secret.make('outer');
        outerSecretRefs.push(outerSecret);

        {
          using innerSecret = Secret.make('inner');
          outerSecretRefs.push(innerSecret);
          expect(Secret.reveal(innerSecret)).toBe('inner');
        }

        expect(Secret.reveal(outerSecret)).toBe('outer');
        expect(() => Secret.reveal(outerSecretRefs[1])).toThrow(SecretError);
      }

      expect(() => Secret.reveal(outerSecretRefs[0])).toThrow(SecretError);
    });
  });

  describe('Manual Symbol.dispose and Symbol.asyncDispose', () => {
    it('should destroy secret when Symbol.dispose is called', () => {
      const secret = Secret.make('manual-dispose');
      expect(Secret.reveal(secret)).toBe('manual-dispose');

      secret[Symbol.dispose]();

      expect(() => Secret.reveal(secret)).toThrow(SecretError);
    });
  });
});

// ============================
// 边界条件和错误处理测试
// ============================
describe.concurrent('Edge Cases & Error Handling Tests', () => {
  it('should handle empty string values', () => {
    const secret = Secret.make('');
    expect(Secret.reveal(secret)).toBe('');
  });

  it('should handle zero number values', () => {
    const secret = Secret.make(0);
    expect(Secret.reveal(secret)).toBe(0);
  });

  it('should handle false boolean values', () => {
    const secret = Secret.make(false);
    expect(Secret.reveal(secret)).toBe(false);
  });

  it('should maintain separate instances with same value', () => {
    const value = 'shared-value';
    const secret1 = Secret.make(value);
    const secret2 = Secret.make(value);

    Secret.destroy(secret1);
    expect(() => Secret.reveal(secret1)).toThrow(SecretError);
    expect(Secret.reveal(secret2)).toBe(value);
  });

  it('should handle large objects efficiently', () => {
    const largeObject = {
      data: 'x'.repeat(10000),
      nested: {
        level1: {
          level2: {
            level3: 'deep',
          },
        },
      },
      array: new Array(1000).fill(0).map((_, i) => i),
    };

    const secret = Secret.make(largeObject);
    const revealed = Secret.reveal(secret);

    expect(revealed.data.length).toBe(10000);
    expect(revealed.nested.level1.level2.level3).toBe('deep');
    expect(revealed.array.length).toBe(1000);
  });

  it('should work with Symbols as values', () => {
    const sym = Symbol('unique');
    const secret = Secret.make(sym);
    expect(Secret.reveal(secret)).toBe(sym);
  });

  it('should work with functions as values', () => {
    const fn = () => 'result';
    const secret = Secret.make(fn);
    expect(Secret.reveal(secret)).toBe(fn);
    expect(Secret.reveal(secret)()).toBe('result');
  });
});
