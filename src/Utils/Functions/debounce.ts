// ========================================
// ./src/Utils/Functions/debounce.ts
// ========================================
import {ParameterError} from '../../Errors';

/**
 * Symbol indicating that the debounced function call was skipped
 */
export const SKIPPED = Symbol('skipped');

/**
 * Type representing a skipped debounced function call
 */
export type Skipped = typeof SKIPPED;

/**
 * Symbol indicating that requestAnimationFrame should be used for timing
 */
export const useRAF = Symbol('requestAnimationFrame');

/**
 * A debouncer class that controls the rate at which a function is executed
 *
 * @template A - The argument types of the debounced function
 * @template R - The return type of the debounced function
 *
 * @example
 * ```typescript
 * const debounced = new Debounced(
 *   (x: number) => console.log(x),
 *   100,
 *   false,
 *   true
 * );
 * ```
 */
export class Debounced<A extends readonly unknown[], R> {
  private fn: ((...args: A) => R) | null;

  // 状态跟踪
  private last_args: A | null = null;
  private last_this: ThisParameterType<typeof this.fn> = null;
  private result_: R | Skipped = SKIPPED;
  private timer_id: ReturnType<typeof setTimeout> | number | null = null;
  private last_call_time = 0;
  private last_invoke_time = 0;

  /* v8 ignore next -- @preserve */
  private static getTime = (() => {
    return typeof performance !== 'undefined'
      ? performance.now.bind(performance)
      : Date.now;
  })();

  /**
   * Creates a new Debounced instance
   *
   * @param fn - The function to debounce
   * @param wait - The number of milliseconds to wait, or useRAF for animation frame timing
   * @param leading - Whether to invoke the function on the leading edge of the timeout
   * @param trailing - Whether to invoke the function on the trailing edge of the timeout
   * @param max_wait - The maximum time the function is allowed to be delayed before it's invoked
   *
   * @throws {ParameterError} If parameters are invalid or incompatible
   *
   * @example
   * ```typescript
   * const debounced = new Debounced(
   *   (searchTerm: string) => fetchResults(searchTerm),
   *   300,
   *   false,
   *   true,
   *   1000
   * );
   * ```
   */
  constructor(
    fn: (...args: A) => R,
    private readonly wait: number | typeof useRAF,
    private readonly leading: boolean = false,
    private readonly trailing: boolean = true,
    private readonly max_wait?: number,
  ) {
    // 检查环境对 requestAnimationFrame 的支持
    /* v8 ignore next -- @preserve */
    if (wait === useRAF && typeof requestAnimationFrame !== 'function')
      throw new ParameterError(
        `Error: wait = useRAF, But the environment does not support requestAnimationFrame.`,
      );

    // RAF由浏览器调度，不支持max_wait
    /* v8 ignore next -- @preserve */
    if (wait === useRAF && max_wait != null)
      throw new ParameterError(
        `Error: maxWait cannot be used when wait is set to useRAF.`,
      );

    // 检查 wait 是否有效
    if (wait !== useRAF && (wait < 0 || !Number.isFinite(wait))) {
      throw new ParameterError(
        `Error: wait = ${wait} < 0 or is not a finite number.`,
      );
    }
    // 检查 max_wait 是否有效（如果存在的话）
    if (
      max_wait != null &&
      (!Number.isFinite(max_wait) ||
        max_wait <= 0 ||
        (wait !== useRAF && max_wait < wait))
    ) {
      throw new ParameterError(
        `Error: maxWait (${max_wait}) must be positive and at least the value of wait (${String(wait)}).`,
      );
    }
    // 检查 leading 和 trailing 是否逻辑闭环
    if (!leading && !trailing) {
      throw new ParameterError(
        `Error: Both leading and trailing are false, which is meaningless.`,
      );
    }
    this.fn = fn;
  }

  /**
   * Gets the result of the last function invocation or SKIPPED if no invocation occurred
   */
  get result() {
    return this.result_;
  }

