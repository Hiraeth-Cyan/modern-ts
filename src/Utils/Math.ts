// ========================================
// ./src/Utils/Math.ts
// ========================================

// 1. Basic numeric utilities

/**
 * Clamps a number between a minimum and maximum value.
 * @param n The number to clamp.
 * @param min The minimum allowed value.
 * @param max The maximum allowed value.
 * @returns The clamped number.
 */
export const clamp = (n: number, min: number, max: number): number =>
  Math.min(Math.max(n, min), max);

/**
 * Rounds a number to a specified number of decimal places.
 * @param n The number to round.
 * @param precision The number of decimal places (default: 0).
 * @returns The rounded number.
 */
export const round = (n: number, precision = 0): number => {
  // 利用指数移动小数点，避免直接乘法带来的精度偏移
  return Number(Math.round(Number(n + 'e' + precision)) + 'e-' + precision);
};
/**
 * Normalizes a value from a given range to [0, 1].
 * @param n The value to normalize.
 * @param min The minimum of the original range.
 * @param max The maximum of the original range.
 * @returns The normalized value in [0, 1].
 */
export const normalize = (n: number, min: number, max: number): number =>
  min === max ? 0 : (n - min) / (max - min);

/**
 * Computes the greatest common divisor (GCD) of two numbers.
 * @param a First number
 * @param b Second number
 * @returns The GCD (always non-negative)
 */
export const gcd = (a: number, b: number): number => {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b !== 0) {
    const temp = b;
    b = a % b;
    a = temp;
  }
  return a;
};

/**
 * Computes the least common multiple (LCM) of two numbers.
 * Uses safe calculation to prevent integer overflow.
 * @param a First number
 * @param b Second number
 * @returns The LCM (always non-negative), 0 if either input is 0
 */
export const lcm = (a: number, b: number): number => {
  if (a === 0 || b === 0) return 0;

  // 先除后乘，避免 (a * b) 溢出
  return Math.abs((a / gcd(a, b)) * b);
};

// 2. Range and interval utilities

/**
 * Checks if a number is within a specified range [min, max).
 * @param n The number to check.
 * @param min The inclusive lower bound.
 * @param max The exclusive upper bound.
 * @returns `true` if the number is in range.
 */
export const inRange = (n: number, min: number, max: number): boolean =>
  Number.isFinite(n) && n >= min && n < max;

/**
 * Generates an array of numbers from `start` to `end` (exclusive), incremented by `step`.
 * @param start The start of the range.
 * @param end The end of the range (exclusive).
 * @param step The increment between numbers (default: 1).
 * @returns An array of numbers.
 */
export const range = (start: number, end: number, step = 1): number[] => {
  if (step === 0 || !Number.isFinite(start) || !Number.isFinite(end)) return [];
  const length = Math.max(Math.ceil((end - start) / step), 0);
  return Array.from({length}, (_, i) => start + i * step);
};

/**
 * Like `range`, but returns numbers in reverse order.
 * @param start The start of the range.
 * @param end The end of the range (exclusive).
 * @param step The increment between numbers (default: 1).
 * @returns A reversed array of numbers.
 */
export const rangeRight = (start: number, end: number, step = 1): number[] => {
  if (step === 0 || !Number.isFinite(start) || !Number.isFinite(end)) return [];
  const len = Math.max(Math.ceil((end - start) / step), 0);
  return Array.from({length: len}, (_, i) => start + (len - 1 - i) * step);
};

/**
 * Maps a number from one range to another linearly.
 * @param n The input value.
 * @param inMin Minimum of the input range.
 * @param inMax Maximum of the input range.
 * @param outMin Minimum of the output range.
 * @param outMax Maximum of the output range.
 * @returns The mapped value.
 */
