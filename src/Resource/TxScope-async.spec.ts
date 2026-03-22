// ========================================
// ./src/Resource/TxScope-async.spec.ts
// ========================================

import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {
  AsyncTxScope,
  useAsync,
  execAsync,
  commitAsync,
  rollbackAsync,
  reopenAsync,
  type AsyncTxScopeType,
} from './TxScope-async';
import {UseAfterFreeError} from '../Errors';
/* eslint-disable @typescript-eslint/require-await */

// 定义测试用的异步函数
const mockAsyncCleaner = vi.fn().mockResolvedValue(undefined);
const mockAsyncCommiter = vi.fn().mockResolvedValue(undefined);
const mockAsyncRollbacker = vi.fn().mockResolvedValue(undefined);
const mockData = {id: 1, name: 'Test Async TxScope', balance: 100};

// ========================================
// AsyncTxScope 构造函数测试
// ========================================
describe.concurrent('AsyncTxScope Constructors', () => {
  it('AsyncTxScope.open should create an opened async transaction scope with data', () => {
    const txScope = AsyncTxScope.open(mockData);
    expect(txScope).toBeInstanceOf(AsyncTxScope);
  });

  it('AsyncTxScope.open should accept optional async cleaner, commiter, and rollbacker functions', () => {
    const txScope = AsyncTxScope.open(
      mockData,
      mockAsyncCleaner,
      mockAsyncCommiter,
      mockAsyncRollbacker,
    );
    expect(txScope).toBeInstanceOf(AsyncTxScope);
  });
});

// ========================================
// useAsync 函数测试
// ========================================
describe.concurrent('useAsync function', () => {
  let txScope: AsyncTxScopeType<typeof mockData>;

  beforeEach(() => {
    txScope = AsyncTxScope.open(mockData);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('useAsync should return the result of the async callback with transaction data', async () => {
    const result = await useAsync(txScope, async (data) => data.balance * 2);
    expect(result).toBe(200);
  });

  it('useAsync should work with synchronous callback', async () => {
    const result = await useAsync(txScope, (data) => data.balance * 3);
    expect(result).toBe(300);
  });

  it('useAsync should throw error when transaction is already closed/committed/rolled back', async () => {
    await commitAsync(txScope);
    await expect(useAsync(txScope, (data) => data.id)).rejects.toThrow(
      UseAfterFreeError,
    );
  });
});

// ========================================
// execAsync 函数测试
// ========================================
describe.concurrent('execAsync function', () => {
  let txScope: AsyncTxScopeType<typeof mockData>;
  const mockCallback = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    txScope = AsyncTxScope.open(mockData);
    mockCallback.mockClear();
  });

  it('execAsync should execute async callback and return the same transaction scope', async () => {
    const result = await execAsync(txScope, mockCallback);
    expect(mockCallback).toHaveBeenCalledWith(mockData);
    expect(result).toBe(txScope);
  });

  it('execAsync should work with synchronous callback', async () => {
    const syncCallback = vi.fn();
    const result = await execAsync(txScope, syncCallback);
    expect(syncCallback).toHaveBeenCalledWith(mockData);
    expect(result).toBe(txScope);
  });

  it('execAsync should throw error when transaction is already closed/committed/rolled back', async () => {
    await commitAsync(txScope);
    await expect(execAsync(txScope, mockCallback)).rejects.toThrow(
      UseAfterFreeError,
    );
  });
});

// ========================================
// commitAsync 函数测试
// ========================================
describe.concurrent('commitAsync function', () => {
  it('commitAsync should call async commiter function if provided', async () => {
    const commiter = vi.fn().mockResolvedValue(undefined);
    const txScope = AsyncTxScope.open(
      mockData,
      mockAsyncCleaner,
      commiter,
      mockAsyncRollbacker,
    );

    await commitAsync(txScope);
    expect(commiter).toHaveBeenCalledWith(mockData);
  });

  it('commitAsync should work with synchronous commiter', async () => {
    const syncCommiter = vi.fn();
    const txScope = AsyncTxScope.open(
      mockData,
      mockAsyncCleaner,
      syncCommiter,
      mockAsyncRollbacker,
    );

    await commitAsync(txScope);
    expect(syncCommiter).toHaveBeenCalledWith(mockData);
  });

  it('commitAsync should not call rollbacker function', async () => {
    const rollbacker = vi.fn().mockResolvedValue(undefined);
    const txScope = AsyncTxScope.open(
      mockData,
      mockAsyncCleaner,
      mockAsyncCommiter,
      rollbacker,
    );

    await commitAsync(txScope);
    expect(rollbacker).not.toHaveBeenCalled();
  });

  it('commitAsync should call async cleaner function', async () => {
    const cleaner = vi.fn().mockResolvedValue(undefined);
    const txScope = AsyncTxScope.open(
      mockData,
      cleaner,
      mockAsyncCommiter,
      mockAsyncRollbacker,
    );

    await commitAsync(txScope);
    expect(cleaner).toHaveBeenCalledWith(mockData);
  });

  it('commitAsync should return a committed async transaction scope', async () => {
    const txScope = AsyncTxScope.open(mockData);
    const committedTxScope = await commitAsync(txScope);
    expect(committedTxScope).toBeInstanceOf(AsyncTxScope);
  });

  it('commitAsync should throw error when transaction is already closed', async () => {
    const txScope = AsyncTxScope.open(mockData);
    await commitAsync(txScope);
    await expect(commitAsync(txScope)).rejects.toThrow(
      'Resource already closed/committed/rolled back.',
    );
  });
});

