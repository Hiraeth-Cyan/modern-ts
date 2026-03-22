# Result

在 Rust、Swift 或 Kotlin（Arrow）中，`Result` 是一个枚举，用于显式处理**可预期错误**。它将成功与失败封装在类型签名中，实现比 `try-catch` 更安全、高效的代码流。

`Result` 由两种状态组成：`Result<T, E> = Success<T> | Failure<E>`。成功时表示结果的类型 `T`，失败时表示错误的类型 `E`。

## 使用场景

- **替代 try-catch**：当需要表达**非致命错误**时，若使用 `throw`，外部必须包装 `try-catch`，且类型签名无法直观预示可能发生的错误。此外，引擎需要进行额外的堆栈展开来捕捉 `throw`，造成性能损耗。
- **函数式链式调用**：相比嵌套的 if-else，Result 允许使用 `map`、`andThen` 进行流水线操作。
- **强制错误处理**：编译器会强制下游处理 Failure 分支，若不处理则无法收敛到 `Success<T>`，也就无法直接使用具体值。

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

**示例**

```typescript
const result = Ok(42);        // Result<number, never>
const result2 = Ok("hello");  // Result<string, never>
```

### Err

构造一个失败的 Result。

```typescript
const Err = <T = never, E = unknown>(error: E): Result<T, E>
```

**示例**

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

**示例**

```typescript
const result = Ok(42);
if (isOk(result)) {
  console.log(result.value);  // 42
}
```

### isErr

检查 Result 是否为失败状态。

```typescript
const isErr = <T, E>(result: Result<T, E>): result is Failure<E>
```

**示例**

```typescript
const result = Err(new Error("failed"));
if (isErr(result)) {
  console.log(result.error.message);  // "failed"
}
```

### isOkAnd

检查 Result 是否为成功状态，且值满足给定条件。

```typescript
const isOkAnd = <T, E>(result: Result<T, E>, fn: (value: T) => boolean): boolean
```

**示例**

```typescript
isOkAnd(Ok(5), x => x > 0);   // true
isOkAnd(Ok(-1), x => x > 0);  // false
isOkAnd(Err("err"), x => x > 0);  // false
```

### isErrAnd

检查 Result 是否为失败状态，且错误满足给定条件。

```typescript
const isErrAnd = <T, E>(result: Result<T, E>, fn: (error: E) => boolean): boolean
```

**示例**

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

**示例**

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

**示例**

```typescript
const result = await safeExecuteAsync(() => fetch("/api/data").then(r => r.json()));
```

---

## 类型转换

### fromPromise

将 Promise 转换为 AsyncResult。

```typescript
const fromPromise = <T>(promise: Promise<T>): AsyncResult<T, UnknownError>
```

**示例**

```typescript
const result = await fromPromise(fetch("/api/data").then(r => r.json()));
```

### toPromise

将 Result 转换为 Promise。成功时 resolve，失败时 reject。

```typescript
const toPromise = <T, E>(result: Result<T, E>): Promise<T>
```

**示例**

```typescript
await toPromise(Ok(42));           // 42
await toPromise(Err("failed"));    // throws "failed"
```

### normalizeToResult

将 AnyResult（同步或异步）标准化为 Promise<Result>。

```typescript
const normalizeToResult = <T, E>(awaitable: AnyResult<T, E>): Promise<Result<T, E | UnknownError | DOMException>>
```

---

## 转换操作

### map

映射成功值。

```typescript
const map = <T, E, U>(result: Result<T, E>, fn: (v: T) => U): Result<U, E>
```

**示例**

```typescript
map(Ok(5), x => x * 2);        // Ok(10)
map(Err("err"), x => x * 2);   // Err("err")
```

### mapErr

映射错误值。

```typescript
const mapErr = <T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F>
```

**示例**

```typescript
mapErr(Err(404), code => `Error: ${code}`);  // Err("Error: 404")
mapErr(Ok(1), code => `Error: ${code}`);     // Ok(1)
```

### mapBoth

同时映射成功值和错误值。

```typescript
const mapBoth = <T, E, U, F>(
  result: Result<T, E>,
  mapOk: (value: T) => U,
  mapErr: (error: E) => F
): Result<U, F>
```

**示例**

```typescript
mapBoth(Ok(5), x => x * 2, e => e.toUpperCase());   // Ok(10)
mapBoth(Err("err"), x => x * 2, e => e.toUpperCase());  // Err("ERR")
```

### andThen

链式调用，根据成功值返回新的 Result。

```typescript
const andThen = <T, E, U, F>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, F>
): Result<U, E | F>
```

**示例**

```typescript
const parseNumber = (s: string): Result<number, string> => {
  const n = parseInt(s);
  return isNaN(n) ? Err("Not a number") : Ok(n);
};

andThen(Ok("42"), parseNumber);    // Ok(42)
andThen(Ok("abc"), parseNumber);   // Err("Not a number")
andThen(Err("input error"), parseNumber);  // Err("input error")
```

### recover

错误恢复，对错误值应用恢复函数。

```typescript
const recover = <T, E, U, F>(
  result: Result<T, E>,
  fn: (error: E) => Result<U, F>
): Result<T | U, F>
```

**示例**

