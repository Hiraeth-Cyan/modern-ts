# pipe

`pipe(...fns)` 或 `pipeAsync(...fns)` 创建函数管道，将多个函数从左到右组合，前一个函数的输出作为后一个函数的输入。`run` 和 `runAsync` 用于直接执行管道

## 使用场景

在数据处理流程（如数据转换、验证链、中间件处理）中，管道机制能清晰表达数据流动的顺序，避免嵌套回调地狱，提升代码可读性和可维护性

## 核心优势

### 精确的类型推导
- **链式类型校验**：TypeScript 会在编译期验证每个函数的输入/输出类型是否匹配，类型不匹配时会显示清晰的错误信息
- **自动推断最终类型**：根据函数链自动推导最终返回值类型，无需手动标注

### 智能异步处理
- **同步优先**：`runAsync` 和 `pipeAsync` 会尽可能保持同步执行，直到遇到第一个 `Promise` 才切换到异步模式
- **无缝混合**：支持同步函数和异步函数在同一管道中混用，自动处理 `Promise` 的解包和传递

### 灵活的调用方式
- **`run` / `runAsync`**：直接执行管道，传入初始值和函数列表
- **`pipe` / `pipeAsync`**：创建可复用的柯里化函数，延迟执行

## API

### 同步管道

```typescript
// 直接执行
function run<T, Fns extends readonly [NextFn<any, any>, ...NextFn<any, any>[]]>(
  input: T,
  ...fns: Fns
): Out<Fns>;

// 创建管道函数
function pipe(): IdentityFn;
function pipe<Fns extends readonly [Fn<any, any>, ...NextFn<any, any>[]]>(
  ...fns: Fns
): PipeR<Fns>;
```

### 异步管道

```typescript
// 直接执行
function runAsync<T, Fns extends [AsyncNextFn<any, any>, ...AsyncNextFn<any, any>[]]>(
  input: T,
  ...fns: Fns
): Promise<AsyncOut<Fns>>;

// 创建管道函数
function pipeAsync(): IdentityFn;
function pipeAsync<Fns extends readonly [AsyncFn<any, any>, ...AsyncNextFn<any, any>[]]>(
  ...fns: Fns
): AsyncPipeR<Fns>;
```

## 参数说明

### pipe / pipeAsync 参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `fns` | `Function[]` | 要组合的函数列表 |

### run / runAsync 参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `input` | `T` | 初始输入值 |
| `fns` | `Function[]` | 要执行的函数列表 |

### 返回值

| 函数 | 返回值 |
|------|--------|
| `pipe(...fns)` | 组合后的同步函数 |
| `pipeAsync(...fns)` | 组合后的异步函数，返回 `Promise` |
| `run(input, ...fns)` | 同步管道的执行结果 |
| `runAsync(input, ...fns)` | 异步管道的执行结果，返回 `Promise` |

## 使用示例

### 基础用法

```typescript
const addOne = (x: number) => x + 1;
const double = (x: number) => x * 2;
const toString = (x: number) => `Result: ${x}`;

// 使用 pipe 创建可复用的函数
const transform = pipe(addOne, double, toString);

console.log(transform(5));  // "Result: 12"

// 使用 run 直接执行
const result = run(5, addOne, double, toString);
console.log(result);  // "Result: 12"
```

### 多参数函数

```typescript
// 第一个函数可以是多参数的
const sum = (a: number, b: number) => a + b;
const multiplyByThree = (x: number) => x * 3;
const format = (x: number) => `Value is ${x}`;

const compute = pipe(sum, multiplyByThree, format);

console.log(compute(2, 3));  // "Value is 15"
```

### 异步管道

```typescript
const fetchUser = async (id: number) => {
  return {id, name: 'Alice', age: 25};
};

const extractName = (user: {name: string}) => user.name;
const toUpperCase = (name: string) => name.toUpperCase();

// 创建异步管道
const getUpperCaseName = pipeAsync(fetchUser, extractName, toUpperCase);

// 执行并等待结果
const result = await getUpperCaseName(1);
console.log(result);  // "ALICE"

// 或者使用 runAsync
const result2 = await runAsync(1, fetchUser, extractName, toUpperCase);
console.log(result2);  // "ALICE"
```

### 混合同步与异步

```typescript
const syncAdd = (x: number) => x + 1;
const asyncDouble = async (x: number) => x * 2;
const syncToString = (x: number) => `Value: ${x}`;

// 同步和异步函数可以混用
const mixed = pipeAsync(syncAdd, asyncDouble, syncToString);

// 遇到异步函数后自动切换到 Promise 模式
const result = await mixed(5);
console.log(result);  // "Value: 12"
```

### 类型错误检测

```typescript
const toString = (x: number) => `${x}`;
const toNumber = (x: string) => parseInt(x, 10);
const double = (x: number) => x * 2;

// 类型错误：toString 返回 string，但 double 期望 number
// const invalid = pipe(toString, double);
//     ^^^^^ 编译错误：类型不匹配

// 正确的顺序
const valid = pipe(toNumber, double);
console.log(valid("5"));  // 10
```

### 空管道（恒等函数）

```typescript
// 不传参数时返回恒等函数
const identity = pipe();
console.log(identity(42));  // 42

const asyncIdentity = pipeAsync();
console.log(asyncIdentity(42));  // 42
```

### 与 curry 配合使用

```typescript
const multiply = (a: number, b: number) => a * b;
const add = (a: number, b: number) => a + b;

const curriedMultiply = curry(multiply, 2);
const curriedAdd = curry(add, 2);

// 创建偏函数
const double = curriedMultiply(__, 2);
const addTen = curriedAdd(__, 10);

// 在管道中使用
const transform = pipe(double, addTen);
console.log(transform(5));  // 20 (5 * 2 + 10)
```

## 注意事项

1. **第一个函数的特殊性**：管道中的第一个函数可以是多参数的，后续函数必须只接受一个参数（接收前一个函数的输出）

2. **异步返回值**：`pipeAsync` 和 `runAsync` 在遇到异步函数时会返回 `Promise`，即使后续是同步函数

3. **错误传播**：管道中的任何错误（同步抛出或 Promise 拒绝）都会中断执行并向上传播

4. **类型推导限制**：
   - 管道函数的类型推导依赖于函数数组的长度
   - 过长的函数链可能导致类型推导变慢
   - 建议在复杂场景下拆分为多个管道
