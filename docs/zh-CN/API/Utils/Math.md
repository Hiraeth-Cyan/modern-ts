# Math

数学工具函数集合，提供数值处理、范围操作、随机数生成、统计分析、几何计算等功能

---

## 使用场景

- **数值处理**：限制数值范围、四舍五入、归一化
- **范围操作**：生成数字序列、数值映射、范围检测
- **统计分析**：计算平均值、中位数、标准差
- **几何计算**：两点距离、角度转换、贝塞尔曲线

---

## API

### clamp

将数值限制在指定范围内

```typescript
function clamp(n: number, min: number, max: number): number;
```

| 参数  | 类型     | 描述           |
| ----- | -------- | -------------- |
| `n`   | `number` | 要限制的数值   |
| `min` | `number` | 最小允许值     |
| `max` | `number` | 最大允许值     |

**返回值：** 限制后的数值

**示例：**

```typescript
clamp(10, 0, 5);   // 5 (超出上限)
clamp(-3, 0, 10);  // 0 (低于下限)
clamp(7, 0, 10);   // 7 (在范围内)

// 限制滚动位置
const scrollTop = clamp(currentScroll, 0, maxScroll);
```

---

### round

将数值四舍五入到指定小数位

```typescript
function round(n: number, precision?: number): number;
```

| 参数        | 类型     | 描述                 |
| ----------- | -------- | -------------------- |
| `n`         | `number` | 要四舍五入的数值     |
| `precision` | `number` | 小数位数，默认为 `0` |

**返回值：** 四舍五入后的数值

**示例：**

```typescript
round(3.14159);       // 3
round(3.14159, 2);    // 3.14
round(3.14159, 4);    // 3.1416
round(1234.5, -1);    // 1230 (负数表示整数位)
```

---

### normalize

将数值从原范围归一化到 [0, 1]

```typescript
function normalize(n: number, min: number, max: number): number;
```

| 参数  | 类型     | 描述           |
| ----- | -------- | -------------- |
| `n`   | `number` | 要归一化的数值 |
| `min` | `number` | 原范围最小值   |
| `max` | `number` | 原范围最大值   |

**返回值：** [0, 1] 范围内的归一化值，当 `min === max` 时返回 `0`

**示例：**

```typescript
normalize(50, 0, 100);   // 0.5
normalize(75, 50, 100);  // 0.5
normalize(0, -10, 10);   // 0.5
normalize(5, 5, 5);      // 0 (边界情况)

// 将进度条位置归一化
const progress = normalize(currentValue, minValue, maxValue);
```

---

### gcd

计算两个数的最大公约数 (GCD)

```typescript
function gcd(a: number, b: number): number;
```

| 参数 | 类型     | 描述     |
| ---- | -------- | -------- |
| `a`  | `number` | 第一个数 |
| `b`  | `number` | 第二个数 |

**返回值：** 非负的最大公约数

**示例：**

```typescript
gcd(12, 8);    // 4
gcd(17, 5);    // 1 (互质)
gcd(-12, 8);   // 4 (自动取绝对值)
gcd(0, 5);     // 5
gcd(0, 0);     // 0
```

---

### lcm

计算两个数的最小公倍数 (LCM)

```typescript
function lcm(a: number, b: number): number;
```

| 参数 | 类型     | 描述     |
| ---- | -------- | -------- |
| `a`  | `number` | 第一个数 |
| `b`  | `number` | 第二个数 |

**返回值：** 非负的最小公倍数，任一输入为 `0` 时返回 `0`

**示例：**

```typescript
lcm(4, 6);     // 12
lcm(5, 7);     // 35
lcm(0, 5);     // 0
lcm(-4, 6);    // 12 (自动取绝对值)
```

---

### inRange

检查数值是否在指定范围内 [min, max)

```typescript
function inRange(n: number, min: number, max: number): boolean;
```

| 参数  | 类型     | 描述               |
| ----- | -------- | ------------------ |
| `n`   | `number` | 要检查的数值       |
| `min` | `number` | 包含的下界         |
| `max` | `number` | 不包含的上界       |

**返回值：** 如果在范围内返回 `true`

**示例：**

```typescript
inRange(5, 0, 10);   // true
inRange(0, 0, 10);   // true (包含 min)
inRange(10, 0, 10);  // false (不包含 max)
inRange(NaN, 0, 10); // false
```

---

### range

生成从 `start` 到 `end`（不包含）的数字数组

```typescript
function range(start: number, end: number, step?: number): number[];
```

| 参数    | 类型     | 描述                    |
| ------- | -------- | ----------------------- |
| `start` | `number` | 起始值                  |
| `end`   | `number` | 结束值（不包含）        |
| `step`  | `number` | 步长，默认为 `1`        |

