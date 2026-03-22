# Ignored Segments

在本项目中，部分代码段被标记为跳过单元测试覆盖率统计（使用 `/* v8 ignore */` 注释）。

***

## 一、整文件忽略

### 1. Errors.ts

**位置：** [src/Errors.ts](../../src/Errors.ts)

```typescript
/* v8 ignore file -- @preserve */
```

**跳过原因：** 自定义错误类只是 `Error` 的别名扩展，仅设置 `name` 属性和可选的 `captureStackTrace`，逻辑极其简单，无需单独测试

***

### 2. Fit/sugar.ts

**位置：** [src/Fit/sugar.ts](../../src/Fit/sugar.ts)

```typescript
/* v8 ignore file -- @preserve */
```

**跳过原因：** 语法糖文件，所有函数仅是对 `new Fit()` 的简单封装调用，核心逻辑由 `Fit` 类实现，已通过 `Fit` 类的测试覆盖

***

### 3. Fit/tool.ts

**位置：** [src/Fit/tool.ts](../../src/Fit/tool.ts)

```typescript
/* v8 ignore file -- @preserve */
```

**跳过原因：** 类型守卫工具函数，均为单行 `typeof` 或 `instanceof` 判断，逻辑过于简单

***

### 4. Utils/type-tool.ts

**位置：** [src/Utils/type-tool.ts](../../src/Utils/type-tool.ts)

```typescript
/* v8 ignore file -- @preserve */
```

**跳过原因：** 纯类型工具定义文件，仅包含 TypeScript 类型别名和工具类型，无运行时逻辑

***

## 二、环境兼容性代码

### 1. Error.captureStackTrace

**位置：** [src/Errors.ts](../../src/Errors.ts)

```typescript
if (typeof Error.captureStackTrace === 'function')
  Error.captureStackTrace(this, UseAfterFreeError);
```

**跳过原因：** V8 引擎（Node.js/Chrome）特有的 API，其稳定性由宿主环境保障，且在非 V8 环境下优雅降级

***

### 2. 测试辅助函数

**位置：** [src/helper.ts](../../src/helper.ts)

```typescript
/* v8 ignore next -- @preserve */
export const flushPromises = (): Promise<void> => {
  return new Promise((resolve) => queueMacroTask(resolve));
};

/* v8 ignore next -- @preserve */
export const queueMacroTask = (() => {
  if (typeof setImmediate === 'function') return setImmediate;
  if (typeof MessageChannel !== 'undefined') { ... }
  return setTimeout;
})();
```

**跳过原因：** 测试辅助函数，用于测试环境中的 Promise 刷新和宏任务调度，其正确性由使用它的测试间接验证

***

### 3. FetchQ 环境检测

**位置：** [src/Other/FetchQ.ts](../../src/Other/FetchQ.ts)

```typescript
// 协议相对路径处理
/* v8 ignore start -- @preserve */
} else if (typeof window !== 'undefined') {
  protocol = window.location.protocol;
} else {
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

**跳过原因：** 浏览器/Node.js 环境兼容性代码，测试环境（Node.js）无法模拟 `window` 对象的存在性分支

***

### 4. debounce 环境检测

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
  throw new ParameterError(...);

// RAF 与 max_wait 不兼容检测
/* v8 ignore next -- @preserve */
if (wait === useRAF && max_wait != null)
  throw new ParameterError(...);
```

**跳过原因：** 环境特性检测和边界条件校验，Node.js 测试环境不支持 `requestAnimationFrame`，且这些分支在正常使用中不会触发

***

### 5. VirtualTimeManager.realFlushPromises

**位置：** [src/MockClock/VirtualTimeManager.ts](../../src/MockClock/VirtualTimeManager.ts)

```typescript
/* v8 ignore next -- @preserve */
public realFlushPromises(): Promise<void> {
  if (typeof this.orig.setImmediate === 'function') { ... }
  if (typeof this.orig.MessageChannel !== 'undefined') { ... }
  return new Promise((resolve) => this.orig.setTimeout(resolve, 0));
}
```

**跳过原因：**跨环境难以验证

***

## 三、类型穷尽分支

### 1. FetchQ BodyInit 类型处理

**位置：** [src/Other/FetchQ.ts](../../src/Other/FetchQ.ts)

```typescript
/* v8 ignore start -- @preserve */ else {
  // 已经覆盖BodyInit的所有类型，这里不会执行
}
/* v8 ignore stop -- @preserve */
```

**跳过原因：** TypeScript 类型系统已确保所有 `BodyInit` 类型分支被覆盖，此 `else` 分支仅作为编译时安全保障，运行时永远不会执行

***

