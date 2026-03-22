// ========================================
// ./src/Resource/TxScope.spec.ts
// ========================================

import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {
  TxScope,
  use,
  exec,
  commit,
  rollback,
  reopen,
  type TxScopeType,
} from './TxScope';
import {UseAfterFreeError} from '../Errors';
// 定义测试用的函数
const mockCleaner = vi.fn();
const mockCommiter = vi.fn();
const mockRollbacker = vi.fn();
const mockData = {id: 1, name: 'Test TxScope', balance: 100};

// ========================================
// TxScope 构造函数测试
// ========================================
describe.concurrent('TxScope Constructors', () => {
  it('TxScope.open should create an opened transaction scope with data', () => {
    const txScope = TxScope.open(mockData);
    expect(txScope).toBeInstanceOf(TxScope);
  });

  it('TxScope.open should accept optional cleaner, commiter, and rollbacker functions', () => {
    const txScope = TxScope.open(
      mockData,
      mockCleaner,
      mockCommiter,
      mockRollbacker,
    );
    expect(txScope).toBeInstanceOf(TxScope);
  });
});

// ========================================
// use 函数测试
// ========================================
describe.concurrent('use function', () => {
  let txScope: TxScopeType<typeof mockData>;

  beforeEach(() => {
    txScope = TxScope.open(mockData);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('use should return the result of the callback with transaction data', () => {
    const result = use(txScope, (data) => data.balance * 2);
    expect(result).toBe(200);
  });

  it('use should throw error when transaction is already closed/committed/rolled back', () => {
    commit(txScope);
    expect(() => use(txScope, (data) => data.id)).toThrow(UseAfterFreeError);
  });
});

// ========================================
// exec 函数测试
// ========================================
describe.concurrent('exec function', () => {
  let txScope: TxScopeType<typeof mockData>;
  const mockCallback = vi.fn();

  beforeEach(() => {
    txScope = TxScope.open(mockData);
    mockCallback.mockClear();
  });

  it('exec should execute callback and return the same transaction scope', () => {
    const result = exec(txScope, mockCallback);
    expect(mockCallback).toHaveBeenCalledWith(mockData);
    expect(result).toBe(txScope);
  });

  it('exec should throw error when transaction is already closed/committed/rolled back', () => {
    commit(txScope);
    expect(() => exec(txScope, mockCallback)).toThrow(UseAfterFreeError);
  });
});

// ========================================
// commit 函数测试
// ========================================
describe.concurrent('commit function', () => {
  it('commit should call commiter function if provided', () => {
    const commiter = vi.fn();
    const txScope = TxScope.open(
      mockData,
      mockCleaner,
      commiter,
      mockRollbacker,
    );

    commit(txScope);
    expect(commiter).toHaveBeenCalledWith(mockData);
  });

  it('commit should not call rollbacker function', () => {
    const rollbacker = vi.fn();
    const txScope = TxScope.open(
      mockData,
      mockCleaner,
      mockCommiter,
      rollbacker,
    );

    commit(txScope);
    expect(rollbacker).not.toHaveBeenCalled();
  });

  it('commit should call cleaner function', () => {
    const cleaner = vi.fn();
    const txScope = TxScope.open(
      mockData,
      cleaner,
      mockCommiter,
      mockRollbacker,
    );

    commit(txScope);
    expect(cleaner).toHaveBeenCalledWith(mockData);
  });

  it('commit should return a committed transaction scope', () => {
    const txScope = TxScope.open(mockData);
    const committedTxScope = commit(txScope);
    expect(committedTxScope).toBeInstanceOf(TxScope);
  });

  it('commit should throw error when transaction is already closed', () => {
    const txScope = TxScope.open(mockData);
    commit(txScope);
    expect(() => commit(txScope)).toThrow(
      'Resource already closed/committed/rolled back.',
    );
  });
});

// ========================================
// rollback 函数测试
// ========================================
describe.concurrent('rollback function', () => {
  it('rollback should call rollbacker function if provided', () => {
    const rollbacker = vi.fn();
    const txScope = TxScope.open(
      mockData,
      mockCleaner,
      mockCommiter,
      rollbacker,
    );

    rollback(txScope);
    expect(rollbacker).toHaveBeenCalledWith(mockData);
  });

  it('rollback should not call commiter function', () => {
    const commiter = vi.fn();
    const txScope = TxScope.open(
      mockData,
      mockCleaner,
      commiter,
      mockRollbacker,
    );

    rollback(txScope);
    expect(commiter).not.toHaveBeenCalled();
  });

  it('rollback should call cleaner function', () => {
    const cleaner = vi.fn();
    const txScope = TxScope.open(
      mockData,
      cleaner,
      mockCommiter,
      mockRollbacker,
    );

    rollback(txScope);
    expect(cleaner).toHaveBeenCalledWith(mockData);
  });

  it('rollback should return a rolled back transaction scope', () => {
    const txScope = TxScope.open(mockData);
    const rolledBackTxScope = rollback(txScope);
    expect(rolledBackTxScope).toBeInstanceOf(TxScope);
  });

  it('rollback should throw error when transaction is already closed', () => {
    const txScope = TxScope.open(mockData);
    commit(txScope);
    expect(() => rollback(txScope)).toThrow(
      'Resource already closed/committed/rolled back.',
    );
  });
});

// ========================================
// reopen 函数测试
// ========================================
describe.concurrent('reopen function', () => {
  it('reopen should reset data and functions on a committed transaction scope', () => {
    const initialTxScope = TxScope.open(
      mockData,
      mockCleaner,
      mockCommiter,
      mockRollbacker,
    );
    const committedTxScope = commit(initialTxScope);

    const newData = {id: 2, name: 'New TxScope', balance: 200};
    const newCleaner = vi.fn();
    const newCommiter = vi.fn();
    const newRollbacker = vi.fn();

    const reopenedTxScope = reopen(
      committedTxScope,
      newData,
      newCleaner,
      newCommiter,
      newRollbacker,
    );

    // Test that we can use the reopened transaction scope
    const result = use(reopenedTxScope, (data) => data.balance);
    expect(result).toBe(200);
  });

  it('reopen should reset data and functions on a rolled back transaction scope', () => {
    const initialTxScope = TxScope.open(
      mockData,
      mockCleaner,
      mockCommiter,
      mockRollbacker,
    );
    const rolledBackTxScope = rollback(initialTxScope);

    const newData = {id: 3, name: 'Another TxScope', balance: 300};
    const reopenedTxScope = reopen(rolledBackTxScope, newData);

    const result = use(reopenedTxScope, (data) => data.name);
    expect(result).toBe('Another TxScope');
  });

  it('reopen should work with partial function set', () => {
    const initialTxScope = TxScope.open(mockData);
    const committedTxScope = commit(initialTxScope);

    const newData = {id: 4, name: 'Partial Functions TxScope', balance: 400};
    const newCommiter = vi.fn();
    const reopenedTxScope = reopen(
      committedTxScope,
      newData,
      undefined,
      newCommiter,
    );

    // Commit should call the new commiter
    commit(reopenedTxScope);
    expect(newCommiter).toHaveBeenCalledWith(newData);
  });
});

// ========================================
// Symbol.dispose 测试
// ========================================
describe.concurrent('Symbol.dispose', () => {
  it('should call rollbacker and cleaner when disposed without commit/rollback', () => {
    const cleaner = vi.fn();
    const rollbacker = vi.fn();
    const txScope = TxScope.open(mockData, cleaner, mockCommiter, rollbacker);

    // Simulate using statement without explicit commit/rollback
    txScope[Symbol.dispose]();

    expect(rollbacker).toHaveBeenCalledWith(mockData);
    expect(cleaner).toHaveBeenCalledWith(mockData);
  });

  it('should only call cleaner if rollbacker is not provided', () => {
    const cleaner = vi.fn();
    const txScope = TxScope.open(mockData, cleaner);

    txScope[Symbol.dispose]();
    expect(cleaner).toHaveBeenCalledWith(mockData);
  });

  it('should not call functions if already disposed', () => {
    const cleaner = vi.fn();
    const rollbacker = vi.fn();
    const txScope = TxScope.open(mockData, cleaner, mockCommiter, rollbacker);

    // First dispose
    txScope[Symbol.dispose]();
    cleaner.mockClear();
    rollbacker.mockClear();

    // Second dispose should not call functions
    txScope[Symbol.dispose]();
    expect(cleaner).not.toHaveBeenCalled();
    expect(rollbacker).not.toHaveBeenCalled();
  });

  it('should not call rollbacker after commit', () => {
    const rollbacker = vi.fn();
    const txScope = TxScope.open(
      mockData,
      mockCleaner,
      mockCommiter,
      rollbacker,
    );

    commit(txScope);
    rollbacker.mockClear();

    // Dispose after commit should not call rollbacker
    txScope[Symbol.dispose]();
    expect(rollbacker).not.toHaveBeenCalled();
  });
});
