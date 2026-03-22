// ============================================
// ./src/Other/heap.spec.ts
// ============================================

import {describe, it, expect} from 'vitest';
import {Heap} from './heap';

describe.concurrent('Heap', () => {
  describe('min heap operations', () => {
    it('should create an empty heap', () => {
      const heap = new Heap<number>((a, b) => a - b);
      expect(heap.isEmpty()).toBe(true);
      expect(heap.size).toBe(0);
    });

    it('should push and pop elements in ascending order (min heap)', () => {
      const heap = new Heap<number>((a, b) => a - b);
      heap.push(5);
      heap.push(3);
      heap.push(7);
      heap.push(1);
      heap.push(9);

      expect(heap.size).toBe(5);
      expect(heap.pop()).toBe(1);
      expect(heap.pop()).toBe(3);
      expect(heap.pop()).toBe(5);
      expect(heap.pop()).toBe(7);
      expect(heap.pop()).toBe(9);
      expect(heap.pop()).toBeNull();
    });

    it('should peek at top element without removing it', () => {
      const heap = new Heap<number>((a, b) => a - b);
      heap.push(5);
      heap.push(3);
      heap.push(7);

      expect(heap.peek()).toBe(3);
      expect(heap.size).toBe(3);
      expect(heap.pop()).toBe(3);
      expect(heap.peek()).toBe(5);
    });

    it('should return null when popping from empty heap', () => {
      const heap = new Heap<number>((a, b) => a - b);
      expect(heap.pop()).toBeNull();
    });

    it('should return null when peeking empty heap', () => {
      const heap = new Heap<number>((a, b) => a - b);
      expect(heap.peek()).toBeNull();
    });
  });

  describe('max heap operations', () => {
    it('should push and pop elements in descending order (max heap)', () => {
      const heap = new Heap<number>((a, b) => b - a);
      heap.push(5);
      heap.push(3);
      heap.push(7);
      heap.push(1);
      heap.push(9);

      expect(heap.size).toBe(5);
      expect(heap.pop()).toBe(9);
      expect(heap.pop()).toBe(7);
      expect(heap.pop()).toBe(5);
      expect(heap.pop()).toBe(3);
      expect(heap.pop()).toBe(1);
    });
  });

  describe('generic type support', () => {
    it('should work with strings', () => {
      const heap = new Heap<string>((a, b) => a.localeCompare(b));
      heap.push('banana');
      heap.push('apple');
      heap.push('cherry');

      expect(heap.pop()).toBe('apple');
      expect(heap.pop()).toBe('banana');
      expect(heap.pop()).toBe('cherry');
    });

    it('should work with objects', () => {
      interface Item {
        priority: number;
        name: string;
      }
      const heap = new Heap<Item>((a, b) => a.priority - b.priority);

      heap.push({priority: 3, name: 'Low'});
      heap.push({priority: 1, name: 'High'});
      heap.push({priority: 2, name: 'Medium'});

      expect(heap.pop()).toEqual({priority: 1, name: 'High'});
      expect(heap.pop()).toEqual({priority: 2, name: 'Medium'});
      expect(heap.pop()).toEqual({priority: 3, name: 'Low'});
    });

    it('should work with custom comparison logic', () => {
      interface Person {
        age: number;
        name: string;
      }
      const heap = new Heap<Person>((a, b) => b.age - a.age);

      heap.push({age: 25, name: 'Alice'});
      heap.push({age: 30, name: 'Bob'});
      heap.push({age: 20, name: 'Charlie'});

      expect(heap.pop()).toEqual({age: 30, name: 'Bob'});
      expect(heap.pop()).toEqual({age: 25, name: 'Alice'});
      expect(heap.pop()).toEqual({age: 20, name: 'Charlie'});
    });
  });

  describe('edge cases', () => {
    it('should handle duplicate values', () => {
      const heap = new Heap<number>((a, b) => a - b);
      heap.push(5);
      heap.push(5);
      heap.push(3);
      heap.push(3);
      heap.push(7);

      expect(heap.pop()).toBe(3);
      expect(heap.pop()).toBe(3);
      expect(heap.pop()).toBe(5);
      expect(heap.pop()).toBe(5);
      expect(heap.pop()).toBe(7);
    });

    it('should handle single element', () => {
      const heap = new Heap<number>((a, b) => a - b);
      heap.push(42);

      expect(heap.size).toBe(1);
      expect(heap.peek()).toBe(42);
      expect(heap.pop()).toBe(42);
      expect(heap.isEmpty()).toBe(true);
    });

    it('should handle negative numbers', () => {
      const heap = new Heap<number>((a, b) => a - b);
      heap.push(-5);
      heap.push(3);
      heap.push(-10);
      heap.push(7);

      expect(heap.pop()).toBe(-10);
      expect(heap.pop()).toBe(-5);
      expect(heap.pop()).toBe(3);
      expect(heap.pop()).toBe(7);
    });

    it('should maintain heap property after multiple operations', () => {
      const heap = new Heap<number>((a, b) => a - b);

      for (let i = 10; i >= 1; i--) {
        heap.push(i);
      }

      for (let i = 1; i <= 10; i++) {
        expect(heap.pop()).toBe(i);
      }
    });

    it('should handle interleaved push and pop operations', () => {
      const heap = new Heap<number>((a, b) => a - b);

      heap.push(5);
      heap.push(3);
      expect(heap.pop()).toBe(3);

      heap.push(1);
      expect(heap.pop()).toBe(1);

      heap.push(4);
      heap.push(2);
      expect(heap.pop()).toBe(2);
      expect(heap.pop()).toBe(4);
      expect(heap.pop()).toBe(5);
    });
  });
});
