// ============================================
// ./src/Other/queue.ts
// ============================================

/**
 * A FIFO (First-In-First-Out) queue implementation
 * Uses circular buffer optimization to avoid O(n) shift operations
 * @template T The type of elements stored in the queue
 * @note It is recommended not to store `null` values in this queue, as `null` is used
 * by `peek()` and `dequeue()` to indicate an empty queue.
 * Storing `null` makes it impossible to distinguish between "queue is empty" and "actual null value stored".
 */
export class Queue<T> {
  private queue_data: T[] = [];
  private head_idx = 0;

  /**
   * Returns the number of elements in the queue
   */
  public get size(): number {
    return this.queue_data.length - this.head_idx;
  }

  /**
   * Checks if the queue is empty
   */
  public isEmpty(): boolean {
    return this.head_idx >= this.queue_data.length;
  }

  /**
   * Returns the front element without removing it
   * @returns The front element, or null if queue is empty
   */
  public peek(): T | null {
    return this.queue_data[this.head_idx] ?? null;
  }

  /**
   * Adds an element to the back of the queue
   */
  public enqueue(item: T): void {
    this.queue_data.push(item);
  }

  /**
   * Removes and returns the front element from the queue
   * @returns The front element, or null if queue is empty
   */
  public dequeue(): T | null {
    if (this.isEmpty()) return null;
    const item = this.queue_data[this.head_idx];
    this.head_idx++;

    // 当数组前半部分浪费空间超过一半时，裁剪数组以防止内存泄漏
    if (this.head_idx > this.queue_data.length / 2) {
      this.queue_data.splice(0, this.head_idx);
      this.head_idx = 0;
    }

    return item;
  }

  /**
   * Removes all elements from the queue
   */
  public clear(): void {
    this.queue_data.length = 0;
    this.head_idx = 0;
  }

  /**
   * Converts the queue to an array (front element at index 0)
   */
  public toArray(): T[] {
    return this.queue_data.slice(this.head_idx);
  }
}
