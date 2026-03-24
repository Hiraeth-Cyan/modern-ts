# Maybe 操作符

操作符用于转换、组合和处理 Maybe 中的可空值。

---

## 转换操作

### map

转换 Maybe 中的值。

```typescript
const map = <T, R>(val: Maybe<T>, fn: (value: T) => R): Maybe<R>
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `val` | `Maybe<T>` | 要转换的 Maybe 值 |
| `fn` | `(value: T) => R` | 转换函数 |

**返回值：** 如果为 Some 则返回转换后的值，如果为 None 则返回 None

**示例：**

```typescript
map(42, x => x * 2);     // 84
map(null, x => x * 2);   // undefined
map(undefined, x => x * 2); // undefined
```

---

### andThen

链式调用，根据值返回新的 Maybe。

```typescript
const andThen = <T, R>(val: Maybe<T>, fn: (value: T) => Maybe<R>): Maybe<R>
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `val` | `Maybe<T>` | 要转换的 Maybe 值 |
| `fn` | `(value: T) => Maybe<R>` | 返回 Maybe 的转换函数 |

**返回值：** 如果为 Some 则返回 `fn` 的结果，如果为 None 则返回 None

**示例：**

```typescript
const parseNumber = (s: string): Maybe<number> => {
  const n = parseInt(s);
  return isNaN(n) ? None() : Some(n);
};

andThen(Some("42"), parseNumber);    // 42
andThen(Some("abc"), parseNumber);   // undefined
andThen(None(), parseNumber);        // undefined
```

---

### ap

Applicative Apply，将 Maybe 中的函数应用到值上。

```typescript
const ap = <T, R>(fn_val: Maybe<(v: T) => R>, val: Maybe<T>): Maybe<R>
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `fn_val` | `Maybe<(v: T) => R>` | 包含函数的 Maybe |
| `val` | `Maybe<T>` | 包含值的 Maybe |

**返回值：** 如果两者都为 Some 则返回函数应用结果，否则返回 None

**示例：**

```typescript
ap(Some((x: number) => x * 2), Some(5));  // 10
ap(Some((x: number) => x * 2), None());   // undefined
ap(None(), Some(5));                       // undefined
```

---

### filter

过滤值，不满足条件时返回 None。

```typescript
const filter = <T>(val: Maybe<T>, predicate: (v: T) => boolean): Maybe<T>
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `val` | `Maybe<T>` | 要过滤的 Maybe 值 |
| `predicate` | `(v: T) => boolean` | 过滤条件 |

**返回值：** 如果为 Some 且满足条件则返回值，否则返回 None

**示例：**

```typescript
filter(Some(5), x => x > 0);    // 5
filter(Some(-1), x => x > 0);   // undefined
filter(None(), x => x > 0);     // undefined
```

---

### mapIf

条件映射，满足条件时才转换。

```typescript
const mapIf = <T, R>(val: Maybe<T>, predicate: (v: T) => boolean, fn: (v: T) => R): Maybe<R>
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `val` | `Maybe<T>` | 要转换的 Maybe 值 |
| `predicate` | `(v: T) => boolean` | 条件函数 |
| `fn` | `(v: T) => R` | 转换函数 |

**返回值：** 如果为 Some 且满足条件则返回转换后的值，否则返回 None

**示例：**

```typescript
mapIf(Some(5), x => x > 0, x => x * 2);   // 10
mapIf(Some(-1), x => x > 0, x => x * 2);  // undefined
mapIf(None(), x => x > 0, x => x * 2);    // undefined
```

---

## 逻辑分支与聚合

### and

逻辑与操作，第一个有值则返回第二个。

```typescript
const and = <T, U>(val: Maybe<T>, other: Maybe<U>): Maybe<U>
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `val` | `Maybe<T>` | 第一个 Maybe |
| `other` | `Maybe<U>` | 第二个 Maybe |

**返回值：** 如果第一个为 Some 则返回第二个，否则返回 None

**示例：**

```typescript
and(Some(1), Some(2));   // 2
and(None(), Some(2));    // undefined
and(Some(1), None());   // undefined
```

---

### or

逻辑或操作，第一个有值则返回第一个，否则返回第二个。

```typescript
const or = <T>(val: Maybe<T>, other: Maybe<T>): Maybe<T>
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `val` | `Maybe<T>` | 第一个 Maybe |
| `other` | `Maybe<T>` | 第二个 Maybe |

**返回值：** 如果第一个为 Some 则返回第一个，否则返回第二个

**示例：**

```typescript
or(Some(1), Some(2));   // 1
or(None(), Some(2));    // 2
or(Some(1), None());    // 1
```

---

### orElse

有值则返回，否则调用函数获取备选值。

```typescript
const orElse = <T>(val: Maybe<T>, fn: () => Maybe<T>): Maybe<T>
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `val` | `Maybe<T>` | 要检查的 Maybe |
| `fn` | `() => Maybe<T>` | 备选值提供函数 |

