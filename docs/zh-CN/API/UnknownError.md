# UnknownError

JavaScript的错误处理本质上是混沌的：`throw`语句可抛出任意类型的值（即"throw anything"）。这直接导致日志记录、错误链追踪、以及类型安全的下游处理逻辑面临巨大挑战。Error类型的不确定性使得**可观察性**和**可恢复性**大幅降低。

---

## 核心类

### UnknownError

继承自`Error`的标记类，专用于表示经过封装的、原始类型未知的异常。

#### 构造函数

```typescript
constructor(raw_error: unknown, message?: string)
```

| 参数        | 类型      | 描述                 |
| ----------- | --------- | -------------------- |
| `raw_error` | `unknown` | 原始的、未知的错误值 |
| `message`   | `string`  | 可选的错误消息描述   |

---

#### 静态方法

##### from

创建一个`UnknownError`实例。

```typescript
static from(raw_error: unknown, message?: string): UnknownError
```

| 参数        | 类型      | 描述                 |
| ----------- | --------- | -------------------- |
| `raw_error` | `unknown` | 原始的、未知的错误值 |
| `message`   | `string`  | 可选的错误消息描述   |

**返回值：** 封装后的`UnknownError`实例

**示例：**
```typescript
try {
  await riskyOperation();
} catch (e) {
  const err = UnknownError.from(e, '操作失败');
  console.log(err.cause); // 原始错误值
}
```

---

#### 属性

| 属性    | 类型      | 描述                                   |
| ------- | --------- | -------------------------------------- |
| `cause` | `unknown` | 原始的、未知的错误值，确保完整的错误链 |
| `name`  | `string`  | 固定为`'UnknownError'`                 |

---

#### 实例方法

##### toString

返回错误的可视化表示（不包含堆栈跟踪）。

```typescript
toString(): string
```

**返回值：** 格式为`UnknownError: {message}\nCaused by: {cause}`的字符串

**示例：**
```typescript
const err = UnknownError.from(new Error('inner'));
console.log(err.toString());
// UnknownError: UnknownError: inner
// Caused by: Error: inner
```

---

## 类型定义

### ErrorType

标准化的错误分类结构，将未知错误值分类为不同类型以便统一处理。

```typescript
interface ErrorType {
  readonly type_code: 0 | 1 | 2 | 3 | 4;
  readonly message: string;
}
```

#### type_code 分类

| 编码 | 含义                                   |
| ---- | -------------------------------------- |
| `0`  | 标准`Error`实例                        |
| `1`  | `DOMException`（通常为`AbortError`）   |
| `2`  | `null`或`undefined`值                  |
| `3`  | 具有`message`属性的类错误对象          |
| `4`  | 复杂对象或不具备标准错误结构的基本类型 |

#### 属性

| 属性        | 类型                    | 描述                               |
| ----------- | ----------------------- | ---------------------------------- |
| `type_code` | `0 \| 1 \| 2 \| 3 \| 4` | 错误分类编码                       |
| `message`   | `string`                | 人类可读的错误描述，已清理安全显示 |

---

## 工具函数

### extractErrorInfo

从任意未知值中安全提取结构化错误信息。处理边缘情况包括`DOMException`、基本类型值、具有循环引用的对象、getter和Proxy陷阱。

```typescript
function extractErrorInfo(error_data: unknown): ErrorType
```

| 参数         | 类型      | 描述                            |
| ------------ | --------- | ------------------------------- |
| `error_data` | `unknown` | 捕获的异常值（通常来自catch块） |

**返回值：** 带有分类和清理消息的规范化错误对象

**处理策略：**

1. **DOMException**：返回`type_code: 1`，message为空字符串
2. **Error实例**：返回`type_code: 0`，message为空字符串
3. **null/undefined**：返回`type_code: 2`，message为默认提示文本
4. **类错误对象**：返回`type_code: 3`，message为对象的message属性值
5. **基本类型**：返回`type_code: 4`，message格式为`Primitive [类型]: 值`
6. **复杂对象**：返回`type_code: 4`，尝试JSON序列化或属性提取

**示例：**
```typescript
// Error 实例
extractErrorInfo(new Error('test'));
// { type_code: 0, message: '' }

// DOMException
extractErrorInfo(new DOMException('Aborted', 'AbortError'));
// { type_code: 1, message: '' }

// null/undefined
extractErrorInfo(null);
// { type_code: 2, message: 'An unknown or null/undefined error occurred.' }

// 类错误对象
extractErrorInfo({ message: '自定义错误' });
// { type_code: 3, message: '自定义错误' }

// 基本类型
extractErrorInfo('string error');
// { type_code: 4, message: 'Primitive [string]: string error' }

// 复杂对象
extractErrorInfo({ code: 500, data: null });
// { type_code: 4, message: 'Complex Object [object Object]: {...}' }
```

---

### ensureError

安全地将任何捕获到的值转换为一个标准的`Error`实例。

```typescript
function ensureError(error_data: unknown): Error & {cause?: unknown}
```

| 参数         | 类型      | 描述                              |
| ------------ | --------- | --------------------------------- |
| `error_data` | `unknown` | 捕获到的任意值（通常来自catch块） |

**返回值：** 标准的`Error`实例，带有可选的`cause`属性

**转换策略：**
- **Error/DOMException**：直接返回原对象（`type_code`为0或1）
- **null/undefined**：封装为`Error`，message为默认提示文本
- **类错误对象**：封装为`Error`，message为对象的message属性值
- **复杂对象/基本类型**：封装为`Error`，message添加`Wrapped:`前缀