**返回值：** 数字数组

**示例：**

```typescript
range(0, 5);         // [0, 1, 2, 3, 4]
range(1, 10, 2);     // [1, 3, 5, 7, 9]
range(0, -5, -1);    // [0, -1, -2, -3, -4]
range(0, 5, 0);      // [] (步长为0返回空数组)
```

---

### rangeRight

生成反向的数字数组（从大到小）

```typescript
function rangeRight(start: number, end: number, step?: number): number[];
```

| 参数    | 类型     | 描述                    |
| ------- | -------- | ----------------------- |
| `start` | `number` | 起始值                  |
| `end`   | `number` | 结束值（不包含）        |
| `step`  | `number` | 步长，默认为 `1`        |

**返回值：** 反向排列的数字数组

**示例：**

```typescript
rangeRight(0, 5);      // [4, 3, 2, 1, 0]
rangeRight(1, 10, 2);  // [9, 7, 5, 3, 1]
```

---

### mapRange

将一个范围的数值线性映射到另一个范围

```typescript
function mapRange(
  n: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number;
```

| 参数    | 类型     | 描述           |
| ------- | -------- | -------------- |
| `n`     | `number` | 输入值         |
| `inMin` | `number` | 输入范围最小值 |
| `inMax` | `number` | 输入范围最大值 |
| `outMin`| `number` | 输出范围最小值 |
| `outMax`| `number` | 输出范围最大值 |

**返回值：** 映射后的值

**示例：**

```typescript
// 将 0-100 映射到 0-1
mapRange(50, 0, 100, 0, 1);     // 0.5

// 将摄氏度映射到华氏度
mapRange(100, 0, 100, 32, 212); // 212

// 将滑块位置映射到音量
const volume = mapRange(sliderValue, 0, 100, -60, 0);
```

---

### random

生成指定范围内的随机浮点数 [min, max)

```typescript
function random(min: number, max: number): number;
```

| 参数  | 类型     | 描述               |
| ----- | -------- | ------------------ |
| `min` | `number` | 最小值（包含）     |
| `max` | `number` | 最大值（不包含）   |

**返回值：** 随机浮点数

**示例：**

```typescript
random(0, 1);     // 0.234567...
random(10, 20);   // 15.678...
random(-5, 5);    // -2.345...
```

---

### randomInt

生成指定范围内的随机整数 [min, max]

```typescript
function randomInt(min: number, max: number): number;
```

| 参数  | 类型     | 描述               |
| ----- | -------- | ------------------ |
| `min` | `number` | 最小值（包含）     |
| `max` | `number` | 最大值（包含）     |

**返回值：** 随机整数

**示例：**

```typescript
randomInt(1, 6);    // 骰子: 1-6
randomInt(0, 100);  // 0-100 的随机整数
randomInt(-10, 10); // -10 到 10 的随机整数
```

---

### sum

计算数字数组的总和

```typescript
function sum(nums: number[]): number;
```

| 参数   | 类型       | 描述       |
| ------ | ---------- | ---------- |
| `nums` | `number[]` | 数字数组   |

**返回值：** 总和

**示例：**

```typescript
sum([1, 2, 3, 4, 5]);  // 15
sum([]);               // 0
sum([-1, 1, -2, 2]);   // 0
```

---

### sumBy

根据提取函数计算数组元素的总和

```typescript
function sumBy<T>(arr: T[], getValue: (item: T) => number): number;
```

| 参数       | 类型                        | 描述           |
| ---------- | --------------------------- | -------------- |
| `arr`      | `T[]`                       | 输入数组       |
| `getValue` | `(item: T) => number`       | 值提取函数     |

**返回值：** 提取值的总和

**示例：**

```typescript
const items = [{ price: 10 }, { price: 20 }, { price: 30 }];
sumBy(items, item => item.price);  // 60

const users = [{ age: 25 }, { age: 30 }, { age: 35 }];
sumBy(users, u => u.age);          // 90
```

---

### mean

计算数字数组的平均值

```typescript
function mean(nums: number[]): number;
```

| 参数   | 类型       | 描述       |
| ------ | ---------- | ---------- |
| `nums` | `number[]` | 数字数组   |

**返回值：** 平均值，空数组返回 `0`

**示例：**

```typescript
mean([1, 2, 3, 4, 5]);  // 3
mean([10, 20]);         // 15
mean([]);               // 0
```

---

### meanBy

根据提取函数计算数组元素的平均值

```typescript
function meanBy<T>(arr: T[], getValue: (item: T) => number): number;
```

| 参数       | 类型                  | 描述       |
| ---------- | --------------------- | ---------- |
| `arr`      | `T[]`                 | 输入数组   |
| `getValue` | `(item: T) => number` | 值提取函数 |

