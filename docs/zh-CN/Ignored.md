# Ignored Segments

在本项目中，部分代码段被标记为跳过单元测试覆盖率统计（使用 `/* v8 ignore */` 注释）。

---

## 一、整文件忽略

### 1. Errors.ts

**位置：** [src/Errors.ts](../../src/Errors.ts)

```typescript
/* v8 ignore file -- @preserve */
```

**跳过原因：** 自定义错误类只是 `Error` 的别名扩展，仅设置 `name` 属性和可选的 `captureStackTrace`，逻辑极其简单，无需单独测试

---

### 2. Fit/sugar.ts

**位置：** [src/Fit/sugar.ts](../../src/Fit/sugar.ts)

```typescript
/* v8 ignore file -- @preserve */
```

**跳过原因：** 语法糖文件，所有函数仅是对 `new Fit()` 的简单封装调用，核心逻辑由 `Fit` 类实现

---

### 3. Fit/tool.ts

**位置：** [src/Fit/tool.ts](../../src/Fit/tool.ts)

```typescript
/* v8 ignore file -- @preserve */
```

**跳过原因：** 类型守卫工具函数，均为单行 `typeof` 或 `instanceof` 判断，逻辑过于简单

---

### 4. Utils/type-tool.ts

**位置：** [src/Utils/type-tool.ts](../../src/Utils/type-tool.ts)

```typescript
/* v8 ignore file -- @preserve */
```

**跳过原因：** 纯类型工具定义文件，仅包含 TypeScript 类型别名和工具类型，无运行时逻辑

---

## 二、环境兼容性代码

---

### 1. CircuitBreakerOpenError.captureStackTrace

**位置：** [src/Concurrent/Valve/circuit-breaker.ts](../../src/Concurrent/Valve/circuit-breaker.ts)

```typescript
/* v8 ignore next -- @preserve */
if (typeof Error.captureStackTrace === 'function')
  Error.captureStackTrace(this, CircuitBreakerOpenError);
```

**跳过原因：** V8 引擎特有的 API，在非 V8 环境下优雅降级

---

### 2. LeakyBucketReject.captureStackTrace

**位置：** [src/Concurrent/Valve/leaky-bucket.ts](../../src/Concurrent/Valve/leaky-bucket.ts)

```typescript
/* v8 ignore next -- @preserve */
if (typeof Error.captureStackTrace === 'function')
  Error.captureStackTrace(this, LeakyBucketReject);
```

**跳过原因：** V8 引擎特有的 API，在非 V8 环境下优雅降级

---

### 3. 测试辅助函数

**位置：** [src/helper.ts](../../src/helper.ts)

```typescript
/* v8 ignore next -- @preserve */
export const flushPromises = (): Promise<void> => {
  return new Promise((resolve) => queueMacroTask(resolve));
};

/* v8 ignore next -- @preserve */
export const queueMacroTask = (() => {
  if (typeof setImmediate === 'function') return setImmediate;
  if (typeof MessageChannel !== 'undefined') {...}
  return (callback: VoidFunction) => setTimeout(callback, 0);
})();
```

**跳过原因：** 环境原因，难以验证

---

### 4. FetchQ 环境检测

**位置：** [src/Other/FetchQ.ts](../../src/Other/FetchQ.ts)

```typescript
// 协议相对路径处理
/* v8 ignore start -- @preserve */
} else if (typeof window !== 'undefined') {
  // 浏览器环境下，使用当前页面的协议
  protocol = window.location.protocol;
} else {
  // Node.js 环境下默认使用 http
  protocol = 'http:';
}
/* v8 ignore stop -- @preserve */

// baseUrl 默认值处理
/* v8 ignore start -- @preserve */
effectiveBase =
  typeof window !== 'undefined'
    ? window.location.origin
    : 'http://localhost';
/* v8 ignore stop -- @preserve */
```

**跳过原因：** 浏览器/Node.js 环境兼容性代码，测试环境（Node.js）无法模拟其行为

---

### 7. debounce 环境检测

