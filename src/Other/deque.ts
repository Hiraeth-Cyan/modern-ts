// ============================================
// ./src/Other/deque.ts
// ============================================

/**
 * A double-ended queue (deque) implementation using circular buffer
 * Supports O(1) operations at both ends
 * @template T The type of elements stored in the deque
 * @note It is recommended not to store `null` values in this deque, as `null` is used
 * by `peekFront()`, `peekBack()`, `popFront()`, and `popBack()` to indicate an empty deque.
 * Storing `null` makes it impossible to distinguish between "deque is empty" and "actual null value stored".
 */
export class Deque<T> {
  private buffer: (T | undefined)[] = new Array<T | undefined>(16);
  private head_idx = 0;
  private tail_idx = 0;
  private count = 0;

  /**
   * Returns the number of elements in the deque
   */
  public get size(): number {
    return this.count;
  }

  /**
   * Checks if the deque is empty
   */
  public isEmpty(): boolean {
    return this.count === 0;
  }

  /**
   * Returns the front element without removing it
   * @returns The front element, or null if deque is empty
   */
  public peekFront(): T | null {
    if (this.isEmpty()) return null;
    return this.buffer[this.head_idx] as T;
  }

  /**
   * Returns the back element without removing it
   * @returns The back element, or null if deque is empty
   */
  public peekBack(): T | null {
    if (this.isEmpty()) return null;
    const back_idx =
      (this.tail_idx - 1 + this.buffer.length) % this.buffer.length;
    return this.buffer[back_idx] as T;
  }

  /**
   * Adds an element to the front of the deque
   */
  public pushFront(item: T): void {
    this.ensureCapacity();
    this.head_idx =
      (this.head_idx - 1 + this.buffer.length) % this.buffer.length;
    this.buffer[this.head_idx] = item;
    this.count++;
  }

  /**
   * Adds an element to the back of the deque
   */
  public pushBack(item: T): void {
    this.ensureCapacity();
    this.buffer[this.tail_idx] = item;
    this.tail_idx = (this.tail_idx + 1) % this.buffer.length;
    this.count++;
  }

  /**
   * Removes and returns the front element from the deque
   * @returns The front element, or null if deque is empty
   */
  public popFront(): T | null {
    if (this.isEmpty()) return null;
    const item = this.buffer[this.head_idx] as T;
    this.buffer[this.head_idx] = undefined;
    this.head_idx = (this.head_idx + 1) % this.buffer.length;
    this.count--;
    return item;
  }

  /**
   * Removes and returns the back element from the deque
   * @returns The back element, or null if deque is empty
   */
  public popBack(): T | null {
    if (this.isEmpty()) return null;
    this.tail_idx =
      (this.tail_idx - 1 + this.buffer.length) % this.buffer.length;
    const item = this.buffer[this.tail_idx] as T;
    this.buffer[this.tail_idx] = undefined;
    this.count--;
    return item;
  }

  /**
   * Removes all elements from the deque
   */
  public clear(): void {
    // 清空引用以便垃圾回收
    for (let i = 0; i < this.buffer.length; i++) this.buffer[i] = undefined;
    this.head_idx = 0;
    this.tail_idx = 0;
    this.count = 0;
  }

  /**
   * Converts the deque to an array (front element at index 0)
   */
  public toArray(): T[] {
    const result = new Array<T>(this.count);
    for (let i = 0; i < this.count; i++) {
      const idx = (this.head_idx + i) % this.buffer.length;
      result[i] = this.buffer[idx] as T;
    }
    return result;
  }

  // -- 当缓冲区满时，扩容为原来的 2 倍 --
  private ensureCapacity(): void {
    if (this.count === this.buffer.length) {
      const old_capacity = this.buffer.length;
      const new_capacity = old_capacity * 2;
      const new_buffer = new Array<T | undefined>(new_capacity);

      // 将元素按顺序复制到新缓冲区
      for (let i = 0; i < this.count; i++) {
        const old_idx = (this.head_idx + i) % old_capacity;
        new_buffer[i] = this.buffer[old_idx];
      }

      this.buffer = new_buffer;
      this.head_idx = 0;
      this.tail_idx = this.count;
    }
  }
}
