// ========================================
// ./__tests__/Reader/local.spec.ts
// ========================================

import {describe, it, expect} from 'vitest';
import {local} from './local';
import {Ok, Err} from '../Result/base';
import type {
  Reader,
  AsyncReader,
  ReaderT,
  AsyncReaderT,
  AnyReader,
} from './types';

// 测试环境类型
interface TestEnv {
  userId: number;
  userName: string;
  isAdmin: boolean;
}

// 测试数据
const baseEnv: TestEnv = {
  userId: 1,
  userName: 'Alice',
  isAdmin: false,
};

// ========================================
// 测试同步 Reader
// ========================================
describe.concurrent('local - Synchronous Reader', () => {
  it('should modify environment for synchronous Reader', () => {
    // 创建一个简单的同步Reader
    const reader: Reader<TestEnv, string> = (env) =>
      `User: ${env.userName} (ID: ${env.userId})`;

    // 创建一个修改环境的函数
    const modifyEnv = (env: TestEnv): TestEnv => ({
      ...env,
      userName: 'Modified-' + env.userName,
      userId: env.userId + 100,
    });

    // 应用local
    const modifiedReader = local(reader, modifyEnv);

    // 测试原始reader
    const originalResult = reader(baseEnv);
    expect(originalResult).toBe('User: Alice (ID: 1)');

    // 测试修改后的reader
    const modifiedResult = modifiedReader(baseEnv);
    expect(modifiedResult).toBe('User: Modified-Alice (ID: 101)');
  });

  it('should work with identity function (no change)', () => {
    const reader: Reader<TestEnv, number> = (env) => env.userId;
    const identity = (env: TestEnv): TestEnv => env;

    const modifiedReader = local(reader, identity);

    expect(modifiedReader(baseEnv)).toBe(1);
    expect(modifiedReader(baseEnv)).toBe(reader(baseEnv));
  });

  it('should allow chaining multiple local calls', () => {
    const reader: Reader<TestEnv, string> = (env) => env.userName;

    const addPrefix = (env: TestEnv): TestEnv => ({
      ...env,
      userName: 'Prefix-' + env.userName,
    });

    const addSuffix = (env: TestEnv): TestEnv => ({
      ...env,
      userName: env.userName + '-Suffix',
    });

    const reader1 = local(reader, addPrefix);
    const reader2 = local(reader1, addSuffix);

    expect(reader2(baseEnv)).toBe('Prefix-Alice-Suffix');
  });
});

// ========================================
// 测试异步 Reader
// ========================================
describe.concurrent('local - Asynchronous Reader', () => {
  it('should modify environment for asynchronous Reader', async () => {
    const reader: AsyncReader<TestEnv, string> = async (env) =>
      Promise.resolve(`Async User: ${env.userName}`);

    const modifyEnv = (env: TestEnv): TestEnv => ({
      ...env,
      userName: 'Async-' + env.userName,
    });

    const modifiedReader = local(reader, modifyEnv);

    const originalResult = await reader(baseEnv);
    expect(originalResult).toBe('Async User: Alice');

    const modifiedResult = await modifiedReader(baseEnv);
    expect(modifiedResult).toBe('Async User: Async-Alice');
  });

  it('should preserve async behavior with error', async () => {
    const error = new Error('Test error');
    // eslint-disable-next-line @typescript-eslint/require-await
    const reader: AsyncReader<TestEnv, string> = async () => {
      throw error;
    };

    const modifyEnv = (env: TestEnv): TestEnv => ({
      ...env,
      userId: env.userId * 2,
    });

    const modifiedReader = local(reader, modifyEnv);

    await expect(modifiedReader(baseEnv)).rejects.toThrow('Test error');
  });
});

// ========================================
// 测试同步 ReaderT
// ========================================
describe.concurrent('local - Synchronous ReaderT', () => {
  it('should modify environment for synchronous ReaderT with Ok result', () => {
    const readerT: ReaderT<TestEnv, Error, string> = (env) =>
      Ok(`UserT: ${env.userName}`);

    const modifyEnv = (env: TestEnv): TestEnv => ({
      ...env,
      userName: 'ReaderT-' + env.userName,
    });

    const modifiedReaderT = local(readerT, modifyEnv);

    const originalResult = readerT(baseEnv);
    expect(originalResult.ok).toBe(true);
    if (originalResult.ok) {
      expect(originalResult.value).toBe('UserT: Alice');
    }

    const modifiedResult = modifiedReaderT(baseEnv);
    expect(modifiedResult.ok).toBe(true);
    if (modifiedResult.ok) {
      expect(modifiedResult.value).toBe('UserT: ReaderT-Alice');
    }
  });

  it('should modify environment for synchronous ReaderT with Err result', () => {
    const error = new Error('Permission denied');
    const readerT: ReaderT<TestEnv, Error, string> = (env) =>
      env.isAdmin ? Ok('Admin access') : Err(error);

    const modifyEnv = (env: TestEnv): TestEnv => ({
      ...env,
      isAdmin: true, // 修改环境以授予管理员权限
    });

    const modifiedReaderT = local(readerT, modifyEnv);

    // 原始环境：isAdmin = false，应该返回错误
    const originalResult = readerT(baseEnv);
    expect(originalResult.ok).toBe(false);

    // 修改后的环境：isAdmin = true，应该返回成功
    const modifiedResult = modifiedReaderT(baseEnv);
    expect(modifiedResult.ok).toBe(true);
    if (modifiedResult.ok) {
      expect(modifiedResult.value).toBe('Admin access');
    }
  });
});

