# flip / reverseArgs

`flip(fn)` 创建一个新函数，交换原函数的前两个参数。`reverseArgs(fn)` 创建一个新函数，反转所有参数的顺序。

## 使用场景

- **参数重排序**：调整函数以匹配预期的回调签名
- **函数组合**：改变参数顺序以获得更好的管道兼容性
- **数学运算**：交换减法、除法等运算的操作数

## 核心优势

### 类型安全
- **编译期验证**：TypeScript 验证函数至少有 2 个参数且没有剩余参数
- **参数名保留**：返回的函数保留有意义的参数名

### 可选参数支持
- **处理可选参数**：正确处理第一个或第二个参数为可选的函数

## API

```typescript
// 交换前两个参数
function flip<F>(fn: ValidFlipFn<F>): Flip<F>;

// 反转所有参数
function reverseArgs<F>(fn: ValidFlipFn<F>): ReverseArgs<F>;
```

### 参数

| 参数 | 类型 | 说明 |
| ---- | ---- | ---- |
| `fn` | `F` | 要翻转参数的函数。必须至少有 2 个参数。不能包含剩余参数。 |

### 返回值

- `flip`：前两个参数被交换的新函数
- `reverseArgs`：所有参数顺序被反转的新函数

### 类型约束

以下情况会被类型系统禁止：

- **零或一个参数**：函数必须至少有 2 个参数
- **剩余参数**：带有剩余参数的函数不能被翻转（翻转剩余参数语义不明）

## 使用示例

### flip - 基础用法

```typescript
const subtract = (a: number, b: number) => a - b;
const flipped = flip(subtract);

subtract(5, 3);   // 2
flipped(5, 3);    // -2（等价于 subtract(3, 5)）
```

### flip 处理可选参数

```typescript
const fn = (a: string, b?: number, c?: boolean) => [a, b, c];
const flipped = flip(fn);

// 原函数：a 是必需的，b 是可选的
// 翻转后：b 在前（仍然是可选的），a 在后
flipped(42, 'hello');  // ['hello', 42, undefined]
flipped(undefined, 'hello', true);  // ['hello', undefined, true]
```

### flip 与 pipe 配合使用

```typescript
const divide = (a: number, b: number) => a / b;
const flippedDivide = flip(divide);

// 创建一个"除以 2"的函数
const halve = (x: number) => flippedDivide(x, 2);

[10, 20, 30].map(halve);  // [5, 10, 15]
```

### reverseArgs - 基础用法

```typescript
const fn = (a: string, b: number, c: boolean) => `${a}-${b}-${c}`;
const reversed = reverseArgs(fn);

fn('hello', 42, true);        // "hello-42-true"
reversed(true, 42, 'hello');  // "hello-42-true"
```

### reverseArgs 处理更多参数

```typescript
const format = (day: number, month: string, year: number, format: string) =>
  `${day} ${month} ${year} (${format})`;

const reversed = reverseArgs(format);

// 原始顺序：day, month, year, format
// 反转顺序：format, year, month, day
reversed('ISO', 2024, 'Jan', 15);  // "15 Jan 2024 (ISO)"
```

## 注意事项

1. **至少 2 个参数**：函数必须至少有 2 个参数
   ```typescript
   const unary = (x: number) => x;
   // flip(unary);  // 类型错误：函数必须至少有 2 个参数
   ```

2. **不支持剩余参数**：带有剩余参数的函数不能被翻转
   ```typescript
   const fn = (a: number, b: number, ...rest: string[]) => ...;
   // flip(fn);  // 类型错误：不支持剩余参数
   ```

3. **参数名**：返回的函数保留参数名。对于 `flip`，前两个参数名会被交换。

4. **this 上下文**：`this` 上下文被保留

5. **可选参数**：两个函数都正确处理可选参数，在结果中保留其可选性
