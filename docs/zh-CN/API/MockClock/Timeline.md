# Timeline API

Timeline 是 MockClock 的核心接口，提供完整的时间控制能力。本文档详细介绍 `TimelinePublic` 接口的所有方法。

## 目录

- [基本信息](#基本信息)
- [生命周期管理](#生命周期管理)
- [Mock 模式切换](#mock-模式切换)
- [时间控制](#时间控制)
- [定时器管理](#定时器管理)
- [微任务控制](#微任务控制)
- [虚拟时间查询](#虚拟时间查询)
- [真实时间查询](#真实时间查询)

---

## 基本信息

### id

时间线的唯一标识符。

```typescript
readonly id: string
```

**示例：**

```typescript
const clock = MockClock();
console.log(clock.id); // "TimeLine-0000"
```

---

## 生命周期管理

### destroy

销毁时间线并释放所有资源。调用后任何操作都会抛出错误。

```typescript
destroy(): void
```

**注意：** 使用完毕后必须调用此方法，否则会导致资源泄漏。

**示例：**

```typescript
const clock = MockClock();
runTimeline(clock, () => {
  // 测试代码
});
clock.destroy(); // 释放资源

// clock.tick(100); // 错误！Timeline 已销毁
```

### [Symbol.dispose]

支持 `using` 语法自动释放资源。

```typescript
[Symbol.dispose](): void
```

**示例：**

```typescript
{
  using clock = MockClock();
  runTimeline(clock, () => {
    // 测试代码
  });
} // 自动调用 clock.destroy()
```

---

## Mock 模式切换

### isMocked

检查指定 API 是否正在被模拟。

```typescript
isMocked(api: MockTarget): boolean
```

| 参数  | 类型         | 描述                      |
| ----- | ------------ | ------------------------- |
| `api` | `MockTarget` | API 名称，如 `'Date'`     |

**返回值：** `true` 表示正在模拟，`false` 表示使用真实实现

**示例：**

```typescript
const clock = MockClock();
console.log(clock.isMocked('Date')); // true
console.log(clock.isMocked('queueMicrotask')); // false（默认关闭）
```

### useMock

启用指定 API 的模拟。

```typescript
useMock(api: MockTarget): void
```

**示例：**

```typescript
const clock = MockClock({queueMicrotask: false});
console.log(clock.isMocked('queueMicrotask')); // false

clock.useMock('queueMicrotask');
console.log(clock.isMocked('queueMicrotask')); // true
```

### useReal

禁用指定 API 的模拟，使用真实实现。

```typescript
useReal(api: MockTarget): void
```

**示例：**

```typescript
const clock = MockClock();
console.log(clock.isMocked('Date')); // true

clock.useReal('Date');
console.log(clock.isMocked('Date')); // false
// 现在 Date.now() 返回真实时间
```

---

## 时间控制

### tick

推进虚拟时间指定毫秒，执行期间到期的所有定时器。

```typescript
tick(ms: number): void
```

| 参数 | 类型     | 描述                   |
| ---- | -------- | ---------------------- |
| `ms` | `number` | 推进的毫秒数（非负数） |

**异常：** 超过最大循环次数时抛出错误

**示例：**

```typescript
const clock = MockClock();
runTimeline(clock, () => {
  setTimeout(() => console.log('100ms'), 100);
  setTimeout(() => console.log('200ms'), 200);

  clock.tick(150);
  // 输出: "100ms"
  // 200ms 的定时器还未执行

  clock.tick(50);
  // 输出: "200ms"
});
```

### tickAsync

异步推进虚拟时间，每次定时器执行后会等待 Promise 完成。

```typescript
tickAsync(ms: number): Promise<void>
```

**适用场景：** 测试包含 Promise 的异步代码

**示例：**

```typescript
const clock = MockClock();
await runTimelineAsync(clock, async () => {
  let value = 0;

  setTimeout(() => {
    Promise.resolve().then(() => {
      value = 42;
    });
  }, 100);

  await clock.tickAsync(100);
  console.log(value); // 42，Promise 回调已执行
});
```

### next

前进到下一个定时器并执行。

```typescript
next(): void
```

**示例：**

```typescript
const clock = MockClock();
runTimeline(clock, () => {
  setTimeout(() => console.log('第一个'), 100);
  setTimeout(() => console.log('第二个'), 500);

  clock.next();
  // 输出: "第一个"

  clock.next();
  // 输出: "第二个"
});
```

### nextAsync

异步版本，前进到下一个定时器并执行，等待 Promise 完成。

```typescript
nextAsync(): Promise<void>
```

### runAll

运行所有待执行的定时器直到队列为空。

```typescript
runAll(): void
```

**异常：** 超过最大循环次数时抛出错误

**示例：**

```typescript
const clock = MockClock();
runTimeline(clock, () => {
  setTimeout(() => console.log('A'), 100);
  setTimeout(() => console.log('B'), 500);
  setInterval(() => console.log('interval'), 200);

  clock.runAll();
  // 输出: "A", "interval", "interval", "interval", ... (直到循环限制)
});
```

### runAllAsync

异步运行所有定时器，每次执行后等待 Promise 完成。

```typescript
runAllAsync(): Promise<void>
```

### runPending

运行调用时已存在的所有定时器，不包括执行中新添加的。

```typescript
runPending(): void
```

**示例：**

```typescript
const clock = MockClock();
runTimeline(clock, () => {
  setTimeout(() => {
    console.log('A');
    setTimeout(() => console.log('B'), 0); // 执行中新添加
  }, 100);

  clock.runPending();
  // 输出: "A"
  // "B" 不会执行，因为是在 runPending 调用后添加的
});
```

### runPendingAsync

异步版本，运行调用时已存在的定时器。

```typescript
runPendingAsync(): Promise<void>
```

### setSystemTime

设置虚拟系统时间。

```typescript
setSystemTime(time?: number | Date): void
```

| 参数   | 类型              | 描述                                     |
| ------ | ----------------- | ---------------------------------------- |
| `time` | `number \| Date`  | 目标时间，省略则重置为真实系统时间       |

**注意：** 只影响 `Date.now()` 等系统时间，不影响 `performance.now()` 等单调时间。

**示例：**

```typescript
const clock = MockClock();
runTimeline(clock, () => {
  clock.setSystemTime(new Date('2024-01-01'));
  console.log(new Date().toISOString()); // "2024-01-01T00:00:00.000Z"

  clock.tick(1000);
  console.log(new Date().toISOString()); // "2024-01-01T00:00:01.000Z"
});
```

### freeze

冻结虚拟时间。

```typescript
freeze(): void
```

冻结后，时间相关方法返回固定值，直到调用 `unfreeze()`。定时器仍可调度但不会触发。

**示例：**

```typescript
const clock = MockClock({frozen: false}); // 创建时不冻结

runTimeline(clock, () => {
  const time1 = Date.now();

  clock.freeze();
  clock.tick(1000);

  const time2 = Date.now();
  console.log(time2 - time1); // 0，时间被冻结
});
```

### unfreeze

解冻虚拟时间。

```typescript
unfreeze(): void
```

---

## 定时器管理

### timerCount

返回待执行定时器的数量。

```typescript
readonly timerCount: number
```

**示例：**

```typescript
const clock = MockClock();
runTimeline(clock, () => {
  console.log(clock.timerCount); // 0

  setTimeout(() => {}, 100);
  setTimeout(() => {}, 200);
  console.log(clock.timerCount); // 2

  clock.tick(150);
  console.log(clock.timerCount); // 1
});
```

### clearAllTimers

清除所有待执行的定时器和微任务。

```typescript
clearAllTimers(): void
```

**示例：**

```typescript
const clock = MockClock();
runTimeline(clock, () => {
  setTimeout(() => console.log('A'), 100);
  setTimeout(() => console.log('B'), 200);

  clock.clearAllTimers();
  console.log(clock.timerCount); // 0

  clock.runAll(); // 无输出
});
```

---

## 微任务控制

### runMicrotasks

同步运行所有排队的微任务（包括 nextTick 和 queueMicrotask）。

```typescript
runMicrotasks(): void
```

**示例：**

```typescript
const clock = MockClock({queueMicrotask: true});
runTimeline(clock, () => {
  let value = 0;
  queueMicrotask(() => {
    value = 42;
  });

  console.log(value); // 0
  clock.runMicrotasks();
  console.log(value); // 42
});
```

### realFlushPromises

刷新真实环境中的 Promise 微任务队列。

```typescript
realFlushPromises(): Promise<void>
```

**示例：**

```typescript
const clock = MockClock();
await runTimelineAsync(clock, async () => {
  let value = 0;
  Promise.resolve().then(() => {
    value = 42;
  });

  await clock.realFlushPromises();
  console.log(value); // 42
});
```

### realSleep

使用真实 `setTimeout` 等待指定毫秒。

```typescript
realSleep(ms: number): Promise<void>
```

**适用场景：** 在测试中需要真实等待的场景

**示例：**

```typescript
const clock = MockClock();
await runTimelineAsync(clock, async () => {
  const start = Date.now(); // 虚拟时间
  await clock.realSleep(100); // 真实等待 100ms
  const end = Date.now(); // 虚拟时间（未推进）

  console.log(end - start); // 0，虚拟时间未变
});
```

---

## 虚拟时间查询

### systemTime

返回当前虚拟系统时间戳（毫秒）。

```typescript
systemTime(): number
```

**示例：**

```typescript
const clock = MockClock();
runTimeline(clock, () => {
  console.log(clock.systemTime()); // 当前虚拟时间戳

  clock.tick(1000);
  console.log(clock.systemTime()); // 增加了 1000
});
```

### perfNow

返回当前虚拟 `performance.now()` 值。

```typescript
perfNow(): number
```

### uptime

返回当前虚拟进程运行时间（秒）。

```typescript
uptime(): number
```

### osUptime

返回当前虚拟系统运行时间（秒）。

```typescript
osUptime(): number
```

### hrtime

返回当前虚拟高精度时间 `[秒, 纳秒]`。

```typescript
hrtime(): [number, number]
```

### hrtimeBigInt

返回当前虚拟高精度时间（bigint 纳秒）。

```typescript
hrtimeBigInt(): bigint
```

### getOffset

返回当前时间偏移量（虚拟时间 - 真实时间）。

```typescript
getOffset(): number
```

### isFrozen

检查时间线是否处于冻结状态。

```typescript
isFrozen(): boolean
```

---

## 真实时间查询

以下方法绕过虚拟时间系统，返回真实系统时间：

### getRealNow

返回真实系统时间戳。

```typescript
getRealNow(): number
```

### getRealPerfNow

返回真实 `performance.now()` 值。

```typescript
getRealPerfNow(): number
```

### getRealUptime

返回真实进程运行时间（秒）。

```typescript
getRealUptime(): number
```

### getRealOsUptime

返回真实系统运行时间（秒）。

```typescript
getRealOsUptime(): number
```

### getRealHrtime

返回真实高精度时间。

```typescript
getRealHrtime(time?: [number, number]): [number, number]
```

| 参数   | 类型              | 描述                                     |
| ------ | ----------------- | ---------------------------------------- |
| `time` | `[number, number]`| 可选，计算与该时间的差值                 |

**返回值：** 当前时间或时间差 `[秒, 纳秒]`

### getRealHrtimeBigInt

返回真实高精度时间（bigint 纳秒）。

```typescript
getRealHrtimeBigInt(): bigint
```

**示例：**

```typescript
const clock = MockClock();
runTimeline(clock, () => {
  clock.tick(100000); // 虚拟时间推进 100 秒

  console.log(clock.systemTime()); // 虚拟时间已推进
  console.log(clock.getRealNow()); // 真实时间未变
});
```
