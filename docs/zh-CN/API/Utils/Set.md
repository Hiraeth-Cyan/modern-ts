# Set

Set 工具函数集合，提供类似数组的高阶函数操作（filter、map、reduce 等），以及集合运算功能

---

## 使用场景

- **集合转换**：对 Set 进行映射、过滤、归约等操作
- **集合分组**：按条件对 Set 元素进行分组统计
- **集合运算**：并集、交集、差集等操作
- **条件查询**：查找满足条件的元素或测试集合元素

---

## API

### filter

创建一个新 Set，只包含满足谓词条件的值

```typescript
function filter<T, S extends T>(
  set: Set<T>,
  predicate: (value: T) => value is S,
): Set<S>;
function filter<T>(
  set: Set<T>,
  predicate: (value: T) => boolean,
): Set<T>;
```

| 参数        | 类型                      | 描述               |
| ----------- | ------------------------- | ------------------ |
| `set`       | `Set<T>`                  | 源 Set             |
| `predicate` | `(value: T) => boolean`   | 过滤条件函数       |

**返回值：** 过滤后的新 Set

**示例：**

```typescript
const nums = new Set([1, 2, 3, 4, 5]);
const evens = filter(nums, n => n % 2 === 0);
// Set { 2, 4 }

// 使用类型守卫进行类型收窄
const mixed = new Set<unknown>([1, 'a', 2, 'b']);
const strings = filter(mixed, (x): x is string => typeof x === 'string');
// Set<string> { 'a', 'b' }
```

---

### map

创建一个新 Set，对每个值进行转换

```typescript
function map<T, U>(set: Set<T>, iteratee: (value: T) => U): Set<U>;
```

| 参数       | 类型                  | 描述           |
| ---------- | --------------------- | -------------- |
| `set`      | `Set<T>`              | 源 Set         |
| `iteratee` | `(value: T) => U`     | 转换函数       |

**返回值：** 转换后的新 Set（重复值会被自动去重）

**示例：**

```typescript
const nums = new Set([1, 2, 3]);
const doubled = map(nums, n => n * 2);
// Set { 2, 4, 6 }

// 重复值会被去重
const set = new Set([1, 2, 3]);
const mapped = map(set, n => n % 2);  // 1, 0, 1
// Set { 1, 0 } (重复的 1 被去重)
```

---

### reduce

将 Set 中的值归约为单个结果

```typescript
function reduce<T, U>(
  set: Set<T>,
  iteratee: (accumulator: U, value: T) => U,
  initial_value: U,
): U;
```

| 参数            | 类型                              | 描述           |
| --------------- | --------------------------------- | -------------- |
| `set`           | `Set<T>`                          | 源 Set         |
| `iteratee`      | `(accumulator: U, value: T) => U` | 归约函数       |
| `initial_value` | `U`                               | 初始值         |

**返回值：** 最终归约结果

**示例：**

```typescript
const nums = new Set([1, 2, 3, 4, 5]);
const sum = reduce(nums, (acc, n) => acc + n, 0);
// 15

const words = new Set(['hello', 'world']);
const lengths = reduce(words, (acc, w) => acc + w.length, 0);
// 10
```

---

### countBy

按分组键统计各组元素数量

```typescript
function countBy<T>(
  set: Set<T>,
  iteratee: (value: T) => string | number,
): Record<string | number, number>;
```

| 参数       | 类型                                | 描述           |
| ---------- | ----------------------------------- | -------------- |
| `set`      | `Set<T>`                            | 源 Set         |
| `iteratee` | `(value: T) => string \| number`    | 分组键生成函数 |

**返回值：** 对象，键为分组键，值为数量

**示例：**

```typescript
const nums = new Set([1, 2, 3, 4, 5, 6]);
const parity = countBy(nums, n => n % 2 === 0 ? 'even' : 'odd');
// { even: 3, odd: 3 }

const words = new Set(['apple', 'banana', 'avocado', 'cherry']);
const byFirst = countBy(words, w => w[0]);
// { a: 2, b: 1, c: 1 }
```

