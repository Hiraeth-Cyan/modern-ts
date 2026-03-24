# Map

Map 工具函数集合，提供类似数组的高阶函数操作（filter、map、reduce 等），以及键值选择和合并功能

---

## 使用场景

- **Map 转换**：过滤、映射键值、归约计算
- **键值选择**：选取或排除指定键
- **分组统计**：按条件对 Map 条目进行分组统计
- **原地修改**：直接修改原 Map 的高效操作
- **冲突处理**：合并 Map 时自定义冲突解决策略

---

## API

### filter

创建一个新 Map，只包含满足谓词条件的条目

```typescript
function filter<K, V, S extends V>(
  map: Map<K, V>,
  predicate: (value: V, key: K) => value is S,
): Map<K, S>;
function filter<K, V>(
  map: Map<K, V>,
  predicate: (value: V, key: K) => boolean,
): Map<K, V>;
```

| 参数        | 类型                          | 描述           |
| ----------- | ----------------------------- | -------------- |
| `map`       | `Map<K, V>`                   | 源 Map         |
| `predicate` | `(value: V, key: K) => boolean` | 过滤条件函数   |

**返回值：** 过滤后的新 Map

**示例：**

```typescript
const m = new Map([['a', 1], ['b', 2], ['c', 3]]);
const filtered = filter(m, v => v > 1);
// Map([['b', 2], ['c', 3]])

// 使用类型守卫进行类型收窄
const mixed = new Map<string, unknown>([['a', 1], ['b', 'hello']]);
const strings = filter(mixed, (v): v is string => typeof v === 'string');
// Map<string, string>([['b', 'hello']])
```

---

### mapValues

创建一个新 Map，保持键不变，值经过转换

```typescript
function mapValues<K, V, T>(
  map: Map<K, V>,
  iteratee: (value: V, key: K) => T,
): Map<K, T>;
```

| 参数       | 类型                      | 描述           |
| ---------- | ------------------------- | -------------- |
| `map`      | `Map<K, V>`               | 源 Map         |
| `iteratee` | `(value: V, key: K) => T` | 值转换函数     |

**返回值：** 值转换后的新 Map

**示例：**

```typescript
const m = new Map([['a', 1], ['b', 2], ['c', 3]]);
const doubled = mapValues(m, v => v * 2);
// Map([['a', 2], ['b', 4], ['c', 6]])

// 格式化值
const users = new Map([['u1', { name: 'Alice', age: 25 }]]);
const formatted = mapValues(users, (v, k) => `${v.name} (${k})`);
// Map([['u1', 'Alice (u1)']])
```

---

### mapKeys

创建一个新 Map，保持值不变，键经过转换

```typescript
function mapKeys<K, V, T>(
  map: Map<K, V>,
  iteratee: (value: V, key: K) => T,
): Map<T, V>;
```

| 参数       | 类型                      | 描述           |
| ---------- | ------------------------- | -------------- |
| `map`      | `Map<K, V>`               | 源 Map         |
| `iteratee` | `(value: V, key: K) => T` | 键转换函数     |

**返回值：** 键转换后的新 Map

**示例：**

```typescript
const m = new Map([[1, 'a'], [2, 'b']]);
const withPrefix = mapKeys(m, (v, k) => `key-${k}`);
// Map([['key-1', 'a'], ['key-2', 'b']])

// 重复的转换键会被覆盖
const nums = new Map([[1, 'a'], [2, 'b']]);
const parity = mapKeys(nums, (v, k) => k % 2);
// Map([[1, 'b']]) (key 1 被 key 2 的转换结果覆盖)
```

---

### findKey

查找第一个满足谓词条件的键

```typescript
function findKey<K, V>(
  map: Map<K, V>,
  predicate: (value: V, key: K) => boolean,
): K | undefined;
```

| 参数        | 类型                          | 描述           |
| ----------- | ----------------------------- | -------------- |
| `map`       | `Map<K, V>`                   | 要搜索的 Map   |
| `predicate` | `(value: V, key: K) => boolean` | 查找条件       |

**返回值：** 第一个匹配的键，未找到返回 `undefined`

**示例：**

```typescript
const m = new Map([['a', 1], ['b', 2], ['c', 3]]);
const key = findKey(m, v => v > 1);
// 'b'

const users = new Map([
  ['u1', { name: 'Alice', active: false }],
  ['u2', { name: 'Bob', active: true }]
]);
const activeUser = findKey(users, v => v.active);
// 'u2'
```

---

### hasValue

检查 Map 中是否存在匹配的值

```typescript
function hasValue<K, V>(
  map: Map<K, V>,
  target_value: V,
  comparator?: (a: V, b: V) => boolean,
): boolean;
```

