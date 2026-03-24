# Result 操作符

操作符用于转换、组合和处理 Result 中的值或错误。

---

## 类型转换

### fromPromise

将 Promise 转换为 AsyncResult。

```typescript
const fromPromise = <T>(promise: Promise<T>): AsyncResult<T, UnknownError>
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `promise` | `Promise<T>` | 要转换的 Promise |

**返回值：** `AsyncResult<T, UnknownError>`，成功时 resolve 为 Ok，失败时 reject 为 Err

**示例：**

```typescript
const result = await fromPromise(fetch("/api/data").then(r => r.json()));
```

---

### toPromise

将 Result 转换为 Promise。成功时 resolve，失败时 reject。

```typescript
const toPromise = <T, E>(result: Result<T, E>): Promise<T>
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `result` | `Result<T, E>` | 要转换的 Result |

**返回值：** Promise，成功时 resolve 为值，失败时 reject 为错误

**示例：**

```typescript
await toPromise(Ok(42));           // 42
await toPromise(Err("failed"));    // throws "failed"
```

---

### normalizeToResult

将 AnyResult（同步或异步）标准化为 Promise<Result>。

```typescript
const normalizeToResult = <T, E>(awaitable: AnyResult<T, E>): Promise<Result<T, E | UnknownError | DOMException>>
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `awaitable` | `AnyResult<T, E>` | 同步或异步的 Result |

**返回值：** Promise<Result>，标准化后的结果

---

## 转换操作

### map

映射成功值。

```typescript
const map = <T, E, U>(result: Result<T, E>, fn: (v: T) => U): Result<U, E>
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `result` | `Result<T, E>` | 要映射的 Result |
| `fn` | `(v: T) => U` | 映射函数 |

**返回值：** 如果为 Ok 则返回映射后的值，如果为 Err 则保持错误不变

**示例：**

```typescript
map(Ok(5), x => x * 2);        // Ok(10)
map(Err("err"), x => x * 2);   // Err("err")
```

---

### mapErr

映射错误值。

```typescript
const mapErr = <T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F>
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `result` | `Result<T, E>` | 要映射的 Result |
| `fn` | `(error: E) => F` | 错误映射函数 |

**返回值：** 如果为 Err 则返回映射后的错误，如果为 Ok 则保持值不变

**示例：**

```typescript
mapErr(Err(404), code => `Error: ${code}`);  // Err("Error: 404")
mapErr(Ok(1), code => `Error: ${code}`);     // Ok(1)
```

---

### mapBoth

同时映射成功值和错误值。

```typescript
const mapBoth = <T, E, U, F>(
  result: Result<T, E>,
  mapOk: (value: T) => U,
  mapErr: (error: E) => F
): Result<U, F>
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `result` | `Result<T, E>` | 要映射的 Result |
| `mapOk` | `(value: T) => U` | 成功值映射函数 |
| `mapErr` | `(error: E) => F` | 错误映射函数 |

**返回值：** 根据原状态返回映射后的 Ok 或 Err

**示例：**

```typescript
mapBoth(Ok(5), x => x * 2, e => e.toUpperCase());   // Ok(10)
mapBoth(Err("err"), x => x * 2, e => e.toUpperCase());  // Err("ERR")
```

---

### andThen

链式调用，根据成功值返回新的 Result。

```typescript
const andThen = <T, E, U, F>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, F>
): Result<U, E | F>
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `result` | `Result<T, E>` | 要链式调用的 Result |
| `fn` | `(value: T) => Result<U, F>` | 返回新 Result 的函数 |

**返回值：** 如果为 Ok 则返回 `fn` 的结果，如果为 Err 则保持错误不变

**示例：**

```typescript
const parseNumber = (s: string): Result<number, string> => {
  const n = parseInt(s);
  return isNaN(n) ? Err("Not a number") : Ok(n);
};

andThen(Ok("42"), parseNumber);    // Ok(42)
andThen(Ok("abc"), parseNumber);   // Err("Not a number")
andThen(Err("input error"), parseNumber);  // Err("input error")
```

---

### recover

错误恢复，对错误值应用恢复函数。

```typescript
const recover = <T, E, U, F>(
  result: Result<T, E>,
  fn: (error: E) => Result<U, F>
): Result<T | U, F>
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `result` | `Result<T, E>` | 要恢复的 Result |
| `fn` | `(error: E) => Result<U, F>` | 恢复函数 |

**返回值：** 如果为 Err 则返回恢复后的结果，如果为 Ok 则保持原值

**示例：**

```typescript
recover(Err("error"), e => Ok("fallback"));  // Ok("fallback")
recover(Ok(42), e => Ok(0));                  // Ok(42)
```

