# modern-ts

<div align="center">

**一个现代 TypeScript 标准套件**

自包含 · 零依赖 · 100% 覆盖率 · 摇树友好 · 高性能

</div>

> ⚠️ **测试版本提示**：当前处于测试阶段，正在收集社区反馈。API 可能随时发生破坏性更新，请谨慎用于生产环境

***

## 特性

- **自包含**：无任何运行时依赖，开箱即用
- **零依赖**：保持项目轻量，避免供应链风险
- **100% 覆盖率**：完善的测试覆盖，确保代码质量
- **摇树友好**：支持 Tree-shaking，按需引入
- **高性能**：关键模块经过深度优化，性能优于同类库

## 模块概览

### 🔄 Concurrent — 并发原语

完善的系统级并发原语集合：

| 子模块        | 说明                                                                     |
| ------------- | ------------------------------------------------------------------------ |
| **Lock**      | `Mutex`、`Semaphore`、`ConditionVariable`、`RwLock` 等并发锁             |
| **Valve**     | `TokenBucket`、`LeakyBucket`、`SlidingWindow`、`CircuitBreaker` 流量控制 |
| **Limit**     | 并发任务数量控制（比 `p-limit` 更完善）                                  |
| **Channel**   | Go 语言 CSP 模型实现                                                     |
| **Scheduler** | CFS-Like 协作式异步调度器                                                |
| **TaskScope** | 结构化并发管理器                                                         |

### ⏰ MockClock — 模拟时钟

基于 `AsyncLocalStorage` 的模拟时钟，支持并发测试，深度模拟 `NodeJS.Timeout` 句柄。

### 🎭 Monad — 常用的函数式原语

| 模块       | 用途       |
| ---------- | ---------- |
| **Result** | 错误处理   |
| **Maybe**  | 可选值处理 |
| **Reader** | 依赖注入   |

### 🛠️ Utils — 工具函数

完善的工具函数库（近似 `lodash`）：

- 类型安全的 `curry` / `pipe`（支持占位符和深层推导）
- 高性能 `debounce` / `throttle`（边缘处理比`lodash`更健壮）
- 深拷贝 `cloneDeep`（支持循环引用，手写栈，支持十万级嵌套）
- 常用类型工具、数组、对象、函数、字符串、Map/Set 工具函数

### 🌐 FetchQ — HTTP 客户端

支持复杂功能、采用 Result 模式的 HTTP 客户端。

### ✅ Fit — Schema 验证

类型优先、摇树友好、扩展性极强的 Schema 验证库。

### 📦 其他模块

| 模块             | 说明                                                                     |
| ---------------- | ------------------------------------------------------------------------ |
| **Other**        | 常用数据结构（Deque、Heap、Queue、Stack、DisjointSet）及工具函数         |
| **Resource**     | 基于 `using` 的 RAII 资源管理器                                          |
| **Flow**         | 响应式流（类似 RxJS），通过 consume 方法实现控制权反转                   |
| **EventEmitter** | 跨平台 EventEmitter，行为几乎无异的同时多项性能指标优于 Node.js 原生模块 |

## 安装

```bash
# pnpm
pnpm add modern-ts

# npm
npm install modern-ts

# yarn
yarn add modern-ts
```

## 快速开始

### 导入方式

库支持多种导入方式：

```typescript
// 导入所有
import * as Modern from 'modern-ts';

// 按命名空间导入
import { Result, Maybe } from 'modern-ts';

// 子路径导入（摇树优化）
import { Ok, Err } from 'modern-ts/Result';
import { Some, None } from 'modern-ts/Maybe';
import { Mutex } from 'modern-ts/Concurrent';
import { debounce, throttle } from 'modern-ts/Utils';
```

### 示例：Result 错误处理

```typescript
import { Ok, Err, Result, isOk } from 'modern-ts/Result';

function divide(a: number, b: number): Result<number, string> {
  if (b === 0) return Err('Division by zero');
  return Ok(a / b);
}

const result = divide(10, 2);
if (isOk(result)) {
  console.log(result.value); // 5
}
```

### 示例：Fit Schema 验证

```typescript
import * as f from 'modern-ts/Fit';

interface User {
  name: string;
  age: number;
  tags: string[];
}

const UserSchema = f
  .fit<User | 'VIP'>()
  .off((v) => v === 'VIP', 'ok') // 如果是VIP，直接短路返回ok
  .toShaped({
    name: f.String().that(f.min_len(2)),
    age: f.Number().that(f.range(0, 150)),
    tags: f.items(f.String()),
    // 若字段和User不匹配，编译会报错
  });

const result = f.validate({name: 'Alice', age: 25, tags: ['dev']}, UserSchema);
/*
result.ok === true, result.value 为验证后的对象，类型如下：
"ok" | {
    name: string;
    age: number;
    tags: string[];
}
*/
```

### 示例：MockClock 并发时间模拟

```typescript
import { MockClock, runTimelineAsync } from 'modern-ts/VirtualTime';

// Concurrent testing: two independent timelines, isolated from each other
const clock1 = MockClock();
const clock2 = MockClock();

let t1: number;
let t2: number;

await Promise.all([
  withTimelineAsync(clock1, async () => {
    clock1.setSystemTime(1000); // Set start time
    t1 = Date.now(); // 1000
  }),
  withTimelineAsync(clock2, async () => {
    clock2.setSystemTime(2000); // Different start time
    t2 = Date.now(); // 2000
  }),
]);
// t1 === 1000, t2 === 2000 (timeline isolation)
```

### 示例：Scheduler 协作式调度

```typescript
import { Scheduler } from 'modern-ts/Concurrent';

const scheduler = new Scheduler(1);
const log: string[] = [];

// 任务通过 pause() 让出控制权，实现协作式调度
await Promise.all([
  scheduler.add(async (_, pause) => {
    log.push('A-start');
    await pause({ nice: 10 }); // 降低优先级，让出执行权
    log.push('A-resume');
  }),
  scheduler.add(() => log.push('B-run'), { nice: -5 }), // 高优先级
]);

// 执行顺序: A-start → B-run → A-resume
```

## 子路径导出

| 路径                    | 说明            |
| ----------------------- | --------------- |
| `modern-ts/Result`      | Result 错误处理 |
| `modern-ts/Maybe`       | Maybe 可选值    |
| `modern-ts/Reader`      | Reader 依赖注入 |
| `modern-ts/ReaderT`     | Reader + Result |
| `modern-ts/Resource`    | RAII 资源管理   |
| `modern-ts/TxScope`     | RAII 事务作用域 |
| `modern-ts/Lazy`        | 延迟计算        |
| `modern-ts/FetchQ`      | HTTP 客户端     |
| `modern-ts/Fit`         | Schema 验证     |
| `modern-ts/VirtualTime` | 虚拟时间        |
| `modern-ts/Concurrent`  | 并发原语        |
| `modern-ts/Reactive`    | 响应式原语      |
| `modern-ts/Utils`       | 工具函数        |
| `modern-ts/Arr`         | 数组工具        |
| `modern-ts/Str`         | 字符串工具      |
| `modern-ts/Sets`        | Set 工具        |
| `modern-ts/Maps`        | Map 工具        |

## API 文档

详细的 API 文档请参阅 [docs/zh-CN](./docs/zh-CN) 目录）
或`npm typedoc` 生成 API文档

## 环境要求

- Node.js >= 20
- TypeScript >= 5.0

## 许可证

[Apache-2.0](./LICENSE)
