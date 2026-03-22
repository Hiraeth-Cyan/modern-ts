// ========================================
// ./src/Reader/reader.spec.ts
// ========================================
import {describe, it, expect, vi} from 'vitest';
import {of, ap, ask, map, anThen, tap, liftA2, liftA3} from './reader';
import type {Reader} from './types';

// ============================
// 测试辅助函数和类型
// ============================
type TestEnv = {
  config: {
    apiUrl: string;
    timeout: number;
  };
  user: {
    id: string;
    name: string;
  };
};

const testEnv: TestEnv = {
  config: {apiUrl: 'https://api.example.com', timeout: 5000},
  user: {id: 'user-123', name: 'Test User'},
};

const add = (a: number, b: number): number => a + b;
const multiply = (a: number, b: number): number => a * b;
const formatUser = (id: string, name: string, age: number): string =>
  `${name} (${id}, ${age} years old)`;

// ============================
// 基础构造与执行测试
// ============================
describe.concurrent('Basic Constructor & Execution Tests', () => {
  describe('of', () => {
    it('should create a Reader that ignores environment and returns the value', () => {
      const reader = of<TestEnv, string>('constant value');
      const result = reader(testEnv);

      expect(result).toBe('constant value');
    });

    it('should work with different types', () => {
      const numberReader = of<TestEnv, number>(42);
      const arrayReader = of<TestEnv, number[]>([1, 2, 3]);
      const objectReader = of<TestEnv, {key: string}>({key: 'value'});

      expect(numberReader(testEnv)).toBe(42);
      expect(arrayReader(testEnv)).toEqual([1, 2, 3]);
      expect(objectReader(testEnv)).toEqual({key: 'value'});
    });
  });

  describe('ask', () => {
    it('should create a Reader that returns the environment', () => {
      const envReader = ask<TestEnv>();
      const result = envReader(testEnv);

      expect(result).toBe(testEnv);
      expect(result.config.apiUrl).toBe('https://api.example.com');
      expect(result.user.id).toBe('user-123');
    });

    it('should return different environments when called with different envs', () => {
      const envReader = ask<TestEnv>();
      const env1: TestEnv = {
        config: {apiUrl: 'url1', timeout: 1000},
        user: {id: '1', name: 'User1'},
      };
      const env2: TestEnv = {
        config: {apiUrl: 'url2', timeout: 2000},
        user: {id: '2', name: 'User2'},
      };

      expect(envReader(env1)).toBe(env1);
      expect(envReader(env2)).toBe(env2);
    });
  });
});

// ============================
// Functor 操作测试 (map)
// ============================
describe.concurrent('Functor Operations Tests', () => {
  describe('map', () => {
    it('should transform the value inside Reader using the provided function', () => {
      const baseReader = of<TestEnv, number>(5);
      const squaredReader = map(baseReader, (x) => x * x);

      expect(squaredReader(testEnv)).toBe(25);
    });

    it('should chain multiple map operations', () => {
      const reader = of<TestEnv, number>(10);
      const result = map(
        map(reader, (x) => x * 2),
        (x) => x + 3,
      );

      expect(result(testEnv)).toBe(23);
    });

    it('should work with environment-dependent Readers', () => {
      const envDependentReader: Reader<TestEnv, string> = (env) =>
        `${env.user.name} - ${env.config.apiUrl}`;

      const transformedReader = map(envDependentReader, (str) =>
        str.toUpperCase(),
      );

      expect(transformedReader(testEnv)).toBe(
        'TEST USER - HTTPS://API.EXAMPLE.COM',
      );
    });

    it('should preserve functor laws (identity)', () => {
      const reader = ask<TestEnv>();
      const mappedReader = map(reader, (x) => x);

      expect(mappedReader(testEnv)).toEqual(reader(testEnv));
    });

    it('should preserve functor laws (composition)', () => {
      const f = (x: number) => x + 1;
      const g = (x: number) => x * 2;

      const reader = of<TestEnv, number>(5);
      const mapFthenG = map(map(reader, f), g);
      const mapComposed = map(reader, (x) => g(f(x)));

      expect(mapFthenG(testEnv)).toBe(mapComposed(testEnv));
    });
  });
});