```typescript
recover(Err("error"), e => Ok("fallback"));  // Ok("fallback")
recover(Ok(42), e => Ok(0));                  // Ok(42)
```

### orElse

备选操作，失败时执行备选函数。

```typescript
const orElse = <T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => Result<T, F>
): Result<T, F>
```

**示例**

```typescript
orElse(Err("error"), e => Ok("default"));  // Ok("default")
orElse(Ok(42), e => Ok(0));                 // Ok(42)
```

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

**示例**

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

**示例**

```typescript
all([Ok(1), Ok(2), Ok(3)]);  // Ok([1, 2, 3])
all([Ok(1), Err("err"), Ok(3)]);  // Err("err")
```

### mapAll

对数组元素应用函数并组合结果。

```typescript
function mapAll<T, U, E>(
  items: readonly T[],
  fn: (item: T, index: number) => Result<U, E>
): Result<U[], E>
```

**示例**

```typescript
mapAll(["1", "2", "3"], s => {
  const n = parseInt(s);
  return isNaN(n) ? Err("Invalid") : Ok(n);
});  // Ok([1, 2, 3])
```

### zip

将两个 Result 组合为元组。

```typescript
function zip<T, E, U, F>(
  result_a: Result<T, E>,
  result_b: Result<U, F>
): Result<[T, U], E | F>
```

**示例**

```typescript
zip(Ok(1), Ok("a"));   // Ok([1, "a"])
zip(Ok(1), Err("err"));  // Err("err")
```

### ap

Applicative Apply，将包装在 Result 中的函数应用到值上。

```typescript
function ap<T, E, U>(
  result_fab: Result<(value: T) => U, E>,
  result_a: Result<T, E>
): Result<U, E>
```

**示例**

```typescript
ap(Ok((x: number) => x * 2), Ok(5));  // Ok(10)
ap(Ok((x: number) => x * 2), Err("err"));  // Err("err")
```

### and

逻辑与操作，第一个成功则返回第二个。

```typescript
const and = <T, E, U>(result: Result<T, E>, other: Result<U, E>): Result<U, E>
```

**示例**

```typescript
and(Ok(1), Ok(2));   // Ok(2)
and(Err("err"), Ok(2));  // Err("err")
```

### or

逻辑或操作，第一个成功则返回第一个，否则返回第二个。

```typescript
const or = <T, E, U, F>(
  result: Result<T, E>,
  other: Result<U, F>
): Result<T | U, F>
```

**示例**

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

**示例**

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

**示例**

```typescript
partition([Ok(1), Err("a"), Ok(2), Err("b")]);
// [[1, 2], ["a", "b"]]
```

### collectOk

收集所有成功值。

```typescript
const collectOk = <T, E>(results: readonly Result<T, E>[]): T[]
```

**示例**

```typescript
collectOk([Ok(1), Err("err"), Ok(2)]);  // [1, 2]
```

### collectErr

收集所有错误值。

```typescript
const collectErr = <T, E>(results: readonly Result<T, E>[]): E[]
```

**示例**

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

**示例**

```typescript
flatten(Ok(Ok(5)));   // Ok(5)
flatten(Ok(Err("err")));  // Err("err")
flatten(Err("outer"));    // Err("outer")
```

### deepFlatten

递归展开多层嵌套的 Result。

```typescript
function deepFlatten<T, E>(result: Result<T | Result<unknown, E>, E>): Result<T, E>
```

**示例**

```typescript
deepFlatten(Ok(Ok(Ok(5))));  // Ok(5)
```

### deepFlattenAsync

异步递归展开多层嵌套的 Result（包括 Promise）。

```typescript
async function deepFlattenAsync<T, E>(
  result_promise: PromiseLike<Result<T | Result<unknown, E>, E>> | Result<T | Result<unknown, E>, E>
): Promise<Result<T, E>>
```

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

**示例**

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

**示例**

```typescript
ifOk(Ok(42), v => console.log(v));  // 42
ifOk(Ok(42), v => v * 2, e => 0);   // 84
ifOk(Err("err"), v => v * 2, e => 0);  // 0
```

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

**示例**

```typescript
ifErr(Err("err"), e => console.error(e));  // "err"
ifErr(Err("err"), e => e.toUpperCase(), v => v);  // "ERR"
```

### mapOrElse

转换 Result 为单一类型，失败时使用默认函数。

```typescript
const mapOrElse = <T, E, R1, R2>(
  result: Result<T, E>,
  defaultFn: (error: E) => R1,
  mapFn: (value: T) => R2
): R1 | R2
```

**示例**

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

**示例**

```typescript
peekOk(Ok(42), v => console.log(`Got: ${v}`));  // Ok(42), logs "Got: 42"
```

### peekErr

失败时执行副作用，返回原 Result。

```typescript
function peekErr<T, E>(result: Result<T, E>, fnErr: (error: E) => void): Result<T, E>
```

**示例**

```typescript
peekErr(Err("err"), e => console.error(e));  // Err("err"), logs "err"
```

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

**示例**

```typescript
peekBoth(Ok(42), {
  fnOk: v => console.log(`Success: ${v}`),
  fnErr: e => console.error(`Error: ${e}`)
});  // Ok(42), logs "Success: 42"
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
