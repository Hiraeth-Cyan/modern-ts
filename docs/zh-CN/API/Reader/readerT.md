# ReaderT (同步带错误处理)

ReaderT 是 Reader 的 Monad Transformer 版本，结合了 Reader 的依赖注入能力和 Result 的错误处理能力。

---

## 构造函数

### of

将纯值包装为成功的 ReaderT。

```typescript
function of<R, E, A>(a: A): ReaderT<R, E, A>
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `a` | `A` | 要包装的值 |

**返回值：** `ReaderT<R, E, A>` - 始终返回 `Ok(a)` 的 ReaderT

**示例：**

```typescript
const success = of<Env, Error, number>(42);
const result = success({} as Env); // Ok(42)
```

---

### ask

获取当前环境作为成功结果。

```typescript
function ask<R, E>(): ReaderT<R, E, R>
```

**返回值：** `ReaderT<R, E, R>` - 返回 `Ok(env)` 的 ReaderT

**示例：**

```typescript
const getConfig = ask<Config, Error>();
const result = getConfig({ apiUrl: 'http://api.example.com' });
// Ok({ apiUrl: 'http://api.example.com' })
```

---

### fail

创建一个失败的 ReaderT。

```typescript
function fail<R, E, A>(e: E): ReaderT<R, E, A>
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `e` | `E` | 错误值 |

**返回值：** `ReaderT<R, E, A>` - 始终返回 `Err(e)` 的 ReaderT

**示例：**

```typescript
const notFound = fail<Env, NotFoundError, User>({ type: 'NOT_FOUND', id: '123' });
const result = notFound({} as Env); // Err({ type: 'NOT_FOUND', id: '123' })
```

---

## 类型转换

### fromResult

将 Result 提升为 ReaderT。

```typescript
function fromResult<R, E, A>(result: Result<A, E>): ReaderT<R, E, A>
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `result` | `Result<A, E>` | 要包装的 Result |

**返回值：** `ReaderT<R, E, A>` - 始终返回给定 Result 的 ReaderT

**示例：**

```typescript
const result = Ok(42);
const reader = fromResult<Env, Error, number>(result);
reader({} as Env); // Ok(42)
```

---

### fromMaybe

将 Maybe 转换为 ReaderT。

```typescript
function fromMaybe<R, E, A>(
  maybe: Maybe<A>,
  on_none_error: E
): ReaderT<R, E, A>
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `maybe` | `Maybe<A>` | 可能存在的值 |
| `on_none_error` | `E` | Maybe 为 None 时的错误值 |

**返回值：** `ReaderT<R, E, A>` - Some 返回 Ok，None 返回 Err

**示例：**

```typescript
const maybeUser = Some(user);
const reader = fromMaybe<Env, Error, User>(maybeUser, { message: 'User not found' });

const empty = fromMaybe<Env, Error, User>(None(), { message: 'User not found' });
empty({} as Env); // Err({ message: 'User not found' })
```

---

### fromNullable

将可空值转换为 ReaderT（fromMaybe 的别名）。

```typescript
function fromNullable<R, E, A>(
  value: A | null | undefined,
  on_none_error: E
): ReaderT<R, E, A>
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `value` | `A \| null \| undefined` | 可能为空的值 |
| `on_none_error` | `E` | 值为空时的错误 |

**返回值：** `ReaderT<R, E, A>` - 有值返回 Ok，否则返回 Err

**示例：**

```typescript
const user = fromNullable<Env, Error, User>(
  findUser('123'),
  { message: 'User not found' }
);
```

---

## 变换操作

### map

对成功值进行映射变换。

```typescript
function map<R, E, A, B>(
  reader: ReaderT<R, E, A>,
  f_ab: (a: A) => B
): ReaderT<R, E, B>
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `reader` | `ReaderT<R, E, A>` | 源 ReaderT |
| `f_ab` | `(a: A) => B` | 映射函数 |

**返回值：** `ReaderT<R, E, B>` - 包含变换后成功值的 ReaderT

**示例：**

```typescript
const getUser = (id: string): ReaderT<Env, Error, User> => ...;
const getUserName = map(getUser('123'), user => user.name);

const result = getUserName(env);
// Ok('John') 或 Err(Error)
```

---

### andThen

链式组合两个 ReaderT 计算（flatMap）。

```typescript
function andThen<R, E, A, B>(
  reader: ReaderT<R, E, A>,
  f_next: (a: A) => ReaderT<R, E, B>
): ReaderT<R, E, B>
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `reader` | `ReaderT<R, E, A>` | 第一个 ReaderT |
| `f_next` | `(a: A) => ReaderT<R, E, B>` | 根据结果产生下一个 ReaderT 的函数 |

**返回值：** `ReaderT<R, E, B>` - 组合后的 ReaderT

**示例：**

```typescript
const validateUser = (data: UserData): ReaderT<Env, ValidationError, User> => ...;
const saveUser = (user: User): ReaderT<Env, DbError, User> => ...;

const createUser = (data: UserData) =>
  andThen(validateUser(data), saveUser);
```

---

### mapErr

对错误值进行映射变换。

```typescript
function mapErr<R, E, A, F>(
  reader: ReaderT<R, E, A>,
  fn_fe: (e: E) => F
): ReaderT<R, F, A>
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `reader` | `ReaderT<R, E, A>` | 源 ReaderT |
| `fn_fe` | `(e: E) => F` | 错误映射函数 |

**返回值：** `ReaderT<R, F, A>` - 错误类型变换后的 ReaderT

**示例：**

