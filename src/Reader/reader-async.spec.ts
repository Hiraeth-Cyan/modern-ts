// ========================================
// ./src/Reader/reader-async.spec.ts
// ========================================
/* eslint-disable @typescript-eslint/require-await */
import {describe, it, expect, vi} from 'vitest';
import type {AsyncReader} from './types';
import {
  ofAsync,
  askAsync,
  mapAsync,
  anThenAsync,
  apAsync,
  tapAsync,
  liftA2Async,
  liftA3Async,
} from './reader-async';

// 模拟环境类型
type TestEnv = {
  userId: string;
  config: {debug: boolean};
  token: string;
};

// ============================
// 基本构造与查询测试
// ============================
describe.concurrent('AsyncReader Basic Tests', () => {
  describe('ofAsync', () => {
    it('should create an AsyncReader that ignores environment and returns the given value', async () => {
      const env: TestEnv = {
        userId: 'test-123',
        config: {debug: true},
        token: 'abc123',
      };

      const reader = ofAsync<TestEnv, string>('hello world');
      const result = await reader(env);

      expect(result).toBe('hello world');
    });

    it('should work with different value types', async () => {
      const env = {};

      // eslint-disable-next-line @typescript-eslint/no-empty-object-type
      const reader1 = ofAsync<{}, number>(42);
      // eslint-disable-next-line @typescript-eslint/no-empty-object-type
      const reader2 = ofAsync<{}, boolean>(true);
      // eslint-disable-next-line @typescript-eslint/no-empty-object-type
      const reader3 = ofAsync<{}, {data: string}>({data: 'test'});

      expect(await reader1(env)).toBe(42);
      expect(await reader2(env)).toBe(true);
      expect(await reader3(env)).toEqual({data: 'test'});
    });
  });

  describe('askAsync', () => {
    it('should create an AsyncReader that returns the environment', async () => {
      const env: TestEnv = {
        userId: 'user-789',
        config: {debug: false},
        token: 'xyz789',
      };

      const reader = askAsync<TestEnv>();
      const result = await reader(env);

      expect(result).toBe(env);
      expect(result.userId).toBe('user-789');
      expect(result.config.debug).toBe(false);
    });

    it('should work with primitive environment types', async () => {
      const env = 'simple string';
      const reader = askAsync<string>();
      expect(await reader(env)).toBe('simple string');
    });
  });
});

// ============================
// Functor 操作测试 (mapAsync)
// ============================
describe.concurrent('Functor Operations Tests', () => {
  describe('mapAsync', () => {
    it('should transform the value inside AsyncReader', async () => {
      const env = {count: 5};
      const baseReader: AsyncReader<typeof env, number> = async () => 10;

      const squaredReader = mapAsync(baseReader, (x: number) => x * x);
      const stringReader = mapAsync(baseReader, (x: number) => `value: ${x}`);

      expect(await squaredReader(env)).toBe(100);
      expect(await stringReader(env)).toBe('value: 10');
    });

    it('should preserve the environment', async () => {
      const env = {multiplier: 3};
      const reader: AsyncReader<typeof env, number> = async (e) => {
        return e.multiplier * 2;
      };

      const mappedReader = mapAsync(reader, (x) => x + 1);
      const result = await mappedReader(env);

      expect(result).toBe(7); // (3 * 2) + 1
    });

    it('should work with async transformations', async () => {
      const env = {};
      // eslint-disable-next-line @typescript-eslint/no-empty-object-type
      const baseReader = ofAsync<{}, number>(5);

      const asyncMapped = mapAsync(baseReader, async (x) => {
        return x * 3;
      });

      const result = await asyncMapped(env);
      expect(result).toBe(15);
    });
  });
});

// ============================
// Monad 操作测试 (anThenAsync)
// ============================
describe.concurrent('Monad Operations Tests', () => {
  describe('anThenAsync', () => {
    it('should chain two AsyncReader computations', async () => {
      const env = {base: 2};

      const firstReader: AsyncReader<typeof env, number> = async (e) => {
        return e.base * 10;
      };

      const chainedReader = anThenAsync(firstReader, (firstResult) => {
        // 使用第一个结果创建第二个Reader
        const secondReader: AsyncReader<typeof env, string> = async (e) => {
          return `Result: ${firstResult + e.base}`;
        };
        return secondReader;
      });

      const result = await chainedReader(env);
      expect(result).toBe('Result: 22'); // (2 * 10) + 2
    });

    it('should support async computations in both stages', async () => {
      const env = {factor: 3};

      const reader1: AsyncReader<typeof env, number> = async (e) => {
        return e.factor * 5;
      };

      const reader2 = anThenAsync(reader1, (val) => {
        const newReader: AsyncReader<typeof env, string> = async (e) => {
          return `${val} * ${e.factor} = ${val * e.factor}`;
        };
        return newReader;
      });

      const result = await reader2(env);
      expect(result).toBe('15 * 3 = 45');
    });

    it('should handle errors in chained computations', async () => {
      const env = {};

      const failingReader: AsyncReader<typeof env, number> = async () => {
        throw new Error('First stage failed');
      };

      const chained = anThenAsync(failingReader, () =>
        ofAsync<typeof env, string>('success'),
      );

      await expect(chained(env)).rejects.toThrow('First stage failed');
    });
  });
});