**返回值：** 如果为 Some 则返回原值，否则返回 `fn()` 的结果

**示例：**

```typescript
orElse(Some(1), () => Some(2));   // 1
orElse(None(), () => Some(2));    // 2
```

---

### fold

提取值或返回默认值。

```typescript
const fold = <T, R>(val: Maybe<T>, initial: R, onSome: (v: T) => R): R
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `val` | `Maybe<T>` | 要处理的 Maybe |
| `initial` | `R` | 默认值 |
| `onSome` | `(v: T) => R` | 有值时的转换函数 |

**返回值：** 如果为 Some 则返回 `onSome(value)`，否则返回 `initial`

**示例：**

```typescript
fold(Some(5), 0, x => x * 2);   // 10
fold(None(), 0, x => x * 2);    // 0
```

---

### contains

检查 Maybe 是否包含特定值。

```typescript
const contains = <T>(val: Maybe<T>, x: T): boolean
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `val` | `Maybe<T>` | 要检查的 Maybe |
| `x` | `T` | 要比较的值 |

**返回值：** 如果为 Some 且值相等则返回 `true`，否则返回 `false`

**示例：**

```typescript
contains(Some(42), 42);   // true
contains(Some(42), 1);    // false
contains(None(), 42);     // false
```

---

## 多元组合

### zip

将两个 Maybe 组合为元组。

```typescript
const zip = <T, U>(a: Maybe<T>, b: Maybe<U>): Maybe<[T, U]>
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `a` | `Maybe<T>` | 第一个 Maybe |
| `b` | `Maybe<U>` | 第二个 Maybe |

**返回值：** 如果两者都为 Some 则返回元组，否则返回 None

**示例：**

```typescript
zip(Some(1), Some("a"));   // [1, "a"]
zip(Some(1), None());      // undefined
zip(None(), Some("a"));    // undefined
```

---

### zipWith

将两个 Maybe 应用组合函数。

```typescript
const zipWith = <T, U, R>(ma: Maybe<T>, mb: Maybe<U>, fn: (a: T, b: U) => R): Maybe<R>
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `ma` | `Maybe<T>` | 第一个 Maybe |
| `mb` | `Maybe<U>` | 第二个 Maybe |
| `fn` | `(a: T, b: U) => R` | 组合函数 |

**返回值：** 如果两者都为 Some 则返回组合结果，否则返回 None

**示例：**

```typescript
zipWith(Some(1), Some(2), (a, b) => a + b);  // 3
zipWith(Some(1), None(), (a, b) => a + b);   // undefined
```

---

## 集合处理

### all

组合多个 Maybe，全部有值则返回值数组。

```typescript
const all = <T>(vals: readonly Maybe<T>[]): Maybe<T[]>
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `vals` | `readonly Maybe<T>[]` | Maybe 数组 |

**返回值：** 如果全部有值则返回数组，否则返回 None

**示例：**

```typescript
all([Some(1), Some(2), Some(3)]);  // [1, 2, 3]
all([Some(1), None(), Some(3)]);   // undefined
```

---

### mapAll

对数组元素应用函数并组合结果。

```typescript
const mapAll = <T, U>(items: readonly T[], fn: (it: T, i: number) => Maybe<U>): Maybe<U[]>
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `items` | `readonly T[]` | 输入数组 |
| `fn` | `(it: T, i: number) => Maybe<U>` | 映射函数 |

**返回值：** 如果全部映射成功则返回结果数组，否则返回 None

**示例：**

```typescript
mapAll(["1", "2", "3"], s => {
  const n = parseInt(s);
  return isNaN(n) ? None() : Some(n);
});  // [1, 2, 3]

mapAll(["1", "abc", "3"], s => {
  const n = parseInt(s);
  return isNaN(n) ? None() : Some(n);
});  // undefined
```

---

### partition

将 Maybe 数组分离为有值和无值两部分。

```typescript
const partition = <T>(vals: readonly Maybe<T>[]): [T[], number]
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `vals` | `readonly Maybe<T>[]` | Maybe 数组 |

**返回值：** `[Some 值数组, None 数量]`

**示例：**

```typescript
partition([Some(1), None(), Some(2), None()]);
// [[1, 2], 2]  (值数组, None数量)
```

---

### collectSomes

收集所有有值的元素。

```typescript
const collectSomes = <T>(vals: readonly Maybe<T>[]): T[]
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `vals` | `readonly Maybe<T>[]` | Maybe 数组 |

