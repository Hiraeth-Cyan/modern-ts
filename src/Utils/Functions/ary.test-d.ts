// ========================================
// ./src/Utils/Functions/ary.test-d.ts
// ========================================

import {expectIdentical} from '../type-tool';
import {ary, binary, trinary} from './ary';

// ===================================================================
// 🐱 基础参数截取测试
// ===================================================================

// @ts-expect-error: 非函数参数
ary('不是函数', 1);

declare const add: (a: number, b: number, c: number) => number;

// -- 截取 0 个参数 --
const ary0 = ary(add, 0);
expectIdentical<() => number>()(ary0);
// @ts-expect-error: 无参数函数调用时不能传参喵！
ary0(1);

// -- 截取 1 个参数 --
const ary1 = ary(add, 1);
expectIdentical<(a: number) => number>()(ary1);
expectIdentical<number>()(ary1(1));
// @ts-expect-error: 只接受 1 个参数喵！
ary1(1, 2);
// @ts-expect-error: 参数类型错误喵！
ary1('not a number');

// -- 截取 2 个参数 --
const ary2 = ary(add, 2);
expectIdentical<(a: number, b: number) => number>()(ary2);
expectIdentical<number>()(ary2(1, 2));
// @ts-expect-error: 只接受 2 个参数喵！
ary2(1, 2, 3);
// @ts-expect-error: 第二个参数类型错误喵！
ary2(1, 'not a number');

// -- 截取 3 个参数（完整参数） --
const ary3 = ary(add, 3);
expectIdentical<(a: number, b: number, c: number) => number>()(ary3);
expectIdentical<number>()(ary3(1, 2, 3));
// @ts-expect-error: 只接受 3 个参数喵！
ary3(1, 2, 3, 4);

// -- 截取超过原函数参数数量 --
// @ts-expect-error 只接受 3 个参数喵！
ary(add, 5);

// ===================================================================
// 🎀 可选参数保留测试
// ===================================================================

declare const OneoptionalFunc: (a?: number) => string;
const AryOneoptionalFunc = ary(OneoptionalFunc, 1);
expectIdentical<(a?: number) => string>()(AryOneoptionalFunc);
expectIdentical<string>()(AryOneoptionalFunc(42));

declare const optionalFunc: (a: number, b?: string, c?: boolean) => string;

// -- 截取 1 个参数，保留可选性 --
const optAry1 = ary(optionalFunc, 1);
expectIdentical<(a: number) => string>()(optAry1);
expectIdentical<string>()(optAry1(42));

// -- 截取 2 个参数，第二个参数保留可选性 --
const optAry2 = ary(optionalFunc, 2);
expectIdentical<(a: number, b?: string) => string>()(optAry2);
expectIdentical<string>()(optAry2(42));
expectIdentical<string>()(optAry2(42, 'hello'));
// @ts-expect-error: 第二个参数类型错误喵！
optAry2(42, 123);

// -- 截取 3 个参数，全部保留可选性 --
const optAry3 = ary(optionalFunc, 3);
expectIdentical<(a: number, b?: string, c?: boolean) => string>()(optAry3);
expectIdentical<string>()(optAry3(42));
expectIdentical<string>()(optAry3(42, 'hello'));
expectIdentical<string>()(optAry3(42, 'hello', true));

// ===================================================================
// 🛡️ 默认参数测试
// ===================================================================

const withDefaults = (a: number, b: number = 10, c: number = 20) => a + b + c;

// -- 截取 1 个参数 --
const defAry1 = ary(withDefaults, 1);
expectIdentical<(a: number) => number>()(defAry1);
expectIdentical<number>()(defAry1(1));

// -- 截取 2 个参数，第二个参数保留默认值特性 --
const defAry2 = ary(withDefaults, 2);
expectIdentical<(a: number, b?: number) => number>()(defAry2);
expectIdentical<number>()(defAry2(1));
expectIdentical<number>()(defAry2(1, 5));

// ===================================================================
// ✨ Rest 参数函数测试
// ===================================================================

declare const sumAll: (...args: number[]) => number;

// -- Rest 参数函数不受截断影响 --
const restAry2 = ary(sumAll, 2);
// Rest 参数函数被截断
expectIdentical<(this: unknown, args_0: number, args_1: number) => number>()(
  restAry2,
);
expectIdentical<number>()(restAry2(1, 2));
// @ts-expect-error: 参数类型错误喵！
restAry2(1, 'not a number');

