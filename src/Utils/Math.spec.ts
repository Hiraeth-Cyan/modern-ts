// ============================================
// ./src/Utils/Math.spec.ts
// ============================================
import * as MathUtils from './Math';
import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';

const {
  clamp,
  round,
  normalize,
  gcd,
  lcm,
  inRange,
  range,
  rangeRight,
  mapRange,
  random,
  randomInt,
  sum,
  sumBy,
  mean,
  meanBy,
  median,
  medianBy,
  stdDev,
  approxEqual,
  isEven,
  isOdd,
  toRadians,
  toDegrees,
  wrapAngle,
  angleDist,
  getDistance,
  getDistanceSq,
  lerp,
  bezier2,
} = MathUtils;

describe.concurrent('MathUtils', () => {
  // ============================
  // 基础工具
  // ============================
  describe.concurrent('Basic numeric utilities', () => {
    describe('clamp', () => {
      it('should clamp within bounds', () => {
        // 测试正常范围内、低于下限、高于上限的情况
        expect(clamp(5, 0, 10)).toBe(5);
        expect(clamp(-1, 0, 10)).toBe(0); // 低于下限
        expect(clamp(11, 0, 10)).toBe(10); // 高于上限
        // 移除冗余测试：原测试未体现 inverted bounds，且断言重复
      });
    });

    describe('round', () => {
      it('should round to integer by default', () => {
        expect(round(3.1415)).toBe(3);
        expect(round(2.7182)).toBe(3);
      });

      it('should round to specified precision', () => {
        // 验证指定小数位数的四舍五入
        expect(round(3.1415, 2)).toBe(3.14);
        expect(round(2.7182, 3)).toBe(2.718);
        expect(round(1.005, 2)).toBe(1.01); // 避免浮点误差
      });
    });

    describe('normalize', () => {
      it('should normalize to [0,1]', () => {
        expect(normalize(5, 0, 10)).toBe(0.5);
        expect(normalize(0, 0, 10)).toBe(0);
        expect(normalize(10, 0, 10)).toBe(1);
      });

      it('should handle zero range', () => {
        // 当输入范围为零时，返回0避免除零错误
        expect(normalize(5, 10, 10)).toBe(0);
      });
    });
  });

  // ============================
  // 范围与区间
  // ============================
  describe.concurrent('Range and interval utilities', () => {
    describe('inRange', () => {
      it('should check number in [min, max)', () => {
        expect(inRange(5, 0, 10)).toBe(true);
        expect(inRange(0, 0, 10)).toBe(true);
        expect(inRange(10, 0, 10)).toBe(false);
        expect(inRange(Infinity, 0, 10)).toBe(false);
      });
    });

    describe('range', () => {
      it('should generate ascending sequence', () => {
        expect(range(0, 5)).toEqual([0, 1, 2, 3, 4]);
        expect(range(1, 5, 2)).toEqual([1, 3]);
        expect(range(5, 0, -1)).toEqual([5, 4, 3, 2, 1]);
      });

      it('should handle invalid parameters', () => {
        // 步长为0或无穷大时返回空数组
        expect(range(0, 5, 0)).toEqual([]);
        expect(range(0, 5, Infinity)).toEqual([]);
      });
    });

    describe('rangeRight', () => {
      it('should generate descending sequence', () => {
        expect(rangeRight(0, 5)).toEqual([4, 3, 2, 1, 0]);
        expect(rangeRight(1, 5, 2)).toEqual([3, 1]);
      });

      it('should return empty array for invalid parameters', () => {
        // 覆盖各种非法输入
        expect(rangeRight(0, 5, 0)).toEqual([]); // step=0
        expect(rangeRight(Infinity, 5)).toEqual([]); // 非有限数
        expect(rangeRight(0, NaN)).toEqual([]); // NaN
        expect(rangeRight(0, 5, Infinity)).toEqual([]); // 无限步长
      });
    });

    describe('mapRange', () => {
      it('should map values between ranges', () => {
        expect(mapRange(5, 0, 10, 0, 100)).toBe(50);
        expect(mapRange(0, 0, 10, 0, 100)).toBe(0);
        expect(mapRange(10, 0, 10, 0, 100)).toBe(100);
      });

      it('should handle zero input range', () => {
        // 输入范围为零时返回0
        expect(mapRange(5, 10, 10, 0, 100)).toBe(0);
      });
    });
  });

  // ============================
  // 随机数生成
  // ============================
  describe.concurrent('Random number generation', () => {
    beforeEach(() => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5); // 固定随机种子
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    describe('random', () => {
      it('should generate float in [min, max)', () => {
        // 利用固定种子验证映射关系
        expect(random(0, 10)).toBe(5);
        expect(random(-10, 10)).toBe(0);
      });
    });

    describe('randomInt', () => {
      it('should generate integer in [min, max]', () => {
        // 合并上下边界测试，使用 mockReturnValueOnce 分别模拟边界值
        vi.mocked(Math.random).mockReturnValueOnce(0.999); // 接近上限
        expect(randomInt(0, 10)).toBe(10);

        vi.mocked(Math.random).mockReturnValueOnce(0); // 下限
        expect(randomInt(0, 10)).toBe(0);
      });
    });
  });

  // ============================
  // 聚合统计
  // ============================
  describe.concurrent('Aggregation & statistics', () => {
    describe('sum & sumBy', () => {
      it('should calculate sum', () => {
        expect(sum([1, 2, 3])).toBe(6);
        expect(sum([])).toBe(0);

        const objs = [{v: 1}, {v: 2}, {v: 3}];
        expect(sumBy(objs, (o) => o.v)).toBe(6);
      });
    });

    describe('mean & meanBy', () => {
      it('should calculate mean', () => {
        expect(mean([1, 2, 3])).toBe(2);
        expect(mean([])).toBe(0);

        const objs = [{v: 1}, {v: 2}, {v: 3}];
        expect(meanBy(objs, (o) => o.v)).toBe(2);
        // 空数组场景
        expect(meanBy([], () => 100)).toBe(0);
      });
    });

    describe('median', () => {
      it('should calculate median correctly', () => {
        // 奇数长度
        expect(median([1, 2, 3])).toBe(2);
        // 偶数长度
        expect(median([1, 2, 3, 4])).toBe(2.5);
      });
    });

    describe('medianBy', () => {
      it('should calculate median by iteratee correctly', () => {
        // 奇数长度
        const oddObjs = [{v: 3}, {v: 1}, {v: 2}];
        expect(medianBy(oddObjs, (o) => o.v)).toBe(2);

        // 偶数长度
        const evenObjs = [{v: 1}, {v: 2}, {v: 3}, {v: 4}];
        expect(medianBy(evenObjs, (o) => o.v)).toBe(2.5); // (2+3)/2

        // 验证排序正确性（输入乱序）
        const unsortedObjs = [{v: 4}, {v: 1}, {v: 3}, {v: 2}];
        expect(medianBy(unsortedObjs, (o) => o.v)).toBe(2.5);

        // 空数组
        expect(medianBy([], () => 100)).toBe(0);
      });
    });

    describe('stdDev', () => {
      it('should calculate standard deviation', () => {
        // 样本标准差 (n-1)
        expect(stdDev([10, 12, 23, 23, 16, 23, 21, 16], true)).toBeCloseTo(
          5.237,
          3,
        );
        // 总体标准差 (n)
        expect(stdDev([10, 12, 23, 23, 16, 23, 21, 16], false)).toBeCloseTo(
          4.899,
          3,
        );

        expect(stdDev([], false)).toBe(0);
        expect(stdDev([5], true)).toBe(0); // 单样本
      });
    });
  });

  // ============================
  // 比较与近似
  // ============================
  describe.concurrent('Comparison & approximation', () => {
    describe('approxEqual', () => {
      it('should compare floats with tolerance', () => {
        expect(approxEqual(0.1 + 0.2, 0.3)).toBe(true);
        expect(approxEqual(1.0000001, 1.0000002, 1e-7)).toBe(true);
        expect(approxEqual(1, 2)).toBe(false);
      });
    });

    describe('isEven/isOdd', () => {
      it('should check parity', () => {
        expect(isEven(2)).toBe(true);
        expect(isEven(3)).toBe(false);
        expect(isOdd(3)).toBe(true);
        expect(isOdd(2)).toBe(false);

        // 负数支持
        expect(isEven(-2)).toBe(true);
        expect(isOdd(-3)).toBe(true);
      });
    });
  });

  // ============================
  // 角度工具
  // ============================
  describe.concurrent('Angle utilities', () => {
    describe('toRadians/toDegrees', () => {
      it('should convert between degrees and radians', () => {
        expect(toRadians(180)).toBe(Math.PI);
        expect(toDegrees(Math.PI)).toBe(180);
      });
    });

    describe('wrapAngle', () => {
      it('should wrap to [0, 360)', () => {
        expect(wrapAngle(360)).toBe(0);
        expect(wrapAngle(450)).toBe(90);
        expect(wrapAngle(-90)).toBe(270);
        expect(wrapAngle(720.5)).toBe(0.5);
      });
    });

    describe('angleDist', () => {
      it('should calculate smallest angular difference', () => {
        expect(angleDist(0, 90)).toBe(90);
        expect(angleDist(0, 270)).toBe(-90); // 最小路径
        expect(angleDist(10, 350)).toBe(-20);
        expect(angleDist(180, -180)).toBe(0);
      });
    });
  });

  // ============================
  // 几何距离
  // ============================
  describe.concurrent('Geometric distance', () => {
    describe('getDistance', () => {
      it('should calculate Euclidean distance', () => {
        expect(getDistance(0, 0, 3, 4)).toBe(5);
        expect(getDistance(1, 1, 4, 5)).toBe(5);
      });
    });

    describe('getDistanceSq', () => {
      it('should calculate squared distance and relate to getDistance', () => {
        // 合并两个测试：验证平方距离和与 getDistance 的关系
        expect(getDistanceSq(0, 0, 3, 4)).toBe(25);
        expect(getDistanceSq(1, 1, 4, 5)).toBe(25);

        const d = getDistance(0, 0, 3, 4);
        const dSq = getDistanceSq(0, 0, 3, 4);
        expect(d * d).toBe(dSq); // 验证平方关系
      });
    });
  });

  // ============================
  // 线性插值
  // ============================
  describe.concurrent('Linear interpolation', () => {
    describe('lerp', () => {
      it('should interpolate and extrapolate correctly', () => {
        // 合并基本插值和外推测试
        expect(lerp(0, 10, 0.5)).toBe(5);
        expect(lerp(10, 0, 0.5)).toBe(5);
        expect(lerp(0, 10, 0)).toBe(0);
        expect(lerp(0, 10, 1)).toBe(10);
        expect(lerp(0, 10, 1.5)).toBe(15); // 外推
        expect(lerp(0, 10, -0.5)).toBe(-5); // 外推
      });
    });
  });

  // ============================
  // 曲线插值
  // ============================
  describe.concurrent('Curve interpolation', () => {
    describe('bezier2', () => {
      it('should compute start/end points correctly', () => {
        const p0 = {x: 0, y: 0};
        const p1 = {x: 50, y: 100};
        const p2 = {x: 100, y: 0};

        // t=0 时应在起点
        expect(bezier2(p0, p1, p2, 0)).toEqual({x: 0, y: 0});
        // t=1 时应在终点
        expect(bezier2(p0, p1, p2, 1)).toEqual({x: 100, y: 0});
      });

      it('should compute mid-point correctly', () => {
        const p0 = {x: 0, y: 0};
        const p1 = {x: 0, y: 100}; // 垂直控制点
        const p2 = {x: 100, y: 100};

        // t=0.5 时应在 (25, 75)
        const mid = bezier2(p0, p1, p2, 0.5);
        expect(mid.x).toBeCloseTo(25);
        expect(mid.y).toBeCloseTo(75);
      });

      it('should handle negative coordinates', () => {
        const p0 = {x: -10, y: -20};
        const p1 = {x: 0, y: 0};
        const p2 = {x: 10, y: 20};

        const point = bezier2(p0, p1, p2, 0.3);
        expect(point.x).toBeCloseTo(-4.0);
        expect(point.y).toBeCloseTo(-8.0);
      });

      it('should handle edge cases (all points same)', () => {
        const p0 = {x: 100, y: 100};
        const p1 = {x: 100, y: 100}; // 所有点重合
        const p2 = {x: 100, y: 100};

        for (let t = 0; t <= 1; t += 0.25) {
          const pt = bezier2(p0, p1, p2, t);
          expect(pt.x).toBe(100);
          expect(pt.y).toBe(100);
        }
      });

      it('should handle t outside [0,1] (extrapolation)', () => {
        const p0 = {x: 0, y: 0};
        const p1 = {x: 50, y: 50};
        const p2 = {x: 100, y: 0};

        // t = -0.5 时：
        // mt = 1.5
        // x = (1.5^2)*0 + 2*(1.5)*(-0.5)*50 + (-0.5)^2*100 = 0 -75 + 25 = -50
        // y = (1.5^2)*0 + 2*(1.5)*(-0.5)*50 + (-0.5)^2*0 = 0 -75 + 0 = -75
        const before = bezier2(p0, p1, p2, -0.5);
        expect(before.x).toBeCloseTo(-50);
        expect(before.y).toBeCloseTo(-75);

        // t = 1.5 时：
        // mt = -0.5
        // x = (-0.5^2)*0 + 2*(-0.5)*(1.5)*50 + (1.5^2)*100 = 0 -75 + 225 = 150
        // y = (-0.5^2)*0 + 2*(-0.5)*(1.5)*50 + (1.5^2)*0 = 0 -75 + 0 = -75
        const after = bezier2(p0, p1, p2, 1.5);
        expect(after.x).toBeCloseTo(150);
        expect(after.y).toBeCloseTo(-75);
      });
    });
  });

  // ============================
  // 数论函数
  // ============================
  describe.concurrent('Number theory functions', () => {
    describe('gcd', () => {
      it('should compute GCD for positive numbers', () => {
        expect(gcd(12, 18)).toBe(6);
        expect(gcd(8, 12)).toBe(4);
        expect(gcd(7, 13)).toBe(1); // 互质
        expect(gcd(24, 36)).toBe(12);
      });

      it('should handle negative numbers', () => {
        expect(gcd(-12, 18)).toBe(6);
        expect(gcd(12, -18)).toBe(6);
        expect(gcd(-12, -18)).toBe(6);
      });

      it('should handle zero cases', () => {
        expect(gcd(0, 5)).toBe(5);
        expect(gcd(5, 0)).toBe(5);
        expect(gcd(0, 0)).toBe(0); // 特殊情况
      });

      it('should handle large numbers', () => {
        expect(gcd(1071, 462)).toBe(21); // 欧几里得经典例子
        expect(gcd(999999999, 1000000000)).toBe(1);
      });
    });

    describe('lcm', () => {
      it('should compute LCM for positive numbers', () => {
        expect(lcm(12, 18)).toBe(36);
        expect(lcm(8, 12)).toBe(24);
        expect(lcm(7, 13)).toBe(91); // 互质时为乘积
        expect(lcm(24, 36)).toBe(72);
      });

      it('should handle negative numbers', () => {
        expect(lcm(-12, 18)).toBe(36);
        expect(lcm(12, -18)).toBe(36);
        expect(lcm(-12, -18)).toBe(36);
      });

      it('should handle zero cases', () => {
        expect(lcm(0, 5)).toBe(0);
        expect(lcm(5, 0)).toBe(0);
        expect(lcm(0, 0)).toBe(0);
      });

      it('should handle large numbers without overflow', () => {
        // 合并大数溢出测试，覆盖多个场景
        const largeNum1 = 999999937; // 大质数
        const largeNum2 = 999999929; // 另一个大质数

        // 验证计算过程不会抛出错误
        expect(() => lcm(largeNum1, largeNum2)).not.toThrow();

        // 验证结果正确（互质时 LCM = 乘积）
        expect(lcm(largeNum1, largeNum2)).toBe(largeNum1 * largeNum2);

        // 测试相等的大数，避免先乘后除溢出
        const a = 1000000000000000; // 1e15
        const b = 1000000000000000;
        expect(lcm(a, b)).toBe(a);
      });
    });
  });
});
