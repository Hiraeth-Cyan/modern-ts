# debounce

`createDebounce(fn, wait, options)` 创建防抖函数，确保在指定时间间隔内仅执行一次。`Debounced` 类提供更底层的控制

## 使用场景

在高频触发场景（如搜索框输入、窗口调整大小、按钮点击）中，防抖机制能有效防止主线程被冗余任务阻塞，保障应用性能

## 核心优势

### 精确的状态反馈
- **`SKIPPED` 信号机制**：使用 `SKIPPED` 符号明确标识函数调用被跳过的情况
- **状态区分清晰**：能明确区分"函数尚未执行"和"函数执行但无返回值"两种状态

### 高级特性
- **`using` 支持**：支持 `using` 语法绑定实例，作用域结束时自动执行 `.cancel()` 并释放引用
- **高精度时间源**：优先使用 `performance.now()` 获取高精度时间戳
- **RAF 集成**：可通过 `useRAF` 作为 `wait` 参数，使用 `requestAnimationFrame` 进行调度

## API

### createDebounce

```typescript
function createDebounce<A extends readonly unknown[], R>(
  fn: (...args: A) => R,
  wait: number,
  options: {
    leading?: boolean;   // 是否在超时前沿触发，默认 false
    trailing?: boolean;  // 是否在超时后沿触发，默认 true
    maxWait?: number;    // 最大等待时间
    useRAF?: boolean;    // 是否使用 requestAnimationFrame
  }
): DebouncedFunction<A, R, ThisParameterType<typeof fn>>;
```

### createThrottle

```typescript
function createThrottle<A extends readonly unknown[], R>(
  fn: (...args: A) => R,
  wait: number,
  options: {
    leading?: boolean;   // 是否在超时前沿触发，默认 true
    trailing?: boolean;  // 是否在超时后沿触发，默认 true
    useRAF?: boolean;    // 是否使用 requestAnimationFrame
  }
): ThrottledFunction<A, R, ThisParameterType<typeof fn>>;
```

### Debounced 类

```typescript
class Debounced<A extends readonly unknown[], R> {
  constructor(
    fn: (...args: A) => R,
    wait: number | typeof useRAF,
    leading: boolean = false,
    trailing: boolean = true,
    max_wait?: number
  );

  // 调用防抖函数
  call(context: ThisParameterType<typeof fn>, ...args: A): R | Skipped;

  // 取消待执行的调用
  cancel(): void;

  // 立即执行待处理的调用
  flush(): R | Skipped;

  // 是否有待执行的调用
  get pending(): boolean;

  // 获取最后一次执行的结果
  get result(): R | Skipped;

  // 使用 using 语法时自动调用
  [Symbol.dispose](): void;
}
```

### 常量

| 常量 | 类型 | 说明 |
|------|------|------|
| `SKIPPED` | `symbol` | 表示调用被跳过的符号 |
| `useRAF` | `symbol` | 使用 requestAnimationFrame 的标记 |

## 参数说明

### createDebounce 参数

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `fn` | `Function` | - | 要防抖的函数 |
| `wait` | `number` | - | 等待毫秒数，或使用 `useRAF` |
| `options.leading` | `boolean` | `false` | 是否在超时前沿触发 |
| `options.trailing` | `boolean` | `true` | 是否在超时后沿触发 |
| `options.maxWait` | `number` | - | 最大等待时间 |
| `options.useRAF` | `boolean` | `false` | 使用 requestAnimationFrame |

### Debounced 构造参数

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `fn` | `Function` | - | 要防抖的函数 |
| `wait` | `number \| typeof useRAF` | - | 等待毫秒数或 `useRAF` |
| `leading` | `boolean` | `false` | 是否在超时前沿触发 |
| `trailing` | `boolean` | `true` | 是否在超时后沿触发 |
| `max_wait` | `number` | - | 最大等待时间 |

### 异常

- 当 `wait` 为负数或非有限数时，抛出 `ParameterError`
- 当 `wait` 为 `useRAF` 但环境不支持 `requestAnimationFrame` 时，抛出 `ParameterError`
- 当 `wait` 为 `useRAF` 但设置了 `maxWait` 时，抛出 `ParameterError`
- 当 `maxWait` 无效或小于 `wait` 时，抛出 `ParameterError`
- 当 `leading` 和 `trailing` 都为 `false` 时，抛出 `ParameterError`