**返回值：** 所有 Some 值的数组

**示例：**

```typescript
collectSomes([Some(1), None(), Some(2), None()]);  // [1, 2]
```

---

### firstSome

返回第一个有值的元素。

```typescript
const firstSome = <T>(vals: readonly Maybe<T>[]): Maybe<T>
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `vals` | `readonly Maybe<T>[]` | Maybe 数组 |

**返回值：** 第一个 Some 值，如果没有则返回 None

**示例：**

```typescript
firstSome([None(), Some(1), Some(2)]);  // 1
firstSome([None(), None()]);            // undefined
```

---

## 规约操作

### reduce

对多个 Maybe 进行规约，任一为 None 则返回 None。

```typescript
function reduce<T, R>(vals: readonly Maybe<T>[], initial: R, reducer: (acc: R, v: T) => R): Maybe<R>
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `vals` | `readonly Maybe<T>[]` | Maybe 数组 |
| `initial` | `R` | 初始值 |
| `reducer` | `(acc: R, v: T) => R` | 规约函数 |

**返回值：** 如果全部有值则返回规约结果，否则返回 None

**示例：**

```typescript
reduce([Some(1), Some(2), Some(3)], 0, (acc, x) => acc + x);  // 6
reduce([Some(1), None(), Some(3)], 0, (acc, x) => acc + x);   // undefined
```

---

### scan

扫描规约，返回每一步的结果。

```typescript
function scan<T, R>(vals: readonly Maybe<T>[], initial: R, scanner: (acc: R, v: T) => R): Maybe<R[]>
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `vals` | `readonly Maybe<T>[]` | Maybe 数组 |
| `initial` | `R` | 初始值 |
| `scanner` | `(acc: R, v: T) => R` | 扫描函数 |

**返回值：** 如果全部有值则返回每一步结果的数组，否则返回 None

**示例：**

```typescript
scan([Some(1), Some(2), Some(3)], 0, (acc, x) => acc + x);
// [0, 1, 3, 6]

scan([Some(1), None(), Some(3)], 0, (acc, x) => acc + x);
// undefined
```

---

### folds

分别处理 Some 和 None 的规约。

```typescript
const folds = <T, R>(
  vals: readonly Maybe<T>[],
  initial: R,
  onSome: (acc: R, v: T) => R,
  onNone: (acc: R) => R
): R
```

| 参数 | 类型 | 描述 |
| ---- | ---- | ---- |
| `vals` | `readonly Maybe<T>[]` | Maybe 数组 |
| `initial` | `R` | 初始值 |
| `onSome` | `(acc: R, v: T) => R` | Some 值处理函数 |
| `onNone` | `(acc: R) => R` | None 值处理函数 |

**返回值：** 规约结果

**示例：**

```typescript
folds([Some(1), None(), Some(2)], 0,
  (acc, v) => acc + v,    // Some 处理
  (acc) => acc            // None 处理
);  // 3
```

---

## 异步操作符

几乎所有同步操作符均提供对应的 `*Async` 版本。

| 同步版本       | 异步版本            |
| -------------- | ------------------- |
| `map`          | `mapAsync`          |
| `andThen`      | `andThenAsync`      |
| `ap`           | `apAsync`           |
| `filter`       | `filterAsync`       |
| `mapIf`        | `mapIfAsync`        |
| `zip`          | `zipAsync`          |
| `fold`         | `foldAsync`         |
| `orElse`       | `orElseAsync`       |
| `all`          | `allAsync`          |
| `mapAll`       | `mapAllAsync`       |
| `reduce`       | `reduceAsync`       |
| `scan`         | `scanAsync`         |
| `partition`    | `partitionAsync`    |
| `collectSomes` | `collectSomesAsync` |
| `firstSome`    | `firstSomeAsync`    |

### 异步操作符签名

所有异步操作符都遵循以下模式：
- 接受 `AnyMaybe<T>` 作为输入（支持同步或异步 Maybe）
- 可选的 `AbortSignal` 参数用于取消操作
- 返回 `AsyncMaybe<R>` 或 `Promise<R>`

**示例：**

```typescript
// 异步 map
const result = await mapAsync(
  Some(Promise.resolve(5)),
  async x => x * 2
);  // 10

// 带取消的异步操作
const controller = new AbortController();
const result = await filterAsync(
  Some(10),
  async x => x > 5,
  controller.signal
);
```
