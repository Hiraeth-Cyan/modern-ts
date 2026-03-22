// ========================================
// ./src/Concurrent/Valve/token-bucket.ts
// ========================================

import {ensureDOMException} from '../../unknown-error';
import {ParameterError} from '../../Errors';
import {delaySafe} from '../delay';

// -- 常量定义 --

// setTimeout 最大延迟值（约 24.8 天），超过此值会导致溢出
const MAX_SET_TIMEOUT_DELAY = 2147483647;

// -- 类型定义 --

/**
 * Token bucket rate limit configuration.
 */
export interface TokenBucketConfig {
  /** Maximum number of tokens the bucket can hold */
  limit: number;
  /** Time interval in milliseconds to refill the bucket to capacity */
  interval: number;
}

// ============================================
// TokenBucket
// ============================================

/**
 * Token bucket algorithm implementation for rate limiting.
 * Supports dynamic rate adjustment, weighted waiting, and AbortSignal cancellation.
 * Uses a "pre-deduction" pattern to ensure fairness among concurrent requests.
 *
 * @example
 * ```ts
 * const bucket = new TokenBucket({limit: 10, interval: 1000}); // 10 tokens per second
 * await bucket.wait(); // Wait for 1 token
 * await bucket.wait(5); // Wait for 5 tokens
 * ```
 */
export class TokenBucket {
  private tokens: number;
  private last_refill_time: number;
  private max_tokens: number;
  // 每毫秒产生的令牌数
  private refill_rate: number;

  /* v8 ignore next -- @preserve */
  private static getTime = (() => {
    return typeof performance !== 'undefined'
      ? performance.now.bind(performance)
      : Date.now;
  })();

  /**
   * Creates a new TokenBucket instance.
   *
   * @param config - The rate limit configuration
   * @throws ParameterError if limit or interval is invalid
   */
  constructor(config: TokenBucketConfig) {
    const {limit, interval} = config;

    if (
      !Number.isFinite(limit) ||
      limit <= 0 ||
      limit > Number.MAX_SAFE_INTEGER
    ) {
      const reason =
        limit > Number.MAX_SAFE_INTEGER
          ? `must be less than or equal to Number.MAX_SAFE_INTEGER (${Number.MAX_SAFE_INTEGER}) to ensure precision`
          : `must be a positive finite number`;
      throw new ParameterError(
        `TokenBucket: \`limit\` ${reason}, but got ${limit}`,
      );
    }
    if (!Number.isFinite(interval) || interval <= 0)
      throw new ParameterError(
        `TokenBucket: \`interval\` must be a positive finite number, but got ${interval}`,
      );

    const refill_rate = limit / interval;

    // 检查 refill_rate 是否过大，防止 interval 过小导致限流失效
    if (!Number.isFinite(refill_rate) || refill_rate > limit)
      throw new ParameterError(
        `TokenBucket: \`interval\` (${interval}) is too small, causing \`refill_rate\` (${refill_rate}) to exceed \`limit\` (${limit}). Use a larger interval value.`,
      );

    // 所有校验通过后，再赋值，确保状态一致性
    this.max_tokens = limit;
    this.refill_rate = refill_rate;
    this.tokens = limit;
    this.last_refill_time = TokenBucket.getTime();
  }

  // ============================================
  // Public API
  // ============================================