**示例：**
```typescript
// Error 实例直接返回
const err1 = ensureError(new Error('test')); // Error: test

// DOMException 直接返回
const err2 = ensureError(new DOMException('aborted')); // DOMException

// null/undefined 封装
const err3 = ensureError(null);
// Error: An unknown or null/undefined error occurred.

// 类错误对象
const err4 = ensureError({ message: '自定义错误' });
// Error: 自定义错误

// 基本类型
const err5 = ensureError('string');
// Error: Wrapped: Primitive [string]: string

// 复杂对象
const err6 = ensureError({ code: 500 });
// Error: Wrapped: Complex Object [object Object]: {...}
```

---

### ensureDOMException

将任意抛出值转换为`DOMException`，同时保留原始上下文。

```typescript
function ensureDOMException(
  error_data: unknown,
  name?: string
): DOMException & {cause?: unknown}
```

| 参数         | 类型      | 描述                                   |
| ------------ | --------- | -------------------------------------- |
| `error_data` | `unknown` | 捕获到的任意值（通常来自catch块）      |
| `name`       | `string`  | DOMException名称，默认为`'AbortError'` |

**返回值：** `DOMException`实例，带有可选的`cause`属性

**处理策略：**
- **DOMException**：直接返回原对象
- **Error实例**：创建`DOMException`，保留原始堆栈跟踪
- **其他类型**：创建包装的`DOMException`，message格式为`DOMException Wrapped: ...`

**示例：**
```typescript
// Error 转 DOMException
try {
  throw new Error('Network failure');
} catch (e) {
  const domError = ensureDOMException(e);
  console.log(domError.name);  // "AbortError"
  console.log(domError.cause); // 原始 Error 实例
}

// 复杂对象包装
try {
  throw { code: 404, msg: 'Not found' };
} catch (e) {
  const domError = ensureDOMException(e);
  console.log(domError.message);
  // "DOMException Wrapped: Complex Object [object Object]..."
}

// 指定名称
try {
  throw 'timeout';
} catch (e) {
  const domError = ensureDOMException(e, 'TimeoutError');
  console.log(domError.name); // "TimeoutError"
}
```

---

## 使用示例

### 基础错误封装

```typescript
async function fetchData(url: string) {
  try {
    const response = await fetch(url);
    return response.json();
  } catch (e) {
    throw UnknownError.from(e, `请求 ${url} 失败`);
  }
}
```

### 与 Result 模式结合

```typescript
async function safeOperation(): Promise<Result<Data, UnknownError>> {
  try {
    const data = await riskyOperation();
    return Result.ok(data);
  } catch (e) {
    return Result.err(UnknownError.from(e));
  }
}

// 下游处理
const result = await safeOperation();
if (result.isErr()) {
  // 类型安全地访问错误
  console.log(result.unwrapErr().cause);
}
```

### 错误类型区分

```typescript
function handleError(err: UserNotFoundError | NetworkError | UnknownError) {
  if (err instanceof UserNotFoundError) {
    // 处理用户不存在
  } else if (err instanceof NetworkError) {
    // 处理网络错误
  } else if (err instanceof UnknownError) {
    // 处理未知错误，可追溯原始值
    console.log('原始错误:', err.cause);
  }
}
```

### 第三方 API 边界处理

```typescript
async function callLegacyApi(): Promise<Result<Response, UnknownError>> {
  try {
    // 老旧 API 可能抛出非 Error 类型
    const result = legacyApi.call();
    return Result.ok(result);
  } catch (e) {
    // 先确保是 Error，再封装为 UnknownError
    const normalized = ensureError(e);
    return Result.err(UnknownError.from(normalized));
  }
}
```

---

## 设计原理

### 为什么需要 UnknownError

尽管现代规范（如ESLint）和主流范式（如TypeScript严格模式）已极力限制这种情况（例如，在catch块中将异常默认为`unknown`），但我们仍不可避免地在以下场景面对类型未知的抛出：

- **老旧/第三方 API 调用**：集成未遵循现代标准的遗留代码或外部库
- **不可信任的外部环境**：Worker、IPC通信或JNI/FFI桥接层

在这些类型边界上，我们需要一个统一的、可追踪的、且可被类型系统识别的错误对象来标准化混沌。

### Result<T, UnknownError> 优于 Result<T, unknown>

| 类型签名                  | 语义                 | 类型安全性/价值                                                                                                                                                                                                       |
| ------------------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Result<T, unknown>`      | 错误类型是未知的     | 类型通道已堵塞。`unknown`在TypeScript中代表最高安全性，意味着无法直接使用该错误值，任何操作都必须进行运行时检查（`instanceof`或类型守卫）。这使得下游代码难以可靠地解构错误信息，违背了`Result`模式类型化错误的初衷。 |
| `Result<T, UnknownError>` | 错误类型是确定的实例 | 类型通道已疏通。`UnknownError`是一个明确的类。下游消费者可以自信地进行操作：直接访问`err.cause`进行溯源、`instanceof UnknownError`检查无需担心类型不一致、可与其他显式错误类型一起进行合并和区分处理。                |

**结论**：使用`UnknownError`作为错误类型泛型，将运行时的`unknown`不确定性，提升到了编译时可识别的`Error`类型，从而恢复了`Result`模式的类型安全性和可操作性。

### 错误链溯源

`UnknownError`遵循ECMAScript的`Error.cause`规范，确保完整的错误链：

```typescript
const err = UnknownError.from(originalError);
console.log(err.cause); // 原始错误值，可用于溯源
```

这与其他标准错误类型（如`TypeError`、`NetworkError`）保持一致，便于统一的错误处理流程。