// -- 混合参数与 Rest --
declare const mixedRest: (a: string, b: number, ...rest: boolean[]) => string;
const mixedAry = ary(mixedRest, 3);
// Rest 参数函数被截断
expectIdentical<
  (this: unknown, args_0: string, args_1: number, args_2: boolean) => string
>()(mixedAry);
expectIdentical<string>()(mixedAry('hello', 42, true));

// ===================================================================
// 🌟 高级类型场景测试
// ===================================================================

// -- 异步函数 --
declare const asyncAdd: (a: number, b: number) => Promise<number>;
const asyncAry1 = ary(asyncAdd, 1);
expectIdentical<(a: number) => Promise<number>>()(asyncAry1);
// @ts-expect-error: 返回值是 Promise<number> 喵～
expectIdentical<number>()(asyncAry1(1));

// -- 泛型函数 --
declare const identity: <T>(val: T, _unused: number) => T;
const identityAry = ary(identity<string>, 1);
expectIdentical<(val: string) => string>()(identityAry);
expectIdentical<string>()(identityAry('meow'));

// -- 函数作为参数 --
declare const applyFunc: (fn: (x: number) => number, x: number) => number;
const applyAry1 = ary(applyFunc, 1);
expectIdentical<(fn: (x: number) => number) => number>()(applyAry1);
declare const double: (x: number) => number;
expectIdentical<number>()(applyAry1(double));
// @ts-expect-error: 函数签名不匹配喵！
applyAry1((x: string) => x.length);

// -- 元组类型参数 --
declare const tupleFunc: (a: [number, string], b: boolean) => string;
const tupleAry1 = ary(tupleFunc, 1);
expectIdentical<(a: [number, string]) => string>()(tupleAry1);
const args: [number, string] = [1, 'meow'];
expectIdentical<string>()(tupleAry1(args));
// @ts-expect-error: 元组类型不匹配喵！
tupleAry1([1, 2]);

// -- 联合类型参数 --
declare const unionFunc: (a: string | number, _b: boolean) => number;
const unionAry1 = ary(unionFunc, 1);
expectIdentical<(a: string | number) => number>()(unionAry1);
expectIdentical<number>()(unionAry1('hello'));
expectIdentical<number>()(unionAry1(42));
// @ts-expect-error: 联合类型不包含 boolean 喵！
unionAry1(true);

// -- 交叉类型参数 --
type Point = {x: number; y: number};
type Color = {r: number; g: number; b: number};
declare const crossFunc: (point: Point & Color, z: number) => number;
const crossAry1 = ary(crossFunc, 1);
expectIdentical<(point: Point & Color) => number>()(crossAry1);
expectIdentical<number>()(crossAry1({x: 1, y: 2, r: 3, g: 4, b: 5}));
// @ts-expect-error: 缺少属性喵！
crossAry1({x: 1, y: 2});

// ===================================================================
// 🚀 This 绑定测试
// ===================================================================

declare const contextObj: {
  base: number;
  add(this: {base: number}, a: number, b: number): number;
};

// eslint-disable-next-line @typescript-eslint/unbound-method
const methodAry1 = ary(contextObj.add, 1);
expectIdentical<(this: {base: number}, a: number) => number>()(methodAry1);
expectIdentical<number>()(methodAry1.call({base: 20}, 1));

// ===================================================================
// 🎨 非字面量 length 参数测试
// ===================================================================

const n = 1 - 0;
expectIdentical<number>()(n);
// @ts-expect-error 不是字面量喵！
expectIdentical<1>()(n);

// @ts-expect-error 非字面量 length 参数喵！
ary(add, n);

// @ts-expect-error 非正整数参数
ary(add, -1);

// @ts-expect-error 非正整数参数
ary(add, -0.11);

// @ts-expect-error 非字面量
ary(add, NaN);
// @ts-expect-error 非字面量
ary(add, Infinity);

// ===================================================================
// 🔢 边界情况测试
// ===================================================================

// -- 零参数函数 --
declare const noArgs: () => number;
// @ts-expect-error: 0参数无意义
ary(noArgs, 0);

// -- 单参数函数 --
declare const singleArg: (x: number) => number;
const singleAry1 = ary(singleArg, 1);
expectIdentical<(x: number) => number>()(singleAry1);
expectIdentical<number>()(singleAry1(5));
// @ts-expect-error: 只接受 1 个参数喵！
singleAry1(5, 10);

