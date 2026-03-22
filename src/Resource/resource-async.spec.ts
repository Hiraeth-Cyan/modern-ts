// ========================================
// ./src/Resource/resource-async.spec.ts
// ========================================
/* eslint-disable @typescript-eslint/require-await */
import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {
  ResourceAsync,
  useAsync,
  execAsync,
  closeAsync,
  disposeAsync,
  reopenAsync,
  type ResAsyncType,
} from './resource-async';
import {UseAfterFreeError} from '../Errors';

// 定义一个简单的异步清理函数用于测试
const mockAsyncCleaner = vi.fn().mockResolvedValue(undefined);
const mockData = {id: 1, name: 'Test Async Resource'};

// ========================================
// ResourceAsync 构造函数测试
// ========================================
describe.concurrent('ResourceAsync Constructors', () => {
  it('ResourceAsync.open should create an opened async resource with data', () => {
    const resource = ResourceAsync.open(mockData);
    expect(resource).toBeInstanceOf(ResourceAsync);
  });

  it('ResourceAsync.open should accept an optional async cleaner function', () => {
    const resource = ResourceAsync.open(mockData, mockAsyncCleaner);
    expect(resource).toBeInstanceOf(ResourceAsync);
  });
});

// ========================================
// useAsync 函数测试
// ========================================
describe.concurrent('useAsync function', () => {
  let resource: ResAsyncType<typeof mockData>;

  beforeEach(() => {
    resource = ResourceAsync.open(mockData);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('useAsync should return the result of the async callback with resource data', async () => {
    const result = await useAsync(resource, async (data) => data.id * 2);
    expect(result).toBe(2);
  });

  it('useAsync should work with synchronous callback', async () => {
    const result = await useAsync(resource, (data) => data.id * 3);
    expect(result).toBe(3);
  });

  it('useAsync should throw error when resource is already closed', async () => {
    await closeAsync(resource);
    await expect(useAsync(resource, (data) => data.id)).rejects.toThrow(
      UseAfterFreeError,
    );
  });
});

// ========================================
// execAsync 函数测试
// ========================================
describe.concurrent('execAsync function', () => {
  let resource: ResAsyncType<typeof mockData>;
  const mockCallback = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    resource = ResourceAsync.open(mockData);
    mockCallback.mockClear();
  });

  it('execAsync should execute async callback and return the same resource', async () => {
    const result = await execAsync(resource, mockCallback);
    expect(mockCallback).toHaveBeenCalledWith(mockData);
    expect(result).toBe(resource);
  });

  it('execAsync should work with synchronous callback', async () => {
    const syncCallback = vi.fn();
    const result = await execAsync(resource, syncCallback);
    expect(syncCallback).toHaveBeenCalledWith(mockData);
    expect(result).toBe(resource);
  });

  it('execAsync should throw error when resource is already closed', async () => {
    await closeAsync(resource);
    await expect(execAsync(resource, mockCallback)).rejects.toThrow(
      UseAfterFreeError,
    );
  });
});

// ========================================
// closeAsync 函数测试
// ========================================
describe.concurrent('closeAsync function', () => {
  it('closeAsync should call async cleaner function if provided', async () => {
    const cleaner = vi.fn().mockResolvedValue(undefined);
    const resource = ResourceAsync.open(mockData, cleaner);

    await closeAsync(resource);
    expect(cleaner).toHaveBeenCalledWith(mockData);
  });

  it('closeAsync should work with synchronous cleaner', async () => {
    const syncCleaner = vi.fn();
    const resource = ResourceAsync.open(mockData, syncCleaner);

    await closeAsync(resource);
    expect(syncCleaner).toHaveBeenCalledWith(mockData);
  });

  it('closeAsync should not throw if cleaner is not provided', async () => {
    const resource = ResourceAsync.open(mockData);
    await expect(closeAsync(resource)).resolves.not.toThrow();
  });

  it('closeAsync should return a closed resource', async () => {
    const resource = ResourceAsync.open(mockData);
    const closedResource = await closeAsync(resource);
    expect(closedResource).toBeInstanceOf(ResourceAsync);
  });
});