// ========================================
// rollbackAsync 函数测试
// ========================================
describe.concurrent('rollbackAsync function', () => {
  it('rollbackAsync should call async rollbacker function if provided', async () => {
    const rollbacker = vi.fn().mockResolvedValue(undefined);
    const txScope = AsyncTxScope.open(
      mockData,
      mockAsyncCleaner,
      mockAsyncCommiter,
      rollbacker,
    );

    await rollbackAsync(txScope);
    expect(rollbacker).toHaveBeenCalledWith(mockData);
  });

  it('rollbackAsync should work with synchronous rollbacker', async () => {
    const syncRollbacker = vi.fn();
    const txScope = AsyncTxScope.open(
      mockData,
      mockAsyncCleaner,
      mockAsyncCommiter,
      syncRollbacker,
    );

    await rollbackAsync(txScope);
    expect(syncRollbacker).toHaveBeenCalledWith(mockData);
  });

  it('rollbackAsync should not call commiter function', async () => {
    const commiter = vi.fn().mockResolvedValue(undefined);
    const txScope = AsyncTxScope.open(
      mockData,
      mockAsyncCleaner,
      commiter,
      mockAsyncRollbacker,
    );

    await rollbackAsync(txScope);
    expect(commiter).not.toHaveBeenCalled();
  });

  it('rollbackAsync should call async cleaner function', async () => {
    const cleaner = vi.fn().mockResolvedValue(undefined);
    const txScope = AsyncTxScope.open(
      mockData,
      cleaner,
      mockAsyncCommiter,
      mockAsyncRollbacker,
    );

    await rollbackAsync(txScope);
    expect(cleaner).toHaveBeenCalledWith(mockData);
  });

  it('rollbackAsync should return a rolled back async transaction scope', async () => {
    const txScope = AsyncTxScope.open(mockData);
    const rolledBackTxScope = await rollbackAsync(txScope);
    expect(rolledBackTxScope).toBeInstanceOf(AsyncTxScope);
  });

  it('rollbackAsync should throw error when transaction is already closed', async () => {
    const txScope = AsyncTxScope.open(mockData);
    await commitAsync(txScope);
    await expect(rollbackAsync(txScope)).rejects.toThrow(
      'Resource already closed/committed/rolled back.',
    );
  });
});