// @ts-expect-error: 函数至少要有2个参数
binary(singleArg);

// @ts-expect-error: 函数至少要有3个参数
trinary(singleArg);

// -- 截取为 0 参数 --
const singleAry0 = ary(singleArg, 0);
expectIdentical<() => number>()(singleAry0);
expectIdentical<number>()(singleAry0());

// ===================================================================
// 🧪 复杂链式调用测试
// ===================================================================

// -- 多次应用 ary --
const doubleAry = ary(ary(add, 2), 1);
expectIdentical<(a: number) => number>()(doubleAry);
expectIdentical<number>()(doubleAry(1));

// -- 与其他函数组合 --
declare const mapFunc: <T, U>(arr: T[], fn: (x: T) => U) => U[];
const mapAry1 = ary(mapFunc, 1);
expectIdentical<(arr: unknown[]) => unknown[]>()(mapAry1);

// ===================================================================
// 🚀 极端压力测试 (100个参数)
// ===================================================================

type BuildTuple<
  N extends number,
  T extends unknown[] = [],
> = T['length'] extends N ? T : BuildTuple<N, [...T, number]>;

type Args100 = BuildTuple<100>;

declare const sum100: (...args: Args100) => number;

const ary50 = ary(sum100, 50);
// prettier-ignore
expectIdentical<(this: unknown, args_0: number, args_1: number, args_2: number, args_3: number, args_4: number, args_5: number, args_6: number, args_7: number, args_8: number, args_9: number, args_10: number, args_11: number, args_12: number, args_13: number, args_14: number, args_15: number, args_16: number, args_17: number, args_18: number, args_19: number, args_20: number, args_21: number, args_22: number, args_23: number, args_24: number, args_25: number, args_26: number, args_27: number, args_28: number, args_29: number, args_30: number, args_31: number, args_32: number, args_33: number, args_34: number, args_35: number, args_36: number, args_37: number, args_38: number, args_39: number, args_40: number, args_41: number, args_42: number, args_43: number, args_44: number, args_45: number, args_46: number, args_47: number, args_48: number, args_49: number) => number>()(ary50);

// -- 截取 100 个参数（完整参数） --
const ary100 = ary(sum100, 100);

// prettier-ignore
expectIdentical<(this: unknown, args_0: number, args_1: number, args_2: number, args_3: number, args_4: number, args_5: number, args_6: number, args_7: number, args_8: number, args_9: number, args_10: number, args_11: number, args_12: number, args_13: number, args_14: number, args_15: number, args_16: number, args_17: number, args_18: number, args_19: number, args_20: number, args_21: number, args_22: number, args_23: number, args_24: number, args_25: number, args_26: number, args_27: number, args_28: number, args_29: number, args_30: number, args_31: number, args_32: number, args_33: number, args_34: number, args_35: number, args_36: number, args_37: number, args_38: number, args_39: number, args_40: number, args_41: number, args_42: number, args_43: number, args_44: number, args_45: number, args_46: number, args_47: number, args_48: number, args_49: number, args_50: number, args_51: number, args_52: number, args_53: number, args_54: number, args_55: number, args_56: number, args_57: number, args_58: number, args_59: number, args_60: number, args_61: number, args_62: number, args_63: number, args_64: number, args_65: number, args_66: number, args_67: number, args_68: number, args_69: number, args_70: number, args_71: number, args_72: number, args_73: number, args_74: number, args_75: number, args_76: number, args_77: number, args_78: number, args_79: number, args_80: number, args_81: number, args_82: number, args_83: number, args_84: number, args_85: number, args_86: number, args_87: number, args_88: number, args_89: number, args_90: number, args_91: number, args_92: number, args_93: number, args_94: number, args_95: number, args_96: number, args_97: number, args_98: number, args_99: number) => number>()(ary100);

// -- 调用 100 个参数的函数 --
// prettier-ignore
expectIdentical<number>()(ary100(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100));

// -- 参数类型错误检测 --
// prettier-ignore
// @ts-expect-error: 第 50 个参数类型错误喵～
ary100(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, '有点想报错了喵', 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100);

// -- 参数溢出检测 --
// prettier-ignore
// @ts-expect-error: 传入 101 个参数啦！
ary100(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101);

// -- 参数不足检测 --
// prettier-ignore
// @ts-expect-error: 只传了 99 个参数喵！
ary100(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99);
