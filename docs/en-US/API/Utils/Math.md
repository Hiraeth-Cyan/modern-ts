# Math

A collection of mathematical utility functions providing number processing, range operations, random number generation, statistical analysis, and geometric calculations.

---

## Use Cases

- **Number Processing**: Clamp values, round numbers, normalize values
- **Range Operations**: Generate number sequences, map values between ranges, range checking
- **Statistical Analysis**: Calculate mean, median, standard deviation
- **Geometric Calculations**: Distance between points, angle conversions, Bezier curves

---

## API

### clamp

Restricts a number to be within a specified range.

```typescript
function clamp(n: number, min: number, max: number): number;
```

| Parameter | Type     | Description           |
| --------- | -------- | --------------------- |
| `n`       | `number` | The number to clamp   |
| `min`     | `number` | Minimum allowed value |
| `max`     | `number` | Maximum allowed value |

**Returns:** The clamped number

**Examples:**

```typescript
clamp(10, 0, 5);   // 5 (exceeds upper bound)
clamp(-3, 0, 10);  // 0 (below lower bound)
clamp(7, 0, 10);   // 7 (within range)

// Limit scroll position
const scrollTop = clamp(currentScroll, 0, maxScroll);
```

---

### round

Rounds a number to a specified number of decimal places.

```typescript
function round(n: number, precision?: number): number;
```

| Parameter   | Type     | Description                      |
| ----------- | -------- | -------------------------------- |
| `n`         | `number` | The number to round              |
| `precision` | `number` | Decimal places, defaults to `0`  |

**Returns:** The rounded number

**Examples:**

```typescript
round(3.14159);       // 3
round(3.14159, 2);    // 3.14
round(3.14159, 4);    // 3.1416
round(1234.5, -1);    // 1230 (negative means integer places)
```

---

### normalize

Normalizes a number from its original range to [0, 1].

```typescript
function normalize(n: number, min: number, max: number): number;
```

| Parameter | Type     | Description              |
| --------- | -------- | ------------------------ |
| `n`       | `number` | The number to normalize  |
| `min`     | `number` | Original range minimum   |
| `max`     | `number` | Original range maximum   |

**Returns:** Normalized value in [0, 1] range, returns `0` when `min === max`

**Examples:**

```typescript
normalize(50, 0, 100);   // 0.5
normalize(75, 50, 100);  // 0.5
normalize(0, -10, 10);   // 0.5
normalize(5, 5, 5);      // 0 (edge case)

// Normalize progress bar position
const progress = normalize(currentValue, minValue, maxValue);
```

---

### gcd

Calculates the greatest common divisor (GCD) of two numbers.

```typescript
function gcd(a: number, b: number): number;
```

| Parameter | Type     | Description  |
| --------- | -------- | ------------ |
| `a`       | `number` | First number |
| `b`       | `number` | Second number|

**Returns:** Non-negative GCD

**Examples:**

```typescript
gcd(12, 8);    // 4
gcd(17, 5);    // 1 (coprime)
gcd(-12, 8);   // 4 (absolute value applied)
gcd(0, 5);     // 5
gcd(0, 0);     // 0
```

---

### lcm

Calculates the least common multiple (LCM) of two numbers.

```typescript
function lcm(a: number, b: number): number;
```

| Parameter | Type     | Description  |
| --------- | -------- | ------------ |
| `a`       | `number` | First number |
| `b`       | `number` | Second number|

**Returns:** Non-negative LCM, returns `0` if either input is `0`

**Examples:**

```typescript
lcm(4, 6);     // 12
lcm(5, 7);     // 35
lcm(0, 5);     // 0
lcm(-4, 6);    // 12 (absolute value applied)
```

---

### inRange

Checks if a number is within the specified range [min, max).

```typescript
function inRange(n: number, min: number, max: number): boolean;
```

| Parameter | Type     | Description           |
| --------- | -------- | --------------------- |
| `n`       | `number` | The number to check   |
| `min`     | `number` | Inclusive lower bound |
| `max`     | `number` | Exclusive upper bound |

**Returns:** `true` if within range

**Examples:**

```typescript
inRange(5, 0, 10);   // true
inRange(0, 0, 10);   // true (min is inclusive)
inRange(10, 0, 10);  // false (max is exclusive)
inRange(NaN, 0, 10); // false
```

---

### range

Generates an array of numbers from `start` to `end` (exclusive).

```typescript
function range(start: number, end: number, step?: number): number[];
```

| Parameter | Type     | Description                    |
| --------- | -------- | ------------------------------ |
| `start`   | `number` | Starting value                 |
| `end`     | `number` | Ending value (exclusive)       |
| `step`    | `number` | Step size, defaults to `1`     |

