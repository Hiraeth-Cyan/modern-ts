// ========================================
// ./src/Result/Operators/Async/transform-async.ts
// ========================================

import {beforeEach, describe, it, expect, vi} from 'vitest';
import {
  mapAsync,
  mapErrAsync,
  mapBothAsync,
  andThenAsync,
  recoverAsync,
  orElseAsync,
  filterAsync,
} from './transform-async';
import {Ok, Err} from '../../base';
import {UnknownError} from '../../../unknown-error';
import type {Failure} from '../../types';

// ============================
// 测试辅助数据
// ============================
const successValue = {id: 1, name: 'Test'};
const errorValue = new Error('Original error');
const transformedSuccess = {id: 2, name: 'Transformed'};
const transformedError = new TypeError('Transformed error');
const filterError = new Error('Filter failed');

// ============================
// 全局 mock 函数（每个测试前会重置）
// ============================
const syncMapper = vi.fn((value: typeof successValue) => ({
  ...value,
  id: value.id + 1,
}));
const asyncMapper = vi.fn(async (value: typeof successValue) => {
  await Promise.resolve();
  return {...value, id: value.id + 1};
});
const syncErrorMapper = vi.fn((error: Error) => new TypeError(error.message));
const asyncErrorMapper = vi.fn(async (error: Error) => {
  await Promise.resolve();
  return new TypeError(error.message);
});
const syncChain = vi.fn((value: typeof successValue) =>
  Ok({...value, id: value.id + 1}),
);
const asyncChain = vi.fn(async (value: typeof successValue) => {
  await Promise.resolve();
  return Ok({...value, id: value.id + 1});
});
const throwingSyncMapper = vi.fn(() => {
  throw new Error('Mapper error');
});
const throwingAsyncMapper = vi.fn(() => {
  throw new Error('Async mapper error');
});

const createAbortSignal = (aborted = false, reason?: unknown): AbortSignal => {
  const controller = new AbortController();
  if (aborted) controller.abort(reason);
  return controller.signal;
};

