// ========================================
// ./src/Fit/parser.spec.ts
// ========================================
import {describe, it, expect} from 'vitest';
import {
  validate,
  validateAsync,
  type ErrorContext,
  type MessageFormatter,
  type ShapeErrors,
} from './parser';
import {Fit, Void, fit, shape, items, toOptional} from './base';
import {isOk, isErr} from 'src/Result/base';
import {ParameterError} from 'src/Errors';

describe.concurrent('validate', () => {
  // ============================================
  // 基本验证测试
  // ============================================
  describe('basic validation', () => {
    it('should throw ParameterError for empty ops', () => {
      const f = new Fit<string>();
      expect(() => validate('test', f)).toThrow(ParameterError);
      expect(() => validate('test', f)).toThrow('fit.Ops is empty');
    });

    it('should pass or fail validation based on predicate', () => {
      const f = fit<string>().that(
        (val): val is string => typeof val === 'string',
        'must be string',
      );
      expect(isOk(validate('hello', f))).toBe(true);
      expect(isErr(validate(123, f))).toBe(true);
    });
  });

  // ============================================
  // that 断言检查测试
  // ============================================
  describe('that operation', () => {
    it('should pass or fail based on predicate result', () => {
      const f = fit<number>().that((val) => val > 0, 'must be positive');
      const passResult = validate(5, f);
      expect(isOk(passResult)).toBe(true);
      const failResult = validate(-5, f);
      expect(isErr(failResult)).toBe(true);
      if (isErr(failResult)) {
        expect(failResult.error.validation).toHaveLength(1);
        expect(failResult.error.validation[0].kind).toBe('assertion');
      }
    });

    it('should support different message types', () => {
      // 自定义字符串消息
      const f1 = fit<number>().that((val) => val > 0, 'custom error message');
      const r1 = validate(-1, f1);
      if (isErr(r1))
        expect(r1.error.validation[0].message).toBe('custom error message');

      // 消息生成函数
      const f2 = fit<number>().that(
        (val) => val > 0,
        (val) => `Value ${String(val)} must be positive`,
      );
      const r2 = validate(-5, f2);
      if (isErr(r2))
        expect(r2.error.validation[0].message).toBe(
          'Value -5 must be positive',
        );

      // 默认消息
      const f3 = fit<number>().that((val) => val > 0);
      const r3 = validate(-1, f3);
      if (isErr(r3))
        expect(r3.error.validation[0].message).toBe('Validation failed');
    });

    it('should support multiple that operations', () => {
      const f = fit<number>()
        .that((val) => val > 0, 'must be positive')
        .that((val) => val < 100, 'must be less than 100');
      expect(isOk(validate(50, f))).toBe(true);
    });
  });

  // ============================================
  // off 短路处理测试
  // ============================================
  describe('off operation', () => {
    it('should short-circuit and return value when predicate matches', () => {
      // 无默认值，返回原值
      const f1 = fit<string | null>().off((val): val is null => val === null);
      const r1 = validate(null, f1);
      expect(isOk(r1)).toBe(true);
      if (isOk(r1)) expect(r1.value).toBe(null);

      // 有默认值
      const f2 = fit<string | null>().off(
        (val): val is null => val === null,
        'default',
      );
      const r2 = validate(null, f2);
      expect(isOk(r2)).toBe(true);
      if (isOk(r2)) expect(r2.value).toBe('default');

      // 布尔谓词
      const f3 = fit<number>().off((val) => val === 0, 0);
      const r3 = validate(0, f3);
      expect(isOk(r3)).toBe(true);
      if (isOk(r3)) expect(r3.value).toBe(0);
    });

    it('should continue validation when predicate does not match', () => {
      const f = fit<string | null>()
        .off((val): val is null => val === null, 'default')
        .that((val) => val.length > 0, 'must not be empty');
      const result = validate('hello', f);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) expect(result.value).toBe('hello');
    });
  });

  // ============================================
  // transform 变换操作测试
  // ============================================
  describe('transform operation', () => {
    it('should transform value and chain with that', () => {
      const f = fit<string>()
        .transform((val) => val.toUpperCase())
        .transform((val) => val.length);
      const result = validate('hello', f);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) expect(result.value).toBe(5);

      // 与 that 组合
      const f2 = fit<string>()
        .transform((val) => parseInt(val, 10))
        .that((val) => !isNaN(val), 'must be valid number');
      const r2 = validate('123', f2);
      expect(isOk(r2)).toBe(true);
      if (isOk(r2)) expect(r2.value).toBe(123);
    });
  });

  // ============================================
  // shape 对象形状校验测试
  // ============================================
  describe('shape operation', () => {
    it('should validate object shape correctly', () => {
      const f = fit().toShaped({
        name: fit<string>().that(
          (val): val is string => typeof val === 'string',
          'must be string',
        ),
        age: fit<number>().that(
          (val): val is number => typeof val === 'number',
          'must be number',
        ),
      });
      expect(isOk(validate({name: 'John', age: 25}, f))).toBe(true);
    });

    it('should fail for non-object or null input', () => {
      const f = fit().toShaped({name: fit<string>()});
      // 非对象
      const r1 = validate('not an object', f);
      expect(isErr(r1)).toBe(true);
      if (isErr(r1)) expect(r1.error.validation[0].kind).toBe('not_object');

      // null
      const r2 = validate(null, f);
      expect(isErr(r2)).toBe(true);
      if (isErr(r2)) {
        expect(r2.error.validation[0].kind).toBe('not_object');
        expect(r2.error.validation[0].message).toContain('null');
      }
    });

    it('should report missing required field', () => {
      const f = fit().toShaped({
        name: fit<string>().that(
          (val): val is string => typeof val === 'string',
          'must be string',
        ),
      });
      const result = validate({}, f);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.validation[0].kind).toBe('missing_field');
        expect(result.error.validation[0].path).toContain('name');
      }
    });

    it('should pass for missing optional field', () => {
      const f = fit().toShaped({
        name: toOptional(
          fit<unknown>()
            .off((val): val is typeof Void => val === Void)
            .that((val): val is string => typeof val === 'string'),
        ),
      });
      expect(isOk(validate({}, f))).toBe(true);
    });

    it('should handle unknown fields based on strict mode', () => {
      const f = fit().toShaped({
        name: fit<string>().that(
          (val): val is string => typeof val === 'string',
          'must be string',
        ),
      });
      // 严格模式（默认）
      const r1 = validate({name: 'John', extra: 'field'}, f);
      expect(isErr(r1)).toBe(true);
      if (isErr(r1)) expect(r1.error.structure[0].kind).toBe('unknown_field');

      // 非严格模式
      const r2 = validate({name: 'John', extra: 'field'}, f, {strict: false});
      expect(isOk(r2)).toBe(true);
    });

    it('should support nested shapes with correct error path', () => {
      const f = fit().toShaped({
        user: fit().toShaped({
          name: fit<string>().that(
            (val) => typeof val === 'string' && val.length > 0,
            'required',
          ),
        }),
      });
      // 嵌套成功
      expect(isOk(validate({user: {name: 'John'}}, f))).toBe(true);

      // 嵌套错误路径
      const r2 = validate({user: {name: ''}}, f);
      expect(isErr(r2)).toBe(true);
      if (isErr(r2))
        expect(r2.error.validation[0].path).toEqual(['user', 'name']);
    });
  });

  // ============================================
  // toArray 数组校验测试
  // ============================================
  describe('toArray operation', () => {
    it('should validate array elements', () => {
      const f = fit().toArray(
        fit<number>().that(
          (val): val is number => typeof val === 'number',
          'must be number',
        ),
      );
      expect(isOk(validate([1, 2, 3], f))).toBe(true);
      expect(isOk(validate([], f))).toBe(true);
    });

    it('should fail for non-array input', () => {
      const f = fit().toArray(fit<number>());
      const result = validate('not an array', f);
      expect(isErr(result)).toBe(true);
      if (isErr(result))
        expect(result.error.validation[0].kind).toBe('not_array');
    });

    it('should report correct index in error path', () => {
      const f = fit().toArray(
        fit<number>().that((val) => val > 0, 'must be positive'),
      );
      const result = validate([1, 2, -3], f);
      expect(isErr(result)).toBe(true);
      if (isErr(result))
        expect(result.error.validation[0].path).toContain('[2]');
    });
  });

  // ============================================
  // 选项配置测试
  // ============================================
  describe('options', () => {
    it('should respect abortEarly option', () => {
      const f = fit<number>()
        .that((val) => val > 0, 'must be positive')
        .that((val) => val < 100, 'must be less than 100');

      // abortEarly: true
      const r1 = validate(-50, f, {abortEarly: true});
      expect(isErr(r1)).toBe(true);
      if (isErr(r1)) expect(r1.error.validation).toHaveLength(1);

      // abortEarly: false
      const f2 = fit<number>()
        .that((val) => val % 2 === 0, 'must be even')
        .that((val) => val > 0, 'must be positive');
      const r2 = validate(-3, f2, {abortEarly: false});
      expect(isErr(r2)).toBe(true);
      if (isErr(r2)) expect(r2.error.validation).toHaveLength(2);
    });

    it('should respect maxDeep limit', () => {
      const createNestedShape = (
        depth: number,
      ): Fit<unknown, never, never, false, false, boolean, boolean> => {
        if (depth === 0)
          return fit<string>() as Fit<
            unknown,
            never,
            never,
            false,
            false,
            boolean,
            boolean
          >;
        return fit().toShaped({
          nested: createNestedShape(depth - 1),
        }) as Fit<unknown, never, never, false, false, boolean, boolean>;
      };
      const f = createNestedShape(5);
      const result = validate(
        {nested: {nested: {nested: {nested: {nested: 'test'}}}}},
        f,
        {maxDeep: 3},
      );
      expect(isErr(result)).toBe(true);
      if (isErr(result))
        expect(result.error.structure[0].kind).toBe('max_deep');
    });

    it('should respect maxUnknownKeys option', () => {
      const f = fit().toShaped({name: fit<string>()});
      const input: Record<string, unknown> = Object.fromEntries(
        Array.from({length: 35}, (_, i) => [`extra${i}`, i]),
      );
      input.name = 'test';
      const result = validate(input, f, {maxUnknownKeys: 30});
      expect(isErr(result)).toBe(true);
      if (isErr(result))
        expect(result.error.structure[0].kind).toBe('too_many_unknown');
    });

    it('should return early after too_many_unknown error when abortEarly is true', () => {
      const f = fit().toShaped({name: fit<string>()});
      const input: Record<string, unknown> = Object.fromEntries(
        Array.from({length: 35}, (_, i) => [`extra${i}`, i]),
      );
      input.name = 'test';
      const result = validate(input, f, {maxUnknownKeys: 30, abortEarly: true});
      expect(isErr(result)).toBe(true);
      if (isErr(result))
        expect(result.error.structure[0].kind).toBe('too_many_unknown');
    });

    it('should use custom message formatter', () => {
      const formatter: MessageFormatter = (kind, ctx) => {
        if (kind === 'missing_field') return `Field "${ctx.key}" is required`;
        return 'Custom error';
      };
      const f = fit().toShaped({name: fit<string>()});
      const result = validate({}, f, {formatMessage: formatter});
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.validation[0].message).toBe(
          'Field "name" is required',
        );
      }
    });
  });

  // ============================================
  // 快捷函数测试
  // ============================================
  describe('helper functions', () => {
    it('should work with shape and items helpers', () => {
      const f1 = shape({
        name: fit<string>().that(
          (val): val is string => typeof val === 'string',
          'must be string',
        ),
      });
      expect(isOk(validate({name: 'John'}, f1))).toBe(true);

      const f2 = items(
        fit<number>().that(
          (val): val is number => typeof val === 'number',
          'must be number',
        ),
      );
      expect(isOk(validate([1, 2, 3], f2))).toBe(true);
    });
  });

  // ============================================
  // 覆盖率补充测试
  // ============================================
  describe('coverage tests', () => {
    it('should continue validation after errors when abortEarly is false', () => {
      // shape 相关错误
      const f1 = fit().toShaped({
        nested: fit().toShaped({name: fit<string>()}),
      });
      const r1 = validate({nested: {name: 'test'}}, f1, {
        maxDeep: 0,
        abortEarly: false,
      });
      expect(isErr(r1)).toBe(true);

      const f2 = fit().toShaped({name: fit<string>(), age: fit<number>()});
      const r2 = validate('not an object', f2, {abortEarly: false});
      expect(isErr(r2)).toBe(true);

      const f3 = fit().toShaped({name: fit<string>()});
      const input: Record<string, unknown> = {name: 'test'};
      for (let i = 0; i < 35; i++) input[`extra${i}`] = i;
      const r3 = validate(input, f3, {maxUnknownKeys: 30, abortEarly: false});
      expect(isErr(r3)).toBe(true);

      const r4 = validate({name: 'test', extra: 'field'}, f3, {
        abortEarly: false,
      });
      expect(isErr(r4)).toBe(true);

      const f5 = fit().toShaped({name: fit<string>(), age: fit<number>()});
      const r5 = validate({}, f5, {abortEarly: false});
      expect(isErr(r5)).toBe(true);
      if (isErr(r5))
        expect(r5.error.validation.length).toBeGreaterThanOrEqual(2);

      // 可选字段
      const f6 = fit().toShaped({
        name: fit<string>(),
        optional: toOptional(
          fit<unknown>()
            .off((val): val is typeof Void => val === Void)
            .that((val): val is string => typeof val === 'string'),
        ),
      });
      expect(isOk(validate({name: 'test'}, f6, {abortEarly: false}))).toBe(
        true,
      );
    });

    it('should handle toArray maxDeep error', () => {
      const f = fit().toArray(fit<number>());
      const result = validate([1, 2, 3], f, {maxDeep: 0});
      expect(isErr(result)).toBe(true);
      if (isErr(result))
        expect(result.error.structure[0].kind).toBe('max_deep');
    });

    it('should break after toArray maxDeep error when abortEarly is false', () => {
      const f = fit().toArray(fit<number>());
      const result = validate([1, 2, 3], f, {maxDeep: 0, abortEarly: false});
      expect(isErr(result)).toBe(true);
      if (isErr(result))
        expect(result.error.structure[0].kind).toBe('max_deep');
    });

    it('should ignore inherited properties in object validation', () => {
      const proto = {inherited: 'value'};
      const obj = Object.create(proto) as Record<string, unknown>;
      obj.name = 'test';
      const f = fit().toShaped({name: fit<string>()});
      expect(isOk(validate(obj, f))).toBe(true);
    });

    it('should handle optional field with prior error', () => {
      const f = fit().toShaped({
        name: fit<string>().that((val) => val.length > 0, 'required'),
        optional: toOptional(
          fit<unknown>()
            .off((val): val is typeof Void => val === Void)
            .that((val): val is string => typeof val === 'string'),
        ),
      });
      expect(isErr(validate({name: ''}, f, {abortEarly: false}))).toBe(true);
    });

    it('should handle optional field processOps error', () => {
      const f = fit().toShaped({
        name: fit<string>(),
        optional: toOptional(
          fit<unknown>().that((val) => val !== Void, 'must not be Void'),
        ),
      });
      const result = validate({name: 'test'}, f);
      expect(isErr(result)).toBe(true);
      if (isErr(result))
        expect(result.error.validation[0].path).toContain('optional');
    });

    it('should handle toArray not_array error with abortEarly=false', () => {
      const f = fit().toArray(fit<number>());
      const result = validate('not an array', f, {abortEarly: false});
      expect(isErr(result)).toBe(true);
      if (isErr(result))
        expect(result.error.validation[0].kind).toBe('not_array');
    });

    it('should handle nested processOps with existing error', () => {
      const f = fit().toShaped({
        nested: fit().toShaped({
          value: fit<string>().that((val) => val.length > 0, 'required'),
        }),
      });
      const result = validate({nested: {value: ''}}, f, {abortEarly: true});
      expect(isErr(result)).toBe(true);
      if (isErr(result)) expect(result.error.validation).toHaveLength(1);
    });
  });
});

