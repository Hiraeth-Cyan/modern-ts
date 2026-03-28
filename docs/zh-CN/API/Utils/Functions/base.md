# Functions Base

函数操作的基础工具函数，提供恒等函数、空函数、执行控制、记忆化等功能。

---

## 使用场景

- **执行控制**：限制函数执行次数、延迟执行
- **错误处理**：安全执行函数，避免 try-catch
- **资源管理**：使用 defer 模式管理异步资源清理
- **函数转换**：参数形式转换、结果取反等

---

## API

### identity

返回输入值本身，常用于默认回调或函数式编程

```typescript
type IdentityFn = <T>(x: T) => T;

const identity: IdentityFn;
```

| 参数 | 类型 | 描述       |
| ---- | ---- | ---------- |
| `x`  | `T`  | 任意输入值 |

**返回值：** 输入值本身

**示例：**

```typescript
identity(42);        // 42
identity('hello');   // 'hello'
identity({ a: 1 });  // { a: 1 } (同一引用)
```

---

### noop

空函数，不执行任何操作，返回 `undefined`

```typescript
const noop: () => void;
```

**返回值：** `undefined`

**示例：**

```typescript
const callback = config.onSuccess ?? noop;
callback();
```

---

### asyncNoop

异步空函数，返回一个解析为 `undefined` 的 Promise

```typescript
const asyncNoop: () => Promise<void>;
```

**返回值：** `Promise<undefined>`

**示例：**

```typescript
const cleanup = config.cleanup ?? asyncNoop;
await cleanup();
```

---

### negate

创建一个返回原谓词函数结果取反的新函数

```typescript
function negate<Args extends unknown[]>(
  predicate: (...args: Args) => boolean
): (this: ThisParameterType<typeof predicate>, ...args: Args) => boolean;
```

| 参数        | 类型                         | 描述     |
| ----------- | ---------------------------- | -------- |
| `predicate` | `(...args: Args) => boolean` | 谓词函数 |

**返回值：** 结果取反的新函数

**示例：**

```typescript
const isEven = (n: number) => n % 2 === 0;
const isOdd = negate(isEven);

isOdd(2);  // false
isOdd(3);  // true

// 多参数谓词
const equals = (a: number, b: number) => a === b;
const notEquals = negate(equals);
notEquals(1, 2);  // true
```

---

### once

创建一个只能执行一次的函数，后续调用返回第一次的结果

```typescript
function once<Args extends unknown[], Ret>(
  fn: (...args: Args) => Ret
): (this: ThisParameterType<typeof fn>, ...args: Args) => Ret;
```

| 参数 | 类型                     | 描述   |
| ---- | ------------------------ | ------ |
| `fn` | `(...args: Args) => Ret` | 原函数 |

**返回值：** 只执行一次的新函数

**示例：**

```typescript
let count = 0;
const init = once(() => {
  count++;
  return 'initialized';
});

init();  // 'initialized', count = 1
init();  // 'initialized', count = 1 (未再次执行)
init();  // 'initialized', count = 1
```

---

### rest

将函数参数分割为固定参数和剩余参数两部分

```typescript
function rest<
  FixedArgs extends unknown[],
  RestArgs extends unknown[],
  Ret
>(
  fn: (fixed: FixedArgs, rest: RestArgs) => Ret
): (this: ThisParameterType<typeof fn>, ...args: [...FixedArgs, ...RestArgs]) => Ret;
```

| 参数 | 类型                                        | 描述               |
| ---- | ------------------------------------------- | ------------------ |
| `fn` | `(fixed: FixedArgs, rest: RestArgs) => Ret` | 接收分割参数的函数 |

**返回值：** 接收展开参数的新函数

**示例：**

```typescript
const process = rest((fixed: [string], rest: number[]) => ({
  prefix: fixed[0],
  values: rest
}));

process('id', 1, 2, 3);
// { prefix: 'id', values: [1, 2, 3] }
```

---

### spread

创建一个接收数组参数并将其展开传递给原函数的函数

```typescript
function spread<Args extends unknown[], Ret>(
  fn: (...args: Args) => Ret
): (this: ThisParameterType<typeof fn>, args: Args) => Ret;
```

| 参数 | 类型                     | 描述   |
| ---- | ------------------------ | ------ |
| `fn` | `(...args: Args) => Ret` | 原函数 |

