// ========================================
// ./src/Other/FetchQ.spec.ts
// ========================================

import {AsyncLocalStorage} from 'async_hooks';
import {describe, it, expect, vi, type Mock} from 'vitest';
import {
  FetchQ,
  QStop,
  QContinue,
  type ProgressEvent,
  type QError,
} from './FetchQ';
import type {Result} from '../Result/types';
import {sleep} from '../Concurrent/delay';

// 存储当前测试上下文的 Mock 函数
const mockStorage = new AsyncLocalStorage<Mock<typeof fetch>>();

// 保存原始 fetch
const originalFetch = globalThis.fetch;

globalThis.fetch = async (input, init) => {
  const store = mockStorage.getStore();
  if (store) {
    // 在上下文中，调用 Mock
    return store(input, init);
  }
  // 不在上下文中，调用真实请求（或上层的 mock）
  return originalFetch(input, init);
};

// 封装 Mock 获取函数
const useMockFetch = () => {
  const mock = mockStorage.getStore();
  if (!mock)
    throw new Error('useMockFetch must be called inside a test context!');
  return mock;
};

// Helper: 设置 mock response (保持原有逻辑)
const createMockResponse = (
  data: unknown,
  options: Partial<Response> = {},
): Response => {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Headers(options.headers),
    json: async () =>
      Promise.resolve(
        typeof data === 'string' ? (JSON.parse(data) as unknown) : data,
      ),
    text: async () =>
      Promise.resolve(typeof data === 'string' ? data : JSON.stringify(data)),
    blob: async () =>
      Promise.resolve(
        data instanceof Blob ? data : new Blob([JSON.stringify(data)]),
      ),
    arrayBuffer: async () =>
      Promise.resolve(
        new TextEncoder().encode(
          typeof data === 'string' ? data : JSON.stringify(data),
        ).buffer,
      ),
    clone: function () {
      return createMockResponse(data, options);
    },
    ...options,
  } as Response;
};

const headerHas = (headers: Headers | undefined, key: string, value: string) =>
  headers instanceof Headers && headers.get(key) === value;

// 适配原有的 setupMockFetch，改为从 ALS 获取并初始化
// 注意：在并发模式下，通常不需要 restoreFetch，因为每个测试有独立的 mock 实例
const setupMockFetch = () => {
  const mockFetch = useMockFetch();
  // 重置 mock 状态（虽然每个测试是新实例，但以防万一同一个 test 函数被复用）
  mockFetch.mockClear();
  return mockFetch;
};

// 标准化测试接口，自动包裹 ALS 上下文
const test = (name: string, fn: () => Promise<void> | void) => {
  it(name, async () => {
    // 为每个测试创建独立的 Mock 实例
    const mockFn = vi.fn();
    // 在 ALS 存储中运行测试
    await mockStorage.run(mockFn, fn);
  });
};

// 支持 it.each 语法
test.each = <T>(cases: ReadonlyArray<T>) => {
  return (name: string, fn: (arg: T) => Promise<void> | void) => {
    it.each(cases)(name, async (arg: T) => {
      const mockFn = vi.fn();
      await mockStorage.run(mockFn, () => fn(arg));
    });
  };
};