// ========================================
// reopenAsync 函数测试
// ========================================
describe.concurrent('reopenAsync function', () => {
  it('reopenAsync should reset data and functions on a committed async transaction scope', async () => {
    const initialTxScope = AsyncTxScope.open(
      mockData,
      mockAsyncCleaner,
      mockAsyncCommiter,
      mockAsyncRollbacker,
    );
    const committedTxScope = await commitAsync(initialTxScope);

    const newData = {id: 2, name: 'New Async TxScope', balance: 200};
    const newCleaner = vi.fn().mockResolvedValue(undefined);
    const newCommiter = vi.fn().mockResolvedValue(undefined);
    const newRollbacker = vi.fn().mockResolvedValue(undefined);

    const reopenedTxScope = reopenAsync(
      committedTxScope,
      newData,
      newCleaner,
      newCommiter,
      newRollbacker,
    );

    // Test that we can use the reopened transaction scope
    const result = await useAsync(
      reopenedTxScope,
      async (data) => data.balance,
    );
    expect(result).toBe(200);
  });

  it('reopenAsync should reset data and functions on a rolled back async transaction scope', async () => {
    const initialTxScope = AsyncTxScope.open(
      mockData,
      mockAsyncCleaner,
      mockAsyncCommiter,
      mockAsyncRollbacker,
    );
    const rolledBackTxScope = await rollbackAsync(initialTxScope);

    const newData = {id: 3, name: 'Another Async TxScope', balance: 300};
    const reopenedTxScope = reopenAsync(rolledBackTxScope, newData);

    const result = await useAsync(reopenedTxScope, (data) => data.name);
    expect(result).toBe('Another Async TxScope');
  });

  it('reopenAsync should work with partial function set', async () => {
    const initialTxScope = AsyncTxScope.open(mockData);
    const committedTxScope = await commitAsync(initialTxScope);

    const newData = {
      id: 4,
      name: 'Partial Functions Async TxScope',
      balance: 400,
    };
    const newCommiter = vi.fn().mockResolvedValue(undefined);
    const reopenedTxScope = reopenAsync(
      committedTxScope,
      newData,
      undefined,
      newCommiter,
    );

    // Commit should call the new commiter
    await commitAsync(reopenedTxScope);
    expect(newCommiter).toHaveBeenCalledWith(newData);
  });

  it('reopenAsync should work with synchronous functions', async () => {
    const initialTxScope = AsyncTxScope.open(mockData);
    const committedTxScope = await commitAsync(initialTxScope);

    const newData = {id: 5, name: 'Sync Functions Async TxScope', balance: 500};
    const syncCleaner = vi.fn();
    const syncCommiter = vi.fn();
    const reopenedTxScope = reopenAsync(
      committedTxScope,
      newData,
      syncCleaner,
      syncCommiter,
    );

    await commitAsync(reopenedTxScope);
    expect(syncCommiter).toHaveBeenCalledWith(newData);
  });
});

// ========================================
// Symbol.asyncDispose 测试
// ========================================
describe.concurrent('Symbol.asyncDispose', () => {
  it('should call async rollbacker and cleaner when disposed without commit/rollback', async () => {
    const cleaner = vi.fn().mockResolvedValue(undefined);
    const rollbacker = vi.fn().mockResolvedValue(undefined);
    const txScope = AsyncTxScope.open(
      mockData,
      cleaner,
      mockAsyncCommiter,
      rollbacker,
    );

    // Simulate await using statement without explicit commit/rollback
    await txScope[Symbol.asyncDispose]();

    expect(rollbacker).toHaveBeenCalledWith(mockData);
    expect(cleaner).toHaveBeenCalledWith(mockData);
  });

  it('should work with synchronous rollbacker and cleaner', async () => {
    const syncCleaner = vi.fn();
    const syncRollbacker = vi.fn();
    const txScope = AsyncTxScope.open(
      mockData,
      syncCleaner,
      mockAsyncCommiter,
      syncRollbacker,
    );

    await txScope[Symbol.asyncDispose]();
    expect(syncRollbacker).toHaveBeenCalledWith(mockData);
    expect(syncCleaner).toHaveBeenCalledWith(mockData);
  });

  it('should only call cleaner if rollbacker is not provided', async () => {
    const cleaner = vi.fn().mockResolvedValue(undefined);
    const txScope = AsyncTxScope.open(mockData, cleaner);

    await txScope[Symbol.asyncDispose]();
    expect(cleaner).toHaveBeenCalledWith(mockData);
  });

  it('should not call functions if already disposed', async () => {
    const cleaner = vi.fn().mockResolvedValue(undefined);
    const rollbacker = vi.fn().mockResolvedValue(undefined);
    const txScope = AsyncTxScope.open(
      mockData,
      cleaner,
      mockAsyncCommiter,
      rollbacker,
    );

    // First dispose
    await txScope[Symbol.asyncDispose]();
    cleaner.mockClear();
    rollbacker.mockClear();

    // Second dispose should not call functions
    await txScope[Symbol.asyncDispose]();
    expect(cleaner).not.toHaveBeenCalled();
    expect(rollbacker).not.toHaveBeenCalled();
  });

  it('should not call rollbacker after commit', async () => {
    const rollbacker = vi.fn().mockResolvedValue(undefined);
    const txScope = AsyncTxScope.open(
      mockData,
      mockAsyncCleaner,
      mockAsyncCommiter,
      rollbacker,
    );

    await commitAsync(txScope);
    rollbacker.mockClear();

    // Dispose after commit should not call rollbacker
    await txScope[Symbol.asyncDispose]();
    expect(rollbacker).not.toHaveBeenCalled();
  });
});