describe.concurrent('validateAsync', () => {
  // ============================================
  // 异步断言测试
  // ============================================
  describe('async that operation', () => {
    it('should support async predicate and message', async () => {
      const f1 = fit<number>().that(
        (val) => Promise.resolve(val > 0),
        'must be positive',
      );
      expect(isOk(await validateAsync(5, f1))).toBe(true);
      expect(isErr(await validateAsync(-5, f1))).toBe(true);

      // 异步消息生成
      const f2 = fit<number>().that(
        (val) => val > 0,
        (val) => Promise.resolve(`Value ${String(val)} is invalid`),
      );
      const r2 = await validateAsync(-1, f2);
      if (isErr(r2))
        expect(r2.error.validation[0].message).toBe('Value -1 is invalid');

      // 无消息时使用默认
      const f3 = fit<number>().that((val) => Promise.resolve(val > 0));
      const r3 = await validateAsync(-1, f3);
      if (isErr(r3))
        expect(r3.error.validation[0].message).toBe('Validation failed');
    });
  });

  // ============================================
  // 异步短路测试
  // ============================================
  describe('async off operation', () => {
    it('should support async predicate', async () => {
      const f = fit<string | null>().off(
        (val) => Promise.resolve(val === null),
        'default',
      );
      const result = await validateAsync(null, f);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) expect(result.value).toBe('default');
    });

    it('should return original value when predicate matches and no default', async () => {
      const f = fit<string | null>()
        .off((val) => Promise.resolve(val === null))
        .that((val) => val !== null, 'must not be null');
      const result = await validateAsync(null, f);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) expect(result.value).toBe(null);
    });

    it('should continue after off predicate does not match', async () => {
      const f = fit<string | null>()
        .off((val) => Promise.resolve(val === null), 'default')
        .that((val) => val !== null && val.length > 0, 'must not be empty');
      expect(isOk(await validateAsync('hello', f))).toBe(true);
    });
  });

  // ============================================
  // 异步变换测试
  // ============================================
  describe('async transform operation', () => {
    it('should support async transform', async () => {
      const f = fit<string>().transform(async (val) => {
        await Promise.resolve();
        return val.length;
      });
      const result = await validateAsync('hello', f);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) expect(result.value).toBe(5);
    });
  });

  // ============================================
  // 异步形状校验测试
  // ============================================
  describe('async shape operation', () => {
    it('should validate shape with async predicates', async () => {
      const f = fit().toShaped({
        name: fit<string>().that(
          (val) => Promise.resolve(typeof val === 'string'),
          'must be string',
        ),
      });
      expect(isOk(await validateAsync({name: 'John'}, f))).toBe(true);
    });

    it('should fail for non-object input', async () => {
      const f = fit().toShaped({name: fit<string>()});
      const result = await validateAsync('not an object', f);
      expect(isErr(result)).toBe(true);
      if (isErr(result))
        expect(result.error.validation[0].kind).toBe('not_object');
    });

    it('should report missing required field', async () => {
      const f = fit().toShaped({
        name: fit<string>().that(
          (val) => Promise.resolve(typeof val === 'string'),
          'must be string',
        ),
      });
      const result = await validateAsync({}, f);
      expect(isErr(result)).toBe(true);
      if (isErr(result))
        expect(result.error.validation[0].kind).toBe('missing_field');
    });

    it('should handle unknown fields based on strict mode', async () => {
      const f = fit().toShaped({name: fit<string>()});
      // 严格模式
      const r1 = await validateAsync({name: 'John', extra: 'field'}, f);
      expect(isErr(r1)).toBe(true);
      if (isErr(r1)) expect(r1.error.structure[0].kind).toBe('unknown_field');

      // 非严格模式
      const f2 = fit().toShaped({
        name: fit<string>().that(
          (val) => Promise.resolve(typeof val === 'string'),
          'must be string',
        ),
      });
      const r2 = await validateAsync({name: 'test', extra: 'field'}, f2, {
        strict: false,
      });
      expect(isOk(r2)).toBe(true);
    });

    it('should respect maxDeep limit', async () => {
      const createNestedShape = (
        depth: number,
      ): Fit<unknown, never, never, false, false, boolean, boolean> => {
        if (depth === 0)
          return fit<string>() as unknown as Fit<
            unknown,
            never,
            never,
            false,
            false,
            boolean,
            boolean
          >;
        return fit().toShaped({
          nested: createNestedShape(depth - 1),
        }) as unknown as Fit<
          unknown,
          never,
          never,
          false,
          false,
          boolean,
          boolean
        >;
      };
      const f = createNestedShape(5);
      const result = await validateAsync(
        {nested: {nested: {nested: {nested: {nested: 'test'}}}}},
        f,
        {maxDeep: 3},
      );
      expect(isErr(result)).toBe(true);
      if (isErr(result))
        expect(result.error.structure[0].kind).toBe('max_deep');
    });
  });

  // ============================================
  // 异步数组校验测试
  // ============================================
  describe('async toArray operation', () => {
    it('should validate array with async element predicates', async () => {
      const f = fit().toArray(
        fit<number>().that(
          (val) => Promise.resolve(val > 0),
          'must be positive',
        ),
      );
      expect(isOk(await validateAsync([1, 2, 3], f))).toBe(true);
    });

    it('should fail for non-array input', async () => {
      const f = fit().toArray(fit<number>());
      const result = await validateAsync('not an array', f);
      expect(isErr(result)).toBe(true);
      if (isErr(result))
        expect(result.error.validation[0].kind).toBe('not_array');
    });

    it('should respect maxDeep limit', async () => {
      const f = fit().toArray(fit<number>());
      const result = await validateAsync([1, 2, 3], f, {maxDeep: 0});
      expect(isErr(result)).toBe(true);
      if (isErr(result))
        expect(result.error.structure[0].kind).toBe('max_deep');
    });
  });

  // ============================================
  // 异步选项测试
  // ============================================
  describe('async options', () => {
    it('should throw ParameterError for empty ops', async () => {
      const f = new Fit<string>();
      await expect(validateAsync('test', f)).rejects.toThrow(ParameterError);
    });

    it('should respect abortEarly option', async () => {
      const f = fit<number>()
        .that((val) => Promise.resolve(val > 0), 'must be positive')
        .that((val) => Promise.resolve(val < 100), 'must be less than 100');

      const r1 = await validateAsync(-50, f, {abortEarly: true});
      expect(isErr(r1)).toBe(true);
      if (isErr(r1)) expect(r1.error.validation).toHaveLength(1);

      const f2 = fit<number>()
        .that((val) => Promise.resolve(val % 2 === 0), 'must be even')
        .that((val) => Promise.resolve(val > 0), 'must be positive');
      const r2 = await validateAsync(-3, f2, {abortEarly: false});
      expect(isErr(r2)).toBe(true);
      if (isErr(r2)) expect(r2.error.validation).toHaveLength(2);
    });
  });

  // ============================================
  // 异步覆盖率补充测试
  // ============================================
  describe('async coverage tests', () => {
    it('should handle optional field with Void when missing', async () => {
      const f = fit().toShaped({
        name: fit<string>(),
        optional: toOptional(
          fit<unknown>()
            .off((val): val is typeof Void => val === Void)
            .that((val) => Promise.resolve(typeof val === 'string')),
        ),
      });
      expect(
        isOk(await validateAsync({name: 'test'}, f, {abortEarly: false})),
      ).toBe(true);

      const f2 = fit().toShaped({
        name: fit<string>(),
        optional: toOptional(
          fit<unknown>()
            .off((val) => Promise.resolve(val === Void))
            .that((val) => typeof val === 'string'),
        ),
      });
      expect(isOk(await validateAsync({name: 'test'}, f2))).toBe(true);
    });

    it('should continue validation after errors when abortEarly is false', async () => {
      const f1 = fit().toShaped({
        nested: fit().toShaped({name: fit<string>()}),
      });
      const r1 = await validateAsync({nested: {name: 'test'}}, f1, {
        maxDeep: 0,
        abortEarly: false,
      });
      expect(isErr(r1)).toBe(true);

      const f2 = fit().toShaped({name: fit<string>(), age: fit<number>()});
      const r2 = await validateAsync('not an object', f2, {abortEarly: false});
      expect(isErr(r2)).toBe(true);

      const f3 = fit().toShaped({name: fit<string>()});
      const input: Record<string, unknown> = {name: 'test'};
      for (let i = 0; i < 35; i++) input[`extra${i}`] = i;
      const r3 = await validateAsync(input, f3, {
        maxUnknownKeys: 30,
        abortEarly: false,
      });
      expect(isErr(r3)).toBe(true);

      const r4 = await validateAsync({name: 'test', extra: 'field'}, f3, {
        abortEarly: false,
      });
      expect(isErr(r4)).toBe(true);

      const f5 = fit().toShaped({name: fit<string>(), age: fit<number>()});
      const r5 = await validateAsync({}, f5, {abortEarly: false});
      expect(isErr(r5)).toBe(true);
      if (isErr(r5))
        expect(r5.error.validation.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle toArray maxDeep error with abortEarly=false', async () => {
      const f = fit().toArray(fit<number>());
      const result = await validateAsync([1, 2, 3], f, {
        maxDeep: 0,
        abortEarly: false,
      });
      expect(isErr(result)).toBe(true);
      if (isErr(result))
        expect(result.error.structure[0].kind).toBe('max_deep');
    });

    it('should return early after too_many_unknown error when abortEarly is true', async () => {
      const f = fit().toShaped({name: fit<string>()});
      const input: Record<string, unknown> = {name: 'test'};
      for (let i = 0; i < 35; i++) input[`extra${i}`] = i;
      const result = await validateAsync(input, f, {
        maxUnknownKeys: 30,
        abortEarly: true,
      });
      expect(isErr(result)).toBe(true);
      if (isErr(result))
        expect(result.error.structure[0].kind).toBe('too_many_unknown');
    });

    it('should handle toArray element error with abortEarly=true', async () => {
      const f = fit().toArray(
        fit<number>().that(
          (val) => Promise.resolve(val > 0),
          'must be positive',
        ),
      );
      const result = await validateAsync([1, -1, 2], f, {abortEarly: true});
      expect(isErr(result)).toBe(true);
      if (isErr(result)) expect(result.error.validation).toHaveLength(1);
    });

    it('should ignore inherited properties in object validation', async () => {
      const proto = {inherited: 'value'};
      const obj = Object.create(proto) as Record<string, unknown>;
      obj.name = 'test';
      const f = fit().toShaped({name: fit<string>()});
      expect(isOk(await validateAsync(obj, f))).toBe(true);
    });

    it('should handle toArray not_array error with abortEarly=false', async () => {
      const f = fit().toArray(fit<number>());
      const result = await validateAsync('not an array', f, {
        abortEarly: false,
      });
      expect(isErr(result)).toBe(true);
      if (isErr(result))
        expect(result.error.validation[0].kind).toBe('not_array');
    });

    it('should handle optional field with Void and error', async () => {
      const f = fit().toShaped({
        name: fit<string>(),
        optional: toOptional(
          fit<unknown>()
            .off((val) => Promise.resolve(val === Void))
            .that(
              (val) => Promise.resolve(typeof val === 'string'),
              'must be string',
            ),
        ),
      });
      expect(
        isOk(await validateAsync({name: 'test'}, f, {abortEarly: false})),
      ).toBe(true);
    });

    it('should handle optional field with prior error', async () => {
      const f = fit().toShaped({
        name: fit<string>().that(
          (val) => Promise.resolve(val.length > 0),
          'required',
        ),
        optional: toOptional(
          fit<unknown>()
            .off((val) => Promise.resolve(val === Void))
            .that((val) => Promise.resolve(typeof val === 'string')),
        ),
      });
      expect(
        isErr(await validateAsync({name: ''}, f, {abortEarly: false})),
      ).toBe(true);
    });

    it('should handle optional field processOps error', async () => {
      const f = fit().toShaped({
        name: fit<string>(),
        optional: toOptional(
          fit<unknown>().that((val) => val !== Void, 'must not be Void'),
        ),
      });
      const result = await validateAsync({name: 'test'}, f);
      expect(isErr(result)).toBe(true);
      if (isErr(result))
        expect(result.error.validation[0].path).toContain('optional');
    });

    it('should handle nested processOps with existing error', async () => {
      const f = fit().toShaped({
        nested: fit().toShaped({
          value: fit<string>().that(
            (val) => Promise.resolve(val.length > 0),
            'required',
          ),
        }),
      });
      const result = await validateAsync({nested: {value: ''}}, f, {
        abortEarly: true,
      });
      expect(isErr(result)).toBe(true);
      if (isErr(result)) expect(result.error.validation).toHaveLength(1);
    });
  });
});

// ============================================
// 类型测试
// ============================================
describe.concurrent('type tests', () => {
  it('should have correct ErrorContext structure', () => {
    const ctx: ErrorContext = {
      key: 'name',
      index: 0,
      expected: 'string',
      received: 'number',
      depth: 1,
      extra: {info: 'test'},
    };
    expect(ctx.key).toBe('name');
    expect(ctx.index).toBe(0);
    expect(ctx.expected).toBe('string');
    expect(ctx.received).toBe('number');
    expect(ctx.depth).toBe(1);
    expect(ctx.extra).toEqual({info: 'test'});
  });

  it('should have correct ShapeErrors structure', () => {
    const errors: ShapeErrors = {
      validation: [{path: ['name'], kind: 'assertion', message: 'error'}],
      structure: [{path: [], kind: 'unknown_field', detail: 'unknown'}],
    };
    expect(errors.validation).toHaveLength(1);
    expect(errors.structure).toHaveLength(1);
  });
});
