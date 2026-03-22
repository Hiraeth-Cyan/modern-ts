import {describe, it, expect, vi} from 'vitest';
import {Ok, Err} from '../base';
import {UnknownError} from '../../unknown-error';
import {
  matchResultAsync,
  ifOkAsync,
  ifErrAsync,
  mapOrElseAsync,
} from './branch-async';

// ============================
// 测试辅助数据（保持不变，所有测试共享）
// ============================
const successValue = 'success data';
const errorValue = new Error('operation failed');

/**
 * 创建 AbortSignal 模拟
 */
const createAbortSignal = (aborted = false): AbortSignal => {
  const controller = new AbortController();
  if (aborted) controller.abort();
  return controller.signal;
};

describe.concurrent('Result Async Consumer Functions', () => {
  // ========== matchResultAsync ==========
  describe('matchResultAsync', () => {
    it('should call onOk with value and signal when Result is Ok', async () => {
      const onOk = vi.fn<(value: string, signal?: AbortSignal) => string>(
        (value) => `ok: ${value}`,
      );
      const onErr = vi.fn<(error: Error, signal?: AbortSignal) => string>();
      const result = Ok(successValue);

      const output = await matchResultAsync(result, onOk, onErr);

      expect(onOk).toHaveBeenCalledWith(successValue, undefined);
      expect(onErr).not.toHaveBeenCalled();
      expect(output).toBe('ok: success data');
    });

    it('should call onErr with error and signal when Result is Err', async () => {
      const onOk = vi.fn<(value: string, signal?: AbortSignal) => string>();
      const onErr = vi.fn<(error: Error, signal?: AbortSignal) => string>(
        (err) => `err: ${err.message}`,
      );
      const result = Err(errorValue);

      const output = await matchResultAsync(result, onOk, onErr);

      expect(onErr).toHaveBeenCalledWith(errorValue, undefined);
      expect(onOk).not.toHaveBeenCalled();
      expect(output).toBe('err: operation failed');
    });

    it('should work with Promise-wrapped Result', async () => {
      const onOk = vi.fn<(value: string, signal?: AbortSignal) => string>(
        (value) => `ok: ${value}`,
      );
      const onErr = vi.fn<(error: Error, signal?: AbortSignal) => string>();
      const resultPromise = Promise.resolve(Ok(successValue));

      const output = await matchResultAsync(resultPromise, onOk, onErr);

      expect(onOk).toHaveBeenCalledWith(successValue, undefined);
      expect(output).toBe('ok: success data');
    });

    it('should pass AbortSignal to callbacks', async () => {
      const signal = createAbortSignal();
      const onOk = vi.fn<(value: string, sig?: AbortSignal) => string>(
        (value, sig) => {
          expect(sig).toBe(signal);
          return value;
        },
      );
      const onErr = vi.fn<(error: Error, signal?: AbortSignal) => string>();
      const result = Ok(successValue);

      await matchResultAsync(result, onOk, onErr, signal);
    });

    it('should return UnknownError when onOk throws', async () => {
      const onOk = vi.fn<(value: string, signal?: AbortSignal) => string>(
        () => {
          throw new Error('onOk error');
        },
      );
      const onErr = vi.fn<(error: Error, signal?: AbortSignal) => string>();
      const result = Ok(successValue);

      const output = await matchResultAsync(result, onOk, onErr);

      expect(onOk).toHaveBeenCalled();
      expect(output).toBeInstanceOf(UnknownError);
    });

    it('should return UnknownError when onErr throws', async () => {
      const onOk = vi.fn<(value: string, signal?: AbortSignal) => string>();
      const onErr = vi.fn<(error: Error, signal?: AbortSignal) => string>(
        () => {
          throw new Error('onErr error');
        },
      );
      const result = Err(errorValue);

      const output = await matchResultAsync(result, onOk, onErr);

      expect(onErr).toHaveBeenCalled();
      expect(output).toBeInstanceOf(UnknownError);
    });
  });

  // ========== ifOkAsync ==========
  describe('ifOkAsync', () => {
    // ---------- 单回调重载 ----------
    describe('single callback overload', () => {
      it('should call onOk and return its result for Ok', async () => {
        const onOk = vi.fn<(value: string) => string>(
          (value) => `ok: ${value}`,
        );
        const result = Ok(successValue);

        const output = await ifOkAsync(result, onOk);

        expect(onOk).toHaveBeenCalledWith(successValue);
        expect(output).toBe('ok: success data');
      });

      it('should return undefined for Err (no callback)', async () => {
        const onOk = vi.fn<(value: string) => string>();
        const result = Err(errorValue);

        const output = await ifOkAsync(result, onOk);

        expect(onOk).not.toHaveBeenCalled();
        expect(output).toBeUndefined();
      });

      it('should return UnknownError when onOk throws', async () => {
        const onOk = vi.fn<(value: string) => string>(() => {
          throw new Error('onOk error');
        });
        const result = Ok(successValue);

        const output = await ifOkAsync(result, onOk);

        expect(onOk).toHaveBeenCalled();
        expect(output).toBeInstanceOf(UnknownError);
      });
    });

    // ---------- 双回调重载 ----------
    describe('dual callback overload', () => {
      it('should call onOk and return its result for Ok', async () => {
        const onOk = vi.fn<(value: string) => string>(
          (value) => `ok: ${value}`,
        );
        const onElse = vi.fn<(error: Error) => string>();
        const result = Ok(successValue);

        const output = await ifOkAsync(result, onOk, onElse);

        expect(onOk).toHaveBeenCalledWith(successValue);
        expect(onElse).not.toHaveBeenCalled();
        expect(output).toBe('ok: success data');
      });

      it('should call onElse and return its result for Err', async () => {
        const onOk = vi.fn<(value: string) => string>();
        const onElse = vi.fn<(error: Error) => string>(
          (err) => `else: ${err.message}`,
        );
        const result = Err(errorValue);

        const output = await ifOkAsync(result, onOk, onElse);

        expect(onElse).toHaveBeenCalledWith(errorValue);
        expect(onOk).not.toHaveBeenCalled();
        expect(output).toBe('else: operation failed');
      });

      it('should return UnknownError when onElse throws (Err case)', async () => {
        const onOk = vi.fn<(value: string) => string>();
        const onElse = vi.fn<(error: Error) => string>(() => {
          throw new Error('onElse error');
        });
        const result = Err(errorValue);

        const output = await ifOkAsync(result, onOk, onElse);

        expect(onElse).toHaveBeenCalled();
        expect(output).toBeInstanceOf(UnknownError);
      });
    });
  });

  // ========== ifErrAsync ==========
  describe('ifErrAsync', () => {
    // ---------- 单回调重载 ----------
    describe('single callback overload', () => {
      it('should call onErr and return its result for Err', async () => {
        const onErr = vi.fn<(error: Error) => string>(
          (err) => `err: ${err.message}`,
        );
        const result = Err(errorValue);

        const output = await ifErrAsync(result, onErr);

        expect(onErr).toHaveBeenCalledWith(errorValue);
        expect(output).toBe('err: operation failed');
      });

      it('should return undefined for Ok (no callback)', async () => {
        const onErr = vi.fn<(error: Error) => string>();
        const result = Ok(successValue);

        const output = await ifErrAsync(result, onErr);

        expect(onErr).not.toHaveBeenCalled();
        expect(output).toBeUndefined();
      });

      it('should return UnknownError when onErr throws', async () => {
        const onErr = vi.fn<(error: Error) => string>(() => {
          throw new Error('onErr error');
        });
        const result = Err(errorValue);

        const output = await ifErrAsync(result, onErr);

        expect(onErr).toHaveBeenCalled();
        expect(output).toBeInstanceOf(UnknownError);
      });
    });

    // ---------- 双回调重载 ----------
    describe('dual callback overload', () => {
      it('should call onErr and return its result for Err', async () => {
        const onErr = vi.fn<(error: Error) => string>(
          (err) => `err: ${err.message}`,
        );
        const onElse = vi.fn<(value: string) => string>();
        const result = Err(errorValue);

        const output = await ifErrAsync(result, onErr, onElse);

        expect(onErr).toHaveBeenCalledWith(errorValue);
        expect(onElse).not.toHaveBeenCalled();
        expect(output).toBe('err: operation failed');
      });

      it('should call onElse and return its result for Ok', async () => {
        const onErr = vi.fn<(error: Error) => string>();
        const onElse = vi.fn<(value: string) => string>(
          (value) => `else: ${value}`,
        );
        const result = Ok(successValue);

        const output = await ifErrAsync(result, onErr, onElse);

        expect(onElse).toHaveBeenCalledWith(successValue);
        expect(onErr).not.toHaveBeenCalled();
        expect(output).toBe('else: success data');
      });

      it('should return UnknownError when onElse throws (Ok case)', async () => {
        const onErr = vi.fn<(error: Error) => string>();
        const onElse = vi.fn<(value: string) => string>(() => {
          throw new Error('onElse error');
        });
        const result = Ok(successValue);

        const output = await ifErrAsync(result, onErr, onElse);

        expect(onElse).toHaveBeenCalled();
        expect(output).toBeInstanceOf(UnknownError);
      });
    });
  });

  // ========== mapOrElseAsync ==========
  describe('mapOrElseAsync', () => {
    it('should call mapFn and return its result for Ok', async () => {
      const mapFn = vi.fn<(value: string) => string>(
        (value) => `mapped: ${value}`,
      );
      const defaultFn = vi.fn<(error: Error) => string>();
      const result = Ok(successValue);

      const output = await mapOrElseAsync(result, defaultFn, mapFn);

      expect(mapFn).toHaveBeenCalledWith(successValue);
      expect(defaultFn).not.toHaveBeenCalled();
      expect(output).toBe('mapped: success data');
    });

    it('should call defaultFn and return its result for Err', async () => {
      const mapFn = vi.fn<(value: string) => string>();
      const defaultFn = vi.fn<(error: Error) => string>(
        (err) => `default: ${err.message}`,
      );
      const result = Err(errorValue);

      const output = await mapOrElseAsync(result, defaultFn, mapFn);

      expect(defaultFn).toHaveBeenCalledWith(errorValue);
      expect(mapFn).not.toHaveBeenCalled();
      expect(output).toBe('default: operation failed');
    });

    it('should work with Promise-wrapped Result', async () => {
      const mapFn = vi.fn<(value: string) => string>(
        (value) => `mapped: ${value}`,
      );
      const defaultFn = vi.fn<(error: Error) => string>();
      const resultPromise = Promise.resolve(Ok(successValue));

      const output = await mapOrElseAsync(resultPromise, defaultFn, mapFn);

      expect(mapFn).toHaveBeenCalledWith(successValue);
      expect(output).toBe('mapped: success data');
    });

    it('should return UnknownError when mapFn throws', async () => {
      const mapFn = vi.fn<(value: string) => string>(() => {
        throw new Error('map error');
      });
      const defaultFn = vi.fn<(error: Error) => string>();
      const result = Ok(successValue);

      const output = await mapOrElseAsync(result, defaultFn, mapFn);

      expect(mapFn).toHaveBeenCalled();
      expect(output).toBeInstanceOf(UnknownError);
    });

    it('should return UnknownError when defaultFn throws', async () => {
      const mapFn = vi.fn<(value: string) => string>();
      const defaultFn = vi.fn<(error: Error) => string>(() => {
        throw new Error('default error');
      });
      const result = Err(errorValue);

      const output = await mapOrElseAsync(result, defaultFn, mapFn);

      expect(defaultFn).toHaveBeenCalled();
      expect(output).toBeInstanceOf(UnknownError);
    });

    it('should support synchronous callbacks', async () => {
      const syncMap = vi.fn<(value: string) => string>(
        (value) => `sync: ${value}`,
      );
      const syncDefault = vi.fn<(error: Error) => string>(
        (err) => `sync default: ${err.message}`,
      );

      const okResult = await mapOrElseAsync(
        Ok(successValue),
        syncDefault,
        syncMap,
      );
      const errResult = await mapOrElseAsync(
        Err(errorValue),
        syncDefault,
        syncMap,
      );

      expect(okResult).toBe('sync: success data');
      expect(errResult).toBe('sync default: operation failed');
    });
  });
});