---

### orElse

备选操作，失败时执行备选函数。

```typescript
const orElse = <T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => Result<T, F>
): Result<T, F>
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `result` | `Result<T, E>` | 要处理的 Result |
| `fn` | `(error: E) => Result<T, F>` | 备选函数 |

**返回值：** 如果为 Ok 则返回原值，如果为 Err 则返回备选结果

**示例：**

```typescript
orElse(Err("error"), e => Ok("default"));  // Ok("default")
orElse(Ok(42), e => Ok(0));                 // Ok(42)
```

---

### filter

过滤成功值，不满足条件时返回错误。

```typescript
function filter<T, E, F, S extends T>(
  result: Result<T, E>,
  predicate: (value: T) => value is S,
  getErrorOnFail: (value: T) => F
): Result<S, E | F>

function filter<T, E, F>(
  result: Result<T, E>,
  predicate: (value: T) => boolean,
  getErrorOnFail: (value: T) => F
): Result<T, E | F>
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `result` | `Result<T, E>` | 要过滤的 Result |
| `predicate` | `(value: T) => boolean` | 过滤条件 |
| `getErrorOnFail` | `(value: T) => F` | 过滤失败时的错误生成函数 |

**返回值：** 如果为 Ok 且满足条件则返回值，否则返回 Err

**示例：**

```typescript
filter(Ok(5), x => x > 0, x => `${x} is not positive`);   // Ok(5)
filter(Ok(-1), x => x > 0, x => `${x} is not positive`);  // Err("-1 is not positive")
filter(Err("err"), x => x > 0, x => "fail");              // Err("err")
```

---

## 组合操作

### all

组合多个 Result，全部成功则返回值数组，否则返回第一个错误。

```typescript
function all<T, E>(results: readonly Result<T, E>[]): Result<T[], E>
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `results` | `readonly Result<T, E>[]` | Result 数组 |

**返回值：** 如果全部成功则返回 Ok(值数组)，否则返回第一个 Err

**示例：**

```typescript
all([Ok(1), Ok(2), Ok(3)]);  // Ok([1, 2, 3])
all([Ok(1), Err("err"), Ok(3)]);  // Err("err")
```

---

### mapAll

对数组元素应用函数并组合结果。

```typescript
function mapAll<T, U, E>(
  items: readonly T[],
  fn: (item: T, index: number) => Result<U, E>
): Result<U[], E>
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `items` | `readonly T[]` | 输入数组 |
| `fn` | `(item: T, index: number) => Result<U, E>` | 映射函数 |

**返回值：** 如果全部映射成功则返回 Ok(结果数组)，否则返回第一个 Err

**示例：**

```typescript
mapAll(["1", "2", "3"], s => {
  const n = parseInt(s);
  return isNaN(n) ? Err("Invalid") : Ok(n);
});  // Ok([1, 2, 3])
```

---

### zip

将两个 Result 组合为元组。

```typescript
function zip<T, E, U, F>(
  result_a: Result<T, E>,
  result_b: Result<U, F>
): Result<[T, U], E | F>
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `result_a` | `Result<T, E>` | 第一个 Result |
| `result_b` | `Result<U, F>` | 第二个 Result |

**返回值：** 如果两者都为 Ok 则返回元组，否则返回第一个 Err

**示例：**

```typescript
zip(Ok(1), Ok("a"));   // Ok([1, "a"])
zip(Ok(1), Err("err"));  // Err("err")
```

---

### ap

Applicative Apply，将包装在 Result 中的函数应用到值上。

```typescript
function ap<T, E, U>(
  result_fab: Result<(value: T) => U, E>,
  result_a: Result<T, E>
): Result<U, E>
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `result_fab` | `Result<(value: T) => U, E>` | 包含函数的 Result |
| `result_a` | `Result<T, E>` | 包含值的 Result |

**返回值：** 如果两者都为 Ok 则返回函数应用结果，否则返回第一个 Err

**示例：**

```typescript
ap(Ok((x: number) => x * 2), Ok(5));  // Ok(10)
ap(Ok((x: number) => x * 2), Err("err"));  // Err("err")
```

---

### and

逻辑与操作，第一个成功则返回第二个。

```typescript
const and = <T, E, U>(result: Result<T, E>, other: Result<U, E>): Result<U, E>
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `result` | `Result<T, E>` | 第一个 Result |
| `other` | `Result<U, E>` | 第二个 Result |

**返回值：** 如果第一个为 Ok 则返回第二个，否则返回第一个 Err

**示例：**

```typescript
and(Ok(1), Ok(2));   // Ok(2)
and(Err("err"), Ok(2));  // Err("err")
```

---

### or

逻辑或操作，第一个成功则返回第一个，否则返回第二个。

```typescript
const or = <T, E, U, F>(
  result: Result<T, E>,
  other: Result<U, F>
): Result<T | U, F>
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `result` | `Result<T, E>` | 第一个 Result |
| `other` | `Result<U, F>` | 第二个 Result |