  /**
   * Resets the rate limit configuration.
   *
   * @param limit - The new token capacity limit
   * @param interval - The new refill interval in milliseconds
   */
  public resetRate(config: TokenBucketConfig): void {
    const {limit, interval} = config;
    if (
      !Number.isFinite(limit) ||
      limit <= 0 ||
      limit > Number.MAX_SAFE_INTEGER
    ) {
      const reason =
        limit > Number.MAX_SAFE_INTEGER
          ? `must be less than or equal to Number.MAX_SAFE_INTEGER (${Number.MAX_SAFE_INTEGER}) to ensure precision`
          : `must be a positive finite number`;
      throw new ParameterError(
        `TokenBucket: \`limit\` ${reason}, but got ${limit}`,
      );
    }
    if (!Number.isFinite(interval) || interval <= 0)
      throw new ParameterError(
        `TokenBucket: \`interval\` must be a positive finite number, but got ${interval}`,
      );

    const refill_rate = limit / interval;

    // 检查 refill_rate 是否过大，防止 interval 过小导致限流失效
    if (!Number.isFinite(refill_rate) || refill_rate > limit)
      throw new ParameterError(
        `TokenBucket: \`interval\` (${interval}) is too small, causing \`refill_rate\` (${refill_rate}) to exceed \`limit\` (${limit}). Use a larger interval value.`,
      );

    // 所有校验通过后，先按旧速率补充令牌，保留当前累积的进度
    this.refill();

    this.max_tokens = limit;
    this.refill_rate = refill_rate;

    // 如果当前令牌数超过新上限，需截断；若为负数（欠债）则保持不变
    if (this.tokens > this.max_tokens) this.tokens = this.max_tokens;
  }

  /**
   * Waits until the specified number of tokens can be acquired.
   *
   * Algorithm: Deduct tokens immediately (creating debt if necessary), then wait for the debt to be cleared.
   * This "pre-deduction" pattern prevents subsequent requests from cutting in line,
   * ensuring fair processing order among concurrent requests.
   *
   * @param weight - The number of tokens to consume (default: 1)
   * @param signal - Optional AbortSignal for cancellation
   * @throws {DOMException} If the signal is aborted
   */
  public async wait(weight: number = 1, signal?: AbortSignal): Promise<void> {
    if (!Number.isFinite(weight) || weight <= 0)
      throw new ParameterError(
        `TokenBucket: \`weight\` must be a positive finite number, but got ${weight}`,
      );
    if (weight > this.max_tokens)
      throw new ParameterError(
        `TokenBucket: \`weight\` (${weight}) cannot exceed \`max_tokens\` (${this.max_tokens}).`,
      );

    if (signal?.aborted) throw ensureDOMException(signal.reason);

    // 补充令牌并立即扣除（允许变负数，实现预占）
    this.refill();
    this.tokens -= weight;

    // 循环等待直到令牌充足（支持动态速率调整）
    while (this.tokens < 0) {
      const deficit = -this.tokens;
      const required_wait = Math.ceil(deficit / this.refill_rate);
      const wait_time = Math.min(required_wait, MAX_SET_TIMEOUT_DELAY);

      const abort_result = await delaySafe(wait_time, signal);
      if (abort_result) {
        // 被中止时，回滚之前扣除的令牌
        this.tokens += weight;
        throw abort_result;
      }
      this.refill();
    }
  }

  /**
   * Returns the current state statistics of the token bucket.
   */
  public get stats() {
    this.refill();
    return {
      tokens: this.tokens,
      max_tokens: this.max_tokens,
      refill_rate: this.refill_rate,
      last_refill_time: this.last_refill_time,
    };
  }

  // ============================================
  // Private Methods
  // ============================================

  /**
   * Refills tokens based on elapsed time.
   * Core state update logic that aligns the bucket state with the current time.
   */
  private refill(): void {
    const now = TokenBucket.getTime();
    const delta = now - this.last_refill_time;

    // 处理时钟回拨或无时间流逝的情况
    if (delta <= 0) {
      if (delta < 0) this.last_refill_time = now;
      return;
    }

    // 桶已满，仅更新时间戳
    if (this.tokens >= this.max_tokens) {
      this.last_refill_time = now;
      return;
    }

    // 补充令牌（支持从负数债务恢复）
    const added_tokens = delta * this.refill_rate;
    this.tokens += added_tokens;

    this.tokens = Math.min(this.tokens, this.max_tokens);
    this.last_refill_time = now;
  }
}