// ========================================
// 测试异步 ReaderT
// ========================================
describe.concurrent('local - Asynchronous ReaderT', () => {
  it('should modify environment for asynchronous ReaderT', async () => {
    const readerT: AsyncReaderT<TestEnv, Error, string> = async (env) =>
      Promise.resolve(Ok(`AsyncT: ${env.userName}`));

    const modifyEnv = (env: TestEnv): TestEnv => ({
      ...env,
      userName: 'AsyncT-' + env.userName,
    });

    const modifiedReaderT = local(readerT, modifyEnv);

    const originalResult = await readerT(baseEnv);
    expect(originalResult.ok).toBe(true);
    if (originalResult.ok) {
      expect(originalResult.value).toBe('AsyncT: Alice');
    }

    const modifiedResult = await modifiedReaderT(baseEnv);
    expect(modifiedResult.ok).toBe(true);
    if (modifiedResult.ok) {
      expect(modifiedResult.value).toBe('AsyncT: AsyncT-Alice');
    }
  });

  it('should handle async ReaderT with error result', async () => {
    const error = new Error('Async error');
    const readerT: AsyncReaderT<TestEnv, Error, string> = async () =>
      Promise.resolve(Err(error));

    const modifyEnv = (env: TestEnv): TestEnv => ({
      ...env,
      userId: env.userId + 999,
    });

    const modifiedReaderT = local(readerT, modifyEnv);

    const result = await modifiedReaderT(baseEnv);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(error);
    }
  });
});

// ========================================
// 测试边界情况和类型安全
// ========================================
describe.concurrent('local - Edge Cases and Type Safety', () => {
  it('should work with empty modification function', () => {
    const reader: Reader<TestEnv, number> = (env) => env.userId;
    const emptyMod = (env: TestEnv): TestEnv => ({...env}); // 浅拷贝

    const modifiedReader = local(reader, emptyMod);

    expect(modifiedReader(baseEnv)).toBe(1);
  });

  it('should handle nested object modifications', () => {
    interface NestedEnv {
      config: {
        timeout: number;
        retries: number;
      };
    }

    const nestedEnv: NestedEnv = {
      config: {
        timeout: 1000,
        retries: 3,
      },
    };

    const reader: Reader<NestedEnv, number> = (env) =>
      env.config.timeout * env.config.retries;

    const modifyEnv = (env: NestedEnv): NestedEnv => ({
      config: {
        ...env.config,
        timeout: env.config.timeout * 2,
        retries: env.config.retries + 1,
      },
    });

    const modifiedReader = local(reader, modifyEnv);

    // 原始：1000 * 3 = 3000
    // 修改后：2000 * 4 = 8000
    expect(modifiedReader(nestedEnv)).toBe(8000);
  });

  it('should maintain referential transparency', () => {
    const reader: Reader<TestEnv, string> = (env) => env.userName;
    const modifyEnv = (env: TestEnv): TestEnv => ({
      ...env,
      userName: 'Modified',
    });

    const modifiedReader = local(reader, modifyEnv);

    // 相同输入应该产生相同输出
    const result1 = modifiedReader(baseEnv);
    const result2 = modifiedReader(baseEnv);
    expect(result1).toBe(result2);

    // 不同输入应该产生不同输出
    const differentEnv = {...baseEnv, userName: 'Bob'};
    const result3 = modifiedReader(differentEnv);
    expect(result3).toBe('Modified'); // 注意：修改函数会覆盖用户名
  });

  it('should work with AnyReader type (union type)', () => {
    // 测试同步Reader
    const syncReader: AnyReader<TestEnv, string> = (env) =>
      `Sync: ${env.userName}`;
    const modifyEnv = (env: TestEnv): TestEnv => ({
      ...env,
      userName: 'Any-' + env.userName,
    });

    const modifiedSyncReader = local(syncReader, modifyEnv);
    expect(modifiedSyncReader(baseEnv)).toBe('Sync: Any-Alice');

    // 测试异步Reader
    const asyncReader: AnyReader<TestEnv, string> = async (env) =>
      Promise.resolve(`Async: ${env.userName}`);

    const modifiedAsyncReader = local(asyncReader, modifyEnv);

    // 注意：我们需要异步处理
    return expect(modifiedAsyncReader(baseEnv)).resolves.toBe(
      'Async: Any-Alice',
    );
  });
});

// ========================================
// 测试类型推断和重载
// ========================================
describe.concurrent('local - Type Inference and Overloads', () => {
  // 这个测试验证TypeScript能正确推断类型
  it('should correctly infer types for different overloads', () => {
    // 同步Reader
    const syncReader: Reader<TestEnv, number> = (env) => env.userId;
    const syncResult = local(syncReader, (env) => ({
      ...env,
      userId: env.userId * 2,
    }));
    // syncResult应该是Reader<TestEnv, number>
    expect(typeof syncResult).toBe('function');
    expect(syncResult(baseEnv)).toBe(2);

    // 同步ReaderT
    const syncReaderT: ReaderT<TestEnv, Error, string> = (env) =>
      Ok(env.userName);
    const syncTResult = local(syncReaderT, (env) => ({
      ...env,
      userName: 'T-' + env.userName,
    }));
    // syncTResult应该是ReaderT<TestEnv, Error, string>
    const syncTValue = syncTResult(baseEnv);
    expect(syncTValue.ok).toBe(true);
    if (syncTValue.ok) {
      expect(syncTValue.value).toBe('T-Alice');
    }
  });
});
