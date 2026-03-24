# Result 消费者

消费者函数用于提取、消费 Result 中的值或错误，以及执行副作用操作。

---

## 消费操作

### match

模式匹配，根据 Result 状态执行不同回调。

```typescript
const match = <T, E, R1, R2>(
  result: Result<T, E>,
  onOk: (value: T) => R1,
  onErr: (error: E) => R2
): R1 | R2
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `result` | `Result<T, E>` | 要匹配的 Result |
| `onOk` | `(value: T) => R1` | 成功时执行的回调 |
| `onErr` | `(error: E) => R2` | 失败时执行的回调 |

**返回值：** 回调函数的返回值

**示例：**

```typescript
match(Ok(42),
  v => `Success: ${v}`,
  e => `Error: ${e}`
);  // "Success: 42"

match(Err("failed"),
  v => `Success: ${v}`,
  e => `Error: ${e}`
);  // "Error: failed"
```

---

### ifOk

成功时执行回调。

```typescript
function ifOk<T, E, R1>(result: Result<T, E>, onOk: (value: T) => R1): R1 | void
function ifOk<T, E, R1, R2>(
  result: Result<T, E>,
  onOk: (value: T) => R1,
  onElse: (error: E) => R2
): R1 | R2
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `result` | `Result<T, E>` | 要检查的 Result |
| `onOk` | `(value: T) => R1` | 成功时执行的回调 |
| `onElse` | `(error: E) => R2` | 可选，失败时执行的回调 |

**返回值：** 如果为 Ok 返回 `onOk` 的结果，如果提供了 `onElse` 且为 Err 则返回其结果，否则返回 `void`

**示例：**

```typescript
ifOk(Ok(42), v => console.log(v));  // 42
ifOk(Ok(42), v => v * 2, e => 0);   // 84
ifOk(Err("err"), v => v * 2, e => 0);  // 0
```

---

### ifErr

失败时执行回调。

```typescript
function ifErr<T, E, R1>(result: Result<T, E>, onErr: (error: E) => R1): R1 | void
function ifErr<T, E, R1, R2>(
  result: Result<T, E>,
  onErr: (error: E) => R1,
  onElse: (value: T) => R2
): R1 | R2
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `result` | `Result<T, E>` | 要检查的 Result |
| `onErr` | `(error: E) => R1` | 失败时执行的回调 |
| `onElse` | `(value: T) => R2` | 可选，成功时执行的回调 |

**返回值：** 如果为 Err 返回 `onErr` 的结果，如果提供了 `onElse` 且为 Ok 则返回其结果，否则返回 `void`

**示例：**

```typescript
ifErr(Err("err"), e => console.error(e));  // "err"
ifErr(Err("err"), e => e.toUpperCase(), v => v);  // "ERR"
```

---

### mapOrElse

转换 Result 为单一类型，失败时使用默认函数。

```typescript
const mapOrElse = <T, E, R1, R2>(
  result: Result<T, E>,
  defaultFn: (error: E) => R1,
  mapFn: (value: T) => R2
): R1 | R2
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `result` | `Result<T, E>` | 要转换的 Result |
| `defaultFn` | `(error: E) => R1` | 失败时的默认函数 |
| `mapFn` | `(value: T) => R2` | 成功时的映射函数 |

**返回值：** 如果为 Ok 返回 `mapFn(value)`，否则返回 `defaultFn(error)`

**示例：**

```typescript
mapOrElse(Ok(5), e => 0, x => x * 2);   // 10
mapOrElse(Err("err"), e => 0, x => x * 2);  // 0
```

---

## 副作用操作

### peekOk

成功时执行副作用，返回原 Result。

```typescript
function peekOk<T, E>(result: Result<T, E>, fnOk: (value: T) => void): Result<T, E>
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `result` | `Result<T, E>` | 要检查的 Result |
| `fnOk` | `(value: T) => void` | 成功时执行的副作用 |

**返回值：** 原 Result 值

**示例：**

```typescript
peekOk(Ok(42), v => console.log(`Got: ${v}`));  // Ok(42), logs "Got: 42"
```

---

### peekErr

失败时执行副作用，返回原 Result。

```typescript
function peekErr<T, E>(result: Result<T, E>, fnErr: (error: E) => void): Result<T, E>
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `result` | `Result<T, E>` | 要检查的 Result |
| `fnErr` | `(error: E) => void` | 失败时执行的副作用 |

**返回值：** 原 Result 值

**示例：**

```typescript
peekErr(Err("err"), e => console.error(e));  // Err("err"), logs "err"
```

---

### peekBoth

根据状态执行对应副作用，返回原 Result。

```typescript
function peekBoth<T, E>(
  result: Result<T, E>,
  options: {
    fnOk?: (value: T) => void;
    fnErr?: (error: E) => void;
  }
): Result<T, E>
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `result` | `Result<T, E>` | 要检查的 Result |
| `options.fnOk` | `(value: T) => void` | 可选，成功时执行的副作用 |
| `options.fnErr` | `(error: E) => void` | 可选，失败时执行的副作用 |

**返回值：** 原 Result 值

**示例：**

```typescript
peekBoth(Ok(42), {
  fnOk: v => console.log(`Success: ${v}`),
  fnErr: e => console.error(`Error: ${e}`)
});  // Ok(42), logs "Success: 42"

peekBoth(Err("failed"), {
  fnOk: v => console.log(`Success: ${v}`),
  fnErr: e => console.error(`Error: ${e}`)
});  // Err("failed"), logs "Error: failed"
```

---

## AsyncResult 消费者

几乎所有同步消费者均提供对应的 `*Async` 版本。

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
| `match`     | `matchResultAsync` |
| `ifOk`      | `ifOkAsync`        |
| `ifErr`     | `ifErrAsync`       |
| `mapOrElse` | `mapOrElseAsync`   |
| `peekOk`    | `peekOkAsync`      |
| `peekErr`   | `peekErrAsync`     |
| `peekBoth`  | `peekBothAsync`    |

### 异步示例

```typescript
// 带中断信号的异步匹配
const controller = new AbortController();
const result = await matchResultAsync(
  Ok(42),
  async v => `Success: ${v}`,
  async e => `Error: ${e}`,
  controller.signal
);

// 异步副作用
await peekOkAsync(
  Ok("user_123"),
  async (id) => {
    await logToServer(`User accessed: ${id}`);
  }
);
```

> **兼容性**：绝大多数异步函数具备处理 `AnyResult` 的能力，可无缝接收并处理同步或异步的 Result 输入。