## 使用示例

### 基础防抖

```typescript
function print(str: string) {
  console.log('[' + performance.now() + ']: ' + str);
}

const debounced = createDebounce(print, 50, {
  leading: true,
  trailing: true
});

const test = ['first', 'second', 'third'];
test.forEach((val) => {
  if (debounced(val) === SKIPPED) {
    print(val + ' 被跳过');
  }
});

setTimeout(() => {
  if (debounced.pending()) {
    print('25ms 已到，强制 Flush');
    debounced.flush();
  } else {
    print('后沿执行的结果为: ' + debounced.result());
  }
}, 25);
```

### 异步函数防抖

```typescript
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchSnacks(id: string) {
  await sleep(20);
  return `小鱼干[${id}]`;
}

const debounced = createDebounce(fetchSnacks, 50, {
  leading: true,
  trailing: true
});

const ids = ['A', 'B', 'C'];

for (const id of ids) {
  const callResult = debounced(id);

  if (callResult !== SKIPPED) {
    callResult.then((res) => console.log('前沿执行拿到了:', res));
  } else {
    console.log(`${id} 被跳过`);
  }
}

await sleep(30);

if (debounced.pending()) {
  const finalRes = await debounced.flush();
  console.log('强制刷新后拿到了:', finalRes);
}
```

### 使用 using 语法

```typescript
{
  using debounced = createDebounce((x: number) => console.log(x), 100);

  debounced(1);
  debounced(2);
  debounced(3);

  // 作用域结束时自动调用 cancel() 并释放引用
}
```

### 节流函数

```typescript
const throttled = createThrottle(
  () => updateScrollIndicator(),
  100,
  { leading: true, trailing: false }
);

window.addEventListener('scroll', throttled);

// 控制方法
throttled.cancel();
throttled.flush();
console.log(throttled.pending());
```

### 使用 requestAnimationFrame

```typescript
const rafDebounced = createDebounce(
  (pos: { x: number; y: number }) => updatePosition(pos),
  useRAF as unknown as number,
  { useRAF: true }
);

// 或者使用 Debounced 类
const rafDebounced2 = new Debounced(
  (pos: { x: number; y: number }) => updatePosition(pos),
  useRAF,
  false,
  true
);
```

### 使用 maxWait 实现节流效果

```typescript
// 最多等待 500ms，即使一直在输入
const search = createDebounce(
  (query: string) => fetchResults(query),
  300,
  { maxWait: 500 }
);

// 用户快速输入时，最多 500ms 执行一次
searchInput.addEventListener('input', (e) => search(e.target.value));
```

### Debounced 类直接使用

```typescript
const debounced = new Debounced(
  (x: number, y: number) => x + y,
  100,
  false,
  true
);

// 注意：类不会自动绑定 this，使用 call 方法
const result = debounced.call(null, 1, 2);
if (result !== SKIPPED) {
  console.log('结果:', result);
}

// 检查状态
console.log('是否有待执行:', debounced.pending);
console.log('最后结果:', debounced.result);

// 取消待执行
debounced.cancel();

// 立即执行
debounced.flush();

// 使用 using
{
  using d = debounced;
  d.call(null, 3, 4);
}
```

## 注意事项

1. **leading 与 trailing 组合**：
   - `leading: true, trailing: false`：仅在前沿触发（第一次调用立即执行）
   - `leading: false, trailing: true`：仅在后沿触发（默认，等待结束后执行）
   - `leading: true, trailing: true`：前后沿都触发（会执行两次）
   - `leading: false, trailing: false`：无效组合，会抛出错误

2. **类与工厂函数的区别**：
   - `Debounced` 类：需要手动调用 `call` 方法，不会自动绑定 `this`
   - `createDebounce`：返回的函数可以直接调用，自动处理 `this` 绑定

3. **RAF 限制**：
   - 使用 `useRAF` 时不能设置 `maxWait`
   - 需要环境支持 `requestAnimationFrame`

4. **返回值**：
   - 被跳过的调用返回 `SKIPPED` 符号
   - 需要检查返回值以确定函数是否实际执行
