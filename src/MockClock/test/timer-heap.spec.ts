// ========================================
// ./src/MockClock/test/timer-heap.spec.ts
// ========================================
/**
 * @vitest-environment-options { "isolate": true }
 */
import {describe, it, expect} from 'vitest';
import {TimerHeap} from '../TimerHeap';
import type {Timer} from '../types';

describe('TimerHeap', () => {
  const createTimer = (heap: TimerHeap, deadline: number): Timer => ({
    id: heap.allocId(),
    type: 0,
    callback: () => {},
    args: [],
    delay: deadline,
    deadline,
    ref: true,
    heap_index: -1,
  });

  // ============================================
  // 基本操作
  // ============================================
  describe('basic operations', () => {
    it.concurrent(
      'should create empty heap and handle peek/pop on empty',
      () => {
        const heap = new TimerHeap();
        expect(heap.size).toBe(0);
        expect(heap.isEmpty()).toBe(true);
        expect(heap.peek()).toBeNull();
        expect(heap.pop()).toBeNull();
      },
    );

    it.concurrent('should add, peek and pop timer', () => {
      const heap = new TimerHeap();
      const timer = createTimer(heap, 100);
      heap.add(timer);
      expect(heap.size).toBe(1);
      expect(heap.isEmpty()).toBe(false);
      expect(heap.peek()).toBe(timer);
      const popped = heap.pop();
      expect(popped).toBe(timer);
      expect(heap.size).toBe(0);
    });

    it.concurrent('should clear heap', () => {
      const heap = new TimerHeap();
      heap.add(createTimer(heap, 100));
      heap.clear();
      expect(heap.size).toBe(0);
      expect(heap.isEmpty()).toBe(true);
    });
  });

  // ============================================
  // 最小堆属性
  // ============================================
  describe('min-heap property', () => {
    it.concurrent('should maintain min-heap property and pop in order', () => {
      const heap = new TimerHeap();
      const timers = [
        createTimer(heap, 300),
        createTimer(heap, 100),
        createTimer(heap, 200),
      ];
      timers.forEach((t) => heap.add(t));
      expect(heap.peek()).toBe(timers[1]);
      expect(heap.pop()).toBe(timers[1]);
      expect(heap.pop()).toBe(timers[2]);
      expect(heap.pop()).toBe(timers[0]);
    });
  });

  // ============================================
  // remove 操作
  // ============================================
  describe('remove', () => {
    it.concurrent(
      'should remove timer by id and return null for non-existent',
      () => {
        const heap = new TimerHeap();
        expect(heap.remove(999)).toBeNull();
        const timer = createTimer(heap, 100);
        heap.add(timer);
        const removed = heap.remove(timer.id);
        expect(removed).toBe(timer);
        expect(heap.size).toBe(0);
      },
    );

    it.concurrent('should remove from middle of heap with bubbleDown', () => {
      const heap = new TimerHeap();
      const timer1 = createTimer(heap, 100);
      const timer2 = createTimer(heap, 300);
      const timer3 = createTimer(heap, 200);
      heap.add(timer1);
      heap.add(timer2);
      heap.add(timer3);
      heap.remove(timer1.id);
      expect(heap.peek()).toBe(timer3);
    });

    it.concurrent('should handle remove with bubbleUp branch', () => {
      const heap = new TimerHeap();
      const timers = [100, 200, 300, 400, 10, 20, 30].map((d) =>
        createTimer(heap, d),
      );
      timers.forEach((t) => heap.add(t));
      heap.remove(timers[3].id);
      expect(heap.peek()).toBe(timers[4]);
    });

    it.concurrent(
      'should handle remove with bubbleDown when last >= parent',
      () => {
        const heap = new TimerHeap();
        // 构建堆: [10, 50, 20, 100, 60, 30, 40]
        // 移除 index=1 (deadline=50) 后，last(40) >= parent(10)，走 bubbleDown
        const deadlines = [10, 50, 20, 100, 60, 30, 40];
        const timers = deadlines.map((d) => createTimer(heap, d));
        timers.forEach((t) => heap.add(t));
        heap.remove(timers[1].id);
        expect(heap.peek()).toBe(timers[0]);
        const remaining = [
          timers[0],
          timers[2],
          timers[3],
          timers[4],
          timers[5],
          timers[6],
        ];
        const sorted = remaining
          .slice()
          .sort((a, b) => a.deadline - b.deadline);
        sorted.forEach((expected) => {
          expect(heap.pop()).toBe(expected);
        });
      },
    );
  });

  // ============================================
  // get 和 update 操作
  // ============================================
  describe('get and update', () => {
    it.concurrent('should get timer by id', () => {
      const heap = new TimerHeap();
      expect(heap.get(999)).toBeUndefined();
      const timer = createTimer(heap, 100);
      heap.add(timer);
      expect(heap.get(timer.id)).toBe(timer);
    });

    it.concurrent('should update timer position', () => {
      const heap = new TimerHeap();
      const timer = createTimer(heap, 100);
      heap.add(timer);
      timer.deadline = 50;
      heap.update(timer.id);
      expect(heap.peek()).toBe(timer);
    });

    it.concurrent('should handle update for non-existent timer', () => {
      const heap = new TimerHeap();
      expect(() => heap.update(999)).not.toThrow();
    });

    it.concurrent(
      'should bubbleUp when updated deadline is smaller than parent',
      () => {
        const heap = new TimerHeap();
        // 构建堆: deadline 顺序 [10, 50, 30, 100, 60, 40, 70]
        // 堆结构:
        //        10(0)
        //       /    \
        //    50(1)   30(2)
        //   /  \     /  \
        // 100  60  40   70
        const timers = [10, 50, 30, 100, 60, 40, 70].map((d) =>
          createTimer(heap, d),
        );
        timers.forEach((t) => heap.add(t));

        // 修改 index=5 (deadline=40) 的定时器，使其 deadline < parent(30)
        timers[5].deadline = 5;
        heap.update(timers[5].id);

        // 现在 timers[5] 应该在堆顶
        expect(heap.peek()).toBe(timers[5]);
      },
    );

    it.concurrent('should bubbleDown when updated deadline >= parent', () => {
      const heap = new TimerHeap();
      // 构建堆: deadline 顺序 [10, 50, 30, 100, 60, 40, 70]
      const timers = [10, 50, 30, 100, 60, 40, 70].map((d) =>
        createTimer(heap, d),
      );
      timers.forEach((t) => heap.add(t));

      // 修改 index=1 (deadline=50) 的定时器，使其 deadline >= parent(10) 但需要下沉
      timers[1].deadline = 200;
      heap.update(timers[1].id);

      // 验证堆顶仍然是 timers[0] (deadline=10)
      expect(heap.peek()).toBe(timers[0]);
      // 验证 timers[1] 已经下沉到正确位置
      const sorted = [...timers].sort((a, b) => a.deadline - b.deadline);
      sorted.forEach((expected) => {
        expect(heap.pop()).toBe(expected);
      });
    });
  });

  // ============================================
  // 迭代器
  // ============================================
  describe('iteration', () => {
    it.concurrent('should iterate over values and keys', () => {
      const heap = new TimerHeap();
      const timer1 = createTimer(heap, 100);
      const timer2 = createTimer(heap, 200);
      heap.add(timer1);
      heap.add(timer2);
      const values = [...heap.values()];
      expect(values).toHaveLength(2);
      expect(values).toContain(timer1);
      expect(values).toContain(timer2);
      const keys = [...heap.keys()];
      expect(keys).toHaveLength(2);
      expect(keys).toContain(timer1.id);
      expect(keys).toContain(timer2.id);
    });
  });

  // ============================================
  // ID 分配
  // ============================================
  describe('id allocation', () => {
    it.concurrent('should reuse freed ids', () => {
      const heap = new TimerHeap();
      const id1 = heap.allocId();
      heap.add({...createTimer(heap, 100), id: id1});
      heap.remove(id1);
      const id2 = heap.allocId();
      expect(id2).toBe(id1);
    });
  });

  // ============================================
  // 边界情况覆盖
  // ============================================
  describe('coverage edge cases', () => {
    it.concurrent('should handle peek with undefined id', () => {
      const heap = new TimerHeap();
      heap['heap'].push(999);
      expect(heap.peek()).toBeNull();
    });

    it.concurrent(
      'should handle bubbleDown with various child configurations',
      () => {
        const heap = new TimerHeap();
        // 右子节点更小
        const timer1 = createTimer(heap, 50);
        const timer2 = createTimer(heap, 60);
        const timer3 = createTimer(heap, 55);
        const timer4 = createTimer(heap, 70);
        const timer5 = createTimer(heap, 65);
        heap.add(timer1);
        heap.add(timer2);
        heap.add(timer3);
        heap.add(timer4);
        heap.add(timer5);
        heap.pop();
        expect(heap.peek()).toBe(timer3);
      },
    );

    it.concurrent('should handle bubbleDown with both children larger', () => {
      const heap = new TimerHeap();
      const timer1 = createTimer(heap, 50);
      const timer2 = createTimer(heap, 100);
      const timer3 = createTimer(heap, 150);
      heap.add(timer1);
      heap.add(timer2);
      heap.add(timer3);
      heap.pop();
      expect(heap.peek()).toBe(timer2);
    });

    it.concurrent('should handle keys with gaps in timer array', () => {
      const heap = new TimerHeap();
      const timer1 = createTimer(heap, 100);
      const timer2 = createTimer(heap, 200);
      heap.add(timer1);
      heap.add(timer2);
      heap.remove(timer1.id);
      const keys = [...heap.keys()];
      expect(keys).toEqual([timer2.id]);
    });
  });
});
