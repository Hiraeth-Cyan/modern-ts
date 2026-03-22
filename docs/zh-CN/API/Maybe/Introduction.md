# Maybe

Maybe 类型是函数式编程中处理可空值的经典抽象，它明确表达了"值可能存在也可能不存在"的语义，帮助开发者以类型安全的方式处理 `null` 和 `undefined`。

Maybe 由两种状态组成：`Maybe<T> = Some<T> | None`。存在时表示值的类型 `T`，不存在时为 `null` 或 `undefined`。

## 类型定义

```typescript
type Maybe<T> = T | null | undefined;
type AsyncMaybe<T> = Promise<Maybe<T>>;
type AnyMaybe<T> = Maybe<T> | AsyncMaybe<T> | PromiseLike<Maybe<T>>;
```

与 Rust 或 Haskell 不同，modern-ts 的 Maybe 并非包装类型，而是直接使用联合类型。这种设计避免了额外的装箱开销，同时保持类型安全。

## 使用场景

- **替代空值检查**：将 `if (x !== null && x !== undefined)` 的重复逻辑封装为类型守卫，通过 `isSome` / `isNone` 明确判断。
- **链式安全访问**：使用 `map`、`andThen` 进行流水线操作，避免深层嵌套的空值判断。
- **类型收窄**：`isSome` 作为类型守卫，可在分支内自动收窄为非空类型。

## 使用示例

没有 Maybe：

```typescript
const getUserName = (user: {name?: string} | null): string => {
  if (user && user.name) {
    return user.name;
  }
  return "Anonymous";
}
```

使用 Maybe：

```typescript
const getUserName = (user: {name?: string} | null): string => {
  const maybeName = user?.name;
  return fold(fromNullable(maybeName), "Anonymous", name => name);
}
```

或者使用链式操作：

```typescript
const getUserName = (user: {name?: string} | null): string => {
  return fold(
    map(fromNullable(user), u => u.name),
    "Anonymous",
    name => name
  );
}
```

---

## 构造函数

### Some

构造一个包含非空值的 Maybe。

```typescript
const Some = <T>(value: T): Maybe<T>
```

**示例**

```typescript
const maybe = Some(42);       // Maybe<number> = 42
const maybe2 = Some("hello"); // Maybe<string> = "hello"
```

### None

构造一个空值 Maybe。

```typescript
const None = (): Maybe<never>
```

**示例**

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

**示例**

```typescript
isSome(42);        // true
isSome(null);      // false
isSome(undefined); // false
isSome(0);         // true (0 是有效值)
isSome("");        // true (空字符串是有效值)
```

### isNone

检查 Maybe 是否为空。

```typescript
const isNone = (m: Maybe<unknown>): m is null | undefined
```

**示例**

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

**示例**

```typescript
fromNullable(42);      // 42
fromNullable(null);    // undefined
fromNullable(undefined); // undefined
fromNullable(0);       // 0 (0 是有效值)
```

### fromFalsy

将假值转换为 Maybe（假值包括 `null`、`undefined`、`false`、`0`、`""`）。

```typescript
const fromFalsy = <T>(value: T | null | undefined | false | 0 | ''): Maybe<T>
```

**示例**

```typescript
fromFalsy(42);      // 42
fromFalsy(0);       // undefined
fromFalsy("");      // undefined
fromFalsy(false);   // undefined
fromFalsy("hello"); // "hello"
```

### toNullable

将 Maybe 转换为可空值。

```typescript
const toNullable = <T>(maybe: Maybe<T>): T | null
```

**示例**

```typescript
toNullable(42);        // 42
toNullable(undefined); // null
toNullable(null);      // null
```

### toResult

将 Maybe 转换为 Result 类型。

```typescript
const toResult = <T, E>(maybe: Maybe<T>, errorFn: () => E): Result<T, E>
```

**示例**

```typescript
toResult(42, () => "No value");      // Ok(42)
toResult(null, () => "No value");    // Err("No value")
```

### toArray

将 Maybe 转换为数组表示。

```typescript
const toArray = <T>(val: Maybe<T>): T[]
```

**示例**

```typescript
toArray(42);        // [42]
toArray(null);      // []
toArray(undefined); // []
```

### transpose

