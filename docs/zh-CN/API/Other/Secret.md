# Secret

在现代应用开发中，API Key、数据库密码、OAuth Token 等敏感信息是攻击者的主要目标。`Secret` 类通过多重防护机制，确保敏感值不会意外出现在日志、错误消息或序列化输出中。

---

## 为什么需要 Secret

敏感信息经常通过以下场景意外暴露：

| 风险场景     | 暴露方式                                     | Secret 的防护机制                               |
| ------------ | -------------------------------------------- | ----------------------------------------------- |
| **日志记录** | `console.log(config)` 意外打印包含密钥的对象 | 覆盖 `toString`/`inspect`，抛出 `SecretError`   |
| **错误报告** | 堆栈跟踪和崩溃报告包含作用域变量             | ES Private Fields 阻止遍历和反射获取            |
| **序列化**   | `JSON.stringify()` 意外序列化敏感字段        | `toJSON()` 方法抛出 `SecretError`               |
| **隐式转换** | 模板字符串或拼接操作触发 `toPrimitive`       | `Symbol.toPrimitive` 抛出 `SecretError`         |
| **内存驻留** | 敏感值长期驻留内存，可被内存检查工具提取     | `destroy` 和 `using` 机制强制短期使用后立即抹除 |

### 防护机制详解

