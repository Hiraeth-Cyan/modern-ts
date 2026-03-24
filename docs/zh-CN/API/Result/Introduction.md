# Result

在 Rust、Swift 或 Kotlin（Arrow）中，`Result` 是一个枚举，用于显式处理**可预期错误**。它将成功与失败封装在类型签名中，实现比 `try-catch` 更安全、高效的代码流。

`Result` 由两种状态组成：`Result<T, E> = Success<T> | Failure<E>`。成功时表示结果的类型 `T`，失败时表示错误的类型 `E`。

---

## 使用场景

- **替代 try-catch**：当需要表达**非致命错误**时，若使用 `throw`，外部必须包装 `try-catch`，且类型签名无法直观预示可能发生的错误。此外，引擎需要进行额外的堆栈展开来捕捉 `throw`，造成性能损耗。
- **函数式链式调用**：相比嵌套的 if-else，Result 允许使用 `map`、`andThen` 进行流水线操作。
- **强制错误处理**：编译器会强制下游处理 Failure 分支，若不处理则无法收敛到 `Success<T>`，也就无法直接使用具体值。

---

## 使用示例

没有 Result：

```typescript
const divide = (dividend: number, divisor: number): number => {
  if (divisor === 0) {
    throw new Error("Cannot divide by zero");
  }
  return dividend / divisor;
}
```

> 除零通常被视为不可恢复的致命错误，此时使用 `throw` 是正确的设计，此处仅作示例。

使用 Result：

```typescript
const divide = (dividend: number, divisor: number): Result<number, Error> => {
  if (divisor === 0) {
    return Err(new Error("Cannot divide by zero"));
  }
  return Ok(dividend / divisor);
}
```

下游可以明确知道此处可能发生错误，且错误类型为 `Error`、成功类型为 `number`。

---

## 类型定义

```typescript
interface Success<T> {
  readonly ok: true;
  readonly value: T;
}

interface Failure<E> {
  readonly ok: false;
  readonly error: E;
}

type Result<T, E> = Readonly<Success<T> | Failure<E>>;
type AsyncResult<T, E> = Promise<Result<T, E>>;
type AnyResult<T, E> = Result<T, E> | AsyncResult<T, E> | PromiseLike<Result<T, E>>;
```

---

## 构造函数

### Ok

构造一个成功的 Result。

```typescript
const Ok = <T, E = never>(value: T): Result<T, E>
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `value` | `T` | 要包装的成功值 |

**返回值：** 包含该值的 `Result<T, E>`

**示例：**

```typescript
const result = Ok(42);        // Result<number, never>
const result2 = Ok("hello");  // Result<string, never>
```

---

### Err

构造一个失败的 Result。

```typescript
const Err = <T = never, E = unknown>(error: E): Result<T, E>
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `error` | `E` | 要包装的错误值 |

**返回值：** 包含该错误的 `Result<T, E>`

**示例：**

```typescript
const result = Err(new Error("failed"));  // Result<never, Error>
const result2 = Err("error message");     // Result<never, string>
```

---

## 类型守卫

### isOk

检查 Result 是否为成功状态。

```typescript
const isOk = <T, E>(result: Result<T, E>): result is Success<T>
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `result` | `Result<T, E>` | 要检查的 Result |

**返回值：** `boolean`，如果为成功状态则返回 `true`，同时 TypeScript 会将类型收窄为 `Success<T>`

**示例：**

```typescript
const result = Ok(42);
if (isOk(result)) {
  console.log(result.value);  // 42
}
```

---

### isErr

检查 Result 是否为失败状态。

```typescript
const isErr = <T, E>(result: Result<T, E>): result is Failure<E>
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `result` | `Result<T, E>` | 要检查的 Result |

**返回值：** `boolean`，如果为失败状态则返回 `true`，同时 TypeScript 会将类型收窄为 `Failure<E>`

**示例：**

```typescript
const result = Err(new Error("failed"));
if (isErr(result)) {
  console.log(result.error.message);  // "failed"
}
```

---

### isOkAnd

检查 Result 是否为成功状态，且值满足给定条件。

```typescript
const isOkAnd = <T, E>(result: Result<T, E>, fn: (value: T) => boolean): boolean
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `result` | `Result<T, E>` | 要检查的 Result |
| `fn` | `(value: T) => boolean` | 条件函数 |

**返回值：** 如果为 Ok 且值满足条件则返回 `true`

**示例：**

```typescript
isOkAnd(Ok(5), x => x > 0);   // true
isOkAnd(Ok(-1), x => x > 0);  // false
isOkAnd(Err("err"), x => x > 0);  // false
```

---

### isErrAnd

检查 Result 是否为失败状态，且错误满足给定条件。

```typescript
const isErrAnd = <T, E>(result: Result<T, E>, fn: (error: E) => boolean): boolean
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `result` | `Result<T, E>` | 要检查的 Result |
| `fn` | `(error: E) => boolean` | 条件函数 |