将包含 Promise 的 Maybe 转换为 AsyncMaybe。

```typescript
async function transpose<T>(val: Maybe<Promise<T>>): AsyncMaybe<T>
```

**示例**

```typescript
const maybe_promise = Some(Promise.resolve(42));
const async_maybe = await transpose(maybe_promise);  // 42
```

---

## 转换操作

### map

转换 Maybe 中的值。

```typescript
const map = <T, R>(val: Maybe<T>, fn: (value: T) => R): Maybe<R>
```

**示例**

```typescript
map(42, x => x * 2);     // 84
map(null, x => x * 2);   // undefined
map(undefined, x => x * 2); // undefined
```

### andThen

链式调用，根据值返回新的 Maybe。

```typescript
const andThen = <T, R>(val: Maybe<T>, fn: (value: T) => Maybe<R>): Maybe<R>
```

**示例**

```typescript
const parseNumber = (s: string): Maybe<number> => {
  const n = parseInt(s);
  return isNaN(n) ? None() : Some(n);
};

andThen(Some("42"), parseNumber);    // 42
andThen(Some("abc"), parseNumber);   // undefined
andThen(None(), parseNumber);        // undefined
```

### ap

Applicative Apply，将 Maybe 中的函数应用到值上。

```typescript
const ap = <T, R>(fn_val: Maybe<(v: T) => R>, val: Maybe<T>): Maybe<R>
```

**示例**

```typescript
ap(Some((x: number) => x * 2), Some(5));  // 10
ap(Some((x: number) => x * 2), None());   // undefined
ap(None(), Some(5));                       // undefined
```

### filter

过滤值，不满足条件时返回 None。

```typescript
const filter = <T>(val: Maybe<T>, predicate: (v: T) => boolean): Maybe<T>
```

**示例**

```typescript
filter(Some(5), x => x > 0);    // 5
filter(Some(-1), x => x > 0);   // undefined
filter(None(), x => x > 0);     // undefined
```

### mapIf

条件映射，满足条件时才转换。

```typescript
const mapIf = <T, R>(val: Maybe<T>, predicate: (v: T) => boolean, fn: (v: T) => R): Maybe<R>
```

**示例**

```typescript
mapIf(Some(5), x => x > 0, x => x * 2);   // 10
mapIf(Some(-1), x => x > 0, x => x * 2);  // undefined
mapIf(None(), x => x > 0, x => x * 2);    // undefined
```

---

## 逻辑分支与聚合

### and

逻辑与操作，第一个有值则返回第二个。

```typescript
const and = <T, U>(val: Maybe<T>, other: Maybe<U>): Maybe<U>
```

**示例**

```typescript
and(Some(1), Some(2));   // 2
and(None(), Some(2));    // undefined
and(Some(1), None());   // undefined
```

### or

逻辑或操作，第一个有值则返回第一个，否则返回第二个。

```typescript
const or = <T>(val: Maybe<T>, other: Maybe<T>): Maybe<T>
```

**示例**

```typescript
or(Some(1), Some(2));   // 1
or(None(), Some(2));    // 2
or(Some(1), None());    // 1
```

### orElse

有值则返回，否则调用函数获取备选值。

```typescript
const orElse = <T>(val: Maybe<T>, fn: () => Maybe<T>): Maybe<T>
```

**示例**

```typescript
orElse(Some(1), () => Some(2));   // 1
orElse(None(), () => Some(2));    // 2
```

### fold

提取值或返回默认值。

```typescript
const fold = <T, R>(val: Maybe<T>, initial: R, onSome: (v: T) => R): R
```

**示例**

```typescript
fold(Some(5), 0, x => x * 2);   // 10
fold(None(), 0, x => x * 2);    // 0
```

### contains

检查 Maybe 是否包含特定值。

```typescript
const contains = <T>(val: Maybe<T>, x: T): boolean
```

**示例**

```typescript
contains(Some(42), 42);   // true
contains(Some(42), 1);    // false
contains(None(), 42);     // false
```

---

## 多元组合

### zip

将两个 Maybe 组合为元组。

```typescript
const zip = <T, U>(a: Maybe<T>, b: Maybe<U>): Maybe<[T, U]>
```

**示例**

