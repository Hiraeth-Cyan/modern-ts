// ========================================
// ./src/Concurrent/Valve/sliding-window.ts
// ========================================

import {ensureDOMException} from '../../unknown-error';
import {ParameterError} from '../../Errors';
import {delaySafe} from '../delay';

// -- 常量定义 --

// setTimeout 最大延迟值（约 24.8 天），超过此值会导致溢出
const MAX_SET_TIMEOUT_DELAY = 2147483647;

/**
 * Sliding window rate limit configuration.
 */
export interface SlidingWindowConfig {
  /** Maximum number of requests the bucket can hold */
  limit: number;
  /** Time interval in milliseconds to refill the bucket to capacity */
  window_size: number;
}

// ============================================
// SlidingWindow
// ============================================

/**
 * Sliding window rate limiter implementation.
 *
 * Unlike TokenBucket (which allows bursting) or LeakyBucket (which enqueues requests),
 * SlidingWindow tracks actual request timestamps within a time window and rejects
 * requests that would exceed the limit. This provides precise control over the
 * maximum number of requests in any given time period.
 *
 * The implementation uses a circular buffer to efficiently store request timestamps
 * and automatically cleans up expired entries.
 *
 * @example
 * ```ts
 * const limiter = new SlidingWindow(100, 60000); // 100 requests per minute
 * if (await limiter.tryAcquire()) {
 *   await processRequest();
 * }
 * ```
 */
export class SlidingWindow {
  private limit: number;
  private window_size: number;
  // 使用循环缓冲区存储请求时间戳
  private timestamps: Array<number>;
  private head: number = 0;
  private count: number = 0;


  constructor(options: SlidingWindowConfig) {
    const {limit, window_size} = options;
    if (!Number.isFinite(limit) || limit <= 0 || !Number.isInteger(limit))
      throw new ParameterError(
        `SlidingWindow: \`limit\` must be a positive integer, but got ${limit}`,
      );

    if (!Number.isFinite(window_size) || window_size <= 0)
      throw new ParameterError(
        `SlidingWindow: \`window_size\` must be a positive finite number, but got ${window_size}`,
      );

    this.limit = limit;
    this.window_size = window_size;
    this.timestamps = new Array<number>(limit);
  }

  // ============================================
  // Public API
  // ============================================

  /**
   * Resets the rate limit configuration.
   *
   * @param options - Configuration options
   * @param options.limit - The new request limit (must be positive integer)
   * @param options.window_size - The new window size in milliseconds
   */
  public resetRate(options: SlidingWindowConfig): void {
    const {limit, window_size} = options;
    if (!Number.isFinite(limit) || limit <= 0 || !Number.isInteger(limit))
      throw new ParameterError(
        `SlidingWindow: \`limit\` must be a positive integer, but got ${limit}`,
      );
    if (!Number.isFinite(window_size) || window_size <= 0)
      throw new ParameterError(
        `SlidingWindow: \`window_size\` must be a positive finite number, but got ${window_size}`,
      );

    this.limit = limit;
    this.window_size = window_size;

    // 重新分配缓冲区（如果大小变化）
    if (this.timestamps.length !== limit) {
      const old_timestamps = this.timestamps;
      const old_count = this.count;
      const old_head = this.head;
      const old_limit = old_timestamps.length;

      this.timestamps = new Array<number>(limit);

      const now = performance.now();
      const window_start = now - this.window_size;

      // 从新到旧筛选，确保保留最有效的请求
      const valid_timestamps: number[] = [];

      // 从最新的请求（head-1）开始向后遍历
      for (let i = 1; i <= old_count; i++) {
        const idx = (old_head - i + old_limit) % old_limit;
        const ts = old_timestamps[idx];

        // 只有没过期的才考虑，且不能超过新容量限制
        if (ts > window_start) {
          valid_timestamps.push(ts);
        }

        if (valid_timestamps.length >= limit) break;
      }

      // 因为是倒序取出的，我们要反转一下再存入新缓冲区，保持时间顺序
      valid_timestamps.reverse();

      this.count = valid_timestamps.length;
      for (let i = 0; i < this.count; i++) {
        this.timestamps[i] = valid_timestamps[i];
      }

      this.head = this.count % limit;
    }
  }

