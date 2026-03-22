# 配置选项

本文档详细介绍 MockClock 的配置选项和可模拟的 API 目标。

## ClockOpts 接口

创建 Timeline 时可传入的配置选项：

```typescript
interface ClockOpts {
  loop_limit?: number;
  frozen?: boolean;
  Date?: boolean;
  performance?: boolean;
  process?: boolean;
  os?: boolean;
  setTimeout?: boolean;
  setInterval?: boolean;
  setImmediate?: boolean;
  requestAnimationFrame?: boolean;
  nextTick?: boolean;
  queueMicrotask?: boolean;
  AbortSignal?: boolean;
  MessageChannel?: boolean;
}
```

## 通用配置

### loop_limit

最大循环次数限制，防止死循环。

| 类型     | 默认值 |
| -------- | ------ |
| `number` | `1314` |

当定时器执行次数超过此限制时，会抛出异常。这对于捕获类似以下场景很有用：

```typescript
const clock = MockClock({loop_limit: 100});

runTimeline(clock, () => {
  // 这个 interval 每次执行都会创建新的定时器
  setInterval(() => {
    setTimeout(() => {}, 0);
  }, 1);

  clock.runAll(); // 将在 100 次后抛出异常
});
```

### frozen

创建后是否冻结时间。

| 类型      | 默认值  |
| --------- | ------- |
| `boolean` | `true`  |

- `true`（默认）：创建后时间冻结，需要手动调用 `tick()` 推进时间
- `false`：时间可以自由流逝

```typescript
// 默认冻结
const clock1 = MockClock();
console.log(clock1.isFrozen()); // true

// 不冻结
const clock2 = MockClock({frozen: false});
console.log(clock2.isFrozen()); // false
```

---

## API 模拟配置

以下选项控制各个时间相关 API 是否被模拟。

### Date

是否模拟 `Date` 构造函数和 `Date.now()`。

| 类型      | 默认值  |
| --------- | ------- |
| `boolean` | `true`  |

**模拟行为：**

- `Date.now()` 返回虚拟时间戳
- `new Date()` 使用虚拟时间创建日期对象
- `new Date(timestamp)` 仍使用传入的时间戳

```typescript
const clock = MockClock();
runTimeline(clock, () => {
  clock.setSystemTime(new Date('2024-06-15'));

  console.log(Date.now()); // 1718409600000
  console.log(new Date().getFullYear()); // 2024
});
```

### performance

是否模拟 `performance.now()`。

| 类型      | 默认值  |
| --------- | ------- |
| `boolean` | `true`  |

**模拟行为：**

- `performance.now()` 返回虚拟高精度时间
- 受 `tick()` 影响，不受 `setSystemTime()` 影响

```typescript
const clock = MockClock();
runTimeline(clock, () => {
  const start = performance.now();
  clock.tick(1000);
  const end = performance.now();

  console.log(end - start); // 1000
});
```

### process

是否模拟 Node.js 进程时间 API。

| 类型      | 默认值  |
| --------- | ------- |
| `boolean` | `true`  |

**模拟行为：**

- `process.uptime()` 返回虚拟进程运行时间
- `process.hrtime()` 返回虚拟高精度时间
- `process.hrtime.bigint()` 返回虚拟高精度时间（bigint）

```typescript
const clock = MockClock();
runTimeline(clock, () => {
  console.log(process.uptime()); // 虚拟 uptime

  clock.tick(5000);
  console.log(process.uptime()); // 增加了 5 秒
});
```

### os

是否模拟 `os.uptime()`。

| 类型      | 默认值  |
| --------- | ------- |
| `boolean` | `true`  |

**模拟行为：**

- `os.uptime()` 返回虚拟系统运行时间

```typescript
const clock = MockClock();
runTimeline(clock, () => {
  const uptime = os.uptime();
  console.log(uptime); // 虚拟系统运行时间
});
```

### setTimeout

是否模拟 `setTimeout` 和 `clearTimeout`。

| 类型      | 默认值  |
| --------- | ------- |
| `boolean` | `true`  |

**模拟行为：**

- 定时器在虚拟时间线上调度
- 只有调用 `tick()` 等方法才会触发

```typescript
const clock = MockClock();
runTimeline(clock, () => {
  let called = false;
  setTimeout(() => { called = true; }, 1000);

  console.log(called); // false
  clock.tick(1000);
  console.log(called); // true
});
```

### setInterval

是否模拟 `setInterval` 和 `clearInterval`。