```typescript
const fetchUser = (id: string): ReaderT<Env, ApiError, User> => ...;

const withAppError = mapErr(fetchUser('123'), err => ({
  type: 'FETCH_FAILED',
  cause: err
}));
// ReaderT<Env, AppError, User>
```

---

## Applicative 操作

### ap

应用包裹在 ReaderT 中的函数到另一个 ReaderT 的值。

```typescript
function ap<R, E, A, B>(
  reader_fab: ReaderT<R, E, (a: A) => B>,
  reader_a: ReaderT<R, E, A>
): ReaderT<R, E, B>
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `reader_fab` | `ReaderT<R, E, (a: A) => B>` | 包含函数的 ReaderT |
| `reader_a` | `ReaderT<R, E, A>` | 包含值的 ReaderT |

**返回值：** `ReaderT<R, E, B>` - 应用函数后的结果 ReaderT

**示例：**

```typescript
const format = (prefix: string) => (user: User) => `${prefix}: ${user.name}`;
const formatReader = of<Env, Error, (u: User) => string>(format('User'));
const userReader = getUser('123');

const result = ap(formatReader, userReader);
// Ok('User: John') 或 Err(Error)
```

---

### liftA2

将二元函数提升到 ReaderT 上下文。

```typescript
function liftA2<R, E, A, B, C>(
  f_abc: (a: A, b: B) => C
): (reader_a: ReaderT<R, E, A>, reader_b: ReaderT<R, E, B>) => ReaderT<R, E, C>
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `f_abc` | `(a: A, b: B) => C` | 二元函数 |

**返回值：** 一个函数，接受两个 ReaderT 并返回组合后的 ReaderT

**示例：**

```typescript
const combine = (user: User, orders: Order[]) => ({ user, orders });
const liftCombine = liftA2<Env, Error, User, Order[], Combined>(combine);

const combined = liftCombine(getUser('123'), getOrders('123'));
```

---

### liftA3

将三元函数提升到 ReaderT 上下文。

```typescript
function liftA3<R, E, A, B, C, D>(
  f_abcd: (a: A, b: B, c: C) => D
): (
  reader_a: ReaderT<R, E, A>,
  reader_b: ReaderT<R, E, B>,
  reader_c: ReaderT<R, E, C>
) => ReaderT<R, E, D>
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `f_abcd` | `(a: A, b: B, c: C) => D` | 三元函数 |

**返回值：** 一个函数，接受三个 ReaderT 并返回组合后的 ReaderT

---

## 错误处理

### orElse

提供错误恢复机制。

```typescript
function orElse<R, E, A, F>(
  reader: ReaderT<R, E, A>,
  alternative_reader: (e: E) => ReaderT<R, F, A>
): ReaderT<R, F, A>
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `reader` | `ReaderT<R, E, A>` | 主 ReaderT |
| `alternative_reader` | `(e: E) => ReaderT<R, F, A>` | 错误恢复函数 |

**返回值：** `ReaderT<R, F, A>` - 成功返回原结果，失败执行恢复

**示例：**

```typescript
const fetchFromPrimary = (id: string): ReaderT<Env, Error, User> => ...;
const fetchFromBackup = (err: Error) => (id: string): ReaderT<Env, Error, User> => ...;

const fetchWithFallback = orElse(
  fetchFromPrimary('123'),
  err => fetchFromBackup(err)('123')
);
```

---

## 副作用

### tap

执行带错误处理的副作用。

```typescript
function tap<R, E, A>(
  reader: ReaderT<R, E, A>,
  f: (a: A) => ReaderT<R, E, unknown>
): ReaderT<R, E, A>
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `reader` | `ReaderT<R, E, A>` | 源 ReaderT |
| `f` | `(a: A) => ReaderT<R, E, unknown>` | 副作用函数 |

**返回值：** `ReaderT<R, E, A>` - 成功返回原值，副作用失败返回错误

**示例：**

```typescript
const logUser = (user: User): ReaderT<Env, LogError, void> =>
  ({ logger }) => {
    try {
      logger.log(user);
      return Ok(undefined);
    } catch (e) {
      return Err({ type: 'LOG_FAILED' });
    }
  };

const getUserWithLog = tap(getUser('123'), logUser);
// 如果日志失败，返回 LogError；否则返回 User
```

---

## 集合操作

### traverse

将列表映射为 ReaderT 计算并收集结果。

```typescript
function traverse<R, E, T, A>(
  f_ta: (t: T) => ReaderT<R, E, A>
): (items: readonly T[]) => ReaderT<R, E, A[]>
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `f_ta` | `(t: T) => ReaderT<R, E, A>` | 转换函数 |

**返回值：** `ReaderT<R, E, A[]>` - 包含结果数组或第一个错误的 ReaderT

**示例：**

```typescript
const validateItem = (item: Item): ReaderT<Env, ValidationError, ValidItem> => ...;

const validateAll = traverse(validateItem);
const result = validateAll([item1, item2, item3])(env);
// Ok([valid1, valid2, valid3]) 或 Err(firstError)
```

---

### sequence

将 ReaderT 列表合并为单个 ReaderT。

```typescript
function sequence<R, E, A>(
  readers: readonly ReaderT<R, E, A>[]
): ReaderT<R, E, A[]>
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `readers` | `readonly ReaderT<R, E, A>[]` | ReaderT 数组 |

**返回值：** `ReaderT<R, E, A[]>` - 包含结果数组或第一个错误的 ReaderT

**示例：**

```typescript
const readers = [
  getUser('1'),
  getUser('2'),
  getUser('3')
];

const allUsers = sequence(readers);
const result = allUsers(env);
// Ok([user1, user2, user3]) 或 Err(error)
```