**Returns:** Array of numbers

**Examples:**

```typescript
range(0, 5);         // [0, 1, 2, 3, 4]
range(1, 10, 2);     // [1, 3, 5, 7, 9]
range(0, -5, -1);    // [0, -1, -2, -3, -4]
range(0, 5, 0);      // [] (empty array when step is 0)
```

---

### rangeRight

Generates a reversed array of numbers (from high to low).

```typescript
function rangeRight(start: number, end: number, step?: number): number[];
```

| Parameter | Type     | Description                    |
| --------- | -------- | ------------------------------ |
| `start`   | `number` | Starting value                 |
| `end`     | `number` | Ending value (exclusive)       |
| `step`    | `number` | Step size, defaults to `1`     |

**Returns:** Reversed array of numbers

**Examples:**

```typescript
rangeRight(0, 5);      // [4, 3, 2, 1, 0]
rangeRight(1, 10, 2);  // [9, 7, 5, 3, 1]
```

---

### mapRange

Linearly maps a value from one range to another.

```typescript
function mapRange(
  n: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number;
```

| Parameter | Type     | Description            |
| --------- | -------- | ---------------------- |
| `n`       | `number` | Input value            |
| `inMin`   | `number` | Input range minimum    |
| `inMax`   | `number` | Input range maximum    |
| `outMin`  | `number` | Output range minimum   |
| `outMax`  | `number` | Output range maximum   |

**Returns:** Mapped value

**Examples:**

```typescript
// Map 0-100 to 0-1
mapRange(50, 0, 100, 0, 1);     // 0.5

// Map Celsius to Fahrenheit
mapRange(100, 0, 100, 32, 212); // 212

// Map slider position to volume
const volume = mapRange(sliderValue, 0, 100, -60, 0);
```

---

### random

Generates a random floating-point number in the range [min, max).

```typescript
function random(min: number, max: number): number;
```

| Parameter | Type     | Description           |
| --------- | -------- | --------------------- |
| `min`     | `number` | Minimum (inclusive)   |
| `max`     | `number` | Maximum (exclusive)   |

**Returns:** Random floating-point number

**Examples:**

```typescript
random(0, 1);     // 0.234567...
random(10, 20);   // 15.678...
random(-5, 5);    // -2.345...
```

---

### randomInt

Generates a random integer in the range [min, max].

```typescript
function randomInt(min: number, max: number): number;
```

| Parameter | Type     | Description           |
| --------- | -------- | --------------------- |
| `min`     | `number` | Minimum (inclusive)   |
| `max`     | `number` | Maximum (inclusive)   |

**Returns:** Random integer

**Examples:**

```typescript
randomInt(1, 6);    // Dice roll: 1-6
randomInt(0, 100);  // Random integer 0-100
randomInt(-10, 10); // Random integer -10 to 10
```

---

### sum

Calculates the sum of an array of numbers.

```typescript
function sum(nums: number[]): number;
```

| Parameter | Type       | Description   |
| --------- | ---------- | ------------- |
| `nums`    | `number[]` | Array of numbers |

**Returns:** Sum

**Examples:**

```typescript
sum([1, 2, 3, 4, 5]);  // 15
sum([]);               // 0
sum([-1, 1, -2, 2]);   // 0
```

---

### sumBy

Calculates the sum of array elements based on an extractor function.

```typescript
function sumBy<T>(arr: T[], getValue: (item: T) => number): number;
```

| Parameter  | Type                  | Description         |
| ---------- | --------------------- | ------------------- |
| `arr`      | `T[]`                 | Input array         |
| `getValue` | `(item: T) => number` | Value extractor function |

**Returns:** Sum of extracted values

**Examples:**

```typescript
const items = [{ price: 10 }, { price: 20 }, { price: 30 }];
sumBy(items, item => item.price);  // 60

const users = [{ age: 25 }, { age: 30 }, { age: 35 }];
sumBy(users, u => u.age);          // 90
```

---

### mean

Calculates the mean (average) of an array of numbers.

```typescript
function mean(nums: number[]): number;
```

| Parameter | Type       | Description   |
| --------- | ---------- | ------------- |
| `nums`    | `number[]` | Array of numbers |

**Returns:** Mean value, returns `0` for empty array

**Examples:**

```typescript
mean([1, 2, 3, 4, 5]);  // 3
mean([10, 20]);         // 15
mean([]);               // 0
```

---

### meanBy

Calculates the mean of array elements based on an extractor function.

```typescript
function meanBy<T>(arr: T[], getValue: (item: T) => number): number;
```