**返回值：** 接收数组参数的新函数

**示例：**

```typescript
const add = (a: number, b: number, c: number) => a + b + c;
const spreadAdd = spread(add);

spreadAdd([1, 2, 3]);  // 6

// 配合数组方法使用
const pairs = [[1, 2], [3, 4], [5, 6]];
pairs.map(spread((a, b) => a + b));  // [3, 7, 11]
```

---

### after

创建一个在调用 n 次后才执行的函数

```typescript
export const NOT_INVOKED = Symbol('notInvoked');
export type NotInvoked = typeof NOT_INVOKED;

function after<Args extends unknown[], Ret>(
  n: number,
  fn: (...args: Args) => Ret
): (this: ThisParameterType<typeof fn>, ...args: Args) => Ret | NotInvoked;
```

| 参数 | 类型                     | 描述               |
| ---- | ------------------------ | ------------------ |
| `n`  | `number`                 | 开始执行的调用次数 |
| `fn` | `(...args: Args) => Ret` | 原函数             |

**返回值：** 延迟执行的新函数，未达到次数时返回 `NOT_INVOKED`

**示例：**

```typescript
const init = after(3, () => 'ready');

init();  // NOT_INVOKED (Symbol)
init();  // NOT_INVOKED (Symbol)
init();  // 'ready'
init();  // 'ready' (后续调用正常执行)

// 等待多个异步操作完成
const onAllReady = after(3, () => console.log('All loaded'));
loadResource1().then(onAllReady);
loadResource2().then(onAllReady);
loadResource3().then(onAllReady);

// 检查是否真正执行
const result = init();
if (result === NOT_INVOKED) {
  console.log('尚未达到调用次数');
}
```

---

### before

创建一个在调用 n 次前执行的函数，达到次数后返回最后一次结果

```typescript
function before<Args extends unknown[], Ret>(
  n: number,
  fn: (...args: Args) => Ret
): (this: ThisParameterType<typeof fn>, ...args: Args) => Ret | NotInvoked;
```

| 参数 | 类型                     | 描述               |
| ---- | ------------------------ | ------------------ |
| `n`  | `number`                 | 停止执行的调用次数 |
| `fn` | `(...args: Args) => Ret` | 原函数             |

**返回值：** 限制执行次数的新函数，首次调用前返回 `NOT_INVOKED`

**示例：**

```typescript
const limited = before(3, () => Math.random());

limited();  // 0.123...
limited();  // 0.456...
limited();  // 0.456... (返回最后一次结果)
limited();  // 0.456... (后续调用返回缓存结果)

// 限制 API 调用次数
const fetchLimited = before(5, fetchUserData);

// 注意：before(0, fn) 和 before(1, fn) 总是返回 NOT_INVOKED
const neverRuns = before(0, () => 'never');
neverRuns();  // NOT_INVOKED
```

---

### memoize

创建一个记忆化函数，缓存计算结果

```typescript
interface MemoizeCache<K, V> {
  set(key: K, value: V): void;
  get(key: K): V | undefined;
  has(key: K): boolean;
  delete(key: K): boolean | void;
  clear(): void;
  readonly size: number;
}

interface MemoizeOptions<K, V, Args extends unknown[] = unknown[]> {
  cache?: MemoizeCache<K, V>;
  getCacheKey?: (...args: Args) => K;
}

function memoize<F extends AnyFunction>(
  fn: F,
  options?: MemoizeOptions<unknown, ReturnType<F>, Parameters<F>>
): F & {cache: MemoizeCache<unknown, ReturnType<F>>};
```

| 参数      | 类型                                                    | 描述                             |
| --------- | ------------------------------------------------------- | -------------------------------- |
| `fn`      | `F`                                                     | 要记忆化的函数                   |
| `options` | `MemoizeOptions<unknown, ReturnType<F>, Parameters<F>>` | 可选，记忆化选项（缓存和键生成） |

**返回值：** 带 `cache` 属性的新函数

**示例：**

