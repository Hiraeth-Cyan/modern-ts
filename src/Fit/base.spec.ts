// ========================================
// ./src/Fit/base.spec.ts
// ========================================
import {describe, it, expect} from 'vitest';
import {
  Fit,
  Void,
  type,
  type BaseFit,
  type InferFit,
  type DeriveShape,
  toReadonly,
  toOptional,
  fit,
  shape,
  items,
} from './base';
import {expectIdentical, type Prettify} from '../Utils/type-tool';

describe.concurrent('Fit', () => {
  // ============================================
  // 常量和枚举测试
  // ============================================
  describe('Void symbol', () => {
    it('should be a unique symbol', () => {
      expect(typeof Void).toBe('symbol');
      expect(String(Void)).toBe('Symbol(Void)');
    });
  });

  describe('type enum', () => {
    it('should have correct enum values', () => {
      expect(type.that).toBe(0);
      expect(type.off).toBe(1);
      expect(type.transform).toBe(2);
      expect(type.shape).toBe(3);
      expect(type.toArray).toBe(4);
    });
  });

  // ============================================
  // Fit 构造函数和基本属性
  // ============================================
  describe('Fit constructor', () => {
    it('should create a Fit instance with empty ops', () => {
      const f = new Fit<string>();
      expect(f.Ops).toEqual([]);
      expect(f.isOptional).toBe(false);
    });

    it('should create a Fit instance using fit() helper', () => {
      const f = fit<string>();
      expect(f).toBeInstanceOf(Fit);
      expect(f.Ops).toEqual([]);
    });
  });

  // ============================================
  // that 方法测试
  // ============================================
  describe('that method', () => {
    it('should add type guard operation', () => {
      const f = fit<unknown>().that(
        (val): val is string => typeof val === 'string',
        'must be string',
      );
      expect(f.Ops).toHaveLength(1);
      expect(f.Ops[0].type).toBe(type.that);
    });

    it('should add boolean predicate operation', () => {
      const f = fit<number>().that((val) => val > 0, 'must be positive');
      expect(f.Ops).toHaveLength(1);
      expect(f.Ops[0].type).toBe(type.that);
    });

    it('should support chaining multiple that calls', () => {
      const f = fit<number>()
        .that((val) => val > 0, 'must be positive')
        .that((val) => val < 100, 'must be less than 100');
      expect(f.Ops).toHaveLength(2);
    });

    it('should support message generator function', () => {
      const f = fit<number>().that(
        (val) => val > 0,
        (val) => `Value ${String(val)} must be positive`,
      );
      expect(f.Ops).toHaveLength(1);
      const op = f.Ops[0] as unknown as {type: number; message?: unknown};
      expect(op.type).toBe(type.that);
      expect(typeof op.message).toBe('function');
    });

    it('should store predicate in operation', () => {
      const predicate = (val: unknown): val is string =>
        typeof val === 'string';
      const f = fit<unknown>().that(predicate, 'must be string');
      const op = f.Ops[0] as unknown as {predicate: typeof predicate};
      expect(op.predicate).toBe(predicate);
    });
  });

  // ============================================
  // off 方法测试
  // ============================================
  describe('off method', () => {
    it('should add short-circuit operation without default value', () => {
      const f = fit<string | null>().off((val): val is null => val === null);
      expect(f.Ops).toHaveLength(1);
      expect(f.Ops[0].type).toBe(type.off);
      expect(f.Ops[0]).not.toHaveProperty('defaultValue');
    });

    it('should add short-circuit operation with default value', () => {
      const f = fit<string | null>().off(
        (val): val is null => val === null,
        'default',
      );
      expect(f.Ops).toHaveLength(1);
      expect(f.Ops[0].type).toBe(type.off);
      expect((f.Ops[0] as {defaultValue: string}).defaultValue).toBe('default');
    });

    it('should support boolean predicate', () => {
      const f = fit<number>().off((val) => val === 0, 0);
      expect(f.Ops).toHaveLength(1);
      expect(f.Ops[0].type).toBe(type.off);
    });

    it('should support chaining with that', () => {
      const f = fit<string | null>()
        .off((val): val is null => val === null, 'empty')
        .that((val) => val.length > 0, 'must not be empty');
      expect(f.Ops).toHaveLength(2);
    });
  });

  // ============================================
  // transform 方法测试
  // ============================================
  describe('transform method', () => {
    it('should add transform operation', () => {
      const f = fit<string>().transform((val) => val.length);
      expect(f.Ops).toHaveLength(1);
      expect(f.Ops[0].type).toBe(type.transform);
    });

    it('should store transform function', () => {
      const fn = (val: string) => val.toUpperCase();
      const f = fit<string>().transform(fn);
      const op = f.Ops[0] as {fn: typeof fn};
      expect(op.fn).toBe(fn);
    });

    it('should support chaining with other operations', () => {
      const f = fit<string>()
        .transform((val) => parseInt(val, 10))
        .that((val) => !isNaN(val), 'must be number');
      expect(f.Ops).toHaveLength(2);
      expect(f.Ops[0].type).toBe(type.transform);
      expect(f.Ops[1].type).toBe(type.that);
    });
  });

  // ============================================
  // toShaped 方法测试
  // ============================================
  describe('toShaped method', () => {
    it('should add shape operation', () => {
      const f = fit().toShaped({
        name: fit<string>().that((val) => val.length > 0, 'required'),
      });
      expect(f.Ops).toHaveLength(1);
      expect(f.Ops[0].type).toBe(type.shape);
    });

    it('should store fields in operation', () => {
      const fields = {
        name: fit<string>(),
        age: fit<number>(),
      };
      const f = fit().toShaped(fields);
      const op = f.Ops[0] as {fields: Record<string, BaseFit>};
      expect(op.fields).toBe(fields);
    });

    it('should support nested shapes', () => {
      const f = fit().toShaped({
        user: fit().toShaped({
          name: fit<string>(),
        }),
      });
      expect(f.Ops).toHaveLength(1);
      expect(f.Ops[0].type).toBe(type.shape);
    });
  });

  // ============================================
  // toArray 方法测试
  // ============================================
  describe('toArray method', () => {
    it('should add toArray operation', () => {
      const elementFit = fit<number>();
      const f = fit().toArray(elementFit);
      expect(f.Ops).toHaveLength(1);
      expect(f.Ops[0].type).toBe(type.toArray);
    });

    it('should store elementFit in operation', () => {
      const elementFit = fit<number>().that((val) => val > 0, 'positive');
      const f = fit().toArray(elementFit);
      const op = f.Ops[0] as unknown as {elementFit: Fit<number>};
      expect(op.elementFit).toBe(elementFit);
    });
  });

  // ============================================
  // fork 方法测试
  // ============================================
  describe('fork method', () => {
    it('should create a copy with same ops', () => {
      const original = fit<number>()
        .that((val) => val > 0, 'positive')
        .that((val) => val < 100, 'less than 100');
      const forked = original.fork();

      expect(forked).not.toBe(original);
      expect(forked.Ops).not.toBe(original.Ops);
      expect(forked.Ops).toEqual(original.Ops);
    });

    it('should preserve isOptional flag', () => {
      const original = fit<string>();
      const optional = toOptional(original);
      const forked = optional.fork();

      expect(forked.isOptional).toBe(true);
    });

    it('should allow independent modification after fork', () => {
      const original = fit<number>().that((val) => val > 0, 'positive');
      const forked = original.fork();

      original.that((val) => val < 100, 'less than 100');

      expect(original.Ops).toHaveLength(2);
      expect(forked.Ops).toHaveLength(1);
    });
  });

  // ============================================
  // toReadonly 函数测试
  // ============================================
  describe('toReadonly function', () => {
    it('should return same Fit instance', () => {
      const f = fit<string>();
      const readonly = toReadonly(f);
      expect(readonly).toBe(f);
    });
  });

  // ============================================
  // toOptional 函数测试
  // ============================================
  describe('toOptional function', () => {
    it('should set isOptional to true', () => {
      const f = fit<string>();
      expect(f.isOptional).toBe(false);
      const optional = toOptional(f);
      expect(optional.isOptional).toBe(true);
    });

    it('should return same Fit instance', () => {
      const f = fit<string>();
      const optional = toOptional(f);
      expect(optional).toBe(f);
    });
  });

  // ============================================
  // shape 快捷函数测试
  // ============================================
  describe('shape helper function', () => {
    it('should create a Fit with shape operation', () => {
      const f = shape({
        name: fit<string>(),
        age: fit<number>(),
      });
      expect(f).toBeInstanceOf(Fit);
      expect(f.Ops).toHaveLength(1);
      expect(f.Ops[0].type).toBe(type.shape);
    });
  });

  // ============================================
  // items 快捷函数测试
  // ============================================
  describe('items helper function', () => {
    it('should create a Fit with toArray operation', () => {
      const elementFit = fit<number>();
      const f = items(elementFit);
      expect(f).toBeInstanceOf(Fit);
      expect(f.Ops).toHaveLength(1);
      expect(f.Ops[0].type).toBe(type.toArray);
    });
  });

  // ============================================
  // InferFit 类型测试
  // ============================================
  describe('InferFit type', () => {
    it('should extract T from Fit<T>', () => {
      expectIdentical<string>()<InferFit<Fit<string>>>('test');
    });

    it('should extract T | Bail from Fit<T, Bail>', () => {
      expectIdentical<string | null>()<InferFit<Fit<string, null>>>('test');
      expectIdentical<string | null>()<InferFit<Fit<string, null>>>(null);
    });
  });

  // ============================================
  // DeriveShape 类型测试
  // ============================================
  describe('DeriveShape type', () => {
    it('should derive shape from field schemas', () => {
      type TestShape = Prettify<
        DeriveShape<{
          name: Fit<string, never, never, false>;
          age: Fit<number, never, never, false>;
        }>
      >;
      expectIdentical<{name: string; age: number}>()<TestShape>({
        name: 'test',
        age: 25,
      });
    });

    it('should handle optional fields', () => {
      type TestShape = Prettify<
        DeriveShape<{
          name: Fit<string, never, never, true>;
        }>
      >;
      expectIdentical<{name?: string}>()<TestShape>({name: 'test'});
      expectIdentical<{name?: string}>()<TestShape>({});
    });
  });

  // ============================================
  // BaseFit 接口测试
  // ============================================
  describe('BaseFit interface', () => {
    it('should be implemented by Fit class', () => {
      const f: BaseFit = fit<string>();
      expect(f.Ops).toBeDefined();
      expect(f.isOptional).toBeDefined();
    });
  });
});
