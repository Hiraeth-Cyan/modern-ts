# AsyncReaderT (异步带错误处理)

异步 ReaderT 的基础操作，支持 Promise 和异步计算，同时提供 Result 的错误处理能力。

---

## 构造函数

### ofAsync

将纯值包装为成功的 AsyncReaderT。

```typescript
function ofAsync<R, E, A>(a: A): AsyncReaderT<R, E, A>
```

| 参数 | 类型 | 描述       |
| ---- | ---- | ---------- |
| `a`  | `A`  | 要包装的值 |

**返回值：** `AsyncReaderT<R, E, A>` - 解析为 `Ok(a)` 的异步 ReaderT

**示例：**

```typescript
const success = ofAsync<Env, Error, number>(42);
const result = await success({} as Env); // Ok(42)
```

---

### askAsync

异步获取当前环境作为成功结果。

```typescript
function askAsync<R, E>(): AsyncReaderT<R, E, R>
```

**返回值：** `AsyncReaderT<R, E, R>` - 解析为 `Ok(env)` 的异步 ReaderT

**示例：**

```typescript
const getConfig = askAsync<Config, Error>();
const result = await getConfig({ apiUrl: 'http://api.example.com' });
// Ok({ apiUrl: 'http://api.example.com' })
```

---

### failAsync

创建一个失败的 AsyncReaderT。

```typescript
function failAsync<R, E, A>(e: E): AsyncReaderT<R, E, A>
```

| 参数 | 类型 | 描述   |
| ---- | ---- | ------ |
| `e`  | `E`  | 错误值 |

**返回值：** `AsyncReaderT<R, E, A>` - 解析为 `Err(e)` 的异步 ReaderT

**示例：**

```typescript
const notFound = failAsync<Env, NotFoundError, User>({ type: 'NOT_FOUND', id: '123' });
const result = await notFound({} as Env); // Err({ type: 'NOT_FOUND', id: '123' })
```

---

## 类型转换

### fromResultAsync

将 Result 提升为 AsyncReaderT。

```typescript
function fromResultAsync<R, E, A>(
  result: Result<A, E>
): AsyncReaderT<R, E, A>
```

| 参数     | 类型           | 描述            |
| -------- | -------------- | --------------- |
| `result` | `Result<A, E>` | 要包装的 Result |

**返回值：** `AsyncReaderT<R, E, A>` - 解析为给定 Result 的异步 ReaderT

**示例：**

```typescript
const result = Ok(42);
const reader = fromResultAsync<Env, Error, number>(result);
await reader({} as Env); // Ok(42)
```

---

### fromMaybeAsync

将 Maybe 转换为 AsyncReaderT。

```typescript
function fromMaybeAsync<R, E, A>(
  maybe: Maybe<A>,
  on_none_error: E
): AsyncReaderT<R, E | UnknownError, A>
```

| 参数            | 类型       | 描述                     |
| --------------- | ---------- | ------------------------ |
| `maybe`         | `Maybe<A>` | 可能存在的值             |
| `on_none_error` | `E`        | Maybe 为 None 时的错误值 |

**返回值：** `AsyncReaderT<R, E | UnknownError, A>` - Some 返回 Ok，None 返回 Err

**示例：**

```typescript
const maybeUser = Some(user);
const reader = fromMaybeAsync<Env, Error, User>(
  maybeUser,
  { message: 'User not found' }
);

const empty = fromMaybeAsync<Env, Error, User>(
  None(),
  { message: 'User not found' }
);
await empty({} as Env); // Err({ message: 'User not found' })
```

---

### fromNullableAsync

将可空值转换为 AsyncReaderT（fromMaybeAsync 的别名）。

```typescript
function fromNullableAsync<R, E, A>(
  value: A | null | undefined,
  on_none_error: E
): AsyncReaderT<R, E | UnknownError, A>
```

| 参数            | 类型                     | 描述           |
| --------------- | ------------------------ | -------------- |
| `value`         | `A \| null \| undefined` | 可能为空的值   |
| `on_none_error` | `E`                      | 值为空时的错误 |

**返回值：** `AsyncReaderT<R, E | UnknownError, A>` - 有值返回 Ok，否则返回 Err

**示例：**

```typescript
const user = fromNullableAsync<Env, Error, User>(
  await findUser('123'),
  { message: 'User not found' }
);
```

---

## 变换操作

### mapAsync

对成功值进行异步映射变换。

```typescript
function mapAsync<R, E, A, B>(
  reader: AsyncReaderT<R, E, A>,
  fn: (a: A) => B
): AsyncReaderT<R, E | UnknownError | DOMException, B>
```

| 参数     | 类型                    | 描述           |
| -------- | ----------------------- | -------------- |
| `reader` | `AsyncReaderT<R, E, A>` | 源异步 ReaderT |
| `fn`     | `(a: A) => B`           | 映射函数       |

**返回值：** `AsyncReaderT<R, E | UnknownError | DOMException, B>` - 包含变换后值的异步 ReaderT

**示例：**

```typescript
const fetchUser = async (env: Env) => env.api.getUser('123');
const fetchUserName = mapAsync(fetchUser, user => user.name);

const result = await fetchUserName(env);
// Ok('John') 或 Err(Error)
```