// ========================================
// disposeAsync 函数测试
// ========================================
describe.concurrent('disposeAsync function', () => {
  it('disposeAsync should execute async callback and close the resource', async () => {
    const cleaner = vi.fn().mockResolvedValue(undefined);
    const callback = vi.fn().mockResolvedValue('async callback result');
    const resource = ResourceAsync.open(mockData, cleaner);

    const result = await disposeAsync(resource, callback);

    expect(callback).toHaveBeenCalledWith(mockData);
    expect(cleaner).toHaveBeenCalledWith(mockData);
    expect(result).toBeInstanceOf(ResourceAsync);
  });

  it('disposeAsync should work with synchronous callback', async () => {
    const cleaner = vi.fn().mockResolvedValue(undefined);
    const callback = vi.fn().mockReturnValue('sync callback result');
    const resource = ResourceAsync.open(mockData, cleaner);

    const result = await disposeAsync(resource, callback);

    expect(callback).toHaveBeenCalledWith(mockData);
    expect(cleaner).toHaveBeenCalledWith(mockData);
    expect(result).toBeInstanceOf(ResourceAsync);
  });

  it('disposeAsync should work without cleaner function', async () => {
    const callback = vi.fn().mockResolvedValue(undefined);
    const resource = ResourceAsync.open(mockData);

    const result = await disposeAsync(resource, callback);

    expect(callback).toHaveBeenCalledWith(mockData);
    expect(result).toBeInstanceOf(ResourceAsync);
  });

  it('disposeAsync should throw error when resource is already closed', async () => {
    const resource = ResourceAsync.open(mockData);
    await closeAsync(resource);

    await expect(disposeAsync(resource, vi.fn())).rejects.toThrow(
      UseAfterFreeError, // 使用具体的错误类型
    );
  });

  it('disposeAsync should work with synchronous cleaner', async () => {
    const syncCleaner = vi.fn();
    const callback = vi.fn().mockResolvedValue('callback result');
    const resource = ResourceAsync.open(mockData, syncCleaner);

    const result = await disposeAsync(resource, callback);

    expect(callback).toHaveBeenCalledWith(mockData);
    expect(syncCleaner).toHaveBeenCalledWith(mockData);
    expect(result).toBeInstanceOf(ResourceAsync);
  });

  // 🚨 核心修正：新增测试用例，保证异步清理在异常时执行
  it('disposeAsync should throw the error from async callback but still await async cleanup', async () => {
    const cleaner = vi.fn().mockResolvedValue('Cleanup Done'); // 异步 Cleaner
    cleaner.mockClear();
    const errorToThrow = new Error('Async function failed mid-execution!');

    // 故意让异步回调函数抛出异常
    const faultyAsyncCallback = vi.fn(async () => {
      // 模拟一些异步工作
      await new Promise((resolve) => setTimeout(resolve, 5));
      throw errorToThrow;
    });

    const resource = ResourceAsync.open(mockData, cleaner);

    // 1. 期望调用 disposeAsync 时会抛出异常
    await expect(disposeAsync(resource, faultyAsyncCallback)).rejects.toThrow(
      errorToThrow,
    );

    // 2. 关键断言：尽管抛出了异常，异步清理函数仍然必须被调用！
    expect(cleaner).toHaveBeenCalledWith(mockData);

    // 3. 额外断言：资源状态必须是已关闭
    await expect(useAsync(resource, () => {})).rejects.toThrow(
      UseAfterFreeError,
    );
  });

  // 修正原测试中的一个细微语义错误：disposeAsync返回的是资源，不是fn的返回值
  it('disposeAsync returns the closed resource', async () => {
    const callback = vi.fn().mockResolvedValue('test result');
    const resource = ResourceAsync.open(mockData);

    const closedResource = await disposeAsync(resource, callback);

    expect(callback).toHaveBeenCalledWith(mockData);
    // 仅确认函数被执行，disposeAsync的返回值是 resource
    expect(closedResource).toBeInstanceOf(ResourceAsync);
    // 确认状态已关闭
    await expect(useAsync(closedResource, (data) => data.id)).rejects.toThrow(
      UseAfterFreeError,
    );
  });
});