// 使用 describe.concurrent 开启并发
describe.concurrent('FetchQ', () => {
  // ============================================
  // HTTP Method Shortcuts Tests
  // ============================================
  describe('HTTP Method Shortcuts', () => {
    const methodCases: Array<{
      method: string;
      fn: (q: FetchQ, url: string) => Promise<unknown>;
      hasBody?: boolean;
    }> = [
      {method: 'GET', fn: (q, url) => q.get(url)},
      {method: 'POST', fn: (q, url) => q.post(url, {name: 'test'})},
      {method: 'PUT', fn: (q, url) => q.put(url, {name: 'test'})},
      {method: 'PATCH', fn: (q, url) => q.patch(url, {name: 'test'})},
      {method: 'DELETE', fn: (q, url) => q.delete(url)},
      {method: 'HEAD', fn: (q, url) => q.head(url)},
      {method: 'OPTIONS', fn: (q, url) => q.options(url)},
    ];

    test.each(methodCases)(
      'should make $method request',
      async ({method, fn, hasBody}) => {
        const mockFetch = setupMockFetch();
        mockFetch.mockResolvedValueOnce(createMockResponse({success: true}));
        const q = new FetchQ();
        const result = await fn(q, '/test');
        expect(result).toHaveProperty('ok', true);
        expect(mockFetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({method}),
        );
        if (hasBody) {
          const config = mockFetch.mock.calls[0][1] as RequestInit;
          expect(config.body).toBeDefined();
        }
      },
    );
  });

  // ============================================
  // URL Building Tests
  // ============================================
  describe('URL Building', () => {
    test('should handle absolute URL directly', async () => {
      const mockFetch = setupMockFetch();
      mockFetch.mockResolvedValueOnce(createMockResponse({data: 'test'}));
      const q = new FetchQ();
      await q.get('https://external.api.com/data');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://external.api.com/data',
        expect.any(Object),
      );
    });

    test('should append baseUrl to relative path', async () => {
      const mockFetch = setupMockFetch();
      mockFetch.mockResolvedValueOnce(createMockResponse({data: 'test'}));
      const q = new FetchQ({baseUrl: 'https://api.example.com'});
      await q.get('/users');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/users',
        expect.any(Object),
      );
    });

    test('should handle baseUrl with and without trailing slash', async () => {
      const mockFetch = setupMockFetch();
      mockFetch.mockResolvedValueOnce(createMockResponse({data: 'test'}));
      const q = new FetchQ({baseUrl: 'https://api.example.com/'});
      await q.get('users');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/users',
        expect.any(Object),
      );
    });

    test('should append query params to URL', async () => {
      const mockFetch = setupMockFetch();
      mockFetch.mockResolvedValueOnce(createMockResponse({data: 'test'}));
      const q = new FetchQ();
      await q.get('/search', {params: {q: 'test', limit: 10}});
      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('q=test');
      expect(calledUrl).toContain('limit=10');
    });

    test('should handle array, object, null/undefined, and special query params', async () => {
      const mockFetch = setupMockFetch();
      mockFetch.mockResolvedValueOnce(createMockResponse({data: 'test'}));
      const q = new FetchQ();
      await q.get('/search', {
        params: {
          ids: [1, 2, 3],
          filter: {field: 'name'},
          valid: 'value',
          nullVal: null,
          undefinedVal: undefined,
          q: 'hello world&special=chars',
          num: 42,
          bool: true,
        },
      });
      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('ids=1');
      expect(calledUrl).toContain('ids=2');
      expect(calledUrl).toContain('ids=3');
      expect(calledUrl).toContain('filter=');
      expect(calledUrl).toContain('valid=value');
      expect(calledUrl).not.toContain('nullVal');
      expect(calledUrl).not.toContain('undefinedVal');
      expect(calledUrl).toContain('hello+world');
      expect(calledUrl).toContain('num=42');
      expect(calledUrl).toContain('bool=true');
    });

    test('should handle protocol relative URL', async () => {
      const mockFetch = setupMockFetch();
      mockFetch.mockResolvedValueOnce(createMockResponse({data: 'test'}));
      // https baseUrl
      const q1 = new FetchQ({baseUrl: 'https://api.example.com'});
      await q1.get('//cdn.example.com/script.js');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://cdn.example.com/script.js',
        expect.any(Object),
      );

      // http baseUrl
      mockFetch.mockResolvedValueOnce(createMockResponse({data: 'test'}));
      const q2 = new FetchQ({baseUrl: 'http://api.example.com'});
      await q2.get('//cdn.example.com/script.js');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://cdn.example.com/script.js',
        expect.any(Object),
      );
    });

    test('should preserve query params from baseUrl', async () => {
      const mockFetch = setupMockFetch();
      mockFetch.mockResolvedValueOnce(createMockResponse({data: 'test'}));
      const q = new FetchQ({baseUrl: 'https://api.example.com?version=1'});
      await q.get('/users');
      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('version=1');
    });
  });

  // ============================================
  // Request Interceptor Tests
  // ============================================
  describe('Request Interceptors', () => {
    test('should apply request interceptors in order', async () => {
      const mockFetch = setupMockFetch();
      mockFetch.mockResolvedValueOnce(createMockResponse({data: 'test'}));
      const q = new FetchQ();
      const order: number[] = [];
      q.interceptors.request.push((config) => {
        order.push(1);
        const headers = new Headers(config.headers);
        headers.set('X-First', 'true');
        return {...config, headers};
      });
      q.interceptors.request.push(async (config) => {
        await sleep(1);
        order.push(2);
        return config;
      });
      await q.get('/test');
      expect(order).toEqual([1, 2]);
      const config = mockFetch.mock.calls[0][1] as RequestInit;
      expect(headerHas(config.headers as Headers, 'X-First', 'true')).toBe(
        true,
      );
    });
  });

  // ============================================
  // Response Interceptor Tests
  // ============================================
  describe('Response Interceptors', () => {
    test('should apply response interceptors in order', async () => {
      const mockFetch = setupMockFetch();
      mockFetch.mockResolvedValueOnce(createMockResponse({data: 'test'}));
      const q = new FetchQ();
      const order: number[] = [];
      q.interceptors.response.push((response) => {
        order.push(1);
        return response;
      });
      q.interceptors.response.push(async (response) => {
        await sleep(1);
        order.push(2);
        return response;
      });
      await q.get('/test');
      expect(order).toEqual([1, 2]);
    });

    test('should handle cloneResponseInInterceptor option', async () => {
      const mockFetch = setupMockFetch();
      const cancelSpy = vi.fn();
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers(),
        json: vi.fn().mockResolvedValue({data: 'test'}),
        text: vi.fn().mockResolvedValue('{"data":"test"}'),
        clone: vi.fn().mockReturnThis(),
        body: {cancel: cancelSpy},
      };
      mockFetch.mockResolvedValueOnce(mockResponse as unknown as Response);

      // 不克隆模式
      const q1 = new FetchQ({cloneResponseInInterceptor: false});
      q1.interceptors.response.push((response) => response);
      await q1.get('/test');
      expect(mockResponse.clone).not.toHaveBeenCalled();

      // 克隆模式
      mockFetch.mockResolvedValueOnce(mockResponse as unknown as Response);
      const q2 = new FetchQ({cloneResponseInInterceptor: true});
      q2.interceptors.response.push((response) => response);
      await q2.get('/test');
      expect(cancelSpy).toHaveBeenCalled();
    });

    test('should handle cancel error gracefully when cloning', async () => {
      const mockFetch = setupMockFetch();
      const cancelSpy = vi.fn().mockRejectedValue(new Error('Cancel failed'));
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers(),
        json: vi.fn().mockResolvedValue({data: 'test'}),
        text: vi.fn().mockResolvedValue('{"data":"test"}'),
        clone: vi.fn().mockReturnThis(),
        body: {cancel: cancelSpy},
      };
      mockFetch.mockResolvedValueOnce(mockResponse as unknown as Response);
      const q = new FetchQ({cloneResponseInInterceptor: true});
      q.interceptors.response.push((response) => response);
      const result = await q.get('/test');
      expect(result.ok).toBe(true);
      expect(cancelSpy).toHaveBeenCalled();
    });

    test('should cancel stream when response interceptor throws', async () => {
      const mockFetch = setupMockFetch();
      const cancelSpyOriginal = vi.fn();
      const cancelSpyCloned = vi.fn();
      const clonedResponse = {
        ok: true,
        status: 200,
        headers: new Headers(),
        json: vi.fn().mockResolvedValue({data: 'test'}),
        text: vi.fn().mockResolvedValue('{"data":"test"}'),
        body: {cancel: cancelSpyCloned},
      };
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers(),
        json: vi.fn().mockResolvedValue({data: 'test'}),
        text: vi.fn().mockResolvedValue('{"data":"test"}'),
        clone: vi.fn().mockReturnValue(clonedResponse),
        body: {cancel: cancelSpyOriginal},
      };
      mockFetch.mockResolvedValueOnce(mockResponse as unknown as Response);
      const q = new FetchQ({cloneResponseInInterceptor: true});
      q.interceptors.response.push(() => {
        throw new Error('Interceptor error');
      });
      const result = await q.get('/test');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('network');
        expect(
          (result.error as Extract<QError, {type: 'network'}>).message,
        ).toBe('Interceptor error');
      }
      expect(cancelSpyOriginal).toHaveBeenCalled();
      expect(cancelSpyCloned).toHaveBeenCalled();
    });

    test('should cancel stream when response interceptor throws in non-clone mode', async () => {
      const mockFetch = setupMockFetch();
      const cancelSpy = vi.fn();
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers(),
        json: vi.fn().mockResolvedValue({data: 'test'}),
        text: vi.fn().mockResolvedValue('{"data":"test"}'),
        body: {cancel: cancelSpy},
      };
      mockFetch.mockResolvedValueOnce(mockResponse as unknown as Response);
      const q = new FetchQ({cloneResponseInInterceptor: false});
      q.interceptors.response.push(() => {
        throw new Error('Interceptor error');
      });
      const result = await q.get('/test');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('network');
        expect(
          (result.error as Extract<QError, {type: 'network'}>).message,
        ).toBe('Interceptor error');
      }
      expect(cancelSpy).toHaveBeenCalled();
    });
  });

  // ============================================
  // Error Handling Tests
  // ============================================
  describe('Error Handling', () => {
    test('should return http error for non-ok response', async () => {
      const mockFetch = setupMockFetch();
      mockFetch.mockResolvedValueOnce(
        createMockResponse({error: 'Not found'}, {ok: false, status: 404}),
      );
      const q = new FetchQ();
      const result = await q.get('/not-found');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const httpError = result.error as Extract<QError, {type: 'http'}>;
        expect(httpError.type).toBe('http');
        expect(httpError.status).toBe(404);
      }
    });

    test('should return network error for TypeError', async () => {
      const mockFetch = setupMockFetch();
      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
      const q = new FetchQ();
      const result = await q.get('/network-error');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('network');
      }
    });

    test('should return parse error for invalid JSON', async () => {
      const mockFetch = setupMockFetch();
      mockFetch.mockResolvedValueOnce(
        createMockResponse('invalid json', {ok: true}),
      );
      const q = new FetchQ();
      const result = await q.get('/invalid-json');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('parse');
      }
    });

    test('should return timeout error for TimeoutError DOMException', async () => {
      const mockFetch = setupMockFetch();
      const timeoutError = new DOMException('Timeout', 'TimeoutError');
      mockFetch.mockRejectedValueOnce(timeoutError);
      const q = new FetchQ({timeout: 5000});
      const result = await q.get('/timeout');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const timeoutErr = result.error as Extract<QError, {type: 'timeout'}>;
        expect(timeoutErr.type).toBe('timeout');
        expect(timeoutErr.timeout_ms).toBe(5000);
      }
    });

    test('should return abort error when signal is aborted', async () => {
      const mockFetch = setupMockFetch();
      const abortError = new DOMException('Aborted', 'AbortError');
      mockFetch.mockRejectedValueOnce(abortError);
      const controller = new AbortController();
      controller.abort();
      const q = new FetchQ();
      const result = await q.get('/test', {
        signal: controller.signal,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('abort');
      }
    });

    test('should return network error for other DOMException and non-Error values', async () => {
      const mockFetch = setupMockFetch();
      // 其他 DOMException
      mockFetch.mockRejectedValueOnce(
        new DOMException('Some error', 'NotSupportedError'),
      );
      const q = new FetchQ();
      let result = await q.get('/test');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('network');
        expect(
          (result.error as Extract<QError, {type: 'network'}>).message,
        ).toBe('Some error');
      }

      // 字符串错误
      mockFetch.mockRejectedValueOnce('string error');
      result = await q.get('/test');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('network');
        expect(
          (result.error as Extract<QError, {type: 'network'}>).message,
        ).toBe('Unknown network error');
      }

      // 普通 Error
      mockFetch.mockRejectedValueOnce(new Error('Generic error'));
      result = await q.get('/test');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('network');
        expect(
          (result.error as Extract<QError, {type: 'network'}>).message,
        ).toBe('Generic error');
      }
    });

    test('should handle network error during response parsing', async () => {
      const mockFetch = setupMockFetch();
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers(),
        text: vi
          .fn()
          .mockRejectedValueOnce(new TypeError('Network disconnect')),
        clone: vi.fn().mockReturnThis(),
      };
      mockFetch.mockResolvedValueOnce(mockResponse as unknown as Response);
      const q = new FetchQ();
      const result = await q.get('/test');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('network');
      }
    });
  });

  // ============================================
  // Response Type Tests
  // ============================================
  describe('Response Types', () => {
    test('should parse JSON response by default', async () => {
      const mockFetch = setupMockFetch();
      mockFetch.mockResolvedValueOnce(createMockResponse({name: 'test'}));
      const q = new FetchQ();
      const result = await q.get('/test');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({name: 'test'});
      }
    });

    test('should return text response', async () => {
      const mockFetch = setupMockFetch();
      mockFetch.mockResolvedValueOnce(createMockResponse('plain text'));
      const q = new FetchQ();
      const result = await q.get('/test', {responseType: 'text'});
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe('plain text');
      }
    });

    test('should return blob response', async () => {
      const mockFetch = setupMockFetch();
      const blob = new Blob(['blob data'], {type: 'text/plain'});
      mockFetch.mockResolvedValueOnce(createMockResponse(blob));
      const q = new FetchQ();
      const result = await q.get('/test', {responseType: 'blob'});
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBeInstanceOf(Blob);
      }
    });

    test('should return arrayBuffer response', async () => {
      const mockFetch = setupMockFetch();
      mockFetch.mockResolvedValueOnce(createMockResponse({data: 'test'}));
      const q = new FetchQ();
      const result = await q.get('/test', {
        responseType: 'arrayBuffer',
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBeInstanceOf(ArrayBuffer);
      }
    });

    test('should return stream response', async () => {
      const mockFetch = setupMockFetch();
      const streamContent = new TextEncoder().encode('stream data');
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers(),
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(streamContent);
            controller.close();
          },
        }),
        json: async () => Promise.resolve({data: 'test'}),
        text: async () => Promise.resolve('stream data'),
        clone: function () {
          return this;
        },
      };
      mockFetch.mockResolvedValueOnce(mockResponse as unknown as Response);
      const q = new FetchQ();
      const result = await q.get<ReadableStream<Uint8Array> | null>('/test', {
        responseType: 'stream',
      });
      expect(result.ok).toBe(true);
      if (result.ok && result.value) {
        const reader = result.value.getReader();
        const {value} = await reader.read();
        expect(new TextDecoder().decode(value)).toBe('stream data');
      }
    });

    test('should return null when stream response has no body', async () => {
      const mockFetch = setupMockFetch();
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers(),
        body: null,
        json: async () => Promise.resolve(null),
        text: async () => Promise.resolve(''),
        clone: function () {
          return this;
        },
      };
      mockFetch.mockResolvedValueOnce(mockResponse as unknown as Response);
      const q = new FetchQ();
      const result = await q.get<ReadableStream<Uint8Array> | null>('/test', {
        responseType: 'stream',
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBeNull();
      }
    });

    test('should use custom jsonParser', async () => {
      const mockFetch = setupMockFetch();
      const customParser = vi.fn((text: string): unknown => ({
        ...JSON.parse(text),
        parsed: true,
      }));
      mockFetch.mockResolvedValueOnce(createMockResponse({name: 'test'}));
      const q = new FetchQ({jsonParser: customParser});
      const result = await q.get('/test');
      expect(customParser).toHaveBeenCalled();
      if (result.ok) {
        expect(result.value).toEqual({name: 'test', parsed: true});
      }
    });

    test('should handle empty response body', async () => {
      const mockFetch = setupMockFetch();
      mockFetch.mockResolvedValueOnce(createMockResponse(''));
      const q = new FetchQ();
      const result = await q.get('/test');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBeNull();
      }
    });

    test('should handle parse error with non-Error thrown value', async () => {
      const mockFetch = setupMockFetch();
      const customParser = vi.fn(() => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error -- 测试非 Error 异常的处理
        throw 'string error';
      });
      mockFetch.mockResolvedValueOnce(createMockResponse('{"data":"test"}'));
      const q = new FetchQ({jsonParser: customParser});
      const result = await q.get('/test');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('parse');
        expect((result.error as {type: 'parse'; message: string}).message).toBe(
          'Parse error',
        );
      }
    });
  });

  // ============================================
  // Transform Tests
  // ============================================
  describe('Transform', () => {
    test('should apply global and per-request transform', async () => {
      const mockFetch = setupMockFetch();
      mockFetch.mockResolvedValueOnce(createMockResponse({data: 'test'}));
      const q = new FetchQ({
        transform: (val) => (val as {data: string}).data.toLowerCase(),
      });
      const result = await q.get('/test');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe('test');
      }
    });

    test('should override global transform with per-request transform', async () => {
      const mockFetch = setupMockFetch();
      mockFetch.mockResolvedValueOnce(createMockResponse({data: 'test'}));
      const q = new FetchQ({
        transform: (val) => (val as {data: string}).data.toLowerCase(),
      });
      const result = await q.get('/test', {
        transform: (val: unknown) => (val as {data: string}).data.toUpperCase(),
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe('TEST');
      }
    });
  });

  // ============================================
  // Headers Tests
  // ============================================
  describe('Headers', () => {
    test('should set default headers and merge with request headers', async () => {
      const mockFetch = setupMockFetch();
      mockFetch.mockResolvedValueOnce(createMockResponse({data: 'test'}));
      const q = new FetchQ({default_headers: {'X-Default': 'value'}});
      await q.get('/test', {headers: {'X-Custom': 'custom'}});
      const config = mockFetch.mock.calls[0][1] as RequestInit;
      expect(headerHas(config.headers as Headers, 'X-Default', 'value')).toBe(
        true,
      );
      expect(headerHas(config.headers as Headers, 'X-Custom', 'custom')).toBe(
        true,
      );
    });

    test('should override default headers with request headers', async () => {
      const mockFetch = setupMockFetch();
      mockFetch.mockResolvedValueOnce(createMockResponse({data: 'test'}));
      const q = new FetchQ({default_headers: {'X-Override': 'default'}});
      await q.get('/test', {headers: {'X-Override': 'request'}});
      const config = mockFetch.mock.calls[0][1] as RequestInit;
      expect(
        headerHas(config.headers as Headers, 'X-Override', 'request'),
      ).toBe(true);
    });

    test('should set Content-Type for JSON body', async () => {
      const mockFetch = setupMockFetch();
      mockFetch.mockResolvedValueOnce(createMockResponse({data: 'test'}));
      const q = new FetchQ();
      await q.post('/test', {name: 'test'});
      const config = mockFetch.mock.calls[0][1] as RequestInit;
      expect(
        headerHas(
          config.headers as Headers,
          'Content-Type',
          'application/json',
        ),
      ).toBe(true);
    });

    test('should not override existing Content-Type and Accept headers', async () => {
      const mockFetch = setupMockFetch();
      mockFetch.mockResolvedValueOnce(createMockResponse({data: 'test'}));
      const q = new FetchQ();
      await q.post(
        '/test',
        {name: 'test'},
        {headers: {'Content-Type': 'application/vnd.api+json'}},
      );
      let config = mockFetch.mock.calls[0][1] as RequestInit;
      expect(
        headerHas(
          config.headers as Headers,
          'Content-Type',
          'application/vnd.api+json',
        ),
      ).toBe(true);

      mockFetch.mockResolvedValueOnce(createMockResponse({data: 'test'}));
      await q.get('/test', {headers: {Accept: 'application/xml'}});
      config = mockFetch.mock.calls[1][1] as RequestInit;
      expect(
        headerHas(config.headers as Headers, 'Accept', 'application/xml'),
      ).toBe(true);
    });

    test('should set Accept header based on responseType', async () => {
      const mockFetch = setupMockFetch();
      mockFetch.mockResolvedValueOnce(createMockResponse({data: 'test'}));
      const q = new FetchQ();
      await q.get('/test', {responseType: 'json'});
      const config = mockFetch.mock.calls[0][1] as RequestInit;
      expect(
        headerHas(
          config.headers as Headers,
          'Accept',
          'application/json, text/plain, */*',
        ),
      ).toBe(true);
    });
  });

  // ============================================
  // Body Types Tests
  // ============================================
  describe('Body Types', () => {
    test('should send various body types', async () => {
      const mockFetch = setupMockFetch();
      mockFetch.mockResolvedValue(createMockResponse({data: 'test'})); // auto mock for multiple calls
      const q = new FetchQ();

      // Blob
      const blob = new Blob(['blob content'], {type: 'text/plain'});
      await q.post('/test', blob);
      let config = mockFetch.mock.calls[0][1] as RequestInit;
      expect(config.body).toBe(blob);

      // FormData
      const formData = new FormData();
      formData.append('field', 'value');
      await q.post('/test', formData);
      config = mockFetch.mock.calls[1][1] as RequestInit;
      expect(config.body).toBe(formData);

      // ArrayBuffer
      const buffer = new TextEncoder().encode('test').buffer;
      await q.post('/test', buffer);
      config = mockFetch.mock.calls[2][1] as RequestInit;
      expect(config.body).toBe(buffer);
    });

    test('should use body from options when data is not provided', async () => {
      const mockFetch = setupMockFetch();
      mockFetch.mockResolvedValueOnce(createMockResponse({data: 'test'}));
      const q = new FetchQ();
      const bodyContent = 'raw body content';
      await q.request('/test', {method: 'POST', body: bodyContent});
      const config = mockFetch.mock.calls[0][1] as RequestInit;
      expect(config.body).toBe(bodyContent);
    });
  });

  // ============================================
  // Retry Tests
  // ============================================
  describe('Retry', () => {
    test('should retry on 5xx error', async () => {
      const mockFetch = setupMockFetch();
      mockFetch
        .mockResolvedValueOnce(
          createMockResponse({error: 'Server error'}, {ok: false, status: 500}),
        )
        .mockResolvedValueOnce(createMockResponse({success: true}));
      const q = new FetchQ();
      const result = await q.get('/test', {
        retry: {maxAttempts: 2, initialDelay: 0},
      });
      expect(result.ok).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    test('should not retry on 4xx error (except 429)', async () => {
      const mockFetch = setupMockFetch();
      mockFetch.mockResolvedValueOnce(
        createMockResponse({error: 'Not found'}, {ok: false, status: 404}),
      );
      const q = new FetchQ();
      const result = await q.get('/test', {retry: {maxAttempts: 3}});
      expect(result.ok).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    test('should use custom shouldRetry function', async () => {
      const mockFetch = setupMockFetch();
      mockFetch
        .mockResolvedValueOnce(
          createMockResponse({error: 'Not found'}, {ok: false, status: 404}),
        )
        .mockResolvedValueOnce(createMockResponse({success: true}));
      const q = new FetchQ();
      const shouldRetry = vi.fn(
        (_result: Result<unknown, QError>, attempt: number) => {
          if (attempt === 0) return QContinue(0);
          return QStop(_result);
        },
      );
      const result = await q.get('/test', {
        retry: {shouldRetry, maxAttempts: 3},
      });
      expect(result.ok).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    test('should respect RetryStop from shouldRetry', async () => {
      const mockFetch = setupMockFetch();
      mockFetch.mockResolvedValueOnce(
        createMockResponse({error: 'Error'}, {ok: false, status: 500}),
      );
      const q = new FetchQ();
      const shouldRetry = vi.fn((result: Result<unknown, QError>) =>
        QStop(result),
      );
      const result = await q.get('/test', {retry: {shouldRetry}});
      expect(result.ok).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    test('should retry POST when maxAttempts is explicitly set or retryableMethods includes POST', async () => {
      const mockFetch = setupMockFetch();
      mockFetch
        .mockResolvedValueOnce(
          createMockResponse({error: 'Error'}, {ok: false, status: 500}),
        )
        .mockResolvedValueOnce(createMockResponse({success: true}));
      const q = new FetchQ();
      const result = await q.post(
        '/test',
        {data: 'test'},
        {
          retry: {maxAttempts: 2, initialDelay: 0},
        },
      );
      expect(result.ok).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);

      // retryableMethods 包含 POST
      const mockFetch2 = useMockFetch(); // New context needs new mock? No, still in same test context
      mockFetch2
        .mockResolvedValueOnce(
          createMockResponse({error: 'Error'}, {ok: false, status: 500}),
        )
        .mockResolvedValueOnce(createMockResponse({success: true}));
      const q2 = new FetchQ({retryableMethods: ['GET', 'POST']});
      const result2 = await q2.post(
        '/test',
        {data: 'test'},
        {
          retry: {maxAttempts: 2, initialDelay: 0},
        },
      );
      expect(result2.ok).toBe(true);
    });

    test('should not retry POST when retryableMethods does not include POST', async () => {
      const mockFetch = setupMockFetch();
      mockFetch.mockResolvedValueOnce(
        createMockResponse({error: 'Error'}, {ok: false, status: 500}),
      );
      const q = new FetchQ({retryableMethods: ['GET']});
      const result = await q.post(
        '/test',
        {data: 'test'},
        {
          retry: {},
        },
      );
      expect(result.ok).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    test('should throw error when retrying with ReadableStream body', async () => {
      setupMockFetch(); // need to setup even if not calling, to keep context clean
      const q = new FetchQ();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('test'));
          controller.close();
        },
      });
      await expect(
        q.post('/test', stream, {retry: {maxAttempts: 2}}),
      ).rejects.toThrow('Retry is not supported for ReadableStream body');
    });

    test('should respect Retry-After header', async () => {
      const mockFetch = setupMockFetch();
      const mockResponse429 = {
        ok: false,
        status: 429,
        headers: new Headers({'Retry-After': '0.05'}),
        json: async () => Promise.resolve({error: 'Rate limited'}),
        text: async () => Promise.resolve('{"error":"Rate limited"}'),
        clone: function () {
          return this;
        },
      };
      mockFetch
        .mockResolvedValueOnce(mockResponse429 as unknown as Response)
        .mockResolvedValueOnce(createMockResponse({success: true}));
      const q = new FetchQ();
      const result = await q.get('/test', {
        retry: {maxAttempts: 2, maxDelay: 5000},
      });
      expect(result.ok).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    test('should handle Retry-After header as date', async () => {
      const mockFetch = setupMockFetch();
      const futureDate = new Date(Date.now() + 1000);
      const mockResponseFuture = {
        ok: false,
        status: 429,
        headers: new Headers({'Retry-After': futureDate.toUTCString()}),
        json: async () => Promise.resolve({error: 'Rate limited'}),
        text: async () => Promise.resolve('{"error":"Rate limited"}'),
        clone: function () {
          return this;
        },
      };
      mockFetch
        .mockResolvedValueOnce(mockResponseFuture as unknown as Response)
        .mockResolvedValueOnce(createMockResponse({success: true}));
      const q = new FetchQ();
      const result = await q.get('/test', {
        retry: {maxAttempts: 2, maxDelay: 10},
      });
      expect(result.ok).toBe(true);

      // 过去日期
      const pastDate = new Date(Date.now() - 3600000);
      const mockResponsePast = {
        ok: false,
        status: 429,
        headers: new Headers({'Retry-After': pastDate.toUTCString()}),
        json: async () => Promise.resolve({error: 'Rate limited'}),
        text: async () => Promise.resolve('{"error":"Rate limited"}'),
        clone: function () {
          return this;
        },
      };
      mockFetch
        .mockResolvedValueOnce(mockResponsePast as unknown as Response)
        .mockResolvedValueOnce(createMockResponse({success: true}));
      const result2 = await q.get('/test', {
        retry: {maxAttempts: 2},
      });
      expect(result2.ok).toBe(true);

      // 当前时间
      const nowDate = new Date();
      const mockResponseNow = {
        ok: false,
        status: 429,
        headers: new Headers({'Retry-After': nowDate.toUTCString()}),
        json: async () => Promise.resolve({error: 'Rate limited'}),
        text: async () => Promise.resolve('{"error":"Rate limited"}'),
        clone: function () {
          return this;
        },
      };
      mockFetch
        .mockResolvedValueOnce(mockResponseNow as unknown as Response)
        .mockResolvedValueOnce(createMockResponse({success: true}));
      const result3 = await q.get('/test', {
        retry: {maxAttempts: 2},
      });
      expect(result3.ok).toBe(true);
    });

    test('should handle invalid Retry-After header gracefully', async () => {
      const mockFetch = setupMockFetch();
      const mockResponse429 = {
        ok: false,
        status: 429,
        headers: new Headers({'Retry-After': 'invalid-date-format'}),
        json: async () => Promise.resolve({error: 'Rate limited'}),
        text: async () => Promise.resolve('{"error":"Rate limited"}'),
        clone: function () {
          return this;
        },
      };
      mockFetch
        .mockResolvedValueOnce(mockResponse429 as unknown as Response)
        .mockResolvedValueOnce(createMockResponse({success: true}));
      const q = new FetchQ();
      const result = await q.get('/test', {
        retry: {maxAttempts: 2, initialDelay: 0},
      });
      expect(result.ok).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    test('should retry on 429 status', async () => {
      const mockFetch = setupMockFetch();
      const mockResponse429 = {
        ok: false,
        status: 429,
        headers: new Headers(),
        json: async () => Promise.resolve({error: 'Rate limited'}),
        text: async () => Promise.resolve('{"error":"Rate limited"}'),
        clone: function () {
          return this;
        },
      };
      mockFetch
        .mockResolvedValueOnce(mockResponse429 as unknown as Response)
        .mockResolvedValueOnce(createMockResponse({success: true}));
      const q = new FetchQ();
      const result = await q.get('/test', {
        retry: {maxAttempts: 2, initialDelay: 0},
      });
      expect(result.ok).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    test('should retry on timeout and network error', async () => {
      const mockFetch = setupMockFetch();
      const timeoutError = new DOMException('Timeout', 'TimeoutError');
      mockFetch
        .mockRejectedValueOnce(timeoutError)
        .mockResolvedValueOnce(createMockResponse({success: true}));
      const q = new FetchQ({timeout: 5000});
      const result = await q.get('/test', {
        retry: {maxAttempts: 2, initialDelay: 0},
      });
      expect(result.ok).toBe(true);

      // 网络错误
      mockFetch
        .mockRejectedValueOnce(new TypeError('Network error'))
        .mockResolvedValueOnce(createMockResponse({success: true}));
      const result2 = await q.get('/test', {
        retry: {maxAttempts: 2, initialDelay: 0},
      });
      expect(result2.ok).toBe(true);
    });

    test('should update config from RetryContinue', async () => {
      const mockFetch = setupMockFetch();
      mockFetch
        .mockResolvedValueOnce(
          createMockResponse({error: 'Error'}, {ok: false, status: 500}),
        )
        .mockResolvedValueOnce(createMockResponse({success: true}));
      const q = new FetchQ();
      const result = await q.get('/test', {
        retry: {
          maxAttempts: 2,
          initialDelay: 0,
          shouldRetry: (result: Result<unknown, QError>, attempt: number) => {
            if (attempt === 0) return QContinue(0, {headers: {'X-Retry': '1'}});
            return QStop(result);
          },
        },
      });
      expect(result.ok).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    test('should update config from RetryContinue without headers', async () => {
      const mockFetch = setupMockFetch();
      mockFetch
        .mockResolvedValueOnce(
          createMockResponse({error: 'Error'}, {ok: false, status: 500}),
        )
        .mockResolvedValueOnce(createMockResponse({success: true}));
      const q = new FetchQ();
      const result = await q.get('/test', {
        retry: {
          maxAttempts: 2,
          initialDelay: 0,
          shouldRetry: (result: Result<unknown, QError>, attempt: number) => {
            if (attempt === 0) return QContinue(0, {method: 'POST'});
            return QStop(result);
          },
        },
      });
      expect(result.ok).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    test('should use exponential backoff with jitter', async () => {
      const mockFetch = setupMockFetch();
      mockFetch
        .mockResolvedValueOnce(
          createMockResponse({error: 'Error'}, {ok: false, status: 500}),
        )
        .mockResolvedValueOnce(createMockResponse({success: true}));
      const q = new FetchQ();
      const result = await q.get('/test', {
        retry: {maxAttempts: 2, initialDelay: 1, maxDelay: 10},
      });
      expect(result.ok).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    test('should not retry when maxAttempts is 0', async () => {
      const mockFetch = setupMockFetch();
      mockFetch.mockResolvedValueOnce(
        createMockResponse({error: 'Error'}, {ok: false, status: 500}),
      );
      const q = new FetchQ();
      const result = await q.get('/test', {retry: {maxAttempts: 0}});
      expect(result.ok).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    test('should not retry when retryableMethods is empty', async () => {
      const mockFetch = setupMockFetch();
      mockFetch.mockResolvedValueOnce(
        createMockResponse({error: 'Error'}, {ok: false, status: 500}),
      );
      const q = new FetchQ({retryableMethods: []});
      const result = await q.get('/test');
      expect(result.ok).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    test('should retry when retryableMethods is null', async () => {
      const mockFetch = setupMockFetch();
      mockFetch
        .mockResolvedValueOnce(
          createMockResponse({error: 'Error'}, {ok: false, status: 500}),
        )
        .mockResolvedValueOnce(createMockResponse({success: true}));
      const q = new FetchQ({retryableMethods: null});
      const result = await q.get('/test', {
        retry: {maxAttempts: 2, initialDelay: 0},
      });
      expect(result.ok).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    test('should check method retryable when retryableMethods is null without maxAttempts', async () => {
      const mockFetch = setupMockFetch();
      mockFetch.mockResolvedValueOnce(
        createMockResponse({error: 'Error'}, {ok: false, status: 500}),
      );
      const q = new FetchQ({retryableMethods: null});
      const result = await q.get('/test', {retry: {}});
      expect(result.ok).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    test('should handle abort signal during retry delay', async () => {
      const mockFetch = setupMockFetch();
      mockFetch.mockResolvedValueOnce(
        createMockResponse({error: 'Error'}, {ok: false, status: 500}),
      );
      const controller = new AbortController();
      const q = new FetchQ();
      setTimeout(() => controller.abort(), 5);
      const result = await q.get('/test', {
        signal: controller.signal,
        retry: {maxAttempts: 2, initialDelay: 1000},
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(['abort', 'network']).toContain(result.error.type);
      }
    });

    test('should handle timeout during retry delay without external signal', async () => {
      const mockFetch = setupMockFetch();
      mockFetch.mockResolvedValueOnce(
        createMockResponse({error: 'Error'}, {ok: false, status: 500}),
      );
      const q = new FetchQ({timeout: 10});
      const result = await q.get('/test', {
        retry: {maxAttempts: 2, initialDelay: 1000},
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(['timeout', 'network']).toContain(result.error.type);
      }
    });

    test('should handle request without explicit method (default GET for retry check)', async () => {
      const mockFetch = setupMockFetch();
      mockFetch
        .mockResolvedValueOnce(
          createMockResponse({error: 'Error'}, {ok: false, status: 500}),
        )
        .mockResolvedValueOnce(createMockResponse({success: true}));
      const q = new FetchQ();
      const result = await q.request('/test', {
        retry: {maxAttempts: 2, initialDelay: 0},
      });
      expect(result.ok).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    test('should use default initialDelay when not provided', async () => {
      const mockFetch = setupMockFetch();
      mockFetch
        .mockResolvedValueOnce(
          createMockResponse({error: 'Error'}, {ok: false, status: 500}),
        )
        .mockResolvedValueOnce(createMockResponse({success: true}));
      const q = new FetchQ();
      const result = await q.get('/test', {
        retry: {maxAttempts: 2, maxDelay: 10},
      });
      expect(result.ok).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  // ============================================
  // Progress Callback Tests
  // ============================================
  describe('Progress Callback', () => {
    test('should mark FormData upload as indeterminate', async () => {
      const mockFetch = setupMockFetch();
      mockFetch.mockResolvedValueOnce(createMockResponse({success: true}));
      const q = new FetchQ();
      const progressEvents: ProgressEvent[] = [];
      const formData = new FormData();
      formData.append('file', new Blob(['content']), 'test.txt');
      await q.post('/upload', formData, {
        onUploadProgress: (event: ProgressEvent) => progressEvents.push(event),
      });
      expect(progressEvents.length).toBe(1);
      expect(progressEvents[0].indeterminate).toBe(true);
    });

    const createProgressMockFetch = () => {
      const mockFetch = setupMockFetch();
      mockFetch.mockImplementation(
        async (
          _input: string | Request | URL,
          config?: RequestInit,
        ): Promise<Response> => {
          if (config?.body && config.body instanceof ReadableStream) {
            const reader = (config.body as ReadableStream).getReader();
            while (true) {
              const {done} = await reader.read();
              if (done) break;
            }
          }
          return createMockResponse({success: true});
        },
      );
      return mockFetch;
    };

    test('should report upload progress for various body types', async () => {
      createProgressMockFetch();
      const q = new FetchQ();

      // String body
      let progressEvents: ProgressEvent[] = [];
      await q.post('/upload', 'test content', {
        onUploadProgress: (event: ProgressEvent) => progressEvents.push(event),
      });
      expect(progressEvents.length).toBeGreaterThan(0);
      expect(progressEvents[progressEvents.length - 1].percentage).toBe(100);
      expect(progressEvents[0].indeterminate).toBe(false);

      // Blob body
      progressEvents = [];
      const blob = new Blob(['blob content for test'], {type: 'text/plain'});
      await q.post('/upload', blob, {
        onUploadProgress: (event: ProgressEvent) => progressEvents.push(event),
      });
      expect(progressEvents.length).toBeGreaterThan(0);
      expect(progressEvents[progressEvents.length - 1].percentage).toBe(100);

      // ArrayBuffer body
      progressEvents = [];
      const buffer = new TextEncoder().encode('array buffer content').buffer;
      await q.post('/upload', buffer, {
        onUploadProgress: (event: ProgressEvent) => progressEvents.push(event),
      });
      expect(progressEvents.length).toBeGreaterThan(0);
      expect(progressEvents[progressEvents.length - 1].percentage).toBe(100);

      // TypedArray body
      progressEvents = [];
      const uint8Array = new TextEncoder().encode('typed array content');
      await q.post('/upload', uint8Array, {
        onUploadProgress: (event: ProgressEvent) => progressEvents.push(event),
      });
      expect(progressEvents.length).toBeGreaterThan(0);
      expect(progressEvents[progressEvents.length - 1].percentage).toBe(100);

      // URLSearchParams body
      progressEvents = [];
      const params = new URLSearchParams({key: 'value', foo: 'bar'});
      await q.post('/upload', params, {
        onUploadProgress: (event: ProgressEvent) => progressEvents.push(event),
      });
      expect(progressEvents.length).toBeGreaterThan(0);
      expect(progressEvents[progressEvents.length - 1].percentage).toBe(100);

      // DataView body (ArrayBuffer.isView but not TypedArray)
      progressEvents = [];
      const dvBuffer = new TextEncoder().encode('dataview content').buffer;
      const dataView = new DataView(dvBuffer);
      await q.post('/upload', dataView, {
        onUploadProgress: (event: ProgressEvent) => progressEvents.push(event),
      });
      expect(progressEvents.length).toBeGreaterThan(0);
      expect(progressEvents[progressEvents.length - 1].percentage).toBe(100);

      // ReadableStream body
      progressEvents = [];
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('stream content'));
          controller.close();
        },
      });
      await q.post('/upload', stream, {
        onUploadProgress: (event: ProgressEvent) => progressEvents.push(event),
      });
      expect(progressEvents.length).toBeGreaterThan(0);
      expect(progressEvents[progressEvents.length - 1].percentage).toBe(100);
      expect(progressEvents[0].indeterminate).toBe(true);
    });

    test('should handle upload progress with null or empty body', async () => {
      const mockFetch = setupMockFetch();
      mockFetch.mockResolvedValue(createMockResponse({success: true}));
      const q = new FetchQ();
      let progressEvents: ProgressEvent[] = [];
      await q.post('/upload', null, {
        onUploadProgress: (event: ProgressEvent) => progressEvents.push(event),
      });
      expect(progressEvents.length).toBe(0);

      progressEvents = [];
      await q.post('/upload', '', {
        onUploadProgress: (event: ProgressEvent) => progressEvents.push(event),
      });
      expect(progressEvents.length).toBe(0);
    });

    test('should handle download progress callback', async () => {
      const mockFetch = setupMockFetch();
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({'content-length': '100'}),
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('{"success":true}'));
            controller.close();
          },
        }),
        json: async () => Promise.resolve({success: true}),
        text: async () => Promise.resolve('{"success":true}'),
        clone: function () {
          return this;
        },
      };
      mockFetch.mockResolvedValueOnce(mockResponse as unknown as Response);
      const q = new FetchQ();
      const progressEvents: ProgressEvent[] = [];
      const result = await q.get('/download', {
        onDownloadProgress: (event: ProgressEvent) =>
          progressEvents.push(event),
      });
      expect(result.ok).toBe(true);
      expect(progressEvents.length).toBeGreaterThan(0);
      expect(progressEvents[progressEvents.length - 1].percentage).toBe(100);
    });

    test('should handle download progress with indeterminate size', async () => {
      const mockFetch = setupMockFetch();
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers(),
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('{"success":true}'));
            controller.close();
          },
        }),
        json: async () => Promise.resolve({success: true}),
        text: async () => Promise.resolve('{"success":true}'),
        clone: function () {
          return this;
        },
      };
      mockFetch.mockResolvedValueOnce(mockResponse as unknown as Response);
      const q = new FetchQ();
      const progressEvents: ProgressEvent[] = [];
      const result = await q.get('/download', {
        onDownloadProgress: (event: ProgressEvent) =>
          progressEvents.push(event),
      });
      expect(result.ok).toBe(true);
      expect(progressEvents.length).toBeGreaterThan(0);
      expect(progressEvents[0].indeterminate).toBe(true);
    });

    test('should report download progress for stream response', async () => {
      const mockFetch = setupMockFetch();
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({'content-length': '10'}),
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('stream'));
            controller.close();
          },
        }),
        json: async () => Promise.resolve({data: 'test'}),
        text: async () => Promise.resolve('stream'),
        clone: function () {
          return this;
        },
      };
      mockFetch.mockResolvedValueOnce(mockResponse as unknown as Response);
      const q = new FetchQ();
      const progressEvents: ProgressEvent[] = [];
      const result = await q.get<ReadableStream<Uint8Array> | null>('/test', {
        responseType: 'stream',
        onDownloadProgress: (event: ProgressEvent) =>
          progressEvents.push(event),
      });
      expect(result.ok).toBe(true);
      if (result.ok && result.value) {
        const reader = result.value.getReader();
        while (true) {
          const {done} = await reader.read();
          if (done) break;
        }
      }
      expect(progressEvents.length).toBeGreaterThan(0);
      expect(progressEvents[progressEvents.length - 1].percentage).toBe(100);
    });
  });

  // ============================================
  // Request Object Tests
  // ============================================
  describe('Request Object', () => {
    test('should accept Request object', async () => {
      const mockFetch = setupMockFetch();
      mockFetch.mockResolvedValueOnce(createMockResponse({data: 'test'}));
      const q = new FetchQ();
      const request = new Request('https://api.example.com/test', {
        method: 'POST',
        headers: {'X-Custom': 'value'},
      });
      const result = await q.request(request);
      expect(result.ok).toBe(true);
    });

    test('should merge Request headers with config headers', async () => {
      const mockFetch = setupMockFetch();
      mockFetch.mockResolvedValueOnce(createMockResponse({data: 'test'}));
      const q = new FetchQ();
      const request = new Request('https://api.example.com/test', {
        method: 'POST',
        headers: {'X-Request': 'value'},
      });
      await q.request(request, {headers: {'X-Config': 'value'}});
      const config = mockFetch.mock.calls[0][1] as RequestInit;
      expect(headerHas(config.headers as Headers, 'X-Request', 'value')).toBe(
        true,
      );
      expect(headerHas(config.headers as Headers, 'X-Config', 'value')).toBe(
        true,
      );
    });

    test('should override Request body when data parameter is provided', async () => {
      const mockFetch = setupMockFetch();
      mockFetch.mockResolvedValueOnce(createMockResponse({data: 'test'}));
      const q = new FetchQ();
      const request = new Request('https://api.example.com/test', {
        method: 'POST',
        body: 'original body',
      });
      await q.request(request, {}, 'new data');
      const config = mockFetch.mock.calls[0][1] as RequestInit;
      expect(config.body).toBe('new data');
    });
  });

  // ============================================
  // Edge Cases Tests
  // ============================================
  describe('Edge Cases', () => {
    test('should handle null, undefined, and empty object data', async () => {
      const mockFetch = setupMockFetch();
      mockFetch.mockResolvedValue(createMockResponse({success: true}));
      const q = new FetchQ();

      // null
      let result = await q.post('/test', null);
      expect(result.ok).toBe(true);

      // undefined
      result = await q.post('/test', undefined);
      expect(result.ok).toBe(true);

      // 空对象
      result = await q.post('/test', {});
      expect(result.ok).toBe(true);
      const config = mockFetch.mock.calls[2][1] as RequestInit;
      expect(config.body).toBe('{}');
    });
  });

  // ============================================
  // maxErrorBodySize Tests
  // ============================================
  describe('maxErrorBodySize', () => {
    test('should limit error body size when response exceeds maxErrorBodySize', async () => {
      const mockFetch = setupMockFetch();
      const largeContent = 'x'.repeat(200);
      const mockResponse = {
        ok: false,
        status: 500,
        headers: new Headers(),
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(largeContent));
            controller.close();
          },
        }),
        json: async () => Promise.resolve({error: 'Server error'}),
        text: async () => Promise.resolve(largeContent),
        clone: function () {
          return this;
        },
      };
      mockFetch.mockResolvedValueOnce(mockResponse as unknown as Response);
      const q = new FetchQ({maxErrorBodySize: 100});
      const result = await q.get('/test');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const httpError = result.error as Extract<QError, {type: 'http'}>;
        expect(httpError.type).toBe('http');
        expect(httpError.body).toBeUndefined();
      }
    });

    test('should read error body within maxErrorBodySize limit', async () => {
      const mockFetch = setupMockFetch();
      const errorBody = JSON.stringify({error: 'Not found', code: 404});
      const mockResponse = {
        ok: false,
        status: 404,
        headers: new Headers({'Content-Length': String(errorBody.length)}),
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(errorBody));
            controller.close();
          },
        }),
        json: async () => Promise.resolve({error: 'Not found'}),
        text: async () => Promise.resolve(errorBody),
        clone: function () {
          return this;
        },
      };
      mockFetch.mockResolvedValueOnce(mockResponse as unknown as Response);
      const q = new FetchQ({maxErrorBodySize: 1000});
      const result = await q.get('/test');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const httpError = result.error as Extract<QError, {type: 'http'}>;
        expect(httpError.type).toBe('http');
        expect(httpError.body).toBe(errorBody);
      }
    });

    test('should handle error body read failure gracefully', async () => {
      const mockFetch = setupMockFetch();
      const readError = new Error('Stream read error');
      const mockResponse = {
        ok: false,
        status: 500,
        headers: new Headers(),
        body: new ReadableStream({
          pull() {
            throw readError;
          },
        }),
        json: async () => Promise.resolve({error: 'Server error'}),
        text: async () => Promise.resolve('error'),
        clone: function () {
          return this;
        },
      };
      mockFetch.mockResolvedValueOnce(mockResponse as unknown as Response);
      const q = new FetchQ({maxErrorBodySize: 1000});
      const result = await q.get('/test');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const httpError = result.error as Extract<QError, {type: 'http'}>;
        expect(httpError.type).toBe('http');
        expect(httpError.body).toBeUndefined();
      }
    });

    test('should return undefined when maxErrorBodySize is 0', async () => {
      const mockFetch = setupMockFetch();
      mockFetch.mockResolvedValueOnce(
        createMockResponse({error: 'Server error'}, {ok: false, status: 500}),
      );
      const q = new FetchQ({maxErrorBodySize: 0});
      const result = await q.get('/test');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const httpError = result.error as Extract<QError, {type: 'http'}>;
        expect(httpError.type).toBe('http');
        expect(httpError.body).toBeUndefined();
      }
    });

    test('should handle error response without body', async () => {
      const mockFetch = setupMockFetch();
      const mockResponse = {
        ok: false,
        status: 500,
        headers: new Headers(),
        body: null,
        json: async () => Promise.resolve(null),
        text: async () => Promise.resolve(''),
        clone: function () {
          return this;
        },
      };
      mockFetch.mockResolvedValueOnce(mockResponse as unknown as Response);
      const q = new FetchQ({maxErrorBodySize: 1000});
      const result = await q.get('/test');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const httpError = result.error as Extract<QError, {type: 'http'}>;
        expect(httpError.type).toBe('http');
        expect(httpError.body).toBeUndefined();
      }
    });

    test('should handle error response with Content-Length exceeding limit', async () => {
      const mockFetch = setupMockFetch();
      const mockResponse = {
        ok: false,
        status: 500,
        headers: new Headers({'Content-Length': '10000'}),
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('large content'));
            controller.close();
          },
        }),
        json: async () => Promise.resolve({error: 'Server error'}),
        text: async () => Promise.resolve('large content'),
        clone: function () {
          return this;
        },
      };
      mockFetch.mockResolvedValueOnce(mockResponse as unknown as Response);
      const q = new FetchQ({maxErrorBodySize: 100});
      const result = await q.get('/test');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const httpError = result.error as Extract<QError, {type: 'http'}>;
        expect(httpError.type).toBe('http');
        expect(httpError.body).toBeUndefined();
      }
    });
  });
});