// ============================
// 顶层测试容器
// ============================
describe('transform-async', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================
  // mapAsync
  // ============================
  describe('mapAsync', () => {
    it.each([
      ['sync', syncMapper],
      ['async', asyncMapper],
    ])('should map Ok value with %s mapper', async (_, mapper) => {
      const result = Ok(successValue);
      const mapped = await mapAsync(result, mapper);
      expect(mapper).toHaveBeenCalledWith(successValue, undefined);
      expect(mapped).toEqual(Ok({...successValue, id: 2}));
    });

    it('should return original error without calling mapper', async () => {
      const result = Err(errorValue);
      const mapped = await mapAsync(result, syncMapper);
      expect(syncMapper).not.toHaveBeenCalled();
      expect(mapped).toEqual(Err(errorValue));
    });

    it('should handle Promise<Result> input', async () => {
      const resultPromise = Promise.resolve(Ok(successValue));
      const mapped = await mapAsync(resultPromise, syncMapper);
      expect(syncMapper).toHaveBeenCalled();
      expect(mapped.ok).toBe(true);
    });

    it.each([
      ['sync', throwingSyncMapper],
      ['async', throwingAsyncMapper],
    ])(
      'should catch %s mapper exceptions and return UnknownError',
      async (_, mapper) => {
        const result = Ok(successValue);
        const mapped = await mapAsync(result, mapper);
        expect(mapper).toHaveBeenCalled();
        expect(mapped.ok).toBe(false);
        expect((mapped as Failure<UnknownError>).error).toBeInstanceOf(
          UnknownError,
        );
      },
    );

    it('should handle aborted signal before execution', async () => {
      const signal = createAbortSignal(true, 'User cancelled');
      const result = Ok(successValue);
      const mapped = await mapAsync(result, syncMapper, signal);
      expect(syncMapper).not.toHaveBeenCalled();
      expect(mapped.ok).toBe(false);
      expect((mapped as Failure<DOMException>).error).toBeInstanceOf(
        DOMException,
      );
      expect((mapped as Failure<DOMException>).error.name).toBe('AbortError');
    });

    it('should handle signal abort during async mapper execution', async () => {
      const controller = new AbortController();
      const slowMapper = vi.fn(
        async (_value: typeof successValue, signal?: AbortSignal) => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          signal?.throwIfAborted();
          return transformedSuccess;
        },
      );

      const result = Ok(successValue);
      const promise = mapAsync(result, slowMapper, controller.signal);
      controller.abort(new DOMException('Aborted', 'AbortError'));

      const mapped = await promise;
      expect(mapped.ok).toBe(false);
      expect((mapped as Failure<DOMException>).error).toBeInstanceOf(
        DOMException,
      );
    });

    // 以下为 post-check 及多阶段中止测试
    it('should return AbortError if signal aborts after mapper resolves but before post-check', async () => {
      const controller = new AbortController();
      const naughtyMapper = (_val: unknown) => {
        controller.abort(new DOMException('Late abort', 'AbortError'));
        return 'I finished anyway!';
      };
      const result = Ok(successValue);
      const mapped = await mapAsync(result, naughtyMapper, controller.signal);
      expect(mapped.ok).toBe(false);
      expect((mapped as Failure<DOMException>).error).toBeInstanceOf(
        DOMException,
      );
      expect((mapped as Failure<DOMException>).error.message).toBe(
        'Late abort',
      );
    });

    it('should return AbortError if signal aborts after async mapper resolves', async () => {
      const controller = new AbortController();
      const naughtyAsyncMapper = async (_val: unknown) => {
        await Promise.resolve();
        controller.abort(new DOMException('Async late abort', 'AbortError'));
        return transformedSuccess;
      };
      const result = Ok(successValue);
      const mapped = await mapAsync(
        result,
        naughtyAsyncMapper,
        controller.signal,
      );
      expect(mapped.ok).toBe(false);
      expect((mapped as Failure<DOMException>).error).toBeInstanceOf(
        DOMException,
      );
      expect((mapped as Failure<DOMException>).error.message).toBe(
        'Async late abort',
      );
    });

    it('should handle abort at different stages', async () => {
      const controller = new AbortController();
      let callCount = 0;
      const multiStageMapper = async (_val: unknown, signal?: AbortSignal) => {
        callCount++;
        expect(signal?.aborted).toBe(false);
        await Promise.resolve();
        if (callCount === 1) {
          controller.abort(
            new DOMException('Mid-execution abort', 'AbortError'),
          );
        }
        return transformedSuccess;
      };
      const result = Ok(successValue);
      const mapped = await mapAsync(
        result,
        multiStageMapper,
        controller.signal,
      );
      expect(mapped.ok).toBe(false);
      expect((mapped as Failure<DOMException>).error).toBeInstanceOf(
        DOMException,
      );
      expect((mapped as Failure<DOMException>).error.message).toBe(
        'Mid-execution abort',
      );
    });
  });

  // ============================
  // mapErrAsync
  // ============================
  describe('mapErrAsync', () => {
    it.each([
      ['sync', syncErrorMapper],
      ['async', asyncErrorMapper],
    ])('should map Err value with %s mapper', async (_, mapper) => {
      const result = Err(errorValue);
      const mapped = await mapErrAsync(result, mapper);
      expect(mapper).toHaveBeenCalledWith(errorValue, undefined);
      expect(mapped).toEqual(Err(new TypeError('Original error')));
    });

    it('should return Ok value without calling mapper', async () => {
      const result = Ok(successValue);
      const mapped = await mapErrAsync(result, syncErrorMapper);
      expect(syncErrorMapper).not.toHaveBeenCalled();
      expect(mapped).toEqual(Ok(successValue));
    });

    it('should catch mapper exceptions and return UnknownError', async () => {
      const result = Err(errorValue);
      const mapped = await mapErrAsync(result, throwingSyncMapper);
      expect(throwingSyncMapper).toHaveBeenCalled();
      expect(mapped.ok).toBe(false);
      expect((mapped as Failure<UnknownError>).error).toBeInstanceOf(
        UnknownError,
      );
    });

    it('should handle aborted signal before execution', async () => {
      const signal = createAbortSignal(true);
      const result = Err(errorValue);
      const mapped = await mapErrAsync(result, syncErrorMapper, signal);
      expect(syncErrorMapper).not.toHaveBeenCalled();
      expect(mapped.ok).toBe(false);
      expect((mapped as Failure<DOMException>).error).toBeInstanceOf(
        DOMException,
      );
    });

    it('should return AbortError if signal aborts after mapper resolves', async () => {
      const controller = new AbortController();
      const naughtyErrorMapper = (_err: unknown) => {
        controller.abort(
          new DOMException('Error mapper late abort', 'AbortError'),
        );
        return transformedError;
      };
      const result = Err(errorValue);
      const mapped = await mapErrAsync(
        result,
        naughtyErrorMapper,
        controller.signal,
      );
      expect(mapped.ok).toBe(false);
      expect((mapped as Failure<DOMException>).error).toBeInstanceOf(
        DOMException,
      );
      expect((mapped as Failure<DOMException>).error.message).toBe(
        'Error mapper late abort',
      );
    });
  });

  // ============================
  // mapBothAsync
  // ============================
  describe('mapBothAsync', () => {
    it('should map Ok value with success mapper', async () => {
      const result = Ok(successValue);
      const mapped = await mapBothAsync(result, syncMapper, syncErrorMapper);
      expect(syncMapper).toHaveBeenCalledWith(successValue, undefined);
      expect(syncErrorMapper).not.toHaveBeenCalled();
      expect(mapped).toEqual(Ok({...successValue, id: 2}));
    });

    it('should map Err value with error mapper', async () => {
      const result = Err(errorValue);
      const mapped = await mapBothAsync(result, syncMapper, syncErrorMapper);
      expect(syncErrorMapper).toHaveBeenCalledWith(errorValue, undefined);
      expect(syncMapper).not.toHaveBeenCalled();
      expect(mapped).toEqual(Err(new TypeError('Original error')));
    });

    it('should handle async mappers', async () => {
      const result = Ok(successValue);
      const mapped = await mapBothAsync(result, asyncMapper, asyncErrorMapper);
      expect(asyncMapper).toHaveBeenCalled();
      expect(asyncErrorMapper).not.toHaveBeenCalled();
      expect(mapped).toEqual(Ok({...successValue, id: 2}));
    });

    it('should catch exceptions from success mapper', async () => {
      const result = Ok(successValue);
      const mapped = await mapBothAsync(
        result,
        throwingSyncMapper,
        syncErrorMapper,
      );
      expect(throwingSyncMapper).toHaveBeenCalled();
      expect(mapped.ok).toBe(false);
      expect((mapped as Failure<UnknownError>).error).toBeInstanceOf(
        UnknownError,
      );
    });

    it('should catch exceptions from error mapper', async () => {
      const result = Err(errorValue);
      const mapped = await mapBothAsync(result, syncMapper, throwingSyncMapper);
      expect(throwingSyncMapper).toHaveBeenCalled();
      expect(mapped.ok).toBe(false);
      expect((mapped as Failure<UnknownError>).error).toBeInstanceOf(
        UnknownError,
      );
    });

    it('should handle aborted signal before execution', async () => {
      const signal = createAbortSignal(true, 'Cancelled before execution');
      const result = Ok(successValue);
      const mapped = await mapBothAsync(
        result,
        syncMapper,
        syncErrorMapper,
        signal,
      );
      expect(mapped.ok).toBe(false);
      expect((mapped as Failure<DOMException>).error).toBeInstanceOf(
        DOMException,
      );
      expect((mapped as Failure<DOMException>).error.message).toContain(
        'Cancelled before execution',
      );
      expect(syncMapper).not.toHaveBeenCalled();
      expect(syncErrorMapper).not.toHaveBeenCalled();
    });

    it('should return AbortError if signal aborts after success mapper resolves', async () => {
      const controller = new AbortController();
      const naughtySuccessMapper = (_val: unknown) => {
        controller.abort(
          new DOMException('Success mapper late abort', 'AbortError'),
        );
        return transformedSuccess;
      };
      const result = Ok(successValue);
      const mapped = await mapBothAsync(
        result,
        naughtySuccessMapper,
        asyncErrorMapper,
        controller.signal,
      );
      expect(mapped.ok).toBe(false);
      expect((mapped as Failure<DOMException>).error).toBeInstanceOf(
        DOMException,
      );
      expect((mapped as Failure<DOMException>).error.message).toBe(
        'Success mapper late abort',
      );
    });

    it('should return AbortError if signal aborts after error mapper resolves', async () => {
      const controller = new AbortController();
      const naughtyErrorMapper = (_err: unknown) => {
        controller.abort(
          new DOMException('Both error mapper late abort', 'AbortError'),
        );
        return transformedError;
      };
      const result = Err(errorValue);
      const mapped = await mapBothAsync(
        result,
        asyncMapper,
        naughtyErrorMapper,
        controller.signal,
      );
      expect(mapped.ok).toBe(false);
      expect((mapped as Failure<DOMException>).error).toBeInstanceOf(
        DOMException,
      );
      expect((mapped as Failure<DOMException>).error.message).toBe(
        'Both error mapper late abort',
      );
    });
  });

  // ============================
  // andThenAsync
  // ============================
  describe('andThenAsync', () => {
    it.each([
      ['sync', syncChain],
      ['async', asyncChain],
    ])('should chain %s operation on Ok value', async (_, chain) => {
      const result = Ok(successValue);
      const chained = await andThenAsync(result, chain);
      expect(chain).toHaveBeenCalledWith(successValue, undefined);
      expect(chained).toEqual(Ok({...successValue, id: 2}));
    });

    it('should return original error without calling chain', async () => {
      const result = Err(errorValue);
      const chained = await andThenAsync(result, syncChain);
      expect(syncChain).not.toHaveBeenCalled();
      expect(chained).toEqual(Err(errorValue));
    });

    it('should handle chained function returning Err', async () => {
      const errorChain = vi.fn(() => Err(new Error('Chain error')));
      const result = Ok(successValue);
      const chained = await andThenAsync(result, errorChain);
      expect(errorChain).toHaveBeenCalled();
      expect(chained.ok).toBe(false);
      expect((chained as Failure<Error>).error.message).toBe('Chain error');
    });

    it('should catch exceptions from chained function', async () => {
      const result = Ok(successValue);
      const chained = await andThenAsync(result, throwingSyncMapper);
      expect(throwingSyncMapper).toHaveBeenCalled();
      expect(chained.ok).toBe(false);
      expect((chained as Failure<UnknownError>).error).toBeInstanceOf(
        UnknownError,
      );
    });

    it('should handle Promise<Result> from chained function', async () => {
      const promiseChain = vi.fn(() => Promise.resolve(Err(errorValue)));
      const result = Ok(successValue);
      const chained = await andThenAsync(result, promiseChain);
      expect(promiseChain).toHaveBeenCalled();
      expect(chained).toEqual(Err(errorValue));
    });

    it('should handle aborted signal before execution', async () => {
      const signal = createAbortSignal(true, 'User cancelled');
      const result = Ok(successValue);
      const chained = await andThenAsync(result, syncChain, signal);
      expect(syncChain).not.toHaveBeenCalled();
      expect(chained.ok).toBe(false);
      expect((chained as Failure<DOMException>).error).toBeInstanceOf(
        DOMException,
      );
    });

    it('should return AbortError if signal aborts after chain fn resolves', async () => {
      const controller = new AbortController();
      const naughtyChainFn = (_val: unknown) => {
        controller.abort(new DOMException('Chain late abort', 'AbortError'));
        return Ok(transformedSuccess);
      };
      const result = Ok(successValue);
      const chained = await andThenAsync(
        result,
        naughtyChainFn,
        controller.signal,
      );
      expect(chained.ok).toBe(false);
      expect((chained as Failure<DOMException>).error).toBeInstanceOf(
        DOMException,
      );
      expect((chained as Failure<DOMException>).error.message).toBe(
        'Chain late abort',
      );
    });

    it('should return AbortError if signal aborts after async chain returns result', async () => {
      const controller = new AbortController();
      const naughtyAsyncChain = async (_val: unknown) => {
        const promiseResult = Promise.resolve(Ok(transformedSuccess));
        controller.abort(
          new DOMException('Async chain late abort', 'AbortError'),
        );
        return promiseResult;
      };
      const result = Ok(successValue);
      const chained = await andThenAsync(
        result,
        naughtyAsyncChain,
        controller.signal,
      );
      expect(chained.ok).toBe(false);
      expect((chained as Failure<DOMException>).error).toBeInstanceOf(
        DOMException,
      );
      expect((chained as Failure<DOMException>).error.message).toBe(
        'Async chain late abort',
      );
    });
  });

  // ============================
  // recoverAsync
  // ============================
  describe('recoverAsync', () => {
    it('should return Ok value without calling recovery', async () => {
      const result = Ok(successValue);
      const recovered = await recoverAsync(result, syncChain);
      expect(syncChain).not.toHaveBeenCalled();
      expect(recovered).toEqual(Ok(successValue));
    });

    it.each([
      ['sync', vi.fn(() => Ok(transformedSuccess))],
      ['async', vi.fn(() => Ok(transformedSuccess))],
    ])('should recover from error with %s function', async (_, recoveryFn) => {
      const result = Err(errorValue);
      const recovered = await recoverAsync(result, recoveryFn);
      expect(recoveryFn).toHaveBeenCalledWith(errorValue, undefined);
      expect(recovered).toEqual(Ok(transformedSuccess));
    });

    it('should return error if recovery returns Err', async () => {
      const result = Err(errorValue);
      const failedRecovery = vi.fn(() => Err(transformedError));
      const recovered = await recoverAsync(result, failedRecovery);
      expect(failedRecovery).toHaveBeenCalled();
      expect(recovered).toEqual(Err(transformedError));
    });

    it('should catch exceptions from recovery function', async () => {
      const result = Err(errorValue);
      const recovered = await recoverAsync(result, throwingSyncMapper);
      expect(throwingSyncMapper).toHaveBeenCalled();
      expect(recovered.ok).toBe(false);
      expect((recovered as Failure<UnknownError>).error).toBeInstanceOf(
        UnknownError,
      );
    });

    it('should handle aborted signal before execution', async () => {
      const signal = createAbortSignal(true, 'Pre-aborted signal');
      const result = Err(errorValue);
      const recoveryFn = vi.fn(() => Ok(transformedSuccess));
      const recovered = await recoverAsync(result, recoveryFn, signal);
      expect(recoveryFn).not.toHaveBeenCalled();
      expect(recovered.ok).toBe(false);
      expect((recovered as Failure<DOMException>).error).toBeInstanceOf(
        DOMException,
      );
    });

    it('should return AbortError if signal aborts after recovery fn resolves', async () => {
      const controller = new AbortController();
      const naughtyRecoveryFn = (_err: unknown) => {
        controller.abort(new DOMException('Recovery late abort', 'AbortError'));
        return Ok(transformedSuccess);
      };
      const result = Err(errorValue);
      const recovered = await recoverAsync(
        result,
        naughtyRecoveryFn,
        controller.signal,
      );
      expect(recovered.ok).toBe(false);
      expect((recovered as Failure<DOMException>).error).toBeInstanceOf(
        DOMException,
      );
      expect((recovered as Failure<DOMException>).error.message).toBe(
        'Recovery late abort',
      );
    });
  });

  // ============================
  // orElseAsync
  // ============================
  describe('orElseAsync', () => {
    it('should return Ok value without calling alternative', async () => {
      const result = Ok(successValue);
      const alternative = await orElseAsync(result, syncChain);
      expect(syncChain).not.toHaveBeenCalled();
      expect(alternative).toEqual(Ok(successValue));
    });

    it.each([
      ['sync', vi.fn(() => Ok(successValue))],
      ['async', vi.fn(() => Ok(successValue))],
    ])(
      'should execute alternative on error with %s function',
      async (_, altFn) => {
        const result = Err(errorValue);
        const alternative = await orElseAsync(result, altFn);
        expect(altFn).toHaveBeenCalledWith(errorValue, undefined);
        expect(alternative).toEqual(Ok(successValue));
      },
    );

    it('should return error if alternative returns Err', async () => {
      const result = Err(errorValue);
      const alternativeFn = vi.fn(() => Err(transformedError));
      const alternative = await orElseAsync(result, alternativeFn);
      expect(alternativeFn).toHaveBeenCalled();
      expect(alternative).toEqual(Err(transformedError));
    });

    it('should catch exceptions from alternative function', async () => {
      const result = Err(errorValue);
      const alternative = await orElseAsync(result, throwingSyncMapper);
      expect(throwingSyncMapper).toHaveBeenCalled();
      expect(alternative.ok).toBe(false);
      expect((alternative as Failure<UnknownError>).error).toBeInstanceOf(
        UnknownError,
      );
    });

    it('should handle aborted signal before execution', async () => {
      const signal = createAbortSignal(true, 'Signal was already aborted');
      const result = Err(errorValue);
      const alternativeFn = vi.fn(() => Ok(successValue));
      const alternative = await orElseAsync(result, alternativeFn, signal);
      expect(alternativeFn).not.toHaveBeenCalled();
      expect(alternative.ok).toBe(false);
      expect((alternative as Failure<DOMException>).error).toBeInstanceOf(
        DOMException,
      );
    });

    it('should return AbortError if signal aborts after alternative fn resolves', async () => {
      const controller = new AbortController();
      const naughtyAlternativeFn = (_err: unknown) => {
        controller.abort(
          new DOMException('Alternative late abort', 'AbortError'),
        );
        return Ok(successValue);
      };
      const result = Err(errorValue);
      const alternative = await orElseAsync(
        result,
        naughtyAlternativeFn,
        controller.signal,
      );
      expect(alternative.ok).toBe(false);
      expect((alternative as Failure<DOMException>).error).toBeInstanceOf(
        DOMException,
      );
      expect((alternative as Failure<DOMException>).error.message).toBe(
        'Alternative late abort',
      );
    });
  });

  // ============================
  // filterAsync
  // ============================
  describe('filterAsync', () => {
    const syncPredicate = vi.fn((value: typeof successValue) => value.id > 0);
    const asyncPredicate = vi.fn(async (value: typeof successValue) => {
      await Promise.resolve();
      return value.id > 0;
    });
    const getError = vi.fn(() => filterError);

    it.each([
      ['sync', syncPredicate],
      ['async', asyncPredicate],
    ])(
      'should return Ok value when %s predicate passes',
      async (_, predicate) => {
        const result = Ok(successValue);
        const filtered = await filterAsync(result, predicate, getError);
        expect(predicate).toHaveBeenCalledWith(successValue, undefined);
        expect(filtered).toEqual(Ok(successValue));
      },
    );

    it('should return Err when predicate fails', async () => {
      const failingPredicate = vi.fn(() => false);
      const result = Ok(successValue);
      const filtered = await filterAsync(result, failingPredicate, getError);
      expect(failingPredicate).toHaveBeenCalled();
      expect(getError).toHaveBeenCalledWith(successValue, undefined);
      expect(filtered).toEqual(Err(filterError));
    });

    it('should return original error without evaluating predicate', async () => {
      const result = Err(errorValue);
      const filtered = await filterAsync(result, syncPredicate, getError);
      expect(syncPredicate).not.toHaveBeenCalled();
      expect(getError).not.toHaveBeenCalled();
      expect(filtered).toEqual(Err(errorValue));
    });

    it('should catch predicate exceptions', async () => {
      const result = Ok(successValue);
      const filtered = await filterAsync(result, throwingSyncMapper, getError);
      expect(throwingSyncMapper).toHaveBeenCalled();
      expect(filtered.ok).toBe(false);
      expect((filtered as Failure<UnknownError>).error).toBeInstanceOf(
        UnknownError,
      );
    });

    it('should catch get_error_on_fail exceptions', async () => {
      const failingPredicate = vi.fn(() => false);
      const throwingGetError = vi.fn(() => {
        throw new Error('Get error failed');
      });
      const result = Ok(successValue);
      const filtered = await filterAsync(
        result,
        failingPredicate,
        throwingGetError,
      );
      expect(failingPredicate).toHaveBeenCalled();
      expect(throwingGetError).toHaveBeenCalled();
      expect(filtered.ok).toBe(false);
      expect((filtered as Failure<UnknownError>).error).toBeInstanceOf(
        UnknownError,
      );
    });

    it('should handle aborted signal before execution', async () => {
      const signal = createAbortSignal(true);
      const result = Ok(successValue);
      const filtered = await filterAsync(
        result,
        syncPredicate,
        getError,
        signal,
      );
      expect(syncPredicate).not.toHaveBeenCalled();
      expect(filtered.ok).toBe(false);
      expect((filtered as Failure<DOMException>).error).toBeInstanceOf(
        DOMException,
      );
    });

    it('should return AbortError if signal aborts after predicate resolves', async () => {
      const controller = new AbortController();
      const naughtyPredicate = (_val: unknown) => {
        controller.abort(
          new DOMException('Predicate late abort', 'AbortError'),
        );
        return true;
      };
      const result = Ok(successValue);
      const filtered = await filterAsync(
        result,
        naughtyPredicate,
        getError,
        controller.signal,
      );
      expect(filtered.ok).toBe(false);
      expect((filtered as Failure<DOMException>).error).toBeInstanceOf(
        DOMException,
      );
      expect((filtered as Failure<DOMException>).error.message).toBe(
        'Predicate late abort',
      );
      expect(getError).not.toHaveBeenCalled();
    });

    it('should return AbortError if signal aborts after get_error_on_fail resolves', async () => {
      const controller = new AbortController();
      const naughtyGetError = (_val: unknown) => {
        controller.abort(new DOMException('GetError late abort', 'AbortError'));
        return filterError;
      };
      const failingPredicate = vi.fn(() => false);
      const result = Ok(successValue);
      const filtered = await filterAsync(
        result,
        failingPredicate,
        naughtyGetError,
        controller.signal,
      );
      expect(filtered.ok).toBe(false);
      expect((filtered as Failure<DOMException>).error).toBeInstanceOf(
        DOMException,
      );
      expect((filtered as Failure<DOMException>).error.message).toBe(
        'GetError late abort',
      );
      expect(failingPredicate).toHaveBeenCalled();
    });
  });

  // ============================
  // 边界情况（主要针对 mapAsync，但也覆盖通用逻辑）
  // ============================
  describe.concurrent('Edge Cases', () => {
    it('should handle null and undefined values in mappers', async () => {
      const nullResult = Ok(null);
      const undefinedResult = Ok(undefined);
      const nullMapper = vi.fn((value: null) => value);
      const undefinedMapper = vi.fn((value: undefined) => value);

      const nullMapped = await mapAsync(nullResult, nullMapper);
      const undefinedMapped = await mapAsync(undefinedResult, undefinedMapper);

      expect(nullMapper).toHaveBeenCalledWith(null, undefined);
      expect(undefinedMapper).toHaveBeenCalledWith(undefined, undefined);
      expect(nullMapped).toEqual(Ok(null));
      expect(undefinedMapped).toEqual(Ok(undefined));
    });

    it('should wrap non-Error exceptions in UnknownError', async () => {
      const throwingString = vi.fn(() => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw 'Plain string error';
      });
      const result = Ok(successValue);
      const mapped = await mapAsync(result, throwingString);
      expect(throwingString).toHaveBeenCalled();
      expect(mapped.ok).toBe(false);
      expect((mapped as Failure<UnknownError>).error).toBeInstanceOf(
        UnknownError,
      );
    });

    it('should preserve DOMException AbortError', async () => {
      const throwingAbort = vi.fn(() => {
        throw new DOMException('Aborted', 'AbortError');
      });
      const result = Ok(successValue);
      const mapped = await mapAsync(result, throwingAbort);
      expect(mapped.ok).toBe(false);
      expect((mapped as Failure<DOMException>).error).toBeInstanceOf(
        DOMException,
      );
      expect((mapped as Failure<DOMException>).error.name).toBe('AbortError');
    });

    it('should pass abort signal to mapper functions', async () => {
      const signal = createAbortSignal(false);
      const mapperWithSignal = vi.fn((_value: unknown, s?: AbortSignal) => {
        expect(s).toBe(signal);
        return transformedSuccess;
      });
      const result = Ok(successValue);
      await mapAsync(result, mapperWithSignal, signal);
      expect(mapperWithSignal).toHaveBeenCalledWith(successValue, signal);
    });
  });
});