| 类型      | 默认值  |
| --------- | ------- |
| `boolean` | `true`  |

```typescript
const clock = MockClock();
runTimeline(clock, () => {
  let count = 0;
  setInterval(() => { count++; }, 100);

  clock.tick(350);
  console.log(count); // 3
});
```

### setImmediate

是否模拟 `setImmediate` 和 `clearImmediate`（Node.js）。

| 类型      | 默认值  |
| --------- | ------- |
| `boolean` | `true`  |

**模拟行为：**

- `setImmediate` 调度的回调会在 `tick(0)` 时执行
- 在虚拟时间线中，immediate 被视为 delay=0 的定时器

```typescript
const clock = MockClock();
runTimeline(clock, () => {
  let called = false;
  setImmediate(() => { called = true; });

  clock.tick(0);
  console.log(called); // true
});
```

### requestAnimationFrame

是否模拟 `requestAnimationFrame` 和 `cancelAnimationFrame`。

| 类型      | 默认值  |
| --------- | ------- |
| `boolean` | `true`  |

**模拟行为：**

- RAF 回调会在虚拟时间推进时执行
- 回调参数为虚拟的 DOMHighResTimeStamp

```typescript
const clock = MockClock();
runTimeline(clock, () => {
  requestAnimationFrame((timestamp) => {
    console.log('RAF timestamp:', timestamp);
  });

  clock.tick(16); // 约 1 帧
});
```

### AbortSignal

是否模拟 `AbortSignal.timeout()`。

| 类型      | 默认值  |
| --------- | ------- |
| `boolean` | `true`  |

**模拟行为：**

- `AbortSignal.timeout(ms)` 返回的信号会在虚拟时间到达后中止

```typescript
const clock = MockClock();
runTimeline(clock, async () => {
  const signal = AbortSignal.timeout(1000);

  console.log(signal.aborted); // false

  clock.tick(1000);
  console.log(signal.aborted); // true
});
```

### nextTick

是否模拟 `process.nextTick()`。

| 类型      | 默认值  |
| --------- | ------- |
| `boolean` | `false` |

**注意：** 默认关闭，因为 `nextTick` 与 Promise 微任务队列紧密相关，模拟可能导致意外行为。

```typescript
const clock = MockClock({nextTick: true});
runTimeline(clock, () => {
  let value = 0;
  process.nextTick(() => { value = 42; });

  clock.runMicrotasks();
  console.log(value); // 42
});
```

### queueMicrotask

是否模拟 `queueMicrotask()`。

| 类型      | 默认值  |
| --------- | ------- |
| `boolean` | `false` |

**注意：** 默认关闭，原因同 `nextTick`。

```typescript
const clock = MockClock({queueMicrotask: true});
runTimeline(clock, () => {
  let value = 0;
  queueMicrotask(() => { value = 42; });

  clock.runMicrotasks();
  console.log(value); // 42
});
```

### MessageChannel

是否模拟 `MessageChannel` 和 `MessagePort`。

| 类型      | 默认值  |
| --------- | ------- |
| `boolean` | `false` |

**注意：** 默认关闭。MessageChannel 的消息传递机制较为复杂，模拟可能影响某些库的行为。

```typescript
const clock = MockClock({MessageChannel: true});
runTimeline(clock, () => {
  const channel = new MessageChannel();
  let received = false;

  channel.port1.onmessage = () => {
    received = true;
  };

  channel.port2.postMessage('hello');

  clock.tick(0);
  console.log(received); // true
});
```

---

## 默认配置

`DEFAULT_CONFIG` 定义了各 API 的默认模拟状态：

```typescript
const DEFAULT_CONFIG: Record<MockTarget, boolean> = {
  Date: true,
  performance: true,
  process: true,
  os: true,
  setTimeout: true,
  setInterval: true,
  setImmediate: true,
  requestAnimationFrame: true,
  AbortSignal: true,
  nextTick: false,
  queueMicrotask: false,
  MessageChannel: false,
};
```

---

## MockTarget 类型

可被模拟的 API 名称类型：

```typescript
type MockTarget =
  | 'Date'
  | 'performance'
  | 'process'
  | 'os'
  | 'setTimeout'
  | 'setInterval'
  | 'setImmediate'
  | 'requestAnimationFrame'
  | 'nextTick'
  | 'queueMicrotask'
  | 'AbortSignal'
  | 'MessageChannel';
```

用于 `isMocked()`、`useMock()`、`useReal()` 方法的参数。
