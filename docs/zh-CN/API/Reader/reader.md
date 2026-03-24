# Reader (同步)

同步 Reader 的基础操作，提供 Functor、Applicative 和 Monad 的完整实现。

---

## 构造函数

### of

将纯值包装为 Reader，忽略环境。

```typescript
function of<R, A>(a: A): Reader<R, A>
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `a` | `A` | 要包装的值 |

**返回值：** `Reader<R, A>` - 一个忽略环境、始终返回 `a` 的 Reader

**示例：**

```typescript
const constant = of<Env, number>(42);
const result = constant({} as Env); // 42
```

---

### ask

获取当前环境。

```typescript
function ask<R>(): Reader<R, R>
```

**返回值：** `Reader<R, R>` - 返回当前环境的 Reader

**示例：**

```typescript
const getConfig = ask<Config>();
const config = getConfig({ apiUrl: 'http://api.example.com' });
// { apiUrl: 'http://api.example.com' }
```

---

## 变换操作

### map

对 Reader 中的值进行映射变换。

```typescript
function map<R, A, B>(
  reader: Reader<R, A>,
  f: (a: A) => B
): Reader<R, B>
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `reader` | `Reader<R, A>` | 源 Reader |
| `f` | `(a: A) => B` | 映射函数 |

**返回值：** `Reader<R, B>` - 包含变换后值的 Reader

**示例：**

```typescript
const getUser = (env: Env) => ({ id: 1, name: 'John' });
const getUserName = map(getUser, user => user.name);

const name = getUserName(env); // 'John'
```

---

### anThen

链式组合两个 Reader 计算（flatMap/bind）。

```typescript
function anThen<R, A, B>(
  reader: Reader<R, A>,
  f: (a: A) => Reader<R, B>
): Reader<R, B>
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `reader` | `Reader<R, A>` | 第一个 Reader |
| `f` | `(a: A) => Reader<R, B>` | 根据第一个结果产生第二个 Reader 的函数 |

**返回值：** `Reader<R, B>` - 组合后的 Reader

**示例：**

```typescript
const getUserId = of<Env, string>('user-123');
const getUserById = (id: string): Reader<Env, User> => 
  env => env.db.getUser(id);

const getUser = anThen(getUserId, getUserById);
const user = getUser(env);
```

---

## Applicative 操作

### ap

应用包裹在 Reader 中的函数到另一个 Reader 的值。

```typescript
function ap<R, A, B>(
  reader_fab: Reader<R, (a: A) => B>,
  reader_a: Reader<R, A>
): Reader<R, B>
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `reader_fab` | `Reader<R, (a: A) => B>` | 包含函数的 Reader |
| `reader_a` | `Reader<R, A>` | 包含值的 Reader |

**返回值：** `Reader<R, B>` - 应用函数后的结果 Reader

**示例：**

```typescript
const addPrefix = (prefix: string) => (str: string) => `${prefix}-${str}`;
const prefixReader = of<Env, (s: string) => string>(addPrefix('USER'));
const idReader = of<Env, string>('123');

const result = ap(prefixReader, idReader);
console.log(result(env)); // 'USER-123'
```

---

### liftA2

将二元函数提升到 Reader 上下文。

```typescript
function liftA2<R, A, B, C>(
  f_abc: (a: A, b: B) => C
): (reader_a: Reader<R, A>, reader_b: Reader<R, B>) => Reader<R, C>
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `f_abc` | `(a: A, b: B) => C` | 二元函数 |

**返回值：** 一个函数，接受两个 Reader 并返回组合后的 Reader

**示例：**

```typescript
const add = (a: number, b: number) => a + b;
const liftAdd = liftA2<Env, number, number, number>(add);

const a = of<Env, number>(10);
const b = of<Env, number>(20);
const sum = liftAdd(a, b);

console.log(sum(env)); // 30
```

---

### liftA3

将三元函数提升到 Reader 上下文。

```typescript
function liftA3<R, A, B, C, D>(
  f_abcd: (a: A, b: B, c: C) => D
): (
  reader_a: Reader<R, A>,
  reader_b: Reader<R, B>,
  reader_c: Reader<R, C>
) => Reader<R, D>
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `f_abcd` | `(a: A, b: B, c: C) => D` | 三元函数 |

**返回值：** 一个函数，接受三个 Reader 并返回组合后的 Reader

**示例：**

```typescript
const createUser = (id: string, name: string, email: string): User => 
  ({ id, name, email });

const liftCreate = liftA3<Env, string, string, string, User>(createUser);

const id = of<Env, string>('1');
const name = of<Env, string>('John');
const email = of<Env, string>('john@example.com');

const userReader = liftCreate(id, name, email);
```

---

## 副作用

### tap

执行副作用，但返回原始值。

```typescript
function tap<R, A>(
  reader: Reader<R, A>,
  f: (a: A) => Reader<R, unknown>
): Reader<R, A>
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `reader` | `Reader<R, A>` | 源 Reader |
| `f` | `(a: A) => Reader<R, unknown>` | 副作用函数 |

**返回值：** `Reader<R, A>` - 返回原始值的 Reader

**示例：**

```typescript
const logUser = (user: User): Reader<Env, void> => 
  ({ logger }) => { logger.log(user); };

const getUser = (id: string): Reader<Env, User> => 
  ({ db }) => db.getUser(id);

const getUserWithLog = tap(getUser('123'), logUser);
// 返回 user，但会先执行日志记录
```