| 参数           | 类型                      | 描述                        |
| -------------- | ------------------------- | --------------------------- |
| `map`          | `Map<K, V>`               | 要搜索的 Map                |
| `target_value` | `V`                       | 要查找的目标值              |
| `comparator`   | `(a: V, b: V) => boolean` | 可选的比较函数，默认使用 `===` |

**返回值：** 找到返回 `true`，否则 `false`

**示例：**

```typescript
const m = new Map([['a', 1], ['b', 2], ['c', 3]]);
hasValue(m, 2);  // true
hasValue(m, 5);  // false

// 使用自定义比较器（对象比较）
const users = new Map([
  ['u1', { id: 1, name: 'Alice' }],
  ['u2', { id: 2, name: 'Bob' }]
]);
hasValue(users, { id: 1, name: 'Alice' }, (a, b) => a.id === b.id);
// true
```

---

### reduce

将 Map 归约为单个值

```typescript
function reduce<K, V, T>(
  map: Map<K, V>,
  iteratee: (accumulator: T, value: V, key: K) => T,
  initial_value: T,
): T;
```

| 参数            | 类型                                    | 描述           |
| --------------- | --------------------------------------- | -------------- |
| `map`           | `Map<K, V>`                             | 源 Map         |
| `iteratee`      | `(accumulator: T, value: V, key: K) => T` | 归约函数       |
| `initial_value` | `T`                                     | 初始值         |

**返回值：** 最终归约结果

**示例：**

```typescript
const m = new Map([['a', 1], ['b', 2], ['c', 3]]);
const sum = reduce(m, (acc, v) => acc + v, 0);
// 6

// 构建新对象
const users = new Map([
  ['u1', { name: 'Alice', score: 80 }],
  ['u2', { name: 'Bob', score: 90 }]
]);
const totalScore = reduce(users, (acc, v) => acc + v.score, 0);
// 170
```

---

### countBy

按分组键统计各组条目数量

```typescript
function countBy<K, V>(
  map: Map<K, V>,
  iteratee: (value: V, key: K) => string | number,
): Record<string | number, number>;
```

| 参数       | 类型                                | 描述           |
| ---------- | ----------------------------------- | -------------- |
| `map`      | `Map<K, V>`                         | 源 Map         |
| `iteratee` | `(value: V, key: K) => string \| number` | 分组键生成函数 |

**返回值：** 对象，键为分组键，值为数量

**示例：**

```typescript
const m = new Map([['a', 1], ['b', 2], ['c', 1], ['d', 2]]);
const counts = countBy(m, v => v);
// { '1': 2, '2': 2 }

const users = new Map([
  ['u1', { role: 'admin' }],
  ['u2', { role: 'user' }],
  ['u3', { role: 'admin' }]
]);
const byRole = countBy(users, v => v.role);
// { admin: 2, user: 1 }
```

---

### groupBy

按分组键将条目分组到 Map 中

```typescript
function groupBy<K, V, T>(
  map: Map<K, V>,
  iteratee: (value: V, key: K) => T,
): Map<T, Array<[K, V]>>;
```

| 参数       | 类型                      | 描述           |
| ---------- | ------------------------- | -------------- |
| `map`      | `Map<K, V>`               | 源 Map         |
| `iteratee` | `(value: V, key: K) => T` | 分组键生成函数 |

**返回值：** Map，键为分组键，值为 `[K, V]` 条目数组

**示例：**

```typescript
const m = new Map([['a', 1], ['b', 2], ['c', 1]]);
const grouped = groupBy(m, v => v);
// Map([
//   [1, [['a', 1], ['c', 1]]],
//   [2, [['b', 2]]]
// ])

const users = new Map([
  ['u1', { name: 'Alice', role: 'admin' }],
  ['u2', { name: 'Bob', role: 'user' }],
  ['u3', { name: 'Carol', role: 'admin' }]
]);
const byRole = groupBy(users, v => v.role);
// Map([
//   ['admin', [['u1', {Alice}], ['u3', {Carol}]]],
//   ['user', [['u2', {Bob}]]]
// ])
```

---

### pick

创建一个新 Map，只包含指定的键

```typescript
function pick<K, V>(map: Map<K, V>, keys: Iterable<K>): Map<K, V>;
```

| 参数   | 类型         | 描述           |
| ------ | ------------ | -------------- |
| `map`  | `Map<K, V>`  | 源 Map         |
| `keys` | `Iterable<K>`| 要选取的键     |

**返回值：** 只包含指定键的新 Map

**示例：**

```typescript
const m = new Map([['a', 1], ['b', 2], ['c', 3], ['d', 4]]);
const picked = pick(m, ['a', 'c']);
// Map([['a', 1], ['c', 3]])

// 不存在的键被忽略
pick(m, ['a', 'x', 'z']);  // Map([['a', 1]])
```

