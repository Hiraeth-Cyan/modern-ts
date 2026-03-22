// ========================================
// ./src/Other/FetchQ.ts
// ========================================
import {Err, Ok} from '../Result/base';
import type {Result} from '../Result/types';
import type {MaybePromise} from '../Utils/type-tool';
import {delaySafe} from '../Concurrent/delay';

const DEFAULT_TIMEOUT = 10000;
const DEFAULT_MAX_ERROR_BODY_SIZE = 65536;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

/**
 * 构建完整 URL
 * 支持三种路径格式：绝对路径、协议相对路径、相对路径
 */
const buildUrl = (
  baseUrl: string | undefined,
  path: string,
  params?: Record<string, unknown>,
): string => {
  // 绝对路径：直接使用，忽略 baseUrl
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return appendParams(new URL(path), params);
  }

  // 协议相对路径：如 //api.example.com/users，需补充协议
  if (path.startsWith('//')) {
    let protocol: string;
    if (baseUrl?.startsWith('https://')) {
      protocol = 'https:';
    } else if (baseUrl?.startsWith('http://')) {
      protocol = 'http:';
      /* v8 ignore start -- @preserve */
    } else if (typeof window !== 'undefined') {
      // 浏览器环境下，使用当前页面的协议
      protocol = window.location.protocol;
    } else {
      // Node.js 环境下默认使用 http
      protocol = 'http:';
      /* v8 ignore stop -- @preserve */
    }
    return appendParams(new URL(`${protocol}${path}`), params);
  }

  // 相对路径：需要与 baseUrl 拼接
  let effectiveBase = baseUrl;

  // 没有 baseUrl 时，浏览器用当前域，Node.js 用 localhost
  if (!effectiveBase) {
    /* v8 ignore start -- @preserve */
    effectiveBase =
      typeof window !== 'undefined'
        ? window.location.origin
        : 'http://localhost';
    /* v8 ignore stop -- @preserve */
  }

  // 提取 baseUrl 中的 query 参数（URL 构造函数会丢弃它们）
  let baseQuery: string | undefined;
  const queryIndex = effectiveBase.indexOf('?');
  if (queryIndex !== -1) {
    baseQuery = effectiveBase.slice(queryIndex + 1);
    effectiveBase = effectiveBase.slice(0, queryIndex);
  }

  // URL 构造器要求 base 以斜杠结尾，否则会丢弃 path 的最后一部分
  const normalizedBase = effectiveBase.endsWith('/')
    ? effectiveBase
    : `${effectiveBase}/`;
  // 移除 path 开头的斜杠，避免双斜杠
  const normalizedPath = path.replace(/^\/+/, '');

  const url = new URL(normalizedPath, normalizedBase);

  // 将 baseUrl 的 query 参数合并到新 URL
  if (baseQuery) {
    const baseParams = new URLSearchParams(baseQuery);
    baseParams.forEach((value, key) => {
      url.searchParams.append(key, value);
    });
  }

  return appendParams(url, params);
};

/**
 * 将查询参数追加到 URL
 * 自动处理数组、对象等复杂类型
 */
const appendParams = (url: URL, params?: Record<string, unknown>): string => {
  if (!params) return url.toString();

  Object.entries(params).forEach(([key, value]) => {
    // 跳过 undefined 和 null，避免发送无意义的参数
    if (value === undefined || value === null) return;
    // 数组展开为多个同名参数：ids=[1,2] → ids=1&ids=2
    if (Array.isArray(value)) {
      value.forEach((v) => url.searchParams.append(key, String(v)));
    } else if (typeof value === 'object') {
      // 对象序列化为 JSON 字符串
      url.searchParams.append(key, JSON.stringify(value));
    } else {
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      url.searchParams.append(key, String(value));
    }
  });
  return url.toString();
};

/**
 * Error types returned by FetchQ requests.
 * @template T - The type of the response data.
 */
export type QError =
  | {
      type: 'http';
      status: number;
      message: string;
      response: Response;
      /** Error response body (limited by maxErrorBodySize) */
      body?: string;
    }
  | {type: 'timeout'; timeout_ms: number}
  | {type: 'network'; message: string}
  | {type: 'parse'; message: string; raw?: string}
  | {type: 'abort'; message: string};

