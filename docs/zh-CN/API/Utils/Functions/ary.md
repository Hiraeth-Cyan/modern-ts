# ary / unary / binary / trinary

`ary(fn, n)` 创建一个只接受前 `n` 个参数的函数，超出 `n` 的参数会被丢弃。`unary`、`binary` 和 `trinary` 分别是 `ary(fn, 1)`、`ary(fn, 2)` 和 `ary(fn, 3)` 的便捷包装。

## 使用场景

- **修复回调函数**：确保回调函数接收正确数量的参数（例如修复 `Array.map` 中的 `parseInt`）
- **函数组合**：在组合管道时控制函数的元数
- **API 适配**：调整函数以匹配预期的回调签名

## 核心优势

### 参数名保留
- **保留命名参数**：返回的函数保留原始参数名，提供更好的 IDE 支持

### 可选参数支持
- **处理可选参数**：正确处理带有可选参数的函数

### 剩余参数支持
- **支持剩余参数**：可以限制传递给带有剩余参数的函数的参数数量

### 类型安全
- **编译期验证**：TypeScript 在编译期验证元数
- **字面量数字约束**：`n` 参数必须是字面量数字，不能是变量

## API

```typescript
// 限制函数只接受 n 个参数
function ary<F extends AnyFunction, N extends number>(
  fn: ValidAryFn<F>,
  n: ValidAryN<F, N>
): Ary<F, N>;

// 便捷包装函数
function unary<F extends AnyFunction>(fn: ValidAryFn<F>): Ary<F, 1>;
function binary<F extends AnyFunction>(fn: ValidAryFnOf<F, 2>): Ary<F, 2>;
function trinary<F extends AnyFunction>(fn: ValidAryFnOf<F, 3>): Ary<F, 3>;
```

### 参数

| 参数 | 类型 | 说明 |
| ---- | ---- | ---- |
| `fn` | `F` | 要限制参数的原函数。必须至少有一个参数。 |
| `n` | `N` | 要接受的参数数量。必须是非负整数字面量。对于固定长度函数，必须小于等于参数数量。 |

### 返回值

一个只接受前 `n` 个参数并将其传递给原函数的新函数。

### 类型约束

以下情况会被类型系统禁止：

- **零参数函数**：函数必须至少有一个参数
- **非字面量 n**：`n` 必须是字面量数字，不能是 `number` 类型的变量
- **非整数 n**：`n` 必须是非负整数字面量
- **n > 参数数量**：对于固定长度函数，`n` 不能超过参数数量

## 使用示例

### 基础用法

```typescript
const fn = (a: string, b: number, c: boolean) => [a, b, c];

// 限制为 2 个参数
const limited = ary(fn, 2);
limited('hello', 42);  // ['hello', 42, undefined]

// 多余的参数被忽略
limited('hello', 42, true, 'extra');  // ['hello', 42, undefined]
```

### 修复 map 中的 parseInt

`unary` 的经典用例是修复 `parseInt`，它接受第二个参数作为进制：

```typescript
// 不使用 unary - 由于索引被作为进制传入，结果错误
['1', '2', '3'].map(parseInt);  // [1, NaN, NaN]

// 使用 unary - 正确结果
['1', '2', '3'].map(unary(parseInt));  // [1, 2, 3]

// 等价于
['1', '2', '3'].map(ary(parseInt, 1));  // [1, 2, 3]
```

### 使用 binary 和 trinary

```typescript
const add = (a: number, b: number, c: number, d: number) => a + b + c + d;

// 只接受前 2 个参数
const add2 = binary(add);
add2(1, 2);        // 3（c 和 d 是 undefined）

// 只接受前 3 个参数
const add3 = trinary(add);
add3(1, 2, 3);     // 6（d 是 undefined）
```

### 处理可选参数

```typescript
const fn = (a: string, b?: number, c?: boolean) => [a, b, c];

// 限制为 2 个参数（保留可选性）
const limited = ary(fn, 2);
limited('hello');        // ['hello', undefined, undefined]
limited('hello', 42);    // ['hello', 42, undefined]
```

### 处理剩余参数

```typescript
const fn = (a: string, ...rest: number[]) => [a, rest];

// 限制为 2 个参数（1 个固定 + 1 个来自 rest）
const limited = ary(fn, 2);
limited('hello', 1, 2, 3);  // ['hello', [1]]（只保留第一个 rest 参数）
```

### 链式调用 ary

```typescript
const fn = (a: string, b: number, c: boolean, d: string) => [a, b, c, d];

// 可以组合 ary 调用
const composed = ary(ary(fn, 3), 1);
composed('hello');  // ['hello', undefined, undefined, undefined]
```

## 注意事项

1. **必须使用字面量数字**：`n` 参数必须是字面量数字，不能是变量
   ```typescript
   const count = 2;
   // ary(fn, count);  // 类型错误：count 不是字面量
   
   ary(fn, 2);  // 正确
   ```

2. **参数名保留**：返回的函数保留原始参数名，提供更好的 IDE 支持

3. **可选参数**：当限制到包含可选参数的位置时，它们在结果函数中仍然是可选的

4. **运行时验证**：虽然类型系统在编译期强制执行约束，但运行时也会验证 `n` 是非负整数

5. **this 上下文**：调用受限函数时会保留 `this` 上下文