// ============================
// Applicative 操作测试 (apAsync)
// ============================
describe.concurrent('Applicative Operations Tests', () => {
  describe('apAsync', () => {
    it('should apply a function inside AsyncReader to a value inside AsyncReader', async () => {
      const env = {};

      // AsyncReader 包含一个函数
      const fnReader: AsyncReader<typeof env, (x: number) => string> =
        async () => (x: number) =>
          `Number: ${x}`;

      // AsyncReader 包含一个值
      const valueReader: AsyncReader<typeof env, number> = async () => 42;

      const appliedReader = apAsync(fnReader, valueReader);
      const result = await appliedReader(env);

      expect(result).toBe('Number: 42');
    });

    it('should preserve environment for both readers', async () => {
      type Env = {prefix: string; suffix: string};
      const env: Env = {prefix: 'Mr.', suffix: 'Esq.'};

      const fnReader: AsyncReader<Env, (name: string) => string> =
        async (e) => (name: string) =>
          `${e.prefix} ${name}`;

      const valueReader: AsyncReader<Env, string> = async (e) =>
        `John ${e.suffix}`;

      const applied = apAsync(fnReader, valueReader);
      const result = await applied(env);

      expect(result).toBe('Mr. John Esq.');
    });
  });
});

// ============================
// 副作用操作测试 (tapAsync)
// ============================
describe.concurrent('Side Effect Operations Tests', () => {
  describe('tapAsync', () => {
    it('should perform side effect and return original value', async () => {
      const env = {};
      const sideEffectMock = vi.fn();

      const baseReader: AsyncReader<typeof env, number> = async () => 100;

      const tappedReader = tapAsync(baseReader, (value) => {
        sideEffectMock(value);
        return ofAsync(undefined);
      });

      const result = await tappedReader(env);

      expect(result).toBe(100);
      expect(sideEffectMock).toHaveBeenCalledWith(100);
      expect(sideEffectMock).toHaveBeenCalledTimes(1);
    });

    it('should ignore the return value of side effect', async () => {
      const env = {};

      const baseReader = ofAsync<typeof env, number>(42);

      const tappedReader = tapAsync(baseReader, () => {
        return ofAsync('side effect value');
      });

      const result = await tappedReader(env);
      expect(result).toBe(42);
    });

    it('should propagate errors from the main reader', async () => {
      const env = {};
      const sideEffectMock = vi.fn();

      const failingReader: AsyncReader<typeof env, number> = async () => {
        throw new Error('Main computation failed');
      };

      const tappedReader = tapAsync(failingReader, () => {
        sideEffectMock();
        return ofAsync(undefined);
      });

      await expect(tappedReader(env)).rejects.toThrow(
        'Main computation failed',
      );
      expect(sideEffectMock).not.toHaveBeenCalled();
    });

    it('should propagate errors from side effect', async () => {
      const env = {};

      const baseReader = ofAsync<typeof env, string>('data');

      const tappedReader = tapAsync(baseReader, () => {
        throw new Error('Side effect failed');
      });

      await expect(tappedReader(env)).rejects.toThrow('Side effect failed');
    });
  });
});

