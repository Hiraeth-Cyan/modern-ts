// ========================================
// ./src/MockClock/TimerHeap.ts
// ========================================

import type {Timer} from './types';

// 最小堆实现，用于按 deadline 顺序管理定时器
export class TimerHeap {
  private heap: number[] = [];
  private readonly timers: (Timer | null)[] = [];

  private free_ids: number[] = [];
  private id_seq: number = 1;

  public get size(): number {
    return this.heap.length;
  }

  public isEmpty(): boolean {
    return this.heap.length === 0;
  }

  // 查看堆顶定时器（不移除）
  public peek(): Timer | null {
    const id = this.heap[0];
    return id !== undefined ? (this.timers[id] ?? null) : null;
  }

  // 分配一个新的定时器 ID，优先复用已释放的 ID
  public allocId(): number {
    return this.free_ids.length > 0 ? this.free_ids.pop()! : this.id_seq++;
  }

  // 添加定时器到堆中
  public add(timer: Timer): void {
    const idx = this.heap.length;
    timer.heap_index = idx;
    this.heap.push(timer.id);
    this.timers[timer.id] = timer;
    this.bubbleUp(idx);
  }

  // 从堆中移除指定 ID 的定时器
  public remove(id: number): Timer | null {
    const timer = this.timers[id];
    if (!timer) return null;

    const index = timer.heap_index;
    const last_id = this.heap.pop()!;

    // 如果移除的是最后一个元素，直接返回
    if (index >= this.heap.length) {
      this.timers[id] = null;
      this.free_ids.push(id);
      return timer;
    }

    // 用最后一个元素填补空位，然后调整堆
    this.heap[index] = last_id;
    const last_timer = this.timers[last_id]!;
    last_timer.heap_index = index;

    if (index > 0) {
      const parent_idx = (index - 1) >> 1;
      if (last_timer.deadline < this.timers[this.heap[parent_idx]]!.deadline) {
        this.bubbleUp(index);
      } else {
        this.bubbleDown(index);
      }
    } else {
      this.bubbleDown(index);
    }

    this.timers[id] = null;
    this.free_ids.push(id);
    return timer;
  }

  // 弹出堆顶定时器
  public pop(): Timer | null {
    if (this.heap.length === 0) return null;

    const top_id = this.heap[0];
    const top_timer = this.timers[top_id]!;
    const last_id = this.heap.pop()!;

    if (this.heap.length > 0) {
      this.heap[0] = last_id;
      const last_timer = this.timers[last_id]!;
      last_timer.heap_index = 0;
      this.bubbleDown(0);
    }

    this.timers[top_id] = null;
    this.free_ids.push(top_id);
    return top_timer;
  }

  // 根据 ID 获取定时器
  public get(id: number): Timer | undefined {
    return this.timers[id] ?? undefined;
  }

  // 更新定时器位置（deadline 变化后调用）
  public update(id: number): void {
    const timer = this.timers[id];
    if (!timer) return;

    const idx = timer.heap_index;
    if (idx > 0) {
      const parent = this.timers[this.heap[(idx - 1) >> 1]]!;
      if (timer.deadline < parent.deadline) {
        this.bubbleUp(idx);
        return;
      }
    }
    this.bubbleDown(idx);
  }

  // 清空堆
  public clear(): void {
    this.heap = [];
    this.timers.length = 0;
    this.free_ids.length = 0;
    this.id_seq = 1;
  }

  // 遍历所有定时器
  public values(): IterableIterator<Timer> {
    return this.timers.filter((t): t is Timer => t !== null)[Symbol.iterator]();
  }

  // 遍历所有定时器 ID
  public keys(): IterableIterator<number> {
    return this.timers
      .map((t, i) => (t !== null ? i : null))
      .filter((i): i is number => i !== null)
      [Symbol.iterator]();
  }

  // 上浮操作：将元素向上调整到正确位置
  private bubbleUp(index: number): void {
    const heap = this.heap;
    const timers = this.timers;
    const node_id = heap[index];
    const node = timers[node_id]!;

    while (index > 0) {
      const parent_idx = (index - 1) >> 1;
      const parent_id = heap[parent_idx];
      const parent = timers[parent_id]!;

      if (parent.deadline <= node.deadline) break;

      heap[index] = parent_id;
      parent.heap_index = index;
      index = parent_idx;
    }

    heap[index] = node_id;
    node.heap_index = index;
  }

  // 下沉操作：将元素向下调整到正确位置
  private bubbleDown(index: number): void {
    const heap = this.heap;
    const timers = this.timers;
    const length = heap.length;
    const node_id = heap[index];
    const node = timers[node_id]!;

    while (true) {
      const left_idx = (index << 1) + 1;
      const right_idx = left_idx + 1;
      let smallest_idx = index;

      if (left_idx < length) {
        const left_timer = timers[heap[left_idx]]!;
        if (left_timer.deadline < node.deadline) {
          smallest_idx = left_idx;
        }
      }

      if (right_idx < length) {
        const right_timer = timers[heap[right_idx]]!;
        const smallest_timer =
          smallest_idx === index ? node : timers[heap[smallest_idx]]!;

        if (right_timer.deadline < smallest_timer.deadline) {
          smallest_idx = right_idx;
        }
      }

      if (smallest_idx === index) break;

      const child_id = heap[smallest_idx];
      heap[index] = child_id;
      timers[child_id]!.heap_index = index;
      index = smallest_idx;
    }

    heap[index] = node_id;
    node.heap_index = index;
  }
}