```typescript
// 基础用法
let computeCount = 0;
const square = memoize((x: number) => {
  computeCount++;
  return x * x;
});

square(5);  // 25, computeCount = 1
square(5);  // 25, computeCount = 1 (使用缓存)
square(10); // 100, computeCount = 2

// 使用自定义 getCacheKey
const getUser = memoize(
  (user: { id: number; name: string }) => expensiveLookup(user.id),
  {
    getCacheKey: (user) => user.id  // 只根据 id 缓存
  }
);

// 使用自定义 cache
const customCache = new Map();
const cachedFn = memoize(expensiveFn, { cache: customCache });
```

---

### attempt

安全执行函数，返回 `[error, result]` 元组，无需 try-catch。支持同步和异步函数。

```typescript
type AttemptResult<T> = [T] extends [never]
  ? [unknown, undefined]
  : 0 extends 1 & T
    ? [undefined, T] | [unknown, undefined]
    : T extends PromiseLike<infer R>
      ? PromiseLike<[undefined, R] | [unknown, undefined]>
      : [undefined, T] | [unknown, undefined];

function attempt<Args extends unknown[], R>(
  fn: (...args: Args) => R
): (
  this: ThisParameterType<typeof fn>,
  ...args: Args
) => AttemptResult<R>;
```

| 参数 | 类型                   | 描述         |
| ---- | ---------------------- | ------------ |
| `fn` | `(...args: Args) => R` | 要包装的函数 |

**返回值：** 返回一个函数，该函数返回 `[error, result]` 元组

**示例：**

```typescript
// 同步函数
const safeParse = attempt(JSON.parse);

const [err, data] = safeParse('{"a": 1}');
if (err) {
  console.error('Parse failed:', err);
} else {
  console.log('Parsed:', data);  // { a: 1 }
}

const [err2, data2] = safeParse('invalid');
// err2: SyntaxError, data2: undefined

// 异步函数
const safeFetch = attempt(fetch);
const [err3, response] = await safeFetch('https://api.example.com');

// 自定义异步函数
const fetchData = async (url: string) => {
  const res = await fetch(url);
  return res.json();
};
const safeFetchData = attempt(fetchData);
const [err4, data] = await safeFetchData('https://api.example.com');
```

---

### defer

执行带有延迟清理/错误处理回调的任务。提供类似 try-finally 的资源管理模式，但支持异步清理和多个回调。

```typescript
export const DEFER_NO_ERROR = Symbol('No Error');

type DeferErrorCallback = (error: unknown) => unknown;
type DeferRegisterFn = (fn: DeferErrorCallback) => void;

function defer<R>(
  task: (register: DeferRegisterFn) => MaybePromise<R>
): Promise<R>;
```

| 参数   | 类型                                             | 描述                             |
| ------ | ------------------------------------------------ | -------------------------------- |
| `task` | `(register: DeferRegisterFn) => MaybePromise<R>` | 接收注册函数并返回结果的任务函数 |

**返回值：** 解析为任务结果的 Promise

**异常：**
- 如果任务和回调都失败，抛出包含所有错误的 `AggregateError`
- 如果只有任务失败且回调成功，抛出原始错误
- 如果只有回调失败，抛出 `AggregateError`

**示例：**

```typescript
const result = await defer(async (register) => {
  const resource = acquireResource();
  register(async (error) => {
    await resource.release();
  });
  return resource.use();
});

// 多个清理回调按 LIFO 顺序执行
const result2 = await defer(async (register) => {
  const db = await connectDB();
  register(async () => { await db.close(); });
  
  const file = await openFile('data.txt');
  register(async () => { await file.close(); });
  
  return await processData(db, file);
});
```

---

## 注意事项

1. **once 的参数**：只有第一次调用的参数会被使用，后续调用的参数被忽略
2. **memoize 的缓存键**：默认使用 `JSON.stringify`，对于包含函数或循环引用的对象可能有问题
3. **attempt 的 this 绑定**：保留了原函数的 `this` 绑定，可通过 `call`/`apply` 传递
4. **after/before 的计数**：
   - `after(n, fn)` 在第 n 次调用时开始执行
   - `before(n, fn)` 在第 n 次调用时停止执行并返回最后一次结果
   - 未执行时返回 `NOT_INVOKED` Symbol，而非 `undefined`
5. **NOT_INVOKED Symbol**：用于标识 `after`/`before` 函数尚未执行，可通过 `result === NOT_INVOKED` 检查
6. **defer 回调执行顺序**：注册的回调按 LIFO（后进先出）顺序执行，与资源获取顺序相反
