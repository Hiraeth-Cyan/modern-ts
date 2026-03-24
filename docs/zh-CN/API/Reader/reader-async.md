# AsyncReader (异步)

异步 Reader 的基础操作，支持 Promise 和异步计算。

---

## 构造函数

### ofAsync

将纯值包装为 AsyncReader。

```typescript
function ofAsync<R, A>(a: A): AsyncReader<R, A>
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `a` | `A` | 要包装的值 |

**返回值：** `AsyncReader<R, A>` - 解析为 `a` 的异步 Reader

**示例：**

```typescript
const constant = ofAsync<Env, number>(42);
const result = await constant({} as Env); // 42
```

---

### askAsync

异步获取当前环境。

```typescript
function askAsync<R>(): AsyncReader<R, R>
```

**返回值：** `AsyncReader<R, R>` - 解析为当前环境的异步 Reader

**示例：**

```typescript
const getConfig = askAsync<Config>();
const config = await getConfig({ apiUrl: 'http://api.example.com' });
```

---

## 变换操作

### mapAsync

对 AsyncReader 中的值进行映射变换。

```typescript
function mapAsync<R, A, B>(
  reader: AsyncReader<R, A>,
  f: (a: A) => B
): AsyncReader<R, B>
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `reader` | `AsyncReader<R, A>` | 源异步 Reader |
| `f` | `(a: A) => B` | 映射函数 |

**返回值：** `AsyncReader<R, B>` - 包含变换后值的异步 Reader

**示例：**

```typescript
const fetchUser = async (env: Env) => env.api.getUser('123');
const fetchUserName = mapAsync(fetchUser, user => user.name);

const name = await fetchUserName(env); // 'John'
```

---

### anThenAsync

链式组合两个 AsyncReader 计算。

```typescript
function anThenAsync<R, A, B>(
  reader: AsyncReader<R, A>,
  f: (a: A) => AsyncReader<R, B>
): AsyncReader<R, B>
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `reader` | `AsyncReader<R, A>` | 第一个异步 Reader |
| `f` | `(a: A) => AsyncReader<R, B>` | 根据第一个结果产生第二个 Reader 的函数 |

**返回值：** `AsyncReader<R, B>` - 组合后的异步 Reader

**示例：**

```typescript
const fetchUser = async (env: Env) => env.api.getUser('123');
const fetchUserOrders = (user: User) => async (env: Env) => 
  env.api.getOrders(user.id);

const fetchUserWithOrders = anThenAsync(fetchUser, fetchUserOrders);
const orders = await fetchUserWithOrders(env);
```

---

## Applicative 操作

### apAsync

应用包裹在 AsyncReader 中的函数到另一个 AsyncReader 的值。

```typescript
function apAsync<R, A, B>(
  reader_fab: AsyncReader<R, (a: A) => B>,
  reader_a: AsyncReader<R, A>
): AsyncReader<R, B>
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `reader_fab` | `AsyncReader<R, (a: A) => B>` | 包含函数的异步 Reader |
| `reader_a` | `AsyncReader<R, A>` | 包含值的异步 Reader |

**返回值：** `AsyncReader<R, B>` - 应用函数后的结果异步 Reader

**示例：**

```typescript
const formatUser = (prefix: string) => (user: User) => 
  `${prefix}: ${user.name}`;

const formatReader = ofAsync<Env, (u: User) => string>(formatUser('User'));
const userReader = async (env: Env) => env.api.getUser('123');

const formatted = await apAsync(formatReader, userReader)(env);
// 'User: John'
```

---

### liftA2Async

将二元函数提升到 AsyncReader 上下文。

```typescript
function liftA2Async<A, B, C>(
  f_abc: (a: A, b: B) => C
): <R, E>(
  reader_a: AsyncReader<R, E, A>,
  reader_b: AsyncReader<R, E, B>
) => AsyncReader<R, E | UnknownError | DOMException, C>
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `f_abc` | `(a: A, b: B) => C` | 二元函数 |

**返回值：** 一个函数，接受两个异步 Reader 并返回组合后的异步 Reader

**示例：**

```typescript
const combineData = (user: User, orders: Order[]) => ({ user, orders });
const liftCombine = liftA2Async(combineData);

const userReader = async (env: Env) => env.api.getUser('123');
const ordersReader = async (env: Env) => env.api.getOrders('123');

const combined = liftCombine(userReader, ordersReader);
const result = await combined(env);
// { user: User, orders: Order[] }
```

---

### liftA3Async

将三元函数提升到 AsyncReader 上下文。

```typescript
function liftA3Async<A, B, C, D>(
  f_abcd: (a: A, b: B, c: C) => D
): <R, E>(
  reader_a: AsyncReader<R, E, A>,
  reader_b: AsyncReader<R, E, B>,
  reader_c: AsyncReader<R, E, C>
) => AsyncReader<R, E | UnknownError | DOMException, D>
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `f_abcd` | `(a: A, b: B, c: C) => D` | 三元函数 |

**返回值：** 一个函数，接受三个异步 Reader 并返回组合后的异步 Reader

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

## 副作用

### tapAsync

执行异步副作用，但返回原始值。

```typescript
function tapAsync<R, E, A>(
  reader: AsyncReader<R, E, A>,
  f: (a: A) => AsyncReader<R, E, unknown>
): AsyncReader<R, E | UnknownError | DOMException, A>
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `reader` | `AsyncReader<R, E, A>` | 源异步 Reader |
| `f` | `(a: A) => AsyncReader<R, E, unknown>` | 异步副作用函数 |

**返回值：** `AsyncReader<R, E | UnknownError | DOMException, A>` - 返回原始值的异步 Reader

**示例：**

```typescript
const logUserAsync = (user: User): AsyncReader<Env, unknown> => 
  async ({ logger }) => { await logger.logAsync(user); };

const fetchUser = async (env: Env) => env.api.getUser('123');
const fetchWithLog = tapAsync(fetchUser, logUserAsync);

const user = await fetchWithLog(env); // 返回 user，但会先记录日志
```