  /**
   * Attempts to acquire a slot in the sliding window.
   * Returns immediately with a boolean indicating success.
   *
   * @param weight - The cost of the request (default: 1)
   * @returns true if the request is allowed, false if it would exceed the limit
   */
  public tryAcquire(weight: number = 1): boolean {
    if (!Number.isFinite(weight) || weight <= 0 || !Number.isInteger(weight))
      throw new ParameterError(
        `SlidingWindow: \`weight\` must be a positive integer, but got ${weight}`,
      );
    if (weight > this.limit)
      throw new ParameterError(
        `SlidingWindow: \`weight\` (${weight}) cannot exceed \`limit\` (${this.limit}).`,
      );

    const now = performance.now();
    const window_start = now - this.window_size;

    // 清理过期的时间戳
    this.cleanExpired(window_start);

    // 检查是否还有空间
    if (this.count + weight > this.limit) return false;

    // 记录请求时间戳（支持 weight > 1）
    for (let i = 0; i < weight; i++) this.recordTimestamp(now);

    return true;
  }

  /**
   * Waits until a slot becomes available in the sliding window.
   *
   * @param weight - The cost of the request (default: 1)
   * @param signal - Optional AbortSignal for cancellation
   * @throws {DOMException} If the signal is aborted
   */
  public async wait(weight: number = 1, signal?: AbortSignal): Promise<void> {
    if (!Number.isFinite(weight) || weight <= 0 || !Number.isInteger(weight))
      throw new ParameterError(
        `SlidingWindow: \`weight\` must be a positive integer, but got ${weight}`,
      );
    if (weight > this.limit)
      throw new ParameterError(
        `SlidingWindow: \`weight\` (${weight}) cannot exceed \`limit\` (${this.limit}).`,
      );

    if (signal?.aborted) throw ensureDOMException(signal.reason);

    while (true) {
      const now = performance.now();
      const window_start = now - this.window_size;

      // 清理过期的时间戳
      this.cleanExpired(window_start);

      // 如果有足够空间，立即获取
      if (this.count + weight <= this.limit) {
        for (let i = 0; i < weight; i++) this.recordTimestamp(now);
        return;
      }

      // 计算最早过期的时间戳
      // 注意：执行到这里时 count >= 1（因为 count + weight > limit 且 weight >= 1）
      const oldest_timestamp = this.getOldestTimestamp();

      // 计算需要等待的时间
      // 注意：由于 cleanExpired 已清理过期时间戳，oldest_timestamp > window_start
      // 因此 wait_time > 0，无需检查
      const wait_time = oldest_timestamp + this.window_size - now;

      const actual_wait = Math.min(wait_time, MAX_SET_TIMEOUT_DELAY);
      const abort_result = await delaySafe(actual_wait, signal);
      if (abort_result) throw abort_result;
    }
  }

  /**
   * Returns the number of available slots in the current window.
   */
  public get available(): number {
    const now = performance.now();
    const window_start = now - this.window_size;
    this.cleanExpired(window_start);
    return this.limit - this.count;
  }

  /**
   * Returns the current number of requests in the window.
   */
  public get current(): number {
    const now = performance.now();
    const window_start = now - this.window_size;
    this.cleanExpired(window_start);
    return this.count;
  }

  /**
   * Returns the current state statistics of the sliding window.
   */
  public get stats() {
    const now = performance.now();
    const window_start = now - this.window_size;

    this.cleanExpired(window_start);

    return {
      limit: this.limit,
      window_size: this.window_size,
      count: this.count,
      available: this.limit - this.count,
      head: this.head,
    };
  }

  // ============================================
  // Private Methods
  // ============================================

  /**
   * 清理过期的时间戳
   */
  private cleanExpired(window_start: number): void {
    while (this.count > 0) {
      const idx = (this.head - this.count + this.limit) % this.limit;
      if (this.timestamps[idx] > window_start) break;
      this.count--;
    }
  }

  /**
   * 记录请求时间戳
   */
  private recordTimestamp(timestamp: number): void {
    const idx = this.head;
    this.timestamps[idx] = timestamp;
    this.head = (this.head + 1) % this.limit;
    this.count++;
  }

  /**
   * 获取最早的时间戳
   * 前置条件：count >= 1（由调用方保证）
   */
  private getOldestTimestamp(): number {
    const idx = (this.head - this.count + this.limit) % this.limit;
    return this.timestamps[idx];
  }
}
