# Reader

Reader 是函数式编程中的经典 Monad，用于处理**依赖注入**场景。它将依赖环境（Environment）显式化，使函数能够访问共享配置、上下文或服务，同时保持纯函数特性。

---

## 使用场景

- **依赖注入**：将配置、数据库连接、日志服务等作为环境注入
- **上下文传递**：在函数调用链中隐式传递上下文信息
- **测试友好**：通过替换环境实现依赖的 mock
- **函数组合**：将依赖环境的函数进行组合和转换

---

## 类型定义

```typescript
// 同步 Reader：从环境 R 计算值 A
type Reader<R, A> = (env: R) => A;

// 异步 Reader：从环境 R 异步计算值 A
type AsyncReader<R, A> = (env: R) => PromiseLike<A>;

// ReaderT：结合 Reader 和 Result，支持错误处理
type ReaderT<R, E, A> = Reader<R, Result<A, E>>;

// 异步 ReaderT
type AsyncReaderT<R, E, A> = Reader<R, AsyncResult<A, E>>;

// 联合类型
type AnyReader<R, A> = Reader<R, A> | AsyncReader<R, A>;
type AnyReaderT<R, E, A> = ReaderT<R, E, A> | AsyncReaderT<R, E, A>;
```

---

## 核心概念

### Reader 模式

Reader 本质上是一个接受环境参数并返回值的函数：

```typescript
// 普通函数依赖外部配置
function greet(name: string, config: { greeting: string }): string {
  return `${config.greeting}, ${name}!`;
}

// 使用 Reader 模式
const greetReader: Reader<{ greeting: string }, string> = 
  (env) => (name: string) => `${env.greeting}, ${name}!`;
```

### ReaderT (Reader Transformer)

ReaderT 是 Reader 的 Monad Transformer 版本，结合了 Reader 的依赖注入能力和 Result 的错误处理能力：

```typescript
// ReaderT 可以处理成功和失败两种情况
const fetchUser: ReaderT<ApiConfig, NetworkError, User> = (config) => {
  // 成功返回 Ok(user)，失败返回 Err(error)
};
```

---

## 模块结构

| 模块                             | 说明                                    |
| -------------------------------- | --------------------------------------- |
| [Reader](reader.md)              | 同步 Reader 操作（map、flatMap、ap 等） |
| [AsyncReader](reader-async.md)   | 异步 Reader 操作                        |
| [ReaderT](readerT.md)            | 同步 ReaderT（带错误处理）              |
| [AsyncReaderT](readerT-async.md) | 异步 ReaderT（带错误处理）              |
| [Local](local.md)                | 环境局部修改操作                        |

---

## 快速开始

### 基础 Reader

```typescript
import { of, ask, map, anThen } from 'modern-ts/Reader/reader';

// 定义环境类型
interface Env {
  db: Database;
  logger: Logger;
}

// 创建 Reader
const getUser = (id: string): Reader<Env, User> => 
  ({ db }) => db.users.findById(id);

// 组合 Reader
const getUserName = map(
  getUser('123'),
  user => user.name
);

// 链式操作
const logAndGetUser = anThen(
  getUser('123'),
  user => ({ logger }) => {
    logger.info(`Got user: ${user.name}`);
    return of<Env, User>(user);
  }
);

// 执行 Reader
const env: Env = { db: myDb, logger: myLogger };
const user = logAndGetUser(env);
```

### ReaderT 错误处理

```typescript
import { of, ask, map, andThen, fail } from 'modern-ts/Reader/readerT';
import { isOk, isErr } from 'modern-ts/Result';

const validateUser = (user: User): ReaderT<Env, ValidationError, User> => {
  if (!user.email) {
    return fail({ field: 'email', message: 'Required' });
  }
  return of(user);
};

const saveUser = (user: User): ReaderT<Env, DbError, User> => 
  ({ db }) => {
    try {
      db.save(user);
      return Ok(user);
    } catch (e) {
      return Err({ type: 'DB_ERROR', cause: e });
    }
  };

// 组合带错误处理的操作
const createUser = (data: UserData): ReaderT<Env, ValidationError | DbError, User> =>
  andThen(
    validateUser(data),
    saveUser
  );

// 执行并处理结果
const result = createUser(newUser)(env);
if (isOk(result)) {
  console.log('Success:', result.value);
} else {
  console.error('Failed:', result.error);
}
```

### 异步 Reader

```typescript
import { ofAsync, mapAsync, andThenAsync } from 'modern-ts/Reader/reader-async';

const fetchUser = (id: string): AsyncReader<Env, User> => 
  async ({ api }) => api.getUser(id);

const fetchUserPosts = (user: User): AsyncReader<Env, Post[]> => 
  async ({ api }) => api.getPosts(user.id);

// 异步组合
const fetchUserWithPosts = andThenAsync(
  fetchUser('123'),
  user => mapAsync(
    fetchUserPosts(user),
    posts => ({ ...user, posts })
  )
);

const result = await fetchUserWithPosts(env);
```

---

## 与 Result 的对比

| 特性     | Reader             | Result               |
| -------- | ------------------ | -------------------- |
| 主要用途 | 依赖注入           | 错误处理             |
| 上下文   | 需要环境 R         | 无需环境             |
| 返回值   | 直接返回值 A       | 返回 Ok(A) 或 Err(E) |
| 组合方式 | 函数组合           | 结果组合             |
| 适用场景 | 配置传递、服务注入 | 操作可能失败         |

**组合使用**：ReaderT 结合了两者的优势，既支持依赖注入，又支持错误处理。

---

## 注意事项

1. **环境不可变性**：Reader 执行时环境是只读的，如需修改请使用 `local` 函数创建局部环境
2. **惰性求值**：Reader 是惰性计算的，只有在传入环境时才会执行
3. **类型推导**：充分利用 TypeScript 的类型推导，减少显式类型注解
4. **错误边界**：使用 ReaderT 时，明确错误类型有助于更好的错误处理
