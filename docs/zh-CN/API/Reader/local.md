# Local (环境局部修改)

`local` 函数允许你在不修改全局环境的情况下，为特定的 Reader 计算创建局部环境修改。

---

## 函数签名

```typescript
// 用于 ReaderT
function local<R, E, A>(
  reader: ReaderT<R, E, A>,
  f_mod: (env: R) => R
): ReaderT<R, E, A>;

// 用于 AsyncReaderT
function local<R, E, A>(
  reader: AsyncReaderT<R, E, A>,
  f_mod: (env: R) => R
): AsyncReaderT<R, E, A>;

// 用于 Reader
function local<R, A>(
  reader: Reader<R, A>,
  f_mod: (env: R) => R
): Reader<R, A>;

// 用于 AsyncReader
function local<R, A>(
  reader: AsyncReader<R, A>,
  f_mod: (env: R) => R
): AsyncReader<R, A>;

// 通用实现
function local<R, A, E, T extends AnyReader<R, A> | AnyReaderT<R, E, A>>(
  reader_like: T,
  f_mod: (env: R) => R
): T;
```

---

## 参数

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `reader_like` | `Reader<R, A> \| AsyncReader<R, A> \| ReaderT<R, E, A> \| AsyncReaderT<R, E, A>` | 要执行的 Reader |
| `f_mod` | `(env: R) => R` | 环境修改函数，接收当前环境并返回修改后的环境 |

---

## 返回值

返回一个新的 Reader，在执行时会先应用环境修改函数，然后执行原始 Reader。

---

## 使用场景

- **局部配置覆盖**：为特定操作临时修改配置
- **环境增强**：为子计算添加额外的上下文信息
- **作用域隔离**：确保环境修改不会影响到其他计算

---

## 示例

### 基础用法

```typescript
import { local } from 'modern-ts/Reader/local';
import { ask } from 'modern-ts/Reader/reader';

interface Config {
  apiUrl: string;
  timeout: number;
}

// 获取当前配置
const getConfig = ask<Config>();

// 在局部修改超时时间
const withShortTimeout = local(
  getConfig,
  config => ({ ...config, timeout: 5000 })
);

const env: Config = { apiUrl: 'http://api.example.com', timeout: 30000 };

getConfig(env);        // { apiUrl: 'http://api.example.com', timeout: 30000 }
withShortTimeout(env); // { apiUrl: 'http://api.example.com', timeout: 5000 }
```

### 嵌套使用

```typescript
const getUser = (id: string): Reader<Env, User> => 
  env => env.db.getUser(id);

// 第一层：切换到测试数据库
const withTestDb = local(
  getUser('123'),
  env => ({ ...env, db: testDatabase })
);

// 第二层：添加请求上下文
const withRequestContext = local(
  withTestDb,
  env => ({ ...env, requestId: 'req-123' })
);

const result = withRequestContext(productionEnv);
// 使用 testDatabase 和包含 requestId 的环境
```

### 与 ReaderT 结合

```typescript
import { local } from 'modern-ts/Reader/local';
import { ask, andThen } from 'modern-ts/Reader/readerT';

interface Env {
  db: Database;
  cache: Cache;
}

// 禁用缓存的操作
const fetchFromDb = local(
  andThen(
    ask<Env, Error>(),
    env => env.db.query('SELECT * FROM users')
  ),
  env => ({ ...env, cache: nullCache })  // 使用空缓存
);

// 正常操作（使用缓存）
const fetchWithCache = andThen(
  ask<Env, Error>(),
  env => env.cache.get('users')
    ? of(env.cache.get('users'))
    : env.db.query('SELECT * FROM users')
);
```

### 异步 Reader

```typescript
import { local } from 'modern-ts/Reader/local';

const fetchUser = async (env: Env) => {
  const response = await env.api.get('/users/123');
  return response.data;
};

// 使用不同的 API 密钥
const fetchWithAdminKey = local(
  fetchUser,
  env => ({ ...env, apiKey: env.adminApiKey })
);

const user = await fetchWithAdminKey(normalEnv);
```

---

## 注意事项

1. **不可变性**：`local` 不会修改原始环境，而是创建一个新的 Reader，在执行时应用修改
2. **作用域**：环境修改只在当前 Reader 及其子计算中有效
3. **组合性**：`local` 可以与其他 Reader 操作（如 `map`、`andThen`）自由组合
4. **类型安全**：TypeScript 会根据传入的 Reader 类型自动推断返回类型