---

### groupBy

按分组键将元素分组到 Map 中

```typescript
function groupBy<T, G>(
  set: Set<T>,
  iteratee: (value: T) => G,
): Map<G, T[]>;
```

| 参数       | 类型                  | 描述           |
| ---------- | --------------------- | -------------- |
| `set`      | `Set<T>`              | 源 Set         |
| `iteratee` | `(value: T) => G`     | 分组键生成函数 |

**返回值：** Map，键为分组键，值为元素数组

**示例：**

```typescript
const nums = new Set([1, 2, 3, 4, 5, 6]);
const grouped = groupBy(nums, n => n % 2 === 0 ? 'even' : 'odd');
// Map { 'even' => [2, 4, 6], 'odd' => [1, 3, 5] }

const users = new Set([
  { name: 'Alice', role: 'admin' },
  { name: 'Bob', role: 'user' },
  { name: 'Carol', role: 'admin' }
]);
const byRole = groupBy(users, u => u.role);
// Map { 'admin' => [{Alice}, {Carol}], 'user' => [{Bob}] }
```

---

### filterInPlace

原地过滤 Set，移除不满足条件的值

```typescript
function filterInPlace<T>(
  set: Set<T>,
  predicate: (value: T) => boolean,
): Set<T>;
```

| 参数        | 类型                    | 描述           |
| ----------- | ----------------------- | -------------- |
| `set`       | `Set<T>`                | 要修改的 Set   |
| `predicate` | `(value: T) => boolean` | 保留条件函数   |

**返回值：** 修改后的原 Set 实例（用于链式调用）

**示例：**

```typescript
const nums = new Set([1, 2, 3, 4, 5, 6]);
filterInPlace(nums, n => n % 2 === 0);
// nums 现在是 Set { 2, 4, 6 }

// 链式使用
const set = new Set([1, 2, 3, 4, 5]);
filterInPlace(set, n => n > 2);
// set 现在是 Set { 3, 4, 5 }
```

---

### unionInPlace

将可迭代对象中的所有值添加到目标 Set

```typescript
function unionInPlace<T>(target: Set<T>, other: Iterable<T>): Set<T>;
```

| 参数     | 类型           | 描述           |
| -------- | -------------- | -------------- |
| `target` | `Set<T>`       | 目标 Set       |
| `other`  | `Iterable<T>`  | 要添加的值     |

**返回值：** 修改后的目标 Set

**示例：**

```typescript
const setA = new Set([1, 2, 3]);
const setB = new Set([3, 4, 5]);
unionInPlace(setA, setB);
// setA 现在是 Set { 1, 2, 3, 4, 5 }

// 也支持数组
const set = new Set([1, 2]);
unionInPlace(set, [3, 4, 5]);
// set 现在是 Set { 1, 2, 3, 4, 5 }
```

---

### intersectInPlace

只保留目标 Set 中也存在于另一个可迭代对象中的值

```typescript
function intersectInPlace<T>(target: Set<T>, other: Iterable<T>): Set<T>;
```

| 参数     | 类型           | 描述           |
| -------- | -------------- | -------------- |
| `target` | `Set<T>`       | 目标 Set       |
| `other`  | `Iterable<T>`  | 交集参考值     |

**返回值：** 修改后的目标 Set

**示例：**

```typescript
const setA = new Set([1, 2, 3, 4]);
const setB = new Set([3, 4, 5, 6]);
intersectInPlace(setA, setB);
// setA 现在是 Set { 3, 4 }

// 与数组取交集
const set = new Set(['a', 'b', 'c', 'd']);
intersectInPlace(set, ['b', 'd', 'f']);
// set 现在是 Set { 'b', 'd' }
```

---

### differenceInPlace

从目标 Set 中移除存在于另一个可迭代对象中的值