---

### andThenAsync

链式组合两个 AsyncReaderT 计算。

```typescript
function andThenAsync<R, E, A, B>(
  reader: AsyncReaderT<R, E, A>,
  f_next: (a: A, signal?: AbortSignal) => AsyncReaderT<R, E, B>
): AsyncReaderT<R, E | UnknownError | DOMException, B>
```

| 参数     | 类型                                       | 描述                              |
| -------- | ------------------------------------------ | --------------------------------- |
| `reader` | `AsyncReaderT<R, E, A>`                    | 第一个异步 ReaderT                |
| `f_next` | `(a: A, signal?) => AsyncReaderT<R, E, B>` | 根据结果产生下一个 ReaderT 的函数 |

**返回值：** `AsyncReaderT<R, E | UnknownError | DOMException, B>` - 组合后的异步 ReaderT

**示例：**

```typescript
const fetchUser = async (env: Env) => env.api.getUser('123');
const fetchOrders = (user: User) => async (env: Env) =>
  env.api.getOrders(user.id);

const fetchUserWithOrders = andThenAsync(fetchUser, fetchOrders);
const orders = await fetchUserWithOrders(env);
```

---

### mapErrAsync

对错误值进行异步映射变换。

```typescript
function mapErrAsync<R, E, A, F>(
  reader: AsyncReaderT<R, E, A>,
  fn_fe: (e: E) => Promise<F> | F
): AsyncReaderT<R, F | UnknownError | DOMException, A>
```

| 参数     | 类型                        | 描述                   |
| -------- | --------------------------- | ---------------------- |
| `reader` | `AsyncReaderT<R, E, A>`     | 源异步 ReaderT         |
| `fn_fe`  | `(e: E) => Promise<F> \| F` | 错误映射函数（可异步） |

**返回值：** `AsyncReaderT<R, F | UnknownError | DOMException, A>` - 错误类型变换后的异步 ReaderT

**示例：**

```typescript
const fetchUser = async (env: Env) => env.api.getUser('123');

const withAppError = mapErrAsync(fetchUser, async err => {
  await logError(err);
  return { type: 'FETCH_FAILED', cause: err };
});
```

---

## Applicative 操作

### apAsync

应用包裹在 AsyncReaderT 中的函数到另一个 AsyncReaderT 的值。

```typescript
function apAsync<R, E, A, B>(
  reader_fab: AsyncReaderT<R, E, (a: A) => B>,
  reader_a: AsyncReaderT<R, E, A>
): AsyncReaderT<R, E | UnknownError | DOMException, B>
```

| 参数         | 类型                              | 描述                   |
| ------------ | --------------------------------- | ---------------------- |
| `reader_fab` | `AsyncReaderT<R, E, (a: A) => B>` | 包含函数的异步 ReaderT |
| `reader_a`   | `AsyncReaderT<R, E, A>`           | 包含值的异步 ReaderT   |

**返回值：** `AsyncReaderT<R, E | UnknownError | DOMException, B>` - 应用函数后的结果异步 ReaderT

**示例：**

```typescript
const format = (prefix: string) => (user: User) => `${prefix}: ${user.name}`;
const formatReader = ofAsync<Env, Error, (u: User) => string>(format('User'));
const userReader = async (env: Env) => env.api.getUser('123');

const result = await apAsync(formatReader, userReader)(env);
// Ok('User: John') 或 Err(Error)
```

---

### liftA2Async

将二元函数提升到 AsyncReaderT 上下文。

```typescript
function liftA2Async<A, B, C>(
  f_abc: (a: A, b: B) => C
): <R, E>(
  reader_a: AsyncReaderT<R, E, A>,
  reader_b: AsyncReaderT<R, E, B>
) => AsyncReaderT<R, E | UnknownError | DOMException, C>
```

| 参数    | 类型                | 描述     |
| ------- | ------------------- | -------- |
| `f_abc` | `(a: A, b: B) => C` | 二元函数 |

**返回值：** 一个函数，接受两个异步 ReaderT 并返回组合后的异步 ReaderT

**示例：**

```typescript
const combine = (user: User, orders: Order[]) => ({ user, orders });
const liftCombine = liftA2Async(combine);

const userReader = async (env: Env) => env.api.getUser('123');
const ordersReader = async (env: Env) => env.api.getOrders('123');

const combined = liftCombine(userReader, ordersReader);
const result = await combined(env);
// Ok({ user: User, orders: Order[] }) 或 Err(Error)
```

---

### liftA3Async

将三元函数提升到 AsyncReaderT 上下文。

```typescript
function liftA3Async<A, B, C, D>(
  f_abcd: (a: A, b: B, c: C) => D
): <R, E>(
  reader_a: AsyncReaderT<R, E, A>,
  reader_b: AsyncReaderT<R, E, B>,
  reader_c: AsyncReaderT<R, E, C>
) => AsyncReaderT<R, E | UnknownError | DOMException, D>
```

| 参数     | 类型                      | 描述     |
| -------- | ------------------------- | -------- |
| `f_abcd` | `(a: A, b: B, c: C) => D` | 三元函数 |

