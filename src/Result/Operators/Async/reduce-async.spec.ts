import {beforeEach, describe, it, expect, vi} from 'vitest';
import {reduceAsync} from './reduce-async';
import {Ok, Err} from '../../base';
import {UnknownError} from '../../../unknown-error';
import type {AnyResult, AsyncResult, Failure} from '../../types';

const errorValue = new Error('Something went wrong');

const mockSuccessReducer = vi.fn(
  (acc: number, value: {id: number; name: string}) => acc + value.id,
);

const createAbortSignal = (aborted = false, reason?: unknown): AbortSignal => {
  const controller = new AbortController();
  if (aborted) {
    controller.abort(reason);
  }
  return controller.signal;
};

describe('Async Reducer Operators', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('reduceAsync', () => {
    it('should hit the loop-top abort check by aborting during a slow promise resolution', async () => {
      const controller = new AbortController();

      const slowPromise: AsyncResult<number, never> = new Promise((resolve) => {
        setTimeout(() => {
          controller.abort('Catch you!');
          resolve(Ok(2));
        }, 10);
      });

      const results = [Ok(1), slowPromise];

      const reduced = await reduceAsync(
        results,
        0,
        (acc: number, value: number) => acc + value,
        controller.signal,
      );

      expect(reduced.ok).toBe(false);
    });

    it('should abort during iteration when signal becomes aborted', async () => {
      const controller = new AbortController();
      const signal = controller.signal;

      let callCount = 0;
      const reducer = vi.fn((acc: number, value: number) => {
        callCount++;
        if (callCount === 2) {
          controller.abort('Aborted during iteration');
        }
        return acc + value;
      });

      const results = [Ok(1), Ok(2), Ok(3)];

      const reduced = await reduceAsync(results, 0, reducer, signal);

      expect(reducer).toHaveBeenCalledTimes(2);
      expect(reducer).toHaveBeenCalledWith(0, 1, signal);

      expect(reduced.ok).toBe(false);
      const error = (reduced as Failure<DOMException>).error;
      expect(error).toBeInstanceOf(DOMException);
      expect(error.name).toBe('AbortError');
      expect(error.message).toContain('Aborted during iteration');
    });

    it('should check abort signal before processing each promise in iteration', async () => {
      const controller = new AbortController();
      const signal = controller.signal;

      const results = [Ok(1), Ok(2), Ok(3)];
      const callOrder: number[] = [];

      const reducer = vi.fn(async (acc: number, value: number) => {
        callOrder.push(value);

        if (value === 1) {
          setTimeout(() => controller.abort('Abort after first'), 0);
        }

        await new Promise((resolve) => setTimeout(resolve, 10));
        return acc + value;
      });

      const reduced = await reduceAsync(results, 0, reducer, signal);

      expect(callOrder).toEqual([1]);
      expect(reducer).toHaveBeenCalledTimes(1);

      expect(reduced.ok).toBe(false);
      const error = (reduced as Failure<DOMException>).error;
      expect(error).toBeInstanceOf(DOMException);
      expect(error.name).toBe('AbortError');
    });

    it('should reduce array of Ok values sequentially', async () => {
      const results = [Ok(1), Ok(2), Ok(3)];
      const reducer = vi.fn((acc: number, value: number) => acc + value);

      const reduced = await reduceAsync(results, 0, reducer);

      expect(reducer).toHaveBeenCalledTimes(3);
      expect(reducer.mock.calls[0]).toEqual([0, 1, undefined]);
      expect(reducer.mock.calls[1]).toEqual([1, 2, undefined]);
      expect(reducer.mock.calls[2]).toEqual([3, 3, undefined]);
      expect(reduced).toEqual(Ok(6));
    });

    it('should short-circuit on first Err value', async () => {
      const results = [Ok(1), Err(errorValue), Ok(3)];
      const reducer = vi.fn((acc: number, value: number) => acc + value);

      const reduced = await reduceAsync(results, 0, reducer);

      expect(reducer).toHaveBeenCalledTimes(1);
      expect(reduced).toEqual(Err(errorValue));
    });

    it('should handle empty array', async () => {
      const results: AnyResult<number, Error>[] = [];
      const reducer = vi.fn((acc: number, value: number) => acc + value);

      const reduced = await reduceAsync(results, 10, reducer);

      expect(reducer).not.toHaveBeenCalled();
      expect(reduced).toEqual(Ok(10));
    });

    it('should propagate reducer exceptions as UnknownError', async () => {
      const results = [Ok(1), Ok(2)];
      const throwingReducer = vi.fn(() => {
        throw new Error('Reducer error');
      });

      const reduced = await reduceAsync(results, 0, throwingReducer);

      expect(throwingReducer).toHaveBeenCalled();
      expect(reduced.ok).toBe(false);
      expect((reduced as Failure<UnknownError>).error).toBeInstanceOf(
        UnknownError,
      );
    });

    it('should handle aborted signal', async () => {
      const signal = createAbortSignal(true, 'User cancelled');
      const results = [Ok(1), Ok(2)];
      const reducer = vi.fn((acc: number, value: number) => acc + value);

      const reduced = await reduceAsync(results, 0, reducer, signal);

      expect(reducer).not.toHaveBeenCalled();
      expect(reduced).toEqual(Err(expect.any(DOMException)));
      expect((reduced as Failure<DOMException>).error.name).toBe('AbortError');
    });

    it('should pass abort signal to reducer', async () => {
      const signal = createAbortSignal(false);
      const results = [Ok(1)];
      const reducer = vi.fn((acc: number, value: number, s?: AbortSignal) => {
        expect(s).toBe(signal);
        return acc + value;
      });

      await reduceAsync(results, 0, reducer, signal);

      expect(reducer).toHaveBeenCalledWith(0, 1, signal);
    });

    it('should preserve original error types when not using reducer', async () => {
      const customError = new TypeError('Type error');
      const results = [Err(customError)];

      const reduced = await reduceAsync(results, 0, mockSuccessReducer);

      expect(reduced).toEqual(Err(customError));
    });

    it('should wrap non-DOMException errors in UnknownError', async () => {
      const results = [Ok(1)];
      const throwingReducer = vi.fn(() => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw 'Plain string error';
      });

      const reduced = await reduceAsync(results, 0, throwingReducer);

      expect(reduced.ok).toBe(false);
      expect((reduced as Failure<UnknownError>).error).toBeInstanceOf(
        UnknownError,
      );
    });

    it('should preserve DOMException AbortError', async () => {
      const signal = createAbortSignal(
        true,
        new DOMException('Aborted', 'AbortError'),
      );
      const results = [Ok(1)];
      const reducer = vi.fn((acc: number, value: number) => acc + value);

      const reduced = await reduceAsync(results, 0, reducer, signal);

      expect(reduced.ok).toBe(false);
      expect((reduced as Failure<DOMException>).error).toBeInstanceOf(
        DOMException,
      );
      expect((reduced as Failure<DOMException>).error.name).toBe('AbortError');
    });
  });

  describe.concurrent('additional edge cases', () => {
    it('should handle null and undefined values in results', async () => {
      const results = [Ok(null), Ok(undefined)];
      const reducer = vi.fn((acc: number, _value: null | undefined) => acc + 1);

      const reduced = await reduceAsync(results, 0, reducer);

      expect(reducer).toHaveBeenCalledTimes(2);
      expect(reduced).toEqual(Ok(2));
    });
  });
});