export const mapRange = (
  n: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number => {
  if (!Number.isFinite(n) || inMin === inMax) return outMin;
  return ((n - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
};

// Random number generation

/**
 * Generates a random floating-point number between `min` (inclusive) and `max` (exclusive).
 * @param min The minimum value (inclusive).
 * @param max The maximum value (exclusive).
 * @returns A random number in [min, max).
 */
export const random = (min: number, max: number): number =>
  Math.random() * (max - min) + min;

/**
 * Generates a random integer between `min` and `max` (both inclusive).
 * @param min The minimum integer (inclusive).
 * @param max The maximum integer (inclusive).
 * @returns A random integer in [min, max].
 */
export const randomInt = (min: number, max: number): number =>
  Math.floor(Math.random() * (max - min + 1)) + min;

// Aggregation & statistics

/**
 * Computes the sum of an array of numbers.
 * @param nums Array of numbers.
 * @returns The sum.
 */
export const sum = (nums: number[]): number => nums.reduce((a, b) => a + b, 0);

/**
 * Computes the sum of values extracted from an array using a selector function.
 * @param arr The input array.
 * @param getValue A function to extract numeric values from items.
 * @returns The sum of extracted values.
 */
export const sumBy = <T>(arr: T[], getValue: (item: T) => number): number =>
  arr.reduce((sum, item) => sum + getValue(item), 0);

/**
 * Computes the arithmetic mean (average) of an array of numbers.
 * @param nums Array of numbers.
 * @returns The mean, or 0 if the array is empty.
 */
export const mean = (nums: number[]): number =>
  nums.length === 0 ? 0 : sum(nums) / nums.length;

/**
 * Computes the arithmetic mean of values extracted from an array.
 * @param arr The input array.
 * @param getValue A function to extract numeric values from items.
 * @returns The mean of extracted values, or 0 if empty.
 */
export const meanBy = <T>(arr: T[], getValue: (item: T) => number): number =>
  arr.length ? sumBy(arr, getValue) / arr.length : 0;

/**
 * Computes the median of an array of numbers.
 * @param nums Array of numbers.
 * @returns The median value.
 */
export const median = (nums: number[]): number => {
  const s = [...nums].sort((a, b) => a - b),
    m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * Computes the median of values extracted from an array.
 * @param arr The input array.
 * @param getValue A function to extract numeric values from items.
 * @returns The median of extracted values.
 */
export const medianBy = <T>(
  arr: T[],
  getValue: (item: T) => number,
): number => {
  if (arr.length === 0) {
    return 0;
  }
  const v = arr.map(getValue).sort((a, b) => a - b),
    m = v.length >> 1;
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};

/**
 * Computes the standard deviation of an array of numbers.
 * @param nums Array of numbers.
 * @param isSample If `true`, computes sample standard deviation (Bessel's correction).
 * @returns The standard deviation.
 */
export const stdDev = (nums: number[], isSample = false): number => {
  if (nums.length === 0) return 0;
  if (isSample && nums.length === 1) return 0;
  const avg = mean(nums);
  const variance =
    sumBy(nums, (n) => (n - avg) ** 2) / (nums.length - (isSample ? 1 : 0));
  return Math.sqrt(variance);
};

// Comparison & approximation

/**
 * Checks if two numbers are approximately equal within a tolerance.
 * @param n1 First number.
 * @param n2 Second number.
 * @param epsilon Tolerance (default: 1e-10).
 * @returns `true` if |n1 - n2| < epsilon.
 */
export const approxEqual = (n1: number, n2: number, epsilon = 1e-10): boolean =>
  Math.abs(n1 - n2) < epsilon;

/**
 * Checks if a number is even.
 * @param n The number to check.
 * @returns `true` if even.
 */
export const isEven = (n: number): boolean => (n & 1) === 0;

/**
 * Checks if a number is odd.
 * @param n The number to check.
 * @returns `true` if odd.
 */
export const isOdd = (n: number): boolean => (n & 1) !== 0;

// Angle utilities

/**
 * Converts degrees to radians.
 * @param deg Angle in degrees.
 * @returns Angle in radians.
 */
export const toRadians = (deg: number): number => (deg * Math.PI) / 180;

/**
 * Converts radians to degrees.
 * @param rad Angle in radians.
 * @returns Angle in degrees.
 */
export const toDegrees = (rad: number): number => (rad * 180) / Math.PI;

/**
 * Wraps an angle in degrees to [0, 360).
 * @param deg Input angle in degrees.
 * @returns Wrapped angle in [0, 360).
 */
export const wrapAngle = (deg: number): number => ((deg % 360) + 360) % 360;

/**
 * Computes the smallest signed difference between two angles (in degrees).
 * Result is in [-180, 180].
 * @param a First angle in degrees.
 * @param b Second angle in degrees.
 * @returns The angular difference.
 */
export const angleDist = (a: number, b: number): number => {
  const d = (b - a + 180) % 360;
  return (d < 0 ? d + 360 : d) - 180;
};

// Geometric distance

/**
 * Computes the Euclidean distance between two 2D points.
 * @param x1 X-coordinate of the first point.
 * @param y1 Y-coordinate of the first point.
 * @param x2 X-coordinate of the second point.
 * @param y2 Y-coordinate of the second point.
 * @returns The distance.
 */
export const getDistance = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number => Math.hypot(x2 - x1, y2 - y1);

/**
 * Computes the squared Euclidean distance between two 2D points (faster, no sqrt).
 * @param x1 X-coordinate of the first point.
 * @param y1 Y-coordinate of the first point.
 * @param x2 X-coordinate of the second point.
 * @param y2 Y-coordinate of the second point.
 * @returns The squared distance.
 */
export const getDistanceSq = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number => (x2 - x1) ** 2 + (y2 - y1) ** 2;

// Linear interpolation

/**
 * Linearly interpolates between `start` and `end` by factor `t`.
 * @param start Start value.
 * @param end End value.
 * @param t Interpolation factor (0 = start, 1 = end).
 * @returns The interpolated value.
 */
export const lerp = (start: number, end: number, t: number): number =>
  start + t * (end - start);

/**
 * Computes a point on a quadratic Bezier curve.
 * @param p0 Start point {x, y}
 * @param p1 Control point {x, y}
 * @param p2 End point {x, y}
 * @param t Interpolation factor [0, 1]
 * @returns The interpolated point {x, y}
 */
export const bezier2 = (
  p0: {x: number; y: number},
  p1: {x: number; y: number},
  p2: {x: number; y: number},
  t: number,
) => {
  const mt = 1 - t;
  return {
    x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
    y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y,
  };
};
