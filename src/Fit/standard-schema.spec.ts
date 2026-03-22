// ========================================
// ./src/Fit/standard-schema.spec.ts
// ========================================
import {describe, it, expect} from 'vitest';
import {
  toStandardSchema,
  toStandardSchemaAsync,
  type StandardSchemaV1Issue,
  type StandardSchemaV1SuccessResult,
  type StandardSchemaV1FailureResult,
} from './standard-schema';
import {fit, shape, items} from './base';

describe.concurrent('standard-schema', () => {
  // ============================================
  // toStandardSchema 基础测试
  // ============================================
  describe('toStandardSchema', () => {
    it('should create a valid StandardSchemaV1 object', () => {
      const f = fit<string>().that(
        (val): val is string => typeof val === 'string',
        'must be string',
      );
      const schema = toStandardSchema(f);

      expect(schema).toHaveProperty('~standard');
      expect(schema['~standard'].version).toBe(1);
      expect(schema['~standard'].vendor).toBe('fit-schema');
      expect(schema['~standard'].types).toBeDefined();
      expect(typeof schema['~standard'].validate).toBe('function');
    });

    it('should validate valid data successfully', () => {
      const f = fit<string>().that(
        (val): val is string => typeof val === 'string',
        'must be string',
      );
      const schema = toStandardSchema(f);
      const result = schema['~standard'].validate(
        'hello',
      ) as StandardSchemaV1SuccessResult<string>;

      expect(result.value).toBe('hello');
      expect(result.issues).toBeUndefined();
    });

    it('should return issues for invalid data', () => {
      const f = fit<string>().that(
        (val): val is string => typeof val === 'string',
        'must be string',
      );
      const schema = toStandardSchema(f);
      const result = schema['~standard'].validate(
        123,
      ) as StandardSchemaV1FailureResult;

      expect(result.issues).toBeInstanceOf(Array);
      expect(result.issues.length).toBeGreaterThan(0);
    });

    it('should work with shape validation', () => {
      const f = shape({
        name: fit<string>().that(
          (val): val is string => typeof val === 'string',
          'must be string',
        ),
        age: fit<number>().that(
          (val): val is number => typeof val === 'number',
          'must be number',
        ),
      });
      const schema = toStandardSchema(f);
      const validData = {name: 'John', age: 25};
      const result1 = schema['~standard'].validate(
        validData,
      ) as StandardSchemaV1SuccessResult<{name: string; age: number}>;

      expect(result1.value).toEqual(validData);

      const invalidData = {name: 'John', age: '25'};
      const result2 = schema['~standard'].validate(
        invalidData,
      ) as StandardSchemaV1FailureResult;

      expect(result2.issues.length).toBeGreaterThan(0);
    });

    it('should work with array validation', () => {
      const f = items(
        fit<number>().that(
          (val): val is number => typeof val === 'number',
          'must be number',
        ),
      );
      const schema = toStandardSchema(f);
      const validData = [1, 2, 3];
      const result1 = schema['~standard'].validate(
        validData,
      ) as StandardSchemaV1SuccessResult<number[]>;

      expect(result1.value).toEqual(validData);

      const invalidData = [1, '2', 3];
      const result2 = schema['~standard'].validate(
        invalidData,
      ) as StandardSchemaV1FailureResult;

      expect(result2.issues.length).toBeGreaterThan(0);
    });

    it('should correctly convert path segments', () => {
      const f = shape({
        user: shape({
          name: fit<string>().that((val) => val.length > 0, 'required'),
        }),
      });
      const schema = toStandardSchema(f);
      const result = schema['~standard'].validate({
        user: {name: ''},
      }) as StandardSchemaV1FailureResult;

      const issue = result.issues[0];
      expect(issue.path).toBeDefined();
      expect(issue.path).toEqual(['user', 'name']);
    });

    it('should correctly convert array indices in path', () => {
      const f = items(fit<number>().that((val) => val > 0, 'must be positive'));
      const schema = toStandardSchema(f);
      const result = schema['~standard'].validate([
        1, -2, 3,
      ]) as StandardSchemaV1FailureResult;

      const issue = result.issues[0];
      expect(issue.path).toBeDefined();
      expect(issue.path![0]).toEqual({key: 1});
    });

    it('should handle bracket notation with non-numeric content', () => {
      const f = shape({
        '[foo]': fit<string>().that((val) => val.length > 0, 'required'),
      });
      const schema = toStandardSchema(f);
      const result = schema['~standard'].validate({
        '[foo]': '',
      }) as StandardSchemaV1FailureResult;

      const issue = result.issues[0];
      expect(issue.path).toBeDefined();
      expect(issue.path![0]).toBe('[foo]');
    });

    it('should convert validation errors correctly', () => {
      const f = shape({
        name: fit<string>().that(
          (val): val is string => typeof val === 'string',
          'must be string',
        ),
      });
      const schema = toStandardSchema(f);
      const result = schema['~standard'].validate({
        name: 123,
      }) as StandardSchemaV1FailureResult;

      expect(result.issues.length).toBeGreaterThan(0);
    });

    it('should convert structure errors correctly', () => {
      const f = shape({
        name: fit<string>().that(
          (val): val is string => typeof val === 'string',
          'must be string',
        ),
      });
      const schema = toStandardSchema(f);
      const result = schema['~standard'].validate({
        name: 'test',
        extra: 'field',
      }) as StandardSchemaV1FailureResult;

      expect(result.issues.length).toBeGreaterThan(0);
    });
  });

  // ============================================
  // toStandardSchemaAsync 测试
  // ============================================
  describe('toStandardSchemaAsync', () => {
    it('should create a valid StandardSchemaV1 object', () => {
      const f = fit<string>().that(
        (val): val is string => typeof val === 'string',
        'must be string',
      );
      const schema = toStandardSchemaAsync(f);

      expect(schema).toHaveProperty('~standard');
      expect(schema['~standard'].version).toBe(1);
      expect(schema['~standard'].vendor).toBe('fit-schema');
      expect(schema['~standard'].types).toBeDefined();
      expect(typeof schema['~standard'].validate).toBe('function');
    });

    it('should validate valid data successfully', async () => {
      const f = fit<string>().that(
        (val): val is string => typeof val === 'string',
        'must be string',
      );
      const schema = toStandardSchemaAsync(f);
      const result = (await schema['~standard'].validate(
        'hello',
      )) as StandardSchemaV1SuccessResult<string>;

      expect(result.value).toBe('hello');
      expect(result.issues).toBeUndefined();
    });

    it('should return issues for invalid data', async () => {
      const f = fit<string>().that(
        (val): val is string => typeof val === 'string',
        'must be string',
      );
      const schema = toStandardSchemaAsync(f);
      const result = (await schema['~standard'].validate(
        123,
      )) as StandardSchemaV1FailureResult;

      expect(result.issues).toBeInstanceOf(Array);
      expect(result.issues.length).toBeGreaterThan(0);
    });

    it('should support async predicates', async () => {
      const f = fit<number>().that(
        (val) => Promise.resolve(val > 0),
        'must be positive',
      );
      const schema = toStandardSchemaAsync(f);
      const result1 = (await schema['~standard'].validate(
        5,
      )) as StandardSchemaV1SuccessResult<number>;

      expect(result1.value).toBe(5);

      const result2 = (await schema['~standard'].validate(
        -5,
      )) as StandardSchemaV1FailureResult;

      expect(result2.issues).toBeDefined();
    });

    it('should work with shape and async predicates', async () => {
      const f = shape({
        name: fit<string>().that(
          (val) => Promise.resolve(typeof val === 'string'),
          'must be string',
        ),
      });
      const schema = toStandardSchemaAsync(f);
      const result = (await schema['~standard'].validate({
        name: 'John',
      })) as StandardSchemaV1SuccessResult<{name: string}>;

      expect(result.value).toEqual({name: 'John'});
    });

    it('should work with array and async predicates', async () => {
      const f = items(
        fit<number>().that(
          (val) => Promise.resolve(val > 0),
          'must be positive',
        ),
      );
      const schema = toStandardSchemaAsync(f);
      const result = (await schema['~standard'].validate([
        1, 2, 3,
      ])) as StandardSchemaV1SuccessResult<number[]>;

      expect(result.value).toEqual([1, 2, 3]);
    });

    it('should correctly convert path segments in async mode', async () => {
      const f = shape({
        user: shape({
          name: fit<string>().that(
            (val) => Promise.resolve(val.length > 0),
            'required',
          ),
        }),
      });
      const schema = toStandardSchemaAsync(f);
      const result = (await schema['~standard'].validate({
        user: {name: ''},
      })) as StandardSchemaV1FailureResult;

      const issue = result.issues[0];
      expect(issue.path).toEqual(['user', 'name']);
    });
  });

  // ============================================
  // 类型结构测试
  // ============================================
  describe('type structure', () => {
    it('should have correct StandardSchemaV1Issue structure', () => {
      const f = fit<string>().that(
        (val): val is string => typeof val === 'string',
        'test error',
      );
      const schema = toStandardSchema(f);
      const result = schema['~standard'].validate(
        123,
      ) as StandardSchemaV1FailureResult;

      const issue: StandardSchemaV1Issue = result.issues[0];
      expect(typeof issue.message).toBe('string');
      expect(issue.message).toBe('test error');
      expect(issue.path).toBeDefined();
    });

    it('should handle StandardSchemaV1Options', () => {
      const f = fit<string>().that(
        (val): val is string => typeof val === 'string',
        'must be string',
      );
      const schema = toStandardSchema(f);
      const options = {libraryOptions: {custom: 'option'}};
      const result = schema['~standard'].validate(
        'hello',
        options,
      ) as StandardSchemaV1SuccessResult<string>;

      expect(result.value).toBe('hello');
    });

    it('should have types property with input and output', () => {
      const f = fit<string>().that(
        (val): val is string => typeof val === 'string',
        'must be string',
      );
      const schema = toStandardSchema(f);

      expect(schema['~standard'].types).toHaveProperty('input');
      expect(schema['~standard'].types).toHaveProperty('output');
    });
  });
});