```typescript
function differenceInPlace<T>(target: Set<T>, other: Iterable<T>): Set<T>;
function subtractInPlace<T>(target: Set<T>, other: Iterable<T>): Set<T>;
```

| 参数     | 类型           | 描述           |
| -------- | -------------- | -------------- |
| `target` | `Set<T>`       | 目标 Set       |
| `other`  | `Iterable<T>`  | 要移除的值     |

**返回值：** 修改后的目标 Set

**示例：**

```typescript
const setA = new Set([1, 2, 3, 4]);
const setB = new Set([3, 4, 5]);
differenceInPlace(setA, setB);
// setA 现在是 Set { 1, 2 }

// subtractInPlace 是别名
const set = new Set(['a', 'b', 'c']);
subtractInPlace(set, ['b']);
// set 现在是 Set { 'a', 'c' }
```

---

### some

测试是否有至少一个值满足谓词条件

```typescript
function some<T>(set: Set<T>, predicate: (value: T) => boolean): boolean;
```

| 参数        | 类型                    | 描述           |
| ----------- | ----------------------- | -------------- |
| `set`       | `Set<T>`                | 要测试的 Set   |
| `predicate` | `(value: T) => boolean` | 测试函数       |

**返回值：** 有任意值满足条件返回 `true`，空 Set 返回 `false`

**示例：**

```typescript
const nums = new Set([1, 3, 5, 7, 8]);
some(nums, n => n % 2 === 0);  // true (8 是偶数)

const odds = new Set([1, 3, 5]);
some(odds, n => n % 2 === 0);  // false

// 短路求值：找到第一个匹配就停止
some(new Set([1, 2, 3, 4]), n => {
  console.log(n);  // 只输出 1, 2
  return n === 2;
});
```

---

### every

测试是否所有值都满足谓词条件

```typescript
function every<T>(set: Set<T>, predicate: (value: T) => boolean): boolean;
```

| 参数        | 类型                    | 描述           |
| ----------- | ----------------------- | -------------- |
| `set`       | `Set<T>`                | 要测试的 Set   |
| `predicate` | `(value: T) => boolean` | 测试函数       |

**返回值：** 所有值都满足条件返回 `true`，空 Set 返回 `true`

**示例：**

```typescript
const evens = new Set([2, 4, 6, 8]);
every(evens, n => n % 2 === 0);  // true

const mixed = new Set([1, 2, 3]);
every(mixed, n => n % 2 === 0);  // false

// 空 Set 返回 true (数学上的 vacuous truth)
every(new Set(), () => false);  // true
```

---

### find

查找第一个满足谓词条件的值

```typescript
function find<T>(
  set: Set<T>,
  predicate: (value: T) => boolean,
): T | undefined;
```

| 参数        | 类型                    | 描述           |
| ----------- | ----------------------- | -------------- |
| `set`       | `Set<T>`                | 要搜索的 Set   |
| `predicate` | `(value: T) => boolean` | 查找条件       |

**返回值：** 第一个匹配的值，未找到返回 `undefined`

**示例：**

```typescript
const users = new Set([
  { id: 1, name: 'Alice', active: false },
  { id: 2, name: 'Bob', active: true },
  { id: 3, name: 'Carol', active: true }
]);

const firstActive = find(users, u => u.active);
// { id: 2, name: 'Bob', active: true }

const notFound = find(users, u => u.id === 99);
// undefined
```

---

## 注意事项

1. **迭代顺序**：所有函数遵循 Set 的迭代顺序（插入顺序）
2. **原地修改**：带 `InPlace` 后缀的函数会修改原 Set，其他函数返回新 Set
3. **类型守卫**：`filter` 支持类型守卫函数，可以进行类型收窄
4. **自动去重**：`map` 的结果会自动去重，因为返回的是 Set
5. **空 Set 行为**：
   - `some` 返回 `false`
   - `every` 返回 `true`
   - `reduce` 返回 `initial_value`
   - `find` 返回 `undefined`