// ============================
// Applicative 操作测试 (ap, liftA2, liftA3)
// ============================
describe.concurrent('Applicative Operations Tests', () => {
  describe('ap', () => {
    it('should apply a function inside Reader to a value inside Reader', () => {
      const functionReader = of<TestEnv, (x: number) => number>((x) => x * 3);
      const valueReader = of<TestEnv, number>(7);
      const appliedReader = ap(functionReader, valueReader);

      expect(appliedReader(testEnv)).toBe(21);
    });

    it('should work with curried functions', () => {
      const curriedAddReader = of<
        TestEnv,
        (a: number) => (b: number) => number
      >((a) => (b) => a + b);
      const readerA = of<TestEnv, number>(10);
      const readerB = of<TestEnv, number>(20);

      const partialReader = ap(curriedAddReader, readerA);
      const finalReader = ap(partialReader, readerB);

      expect(finalReader(testEnv)).toBe(30);
    });

    it('should handle environment-dependent functions and values', () => {
      const envFunctionReader: Reader<TestEnv, (x: number) => number> =
        (env) => (x) =>
          x + env.config.timeout;
      const envValueReader: Reader<TestEnv, number> = (env) =>
        env.user.id.length;

      const appliedReader = ap(envFunctionReader, envValueReader);

      expect(appliedReader(testEnv)).toBe(8 + 5000); // 'user-123'.length = 8
    });
  });

  describe('liftA2', () => {
    it('should lift a binary function into Reader context', () => {
      const readerA = of<TestEnv, number>(5);
      const readerB = of<TestEnv, number>(3);
      const liftedAdd = liftA2<TestEnv, number, number, number>(add);

      expect(liftedAdd(readerA, readerB)(testEnv)).toBe(8);
    });

    it('should work with different value types', () => {
      const stringReader = of<TestEnv, string>('Hello, ');
      const nameReader = of<TestEnv, string>('Alice');
      const concatFn = (a: string, b: string) => a + b;

      const liftedConcat = liftA2<TestEnv, string, string, string>(concatFn);

      expect(liftedConcat(stringReader, nameReader)(testEnv)).toBe(
        'Hello, Alice',
      );
    });

    it('should handle environment-dependent Readers', () => {
      const timeoutReader: Reader<TestEnv, number> = (env) =>
        env.config.timeout;
      const multiplierReader: Reader<TestEnv, number> = (env) =>
        env.user.name.length;

      const liftedMultiply = liftA2<TestEnv, number, number, number>(multiply);

      expect(liftedMultiply(timeoutReader, multiplierReader)(testEnv)).toBe(
        5000 * 9,
      ); // 'Test User'.length = 9
    });
  });

  describe('liftA3', () => {
    it('should lift a ternary function into Reader context', () => {
      const idReader = of<TestEnv, string>('user-456');
      const nameReader = of<TestEnv, string>('Bob');
      const ageReader = of<TestEnv, number>(30);

      const liftedFormat = liftA3<TestEnv, string, string, number, string>(
        formatUser,
      );

      expect(liftedFormat(idReader, nameReader, ageReader)(testEnv)).toBe(
        'Bob (user-456, 30 years old)',
      );
    });

    it('should be equivalent to nested ap operations', () => {
      const readerA = of<TestEnv, number>(2);
      const readerB = of<TestEnv, number>(3);
      const readerC = of<TestEnv, number>(4);

      const sumThree = (a: number, b: number, c: number) => a + b + c;

      const liftedResult = liftA3<TestEnv, number, number, number, number>(
        sumThree,
      );
      const result1 = liftedResult(readerA, readerB, readerC)(testEnv);

      // 手动使用ap和map实现
      const curriedSum = (a: number) => (b: number) => (c: number) => a + b + c;
      const result2 = ap(
        ap(map(readerA, curriedSum), readerB),
        readerC,
      )(testEnv);

      expect(result1).toBe(9);
      expect(result2).toBe(9);
    });
  });
});