**返回值：** 提取值的平均值，空数组返回 `0`

**示例：**

```typescript
const scores = [{ value: 80 }, { value: 90 }, { value: 100 }];
meanBy(scores, s => s.value);  // 90
```

---

### median

计算数字数组的中位数

```typescript
function median(nums: number[]): number;
```

| 参数   | 类型       | 描述       |
| ------ | ---------- | ---------- |
| `nums` | `number[]` | 数字数组   |

**返回值：** 中位数

**示例：**

```typescript
median([1, 3, 5]);        // 3 (奇数个)
median([1, 2, 3, 4]);     // 2.5 (偶数个，取中间两数平均)
median([5, 1, 3]);        // 3 (自动排序)
```

---

### medianBy

根据提取函数计算数组元素的中位数

```typescript
function medianBy<T>(arr: T[], getValue: (item: T) => number): number;
```

| 参数       | 类型                  | 描述       |
| ---------- | --------------------- | ---------- |
| `arr`      | `T[]`                 | 输入数组   |
| `getValue` | `(item: T) => number` | 值提取函数 |

**返回值：** 提取值的中位数，空数组返回 `0`

**示例：**

```typescript
const users = [
  { name: 'A', score: 80 },
  { name: 'B', score: 90 },
  { name: 'C', score: 100 }
];
medianBy(users, u => u.score);  // 90
```

---

### stdDev

计算数字数组的标准差

```typescript
function stdDev(nums: number[], isSample?: boolean): number;
```

| 参数       | 类型       | 描述                                |
| ---------- | ---------- | ----------------------------------- |
| `nums`     | `number[]` | 数字数组                            |
| `isSample` | `boolean`  | 是否为样本标准差，默认为 `false`    |

**返回值：** 标准差

**示例：**

```typescript
// 总体标准差
stdDev([2, 4, 4, 4, 5, 5, 7, 9]);        // 2

// 样本标准差 (使用贝塞尔校正)
stdDev([2, 4, 4, 4, 5, 5, 7, 9], true);  // ~2.138

stdDev([]);                              // 0
stdDev([5], true);                       // 0 (样本大小为1)
```

---

### approxEqual

检查两个数是否在指定误差范围内近似相等

```typescript
function approxEqual(n1: number, n2: number, epsilon?: number): boolean;
```

| 参数      | 类型     | 描述                 |
| --------- | -------- | -------------------- |
| `n1`      | `number` | 第一个数             |
| `n2`      | `number` | 第二个数             |
| `epsilon` | `number` | 误差容限，默认 `1e-10` |

**返回值：** 如果在误差范围内返回 `true`

**示例：**

```typescript
approxEqual(0.1 + 0.2, 0.3);              // true (处理浮点误差)
approxEqual(1.000001, 1.0);               // true
approxEqual(1.000001, 1.0, 1e-7);         // false (更严格的容限)
approxEqual(Math.PI, 3.14159, 0.00001);   // true
```

---

### isEven

检查数字是否为偶数

```typescript
function isEven(n: number): boolean;
```

| 参数 | 类型     | 描述     |
| ---- | -------- | -------- |
| `n`  | `number` | 要检查的数字 |

**返回值：** 偶数返回 `true`

**示例：**

```typescript
isEven(4);   // true
isEven(3);   // false
isEven(0);   // true
isEven(-2);  // true
```

---

### isOdd

检查数字是否为奇数

```typescript
function isOdd(n: number): boolean;
```

| 参数 | 类型     | 描述     |
| ---- | -------- | -------- |
| `n`  | `number` | 要检查的数字 |

**返回值：** 奇数返回 `true`

**示例：**

```typescript
isOdd(3);   // true
isOdd(4);   // false
isOdd(0);   // false
isOdd(-1);  // true
```

---

### toRadians

将角度转换为弧度

```typescript
function toRadians(deg: number): number;
```

| 参数  | 类型     | 描述     |
| ----- | -------- | -------- |
| `deg` | `number` | 角度值   |

**返回值：** 弧度值

**示例：**

```typescript
toRadians(180);   // 3.141592653589793 (Math.PI)
toRadians(90);    // 1.5707963267948966 (Math.PI / 2)
toRadians(360);   // 6.283185307179586 (2 * Math.PI)
```

---

### toDegrees

将弧度转换为角度

```typescript
function toDegrees(rad: number): number;
```

| 参数  | 类型     | 描述     |
| ----- | -------- | -------- |
| `rad` | `number` | 弧度值   |

**返回值：** 角度值

**示例：**

```typescript
toDegrees(Math.PI);      // 180
toDegrees(Math.PI / 2);  // 90
toDegrees(Math.PI * 2);  // 360
```

---

### wrapAngle

将角度归一化到 [0, 360) 范围

