// ============================================
// ./src/Other/stack.ts
// ============================================

/**
 * A LIFO (Last-In-First-Out) stack implementation
 * @template T The type of elements stored in the stack
 * @note It is recommended not to store `null` values in this stack, as `null` is used
 * by `peek()` and `pop()` to indicate an empty stack.
 * Storing `null` makes it impossible to distinguish between "stack is empty" and "actual null value stored".
 */
export class Stack<T> {
  private stack_data: T[] = [];

  /**
   * Returns the number of elements in the stack
   */
  public get size(): number {
    return this.stack_data.length;
  }

  /**
   * Checks if the stack is empty
   */
  public isEmpty(): boolean {
    return this.stack_data.length === 0;
  }

  /**
   * Returns the top element without removing it
   * @returns The top element, or null if stack is empty
   */
  public peek(): T | null {
    return this.stack_data[this.stack_data.length - 1] ?? null;
  }

  /**
   * Pushes an element onto the top of the stack
   */
  public push(item: T): void {
    this.stack_data.push(item);
  }

  /**
   * Removes and returns the top element from the stack
   * @returns The top element, or null if stack is empty
   */
  public pop(): T | null {
    return this.stack_data.pop() ?? null;
  }

  /**
   * Removes all elements from the stack
   */
  public clear(): void {
    this.stack_data.length = 0;
  }

  /**
   * Converts the stack to an array (top element at the end)
   */
  public toArray(): T[] {
    return [...this.stack_data];
  }
}
