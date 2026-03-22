# delay

提供异步延迟功能的工具函数集，支持可取消延迟、安全延迟和简单睡眠。

---

## 函数

### delay

延迟指定毫秒数后执行，支持通过 `AbortSignal` 取消。

```typescript
function delay(ms: number, signal?: AbortSignal): Promise<void>
```

| 参数     | 类型          | 描述             |
| -------- | ------------- | ---------------- |
| `ms`     | `number`      | 延迟时间（毫秒） |
| `signal` | `AbortSignal` | 可选的取消信号   |

**返回值：** 延迟结束后解析的 Promise

**异常：** 当 `signal` 被中止时，Promise 会以 `DOMException` 形式拒绝

---

### delaySafe

`delay` 的安全版本，永不拒绝。当被中止时，Promise 会 resolve 一个 `DOMException` 而非 reject。

```typescript
function delaySafe(
  ms: number,
  signal?: AbortSignal,
): Promise<undefined | DOMException>
```

| 参数     | 类型          | 描述             |
| -------- | ------------- | ---------------- |
| `ms`     | `number`      | 延迟时间（毫秒） |
| `signal` | `AbortSignal` | 可选的取消信号   |

**返回值：**
- 正常完成时解析为 `undefined`
- 被中止时解析为 `DOMException`

**适用场景：** 需要处理中止条件但不想使用 try-catch 的场景

---

### sleep

`delay` 的简化版本，不可取消。适用于不需要中止逻辑的简单暂停场景。

```typescript
const sleep = (ms: number): Promise<void>
```

| 参数 | 类型     | 描述             |
| ---- | -------- | ---------------- |
| `ms` | `number` | 睡眠时间（毫秒） |

**返回值：** 延迟结束后解析的 Promise

---

## 使用示例

### 基础延迟

```typescript
// 使用 delay
await delay(1000);
console.log('1 秒后执行');

// 使用 sleep（更简洁）
await sleep(1000);
console.log('又过了 1 秒');
```

### 可取消延迟

```typescript

const controller = new AbortController();

// 5 秒后取消延迟
setTimeout(() => controller.abort(), 5000);

try {
  await delay(10000, controller.signal);
  console.log('延迟完成');
} catch (err) {
  console.log('延迟被取消:', err.message);
}
```

### 安全延迟（无需 try-catch）

```typescript

const controller = new AbortController();
setTimeout(() => controller.abort(), 500);

const result = await delaySafe(10000, controller.signal);

if (result) {
  console.log('延迟被中止:', result.message);
} else {
  console.log('延迟完成');
}
```