```typescript
function wrapAngle(deg: number): number;
```

| 参数  | 类型     | 描述     |
| ----- | -------- | -------- |
| `deg` | `number` | 输入角度 |

**返回值：** [0, 360) 范围内的角度

**示例：**

```typescript
wrapAngle(450);   // 90
wrapAngle(-90);   // 270
wrapAngle(360);   // 0
wrapAngle(180);   // 180
```

---

### angleDist

计算两个角度之间的最小有向差值

```typescript
function angleDist(a: number, b: number): number;
```

| 参数 | 类型     | 描述       |
| ---- | -------- | ---------- |
| `a`  | `number` | 第一个角度 |
| `b`  | `number` | 第二个角度 |

**返回值：** [-180, 180] 范围内的角度差值

**示例：**

```typescript
angleDist(0, 90);     // 90
angleDist(0, 270);    // -90 (逆时针更短)
angleDist(350, 10);   // 20
angleDist(10, 350);   // -20
```

---

### getDistance

计算两点间的欧几里得距离

```typescript
function getDistance(x1: number, y1: number, x2: number, y2: number): number;
```

| 参数 | 类型     | 描述         |
| ---- | -------- | ------------ |
| `x1` | `number` | 第一点 x 坐标 |
| `y1` | `number` | 第一点 y 坐标 |
| `x2` | `number` | 第二点 x 坐标 |
| `y2` | `number` | 第二点 y 坐标 |

**返回值：** 两点间距离

**示例：**

```typescript
getDistance(0, 0, 3, 4);   // 5 (3-4-5 直角三角形)
getDistance(1, 1, 4, 5);   // 5
getDistance(0, 0, 0, 0);   // 0
```

---

### getDistanceSq

计算两点间的欧几里得距离平方（更快，无开方运算）

```typescript
function getDistanceSq(x1: number, y1: number, x2: number, y2: number): number;
```

| 参数 | 类型     | 描述         |
| ---- | -------- | ------------ |
| `x1` | `number` | 第一点 x 坐标 |
| `y1` | `number` | 第一点 y 坐标 |
| `x2` | `number` | 第二点 x 坐标 |
| `y2` | `number` | 第二点 y 坐标 |

**返回值：** 距离平方

**示例：**

```typescript
getDistanceSq(0, 0, 3, 4);   // 25
getDistanceSq(1, 1, 4, 5);   // 25

// 用于比较距离时更高效
if (getDistanceSq(x1, y1, x2, y2) < threshold * threshold) {
  // 点在范围内
}
```

---

### lerp

线性插值

```typescript
function lerp(start: number, end: number, t: number): number;
```

| 参数    | 类型     | 描述                        |
| ------- | -------- | --------------------------- |
| `start` | `number` | 起始值                      |
| `end`   | `number` | 结束值                      |
| `t`     | `number` | 插值因子 (0 = start, 1 = end) |

**返回值：** 插值结果

**示例：**

```typescript
lerp(0, 100, 0.5);   // 50
lerp(10, 20, 0);     // 10
lerp(10, 20, 1);     // 20
lerp(0, 100, 0.25);  // 25

// 动画缓动
const currentX = lerp(startX, endX, progress);
```

---

### bezier2

计算二次贝塞尔曲线上的点

```typescript
function bezier2(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  t: number,
): { x: number; y: number };
```

| 参数 | 类型               | 描述           |
| ---- | ------------------ | -------------- |
| `p0` | `{ x, y }`         | 起始点         |
| `p1` | `{ x, y }`         | 控制点         |
| `p2` | `{ x, y }`         | 结束点         |
| `t`  | `number`           | 插值因子 [0, 1] |

**返回值：** 曲线上的点坐标 `{ x, y }`

**示例：**

```typescript
const start = { x: 0, y: 0 };
const control = { x: 50, y: 100 };
const end = { x: 100, y: 0 };

// 获取曲线中点
bezier2(start, control, end, 0.5);  // { x: 50, y: 50 }

// 生成曲线路径点
const points = [];
for (let t = 0; t <= 1; t += 0.1) {
  points.push(bezier2(start, control, end, t));
}
```

---

## 注意事项

1. **range 的范围**：`end` 值不包含在结果中，与 Python 的 `range()` 行为一致
2. **浮点数精度**：`approxEqual` 用于处理 JavaScript 浮点数精度问题，如 `0.1 + 0.2 !== 0.3`
3. **角度方向**：`angleDist` 返回正值表示顺时针，负值表示逆时针
4. **性能考虑**：`getDistanceSq` 比 `getDistance` 更快，适合仅需比较距离的场景
5. **空数组处理**：统计函数 (`mean`, `meanBy`, `medianBy`) 对空数组返回 `0` 而非 `NaN`