| Parameter  | Type                  | Description         |
| ---------- | --------------------- | ------------------- |
| `arr`      | `T[]`                 | Input array         |
| `getValue` | `(item: T) => number` | Value extractor function |

**Returns:** Mean of extracted values, returns `0` for empty array

**Examples:**

```typescript
const scores = [{ value: 80 }, { value: 90 }, { value: 100 }];
meanBy(scores, s => s.value);  // 90
```

---

### median

Calculates the median of an array of numbers.

```typescript
function median(nums: number[]): number;
```

| Parameter | Type       | Description   |
| --------- | ---------- | ------------- |
| `nums`    | `number[]` | Array of numbers |

**Returns:** Median value

**Examples:**

```typescript
median([1, 3, 5]);        // 3 (odd count)
median([1, 2, 3, 4]);     // 2.5 (even count, average of middle two)
median([5, 1, 3]);        // 3 (auto-sorted)
```

---

### medianBy

Calculates the median of array elements based on an extractor function.

```typescript
function medianBy<T>(arr: T[], getValue: (item: T) => number): number;
```

| Parameter  | Type                  | Description         |
| ---------- | --------------------- | ------------------- |
| `arr`      | `T[]`                 | Input array         |
| `getValue` | `(item: T) => number` | Value extractor function |

**Returns:** Median of extracted values, returns `0` for empty array

**Examples:**

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

Calculates the standard deviation of an array of numbers.

```typescript
function stdDev(nums: number[], isSample?: boolean): number;
```

| Parameter  | Type       | Description                              |
| ---------- | ---------- | ---------------------------------------- |
| `nums`     | `number[]` | Array of numbers                         |
| `isSample` | `boolean`  | Whether to use sample std dev, defaults to `false` |

**Returns:** Standard deviation

**Examples:**

```typescript
// Population standard deviation
stdDev([2, 4, 4, 4, 5, 5, 7, 9]);        // 2

// Sample standard deviation (uses Bessel's correction)
stdDev([2, 4, 4, 4, 5, 5, 7, 9], true);  // ~2.138

stdDev([]);                              // 0
stdDev([5], true);                       // 0 (sample size of 1)
```

---

### approxEqual

Checks if two numbers are approximately equal within a specified epsilon.

```typescript
function approxEqual(n1: number, n2: number, epsilon?: number): boolean;
```

| Parameter | Type     | Description                    |
| --------- | -------- | ------------------------------ |
| `n1`      | `number` | First number                   |
| `n2`      | `number` | Second number                  |
| `epsilon` | `number` | Tolerance, defaults to `1e-10` |

**Returns:** `true` if within tolerance

**Examples:**

```typescript
approxEqual(0.1 + 0.2, 0.3);              // true (handles floating point error)
approxEqual(1.000001, 1.0);               // true
approxEqual(1.000001, 1.0, 1e-7);         // false (stricter tolerance)
approxEqual(Math.PI, 3.14159, 0.00001);   // true
```

---

### isEven

Checks if a number is even.

```typescript
function isEven(n: number): boolean;
```

| Parameter | Type     | Description      |
| --------- | -------- | ---------------- |
| `n`       | `number` | Number to check  |

**Returns:** `true` if even

**Examples:**

```typescript
isEven(4);   // true
isEven(3);   // false
isEven(0);   // true
isEven(-2);  // true
```

---

### isOdd

Checks if a number is odd.

```typescript
function isOdd(n: number): boolean;
```

| Parameter | Type     | Description      |
| --------- | -------- | ---------------- |
| `n`       | `number` | Number to check  |

**Returns:** `true` if odd

**Examples:**

```typescript
isOdd(3);   // true
isOdd(4);   // false
isOdd(0);   // false
isOdd(-1);  // true
```

---

### toRadians

Converts degrees to radians.

```typescript
function toRadians(deg: number): number;
```

| Parameter | Type     | Description   |
| --------- | -------- | ------------- |
| `deg`     | `number` | Degrees value |

**Returns:** Radians value

**Examples:**

```typescript
toRadians(180);   // 3.141592653589793 (Math.PI)
toRadians(90);    // 1.5707963267948966 (Math.PI / 2)
toRadians(360);   // 6.283185307179586 (2 * Math.PI)
```

---

### toDegrees

Converts radians to degrees.

```typescript
function toDegrees(rad: number): number;
```

| Parameter | Type     | Description   |
| --------- | -------- | ------------- |
| `rad`     | `number` | Radians value |

**Returns:** Degrees value

**Examples:**

```typescript
toDegrees(Math.PI);      // 180
toDegrees(Math.PI / 2);  // 90
toDegrees(Math.PI * 2);  // 360
```

---

### wrapAngle

Normalizes an angle to the [0, 360) range.

