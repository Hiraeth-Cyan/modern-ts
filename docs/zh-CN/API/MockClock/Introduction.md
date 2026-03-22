# MockClock

MockClock 是一个强大的虚拟时间模拟器，用于在测试环境中完全控制时间流逝。它可以劫持全局时间相关 API，让你能够精确控制 `Date`、`setTimeout`、`setInterval`、`performance.now()` 等时间相关函数的行为。

## 核心概念

### 虚拟时间线（Timeline）

Timeline 是 MockClock 的核心概念。每个 Timeline 代表一个独立的虚拟时间线，拥有自己的时间状态和定时器队列。你可以创建多个 Timeline 来隔离不同的测试场景。

### 劫持机制

MockClock 通过替换全局对象（如 `Date`、`setTimeout` 等）来实现时间模拟。当调用 `MockClock()` 时，会自动初始化全局劫持。所有时间相关 API 会根据当前执行上下文自动路由到对应的虚拟时间线或真实实现。

### 冻结模式

默认情况下，Timeline 创建后处于冻结状态，时间不会自动流逝。这确保了测试的可预测性——只有显式调用 `tick()` 等方法时，时间才会前进。

## 特性亮点

### 并发测试支持

MockClock 底层使用 Node.js 的 `AsyncLocalStorage` 实现上下文隔离，支持多个 Timeline 同时运行而互不干扰。这使得并发测试成为可能：

```typescript
// 多个测试可以并发执行，各自拥有独立的时间线
await Promise.all([
  withTimelineAsync(MockClock(), async () => {
    const clock = MockClock();
    setTimeout(() => console.log('Timeline A: 100ms'), 100);
    await clock.tickAsync(100);
  }),
  withTimelineAsync(MockClock(), async () => {
    const clock = MockClock();
    setTimeout(() => console.log('Timeline B: 500ms'), 500);
    await clock.tickAsync(500);
  }),
]);
```

> **环境限制：** 由于 `AsyncLocalStorage` 是 Node.js 特有 API，MockClock **仅支持 Node.js 环境**，无法在浏览器的运行时中使用。

### 深度模拟 NodeJS.Timeout

MockClock 不仅模拟定时器的触发时机，还深度模拟了 `NodeJS.Timeout` 句柄对象。返回的句柄完全兼容原生接口，支持：

- `ref()` / `unref()` / `hasRef()` — 引用计数控制
- `refresh()` — 刷新定时器
- `close()` — 关闭定时器
- `[Symbol.dispose]` — 支持显式资源管理语法
- `[Symbol.toPrimitive]` — 转换为数字 ID

```typescript
const clock = MockClock();
runTimeline(clock, () => {
  const handle = setTimeout(() => {}, 1000);

  // 完全兼容 NodeJS.Timeout 接口
  handle.unref();
  console.log(handle.hasRef()); // false
  handle.ref();
  console.log(handle.hasRef()); // true

  // 支持刷新定时器
  handle.refresh();

  // 支持显式资源管理
  handle.close();
  // 或使用 Symbol.dispose
  handle[Symbol.dispose]();
});
```

## 快速开始

### 基础用法

```typescript
const clock = MockClock();

runTimeline(clock, () => {
  // 在此回调内，所有时间 API 都被模拟

  let called = false;
  setTimeout(() => {
    called = true;
    console.log('1 秒后执行');
  }, 1000);

  console.log(called); // false，时间未前进

  clock.tick(1000); // 推进 1 秒

  console.log(called); // true，定时器已执行
});

clock.destroy(); // 清理资源
```

### 使用 withTimeline 自动清理

```typescript
// withTimeline 会在回调结束后自动销毁 Timeline
withTimeline(MockClock(), () => {
  setTimeout(() => console.log('Hello'), 100);
  MockClock().tick(100);
});
```

### 异步测试

```typescript
await withTimelineAsync(MockClock(), async () => {
  const clock = MockClock();

  const result = await new Promise<string>((resolve) => {
    setTimeout(() => resolve('done'), 1000);
  });

  // 注意：Promise 需要推进时间才能完成
  await clock.tickAsync(1000);

  console.log(result); // 'done'
});
```

## 支持的 API

MockClock 可以模拟以下全局 API：

| API                     | 默认启用 | 说明                                   |
| ----------------------- | -------- | -------------------------------------- |
| `Date`                  | ✅        | `Date.now()`、`new Date()` 等          |
| `performance`           | ✅        | `performance.now()`                    |
| `process`               | ✅        | `process.uptime()`、`process.hrtime()` |
| `os`                    | ✅        | `os.uptime()`                          |
| `setTimeout`            | ✅        | 定时器                                 |
| `setInterval`           | ✅        | 间隔定时器                             |
| `setImmediate`          | ✅        | 立即执行（Node.js）                    |
| `requestAnimationFrame` | ✅        | 动画帧回调                             |
| `AbortSignal`           | ✅        | `AbortSignal.timeout()`                |
| `nextTick`              | ❌        | `process.nextTick()`（默认关闭）       |
| `queueMicrotask`        | ❌        | 微任务队列（默认关闭）                 |
| `MessageChannel`        | ❌        | 消息通道（默认关闭）                   |

