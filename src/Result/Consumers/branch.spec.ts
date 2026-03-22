// ========================================
// ./src/Result/Consumers/branch.spec.ts
// ========================================
import {describe, it, expect, vi} from 'vitest';
import {match, ifOk, ifErr, mapOrElse} from './branch';
import {Ok, Err} from '../base';
import type {Result} from '../types';

describe.concurrent('Branch Functions', () => {
  // ============================
  // match 函数测试
  // ============================
  describe('match', () => {
    it('should route Ok result to onOk handler and return its value', () => {
      // 准备数据
      const result = Ok('success');
      const onOk = vi.fn<(v: string) => string>((v) => `processed: ${v}`);
      const onErr = vi.fn<(e: string) => string>((e) => `error: ${e}`);

      // 执行测试
      const output = match(result, onOk, onErr);

      // 断言结果
      expect(onOk).toHaveBeenCalledTimes(1);
      expect(onOk).toHaveBeenCalledWith('success');
      expect(onErr).not.toHaveBeenCalled();
      expect(output).toBe('processed: success');
    });

    it('should route Err result to onErr handler and return its value', () => {
      // 准备数据
      const result = Err('failure');
      const onOk = vi.fn<(v: string) => string>((v) => `processed: ${v}`);
      const onErr = vi.fn<(e: string) => string>((e) => `error: ${e}`);

      // 执行测试
      const output = match(result, onOk, onErr);

      // 断言结果
      expect(onErr).toHaveBeenCalledTimes(1);
      expect(onErr).toHaveBeenCalledWith('failure');
      expect(onOk).not.toHaveBeenCalled();
      expect(output).toBe('error: failure');
    });

    it('should handle various value types (object, null, undefined)', () => {
      // 测试对象类型
      const objResult = Ok({id: 1});
      const objOutput = match(
        objResult,
        (v) => v.id,
        () => -1,
      );
      expect(objOutput).toBe(1);

      // 测试 Error 对象类型
      const errResult = Err(new Error('boom'));
      const errMsg = match(
        errResult,
        () => 'ok',
        (e: Error) => e.message,
      );
      expect(errMsg).toBe('boom');

      // 测试 null/undefined 错误类型
      const nullErrResult = Err(null);
      const nullOutput = match(
        nullErrResult,
        () => 'ok',
        (e: null) => (e === null ? 'null' : 'unknown'),
      );
      expect(nullOutput).toBe('null');
    });

    it('should support different return types (type union)', () => {
      // 测试返回联合类型
      const result: Result<string, Error> = Ok('test');
      const output = match(
        result,
        (v: string) => ({type: 'value' as const, len: v.length}),
        (e: Error) => ({type: 'error' as const, msg: e.message}),
      );

      expect(output).toEqual({type: 'value', len: 4});
    });
  });

  // ============================
  // ifOk 函数测试
  // ============================
  describe('ifOk', () => {
    it('should execute callback for Ok result and return value', () => {
      // 单回调模式
      const result = Ok(42);
      const callback = vi.fn<(n: number) => number>((n) => n * 2);

      const output = ifOk(result, callback);

      expect(callback).toHaveBeenCalledWith(42);
      expect(output).toBe(84);
    });

    it('should return undefined for Err result in single callback mode', () => {
      // 单回调模式下 Err 不执行回调
      const result = Err('error');
      const callback = vi.fn<(v: string) => string>(() => 'processed');

      const output = ifOk(result, callback);

      expect(callback).not.toHaveBeenCalled();
      expect(output).toBeUndefined();
    });

    it('should execute onElse for Err result in dual callback mode', () => {
      // 双回调模式
      const okResult = Ok('ok');
      const errResult = Err('err');

      const onOk = vi.fn<(v: string) => string>((v) => v.toUpperCase());
      const onElse = vi.fn<(e: string) => string>((e) => `error: ${e}`);

      // Ok 情况
      const outOk = ifOk(okResult, onOk, onElse);
      expect(outOk).toBe('OK');
      expect(onOk).toHaveBeenCalled();
      expect(onElse).not.toHaveBeenCalled();

      // 重置 mock
      onOk.mockClear();
      onElse.mockClear();

      // Err 情况
      const outErr = ifOk(errResult, onOk, onElse);
      expect(outErr).toBe('error: err');
      expect(onOk).not.toHaveBeenCalled();
      expect(onElse).toHaveBeenCalled();
    });

    it('should handle null or undefined values inside Ok', () => {
      // 测试 Ok 内部包含 null/undefined
      const nullResult = Ok(null);
      const undefinedResult = Ok(undefined);

      const handler = (v: null | undefined) =>
        v === null ? 'is null' : 'is undefined';

      expect(ifOk(nullResult, handler)).toBe('is null');
      expect(ifOk(undefinedResult, handler)).toBe('is undefined');
    });
  });

  // ============================
  // ifErr 函数测试
  // ============================
  describe('ifErr', () => {
    it('should execute callback for Err result and return value', () => {
      const result = Err('failed');
      const callback = vi.fn<(e: string) => string>((e) => `caught: ${e}`);

      const output = ifErr(result, callback);

      expect(callback).toHaveBeenCalledWith('failed');
      expect(output).toBe('caught: failed');
    });

    it('should return undefined for Ok result in single callback mode', () => {
      const result = Ok('success');
      const callback = vi.fn<(e: string) => string>(() => 'processed');

      const output = ifErr(result, callback);

      expect(callback).not.toHaveBeenCalled();
      expect(output).toBeUndefined();
    });

    it('should execute onElse for Ok result in dual callback mode', () => {
      const okResult = Ok(100);
      const errResult = Err('wrong');

      const onErr = vi.fn<(e: string) => number>(() => 0);
      const onElse = vi.fn<(v: number) => number>((v) => v + 1);

      // Ok 情况
      const outOk = ifErr(okResult, onErr, onElse);
      expect(outOk).toBe(101);
      expect(onElse).toHaveBeenCalled();
      expect(onErr).not.toHaveBeenCalled();

      onErr.mockClear();
      onElse.mockClear();

      // Err 情况
      const outErr = ifErr(errResult, onErr, onElse);
      expect(outErr).toBe(0);
      expect(onErr).toHaveBeenCalled();
      expect(onElse).not.toHaveBeenCalled();
    });

    it('should behave symmetrically with ifOk when using dual callbacks', () => {
      // 验证 ifErr 与 ifOk 的对称性
      const result: Result<string, number> = Ok('data');

      const ifOkResult = ifOk(
        result,
        (v) => v,
        (e) => String(e),
      );
      const ifErrResult = ifErr(
        result,
        (e) => String(e),
        (v) => v,
      );

      expect(ifOkResult).toBe('data');
      expect(ifErrResult).toBe('data');
    });
  });

  // ============================
  // mapOrElse 函数测试
  // ============================
  describe('mapOrElse', () => {
    it('should apply mapFn for Ok result', () => {
      const result = Ok(10);
      const defaultFn = vi.fn<(e: string) => number>(() => 0);
      const mapFn = vi.fn<(v: number) => number>((v) => v * 2);

      const output = mapOrElse(result, defaultFn, mapFn);

      expect(mapFn).toHaveBeenCalledWith(10);
      expect(defaultFn).not.toHaveBeenCalled();
      expect(output).toBe(20);
    });

    it('should apply defaultFn for Err result', () => {
      const result = Err('error');
      const defaultFn = vi.fn<(e: string) => number>(() => -1);
      const mapFn = vi.fn<(v: number) => number>((v) => v * 2);

      const output = mapOrElse(result, defaultFn, mapFn);

      expect(defaultFn).toHaveBeenCalledWith('error');
      expect(mapFn).not.toHaveBeenCalled();
      expect(output).toBe(-1);
    });

    it('should handle complex transformations and types', () => {
      // 测试复杂对象转换
      const errResult = Err(new Error('timeout'));
      const output = mapOrElse(
        errResult,
        (e: Error) => ({status: 'failed', msg: e.message}),
        (v: never) => ({status: 'ok', data: v}), // Ok case won't run
      );

      expect(output).toEqual({status: 'failed', msg: 'timeout'});
    });
  });

  // ============================
  // 边界情况与异常处理
  // ============================
  describe('Edge Cases', () => {
    it('match should propagate exceptions thrown in callbacks', () => {
      const result = Ok('test');
      const throwingFn = vi.fn<(v: string) => never>(() => {
        throw new Error('Callback error');
      });

      expect(() => match(result, throwingFn, () => {})).toThrow(
        'Callback error',
      );
      expect(throwingFn).toHaveBeenCalled();
    });

    it('match should support async callbacks (returning Promise)', async () => {
      // match 本身是同步的，但如果回调返回 Promise，它将传递 Promise
      const result = Ok('async-data');
      const asyncFn = vi.fn<(v: string) => Promise<string>>(async (v) => {
        await Promise.resolve();
        return `processed ${v}`;
      });

      const output = match(result, asyncFn, () => Promise.resolve('error'));

      expect(output).toBeInstanceOf(Promise);
      await expect(output).resolves.toBe('processed async-data');
    });
  });
});
