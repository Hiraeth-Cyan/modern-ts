# Object Base

对象操作的基础工具函数，提供键值映射、对象合并、属性筛选等功能

## 使用场景

- **数据转换**：API 响应数据的键名转换、值格式化
- **对象处理**：属性筛选、键值反转、嵌对象扁平化
- **配置合并**：深度合并多个配置对象

## API

### mapKeys

转换对象的键名

```typescript
function mapKeys<T extends Record<string, unknown>>(
  obj: T,
  fn: (value: T[keyof T], key: keyof T) => string
): Record<string, T[keyof T]>;
```

### mapValues

转换对象的值

```typescript
function mapValues<T extends Record<string, unknown>, V>(
  obj: T,
  fn: (value: T[keyof T], key: keyof T) => V
): Record<keyof T, V>;
```

### invert

交换对象的键和值

```typescript
function invert<T extends Record<string, string | number>>(
  obj: T
): Record<string, keyof T>;
```

### pick

选取指定键创建新对象

```typescript
function pick<T extends object, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K>;
```

### pickBy

根据条件选取属性

```typescript
function pickBy<T extends Record<PropertyKey, unknown>>(
  obj: T,
  predicate: (value: T[keyof T], key: keyof T) => boolean
): Partial<T>;
```

### omit

排除指定键创建新对象

```typescript
function omit<T extends object, K extends keyof T>(
  obj: T,
  keys: K[]
): Omit<T, K>;
```

### omitBy

根据条件排除属性

```typescript
function omitBy<T extends Record<PropertyKey, unknown>>(
  obj: T,
  predicate: (value: T[keyof T], key: keyof T) => boolean
): Partial<T>;
```

### findKey

查找满足条件的第一个键

```typescript
function findKey<T extends object>(
  obj: T,
  fn: (value: T[keyof T], key: keyof T) => boolean
): keyof T | undefined;
```

### merge

深度合并多个对象

```typescript
function merge<T extends Record<string, unknown>>(
  target: T,
  ...sources: Record<string, unknown>[]
): T;
```

### mergeWith

使用自定义函数深度合并

```typescript
function mergeWith<T extends Record<string, unknown>>(
  target: T,
  customizer: MergeCustomizer,
  ...sources: Record<string, unknown>[]
): T;
```

### flattenObject

扁平化嵌套对象

```typescript
function flattenObject(
  obj: Record<string, unknown>,
  separator?: string
): Record<string, unknown>;
```

### toCamelCaseKeys

递归将键名转为 camelCase

```typescript
function toCamelCaseKeys<T = unknown>(obj: unknown): T;
```

### toSnakeCaseKeys

递归将键名转为 snake_case

```typescript
function toSnakeCaseKeys<T = unknown>(obj: unknown): T;
```

### 常量

| 常量 | 说明 |
|------|------|
| `MERGE_SKIP` | 合并时跳过当前属性 |
| `MERGE_DEFAULT` | 合并时使用默认逻辑 |

## 使用示例

### mapKeys / mapValues

```typescript
const user = { first_name: 'John', last_name: 'Doe', age: 30 };

// 转换键名
const camelCaseUser = mapKeys(user, (v, k) => camelCase(k as string));
// { firstName: 'John', lastName: 'Doe', age: 30 }

// 转换值
const stringified = mapValues(user, (v) => String(v));
// { first_name: 'John', last_name: 'Doe', age: '30' }
```

### invert

```typescript
const status = { pending: 0, approved: 1, rejected: 2 };

const statusByCode = invert(status);
// { '0': 'pending', '1': 'approved', '2': 'rejected' }
```

### pick / omit

```typescript
const user = { id: 1, name: 'John', password: 'secret', email: 'john@example.com' };

// 选取指定属性
const publicUser = pick(user, ['id', 'name', 'email']);
// { id: 1, name: 'John', email: 'john@example.com' }

// 排除敏感属性
const safeUser = omit(user, ['password']);
// { id: 1, name: 'John', email: 'john@example.com' }
```

### pickBy / omitBy

```typescript
const config = { debug: true, port: 3000, host: 'localhost', secret: 'key' };

// 选取字符串类型的值
const stringConfig = pickBy(config, (v) => typeof v === 'string');
// { host: 'localhost', secret: 'key' }

// 排除 null 和 undefined
const defined = omitBy(config, (v) => v == null);
```

### findKey

```typescript
const scores = { alice: 85, bob: 92, charlie: 78 };

const highScorer = findKey(scores, (v) => v > 90);
// 'bob'
```

### merge / mergeWith

```typescript
const defaults = { theme: 'light', fontSize: 14, showSidebar: true };
const userPrefs = { theme: 'dark', fontSize: 16 };

// 深度合并
const settings = merge(defaults, userPrefs);
// { theme: 'dark', fontSize: 16, showSidebar: true }

// 使用自定义合并逻辑
const customMerge = mergeWith(
  { items: [1, 2] },
  (target, source) => {
    if (Array.isArray(target) && Array.isArray(source)) {
      return [...target, ...source]; // 合并数组而不是覆盖
    }
    return MERGE_DEFAULT;
  },
  { items: [3, 4] }
);
// { items: [1, 2, 3, 4] }
```

### flattenObject

```typescript
const nested = {
  user: {
    name: 'John',
    address: {
      city: 'New York',
      zip: '10001'
    }
  }
};

const flat = flattenObject(nested);
// { 'user.name': 'John', 'user.address.city': 'New York', 'user.address.zip': '10001' }

// 自定义分隔符
const flatUnderscore = flattenObject(nested, '_');
// { 'user_name': 'John', 'user_address_city': 'New York', ... }
```

### toCamelCaseKeys / toSnakeCaseKeys

```typescript
const snakeData = {
  user_name: 'John',
  user_info: {
    phone_number: '123-456',
    email_address: 'john@example.com'
  }
};

const camelData = toCamelCaseKeys(snakeData);
// {
//   userName: 'John',
//   userInfo: {
//     phoneNumber: '123-456',
//     emailAddress: 'john@example.com'
//   }
// }

// 转回 snake_case
const backToSnake = toSnakeCaseKeys(camelData);
```

## 注意事项

1. **不可变性**：所有函数都返回新对象，不会修改原对象
2. **类型安全**：使用 TypeScript 泛型保持类型推导
3. **键名冲突**：`invert` 和 `mapKeys` 中重复的键名会被后面的值覆盖
4. **深度合并**：`merge` 只合并普通对象，其他类型（数组、Date 等）会被直接覆盖
