# Maybe 消费者

消费者函数用于提取、消费 Maybe 中的值或执行副作用操作。

---

## 消费操作

### match

模式匹配，根据 Maybe 状态执行不同回调。

```typescript
const match = <T, R>(val: Maybe<T>, onSome: (value: T) => R, onNone: () => R): R
```

| 参数     | 类型              | 描述              |
| -------- | ----------------- | ----------------- |
| `val`    | `Maybe<T>`        | 要匹配的 Maybe 值 |
| `onSome` | `(value: T) => R` | 有值时执行的回调  |
| `onNone` | `() => R`         | 无值时执行的回调  |

**返回值：** 回调函数的返回值

**示例：**

```typescript
match(Some(42),
  v => `Value: ${v}`,
  () => "No value"
);  // "Value: 42"

match(None(),
  v => `Value: ${v}`,
  () => "No value"
);  // "No value"
```

---

### ifSome

有值时执行回调。

```typescript
function ifSome<T, R1>(val: Maybe<T>, onSome: (value: T) => R1): R1 | void
function ifSome<T, R1, R2>(val: Maybe<T>, onSome: (value: T) => R1, onElse: () => R2): R1 | R2
```

| 参数     | 类型               | 描述                   |
| -------- | ------------------ | ---------------------- |
| `val`    | `Maybe<T>`         | 要检查的 Maybe 值      |
| `onSome` | `(value: T) => R1` | 有值时执行的回调       |
| `onElse` | `() => R2`         | 可选，无值时执行的回调 |

**返回值：** 如果为 Some 返回 `onSome` 的结果，如果提供了 `onElse` 且为 None 则返回其结果，否则返回 `void`

**示例：**

```typescript
ifSome(Some(42), v => console.log(v));  // 42
ifSome(Some(42), v => v * 2, () => 0);   // 84
ifSome(None(), v => v * 2, () => 0);     // 0
```

---

### ifNone

无值时执行回调。

```typescript
function ifNone<T, R1>(val: Maybe<T>, onNone: () => R1): R1 | void
function ifNone<T, R1, R2>(val: Maybe<T>, onNone: () => R1, onElse: (value: T) => R2): R1 | R2
```

| 参数     | 类型               | 描述                   |
| -------- | ------------------ | ---------------------- |
| `val`    | `Maybe<T>`         | 要检查的 Maybe 值      |
| `onNone` | `() => R1`         | 无值时执行的回调       |
| `onElse` | `(value: T) => R2` | 可选，有值时执行的回调 |

**返回值：** 如果为 None 返回 `onNone` 的结果，如果提供了 `onElse` 且为 Some 则返回其结果，否则返回 `void`

**示例：**

```typescript
ifNone(None(), () => console.log("empty"));  // "empty"
ifNone(None(), () => "default", v => v);      // "default"
ifNone(Some(42), () => "default", v => v);    // 42
```

---

## 副作用操作

### peek

有值时执行副作用，返回原 Maybe。

```typescript
const peek = <T>(val: Maybe<T>, fn: (v: T) => void): Maybe<T>
```

| 参数  | 类型             | 描述              |
| ----- | ---------------- | ----------------- |
| `val` | `Maybe<T>`       | 要检查的 Maybe 值 |
| `fn`  | `(v: T) => void` | 副作用函数        |

**返回值：** 原 Maybe 值

**示例：**

```typescript
peek(Some(42), v => console.log(`Got: ${v}`));  // 42, logs "Got: 42"
peek(None(), v => console.log(`Got: ${v}`));    // undefined, 无输出
```

---

### peekNone

无值时执行副作用，返回原 Maybe。

```typescript
const peekNone = <T>(val: Maybe<T>, fn: () => void): Maybe<T>
```

| 参数  | 类型         | 描述              |
| ----- | ------------ | ----------------- |
| `val` | `Maybe<T>`   | 要检查的 Maybe 值 |
| `fn`  | `() => void` | 副作用函数        |

**返回值：** 原 Maybe 值

**示例：**

```typescript
peekNone(None(), () => console.log("empty"));   // undefined, logs "empty"
peekNone(Some(42), () => console.log("empty")); // 42, 无输出
```

---

### peekBoth

根据状态执行对应副作用，返回原 Maybe。

```typescript
function peekBoth<T>(
  val: Maybe<T>,
  options: {
    fnSome?: (v: T) => void;
    fnNone?: () => void;
  }
): Maybe<T>
```

| 参数             | 类型             | 描述                     |
| ---------------- | ---------------- | ------------------------ |
| `val`            | `Maybe<T>`       | 要检查的 Maybe 值        |
| `options.fnSome` | `(v: T) => void` | 可选，有值时执行的副作用 |
| `options.fnNone` | `() => void`     | 可选，无值时执行的副作用 |

**返回值：** 原 Maybe 值

**示例：**

```typescript
peekBoth(Some(42), {
  fnSome: v => console.log(`Value: ${v}`),
  fnNone: () => console.log("Empty")
});  // 42, logs "Value: 42"

peekBoth(None(), {
  fnSome: v => console.log(`Value: ${v}`),
  fnNone: () => console.log("Empty")
});  // undefined, logs "Empty"
```

---

## AsyncMaybe 消费者

几乎所有同步消费者均提供对应的 `*Async` 版本。

### 异步消费者签名

所有异步消费者都遵循以下模式：
- 接受 `AnyMaybe<T>` 作为输入（支持同步或异步 Maybe）
- 可选的 `AbortSignal` 参数用于取消操作
- 返回 `Promise<R>`

**示例：**

```typescript
// 异步 match
const result = await matchAsync(
  Some(42),
  async v => `Value: ${v}`,
  async () => "No value"
);  // "Value: 42"

// 带取消的异步操作
const controller = new AbortController();
const result = await ifSomeAsync(
  Some(10),
  async x => console.log(x),
  controller.signal
);
```

### 异步 API 列表

| 同步版本   | 异步版本        |
| ---------- | --------------- |
| `match`    | `matchAsync`    |
| `ifSome`   | `ifSomeAsync`   |
| `ifNone`   | `ifNoneAsync`   |
| `peek`     | `peekAsync`     |
| `peekNone` | `peekNoneAsync` |
| `peekBoth` | `peekBothAsync` |

> **兼容性**：绝大多数异步函数具备处理 `AnyMaybe` 的能力，可无缝接收并处理同步或异步的 Maybe 输入。

> **注意**：关于中断处理与异常规范的详细说明，请参考 [Introduction.md](./Introduction.md#asyncmaybe) 中的 AsyncMaybe 部分。
