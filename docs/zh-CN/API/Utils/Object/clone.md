# Clone

对象克隆工具函数，提供浅拷贝和深拷贝功能，支持自定义克隆逻辑

## 核心优势

### 大深度支持
- **数组模拟栈**：使用迭代算法替代递归，避免调用栈溢出
- **100000+ 层深度**：支持克隆深度嵌套的对象结构，远超普通递归实现的限制

### 完善的类型支持
- **特殊类型处理**：正确克隆 Date、RegExp、Error、Map、Set、ArrayBuffer、TypedArray 等
- **循环引用检测**：使用 WeakMap 自动处理对象间的循环引用

## 使用场景

- **数据隔离**：创建独立的数据副本，避免引用共享导致的副作用
- **状态管理**：在 Redux、Vuex 等状态管理中保持状态不可变性
- **复杂对象处理**：克隆包含 Date、RegExp、Map、Set 等特殊类型的对象
- **超深结构克隆**：处理深度嵌套的数据结构（如深层级 JSON、树形数据）

## API

### clone

浅拷贝一个值

```typescript
function clone<T>(value: T): T;
```

### cloneDeep

深拷贝一个值

```typescript
function cloneDeep<T>(value: T, depth?: number): T;
```

### cloneDeepWith

使用自定义函数进行深拷贝

```typescript
function cloneDeepWith<T>(
  value: T,
  customizer: CloneCustomizer,
  depth?: number
): T;
```

### CloneCustomizer

自定义克隆函数的类型

```typescript
type CloneCustomizer = (
  value: unknown,
  key: PropertyKey | undefined,
  object: object | undefined,
  stack: WeakMap<object, unknown>
) => unknown;
```

### 常量

| 常量            | 说明                           |
| --------------- | ------------------------------ |
| `CLONE_FILTER`  | 跳过当前属性（从结果中排除）   |
| `CLONE_DEFAULT` | 使用默认克隆逻辑               |
| `CLONE_HOLE`    | 在数组中保留空位（empty slot） |

## 参数说明

### cloneDeep / cloneDeepWith 参数

| 参数         | 类型              | 默认值     | 说明                               |
| ------------ | ----------------- | ---------- | ---------------------------------- |
| `value`      | `T`               | -          | 要克隆的值                         |
| `customizer` | `CloneCustomizer` | -          | 自定义克隆函数（仅 cloneDeepWith） |
| `depth`      | `number`          | `Infinity` | 最大克隆深度                       |

### CloneCustomizer 参数

| 参数     | 类型                       | 说明                         |
| -------- | -------------------------- | ---------------------------- |
| `value`  | `unknown`                  | 当前要克隆的值               |
| `key`    | `PropertyKey \| undefined` | 属性键（根节点为 undefined） |
| `object` | `object \| undefined`      | 父对象（根节点为 undefined） |
| `stack`  | `WeakMap<object, unknown>` | 用于循环引用检测的栈         |

## 使用示例

### 浅拷贝

```typescript
const arr = [1, 2, { a: 3 }];
const clonedArr = clone(arr);

// 第一层是独立的
clonedArr[0] = 99;
console.log(arr[0]); // 1（不变）

// 嵌套对象仍是引用
clonedArr[2].a = 99;
console.log(arr[2].a); // 99（被修改了！）

const obj = { x: 1, y: { z: 2 } };
const clonedObj = clone(obj);
```

### 深拷贝

```typescript
const nested = {
  user: {
    name: 'John',
    hobbies: ['reading', 'coding'],
    metadata: new Map([['key', 'value']])
  }
};

const deep = cloneDeep(nested);

// 完全独立
deep.user.name = 'Jane';
deep.user.hobbies.push('gaming');
console.log(nested.user.name); // 'John'（不变）
console.log(nested.user.hobbies); // ['reading', 'coding']（不变）
```

### 限制克隆深度

```typescript
const deepObj = {
  level1: {
    level2: {
      level3: {
        level4: { value: 'deep' }
      }
    }
  }
};

// 只克隆 2 层
const shallow = cloneDeep(deepObj, 2);

// level3 及其后的内容保持引用
shallow.level1.level2.level3.level4.value = 'modified';
console.log(deepObj.level1.level2.level3.level4.value); // 'modified'
```

### 使用自定义克隆函数

```typescript
const data = {
  password: 'secret123',
  token: 'abc-def',
  user: { name: 'John', age: 30 }
};

// 过滤敏感字段
const safeClone = cloneDeepWith(data, (value, key) => {
  if (key === 'password' || key === 'token') {
    return CLONE_FILTER; // 排除这些字段
  }
  return CLONE_DEFAULT; // 其他使用默认逻辑
});

// { user: { name: 'John', age: 30 } }
```

### 处理数组空位

```typescript
const sparse = [1, , 3]; // 索引 1 是空位

const cloned = cloneDeepWith(sparse, (value, key, obj) => {
  // 检查是否是数组的空位
  if (Array.isArray(obj) && !(key in obj)) {
    return CLONE_HOLE; // 保留空位
  }
  return CLONE_DEFAULT;
});

console.log(cloned); // [1, empty, 3]
console.log(1 in cloned); // false（仍然是空位）
```

### 特殊类型克隆

```typescript
const special = {
  date: new Date('2024-01-01'),
  regex: /test/gi,
  error: new Error('Something wrong'),
  map: new Map([['key', 'value']]),
  set: new Set([1, 2, 3]),
  buffer: new ArrayBuffer(8)
};

const cloned = cloneDeep(special);

// 所有特殊类型都被正确克隆
console.log(cloned.date.getTime()); // 1704067200000
console.log(cloned.regex.test('TEST')); // true
console.log(cloned.map.get('key')); // 'value'
console.log(cloned.set.has(2)); // true
```

### 循环引用处理

```typescript
const obj: any = { name: 'parent' };
obj.self = obj; // 循环引用

const cloned = cloneDeep(obj);

// 循环引用被正确处理
console.log(cloned.self === cloned); // true
console.log(cloned.self.name); // 'parent'
```

## 注意事项

1. **浅拷贝限制**：`clone` 只复制第一层，嵌套对象仍是引用共享
2. **函数和 Promise**：函数和 Promise 不会被克隆，直接返回原值
3. **WeakMap/WeakSet**：由于不可遍历，会被克隆为空对象
4. **原型链**：克隆结果会保留原对象的原型链
5. **性能考虑**：深拷贝大型对象时建议设置 `depth` 限制深度
