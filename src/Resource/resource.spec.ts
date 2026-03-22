// ========================================
// ./src/Resource/resource.spec.ts
// ========================================

import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {
  Resource,
  use,
  exec,
  close,
  dispose,
  reopen,
  type ResType,
} from './resource';
import {UseAfterFreeError} from '../Errors';

// 定义一个简单的清理函数用于测试
const mockCleaner = vi.fn();
const mockData = {id: 1, name: 'Test Resource'};

// ========================================
// Resource 构造函数测试
// ========================================
describe.concurrent('Resource Constructors', () => {
  it('Resource.open should create an opened resource with data', () => {
    const resource = Resource.open(mockData);
    expect(resource).toBeInstanceOf(Resource);
  });

  it('Resource.open should accept an optional cleaner function', () => {
    const resource = Resource.open(mockData, mockCleaner);
    expect(resource).toBeInstanceOf(Resource);
  });
});

// ========================================
// use 函数测试
// ========================================
describe.concurrent('use function', () => {
  let resource: ResType<typeof mockData>;

  beforeEach(() => {
    resource = Resource.open(mockData);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('use should return the result of the callback with resource data', () => {
    const result = use(resource, (data) => data.id * 2);
    expect(result).toBe(2);
  });

  it('use should throw error when resource is already closed', () => {
    close(resource);
    expect(() => use(resource, (data) => data.id)).toThrow(UseAfterFreeError);
  });
});

// ========================================
// exec 函数测试
// ========================================
describe.concurrent('exec function', () => {
  let resource: ResType<typeof mockData>;
  const mockCallback = vi.fn();

  beforeEach(() => {
    resource = Resource.open(mockData);
    mockCallback.mockClear();
  });

  it('exec should execute callback and return the same resource', () => {
    const result = exec(resource, mockCallback);
    expect(mockCallback).toHaveBeenCalledWith(mockData);
    expect(result).toBe(resource);
  });

  it('exec should throw error when resource is already closed', () => {
    close(resource);
    expect(() => exec(resource, mockCallback)).toThrow(UseAfterFreeError);
  });
});

// ========================================
// close 函数测试
// ========================================
describe.concurrent('close function', () => {
  it('close should call cleaner function if provided', () => {
    const cleaner = vi.fn();
    const resource = Resource.open(mockData, cleaner);

    close(resource);
    expect(cleaner).toHaveBeenCalledWith(mockData);
  });

  it('close should not throw if cleaner is not provided', () => {
    const resource = Resource.open(mockData);
    expect(() => close(resource)).not.toThrow();
  });

  it('close should return a closed resource', () => {
    const resource = Resource.open(mockData);
    const closedResource = close(resource);
    expect(closedResource).toBeInstanceOf(Resource);
  });
});

// ========================================
// dispose 函数测试
// ========================================
describe.concurrent('dispose function', () => {
  it('dispose should execute callback and close the resource', () => {
    const cleaner = vi.fn();
    const callback = vi.fn().mockReturnValue('callback result');
    const resource = Resource.open(mockData, cleaner);

    const closedResource = dispose(resource, callback);

    expect(callback).toHaveBeenCalledWith(mockData);
    expect(cleaner).toHaveBeenCalledWith(mockData);
    expect(closedResource).toBeInstanceOf(Resource);
  });

  it('dispose should work without cleaner function', () => {
    const callback = vi.fn();
    const resource = Resource.open(mockData);

    const closedResource = dispose(resource, callback);

    expect(callback).toHaveBeenCalledWith(mockData);
    expect(closedResource).toBeInstanceOf(Resource);
  });

  it('dispose should throw error when resource is already closed', () => {
    const resource = Resource.open(mockData);
    close(resource);

    expect(() => dispose(resource, vi.fn())).toThrow(UseAfterFreeError);
  });

  it('dispose should throw the error from callback but still call cleaner', () => {
    const cleaner = vi.fn();
    const errorToThrow = new Error('Function failed mid-execution!');

    const faultyCallback = vi.fn(() => {
      throw errorToThrow;
    });

    const resource = Resource.open(mockData, cleaner);

    expect(() => dispose(resource, faultyCallback)).toThrow(errorToThrow);

    expect(cleaner).toHaveBeenCalledWith(mockData);

    expect(() => use(resource, () => {})).toThrow(UseAfterFreeError);
  });

  it('dispose returns the closed resource', () => {
    const callback = vi.fn().mockReturnValue('test result');
    const resource = Resource.open(mockData);

    const closedResource = dispose(resource, callback);

    expect(callback).toHaveBeenCalledWith(mockData);
    expect(closedResource).toBeInstanceOf(Resource);
    expect(() => use(closedResource, (data) => data.id)).toThrow(
      UseAfterFreeError,
    );
  });
});
// ========================================
// reopen 函数测试
// ========================================
describe.concurrent('reopen function', () => {
  it('reopen should reset data and cleaner on a closed resource', () => {
    const initialResource = Resource.open(mockData, mockCleaner);
    const closedResource = close(initialResource);

    const newData = {id: 2, name: 'New Resource'};
    const newCleaner = vi.fn();
    const reopenedResource = reopen(closedResource, newData, newCleaner);

    // Test that we can use the reopened resource
    const result = use(reopenedResource, (data) => data.id);
    expect(result).toBe(2);
  });

  it('reopen should work without cleaner', () => {
    const initialResource = Resource.open(mockData);
    const closedResource = close(initialResource);

    const newData = {id: 3, name: 'Another Resource'};
    const reopenedResource = reopen(closedResource, newData);

    const result = use(reopenedResource, (data) => data.name);
    expect(result).toBe('Another Resource');
  });
});

// ========================================
// Symbol.dispose 测试
// ========================================
describe.concurrent('Symbol.dispose', () => {
  it('should call cleaner when using using statement', () => {
    const cleaner = vi.fn();
    const resource = Resource.open(mockData, cleaner);

    // Simulate using statement
    resource[Symbol.dispose]();

    expect(cleaner).toHaveBeenCalledWith(mockData);
  });

  it('should not call cleaner if already disposed', () => {
    const cleaner = vi.fn();
    const resource = Resource.open(mockData, cleaner);

    // First dispose
    resource[Symbol.dispose]();
    cleaner.mockClear();

    // Second dispose should not call cleaner
    resource[Symbol.dispose]();
    expect(cleaner).not.toHaveBeenCalled();
  });
  it('using statement should call Symbol.dispose and execute cleaner', () => {
    const cleaner = vi.fn();
    let resource_outside: ResType<typeof mockData>;
    {
      using resource = Resource.open(mockData, cleaner);
      resource_outside = resource;
      expect(() => use(resource, (data) => data.id)).not.toThrow();
    }
    expect(cleaner).toHaveBeenCalledWith(mockData);
    expect(() => use(resource_outside, (data) => data.id)).toThrow(
      UseAfterFreeError,
    );
  });
});