/**
 * Progress event data for upload/download operations.
 */
export interface ProgressEvent {
  /** Number of bytes transferred */
  loaded: number;
  /** Total bytes to transfer (0 if unknown) */
  total: number;
  /** Progress percentage (0-100) */
  percentage: number;
  /** True if total size is unknown */
  indeterminate: boolean;
}

/**
 * Configuration options for creating a FetchQ instance.
 * @template R - The default response type.
 */
interface FetchQ_Options<R = unknown> {
  /** Base URL for all requests */
  baseUrl?: string;
  /** Default timeout in milliseconds (default: 10000) */
  timeout?: number;
  /** Default headers to include in all requests */
  default_headers?: HeadersInit;
  /** Transform function applied to all responses */
  transform?: (val: unknown) => R;
  /** Custom JSON parser (default: JSON.parse) */
  jsonParser?: (text: string) => unknown;
  /** Whether to clone response before passing to interceptors (default: true) */
  cloneResponseInInterceptor?: boolean;
  /**
   * HTTP methods that are allowed to retry.
   * Defaults to idempotent methods: ['GET', 'HEAD', 'PUT', 'DELETE', 'OPTIONS']
   * Set to null or empty array to disable method-based retry restriction.
   */
  retryableMethods?: readonly HttpMethod[] | null;
  /**
   * Maximum size in bytes to read from error response bodies (default: 65536 = 64KB).
   * Set to 0 to disable reading error body, or -1 for unlimited.
   * Prevents OOM when servers return large error responses.
   */
  maxErrorBodySize?: number;
}

/**
 * Options for individual requests.
 * Combines FetchQ-specific options with standard fetch RequestInit.
 * @template R - The instance's default response type.
 * @template T - The expected response type for this request.
 */
interface RequestOptions<R = unknown, T = R> extends RequestInit {
  /** Request timeout in milliseconds (overrides instance default) */
  timeout?: number;
  /** Query parameters to append to the URL */
  params?: Record<string, unknown>;
  /** Expected response type (default: 'json') */
  responseType?: 'json' | 'text' | 'blob' | 'arrayBuffer' | 'stream';
  /** Callback for upload progress events */
  onUploadProgress?: (event: ProgressEvent) => void;
  /** Callback for download progress events */
  onDownloadProgress?: (event: ProgressEvent) => void;
  /** Retry configuration */
  retry?: RetryOptions<T>;
  /** Transform function for this request's response */
  transform?: (val: unknown) => T;
  /**
   * Maximum size in bytes to read from error response bodies.
   * Overrides instance default. Set to 0 to disable, -1 for unlimited.
   */
  maxErrorBodySize?: number;
}

/**
 * Retry action returned by retry decision functions.
 * @template R - The response type.
 */
type RetryAction<R> =
  | {readonly result: Result<R, QError>}
  | {readonly delay: number; readonly config?: RequestInit};

/**
 * Stops retrying and returns the final result.
 * @template T - The response type.
 * @param result - The result to return.
 * @returns A RetryAction that stops retrying.
 */
export const QStop = <T,>(result: Result<T, QError>) => ({result});

/**
 * Continues retrying after a delay.
 * @param delay - Delay in milliseconds before next attempt.
 * @param config - Optional modified request config for retry.
 * @returns A RetryAction that continues retrying.
 */
export const QContinue = (delay: number, config?: RequestInit) => ({
  delay,
  config,
});

/**
 * Function type for custom retry logic.
 * @template R - The response type.
 * @param result - The result of the current attempt.
 * @param attempt - Current attempt number (0-indexed).
 * @param remaining - Remaining time in milliseconds.
 * @returns A RetryAction indicating whether to stop or continue.
 */
export type RetryFunction<R> = (
  result: Result<R, QError>,
  attempt: number,
  remaining: number,
) => MaybePromise<RetryAction<R>>;

/**
 * Configuration for request retry behavior.
 * @template R - The response type.
 */
export interface RetryOptions<R = unknown> {
  /** Maximum number of retry attempts */
  maxAttempts?: number;
  /** Initial delay in milliseconds for exponential backoff */
  initialDelay?: number;
  /** Maximum delay cap for exponential backoff */
  maxDelay?: number;
  /** Custom function to determine retry behavior */
  shouldRetry?: RetryFunction<R>;
}

