import {describe, it, expect} from 'vitest';
import {flatten, deepFlatten, deepFlattenAsync} from './flatten';
import {Ok, Err} from '../base';
import type {Result} from '../types';

// ========================================
// 测试辅助常量
// ========================================
const numberValue = 42;
const stringValue = 'test';
const errorValue = new Error('test error');

// ========================================
// Result 展平操作符测试
// ========================================
describe.concurrent('Result flatten operators', () => {
  // ------------------------------------------------------------------
  // flatten 函数
  // ------------------------------------------------------------------
  describe('flatten', () => {
    it('should return original Err without modification', () => {
      // 测试当输入为 Err 时，flatten 直接返回原值
      const result = Err(errorValue);
      expect(flatten(result)).toEqual(Err(errorValue));
    });

    it('should flatten nested Ok(Ok(value)) to Ok(value)', () => {
      // 展平一层嵌套的 Ok(Ok)
      const nested = Ok(Ok(numberValue));
      expect(flatten(nested)).toEqual(Ok(numberValue));
    });

    it('should flatten nested Ok(Err(error)) to Err(error)', () => {
      // 展平一层嵌套的 Ok(Err)
      const nested = Ok(Err(errorValue));
      expect(flatten(nested)).toEqual(Err(errorValue));
    });

    it('should handle string error types', () => {
      // 验证错误类型为字符串时也能正确处理
      const nested = Ok(Err('string error'));
      expect(flatten(nested)).toEqual(Err('string error'));
    });

    it('should handle union types with Result in Ok position', () => {
      // 测试联合类型场景，确保类型展开正确
      type UnionResult = Result<number | Result<number, Error>, Error>;
      const nonResult: UnionResult = Ok(numberValue);
      const nestedResult: UnionResult = Ok(Ok(numberValue));

      expect(flatten(nonResult)).toEqual(Ok(numberValue));
      expect(flatten(nestedResult)).toEqual(Ok(numberValue));
    });

    // ---------- 边缘情况 ----------
    it('should handle null and undefined values in Ok', () => {
      // 验证 null/undefined 作为 Ok 的值时不被展平
      expect(flatten(Ok(null))).toEqual(Ok(null));
      expect(flatten(Ok(undefined))).toEqual(Ok(undefined));
    });

    it('should handle null and undefined errors', () => {
      // 验证 null/undefined 作为 Err 的值时能被正确返回
      expect(flatten(Ok(Err(null)))).toEqual(Err(null));
      expect(flatten(Ok(Err(undefined)))).toEqual(Err(undefined));
    });

    it('should not flatten objects that are not Result-like', () => {
      // 确保不会误展平普通对象（即使它看起来像 Result）
      const fakeResult = {type: 'Ok', value: numberValue};
      expect(flatten(Ok(fakeResult))).toEqual(Ok(fakeResult));
    });
  });

  // ------------------------------------------------------------------
  // deepFlatten 函数
  // ------------------------------------------------------------------
  describe('deepFlatten', () => {
    it('should return original non-nested Ok without modification', () => {
      // 非嵌套的 Ok 保持不变
      const result = Ok(numberValue);
      expect(deepFlatten(result)).toEqual(Ok(numberValue));
    });

    it('should deeply flatten multiple layers of Ok (5 levels)', () => {
      // 深度展平 5 层嵌套的 Ok
      const level5 = Ok(Ok(Ok(Ok(Ok(stringValue)))));
      expect(deepFlatten(level5)).toEqual(Ok(stringValue));
    });

    it('should return first encountered Err and stop flattening', () => {
      // 展平时遇到第一个 Err 立即停止并返回该 Err
      const deeplyNested = Ok(Ok(Ok(Err(errorValue))));
      expect(deepFlatten(deeplyNested)).toEqual(Err(errorValue));
    });

    it('should deeply flatten with Err at outer layer', () => {
      // 外层已经是 Err 时直接返回
      expect(deepFlatten(Err(errorValue))).toEqual(Err(errorValue));
    });

    it('should preserve type through deep flattening', () => {
      // 验证展平后保留复杂类型的结构
      type ComplexValue = {data: string; count: number};
      const complexValue: ComplexValue = {data: 'test', count: 42};
      const deeplyNested = Ok(Ok(Ok(complexValue)));
      const flattened = deepFlatten(deeplyNested);

      expect(flattened).toEqual(Ok(complexValue));
      if (flattened.ok) {
        expect(flattened.value).toHaveProperty('data', 'test');
        expect(flattened.value).toHaveProperty('count', 42);
      }
    });

    // ---------- 边缘情况 ----------
    it('should handle null and undefined values in Ok', () => {
      // null/undefined 作为 Ok 的值不应被展平
      expect(deepFlatten(Ok(null))).toEqual(Ok(null));
      expect(deepFlatten(Ok(undefined))).toEqual(Ok(undefined));
    });

    it('should handle null and undefined errors', () => {
      // 嵌套的 Err 值为 null/undefined 时应正确返回
      expect(deepFlatten(Ok(Err(null)))).toEqual(Err(null));
      expect(deepFlatten(Ok(Err(undefined)))).toEqual(Err(undefined));
    });

    it('should not flatten objects that are not Result-like', () => {
      // 防止误展平普通对象
      const fakeResult = {type: 'Ok', value: numberValue};
      expect(deepFlatten(Ok(fakeResult))).toEqual(Ok(fakeResult));
    });
  });

  // ------------------------------------------------------------------
  // deepFlattenAsync 函数
  // ------------------------------------------------------------------
  describe('deepFlattenAsync', () => {
    it('should resolve Promise of Ok to flattened Result', async () => {
      // 处理 Promise<Ok> 的基本情况
      const promiseResult = Promise.resolve(Ok(numberValue));
      await expect(deepFlattenAsync(promiseResult)).resolves.toEqual(
        Ok(numberValue),
      );
    });

    it('should resolve Promise of Err to Err', async () => {
      // 处理 Promise<Err> 的情况
      const promiseResult = Promise.resolve(Err(errorValue));
      await expect(deepFlattenAsync(promiseResult)).resolves.toEqual(
        Err(errorValue),
      );
    });

    it('should not flatten Promise inside value position', async () => {
      // 当 Ok 的值本身是 Promise 时，不应展平该 Promise
      const resultWithPromiseValue = Ok(Promise.resolve(numberValue));
      const flattened = await deepFlattenAsync(resultWithPromiseValue);
      // 注意：这里断言的是 Ok(Promise)，需要比较内容
      expect(flattened.ok).toBe(true);
      if (flattened.ok) {
        await expect(flattened.value).resolves.toBe(numberValue);
      }
    });

    it('should deeply flatten mixed Promise and Result nesting', async () => {
      // 复杂嵌套：Promise 包裹 Result，Result 又包裹 Promise，反复交替
      const mixedNested = Promise.resolve(
        Ok(Promise.resolve(Ok(Ok(Promise.resolve(numberValue))))),
      );
      const flattened = await deepFlattenAsync(mixedNested);
      expect(flattened.ok).toBe(true);
      if (flattened.ok) {
        await expect(flattened.value).resolves.toBe(numberValue);
      }
    });

    it('should stop at first Err in async chain', async () => {
      // 异步链中遇到第一个 Err 即停止展平
      const asyncChain = Promise.resolve(
        Ok(Promise.resolve(Ok(Err(errorValue)))),
      );
      await expect(deepFlattenAsync(asyncChain)).resolves.toEqual(
        Err(errorValue),
      );
    });

    it('should handle immediate Promise rejection', async () => {
      // 整个输入是一个被拒绝的 Promise，应捕获并返回错误
      const rejectedPromise = Promise.reject(new Error('rejected'));
      await expect(deepFlattenAsync(rejectedPromise)).rejects.toThrow(
        'rejected',
      );
    });

    it('should handle rejected Promise inside value position', async () => {
      // Ok 的值是一个被拒绝的 Promise，此时 deepFlattenAsync 应该抛出该拒绝
      const resultWithRejectedPromise = Ok(
        Promise.reject(new Error('value rejected')),
      );
      await expect(deepFlattenAsync(resultWithRejectedPromise)).rejects.toThrow(
        'value rejected',
      );
    });

    it('should work with synchronous Result (non-Promise)', async () => {
      // 输入是普通的同步 Result（非 Promise），也能正确展平
      const syncResult = Ok(Ok(numberValue));
      await expect(deepFlattenAsync(syncResult)).resolves.toEqual(
        Ok(numberValue),
      );
    });

    it('should maintain error type through async flattening', async () => {
      // 验证错误类型（如字符串）在异步展平后保持不变
      const error = 'async error';
      const asyncError = Promise.resolve(Err(error));
      await expect(deepFlattenAsync(asyncError)).resolves.toEqual(Err(error));
    });

    // ---------- 边缘情况 ----------
    it('should handle null and undefined values in Promise', async () => {
      // Promise 包裹的 Ok 值为 null/undefined
      await expect(
        deepFlattenAsync(Promise.resolve(Ok(null))),
      ).resolves.toEqual(Ok(null));
      await expect(
        deepFlattenAsync(Promise.resolve(Ok(undefined))),
      ).resolves.toEqual(Ok(undefined));
    });

    it('should handle null and undefined errors in Promise', async () => {
      // Promise 包裹的 Err 值为 null/undefined
      await expect(
        deepFlattenAsync(Promise.resolve(Err(null))),
      ).resolves.toEqual(Err(null));
      await expect(
        deepFlattenAsync(Promise.resolve(Err(undefined))),
      ).resolves.toEqual(Err(undefined));
    });
  });
});