---

### omit

创建一个新 Map，排除指定的键

```typescript
function omit<K, V>(map: Map<K, V>, keys: Iterable<K>): Map<K, V>;
```

| 参数   | 类型         | 描述           |
| ------ | ------------ | -------------- |
| `map`  | `Map<K, V>`  | 源 Map         |
| `keys` | `Iterable<K>`| 要排除的键     |

**返回值：** 排除指定键后的新 Map

**示例：**

```typescript
const m = new Map([['a', 1], ['b', 2], ['c', 3], ['d', 4]]);
const omitted = omit(m, ['b', 'd']);
// Map([['a', 1], ['c', 3]])

// 不存在的键被忽略
omit(m, ['x', 'y']);  // Map 不变
```

---

### filterInPlace

原地过滤 Map，移除不满足条件的条目

```typescript
function filterInPlace<K, V>(
  map: Map<K, V>,
  predicate: (value: V, key: K) => boolean,
): Map<K, V>;
```

| 参数        | 类型                          | 描述           |
| ----------- | ----------------------------- | -------------- |
| `map`       | `Map<K, V>`                   | 要修改的 Map   |
| `predicate` | `(value: V, key: K) => boolean` | 保留条件函数   |

**返回值：** 修改后的原 Map 实例（用于链式调用）

**示例：**

```typescript
const m = new Map([['a', 1], ['b', 2], ['c', 3]]);
filterInPlace(m, v => v > 1);
// m 现在是 Map([['b', 2], ['c', 3]])

// 链式使用
const scores = new Map([['a', 80], ['b', 55], ['c', 90]]);
filterInPlace(scores, v => v >= 60);
// scores 现在是 Map([['a', 80], ['c', 90]])
```

---

### mapValuesInPlace

原地转换 Map 的值

```typescript
function mapValuesInPlace<K, V>(
  map: Map<K, V>,
  iteratee: (value: V, key: K) => V,
): Map<K, V>;
```

| 参数       | 类型                      | 描述           |
| ---------- | ------------------------- | -------------- |
| `map`      | `Map<K, V>`               | 要修改的 Map   |
| `iteratee` | `(value: V, key: K) => V` | 值转换函数     |

**返回值：** 修改后的原 Map 实例

**示例：**

```typescript
const m = new Map([['a', 1], ['b', 2], ['c', 3]]);
mapValuesInPlace(m, v => v * 10);
// m 现在是 Map([['a', 10], ['b', 20], ['c', 30]])

// 增量更新
const counters = new Map([['clicks', 5], ['views', 10]]);
mapValuesInPlace(counters, v => v + 1);
// counters 现在是 Map([['clicks', 6], ['views', 11]])
```

---

### omitInPlace

原地移除 Map 中指定的键

```typescript
function omitInPlace<K, V>(map: Map<K, V>, keys: Iterable<K>): Map<K, V>;
```

| 参数   | 类型         | 描述           |
| ------ | ------------ | -------------- |
| `map`  | `Map<K, V>`  | 要修改的 Map   |
| `keys` | `Iterable<K>`| 要移除的键     |

**返回值：** 修改后的原 Map 实例

**示例：**

```typescript
const m = new Map([['a', 1], ['b', 2], ['c', 3]]);
omitInPlace(m, ['b']);
// m 现在是 Map([['a', 1], ['c', 3]])

// 批量移除
const config = new Map([
  ['debug', true],
  ['secret', 'key123'],
  ['apiUrl', 'https://api.example.com']
]);
omitInPlace(config, ['debug', 'secret']);
// config 现在是 Map([['apiUrl', 'https://api.example.com']])
```

---

### pickInPlace

原地只保留 Map 中指定的键

```typescript
function pickInPlace<K, V>(map: Map<K, V>, keys: Iterable<K>): Map<K, V>;
```

| 参数   | 类型         | 描述           |
| ------ | ------------ | -------------- |
| `map`  | `Map<K, V>`  | 要修改的 Map   |
| `keys` | `Iterable<K>`| 要保留的键     |

**返回值：** 修改后的原 Map 实例

**示例：**

```typescript
const m = new Map([['a', 1], ['b', 2], ['c', 3]]);
pickInPlace(m, ['a', 'c']);
// m 现在是 Map([['a', 1], ['c', 3]])

// 只保留公开字段
const user = new Map([
  ['id', 1],
  ['name', 'Alice'],
  ['password', 'secret'],
  ['email', 'alice@example.com']
]);
pickInPlace(user, ['id', 'name', 'email']);
// user 现在是 Map([['id', 1], ['name', 'Alice'], ['email', 'alice@example.com']])
```

---