/** 请求拦截器：在请求发送前修改配置 */
type RequestInterceptor = (
  config: RequestInit,
) => RequestInit | Promise<RequestInit>;

/** 响应拦截器：在响应返回后进行处理 */
type ResponseInterceptor = (response: Response) => Response | Promise<Response>;

/** 拦截器集合 */
interface Interceptors {
  request: RequestInterceptor[];
  response: ResponseInterceptor[];
}

/** 响应类型对应的 Accept 请求头 */
const ACCEPT_MAP: Record<Required<RequestOptions>['responseType'], string> = {
  json: 'application/json, text/plain, */*',
  text: 'text/plain, */*',
  blob: '*/*',
  arrayBuffer: '*/*',
  stream: '*/*',
};

/** 支持的 HTTP 方法 */
type HttpMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'
  | 'HEAD'
  | 'OPTIONS';

/** 默认可重试的 HTTP 方法（幂等方法） */
const DEFAULT_RETRYABLE_METHODS: readonly HttpMethod[] = [
  'GET',
  'HEAD',
  'PUT',
  'DELETE',
  'OPTIONS',
];

/**
 * A lightweight HTTP client with retry, interceptors, and progress tracking.
 * @template R - The default response type for all requests.
 *
 * @example
 * ```ts
 * const client = new FetchQ({ baseUrl: 'https://api.example.com' });
 * const result = await client.get('/users');
 * if (result.ok) {
 *   console.log(result.value);
 * }
 * ```
 */
export class FetchQ<R = unknown> {
  private readonly base_url: string | undefined;
  private readonly timeout_ms: number;
  private readonly default_headers: HeadersInit;
  private readonly transform: (val: unknown) => R;
  private readonly json_parser: (text: string) => unknown;
  private readonly clone_response_in_interceptor: boolean;
  private readonly retryable_methods: ReadonlySet<string> | null;
  private readonly max_error_body_size: number;

  /** 请求和响应拦截器 */
  public interceptors: Interceptors = {request: [], response: []};

  constructor(options: FetchQ_Options<R> = {}) {
    this.base_url = options.baseUrl;
    this.timeout_ms = options.timeout ?? DEFAULT_TIMEOUT;
    this.default_headers = options.default_headers ?? {};
    this.transform = options.transform ?? ((val: unknown) => val as R);
    this.json_parser = options.jsonParser ?? JSON.parse;
    this.clone_response_in_interceptor =
      options.cloneResponseInInterceptor ?? true;
    this.max_error_body_size =
      options.maxErrorBodySize ?? DEFAULT_MAX_ERROR_BODY_SIZE;
    // null 表示不限制方法，undefined 使用默认幂等方法，否则使用用户指定的方法列表
    if (options.retryableMethods === null) {
      this.retryable_methods = null;
    } else if (options.retryableMethods === undefined) {
      this.retryable_methods = new Set<string>(DEFAULT_RETRYABLE_METHODS);
    } else {
      this.retryable_methods = new Set<string>(options.retryableMethods);
    }
  }

  /**
   * 安全取消流
   * 避免未消费的流导致资源泄漏（浏览器会保持连接直到流被消费或取消）
   */
  private safeCancel(body: ReadableStream | null | undefined) {
    if (!body) return;
    try {
      const result = body.cancel();
      // cancel() 可能返回 Promise，需要捕获其错误
      if (result instanceof Promise) void result.catch(() => {});
    } catch {
      // 忽略 cancel 过程中的错误（流可能已被消费或关闭）
    }
  }