// ========================================
// reopenAsync 函数测试
// ========================================
describe.concurrent('reopenAsync function', () => {
  it('reopenAsync should reset data and cleaner on a closed async resource', async () => {
    const initialResource = ResourceAsync.open(mockData, mockAsyncCleaner);
    const closedResource = await closeAsync(initialResource);

    const newData = {id: 2, name: 'New Async Resource'};
    const newCleaner = vi.fn().mockResolvedValue(undefined);
    const reopenedResource = reopenAsync(closedResource, newData, newCleaner);

    // Test that we can use the reopened resource
    const result = await useAsync(reopenedResource, async (data) => data.id);
    expect(result).toBe(2);
  });

  it('reopenAsync should work without cleaner', async () => {
    const initialResource = ResourceAsync.open(mockData);
    const closedResource = await closeAsync(initialResource);

    const newData = {id: 3, name: 'Another Async Resource'};
    const reopenedResource = reopenAsync(closedResource, newData);

    const result = await useAsync(reopenedResource, (data) => data.name);
    expect(result).toBe('Another Async Resource');
  });

  it('reopenAsync should work with synchronous cleaner', async () => {
    const initialResource = ResourceAsync.open(mockData);
    const closedResource = await closeAsync(initialResource);

    const newData = {id: 4, name: 'Sync Cleaner Resource'};
    const syncCleaner = vi.fn();
    const reopenedResource = reopenAsync(closedResource, newData, syncCleaner);

    const result = await useAsync(reopenedResource, (data) => data.id);
    expect(result).toBe(4);
  });
});

// ========================================
// Symbol.asyncDispose 测试
// ========================================
describe.concurrent('Symbol.asyncDispose', () => {
  it('should call async cleaner when using await using statement', async () => {
    const cleaner = vi.fn().mockResolvedValue(undefined);
    const resource = ResourceAsync.open(mockData, cleaner);

    // Simulate await using statement
    await resource[Symbol.asyncDispose]();

    expect(cleaner).toHaveBeenCalledWith(mockData);
  });

  it('should work with synchronous cleaner', async () => {
    const syncCleaner = vi.fn();
    const resource = ResourceAsync.open(mockData, syncCleaner);

    await resource[Symbol.asyncDispose]();
    expect(syncCleaner).toHaveBeenCalledWith(mockData);
  });

  it('should not call cleaner if already disposed', async () => {
    const cleaner = vi.fn().mockResolvedValue(undefined);
    const resource = ResourceAsync.open(mockData, cleaner);

    // First dispose
    await resource[Symbol.asyncDispose]();
    cleaner.mockClear();

    // Second dispose should not call cleaner
    await resource[Symbol.asyncDispose]();
    expect(cleaner).not.toHaveBeenCalled();
  });
  it('await using statement should call Symbol.asyncDispose and await cleaner', async () => {
    const cleaner = vi.fn().mockResolvedValue('Async Cleaner Done'); // 异步 Cleaner
    let resource_outside: ResAsyncType<typeof mockData>;
    await (async () => {
      await using resource = ResourceAsync.open(mockData, cleaner);
      resource_outside = resource;

      await expect(
        useAsync(resource, async (data) => data.id * 5),
      ).resolves.toBe(5);
    })();
    expect(cleaner).toHaveBeenCalledWith(mockData);

    await expect(
      useAsync(resource_outside!, (data) => data.id),
    ).rejects.toThrow(UseAfterFreeError);
  });
});
