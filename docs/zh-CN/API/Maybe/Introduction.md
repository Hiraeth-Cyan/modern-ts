# Maybe

Maybe 类型是函数式编程中处理可空值的经典抽象，它明确表达了"值可能存在也可能不存在"的语义，帮助开发者以类型安全的方式处理 `null` 和 `undefined`。

---

## 类型定义

```typescript
type Maybe<T> = T | null | undefined;
type AsyncMaybe<T> = Promise<Maybe<T>>;
type AnyMaybe<T> = Maybe<T> | AsyncMaybe<T> | PromiseLike<Maybe<T>>;
```

---

## 构造函数

### Some

构造一个包含非空值的 Maybe。

```typescript
const Some = <T>(value: T): Maybe<T>
```

| 参数    | 类型 | 描述           |
| ------- | ---- | -------------- |
| `value` | `T`  | 要包装的非空值 |

**返回值：** 包含该值的 `Maybe<T>`

**示例：**

```typescript
const maybe = Some(42);       // Maybe<number> = 42
const maybe2 = Some("hello"); // Maybe<string> = "hello"
```

---

### None

构造一个空值 Maybe。

```typescript
const None = (): Maybe<never>
```

**返回值：** `undefined`（表示无值）

**示例：**

```typescript
const maybe = None();  // Maybe<never> = undefined
```

---

## 类型守卫

### isSome

检查 Maybe 是否包含值。

```typescript
const isSome = <T>(m: Maybe<T>): m is T
```

| 参数 | 类型       | 描述              |
| ---- | ---------- | ----------------- |
| `m`  | `Maybe<T>` | 要检查的 Maybe 值 |

**返回值：** `boolean`，如果包含值则返回 `true`，同时 TypeScript 会将类型收窄为 `T`

**示例：**

```typescript
isSome(42);        // true
isSome(null);      // false
isSome(undefined); // false
isSome(0);         // true (0 是有效值)
isSome("");        // true (空字符串是有效值)
```

---

### isNone

检查 Maybe 是否为空。

```typescript
const isNone = (m: Maybe<unknown>): m is null | undefined
```

| 参数 | 类型             | 描述              |
| ---- | ---------------- | ----------------- |
| `m`  | `Maybe<unknown>` | 要检查的 Maybe 值 |

**返回值：** `boolean`，如果为 `null` 或 `undefined` 则返回 `true`

**示例：**

```typescript
isNone(null);      // true
isNone(undefined); // true
isNone(0);         // false
isNone("");        // false
```

---

## 类型转换

### fromNullable

将可空值转换为 Maybe。

```typescript
const fromNullable = <T>(value: T | null | undefined): Maybe<T>
```

| 参数    | 类型                     | 描述                          |
| ------- | ------------------------ | ----------------------------- |
| `value` | `T \| null \| undefined` | 可能为 null 或 undefined 的值 |

**返回值：** 如果值存在则返回该值，否则返回 `undefined`

**示例：**

```typescript
fromNullable(42);        // 42
fromNullable(null);      // undefined
fromNullable(undefined); // undefined
fromNullable(0);         // 0 (0 是有效值)
```

---

### fromFalsy

将假值转换为 Maybe（假值包括 `null`、`undefined`、`false`、`0`、`""`）。

```typescript
const fromFalsy = <T>(value: T | null | undefined | false | 0 | ''): Maybe<T>
```

| 参数    | 类型                                         | 描述           |
| ------- | -------------------------------------------- | -------------- |
| `value` | `T \| null \| undefined \| false \| 0 \| ''` | 可能为假值的值 |

**返回值：** 如果值为真值则返回该值，否则返回 `undefined`

**示例：**

```typescript
fromFalsy(42);      // 42
fromFalsy(0);       // undefined
fromFalsy("");      // undefined
fromFalsy(false);   // undefined
fromFalsy("hello"); // "hello"
```

---

### toNullable

将 Maybe 转换为可空值。

```typescript
const toNullable = <T>(maybe: Maybe<T>): T | null
```

| 参数    | 类型       | 描述     |
| ------- | ---------- | -------- |
| `maybe` | `Maybe<T>` | Maybe 值 |

**返回值：** 如果为 Some 则返回值，如果为 None 则返回 `null`

**示例：**

```typescript
toNullable(42);        // 42
toNullable(undefined); // null
toNullable(null);      // null
```

---

### toResult

