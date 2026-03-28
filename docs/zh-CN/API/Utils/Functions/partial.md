# partial

`partial(fn, ...fixedArgs)` 创建一个预设部分参数的函数，预设的参数会前置传递给原函数。

## 使用场景

- **预配置函数**：通过预填充部分参数来创建专用版本的函数
- **函数组合**：通过固定某些参数来准备用于管道的函数
- **回调适配**：调整函数以匹配预期的回调签名

## 核心优势

### 类型安全
- **完整的类型推导**：TypeScript 正确推导剩余参数的类型
- **参数顺序验证**：确保预设参数匹配函数参数列表的开头

### 灵活应用
- **任意数量的预设参数**：可以从开头固定一个或多个参数
- **保留 this 上下文**：`this` 上下文被正确保留

## API

```typescript
function partial<
  This,
  Fixed extends readonly [unknown, ...unknown[]],
  Rest extends readonly unknown[],
  Ret,
>(
  fn: (this: This, ...args: [...Fixed, ...Rest]) => Ret,
  ...fixedArgs: Fixed
): (this: This, ...rest: Rest) => Ret;
```

### 参数

| 参数           | 类型    | 说明           |
| -------------- | ------- | -------------- |
| `fn`           | `Function` | 要预设参数的原函数 |
| `...fixedArgs` | `Fixed` | 要前置的预设参数。必须至少预设一个参数。 |

### 返回值

一个接受剩余参数的新函数，调用时会将预设参数前置后调用原函数。

## 使用示例

### 基础用法

```typescript
const greet = (greeting: string, name: string, punctuation: string) =>
  `${greeting}, ${name}${punctuation}`;

// 固定第一个参数
const sayHello = partial(greet, 'Hello');
sayHello('World', '!');  // 'Hello, World!'

// 固定前两个参数
const sayHelloToAlice = partial(greet, 'Hello', 'Alice');
sayHelloToAlice('!');  // 'Hello, Alice!'
```

### 创建专用函数

```typescript
const calculate = (operation: string, a: number, b: number) => {
  switch (operation) {
    case 'add': return a + b;
    case 'subtract': return a - b;
    case 'multiply': return a * b;
    default: throw new Error('Unknown operation');
  }
};

// 创建专用函数
const add = partial(calculate, 'add');
const multiply = partial(calculate, 'multiply');

add(5, 3);        // 8
multiply(5, 3);   // 15
```

### 与数组方法配合使用

```typescript
const multiply = (factor: number, value: number) => value * factor;

// 创建一个"翻倍"函数
const double = partial(multiply, 2);

[1, 2, 3, 4].map(double);  // [2, 4, 6, 8]
```

### 保留 this 上下文

```typescript
const obj = {
  prefix: 'Hello',
  greet(name: string) {
    return `${this.prefix}, ${name}!`;
  }
};

const boundGreet = partial(obj.greet.bind(obj));
// 或者使用 call/apply 调用 partial 函数
```

## 注意事项

1. **至少预设一个参数**：必须至少预设一个参数
   ```typescript
   partial(fn);  // 类型错误：必须提供至少一个预设参数
   ```

2. **顺序很重要**：预设参数按照提供的顺序前置，匹配函数的参数顺序
   ```typescript
   const fn = (a: number, b: string, c: boolean) => ...;
   
   // 正确：固定 a=1
   partial(fn, 1);
   
   // 错误：1 不能赋值给 string
   // partial(fn, 'hello');
   ```

3. **类型推导**：TypeScript 会根据预设参数推导剩余参数的类型

4. **this 上下文**：`this` 上下文被保留。如果需要固定 `this` 值，请使用 `bind`