// ============================
// 提升操作测试 (liftA2Async, liftA3Async)
// ============================
describe.concurrent('Lift Operations Tests', () => {
  describe('liftA2Async', () => {
    it('should lift a binary function into AsyncReader context', async () => {
      const env = {};

      const readerA = ofAsync<typeof env, number>(5);
      const readerB = ofAsync<typeof env, number>(7);

      const addReader = liftA2Async<typeof env, number, number, number>(
        (a, b) => a + b,
      );

      const resultReader = addReader(readerA, readerB);
      const result = await resultReader(env);

      expect(result).toBe(12);
    });

    it('should execute readers concurrently', async () => {
      const env = {};
      let readerAExecuted = false;
      let readerBExecuted = false;

      const readerA: AsyncReader<typeof env, number> = async () => {
        // 使用microtask代替setTimeout
        await Promise.resolve();
        readerAExecuted = true;
        return 10;
      };

      const readerB: AsyncReader<typeof env, number> = async () => {
        await Promise.resolve();
        readerBExecuted = true;
        return 20;
      };

      const multiplyReader = liftA2Async<typeof env, number, number, number>(
        (a, b) => a * b,
      );

      const startTime = Date.now();
      const result = await multiplyReader(readerA, readerB)(env);
      const elapsedTime = Date.now() - startTime;

      expect(result).toBe(200);
      expect(readerAExecuted).toBe(true);
      expect(readerBExecuted).toBe(true);
      expect(elapsedTime).toBeLessThan(10);
    });

    it('should use environment from all readers', async () => {
      type Env = {multiplier: number; offset: number};
      const env: Env = {multiplier: 3, offset: 5};

      const readerA: AsyncReader<Env, number> = async (e) => e.multiplier * 2;
      const readerB: AsyncReader<Env, number> = async (e) => e.offset * 3;

      const combineReader = liftA2Async<Env, number, number, string>(
        (a, b) => `${a}+${b}=${a + b}`,
      );

      const result = await combineReader(readerA, readerB)(env);
      expect(result).toBe('6+15=21');
    });
  });

  describe.concurrent('liftA3Async', () => {
    it('should lift a ternary function into AsyncReader context', async () => {
      const env = {};

      const readerA = ofAsync<typeof env, number>(2);
      const readerB = ofAsync<typeof env, number>(3);
      const readerC = ofAsync<typeof env, number>(4);

      const calculateReader = liftA3Async<
        typeof env,
        number,
        number,
        number,
        number
      >((a, b, c) => a * b + c);

      const result = await calculateReader(readerA, readerB, readerC)(env);
      expect(result).toBe(10);
    });

    it('should execute all three readers concurrently', async () => {
      const env = {};
      const executionFlags = [false, false, false];

      const createReader =
        (index: number, value: number): AsyncReader<typeof env, number> =>
        async () => {
          await Promise.resolve();
          executionFlags[index] = true;
          return value;
        };

      const readerA = createReader(0, 1);
      const readerB = createReader(1, 2);
      const readerC = createReader(2, 3);

      const sumReader = liftA3Async<typeof env, number, number, number, number>(
        (a, b, c) => a + b + c,
      );

      const startTime = Date.now();
      const result = await sumReader(readerA, readerB, readerC)(env);
      const elapsedTime = Date.now() - startTime;

      expect(result).toBe(6);
      expect(executionFlags.every((flag) => flag)).toBe(true);
      expect(elapsedTime).toBeLessThan(10);
    });

    it('should work with complex environment usage', async () => {
      type Env = {
        base: number;
        factor1: number;
        factor2: number;
        factor3: number;
      };

      const env: Env = {base: 10, factor1: 2, factor2: 3, factor3: 4};

      const readerA: AsyncReader<Env, number> = async (e) => e.base * e.factor1;
      const readerB: AsyncReader<Env, number> = async (e) => e.base * e.factor2;
      const readerC: AsyncReader<Env, number> = async (e) => e.base * e.factor3;

      const formulaReader = liftA3Async<Env, number, number, number, number>(
        (a, b, c) => (a + b) * c,
      );

      const result = await formulaReader(readerA, readerB, readerC)(env);
      expect(result).toBe((20 + 30) * 40);
    });
  });

  it('should compose liftA2Async and liftA3Async', async () => {
    const env = {};

    const readerA = ofAsync<typeof env, number>(1);
    const readerB = ofAsync<typeof env, number>(2);
    const readerC = ofAsync<typeof env, number>(3);
    const readerD = ofAsync<typeof env, number>(4);

    const intermediateReader = liftA2Async<typeof env, number, number, number>(
      (a, b) => a * b,
    )(readerA, readerB);

    const finalReader = liftA3Async<typeof env, number, number, number, number>(
      (ab, c, d) => ab + c + d,
    )(intermediateReader, readerC, readerD);

    const result = await finalReader(env);
    expect(result).toBe(1 * 2 + 3 + 4);
  });
});

// ============================
// 组合操作测试
// ============================
describe.concurrent('Composition Tests', () => {
  it('should compose multiple operations correctly', async () => {
    type UserEnv = {
      user: {id: string; name: string};
      settings: {currency: string};
    };

    const env: UserEnv = {
      user: {id: '123', name: 'John'},
      settings: {currency: 'USD'},
    };

    const getUser = askAsync<UserEnv>();

    const getFormattedUser = mapAsync(
      getUser,
      (env) => `${env.user.name} (${env.user.id})`,
    );

    const getGreeting = anThenAsync(getFormattedUser, (userInfo) => {
      const greetingReader: AsyncReader<UserEnv, string> = async (e) => {
        return `Hello ${userInfo} in ${e.settings.currency}`;
      };
      return greetingReader;
    });

    const getGreetingWithLog = tapAsync(getGreeting, () => {
      return ofAsync(undefined);
    });

    const result = await getGreetingWithLog(env);
    expect(result).toBe('Hello John (123) in USD');
  });

  it('should handle complex async transformations', async () => {
    const env = {apiKey: 'secret-123', timeout: 1000};

    const fetchData = async (): Promise<number[]> => {
      return [1, 2, 3];
    };

    const processData = async (data: number[]): Promise<number> => {
      return data.reduce((sum, num) => sum + num, 0);
    };

    const dataReader: AsyncReader<typeof env, number[]> = async () =>
      await fetchData();

    const processedReader = anThenAsync(dataReader, (data) => {
      return async (env) => {
        const result = await processData(data);
        const finalReader = ofAsync<typeof env, string>(`Sum: ${result}`);
        return finalReader(env);
      };
    });

    const result = await processedReader(env);
    expect(result).toBe('Sum: 6');
  });
});