  /**
   * 限制读取错误响应体的大小
   * 防止服务器返回超大错误响应导致 OOM
   */
  private async limitErrorBody(
    response: Response,
    max_size: number,
  ): Promise<string | undefined> {
    if (max_size === 0) return undefined;

    // 先检查 Content-Length，如果已知大小超限则直接跳过
    const content_length = response.headers.get('Content-Length');
    if (content_length && Number(content_length) > max_size) return undefined;

    if (!response.body) return undefined;

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total_size = 0;

    try {
      while (true) {
        const {done, value} = await reader.read();
        if (done) break;

        total_size += value.length;
        // 超过大小限制时取消读取
        if (max_size > 0 && total_size > max_size) {
          await reader.cancel();
          return undefined;
        }
        chunks.push(value);
      }

      // 合并所有 chunks 并解码为字符串
      const combined = new Uint8Array(total_size);
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }
      return textDecoder.decode(combined);
    } catch {
      return undefined;
    }
  }

  /**
   * 判断请求方法是否允许重试
   *
   * 重试策略（优先级从高到低）：
   * 1. 用户提供了 shouldRetry → 完全由用户控制，不做方法限制
   * 2. 单次请求配置了 retry（但无 shouldRetry）→ 允许重试（用户显式指定）
   * 3. 否则根据 retryable_methods 判断（默认只允许幂等方法重试）
   *
   * 原因：非幂等方法（如 POST）重试可能导致重复创建资源
   */
  private isMethodRetryable<T>(
    method: HttpMethod,
    retry_opts: RetryOptions<T>,
  ): boolean {
    if (retry_opts.shouldRetry) return true;
    if (retry_opts.maxAttempts !== undefined && retry_opts.maxAttempts > 0)
      return true;
    if (this.retryable_methods === null) return true;
    return this.retryable_methods.has(method);
  }

  /**
   * 标准化请求配置
   * 合并默认配置与请求配置，处理请求体序列化
   */
  private normalizeConfig(
    data: unknown,
    config: RequestInit,
    responseType: Required<RequestOptions>['responseType'],
  ): RequestInit {
    // 合并 headers：请求级 headers 覆盖默认 headers
    const headers = new Headers(this.default_headers);
    if (config.headers) {
      new Headers(config.headers).forEach((v, k) => headers.set(k, v));
    }

    // 设置 Accept 头，告诉服务器期望的响应格式
    if (!headers.has('Accept')) headers.set('Accept', ACCEPT_MAP[responseType]);

    let body: BodyInit | undefined;

    if (data !== undefined && data !== null) {
      if (data instanceof FormData) {
        body = data;
        // FormData 不需要手动设置 Content-Type，浏览器会自动设置正确的 boundary
        headers.delete('Content-Type');
      } else if (
        data instanceof Blob ||
        data instanceof URLSearchParams ||
        data instanceof ReadableStream ||
        data instanceof ArrayBuffer ||
        ArrayBuffer.isView(data) ||
        typeof data === 'string'
      ) {
        // 这些类型可以直接作为 body 使用
        body = data as BodyInit;
      } else {
        // 其他类型序列化为 JSON
        body = JSON.stringify(data);
        if (!headers.has('Content-Type'))
          headers.set('Content-Type', 'application/json');
      }
    } else {
      // 没有提供 data 时，使用 config 中的 body
      body = config.body as BodyInit | undefined;
    }

    return {...config, headers, body};
  }

  /** 依次执行请求拦截器链 */
  private async runRequestInterceptors(
    config: RequestInit,
  ): Promise<RequestInit> {
    let finalConfig = config;
    for (const interceptor of this.interceptors.request) {
      finalConfig = await interceptor(finalConfig);
    }
    return finalConfig;
  }

  /**
   * 依次执行响应拦截器链
   * 处理克隆模式和错误清理
   */
  private async runResponseInterceptors(response: Response): Promise<Response> {
    let res = response;
    for (const interceptor of this.interceptors.response) {
      const original = res;
      // 克隆模式下传入克隆的响应，保留原始响应供后续使用
      const input = this.clone_response_in_interceptor ? res.clone() : res;
      try {
        res = await interceptor(input);
      } catch (error) {
        // 拦截器抛出错误时，取消所有相关流避免资源泄漏
        this.safeCancel(original.body);
        if (this.clone_response_in_interceptor) this.safeCancel(input.body);
        throw error;
      } finally {
        // 克隆模式下取消原来的流（我们使用的是克隆体）
        if (this.clone_response_in_interceptor) this.safeCancel(original.body);
      }
    }
    return res;
  }

  /**
   * 将原生错误分类为 QError 类型
   * 便于调用方根据错误类型采取不同的处理策略
   */
  private classifyError(
    error: unknown,
    timeout: number,
    signal?: AbortSignal,
  ): QError {
    if (error instanceof DOMException) {
      // AbortSignal.timeout() 超时会抛出 TimeoutError
      if (error.name === 'TimeoutError')
        return {type: 'timeout', timeout_ms: timeout};
      // 用户手动取消请求
      if (signal?.aborted) return {type: 'abort', message: 'Request aborted'};
    }
    // 网络错误（如 DNS 解析失败、连接被拒绝）
    if (error instanceof TypeError)
      return {type: 'network', message: error.message};
    return {
      type: 'network',
      message: error instanceof Error ? error.message : 'Unknown network error',
    };
  }

  /**
   * 执行 HTTP 请求
   * 支持重试、超时、进度追踪等功能
   * @template T - The expected response type.
   * @param urlOrRequest - URL string or Request object.
   * @param options - Request options (combines FetchQ options with fetch RequestInit).
   * @param data - Request body data.
   * @returns A Result containing either the response data or a QError.
   */
  public async request<T = R>(
    urlOrRequest: string | Request,
    options: RequestOptions<R, T> = {},
    data?: unknown,
  ): Promise<Result<T, QError>> {
    const response_type = options.responseType ?? 'json';
    const timeout = options.timeout ?? this.timeout_ms;
    const start_time = Date.now();
    const transform: (val: unknown) => T =
      options.transform ?? (this.transform as unknown as (val: unknown) => T);

    // 解析 URL 和初始化配置
    let final_url: string;
    let initial_config: RequestInit;

    if (urlOrRequest instanceof Request) {
      // Request 对象：提取其属性并合并
      final_url = buildUrl(this.base_url, urlOrRequest.url, options.params);
      const merged_headers = new Headers(urlOrRequest.headers);
      if (options.headers) {
        new Headers(options.headers).forEach((v, k) =>
          merged_headers.set(k, v),
        );
      }

      const {headers, ...fetch_opts} = this.extractFetchOptions(options);
      initial_config = {
        method: urlOrRequest.method,
        headers: merged_headers,
        body: urlOrRequest.body,
        ...fetch_opts,
      };
      // 如果提供了 data 参数，忽略 Request 中的 body
      if (data !== undefined) initial_config.body = undefined;
    } else {
      // URL 字符串：直接构建
      final_url = buildUrl(this.base_url, urlOrRequest, options.params);
      initial_config = this.extractFetchOptions(options);
    }

    // 合并默认配置和请求配置
    const final_config = this.normalizeConfig(
      data,
      initial_config,
      response_type,
    );

    // 执行请求拦截器
    let processed_config = await this.runRequestInterceptors(final_config);

    // 流式请求体不支持重试（流只能消费一次）
    const retry_opts = options.retry;
    if (retry_opts && processed_config.body instanceof ReadableStream)
      throw new TypeError(
        'FetchQ: Retry is not supported for ReadableStream body. Streams can only be consumed once.',
      );

    // 创建超时信号，并与用户信号合并
    const timeout_signal = AbortSignal.timeout(timeout);
    const combined_signal = options.signal
      ? AbortSignal.any([timeout_signal, options.signal])
      : timeout_signal;

    // 重试循环
    let attempt = 0;

    while (true) {
      const elapsed = Date.now() - start_time;
      const remaining = timeout - elapsed;

      // 每次重试需重新包装 body 进度流（流只能消费一次）
      let current_config = processed_config;
      if (options.onUploadProgress && current_config.body) {
        current_config = this.wrapBodyWithProgress(
          current_config,
          options.onUploadProgress,
        );
      }

      const result = await this.performFetch<T>(
        final_url,
        current_config,
        options,
        response_type,
        combined_signal,
        timeout,
        transform,
      );

      // 成功或没有重试配置时直接返回
      if (result.ok || !retry_opts) return result;

      // 检查方法是否允许重试
      const method = (processed_config.method?.toUpperCase() ??
        'GET') as HttpMethod;
      const is_method_retryable = this.isMethodRetryable(method, retry_opts);
      if (!is_method_retryable) return result;

      // 决定是否重试以及重试延迟
      const decision = await this.resolveRetryDecision<T>(
        result,
        attempt,
        remaining,
        retry_opts,
      );
      if ('result' in decision) return decision.result;

      // 等待重试延迟（可能被 abort 信号中断）
      const delay_error = await delaySafe(decision.delay, combined_signal);
      if (delay_error)
        return Err(
          this.classifyError(delay_error, timeout, options.signal ?? undefined),
        );

      // 应用重试配置更新
      if (decision.config) {
        const merged_headers = new Headers(processed_config.headers);
        if (decision.config.headers) {
          new Headers(decision.config.headers).forEach((v, k) =>
            merged_headers.set(k, v),
          );
        }
        processed_config = {
          ...processed_config,
          ...decision.config,
          headers: merged_headers,
        };
      }
      attempt++;
    }
  }

  /**
   * 从 RequestOptions 中提取 fetch 相关的 RequestInit 属性
   * 排除 FetchQ 自定义的选项
   */
  private extractFetchOptions<R2, T2>(
    options: RequestOptions<R2, T2>,
  ): RequestInit {
    const {
      timeout,
      params,
      responseType,
      onUploadProgress,
      onDownloadProgress,
      retry,
      transform,
      maxErrorBodySize,
      ...fetch_options
    } = options;
    return fetch_options;
  }

  /**
   * 解析重试决策
   * 根据错误类型和配置决定是否重试以及重试延迟
   */
  private async resolveRetryDecision<T>(
    result: Result<T, QError>,
    attempt: number,
    remaining: number,
    retry_opts: RetryOptions<T>,
  ): Promise<RetryAction<T>> {
    // 用户自定义重试逻辑
    if (retry_opts.shouldRetry) {
      return retry_opts.shouldRetry(result, attempt, remaining);
    }

    // 达到最大重试次数或成功则停止
    const max_attempts = retry_opts.maxAttempts ?? 0;
    if (attempt + 1 >= max_attempts || result.ok) return QStop(result);

    // 判断错误是否可重试
    const error = result.error;
    const is_retryable =
      error.type === 'network' ||
      error.type === 'timeout' ||
      (error.type === 'http' && (error.status >= 500 || error.status === 429));

    if (!is_retryable) return QStop(result);

    // 计算重试延迟
    let delay_time = 0;
    const retry_after = this.parseRetryAfter(error);

    if (retry_after !== null) {
      // 服务器指定了重试时间
      delay_time = Math.min(retry_after, retry_opts.maxDelay ?? Infinity);
    } else {
      // 指数退避 + 随机抖动（Full Jitter）
      const base_delay = retry_opts.initialDelay ?? 1000;
      const max_delay = retry_opts.maxDelay ?? Infinity;
      const exponential_delay = base_delay * Math.pow(2, attempt);
      const capped_delay = Math.min(max_delay, exponential_delay);
      delay_time = Math.random() * capped_delay;
    }

    return QContinue(delay_time);
  }

  /**
   * 解析 Retry-After 响应头
   * 支持秒数（如 "120"）和日期（如 "Fri, 31 Dec 2025 23:59:59 GMT"）两种格式
   */
  private parseRetryAfter(error: QError): number | null {
    if (error.type !== 'http' || !error.response) return null;
    const retry_after = error.response.headers.get('Retry-After');
    if (!retry_after) return null;

    // 尝试解析为秒数
    const seconds = Number(retry_after);
    if (!Number.isNaN(seconds)) return seconds * 1000;

    // 尝试解析为日期
    const date = Date.parse(retry_after);
    if (!Number.isNaN(date)) {
      const ms = date - Date.now();
      return ms > 0 ? ms : 0;
    }
    return null;
  }

  /**
   * 执行实际的 fetch 请求
   * 处理响应拦截、错误分类和响应解析
   */
  private async performFetch<T>(
    url: string,
    config: RequestInit,
    options: RequestOptions<R, T>,
    response_type: Required<RequestOptions>['responseType'],
    signal: AbortSignal,
    timeout: number,
    transform: (val: unknown) => T,
  ): Promise<Result<T, QError>> {
    let response: Response;
    try {
      response = await fetch(url, {...config, signal});
    } catch (error: unknown) {
      return Err(
        this.classifyError(error, timeout, options.signal ?? undefined),
      );
    }

    try {
      response = await this.runResponseInterceptors(response);

      // HTTP 错误状态码
      if (!response.ok) {
        const max_body_size =
          options.maxErrorBodySize ?? this.max_error_body_size;
        const body = await this.limitErrorBody(response, max_body_size);
        return Err({
          type: 'http',
          status: response.status,
          message: `Request failed with status ${response.status}`,
          response,
          body,
        });
      }

      // 下载进度追踪
      if (options.onDownloadProgress && response.body) {
        return await this.handleDownloadProgress<T>(
          response,
          response_type,
          options.onDownloadProgress,
          transform,
        );
      }

      return await this.parseResponse<T>(response, response_type, transform);
    } catch (error: unknown) {
      // 取消可能已部分读取的流，避免资源泄漏
      this.safeCancel(response?.body);
      // 流消费过程中的网络错误（如连接中断）
      return Err(
        this.classifyError(error, timeout, options.signal ?? undefined),
      );
    }
  }

  /**
   * 包装请求体以追踪上传进度
   * 通过 TransformStream 监控数据传输
   */
  private wrapBodyWithProgress(
    config: RequestInit,
    on_progress: (event: ProgressEvent) => void,
  ): RequestInit {
    const body = config.body as BodyInit;

    // FormData 无法轻易计算进度（需要解析 multipart 边界）
    // 对于小文件进度太快会闪烁，大文件应使用分片上传
    if (body instanceof FormData) {
      on_progress({loaded: 0, total: 0, percentage: 0, indeterminate: true});
      return config;
    }

    let source_stream: ReadableStream<Uint8Array>;
    let total_bytes: number;
    let indeterminate = false;

    // 将各种 Body 类型转换为流，同时计算大小
    if (body instanceof Blob) {
      source_stream = body.stream();
      total_bytes = body.size;
    } else if (body instanceof ReadableStream) {
      source_stream = body as ReadableStream<Uint8Array>;
      total_bytes = 0;
      indeterminate = true;
    } else {
      // 字符串、ArrayBuffer、URLSearchParams 等需要先编码
      let chunk: Uint8Array;
      if (typeof body === 'string') chunk = textEncoder.encode(body);
      else if (body instanceof ArrayBuffer) chunk = new Uint8Array(body);
      else if (body instanceof URLSearchParams)
        chunk = textEncoder.encode(body.toString());
      else if (ArrayBuffer.isView(body))
        chunk = new Uint8Array(body.buffer, body.byteOffset, body.byteLength);
      /* v8 ignore start -- @preserve */ else {
        // 已覆盖 BodyInit 所有类型
      }
      /* v8 ignore stop -- @preserve */

      total_bytes = chunk!.length;
      source_stream = new ReadableStream({
        start(controller) {
          controller.enqueue(chunk);
          controller.close();
        },
      });
    }

    let uploaded_bytes = 0;

    // 通过 TransformStream 监控数据传输
    // transform 在每个 chunk 通过时调用，flush 在流结束时调用
    const progress_stream = source_stream.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          controller.enqueue(chunk);
          uploaded_bytes += chunk.length;
          const raw_percentage = indeterminate
            ? 0
            : Math.round((uploaded_bytes / total_bytes) * 100);
          on_progress({
            loaded: uploaded_bytes,
            total: total_bytes || uploaded_bytes,
            percentage: Math.min(raw_percentage, 99), // 99% 表示还在传输
            indeterminate,
          });
        },
        flush() {
          // 流结束时报告 100%
          on_progress({
            loaded: uploaded_bytes,
            total: total_bytes || uploaded_bytes,
            percentage: 100,
            indeterminate,
          });
        },
      }),
    );

    // duplex: 'half' 允许在请求体中使用流
    return {...config, body: progress_stream, duplex: 'half'} as RequestInit;
  }

  /**
   * 处理下载进度追踪
   * 通过 TransformStream 监控响应数据接收
   */
  private async handleDownloadProgress<T>(
    response: Response,
    response_type: string,
    on_progress: (event: ProgressEvent) => void,
    transform: (val: unknown) => T,
  ): Promise<Result<T, QError>> {
    const content_length = response.headers.get('content-length');
    const total = content_length ? parseInt(content_length, 10) : 0;
    // 只有缺少 content-length 时才是未知大小
    const indeterminate = content_length === null;
    let received_length = 0;

    const transform_stream = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        controller.enqueue(chunk);
        received_length += chunk.length;
        const raw_percentage = indeterminate
          ? 0
          : Math.round((received_length / total) * 100);
        on_progress({
          loaded: received_length,
          total: total || received_length,
          percentage: Math.min(raw_percentage, 99),
          indeterminate,
        });
      },
      flush() {
        on_progress({
          loaded: received_length,
          total: total || received_length,
          percentage: 100,
          indeterminate,
        });
      },
    });

    // 创建新的 Response 对象包装进度流
    const progress_response = new Response(
      response.body!.pipeThrough(transform_stream),
    );
    return this.parseResponse<T>(progress_response, response_type, transform);
  }

  /**
   * 解析响应体
   * 根据 responseType 选择合适的解析方式
   */
  private async parseResponse<T>(
    response: Response,
    response_type: string,
    transform: (val: unknown) => T,
  ): Promise<Result<T, QError>> {
    let raw_text: string | undefined;
    try {
      let data: unknown;
      switch (response_type) {
        case 'blob':
          data = await response.blob();
          break;
        case 'arrayBuffer':
          data = await response.arrayBuffer();
          break;
        case 'text':
          raw_text = await response.text();
          data = raw_text;
          break;
        case 'stream':
          data = response.body;
          break;
        case 'json':
        default:
          raw_text = await response.text();
          // 空响应返回 null 而不是解析错误
          data = raw_text ? this.json_parser(raw_text) : null;
          break;
      }
      return Ok(transform(data));
    } catch (e: unknown) {
      // 网络错误冒泡到 performFetch 由 classifyError 分类
      if (e instanceof TypeError || e instanceof DOMException) throw e;
      // JSON 解析错误等
      return Err({
        type: 'parse',
        message: e instanceof Error ? e.message : 'Parse error',
        raw: raw_text,
      });
    }
  }

  // ============================================
  // HTTP Method Shortcuts
  // ============================================

  /**
   * Perform a GET request.
   * @template T - The expected response type.
   * @param url - The URL to request.
   * @param options - Optional request options.
   */
  public get<T = R>(url: string, options?: RequestOptions<R, T>) {
    return this.request<T>(url, {...options, method: 'GET'});
  }

  /**
   * Perform a POST request.
   * @template T - The expected response type.
   * @param url - The URL to request.
   * @param data - The request body data.
   * @param options - Optional request options.
   */
  public post<T = R>(
    url: string,
    data?: unknown,
    options?: RequestOptions<R, T>,
  ) {
    return this.request<T>(url, {...options, method: 'POST'}, data);
  }

  /**
   * Perform a PUT request.
   * @template T - The expected response type.
   * @param url - The URL to request.
   * @param data - The request body data.
   * @param options - Optional request options.
   */
  public put<T = R>(
    url: string,
    data?: unknown,
    options?: RequestOptions<R, T>,
  ) {
    return this.request<T>(url, {...options, method: 'PUT'}, data);
  }

  /**
   * Perform a PATCH request.
   * @template T - The expected response type.
   * @param url - The URL to request.
   * @param data - The request body data.
   * @param options - Optional request options.
   */
  public patch<T = R>(
    url: string,
    data?: unknown,
    options?: RequestOptions<R, T>,
  ) {
    return this.request<T>(url, {...options, method: 'PATCH'}, data);
  }

  /**
   * Perform a DELETE request.
   * @template T - The expected response type.
   * @param url - The URL to request.
   * @param options - Optional request options.
   */
  public delete<T = R>(url: string, options?: RequestOptions<R, T>) {
    return this.request<T>(url, {...options, method: 'DELETE'});
  }

  /**
   * Perform a HEAD request.
   * @param url - The URL to request.
   * @param options - Optional request options.
   */
  public head(url: string, options?: RequestOptions<R, void>) {
    return this.request<void>(url, {...options, method: 'HEAD'});
  }

  /**
   * Perform an OPTIONS request.
   * @param url - The URL to request.
   * @param options - Optional request options.
   */
  public options(url: string, options?: RequestOptions<R, void>) {
    return this.request<void>(url, {...options, method: 'OPTIONS'});
  }
}