## 配置选项

创建 Timeline 时可以传入配置选项：

```typescript
const clock = MockClock({
  frozen: false,           // 创建后不冻结时间
  loop_limit: 1000,        // 最大循环次数限制
  Date: true,              // 启用 Date 模拟
  setTimeout: true,        // 启用 setTimeout 模拟
  queueMicrotask: true,    // 启用 queueMicrotask 模拟（默认关闭）
  nextTick: false,         // 禁用 nextTick 模拟
});
```

### 配置项说明

| 选项                    | 类型      | 默认值  | 说明                           |
| ----------------------- | --------- | ------- | ------------------------------ |
| `frozen`                | `boolean` | `true`  | 创建后是否冻结时间             |
| `loop_limit`            | `number`  | `1314`  | 防止死循环的最大迭代次数       |
| `Date`                  | `boolean` | `true`  | 是否模拟 Date API              |
| `performance`           | `boolean` | `true`  | 是否模拟 performance API       |
| `process`               | `boolean` | `true`  | 是否模拟 process 时间 API      |
| `os`                    | `boolean` | `true`  | 是否模拟 os.uptime()           |
| `setTimeout`            | `boolean` | `true`  | 是否模拟 setTimeout            |
| `setInterval`           | `boolean` | `true`  | 是否模拟 setInterval           |
| `setImmediate`          | `boolean` | `true`  | 是否模拟 setImmediate          |
| `requestAnimationFrame` | `boolean` | `true`  | 是否模拟 requestAnimationFrame |
| `nextTick`              | `boolean` | `false` | 是否模拟 process.nextTick      |
| `queueMicrotask`        | `boolean` | `false` | 是否模拟 queueMicrotask        |
| `AbortSignal`           | `boolean` | `true`  | 是否模拟 AbortSignal.timeout   |
| `MessageChannel`        | `boolean` | `false` | 是否模拟 MessageChannel        |

## 导出函数

### MockClock

创建一个新的虚拟时间线。

```typescript
function MockClock(options?: ClockOpts): TimelinePublic
```

### runTimeline

在指定时间线上下文中同步执行回调。

```typescript
function runTimeline(fork: TimelinePublic, callback: () => void): void
```

### runTimelineAsync

在指定时间线上下文中异步执行回调。

```typescript
function runTimelineAsync(
  fork: TimelinePublic,
  callback: () => Promise<void>,
): Promise<void>
```

### withTimeline

在时间线上下文中执行回调，完成后自动销毁时间线。

```typescript
function withTimeline(fork: TimelinePublic, callback: () => void): void
```

### withTimelineAsync

异步版本，在时间线上下文中执行回调，完成后自动销毁时间线。

```typescript
function withTimelineAsync(
  fork: TimelinePublic,
  callback: () => Promise<void>,
): Promise<void>
```

### restoreGlobals

恢复所有全局时间 API 到原始实现。

```typescript
function restoreGlobals(): void
```

### hijackTimeGlobals

手动劫持全局时间 API。通常不需要手动调用，`MockClock()` 会自动处理。

```typescript
function hijackTimeGlobals(): boolean
```

**返回值：** 如果成功劫持返回 `true`，如果已经劫持过返回 `false`

## 注意事项

### 资源清理

每个 Timeline 都会占用资源，使用完毕后务必调用 `destroy()` 方法释放资源，或使用 `withTimeline` / `withTimelineAsync` 自动清理。

```typescript
// 手动清理
const clock = MockClock();
runTimeline(clock, () => { /* ... */ });
clock.destroy();

// 自动清理
withTimeline(MockClock(), () => { /* ... */ });
```

### 异步代码处理

对于包含 Promise 的异步代码，使用 `tickAsync`、`runAllAsync` 等异步方法，确保 Promise 回调能够正确执行：

```typescript
await withTimelineAsync(MockClock(), async () => {
  const clock = MockClock();

  let value = 0;
  Promise.resolve().then(() => {
    value = 42;
  });

  // 使用 tickAsync 确保 Promise 回调执行
  await clock.tickAsync(0);
  console.log(value); // 42
});
```

### 死循环保护

MockClock 内置了死循环保护机制。当定时器执行次数超过 `loop_limit`（默认 1314 次）时，会抛出异常。这可以防止类似 `setInterval` 回调中重新调度定时器导致的无限循环。

```typescript
const clock = MockClock({loop_limit: 100});

runTimeline(clock, () => {
  setInterval(() => {
    // 每次执行都会创建新的定时器
    setTimeout(() => {}, 0);
  }, 1);

  clock.runAll(); // 可能抛出异常
});
```

### 微任务模拟

`nextTick` 和 `queueMicrotask` 默认关闭，因为它们与 Promise 微任务队列紧密相关，模拟可能导致意外行为。如需启用，请明确配置：

```typescript
const clock = MockClock({
  nextTick: true,
  queueMicrotask: true,
});
```
