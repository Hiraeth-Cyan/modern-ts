// ========================================
// ./src/Maybe/base.spec.ts
// ========================================
import {describe, it, expect} from 'vitest';
import {
  Some,
  None,
  isSome,
  isNone,
  fromNullable,
  fromFalsy,
  toNullable,
  toResult,
  toArray,
  transpose,
} from './base';
import type {Failure, Success} from 'src/Result/types';

describe.concurrent('Maybe base functions', () => {
  describe('Some', () => {
    it('should wrap a value in Some', () => {
      expect(Some(42)).toBe(42);
      expect(Some('hello')).toBe('hello');
      expect(Some({foo: 'bar'})).toEqual({foo: 'bar'});
    });
  });

  describe('None', () => {
    it('should return undefined', () => {
      expect(None()).toBeUndefined();
    });
  });

  describe('isSome', () => {
    it('should return true for non-null/undefined values', () => {
      expect(isSome(42)).toBe(true);
      expect(isSome('hello')).toBe(true);
      expect(isSome({})).toBe(true);
      expect(isSome([])).toBe(true);
      expect(isSome(false)).toBe(true);
      expect(isSome(0)).toBe(true);
    });

    it('should return false for null/undefined', () => {
      expect(isSome(null)).toBe(false);
      expect(isSome(undefined)).toBe(false);
    });
  });

  describe('isNone', () => {
    it('should return true for null/undefined', () => {
      expect(isNone(null)).toBe(true);
      expect(isNone(undefined)).toBe(true);
    });

    it('should return false for non-null/undefined', () => {
      expect(isNone(42)).toBe(false);
      expect(isNone('')).toBe(false);
      expect(isNone(false)).toBe(false);
    });
  });

  describe('fromNullable', () => {
    it('should return Some for non-null/undefined', () => {
      expect(fromNullable(42)).toBe(42);
      expect(fromNullable('test')).toBe('test');
    });

    it('should return None for null/undefined', () => {
      expect(fromNullable(null)).toBeUndefined();
      expect(fromNullable(undefined)).toBeUndefined();
    });
  });

  describe('fromFalsy', () => {
    it('should return Some for truthy values', () => {
      expect(fromFalsy(42)).toBe(42);
      expect(fromFalsy('hello')).toBe('hello');
      expect(fromFalsy({})).toEqual({});
      expect(fromFalsy([])).toEqual([]);
    });

    it('should return None for falsy values', () => {
      expect(fromFalsy(false)).toBeUndefined();
      expect(fromFalsy(0)).toBeUndefined();
      expect(fromFalsy('')).toBeUndefined();
      expect(fromFalsy(null)).toBeUndefined();
      expect(fromFalsy(undefined)).toBeUndefined();
    });
  });

  describe('toNullable', () => {
    it('should return value for Some', () => {
      expect(toNullable(42)).toBe(42);
      expect(toNullable('test')).toBe('test');
    });

    it('should return null for None', () => {
      expect(toNullable(null)).toBe(null);
      expect(toNullable(undefined)).toBe(null);
    });
  });

  describe('toResult', () => {
    const errorFn = () => 'error';

    it('should return Ok for Some', () => {
      const result = toResult(42, errorFn);
      expect(result.ok).toBe(true);
      expect((result as Success<number>).value).toBe(42);
    });

    it('should return Err for None', () => {
      const result = toResult(null, errorFn);
      expect(result.ok).toBe(false);
      expect((result as Failure<string>).error).toBe('error');
    });
  });

  describe('toArray', () => {
    it('should return singleton array for Some', () => {
      expect(toArray(42)).toEqual([42]);
      expect(toArray('test')).toEqual(['test']);
    });

    it('should return empty array for None', () => {
      expect(toArray(null)).toEqual([]);
      expect(toArray(undefined)).toEqual([]);
    });
  });

  describe('transpose', () => {
    it('should resolve to Some for Some(Promise)', async () => {
      const promise = Promise.resolve(42);
      const result = await transpose(promise);
      expect(result).toBe(42);
    });

    it('should resolve to None for None', async () => {
      const result = await transpose(null);
      expect(result).toBeUndefined();
    });

    it('should reject if promise rejects', async () => {
      const error = new Error('test');
      const promise = Promise.reject(error);
      await expect(transpose(promise)).rejects.toThrow('test');
    });
  });
});