**位置：** [src/Utils/Functions/debounce.ts](../../src/Utils/Functions/debounce.ts)

```typescript
// 时间获取函数
/* v8 ignore next -- @preserve */
private static getTime = (() => {
  return typeof performance !== 'undefined'
    ? performance.now.bind(performance)
    : Date.now;
})();

// requestAnimationFrame 支持检测
/* v8 ignore next -- @preserve */
if (wait === useRAF && typeof requestAnimationFrame !== 'function')


// RAF 与 max_wait 不兼容检测
/* v8 ignore next -- @preserve */
if (wait === useRAF && max_wait != null)
```

**跳过原因：** 环境特性检测和边界条件校验，Node.js 测试环境不支持 `requestAnimationFrame`

---

### 8. VirtualTimeManager.realFlushPromises

**位置：** [src/MockClock/VirtualTimeManager.ts](../../src/MockClock/VirtualTimeManager.ts)

```typescript
/* v8 ignore next -- @preserve */
public realFlushPromises(): Promise<void> {
  if (typeof this.orig.setImmediate === 'function'){...}
  if (typeof this.orig.MessageChannel !== 'undefined'){...}
  return new Promise((resolve) => {
    this.orig.setTimeout(resolve, 0);
  });
}
```

**跳过原因：** 代码包含多种环境降级策略（setImmediate → MessageChannel → setTimeout），在不同运行环境中执行行为不同，无法覆盖

---

### 9. TokenBucket.getTime

**位置：** [src/Concurrent/Valve/token-bucket.ts](../../src/Concurrent/Valve/token-bucket.ts)

```typescript
/* v8 ignore next -- @preserve */
private static getTime = (() => {
  return typeof performance !== 'undefined'
    ? performance.now.bind(performance)
    : Date.now;
})();
```

**跳过原因：** 环境特性检测，在 Node.js 环境下 `performance` 始终可用（测试中已验证了`Date.now`）

---

## 三、类型穷尽分支

### 1. FetchQ BodyInit 类型处理

**位置：** [src/Other/FetchQ.ts](../../src/Other/FetchQ.ts)

```typescript
/* v8 ignore start -- @preserve */ else {
  // 已覆盖 BodyInit 所有类型
}
/* v8 ignore stop -- @preserve */
```

**跳过原因：** TypeScript 类型系统已确保所有 BodyInit 类型分支被穷尽处理。此 else 分支仅用于放置 v8 ignore 标记以提升覆盖率报告，运行时永远不会执行

---

## 四、debounce RAF 相关分支

**位置：** [src/Utils/Functions/debounce.ts](../../src/Utils/Functions/debounce.ts)

```typescript
// RAF期间，不允许Call
/* v8 ignore if -- @preserve */
if (this.wait === useRAF) return this.timer_id === null;

// RAF模式下返回0
/* v8 ignore if -- @preserve */
if (this.wait === useRAF) return 0;

// RAF模式下使用 requestAnimationFrame
/* v8 ignore if -- @preserve */
if (this.wait === useRAF) {
  this.timer_id = requestAnimationFrame(() => Debounced.Task(this));
}

// RAF模式下使用 cancelAnimationFrame
/* v8 ignore if -- @preserve */
if (this.wait === useRAF) cancelAnimationFrame(this.timer_id as number);
```

**跳过原因：** RAF（requestAnimationFrame）相关代码仅在浏览器环境执行，Node.js 测试环境不支持

---

## 五、工厂函数

**位置：** [src/Utils/Functions/debounce.ts](../../src/Utils/Functions/debounce.ts)

```typescript
/* v8 ignore next -- @preserve */
export function createDebounce<A extends readonly unknown[], R>(...): DebouncedFunction<A, R, ThisParameterType<typeof fn>>

/* v8 ignore next -- @preserve */
export function createThrottle<A extends readonly unknown[], R>(...): ThrottledFunction<A, R, ThisParameterType<typeof fn>> 
```

**跳过原因：** 工厂函数是对 `Debounced` 类的简单包装，核心逻辑已在类测试中覆盖