将 Maybe 转换为 Result 类型。

```typescript
const toResult = <T, E>(maybe: Maybe<T>, errorFn: () => E): Result<T, E>
```

| 参数      | 类型       | 描述             |
| --------- | ---------- | ---------------- |
| `maybe`   | `Maybe<T>` | Maybe 值         |
| `errorFn` | `() => E`  | 生成错误值的函数 |

**返回值：** 如果为 Some 则返回 `Ok(value)`，如果为 None 则返回 `Err(errorFn())`

**示例：**

```typescript
toResult(42, () => "No value");      // Ok(42)
toResult(null, () => "No value");    // Err("No value")
```

---

### toArray

将 Maybe 转换为数组表示。

```typescript
const toArray = <T>(val: Maybe<T>): T[]
```

| 参数  | 类型       | 描述     |
| ----- | ---------- | -------- |
| `val` | `Maybe<T>` | Maybe 值 |

**返回值：** 如果为 Some 则返回单元素数组，如果为 None 则返回空数组

**示例：**

```typescript
toArray(42);        // [42]
toArray(null);      // []
toArray(undefined); // []
```

---

### transpose

将包含 Promise 的 Maybe 转换为 AsyncMaybe。

```typescript
async function transpose<T>(val: Maybe<Promise<T>>): AsyncMaybe<T>
```

| 参数  | 类型                | 描述                  |
| ----- | ------------------- | --------------------- |
| `val` | `Maybe<Promise<T>>` | 包含 Promise 的 Maybe |

**返回值：** Promise，解析为 `Maybe<T>`

**示例：**

```typescript
const maybe_promise = Some(Promise.resolve(42));
const async_maybe = await transpose(maybe_promise);  // 42
```

---

## AsyncMaybe

几乎所有同步消费者均提供对应的 `*Async` 版本。

### 中断处理与异常规范

所有异步函数均支持 `AbortSignal`。**与 Result 不同，Maybe 的中断操作会直接抛出 `DOMException`**。

```typescript
const controller = new AbortController();
controller.abort();

await matchAsync(Some(5),
  async v => v * 2,
  async () => 0,
  controller.signal
);
// 抛出 DOMException: This operation was aborted
```

这种差异源于 Maybe 的设计目标：它仅表示"值存在或不存在"，无法承载错误信息。因此：
- **中断信号**：直接抛出 `DOMException`
- **未捕获异常**：直接抛出原始错误

### 异步 API 列表

| 同步版本   | 异步版本        |
| ---------- | --------------- |
| `match`    | `matchAsync`    |
| `ifSome`   | `ifSomeAsync`   |
| `ifNone`   | `ifNoneAsync`   |
| `peek`     | `peekAsync`     |
| `peekNone` | `peekNoneAsync` |
| `peekBoth` | `peekBothAsync` |

### 异步示例

```typescript
// 带中断信号的异步匹配
const controller = new AbortController();
const result = await matchAsync(
  Some(42),
  async (v) => `Value: ${v}`,
  async () => "No value",
  controller.signal
);

// 异步副作用
await peekAsync(
  Some("user_123"),
  async (id) => {
    await logToServer(`User accessed: ${id}`);
  }
);
```

> **兼容性**：绝大多数异步函数具备处理 `AnyMaybe` 的能力，可无缝接收并处理同步或异步的 Maybe 输入。

---

## 使用示例

### 基础使用

```typescript
// 创建 Maybe
const maybe_value = Some(42);
const empty = None();

// 类型守卫检查
if (isSome(maybe_value)) {
  console.log(maybe_value * 2);  // 类型已收窄为 number
}

// 转换
const from_null = fromNullable(someNullableValue);
```

### 与 Result 的对比

| 特性       | Maybe                          | Result                             |
| ---------- | ------------------------------ | ---------------------------------- |
| 语义       | 值存在或不存在                 | 成功或失败                         |
| 错误信息   | 无                             | 有（E 类型）                       |
| 适用场景   | 可空值处理                     | 错误处理                           |
| 异步中断   | 抛出异常                       | 返回 Err                           |
| 类型复杂度 | 简单（T \| null \| undefined） | 较复杂（Success<T> \| Failure<E>） |

**选择建议**：
- 当只需表示"有或无"时，使用 Maybe
- 当需要携带错误信息或进行错误恢复时，使用 Result
- 可以通过 `toResult` 在两者之间转换