  /**
   * Checks if there's a pending debounced invocation
   */
  get pending() {
    return this.timer_id !== null;
  }

  private invokeFunc(time: number) {
    const args = this.last_args;
    if (args === null) {
      this.result_ = SKIPPED;
      return;
    }

    const this_arg = this.last_this;

    this.clearTimers();
    this.last_args = this.last_this = null;
    this.last_invoke_time = time;

    this.result_ = this.fn!.call(this_arg, ...args);
  }

  private shouldInvoke(time: number) {
    // 第一次调用
    if (this.last_call_time === 0) return true;

    // RAF期间，不允许Call
    /* v8 ignore if -- @preserve */
    if (this.wait === useRAF) return this.timer_id === null;

    const time_since_last_call = time - this.last_call_time;

    // 超过等待时间
    if (time_since_last_call >= this.wait) return true;

    // 超过最大等待时间（如果设置了）
    if (this.max_wait) {
      // 计算距离上次执行的时间
      const time_since_last_invoke = time - this.last_invoke_time;
      if (time_since_last_invoke >= this.max_wait) return true;
    }

    // 时间倒流（系统时间被调整）
    if (time_since_last_call < 0) return true;

    return false;
  }

  private remainingWait(time: number) {
    /* v8 ignore if -- @preserve */
    if (this.wait === useRAF) return 0;

    const time_since_last_call = time - this.last_call_time;
    const wait_remain = this.wait - time_since_last_call;

    // 如果没有 max_wait，直接返回剩余时间
    if (!this.max_wait) return wait_remain;

    // 计算距离上次执行的时间
    const time_since_last_invoke = time - this.last_invoke_time;
    const max_wait_remain = this.max_wait - time_since_last_invoke;

    // 取等待时间和最大等待时间的最小值
    return Math.min(wait_remain, max_wait_remain);
  }

  private static Task<A extends readonly unknown[], R>(
    instance: Debounced<A, R>,
  ) {
    const now = Debounced.getTime();
    // RAF调度到时必须执行
    if (instance.wait === useRAF || instance.shouldInvoke(now)) {
      instance.invokeFunc(now);
    } else {
      // 没到时间就根据剩余时间重新排队
      instance.refreshTimer(instance.remainingWait(now));
    }
  }

  // 刷新计时器
  private refreshTimer(timeout: number | typeof useRAF) {
    this.clearTimers();

    /* v8 ignore if -- @preserve */
    if (this.wait === useRAF) {
      this.timer_id = requestAnimationFrame(() => Debounced.Task(this));
    } else {
      /* eslint-disable-next-line @typescript-eslint/unbound-method */
      this.timer_id = setTimeout(Debounced.Task, timeout as number, this);
    }
  }

  // 移除计时器
  private clearTimers() {
    if (this.timer_id !== null) {
      /* v8 ignore if -- @preserve */
      if (this.wait === useRAF) cancelAnimationFrame(this.timer_id as number);
      else clearTimeout(this.timer_id);

      this.timer_id = null;
    }
  }

  /**
   * Calls the debounced function with the provided context and arguments
   *
   * @param context - The `this` context to use when calling the function
   * @param args - The arguments to pass to the function
   * @returns The result of the function call or SKIPPED if the call was debounced
   *
   * @example
   * ```typescript
   * const result = debounced.call(someObject, arg1, arg2);
   * if (result !== SKIPPED) {
   *   console.log('Function executed:', result);
   * }
   * ```
   */
  public call(
    context: ThisParameterType<typeof this.fn>,
    ...args: A
  ): R | Skipped {
    const now = Debounced.getTime();
    const is_invokable = this.shouldInvoke(now);

    this.last_args = args;
    this.last_this = context;
    this.last_call_time = now;

    // 基准执行时间
    if (this.last_invoke_time === 0) this.last_invoke_time = now;

    // 重置为无结果，确保除非 leading 触发，否则都是 SKIPPED
    this.result_ = SKIPPED;

    if (is_invokable && this.leading) this.invokeFunc(now);

    if (this.trailing) this.refreshTimer(this.remainingWait(now));

    return this.result_;
  }

