// ========================================
// ./src/Maybe/consumers.spec.ts
// ========================================
import {describe, it, expect, vi} from 'vitest';
import {
  match,
  ifSome,
  ifNone,
  peek,
  peekNone,
  peekBoth,
} from './consumers';

describe.concurrent('Maybe consumers', () => {
  describe('match', () => {
    it('should execute onSome callback for Some value', () => {
      const onSome = vi.fn((x: number) => x * 2);
      const onNone = vi.fn(() => 0);

      const result = match(42, onSome, onNone);

      expect(onSome).toHaveBeenCalledWith(42);
      expect(onSome).toHaveBeenCalledTimes(1);
      expect(onNone).not.toHaveBeenCalled();
      expect(result).toBe(84);
    });

    it('should execute onNone callback for None value', () => {
      const onSome = vi.fn((x: number) => x * 2);
      const onNone = vi.fn(() => 0);

      const result = match(null, onSome, onNone);

      expect(onNone).toHaveBeenCalled();
      expect(onNone).toHaveBeenCalledTimes(1);
      expect(onSome).not.toHaveBeenCalled();
      expect(result).toBe(0);
    });
  });

  describe('ifSome', () => {
    it('should execute callback for Some value', () => {
      const callback = vi.fn((x: number) => x * 2);

      const result = ifSome(42, callback);

      expect(callback).toHaveBeenCalledWith(42);
      expect(result).toBe(84);
    });

    it('should return undefined for None value without fallback', () => {
      const callback = vi.fn<() => void>();

      const result = ifSome(null, callback);

      expect(callback).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    it('should execute callback for Some and fallback for None', () => {
      const onSome = vi.fn((x: number) => x * 2);
      const onElse = vi.fn(() => 0);

      const result1 = ifSome(42, onSome, onElse);
      const result2 = ifSome(null, onSome, onElse);

      expect(onSome).toHaveBeenCalledWith(42);
      expect(onSome).toHaveBeenCalledTimes(1);
      expect(onElse).toHaveBeenCalledTimes(1);
      expect(result1).toBe(84);
      expect(result2).toBe(0);
    });
  });

  describe('ifNone', () => {
    it('should execute callback for None value', () => {
      const callback = vi.fn(() => 'empty');

      const result = ifNone(null, callback);

      expect(callback).toHaveBeenCalled();
      expect(result).toBe('empty');
    });

    it('should return undefined for Some value without fallback', () => {
      const callback = vi.fn<() => void>();

      const result = ifNone(42, callback);

      expect(callback).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    it('should execute callback for None and fallback for Some', () => {
      const onNone = vi.fn(() => 'empty');
      const onElse = vi.fn((x: number) => x * 2);

      const result1 = ifNone(null, onNone, onElse);
      const result2 = ifNone(42, onNone, onElse);

      expect(onNone).toHaveBeenCalledTimes(1);
      expect(onElse).toHaveBeenCalledWith(42);
      expect(onElse).toHaveBeenCalledTimes(1);
      expect(result1).toBe('empty');
      expect(result2).toBe(84);
    });
  });

  describe('peek', () => {
    it('should call callback for Some value', () => {
      const callback = vi.fn();
      const result = peek(42, callback);

      expect(callback).toHaveBeenCalledWith(42);
      expect(result).toBe(42);
    });

    it('should not call callback for None value', () => {
      const callback = vi.fn<() => void>();
      const result = peek(null, callback);

      expect(callback).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });

  describe('peekNone', () => {
    it('should call callback for None value', () => {
      const callback = vi.fn();
      const result = peekNone(null, callback);

      expect(callback).toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should not call callback for Some value', () => {
      const callback = vi.fn();
      const result = peekNone(42, callback);

      expect(callback).not.toHaveBeenCalled();
      expect(result).toBe(42);
    });
  });

  describe('peekBoth', () => {
    it('should call fnSome for Some value', () => {
      const fnSome = vi.fn();
      const fnNone = vi.fn();
      const result = peekBoth(42, {fnSome, fnNone});

      expect(fnSome).toHaveBeenCalledWith(42);
      expect(fnNone).not.toHaveBeenCalled();
      expect(result).toBe(42);
    });

    it('should call fnNone for None value', () => {
      const fnSome = vi.fn<() => void>();
      const fnNone = vi.fn<() => void>();
      const result = peekBoth(null, {fnSome, fnNone});

      expect(fnSome).not.toHaveBeenCalled();
      expect(fnNone).toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should work with default empty callbacks', () => {
      expect(peekBoth(42, {})).toBe(42);
      expect(peekBoth(null, {})).toBeNull();
    });
  });
});
