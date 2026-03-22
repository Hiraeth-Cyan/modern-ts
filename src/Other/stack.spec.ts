// ============================================
// ./src/Other/stack.spec.ts
// ============================================

import {describe, it, expect} from 'vitest';
import {Stack} from './stack';

describe.concurrent('Stack', () => {
  describe('basic operations', () => {
    it('should create an empty stack', () => {
      const stack = new Stack<number>();
      expect(stack.isEmpty()).toBe(true);
      expect(stack.size).toBe(0);
    });

    it('should push and pop elements in LIFO order', () => {
      const stack = new Stack<number>();
      stack.push(1);
      stack.push(2);
      stack.push(3);

      expect(stack.size).toBe(3);
      expect(stack.pop()).toBe(3);
      expect(stack.pop()).toBe(2);
      expect(stack.pop()).toBe(1);
      expect(stack.pop()).toBeNull();
    });

    it('should peek at top element without removing it', () => {
      const stack = new Stack<string>();
      stack.push('first');
      stack.push('second');

      expect(stack.peek()).toBe('second');
      expect(stack.size).toBe(2);
      expect(stack.pop()).toBe('second');
    });

    it('should return null when popping from empty stack', () => {
      const stack = new Stack<number>();
      expect(stack.pop()).toBeNull();
    });

    it('should return null when peeking empty stack', () => {
      const stack = new Stack<number>();
      expect(stack.peek()).toBeNull();
    });
  });

  describe('clear and toArray', () => {
    it('should clear all elements', () => {
      const stack = new Stack<number>();
      stack.push(1);
      stack.push(2);
      stack.clear();

      expect(stack.isEmpty()).toBe(true);
      expect(stack.size).toBe(0);
      expect(stack.pop()).toBeNull();
    });

    it('should convert to array', () => {
      const stack = new Stack<number>();
      stack.push(1);
      stack.push(2);
      stack.push(3);

      expect(stack.toArray()).toEqual([1, 2, 3]);
    });

    it('should return empty array for empty stack', () => {
      const stack = new Stack<number>();
      expect(stack.toArray()).toEqual([]);
    });
  });

  describe('generic type support', () => {
    it('should work with objects', () => {
      interface Item {
        id: number;
        name: string;
      }
      const stack = new Stack<Item>();

      stack.push({id: 1, name: 'Alice'});
      stack.push({id: 2, name: 'Bob'});

      const item = stack.pop();
      expect(item).toEqual({id: 2, name: 'Bob'});
    });

    it('should work with mixed types via union', () => {
      const stack = new Stack<string | number>();
      stack.push('hello');
      stack.push(42);

      expect(stack.pop()).toBe(42);
      expect(stack.pop()).toBe('hello');
    });
  });
});
