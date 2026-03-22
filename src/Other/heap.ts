// ============================================
// ./src/Other/heap.ts
// ============================================

/**
 * A binary heap implementation with customizable comparison function
 * Supports O(log n) push and pop operations
 * @template T The type of elements stored in the heap
 * @note It is recommended not to store `null` values in this heap, as `null` is used
 * by `peek()` and `pop()` to indicate an empty heap.
 * Storing `null` makes it impossible to distinguish between "heap is empty" and "actual null value stored".
 */
export class Heap<T> {
  private heap_data: T[] = [];
  private readonly comparer: (a: T, b: T) => number;

  /**
   * Creates a new heap with the specified comparison function
   * @param comparer A comparison function that returns negative if a < b, zero if a === b, positive if a > b
   */
  constructor(comparer: (a: T, b: T) => number) {
    this.comparer = comparer;
  }

  /**
   * Returns the number of elements in the heap
   */
  public get size(): number {
    return this.heap_data.length;
  }

  /**
   * Checks if the heap is empty
   */
  public isEmpty(): boolean {
    return this.heap_data.length === 0;
  }

  /**
   * Returns the top element without removing it
   * @returns The top element, or null if heap is empty
   */
  public peek(): T | null {
    return this.heap_data[0] ?? null;
  }

  /**
   * Adds an element to the heap
   */
  public push(item: T): void {
    this.heap_data.push(item);
    this.siftUp(this.heap_data.length - 1);
  }

  /**
   * Removes and returns the top element from the heap
   * @returns The top element, or null if heap is empty
   */
  public pop(): T | null {
    if (this.heap_data.length === 0) return null;
    const top = this.heap_data[0];
    const last = this.heap_data.pop()!;

    if (this.heap_data.length > 0) {
      this.heap_data[0] = last;
      this.siftDown(0);
    }
    return top;
  }

  // -- 向上调整，维护堆性质 --
  private siftUp(idx: number): void {
    const item = this.heap_data[idx];
    while (idx > 0) {
      const parent = (idx - 1) >> 1;
      if (this.comparer(item, this.heap_data[parent]) >= 0) break;
      this.heap_data[idx] = this.heap_data[parent];
      idx = parent;
    }
    this.heap_data[idx] = item;
  }

  // -- 向下调整，维护堆性质 --
  private siftDown(idx: number): void {
    const len = this.heap_data.length;
    const item = this.heap_data[idx];
    while (true) {
      const left = (idx << 1) + 1;
      const right = left + 1;
      let smallest = idx;

      if (left < len && this.comparer(this.heap_data[left], item) < 0)
        smallest = left;

      if (
        right < len &&
        this.comparer(this.heap_data[right], this.heap_data[smallest]) < 0
      )
        smallest = right;

      if (smallest === idx) break;
      this.heap_data[idx] = this.heap_data[smallest];
      idx = smallest;
    }
    this.heap_data[idx] = item;
  }
}
