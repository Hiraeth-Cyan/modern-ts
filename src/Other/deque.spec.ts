// ============================================
// ./src/Other/deque.spec.ts
// ============================================

import {describe, it, expect} from 'vitest';
import {Deque} from './deque';

describe.concurrent('Deque', () => {
  describe('basic operations', () => {
    it('should create an empty deque', () => {
      const deque = new Deque<number>();
      expect(deque.isEmpty()).toBe(true);
      expect(deque.size).toBe(0);
    });

    it('should push and pop from back', () => {
      const deque = new Deque<number>();
      deque.pushBack(1);
      deque.pushBack(2);
      deque.pushBack(3);

      expect(deque.size).toBe(3);
      expect(deque.popBack()).toBe(3);
      expect(deque.popBack()).toBe(2);
      expect(deque.popBack()).toBe(1);
      expect(deque.popBack()).toBeNull();
    });

    it('should push and pop from front', () => {
      const deque = new Deque<number>();
      deque.pushFront(1);
      deque.pushFront(2);
      deque.pushFront(3);

      expect(deque.size).toBe(3);
      expect(deque.popFront()).toBe(3);
      expect(deque.popFront()).toBe(2);
      expect(deque.popFront()).toBe(1);
      expect(deque.popFront()).toBeNull();
    });

    it('should interleave front and back operations', () => {
      const deque = new Deque<number>();
      deque.pushBack(2);
      deque.pushFront(1);
      deque.pushBack(3);
      deque.pushFront(0);

      expect(deque.toArray()).toEqual([0, 1, 2, 3]);
      expect(deque.popFront()).toBe(0);
      expect(deque.popBack()).toBe(3);
      expect(deque.popFront()).toBe(1);
      expect(deque.popBack()).toBe(2);
    });
  });

  describe('peek operations', () => {
    it('should peek at front element', () => {
      const deque = new Deque<string>();
      deque.pushBack('first');
      deque.pushBack('second');

      expect(deque.peekFront()).toBe('first');
      expect(deque.size).toBe(2);
    });

    it('should peek at back element', () => {
      const deque = new Deque<string>();
      deque.pushBack('first');
      deque.pushBack('second');

      expect(deque.peekBack()).toBe('second');
      expect(deque.size).toBe(2);
    });

    it('should return null when peeking empty deque', () => {
      const deque = new Deque<number>();
      expect(deque.peekFront()).toBeNull();
      expect(deque.peekBack()).toBeNull();
    });

    it('should return null when popping from empty deque', () => {
      const deque = new Deque<number>();
      expect(deque.popFront()).toBeNull();
      expect(deque.popBack()).toBeNull();
    });
  });

  describe('buffer management', () => {
    it('should handle many operations efficiently', () => {
      const deque = new Deque<number>();

      // Mix of front and back operations
      for (let i = 0; i < 50; i++) {
        deque.pushBack(i);
        deque.pushFront(-i - 1);
      }

      expect(deque.size).toBe(100);

      // Remove from both ends
      for (let i = 0; i < 25; i++) {
        deque.popFront();
        deque.popBack();
      }

      expect(deque.size).toBe(50);
    });

    it('should maintain correct order after compaction', () => {
      const deque = new Deque<number>();

      // Build up deque
      for (let i = 1; i <= 10; i++) {
        deque.pushBack(i);
      }

      // Remove more than half to trigger compaction
      for (let i = 0; i < 6; i++) {
        deque.popFront();
      }

      expect(deque.toArray()).toEqual([7, 8, 9, 10]);
    });
  });

  describe('clear and toArray', () => {
    it('should clear all elements', () => {
      const deque = new Deque<number>();
      deque.pushBack(1);
      deque.pushFront(2);
      deque.clear();

      expect(deque.isEmpty()).toBe(true);
      expect(deque.size).toBe(0);
      expect(deque.popFront()).toBeNull();
      expect(deque.popBack()).toBeNull();
    });

    it('should convert to array', () => {
      const deque = new Deque<number>();
      deque.pushBack(2);
      deque.pushFront(1);
      deque.pushBack(3);

      expect(deque.toArray()).toEqual([1, 2, 3]);
    });

    it('should return empty array for empty deque', () => {
      const deque = new Deque<number>();
      expect(deque.toArray()).toEqual([]);
    });
  });

  describe('generic type support', () => {
    it('should work with objects', () => {
      interface Item {
        id: number;
        name: string;
      }
      const deque = new Deque<Item>();

      deque.pushBack({id: 1, name: 'Alice'});
      deque.pushFront({id: 2, name: 'Bob'});

      expect(deque.popBack()).toEqual({id: 1, name: 'Alice'});
      expect(deque.popFront()).toEqual({id: 2, name: 'Bob'});
    });
  });
});
