# curry

`curry(fn, length)` 创建柯里化函数，支持分步传参和占位符（`__`）功能，实现灵活的偏函数应用。

## 使用场景

- **创建配置化的函数变体**：预先填充部分参数，生成专用函数
- **函数组合**：与 `pipe` 配合，创建可复用的数据处理流程
- **延迟执行**：控制函数何时真正执行

## 核心优势

### 占位符支持
- **灵活的参数填充**：使用 `__` 占位符跳过某些参数，后续再补充
- **非顺序传参**：不必按顺序传递参数，提高代码灵活性

### 精确的类型控制
- **类型安全**：TypeScript 会在编译期验证参数类型
- **智能提示**：每一步调用都能获得准确的类型提示和自动补全
- **早期错误检测**：类型错误在调用时就会报错，而不是在使用返回值时才报错

### 显式控制元数
- **自定义参数数量**：通过 `length` 参数显式指定需要收集多少个参数才执行原函数
- **处理默认参数**：适用于带有默认值的函数，避免过早执行

## API

```typescript
// 创建柯里化函数
function curry<F extends AnyFunction, N extends number>(
  fn: ValidCurryFn<F>,
  length: ValidLengthForFn<F, N>
): Curry<F, N> & CurryBrand;

// 占位符符号
const __: unique symbol;
type __ = typeof __;
```

### 参数

| 参数     | 类型     | 说明                                                 |
| -------- | -------- | ---------------------------------------------------- |
| `fn`     | `F`      | 要柯里化的原函数。必须至少有 2 个参数。不能是已柯里化的函数。不能包含剩余参数。 |
| `length` | `N`      | 需要收集的参数数量（正整数字面量），达到此数量后执行原函数。必须小于等于函数参数数量。 |

### 返回值

- 如果提供的参数数量（不含占位符）达到 `length`，返回原函数的执行结果
- 否则返回一个新的柯里化函数，等待更多参数

### 类型约束

以下情况会被类型系统禁止，在调用时就会报错：

- **单参数函数**：对只有 1 个参数的函数进行柯里化没有意义
- **零参数函数**：不能对无参数函数进行柯里化
- **Length = 1**：指定长度为 1 是不允许的
- **已柯里化的函数**：不能对已经柯里化的函数再次柯里化
- **Length > 参数数量**：指定的长度不能超过函数的参数数量
- **非字面量 length**：length 必须是正整数字面量，不能是 `number` 类型的变量
- **剩余参数**：带有剩余参数（`...args`）的函数不能被柯里化

## 使用示例

### 基础用法

```typescript
const add = (a: number, b: number, c: number) => a + b + c;

// 创建柯里化版本，指定需要 3 个参数
const curriedAdd = curry(add, 3);

// 一次性传入所有参数
console.log(curriedAdd(1, 2, 3));  // 6

// 分步调用
console.log(curriedAdd(1)(2)(3));  // 6

// 混合调用
console.log(curriedAdd(1, 2)(3));  // 6
console.log(curriedAdd(1)(2, 3));  // 6
```

### 使用占位符

```typescript
const formatMessage = (prefix: string, message: string, suffix: string) => 
  `${prefix}: ${message} ${suffix}`;

const curriedFormat = curry(formatMessage, 3);

// 使用占位符跳过参数
const withPrefix = curriedFormat('INFO', __);
console.log(withPrefix('Hello')('!'));  // "INFO: Hello !"

// 先填后面的参数
const withSuffix = curriedFormat(__, __, '!');
console.log(withSuffix('ERROR')('Failed'));  // "ERROR: Failed !"

// 多个占位符
const fillMiddle = curriedFormat('DEBUG', __, '.');
console.log(fillMiddle('Running'));  // "DEBUG: Running ."
```

### 创建专用函数

```typescript
const calculate = (base: number, rate: number, discount: number) => 
  base * rate * (1 - discount);

const curriedCalc = curry(calculate, 3);

// 创建特定配置的函数
const standardRate = curriedCalc(__, 1.2);
const vipDiscount = standardRate(__, 0.2);

console.log(vipDiscount(100));  // 96 (100 * 1.2 * 0.8)

// 另一种配置
const premiumRate = curriedCalc(__, 1.5, 0);
console.log(premiumRate(100));  // 150 (100 * 1.5 * 1)
```

### 与 pipe 配合使用

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

### 处理异步函数

```typescript
const fetchWithConfig = async (url: string, method: string, body: object) => {
  // 模拟 API 调用
  return {url, method, body};
};

const curriedFetch = curry(fetchWithConfig, 3);

// 创建预配置的 API 客户端
const apiClient = curriedFetch('https://api.example.com');
const postToApi = apiClient('POST');

// 最终调用
const result = await postToApi({name: 'Alice'});
console.log(result);
// { url: 'https://api.example.com', method: 'POST', body: { name: 'Alice' } }
```

### 处理带默认参数的函数

```typescript
function withDefaults(a: number, b: number = 10, c: number = 20) {
  return a + b + c;
}

// 只要求 1 个参数
const curried1 = curry(withDefaults, 1);
console.log(curried1(5));  // 35 (5 + 10 + 20)

// 要求 3 个参数
const curried3 = curry(withDefaults, 3);
console.log(curried3(5)(6)(7));  // 18 (5 + 6 + 7)
console.log(curried3(5, 6, 7));  // 18

// 可选参数可以传 undefined 来使用默认值
const curried2 = curry(withDefaults, 2);
console.log(curried2(5, undefined));  // 35 (5 + 10 + 20)，b 使用默认值
```

## 注意事项

1. **length 参数必填**：必须显式指定需要收集的参数数量
   ```typescript
   // 错误：length 必须是正整数字面量
   curry(add, 0);  // 类型错误
   curry(add, -1); // 类型错误
   curry(add, 1);  // 类型错误：length 必须 >= 2
   ```

2. **占位符替换规则**：
   - 新传入的参数优先填充已有的占位符
   - 剩余的参数追加到参数列表末尾
   - 新的占位符也会追加到参数列表

3. **类型安全**：
   - 空参数调用会被类型系统阻止
   - 类型不匹配的参数会在编译期报错
   - 错误在调用位置就会报告（逆变位检测）

4. **执行时机**：
   - 当 `实参数量 - 占位符数量 >= length` 时执行原函数
   - 占位符会被替换为 `undefined` 后传入原函数

5. **类型系统限制**：
   - **可变参数函数**：不能对带有剩余参数（`...args`）的函数进行柯里化
     ```typescript
     const sumAll = (...args: number[]) => args.reduce((a, b) => a + b, 0);
     // curry(sumAll, 3) 会产生类型错误
     ```
   
   - **length 必须是字面量**：不能使用类型为 `number` 的变量
     ```typescript
     const n = 3;  // 类型为 number
     // curry(add, n) 会产生类型错误
     
     curry(add, 3);  // 正确：使用数字字面量
     ```
   
   - **零参数函数**：对无参数函数进行柯里化没有意义
     ```typescript
     const noArgs = () => 42;
     // curry(noArgs, 0) 会产生类型错误
     ```
   
   - **重复柯里化**：不能对已经柯里化的函数再次柯里化
     ```typescript
     const curried = curry(add, 3);
     // curry(curried, 2) 会产生类型错误
     ```

6. **this 上下文**：
   - 柯里化会保留 `this` 上下文绑定