// ============================
// Monad 操作测试 (anThen, tap)
// ============================
describe.concurrent('Monad Operations Tests', () => {
  describe('anThen (flatMap/bind)', () => {
    it('should chain Reader computations', () => {
      const getUserName: Reader<TestEnv, string> = (env) => env.user.name;
      const getGreeting =
        (name: string): Reader<TestEnv, string> =>
        (env) =>
          `Hello ${name} from ${env.config.apiUrl}`;

      const chainedReader = anThen(getUserName, getGreeting);

      expect(chainedReader(testEnv)).toBe(
        'Hello Test User from https://api.example.com',
      );
    });

    it('should flatten nested Reader computations', () => {
      const getUserId: Reader<TestEnv, string> = (env) => env.user.id;

      // 返回一个Reader，这个Reader在运行时会返回字符串
      const createUserReader =
        (id: string): Reader<TestEnv, string> =>
        (env) =>
          `User: ${id}, EnvTimeout: ${env.config.timeout}`;

      const chainedReader = anThen(getUserId, createUserReader);

      // 现在chainedReader是Reader<TestEnv, string>，直接运行得到字符串
      expect(chainedReader(testEnv)).toBe('User: user-123, EnvTimeout: 5000');
    });

    it('should preserve monad laws (left identity)', () => {
      const value = 5;
      const f = (x: number): Reader<TestEnv, number> => of(x * 2);

      const left = anThen(of<TestEnv, number>(value), f);
      const right = f(value);

      expect(left(testEnv)).toBe(right(testEnv));
    });

    it('should preserve monad laws (right identity)', () => {
      const reader = of<TestEnv, string>('test');
      const result = anThen(reader, of);

      expect(result(testEnv)).toBe(reader(testEnv));
    });

    it('should preserve monad laws (associativity)', () => {
      const reader = of<TestEnv, number>(1);
      const f = (x: number): Reader<TestEnv, number> => of(x + 1);
      const g = (x: number): Reader<TestEnv, number> => of(x * 2);

      const left = anThen(anThen(reader, f), g);
      const right = anThen(reader, (x) => anThen(f(x), g));

      expect(left(testEnv)).toBe(right(testEnv));
    });
  });

  describe('tap', () => {
    it('should perform side effect and return original value', () => {
      const sideEffectMock = vi.fn();
      const reader = of<TestEnv, string>('original value');

      const tappedReader = tap(reader, (value) => {
        sideEffectMock(value);
        return of<TestEnv, unknown>(undefined);
      });

      const result = tappedReader(testEnv);

      expect(result).toBe('original value');
      expect(sideEffectMock).toHaveBeenCalledWith('original value');
      expect(sideEffectMock).toHaveBeenCalledTimes(1);
    });

    it('should execute side effect with access to environment', () => {
      const sideEffectMock = vi.fn();
      const envDependentReader: Reader<TestEnv, string> = (env) =>
        env.user.name;

      const tappedReader = tap(envDependentReader, (name) => {
        return (env: TestEnv) => {
          sideEffectMock(name, env.config.timeout);
          return undefined;
        };
      });

      const result = tappedReader(testEnv);

      expect(result).toBe('Test User');
      expect(sideEffectMock).toHaveBeenCalledWith('Test User', 5000);
    });

    it('should chain multiple tap operations', () => {
      const mock1 = vi.fn();
      const mock2 = vi.fn();

      const reader = of<TestEnv, number>(100);

      const result = tap(
        tap(reader, (x) => {
          mock1(x);
          return of<TestEnv, unknown>(undefined);
        }),
        (x) => {
          mock2(x * 2);
          return of<TestEnv, unknown>(undefined);
        },
      )(testEnv);

      expect(result).toBe(100);
      expect(mock1).toHaveBeenCalledWith(100);
      expect(mock2).toHaveBeenCalledWith(200);
    });
  });
});

// ============================
// 组合操作测试
// ============================
describe.concurrent('Combination & Integration Tests', () => {
  it('should combine map, ap, and anThen in complex computations', () => {
    // 模拟从环境中获取配置
    const getApiConfig: Reader<TestEnv, {url: string; timeout: number}> = (
      env,
    ) => ({url: env.config.apiUrl, timeout: env.config.timeout});

    // 模拟获取用户
    const getUser: Reader<TestEnv, {id: string; name: string}> = (env) => ({
      ...env.user,
    });

    // 组合操作：获取用户信息并构建API请求
    const buildRequest = anThen(getUser, (user) =>
      map(getApiConfig, (config) => ({
        endpoint: `${config.url}/users/${user.id}`,
        timeout: config.timeout,
        user: user.name,
      })),
    );

    const request = buildRequest(testEnv);

    expect(request).toEqual({
      endpoint: 'https://api.example.com/users/user-123',
      timeout: 5000,
      user: 'Test User',
    });
  });

  it('should demonstrate practical use case with liftA2 and tap', () => {
    const validateConfig = (config: TestEnv['config']): boolean =>
      config.apiUrl.startsWith('https://') && config.timeout > 0;

    const validateUser = (user: TestEnv['user']): boolean =>
      user.id.length > 0 && user.name.length > 0;

    const configReader: Reader<TestEnv, TestEnv['config']> = (env) =>
      env.config;
    const userReader: Reader<TestEnv, TestEnv['user']> = (env) => env.user;

    const validationReader = liftA2<
      TestEnv,
      TestEnv['config'],
      TestEnv['user'],
      boolean
    >((config, user) => validateConfig(config) && validateUser(user));

    const mainReader = tap(
      validationReader(configReader, userReader),
      (isValid) => {
        return (env: TestEnv) => {
          if (!isValid) {
            console.warn(`Invalid configuration for user: ${env.user.id}`);
          }
          return undefined;
        };
      },
    );

    expect(mainReader(testEnv)).toBe(true);
  });
});