```typescript
zip(Some(1), Some("a"));   // [1, "a"]
zip(Some(1), None());      // undefined
zip(None(), Some("a"));    // undefined
```

### zipWith

将两个 Maybe 应用组合函数。

```typescript
const zipWith = <T, U, R>(ma: Maybe<T>, mb: Maybe<U>, fn: (a: T, b: U) => R): Maybe<R>
```

**示例**

```typescript
zipWith(Some(1), Some(2), (a, b) => a + b);  // 3
zipWith(Some(1), None(), (a, b) => a + b);   // undefined
```

---

## 集合处理

### all

组合多个 Maybe，全部有值则返回值数组。

```typescript
const all = <T>(vals: readonly Maybe<T>[]): Maybe<T[]>
```

**示例**

```typescript
all([Some(1), Some(2), Some(3)]);  // [1, 2, 3]
all([Some(1), None(), Some(3)]);   // undefined
```

### mapAll

对数组元素应用函数并组合结果。

```typescript
const mapAll = <T, U>(items: readonly T[], fn: (it: T, i: number) => Maybe<U>): Maybe<U[]>
```

**示例**

```typescript
mapAll(["1", "2", "3"], s => {
  const n = parseInt(s);
  return isNaN(n) ? None() : Some(n);
});  // [1, 2, 3]

mapAll(["1", "abc", "3"], s => {
  const n = parseInt(s);
  return isNaN(n) ? None() : Some(n);
});  // undefined
```

### partition

将 Maybe 数组分离为有值和无值两部分。

```typescript
const partition = <T>(vals: readonly Maybe<T>[]): [T[], number]
```

**示例**

```typescript
partition([Some(1), None(), Some(2), None()]);
// [[1, 2], 2]  (值数组, None数量)
```

### collectSomes

收集所有有值的元素。

```typescript
const collectSomes = <T>(vals: readonly Maybe<T>[]): T[]
```

**示例**

```typescript
collectSomes([Some(1), None(), Some(2), None()]);  // [1, 2]
```

### firstSome

返回第一个有值的元素。

```typescript
const firstSome = <T>(vals: readonly Maybe<T>[]): Maybe<T>
```

**示例**

```typescript
firstSome([None(), Some(1), Some(2)]);  // 1
firstSome([None(), None()]);            // undefined
```

---

## 规约操作

### reduce

对多个 Maybe 进行规约，任一为 None 则返回 None。

```typescript
function reduce<T, R>(vals: readonly Maybe<T>[], initial: R, reducer: (acc: R, v: T) => R): Maybe<R>
```

**示例**

```typescript
reduce([Some(1), Some(2), Some(3)], 0, (acc, x) => acc + x);  // 6
reduce([Some(1), None(), Some(3)], 0, (acc, x) => acc + x);   // undefined
```

### scan

扫描规约，返回每一步的结果。

```typescript
function scan<T, R>(vals: readonly Maybe<T>[], initial: R, scanner: (acc: R, v: T) => R): Maybe<R[]>
```

**示例**

```typescript
scan([Some(1), Some(2), Some(3)], 0, (acc, x) => acc + x);
// [0, 1, 3, 6]

scan([Some(1), None(), Some(3)], 0, (acc, x) => acc + x);
// undefined
```

### folds

分别处理 Some 和 None 的规约。

```typescript
const folds = <T, R>(
  vals: readonly Maybe<T>[],
  initial: R,
  onSome: (acc: R, v: T) => R,
  onNone: (acc: R) => R
): R
```

**示例**

```typescript
folds([Some(1), None(), Some(2)], 0,
  (acc, v) => acc + v,    // Some 处理
  (acc) => acc            // None 处理
);  // 3
```

---

## 消费操作

### match

模式匹配，根据 Maybe 状态执行不同回调。

```typescript
const match = <T, R>(val: Maybe<T>, onSome: (value: T) => R, onNone: () => R): R
```

**示例**

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

### ifSome

有值时执行回调。

```typescript
function ifSome<T, R1>(val: Maybe<T>, onSome: (value: T) => R1): R1 | void
function ifSome<T, R1, R2>(val: Maybe<T>, onSome: (value: T) => R1, onElse: () => R2): R1 | R2
```