### mergeInPlace

将源 Map 合并到目标 Map 中

```typescript
function mergeInPlace<K, V>(
  target: Map<K, V>,
  source: Map<K, V>,
  resolve_conflict?: (target_val: V, source_val: V, key: K) => V,
): Map<K, V>;
```

| 参数              | 类型                                            | 描述                   |
| ----------------- | ----------------------------------------------- | ---------------------- |
| `target`          | `Map<K, V>`                                     | 目标 Map（被修改）     |
| `source`          | `Map<K, V>`                                     | 源 Map                 |
| `resolve_conflict`| `(target_val: V, source_val: V, key: K) => V`   | 可选的冲突解决函数     |

**返回值：** 修改后的目标 Map

**示例：**

```typescript
const target = new Map([['a', 1], ['b', 2]]);
const source = new Map([['b', 20], ['c', 3]]);

// 默认：源值覆盖目标值
mergeInPlace(target, source);
// target 现在是 Map([['a', 1], ['b', 20], ['c', 3]])

// 自定义冲突解决：保留最大值
const t2 = new Map([['a', 10], ['b', 5]]);
const s2 = new Map([['b', 8], ['c', 3]]);
mergeInPlace(t2, s2, (t, s) => Math.max(t, s));
// t2 现在是 Map([['a', 10], ['b', 8], ['c', 3]])

// 自定义冲突解决：数值相加
const t3 = new Map([['a', 1], ['b', 2]]);
const s3 = new Map([['b', 3], ['c', 4]]);
mergeInPlace(t3, s3, (t, s) => t + s);
// t3 现在是 Map([['a', 1], ['b', 5], ['c', 4]])
```

---

### getOrSetInPlace

获取键对应的值，如果不存在则设置默认值

```typescript
function getOrSetInPlace<K, V>(
  map: Map<K, V>,
  key: K,
  default_factory: (key: K) => V,
): V;
```

| 参数             | 类型                  | 描述               |
| ---------------- | --------------------- | ------------------ |
| `map`            | `Map<K, V>`           | 要操作的 Map       |
| `key`            | `K`                   | 键                 |
| `default_factory`| `(key: K) => V`       | 默认值工厂函数     |

**返回值：** 已存在的值或新创建的默认值

**示例：**

```typescript
const m = new Map([['a', 1]]);

// 键存在，返回现有值
const existing = getOrSetInPlace(m, 'a', () => 100);
// existing = 1, m 不变

// 键不存在，创建并返回新值
const created = getOrSetInPlace(m, 'b', () => 200);
// created = 200, m 现在是 Map([['a', 1], ['b', 200]])

// 惰性初始化复杂对象
const cache = new Map<string, string[]>();
getOrSetInPlace(cache, 'users', () => []);
// cache 现在是 Map([['users', []]])
```

---

### updateInPlace

使用更新函数更新 Map 中的值

```typescript
function updateInPlace<K, V>(
  map: Map<K, V>,
  key: K,
  updater: (value: V | undefined, key: K) => V,
): Map<K, V>;
```

| 参数       | 类型                              | 描述                   |
| ---------- | --------------------------------- | ---------------------- |
| `map`      | `Map<K, V>`                       | 要修改的 Map           |
| `key`      | `K`                               | 要更新的键             |
| `updater`  | `(value: V \| undefined, key: K) => V` | 更新函数               |

**返回值：** 修改后的原 Map 实例

**示例：**

```typescript
const m = new Map([['a', 1]]);

// 更新现有值
updateInPlace(m, 'a', v => v ? v + 1 : 0);
// m 现在是 Map([['a', 2]])

// 键不存在时创建
updateInPlace(m, 'b', (v, k) => v ?? `${k}_default`);
// m 现在是 Map([['a', 2], ['b', 'b_default']])

// 计数器场景
const counters = new Map<string, number>();
updateInPlace(counters, 'clicks', v => (v ?? 0) + 1);  // 1
updateInPlace(counters, 'clicks', v => (v ?? 0) + 1);  // 2
// counters 现在是 Map([['clicks', 2]])
```

---

## 注意事项

1. **迭代顺序**：所有函数遵循 Map 的迭代顺序（插入顺序）
2. **原地修改**：带 `InPlace` 后缀的函数会修改原 Map，其他函数返回新 Map
3. **类型守卫**：`filter` 支持类型守卫函数，可以进行类型收窄
4. **键冲突**：`mapKeys` 中重复的转换键会被后面的条目覆盖
5. **性能考虑**：`hasValue` 使用线性搜索，时间复杂度为 O(n)
6. **空 Map 行为**：
   - `reduce` 返回 `initial_value`
   - `findKey` 返回 `undefined`
   - `hasValue` 返回 `false`