1. **ES Private Fields (#)**：从引擎底层屏蔽外部遍历、反射获取且不可序列化
2. **受控访问入口**：强制使用 `Secret.reveal()` 访问原始值
3. **自动资源管理**：实现 `Symbol.dispose`，支持 `using` 声明
4. **内存清理**：`destroy` 方法用 Symbol 替换原始值，减少暴露窗口

---

## 核心类

### Secret

用于安全存储敏感值的容器类，利用 ES Private Fields 和受控访问机制保护数据。

#### 构造函数

```typescript
constructor(value: T)
```

| 参数    | 类型 | 描述             |
| ------- | ---- | ---------------- |
| `value` | `T`  | 需要保护的敏感值 |

---

#### 静态方法

##### make

创建一个 `Secret` 实例。

```typescript
static make<T>(value: T): Secret<T>
```

| 参数    | 类型 | 描述             |
| ------- | ---- | ---------------- |
| `value` | `T`  | 需要保护的敏感值 |

**返回值：** 封装后的 `Secret<T>` 实例

**示例：**
```typescript
const API_KEY = Secret.make('sk-1234567890');
```

---

##### reveal

揭示 Secret 中存储的原始敏感值。这是唯一受控的访问入口。

```typescript
static reveal<T>(secret: Secret<T>): T
```

| 参数     | 类型        | 描述                 |
| -------- | ----------- | -------------------- |
| `secret` | `Secret<T>` | 要揭示的 Secret 实例 |

**返回值：** 原始敏感值

**抛出：** 如果 Secret 已被销毁，抛出 `SecretError`

> ⚠️ **警告**：此操作会暴露敏感信息，请谨慎使用！

**示例：**
```typescript
const API_KEY = Secret.make('sk-1234567890');
const value = Secret.reveal(API_KEY);
console.log(value); // 'sk-1234567890'
```

---

##### destroy

销毁敏感值，用内部 `EMPTY` Symbol 替换原始值，减少内存暴露窗口。

```typescript
static destroy<T>(secret: Secret<T>): void
```

| 参数     | 类型        | 描述                 |
| -------- | ----------- | -------------------- |
| `secret` | `Secret<T>` | 要销毁的 Secret 实例 |

> ⚠️ **注意**：由于仅通过内存替换实现抹除，Secret 无法保证操作系统或底层运行时（如 V8 引擎）不对原始值进行额外的内存复制或堆外存储。

**示例：**
```typescript
const API_KEY = Secret.make('sk-1234567890');
Secret.destroy(API_KEY);

Secret.reveal(API_KEY); // 抛出 SecretError: Attempt to access the deleted secret value.
```

---

##### dispose

执行回调函数并确保 Secret 在完成后立即销毁。

```typescript
static dispose<T, R>(secret: Secret<T>, callback: (value: T) => R): R
```

| 参数       | 类型              | 描述                     |
| ---------- | ----------------- | ------------------------ |
| `secret`   | `Secret<T>`       | 要操作的 Secret 实例     |
| `callback` | `(value: T) => R` | 使用敏感值执行的回调函数 |

**返回值：** 回调函数的返回值

**示例：**
```typescript
const API_KEY = Secret.make('sk-1234567890');

const result = Secret.dispose(API_KEY, (key) => {
  return key.substring(0, 5) + '...';
});

console.log(result); // 'sk-12...'
// API_KEY 已自动销毁
```

---

##### disposeAsync

执行异步回调函数并确保 Secret 在完成后立即销毁。

```typescript
static async disposeAsync<T, R>(
  secret: Secret<T>,
  callback: (value: T) => Promise<R>
): Promise<R>
```

| 参数       | 类型                       | 描述                         |
| ---------- | -------------------------- | ---------------------------- |
| `secret`   | `Secret<T>`                | 要操作的 Secret 实例         |
| `callback` | `(value: T) => Promise<R>` | 使用敏感值执行的异步回调函数 |

**返回值：** Promise，解析为回调函数的返回值

**示例：**
```typescript
const API_KEY = Secret.make('sk-1234567890');

const result = await Secret.disposeAsync(API_KEY, async (key) => {
  const response = await fetch('/api/data', {
    headers: { 'Authorization': `Bearer ${key}` }
  });
  return response.json();
});
// API_KEY 已自动销毁
```

---

### SecretError

当尝试非法访问或操作 Secret 时抛出的错误类型。

```typescript
class SecretError extends Error {
  constructor(message: string);
}
```

| 属性      | 类型     | 描述                   |
| --------- | -------- | ---------------------- |
| `name`    | `string` | 固定为 `'SecretError'` |
| `message` | `string` | 错误描述信息           |

---

## 使用示例

### 基础使用

```typescript
// 创建 Secret
const API_KEY = Secret.make('sk-1234567890abcdef');

// 尝试打印会报错
try {
  console.log(API_KEY);
} catch (e) {
  if (e instanceof SecretError) {
    console.log(e.message);
    // Secret values cannot be inspected via console.log
  }
}

// 正确访问方式
const key = Secret.reveal(API_KEY);
console.log(key.substring(0, 5) + '...'); // 'sk-12...'
```

### 防止隐式转换

```typescript
const API_KEY = Secret.make('sk-1234567890');

// 所有隐式转换都会抛出 SecretError
try {
  String(API_KEY);
} catch (e) {
  console.log(e.message);
  // Secret values cannot be converted to String via toString()
}

try {
  JSON.stringify(API_KEY);
} catch (e) {
  console.log(e.message);
  // Secret values cannot be serialized via toJSON()
}
```

### 使用 using 自动清理

```typescript
const secret = Secret.make('sk-1234567890');

{
  using key = secret;
  const value = Secret.reveal(key);
  console.log(`Using key: ${value.substring(0, 5)}...`);
}

// 离开作用域后 Secret 已自动销毁
try {
  Secret.reveal(secret);
} catch (e) {
  console.log(e.message);
  // Attempt to access the deleted secret value.
}
```

---

## Secret vs 原始值

| 特性             | 原始值 (string) | Secret<T>                |
| ---------------- | --------------- | ------------------------ |
| `console.log`    | ✅ 正常输出      | ❌ 抛出 `SecretError`     |
| `JSON.stringify` | ✅ 正常序列化    | ❌ 抛出 `SecretError`     |
| 隐式字符串转换   | ✅ 自动转换      | ❌ 抛出 `SecretError`     |
| 受控访问         | ❌ 随时可访问    | ✅ 必须通过 `reveal()`    |
| 内存安全清理     | ❌ 不可控        | ✅ `destroy()` 或 `using` |
| 类型安全         | ❌ 无特殊标记    | ✅ 类型系统识别为敏感数据 |

**结论**：`Secret` 将运行时的敏感值访问控制提升到了类型系统层面，通过编译时和运行时的双重保护，最大程度降低敏感信息泄露风险。
