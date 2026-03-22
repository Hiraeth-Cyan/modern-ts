// ============================================
// ./src/Other/queue.spec.ts
// ============================================

import {describe, it, expect} from 'vitest';
import {Queue} from './queue';

describe.concurrent('Queue', () => {
  describe('basic operations', () => {
    it('should create an empty queue', () => {
      const queue = new Queue<number>();
      expect(queue.isEmpty()).toBe(true);
      expect(queue.size).toBe(0);
    });

    it('should enqueue and dequeue elements in FIFO order', () => {
      const queue = new Queue<number>();
      queue.enqueue(1);
      queue.enqueue(2);
      queue.enqueue(3);

      expect(queue.size).toBe(3);
      expect(queue.dequeue()).toBe(1);
      expect(queue.dequeue()).toBe(2);
      expect(queue.dequeue()).toBe(3);
      expect(queue.dequeue()).toBeNull();
    });

    it('should peek at front element without removing it', () => {
      const queue = new Queue<string>();
      queue.enqueue('first');
      queue.enqueue('second');

      expect(queue.peek()).toBe('first');
      expect(queue.size).toBe(2);
      expect(queue.dequeue()).toBe('first');
    });

    it('should return null when dequeuing from empty queue', () => {
      const queue = new Queue<number>();
      expect(queue.dequeue()).toBeNull();
    });

    it('should return null when peeking empty queue', () => {
      const queue = new Queue<number>();
      expect(queue.peek()).toBeNull();
    });
  });

  describe('circular buffer optimization', () => {
    it('should handle many enqueue/dequeue operations efficiently', () => {
      const queue = new Queue<number>();

      // Enqueue and dequeue many times to trigger buffer compaction
      for (let i = 0; i < 100; i++) {
        queue.enqueue(i);
      }

      for (let i = 0; i < 50; i++) {
        expect(queue.dequeue()).toBe(i);
      }

      // Continue enqueueing after dequeueing
      for (let i = 100; i < 150; i++) {
        queue.enqueue(i);
      }

      expect(queue.size).toBe(100);
      expect(queue.peek()).toBe(50);
    });

    it('should maintain correct order after buffer compaction', () => {
      const queue = new Queue<number>();

      // Trigger compaction by dequeueing more than half
      for (let i = 1; i <= 10; i++) {
        queue.enqueue(i);
      }

      for (let i = 1; i <= 6; i++) {
        queue.dequeue();
      }

      // After dequeueing 6 items (more than half), buffer should compact
      expect(queue.toArray()).toEqual([7, 8, 9, 10]);
      expect(queue.dequeue()).toBe(7);
      expect(queue.dequeue()).toBe(8);
    });
  });

  describe('clear and toArray', () => {
    it('should clear all elements', () => {
      const queue = new Queue<number>();
      queue.enqueue(1);
      queue.enqueue(2);
      queue.clear();

      expect(queue.isEmpty()).toBe(true);
      expect(queue.size).toBe(0);
      expect(queue.dequeue()).toBeNull();
    });

    it('should convert to array', () => {
      const queue = new Queue<number>();
      queue.enqueue(1);
      queue.enqueue(2);
      queue.enqueue(3);

      expect(queue.toArray()).toEqual([1, 2, 3]);
    });

    it('should return empty array for empty queue', () => {
      const queue = new Queue<number>();
      expect(queue.toArray()).toEqual([]);
    });
  });

  describe('generic type support', () => {
    it('should work with objects', () => {
      interface Item {
        id: number;
        name: string;
      }
      const queue = new Queue<Item>();

      queue.enqueue({id: 1, name: 'Alice'});
      queue.enqueue({id: 2, name: 'Bob'});

      const item = queue.dequeue();
      expect(item).toEqual({id: 1, name: 'Alice'});
    });
  });
});