  /**
   * Cancels any pending invocation of the debounced function
   * Resets all internal state
   */
  public cancel() {
    this.clearTimers();

    this.last_invoke_time = this.last_call_time = 0;
    this.last_args = this.last_this = null;
    this.result_ = SKIPPED;
  }

  /**
   * Immediately invokes any pending debounced invocation and returns the result
   *
   * @returns The result of the function call or SKIPPED if there was nothing to flush
   *
   * @example
   * ```typescript
   * // Force execution of any pending call
   * const result = debounced.flush();
   * ```
   */
  public flush(): R | Skipped {
    // 如果没有计时器，说明没有待执行任务，直接吐出当前缓存的结果
    if (this.timer_id === null) {
      return this.result_;
    }
    // 如果允许后沿触发且有参数
    if (this.trailing && this.last_args !== null) {
      this.invokeFunc(Debounced.getTime());
    } else {
      // 否则仅清理现场
      this.clearTimers();
      return SKIPPED;
    }
    return this.result_;
  }

  /**
   * Disposes of the debounced instance, cleaning up resources
   * Implements the disposable pattern
   */
  [Symbol.dispose]() {
    this.cancel();
    // 消除引用
    this.fn = null;
    this.last_args = null;
    this.last_this = null;
  }
}

/**
 * A debounced function with additional control methods
 *
 * @template A - The argument types of the function
 * @template R - The return type of the function
 * @template T - The `this` type of the function
 */
export type DebouncedFunction<A extends readonly unknown[], R, T> = ((
  this: T,
  ...args: A
) => R | Skipped) & {
  /** Cancels any pending invocation */
  cancel: () => void;
  /** Immediately invokes any pending invocation */
  flush: () => R | Skipped;
  /** Checks if there's a pending invocation */
  pending: () => boolean;
  /** Gets the result of the last invocation */
  result: () => R | Skipped;
  /** Disposes of the debounced function, cleaning up resources */
  [Symbol.dispose]: () => void;
};

/**
 * Creates a debounced function that delays invoking `fn` until after `wait` milliseconds
 * have elapsed since the last time the debounced function was invoked
 *
 * @template A - The argument types of the function
 * @template R - The return type of the function
 *
 * @param fn - The function to debounce
 * @param wait - The number of milliseconds to delay, or useRAF for animation frame timing
 * @param options - Configuration options for debouncing behavior
 * @param options.leading - Whether to invoke on the leading edge of the timeout
 * @param options.trailing - Whether to invoke on the trailing edge of the timeout
 * @param options.maxWait - The maximum time `fn` is allowed to be delayed before it's invoked
 * @param options.useRAF - Use requestAnimationFrame instead of setTimeout for timing
 *
 * @returns A debounced function with control methods
 *
 * @throws {ParameterError} If parameters are invalid or incompatible
 *
 * @example
 * ```typescript
 * const debouncedSearch = createDebounce(
 *   (query: string) => searchAPI(query),
 *   300,
 *   { leading: false, trailing: true, maxWait: 1000 }
 * );
 *
 * // Usage
 * debouncedSearch('hello');
 * debouncedSearch('world');
 *
 * // Control methods
 * debouncedSearch.cancel();
 * debouncedSearch.flush();
 * debouncedSearch.pending();
 * ```
 */
