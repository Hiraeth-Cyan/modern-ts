# partialRight

`partialRight(fn, ...fixedArgs)` 创建一个预设部分参数的函数，预设的参数会后置（从右侧）传递给原函数。

## 使用场景

- **预配置尾部参数**：通过从右侧预填充参数来创建专用版本的函数
- **函数组合**：通过固定尾部参数来准备用于管道的函数
- **回调适配**：当尾部参数已知时，调整函数以匹配预期的回调签名

## 核心优势

### 类型安全
- **完整的类型推导**：TypeScript 正确推导剩余参数的类型
- **参数顺序验证**：确保预设参数匹配函数参数列表的末尾
- **剩余参数检测**：禁止带有剩余参数的函数（因为末尾的剩余参数长度无限，无法从右侧固定）

### 参数名保留
- **保留命名参数**：返回的函数保留原始参数名，提供更好的 IDE 支持

### 可选参数支持
- **处理可选参数**：正确处理带有可选参数的函数

## API

```typescript
function partialRight<
  T extends AnyFunction,
  Fixed extends readonly [unknown, ...unknown[]],
>(
  fn: AtLeastOneParams<T>,
  ...fixedArgs: ValidFixedForRight<Parameters<T>, Fixed>
): (
  this: ThisParameterType<T>,
  ...rest: ExtractRest<Parameters<T>, Fixed>
) => ReturnType<T>;
```

### 参数

| 参数           | 类型    | 说明           |
| -------------- | ------- | -------------- |
| `fn`           | `T`     | 要预设参数的原函数。必须至少有一个参数。不能包含剩余参数。 |
| `...fixedArgs` | `Fixed` | 要后置的预设参数。必须至少预设一个参数。按照声明顺序传入。 |

### 返回值

一个接受剩余参数的新函数，调用时会将预设参数后置后调用原函数。

### 类型约束

以下情况会被类型系统禁止：

- **零参数函数**：函数必须至少有一个参数
- **剩余参数**：带有剩余参数的函数不能使用 partialRight（末尾的剩余参数长度无限）
- **类型不匹配**：预设参数必须匹配尾部参数的类型

## 使用示例

### 基础用法

```typescript
const format = (name: string, action: string, target: string) =>
  `${name} ${action} ${target}`;

// 固定最后两个参数（按照声明顺序传入）
const ranToStore = partialRight(format, 'ran to', 'the store');
ranToStore('Alice');  // 'Alice ran to the store'

// 固定最后一个参数
const calculate = (a: number, b: number, c: number, d: number) => a + b + c + d;
const addSeven = partialRight(calculate, 3, 4);
addSeven(1, 2);  // 10 (1 + 2 + 3 + 4)
```

### 创建事件处理器

```typescript
const logEvent = (eventType: string, timestamp: number, message: string) =>
  `[${timestamp}] ${eventType}: ${message}`;

// 预配置事件类型和时间戳格式化器
const logError = partialRight(logEvent, 'ERROR', Date.now());
logError('Connection failed');  // '[1234567890] ERROR: Connection failed'
```

### 处理可选参数

```typescript
const fn = (a: string, b?: number, c?: boolean) => [a, b, c];

// 固定可选参数
const fixed = partialRight(fn, 42, true);
fixed('hello');  // ['hello', 42, true]
```

## 注意事项

1. **按照声明顺序传入参数**：按照参数在函数签名中出现的顺序传入预设参数，而不是倒序
   ```typescript
   const fn = (a: number, b: string, c: boolean) => ...;
   
   // 正确：固定 b='hello', c=true
   partialRight(fn, 'hello', true);
   
   // 错误：'hello' 不能赋值给 boolean
   // partialRight(fn, true, 'hello');
   ```

2. **不支持剩余参数**：带有剩余参数的函数不能使用 partialRight
   ```typescript
   const fn = (a: number, ...rest: string[]) => ...;
   // partialRight(fn, 'x');  // 类型错误：不支持剩余参数
   ```

3. **至少预设一个参数**：必须至少预设一个参数
   ```typescript
   partialRight(fn);  // 类型错误：必须提供至少一个预设参数
   ```

4. **this 上下文**：`this` 上下文被保留

5. **参数名**：返回的函数保留原始参数名，提供更好的 IDE 支持