**示例**

```typescript
ifSome(Some(42), v => console.log(v));  // 42
ifSome(Some(42), v => v * 2, () => 0);   // 84
ifSome(None(), v => v * 2, () => 0);     // 0
```

### ifNone

无值时执行回调。

```typescript
function ifNone<T, R1>(val: Maybe<T>, onNone: () => R1): R1 | void
function ifNone<T, R1, R2>(val: Maybe<T>, onNone: () => R1, onElse: (value: T) => R2): R1 | R2
```

**示例**

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

**示例**

```typescript
peek(Some(42), v => console.log(`Got: ${v}`));  // 42, logs "Got: 42"
peek(None(), v => console.log(`Got: ${v}`));    // undefined, 无输出
```

### peekNone

无值时执行副作用，返回原 Maybe。

```typescript
const peekNone = <T>(val: Maybe<T>, fn: () => void): Maybe<T>
```

**示例**

```typescript
peekNone(None(), () => console.log("empty"));   // undefined, logs "empty"
peekNone(Some(42), () => console.log("empty")); // 42, 无输出
```

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

**示例**

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

## AsyncMaybe

几乎所有同步自由函数均提供对应的 `*Async` 版本（例如：`map` → `mapAsync`）。

### 中断处理与异常规范

所有异步函数均支持 `AbortSignal`。**与 Result 不同，Maybe 的中断操作会直接抛出 `DOMException`**。

```typescript
const controller = new AbortController();
controller.abort();

await mapAsync(Some(5), x => x * 2, controller.signal);
// 抛出 DOMException: This operation was aborted
```

这种差异源于 Maybe 的设计目标：它仅表示"值存在或不存在"，无法承载错误信息。因此：

- **中断信号**：直接抛出 `DOMException`
- **未捕获异常**：直接抛出原始错误

### 异步 API 列表

| 同步版本 | 异步版本 |
|---------|---------|
| `map` | `mapAsync` |
| `andThen` | `andThenAsync` |
| `ap` | `apAsync` |
| `filter` | `filterAsync` |
| `mapIf` | `mapIfAsync` |
| `zip` | `zipAsync` |
| `fold` | `foldAsync` |
| `orElse` | `orElseAsync` |
| `all` | `allAsync` |
| `mapAll` | `mapAllAsync` |
| `reduce` | `reduceAsync` |
| `scan` | `scanAsync` |
| `partition` | `partitionAsync` |
| `collectSomes` | `collectSomesAsync` |
| `firstSome` | `firstSomeAsync` |
| `match` | `matchAsync` |
| `ifSome` | `ifSomeAsync` |
| `ifNone` | `ifNoneAsync` |
| `peek` | `peekAsync` |
| `peekNone` | `peekNoneAsync` |
| `peekBoth` | `peekBothAsync` |

### 异步示例

```typescript
// 带中断信号的异步映射
const controller = new AbortController();
const maybe = await mapAsync(
  Some(5),
  async (x, signal) => {
    signal?.throwIfAborted();
    return await fetchData(x);
  },
  controller.signal
);

// 异步链式调用
const result = await andThenAsync(
  Some("user_123"),
  async (id) => {
    const user = await fetchUser(id);
    return user ? Some(user) : None();
  }
);

// 异步组合
const results = await allAsync([
  fetchMaybe("/api/a"),
  fetchMaybe("/api/b"),
  fetchMaybe("/api/c")
]);
```

> **兼容性**：绝大多数异步函数具备处理 `AnyMaybe` 的能力，可无缝接收并处理同步或异步的 Maybe 输入。

---

## 与 Result 的对比

| 特性 | Maybe | Result |
|-----|-------|--------|
| 语义 | 值存在或不存在 | 成功或失败 |
| 错误信息 | 无 | 有（E 类型） |
| 适用场景 | 可空值处理 | 错误处理 |
| 异步中断 | 抛出异常 | 返回 Err |
| 类型复杂度 | 简单（T \| null \| undefined） | 较复杂（Success<T> \| Failure<E>） |

**选择建议**：
- 当只需表示"有或无"时，使用 Maybe
- 当需要携带错误信息或进行错误恢复时，使用 Result
- 可以通过 `toResult` 在两者之间转换