/* v8 ignore next -- @preserve */
export function createDebounce<A extends readonly unknown[], R>(
  fn: (...args: A) => R,
  wait: number,
  options: {
    leading?: boolean;
    trailing?: boolean;
    maxWait?: number;
    useRAF?: boolean;
  } = {
    leading: false,
    trailing: true,
  },
): DebouncedFunction<A, R, ThisParameterType<typeof fn>> {
  const {leading = false, trailing = true, maxWait, useRAF: use_raf} = options;
  const wait_time = use_raf ? useRAF : wait;
  const instance = new Debounced(fn, wait_time, leading, trailing, maxWait);

  const wrapper = function (this: ThisParameterType<typeof fn>, ...args: A) {
    return instance.call(this, ...args);
  };

  wrapper.cancel = () => instance.cancel();
  wrapper.flush = () => instance.flush();
  wrapper.pending = () => instance.pending;
  wrapper.result = () => instance.result;
  const dispose = () => {
    instance[Symbol.dispose]();
  };
  wrapper[Symbol.dispose] = dispose;
  return wrapper;
}

// ============================================
// 节流函数实现
// ============================================

/**
 * A throttled function with additional control methods
 *
 * @template A - The argument types of the function
 * @template R - The return type of the function
 * @template T - The `this` type of the function
 */
export type ThrottledFunction<A extends readonly unknown[], R, T> = ((
  this: T,
  ...args: A
) => R | Skipped) & {
  /** Cancels any pending invocation */
  cancel: () => void;
  /** Immediately invokes any pending invocation */
  flush: () => R | Skipped;
  /** Checks if there's a pending invocation */
  pending: () => boolean;
  /** Gets the result of the last invocation */
  result: () => R | Skipped;
  /** Disposes of the throttled function, cleaning up resources */
  [Symbol.dispose]: () => void;
};

/**
 * Creates a throttled function that only invokes `fn` at most once per every `wait` milliseconds
 *
 * Throttling ensures the function is executed at a controlled rate, useful for
 * handling high-frequency events like scrolling, resizing, or mouse movement
 *
 * @template A - The argument types of the function
 * @template R - The return type of the function
 *
 * @param fn - The function to throttle
 * @param wait - The number of milliseconds to throttle invocations to
 * @param options - Configuration options for throttling behavior
 * @param options.leading - Whether to invoke on the leading edge of the timeout (default: true)
 * @param options.trailing - Whether to invoke on the trailing edge of the timeout (default: true)
 * @param options.useRAF - Use requestAnimationFrame instead of setTimeout for timing
 *
 * @returns A throttled function with control methods
 *
 * @throws {ParameterError} If `wait` is invalid or if both `leading` and `trailing` are false
 *
 * @example
 * ```typescript
 * const throttledScroll = createThrottle(
 *   () => updateScrollIndicator(),
 *   100,
 *   { leading: true, trailing: false }
 * );
 *
 * // Usage
 * window.addEventListener('scroll', throttledScroll);
 *
 * // Control methods
 * throttledScroll.cancel();
 * throttledScroll.flush();
 * throttledScroll.pending();
 * ```
 */
/* v8 ignore next -- @preserve */
export function createThrottle<A extends readonly unknown[], R>(
  fn: (...args: A) => R,
  wait: number,
  options: {leading?: boolean; trailing?: boolean; useRAF?: boolean} = {
    leading: true,
    trailing: true,
  },
): ThrottledFunction<A, R, ThisParameterType<typeof fn>> {
  const {leading = true, trailing = true, useRAF: use_raf} = options;
  // 使用maxWait等于wait的防抖实现节流逻辑
  const wait_time = use_raf ? useRAF : wait;
  // RAF模式下不能设置maxWait
  const instance = new Debounced(
    fn,
    wait_time,
    leading,
    trailing,
    use_raf ? undefined : wait,
  );

  const wrapper = function (this: ThisParameterType<typeof fn>, ...args: A) {
    return instance.call(this, ...args);
  };

  wrapper.cancel = () => instance.cancel();
  wrapper.flush = () => instance.flush();
  wrapper.pending = () => instance.pending;
  wrapper.result = () => instance.result;
  const dispose = () => {
    instance[Symbol.dispose]();
  };
  wrapper[Symbol.dispose] = dispose;
  return wrapper;
}