```typescript
function wrapAngle(deg: number): number;
```

| Parameter | Type     | Description   |
| --------- | -------- | ------------- |
| `deg`     | `number` | Input angle   |

**Returns:** Angle in [0, 360) range

**Examples:**

```typescript
wrapAngle(450);   // 90
wrapAngle(-90);   // 270
wrapAngle(360);   // 0
wrapAngle(180);   // 180
```

---

### angleDist

Calculates the smallest signed difference between two angles.

```typescript
function angleDist(a: number, b: number): number;
```

| Parameter | Type     | Description    |
| --------- | -------- | -------------- |
| `a`       | `number` | First angle    |
| `b`       | `number` | Second angle   |

**Returns:** Angle difference in [-180, 180] range

**Examples:**

```typescript
angleDist(0, 90);     // 90
angleDist(0, 270);    // -90 (counter-clockwise is shorter)
angleDist(350, 10);   // 20
angleDist(10, 350);   // -20
```

---

### getDistance

Calculates the Euclidean distance between two points.

```typescript
function getDistance(x1: number, y1: number, x2: number, y2: number): number;
```

| Parameter | Type     | Description          |
| --------- | -------- | -------------------- |
| `x1`      | `number` | First point x coordinate |
| `y1`      | `number` | First point y coordinate |
| `x2`      | `number` | Second point x coordinate |
| `y2`      | `number` | Second point y coordinate |

**Returns:** Distance between points

**Examples:**

```typescript
getDistance(0, 0, 3, 4);   // 5 (3-4-5 right triangle)
getDistance(1, 1, 4, 5);   // 5
getDistance(0, 0, 0, 0);   // 0
```

---

### getDistanceSq

Calculates the squared Euclidean distance between two points (faster, no square root).

```typescript
function getDistanceSq(x1: number, y1: number, x2: number, y2: number): number;
```

| Parameter | Type     | Description          |
| --------- | -------- | -------------------- |
| `x1`      | `number` | First point x coordinate |
| `y1`      | `number` | First point y coordinate |
| `x2`      | `number` | Second point x coordinate |
| `y2`      | `number` | Second point y coordinate |

**Returns:** Squared distance

**Examples:**

```typescript
getDistanceSq(0, 0, 3, 4);   // 25
getDistanceSq(1, 1, 4, 5);   // 25

// More efficient for distance comparisons
if (getDistanceSq(x1, y1, x2, y2) < threshold * threshold) {
  // Point is within range
}
```

---

### lerp

Linear interpolation.

```typescript
function lerp(start: number, end: number, t: number): number;
```

| Parameter | Type     | Description                          |
| --------- | -------- | ------------------------------------ |
| `start`   | `number` | Starting value                       |
| `end`     | `number` | Ending value                         |
| `t`       | `number` | Interpolation factor (0 = start, 1 = end) |

**Returns:** Interpolated value

**Examples:**

```typescript
lerp(0, 100, 0.5);   // 50
lerp(10, 20, 0);     // 10
lerp(10, 20, 1);     // 20
lerp(0, 100, 0.25);  // 25

// Animation easing
const currentX = lerp(startX, endX, progress);
```

---

### bezier2

Calculates a point on a quadratic Bezier curve.

```typescript
function bezier2(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  t: number,
): { x: number; y: number };
```

| Parameter | Type       | Description           |
| --------- | ---------- | --------------------- |
| `p0`      | `{ x, y }` | Start point           |
| `p1`      | `{ x, y }` | Control point         |
| `p2`      | `{ x, y }` | End point             |
| `t`       | `number`   | Interpolation factor [0, 1] |

**Returns:** Point coordinates `{ x, y }` on the curve

**Examples:**

```typescript
const start = { x: 0, y: 0 };
const control = { x: 50, y: 100 };
const end = { x: 100, y: 0 };

// Get midpoint of curve
bezier2(start, control, end, 0.5);  // { x: 50, y: 50 }

// Generate curve path points
const points = [];
for (let t = 0; t <= 1; t += 0.1) {
  points.push(bezier2(start, control, end, t));
}
```

---

## Notes

1. **Range behavior**: The `end` value is exclusive in the result, consistent with Python's `range()` behavior
2. **Floating point precision**: Use `approxEqual` to handle JavaScript floating point precision issues, such as `0.1 + 0.2 !== 0.3`
3. **Angle direction**: `angleDist` returns positive for clockwise rotation, negative for counter-clockwise
4. **Performance**: `getDistanceSq` is faster than `getDistance` and is suitable for distance comparison scenarios
5. **Empty array handling**: Statistical functions (`mean`, `meanBy`, `medianBy`) return `0` for empty arrays instead of `NaN`