**返回值：** 如果为 Err 且错误满足条件则返回 `true`

**示例：**

```typescript
isErrAnd(Err(new TypeError()), e => e instanceof TypeError);  // true
isErrAnd(Ok(1), e => true);  // false
```

---

## 异常安全执行

### safeExecute

安全执行同步函数，捕获异常并包装为 Result。

```typescript
function safeExecute<T>(fn: () => T, message?: string): Result<T, UnknownError>
function safeExecute<T, E>(
  fn: () => T,
  message: string | undefined,
  isExpectedError: (error: unknown) => error is E
): Result<T, E | UnknownError>
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `fn` | `() => T` | 要执行的函数 |
| `message` | `string \| undefined` | 可选，错误消息 |
| `isExpectedError` | `(error: unknown) => error is E` | 可选，预期错误类型守卫 |

**返回值：** 如果执行成功返回 Ok，如果抛出异常返回 Err

**示例：**

```typescript
// 基础用法
const result = safeExecute(() => JSON.parse('{"a":1}'));
// Ok({a: 1})

const result2 = safeExecute(() => JSON.parse("invalid"));
// Err(UnknownError)

// 带类型守卫
const result3 = safeExecute(
  () => { throw new TypeError("type error"); },
  undefined,
  (e): e is TypeError => e instanceof TypeError
);
// Err(TypeError)
```

---

### safeExecuteAsync

安全执行异步函数，捕获异常并包装为 AsyncResult。

```typescript
function safeExecuteAsync<T>(async_fn: () => Promise<T>, message?: string): AsyncResult<T, UnknownError>
function safeExecuteAsync<T, E>(
  async_fn: () => Promise<T>,
  message: string | undefined,
  isExpectedError: (error: unknown) => error is E
): AsyncResult<T, E | UnknownError>
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `async_fn` | `() => Promise<T>` | 要执行的异步函数 |
| `message` | `string \| undefined` | 可选，错误消息 |
| `isExpectedError` | `(error: unknown) => error is E` | 可选，预期错误类型守卫 |

**返回值：** AsyncResult，如果执行成功 resolve 为 Ok，如果 reject 为 Err

**示例：**

```typescript
const result = await safeExecuteAsync(() => fetch("/api/data").then(r => r.json()));
```

---

## AsyncResult

几乎所有同步自由函数均提供对应的 `*Async` 版本（例如：`map` → `mapAsync`）。

### 中断处理与异常规范

所有异步函数均支持 `AbortSignal`。需特别注意：**中断操作不会主动抛出（throw）错误**，而是将异常标准化为 `DOMException` 并通过 Result 链条继续传递。

受此影响，异步版本的返回类型会自动提升，新增 `UnknownError` 与 `DOMException` 枚举：

```
AsyncResult<T, E> → AsyncResult<T, E | UnknownError | DOMException>
```

- **DOMException**：专门用于响应并承载中断信号。
- **UnknownError**：确保当内部函数发生未捕获异常（reject）时，错误不会逃逸出类型系统。

这种设计强制将 Promise 的副作用收敛至 Result 结构中，从而保证框架逻辑的**纯粹性**。

### 异步 API 列表

| 同步版本    | 异步版本           |
| ----------- | ------------------ |
| `map`       | `mapAsync`         |
| `mapErr`    | `mapErrAsync`      |
| `mapBoth`   | `mapBothAsync`     |
| `andThen`   | `andThenAsync`     |
| `recover`   | `recoverAsync`     |
| `orElse`    | `orElseAsync`      |
| `filter`    | `filterAsync`      |
| `match`     | `matchResultAsync` |
| `ifOk`      | `ifOkAsync`        |
| `ifErr`     | `ifErrAsync`       |
| `mapOrElse` | `mapOrElseAsync`   |
| `peekOk`    | `peekOkAsync`      |
| `peekErr`   | `peekErrAsync`     |
| `peekBoth`  | `peekBothAsync`    |
| `all`       | `allAsync`         |
| `mapAll`    | `mapAllAsync`      |
| `reduce`    | `reduceAsync`      |
| `partition` | `partitionAsync`   |

### 异步示例

```typescript
// 带中断信号的异步映射
const controller = new AbortController();
const result = await mapAsync(
  Ok(5),
  async (x, signal) => {
    // 可检查中断状态
    signal?.throwIfAborted();
    return await fetchData(x);
  },
  controller.signal
);

// 异步链式调用
const result = await andThenAsync(
  fromPromise(fetch("/api/user")),
  async (user) => {
    const posts = await fetch(`/api/posts?userId=${user.id}`);
    return fromPromise(posts.json());
  }
);
```

> **兼容性**：绝大多数异步函数具备处理 `AnyResult` 的能力，可无缝接收并处理同步或异步的 Result 输入。

---

## 相关文档

- [操作符](./operators.md) - 转换、组合和处理 Result 的操作符
- [消费者](./consumers.md) - 提取、消费 Result 值或错误的函数
