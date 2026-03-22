# Scheduler

基于 Linux CFS（完全公平调度器）算法实现的协作式任务调度器，支持优先级控制、时间片管理和混合微任务/宏任务调度策略。

## 目录

- [核心类](#核心类)
  - [Scheduler](#scheduler)
- [接口](#接口)
  - [TaskOptions](#taskoptions)
  - [PauseOptions](#pauseoptions)
- [使用示例](#使用示例)
- [设计原理](#设计原理)

---

## 核心类

### Scheduler

实现 CFS 算法的任务调度器，管理任务并发、优先级和时间片。

#### 构造函数

```typescript
constructor(concurrency: number)
```

| 参数          | 类型     | 描述                   |
| ------------- | -------- | ---------------------- |
| `concurrency` | `number` | 最大并发执行的任务数量 |

**异常：**
- 当 `concurrency < 0` 或 `NaN` 时抛出 `ParameterError`

#### 方法

##### add

向调度器添加任务。

```typescript
public async add<T>(
  fn: (
    expired: () => boolean,
    pause: (options?: PauseOptions) => Promise<void>,
  ) => MaybePromise<T>,
  options?: TaskOptions,
): Promise<T>
```

| 参数      | 类型          | 描述                                               |
| --------- | ------------- | -------------------------------------------------- |
| `fn`      | `Function`    | 任务函数，接收 `expired()` 检查器和 `pause()` 函数 |
| `options` | `TaskOptions` | 调度选项（优先级、取消信号、保证执行标志）         |

**返回值：** 解析为任务结果的 Promise

**示例：**
```typescript
const scheduler = new Scheduler(4);

// 基础用法
const result = await scheduler.add(async (expired, pause) => {
  while (hasMoreWork()) {
    if (expired()) await pause();
    processChunk();
  }
  return 'done';
});

// 带优先级和取消信号
const controller = new AbortController();
const result = await scheduler.add(
  async (expired, pause) => {
    // 任务逻辑
  },
  { nice: -10, signal: controller.signal, guaranteed: true }
);
```

---

##### resetLimits

更新并发限制。如果增加限制，会触发下一轮调度。

```typescript
public resetLimits(new_concurrency: number): void
```

| 参数              | 类型     | 描述         |
| ----------------- | -------- | ------------ |
| `new_concurrency` | `number` | 新的并发限制 |

**异常：**
- 当 `new_concurrency < 0` 或 `NaN` 时抛出 `ParameterError`

---

##### pause

暂停调度器。暂停后不会分发新任务，但正在运行的任务会继续执行。

```typescript
public pause(): void
```

---

##### resume

恢复被暂停的调度器。

```typescript
public resume(): void
```

---

##### onIdle

返回一个在调度器空闲时解析的 Promise。

```typescript
public onIdle(): Promise<void>
```

**返回值：** 当所有任务完成且队列为空时解析的 Promise

**示例：**
```typescript
await scheduler.add(task1);
await scheduler.add(task2);
await scheduler.onIdle(); // 等待所有任务完成
console.log('所有任务已完成');
```

---

##### stats

获取调度器当前统计信息。

```typescript
public get stats(): {
  concurrency: number;
  active: number;
  pending: number;
  isPaused: boolean;
  min_vruntime: number;
  next_task_nice?: number;
  next_task_vruntime?: number;
}
```

| 属性                 | 类型                  | 描述                        |
| -------------------- | --------------------- | --------------------------- |
| `concurrency`        | `number`              | 当前并发限制                |
| `active`             | `number`              | 正在执行的任务数            |
| `pending`            | `number`              | 等待执行的任务数            |
| `isPaused`           | `boolean`             | 是否处于暂停状态            |
| `min_vruntime`       | `number`              | 全局最小虚拟运行时间        |
| `next_task_nice`     | `number \| undefined` | 下一个待执行任务的 nice 值  |
| `next_task_vruntime` | `number \| undefined` | 下一个待执行任务的 vruntime |

---

## 接口

### TaskOptions

任务调度选项。

```typescript
export interface TaskOptions {
  /** Nice value for priority adjustment (-20 to 19). Lower = higher priority. */
  nice?: number;
  /** AbortSignal to cancel the task. */
  signal?: AbortSignal;
  /**
   * If `true`, the task is guaranteed to run even under high contention.
   * Priority order: guaranteed + higher nice > guaranteed + lower nice >
   * non-guaranteed + higher nice > non-guaranteed + lower nice
   */
  guaranteed?: boolean;
}
```

| 属性         | 类型          | 默认值  | 描述                                             |
| ------------ | ------------- | ------- | ------------------------------------------------ |
| `nice`       | `number`      | `0`     | 优先级调整值，范围 `-20` 到 `19`，越小优先级越高 |
| `signal`     | `AbortSignal` | -       | 用于取消任务的信号                               |
| `guaranteed` | `boolean`     | `false` | 是否保证执行，高竞争时优先调度                   |

**优先级顺序：**
1. `guaranteed: true` + 较高 nice（更小值）
2. `guaranteed: true` + 较低 nice
3. `guaranteed: false` + 较高 nice
4. `guaranteed: false` + 较低 nice

---

### PauseOptions

暂停时更新任务属性的选项。

```typescript
export interface PauseOptions {
  /** Update the nice value during pause. */
  nice?: number;
  /** Update the guaranteed status during pause. */
  guaranteed?: boolean;
}
```

| 属性         | 类型      | 描述                       |
| ------------ | --------- | -------------------------- |
| `nice`       | `number`  | 暂停时更新 nice 值         |
| `guaranteed` | `boolean` | 暂停时更新 guaranteed 状态 |

---

## 使用示例

### 基础并发控制

```typescript
import {Scheduler} from './src/Concurrent/scheduler';

// 创建最多同时运行 3 个任务的调度器
const scheduler = new Scheduler(3);

// 添加多个任务
for (let i = 0; i < 10; i++) {
  void scheduler.add(async (expired, pause) => {
    console.log(`任务 ${i} 开始`);
    await someAsyncWork();
    console.log(`任务 ${i} 完成`);
  });
}

// 等待所有任务完成
await scheduler.onIdle();
```

### 时间片协作

```typescript
const scheduler = new Scheduler(1);

await scheduler.add(async (expired, pause) => {
  const items = new Array(10000).fill(0);
  const results: number[] = [];

  for (const item of items) {
    // 检查时间片是否耗尽
    if (expired()) {
      await pause(); // 让出 CPU，让其他任务有机会执行
    }
    results.push(heavyComputation(item));
  }

  return results;
});
```

### 动态调整优先级

```typescript
const scheduler = new Scheduler(2);

await scheduler.add(async (expired, pause) => {
  // 初始为低优先级后台任务
  await pause({nice: 10});

  // 执行一些后台工作...

  // 用户交互触发，提升为 UI 关键任务
  await pause({nice: -10, guaranteed: true});

  // 执行 UI 更新...

  // 完成后恢复为后台任务
  await pause({nice: 10, guaranteed: false});
});
```

### 任务取消

```typescript
const scheduler = new Scheduler(2);
const controller = new AbortController();

// 启动一个长时间运行的任务
const taskPromise = scheduler.add(
  async (expired, pause) => {
    for (let i = 0; i < 1000; i++) {
      if (expired()) await pause();
      await processChunk(i);
    }
    return 'completed';
  },
  {signal: controller.signal}
);

// 5 秒后取消任务
setTimeout(() => controller.abort(), 5000);

try {
  const result = await taskPromise;
} catch (err) {
  console.log('任务被取消');
}
```

---

## 设计原理

### CFS（完全公平调度器）

Scheduler 基于 Linux CFS 算法实现公平调度：

1. **虚拟运行时间（vruntime）**：每个任务维护一个虚拟运行时间，权重越小的任务（nice 值越小）vruntime 增长越慢，从而获得更多 CPU 时间

2. **红黑树（最小堆）**：使用最小堆存储等待任务，按 vruntime 排序，总是选择 vruntime 最小的任务执行

3. **权重表**：采用 Linux 的 nice 值到权重的映射表（40 个等级）

### 混合调度策略

Scheduler 使用智能调度策略平衡吞吐量和响应性：

- **微任务（Microtask）**：当距上次让出主线程的时间小于 5ms 时使用 `queueMicrotask`，在当前事件循环继续执行，最大化吞吐量

- **宏任务（Macrotask）**：当超过阈值时使用 `setImmediate`（Node.js）或 `MessageChannel`（浏览器）让出主线程，防止阻塞 UI

### Guaranteed 机制

guaranteed 标志实现双梯队调度：

- **第一梯队**（`guaranteed: true`）：UI 响应、用户交互等关键任务
- **第二梯队**（`guaranteed: false`）：后台计算、日志处理等非关键任务

调度规则：第一梯队任务始终优先于第二梯队任务，梯队内部遵循 CFS 公平调度。

### 内存管理

- **空闲槽位复用**：使用 `free_slots` 数组管理可复用的任务 ID
- **内存收缩**：当闲置槽位超过 64 个时，重置数组释放内存，防止长期运行内存泄漏

---

## 性能基准

参考 `__benchmark__/scheduler.ts` 的测试结果：

### 吞吐量测试

| 指标                 | 数值             |
| -------------------- | ---------------- |
| 迭代次数             | 2,000,000        |
| 预热次数             | 100,000          |
| **基准线**           |                  |
| Sync Ops/s           | 3,315,879 (最大) |
| Microtask Ops/s      | 2,520,874        |
| MessageChannel Ops/s | 603,359          |
| Immediate Ops/s      | 555,359          |
| **Scheduler**        |                  |
| 单任务 Ops/s         | 1,902,407        |
| 开销 (vs Sync)       | -42.6%           |
| 开销 (vs Microtask)  | -24.5%           |
| **扩展性**           |                  |
| 2路竞争 (C=1)        | 1,072,516        |
| 8路竞争 (C=1)        | 1,007,035        |
| 性能下降 (2→8)       | -6.1%            |
| 并行模式 (C=2)       | 1,869,199        |

### 公平性测试

| 指标       | 数值                           |
| ---------- | ------------------------------ |
| 总 Tick 数 | 3,000,000                      |
| Nice 配置  | 0 (高) vs 6 (低)               |
| 权重       | 1024 vs 272                    |
| 理论比值   | 3.765                          |
| 实际比值   | 3.779                          |
| 允许范围   | [3.727, 3.802]                 |
| 结果       | ✅ 通过                         |
| 详情       | High: 2,372,213 / Low: 627,787 |
| 内存增长   | 34.09 KB (+0.04%)              |

### 内存压力测试

| 指标     | 数值                |
| -------- | ------------------- |
| 操作     | 300 批次 × 100 任务 |
| 起始内存 | 80.14 MB            |
| 结束内存 | 80.14 MB            |
| 内存增长 | 6.80 KB             |
| 状态     | ✅ 稳定（无泄漏）    |