**返回值：** 一个函数，接受三个异步 ReaderT 并返回组合后的异步 ReaderT

**示例：**

```typescript
const createReport = (user: User, orders: Order[], stats: Stats) =>
  ({ user, orders, stats, generatedAt: new Date() });

const liftReport = liftA3Async(createReport);

const reportReader = liftReport(
  async (env) => env.api.getUser('123'),
  async (env) => env.api.getOrders('123'),
  async (env) => env.api.getStats('123')
);
```

---

## 错误处理

### orElseAsync

提供异步错误恢复机制。

```typescript
function orElseAsync<R, E, A, F>(
  reader: AsyncReaderT<R, E, A>,
  alternative_reader: (e: E) => AsyncReaderT<R, F, A>
): AsyncReaderT<R, F | UnknownError, A>
```

| 参数                 | 类型                              | 描述           |
| -------------------- | --------------------------------- | -------------- |
| `reader`             | `AsyncReaderT<R, E, A>`           | 主异步 ReaderT |
| `alternative_reader` | `(e: E) => AsyncReaderT<R, F, A>` | 错误恢复函数   |

**返回值：** `AsyncReaderT<R, F | UnknownError, A>` - 成功返回原结果，失败执行恢复

**示例：**

```typescript
const fetchFromPrimary = async (env: Env) => env.primaryApi.getUser('123');
const fetchFromBackup = (err: Error) => async (env: Env) =>
  env.backupApi.getUser('123');

const fetchWithFallback = orElseAsync(fetchFromPrimary, fetchFromBackup);
const user = await fetchWithFallback(env);
```

---

## 副作用

### tapAsync

执行带错误处理的异步副作用。

```typescript
function tapAsync<R, E, A>(
  reader: AsyncReaderT<R, E, A>,
  f: (a: A) => AsyncReaderT<R, E, unknown>
): AsyncReaderT<R, E | UnknownError | DOMException, A>
```

| 参数     | 类型                                    | 描述           |
| -------- | --------------------------------------- | -------------- |
| `reader` | `AsyncReaderT<R, E, A>`                 | 源异步 ReaderT |
| `f`      | `(a: A) => AsyncReaderT<R, E, unknown>` | 异步副作用函数 |

**返回值：** `AsyncReaderT<R, E | UnknownError | DOMException, A>` - 成功返回原值，副作用失败返回错误

**示例：**

```typescript
const logUserAsync = (user: User): AsyncReaderT<Env, LogError, void> =>
  async ({ logger }) => {
    try {
      await logger.logAsync(user);
      return Ok(undefined);
    } catch (e) {
      return Err({ type: 'LOG_FAILED' });
    }
  };

const fetchUser = async (env: Env) => env.api.getUser('123');
const fetchWithLog = tapAsync(fetchUser, logUserAsync);

const result = await fetchWithLog(env);
// 如果日志失败，返回 LogError；否则返回 User
```

---

## 集合操作

### traverseAsync

将列表异步映射为 AsyncReaderT 计算并收集结果（并行执行）。

```typescript
function traverseAsync<R, E, T, A>(
  f_ta: (t: T) => AsyncReaderT<R, E, A>
): (
  items: readonly T[]
) => AsyncReaderT<R, E | UnknownError | DOMException, A[]>
```

| 参数   | 类型                              | 描述         |
| ------ | --------------------------------- | ------------ |
| `f_ta` | `(t: T) => AsyncReaderT<R, E, A>` | 异步转换函数 |

**返回值：** `AsyncReaderT<R, E | UnknownError | DOMException, A[]>` - 包含结果数组或第一个错误的异步 ReaderT

**示例：**

```typescript
const validateItemAsync = (item: Item): AsyncReaderT<Env, ValidationError, ValidItem> =>
  async (env) => {
    const result = await env.validator.validate(item);
    return result.isValid ? Ok(result.data) : Err(result.error);
  };

const validateAll = traverseAsync(validateItemAsync);
const result = await validateAll([item1, item2, item3])(env);
// Ok([valid1, valid2, valid3]) 或 Err(firstError)
```

---

### sequenceAsync

将 AsyncReaderT 列表合并为单个 AsyncReaderT（并行执行）。

```typescript
function sequenceAsync<R, E, A>(
  readers: readonly AsyncReaderT<R, E, A>[]
): AsyncReaderT<R, E | UnknownError | DOMException, A[]>
```

| 参数      | 类型                               | 描述              |
| --------- | ---------------------------------- | ----------------- |
| `readers` | `readonly AsyncReaderT<R, E, A>[]` | 异步 ReaderT 数组 |

**返回值：** `AsyncReaderT<R, E | UnknownError | DOMException, A[]>` - 包含结果数组或第一个错误的异步 ReaderT

**示例：**

```typescript
const readers = [
  async (env: Env) => env.api.getUser('1'),
  async (env: Env) => env.api.getUser('2'),
  async (env: Env) => env.api.getUser('3')
];

const allUsers = sequenceAsync(readers);
const result = await allUsers(env);
// Ok([user1, user2, user3]) 或 Err(error)
```