**返回值：** 如果第一个为 Ok 则返回第一个，否则返回第二个

**示例：**

```typescript
or(Ok(1), Ok(2));   // Ok(1)
or(Err("err"), Ok(2));  // Ok(2)
```

---

## 规约操作

### reduce

对多个 Result 进行规约，收集所有成功值或返回第一个错误。

```typescript
function reduce<T, E, R>(
  results: readonly Result<T, E>[],
  initial: R,
  reducer: (accumulator: R, value: T) => R
): Result<R, E>
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `results` | `readonly Result<T, E>[]` | Result 数组 |
| `initial` | `R` | 初始值 |
| `reducer` | `(accumulator: R, value: T) => R` | 规约函数 |

**返回值：** 如果全部成功则返回规约结果，否则返回第一个 Err

**示例：**

```typescript
reduce([Ok(1), Ok(2), Ok(3)], 0, (acc, x) => acc + x);  // Ok(6)
reduce([Ok(1), Err("err"), Ok(3)], 0, (acc, x) => acc + x);  // Err("err")
```

---

## 分区操作

### partition

将 Result 数组分离为成功值和错误值。

```typescript
function partition<T, E>(results: readonly Result<T, E>[]): [T[], E[]]
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `results` | `readonly Result<T, E>[]` | Result 数组 |

**返回值：** `[成功值数组, 错误值数组]`

**示例：**

```typescript
partition([Ok(1), Err("a"), Ok(2), Err("b")]);
// [[1, 2], ["a", "b"]]
```

---

### collectOk

收集所有成功值。

```typescript
const collectOk = <T, E>(results: readonly Result<T, E>[]): T[]
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `results` | `readonly Result<T, E>[]` | Result 数组 |

**返回值：** 所有 Ok 值的数组

**示例：**

```typescript
collectOk([Ok(1), Err("err"), Ok(2)]);  // [1, 2]
```

---

### collectErr

收集所有错误值。

```typescript
const collectErr = <T, E>(results: readonly Result<T, E>[]): E[]
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `results` | `readonly Result<T, E>[]` | Result 数组 |

**返回值：** 所有 Err 值的数组

**示例：**

```typescript
collectErr([Ok(1), Err("a"), Ok(2), Err("b")]);  // ["a", "b"]
```

---

## 扁平化操作

### flatten

展开一层嵌套的 Result。

```typescript
function flatten<T, E>(result: Result<T | Result<T, E>, E>): Result<T, E>
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `result` | `Result<T \| Result<T, E>, E>` | 嵌套的 Result |

**返回值：** 展开后的 Result

**示例：**

```typescript
flatten(Ok(Ok(5)));   // Ok(5)
flatten(Ok(Err("err")));  // Err("err")
flatten(Err("outer"));    // Err("outer")
```

---

### deepFlatten

递归展开多层嵌套的 Result。

```typescript
function deepFlatten<T, E>(result: Result<T | Result<unknown, E>, E>): Result<T, E>
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `result` | `Result<T \| Result<unknown, E>, E>` | 嵌套的 Result |

**返回值：** 递归展开后的 Result

**示例：**

```typescript
deepFlatten(Ok(Ok(Ok(5))));  // Ok(5)
```

---

### deepFlattenAsync

异步递归展开多层嵌套的 Result（包括 Promise）。

```typescript
async function deepFlattenAsync<T, E>(
  result_promise: PromiseLike<Result<T | Result<unknown, E>, E>> | Result<T | Result<unknown, E>, E>
): Promise<Result<T, E>>
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `result_promise` | `PromiseLike<Result<T \| Result<unknown, E>, E>> \| Result<T \| Result<unknown, E>, E>` | 嵌套的 Result 或 Promise |

**返回值：** Promise<Result>，递归展开后的结果

---

## 异步操作符

几乎所有同步操作符均提供对应的 `*Async` 版本。

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
| `all`       | `allAsync`         |
| `mapAll`    | `mapAllAsync`      |
| `zip`       | `zipAsync`         |
| `ap`        | `apAsync`          |
| `and`       | `andAsync`         |
| `or`        | `orAsync`          |
| `reduce`    | `reduceAsync`      |
| `partition` | `partitionAsync`   |
| `flatten`   | `flattenAsync`     |

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
