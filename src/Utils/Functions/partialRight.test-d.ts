// ========================================
// ./src/Utils/Functions/partialRight.test-d.ts
// ========================================

import {expectIdentical} from '../type-tool';
import {partialRight} from './partial';

// ===================================================================
// 🐱 基础参数固定测试（从右侧固定）
// ===================================================================

// @ts-expect-error: 非函数参数
partialRight('不是函数', 1);

declare const add: (a: number, b: number, c: number) => number;

// -- 固定 0 个参数 --
// @ts-expect-error 毫无意义
partialRight(add);

// -- 固定 1 个参数（从右侧，即固定 c）--
const partialRight1 = partialRight(add, 3);
expectIdentical<(this: unknown, a: number, b: number) => number>()(
  partialRight1,
);
expectIdentical<number>()(partialRight1(1, 2));
// @ts-expect-error: 参数不足喵！
partialRight1(1);
// @ts-expect-error: 参数类型错误喵！
partialRight1('not a number', 2);

// -- 固定 2 个参数（从右侧，即固定 b 和 c）--
const partialRight2 = partialRight(add, 2, 3);
expectIdentical<(this: unknown, a: number) => number>()(partialRight2);
expectIdentical<number>()(partialRight2(1));
// @ts-expect-error: 只需要 1 个参数喵！
partialRight2(1, 4);
// @ts-expect-error: 参数类型错误喵！
partialRight2('not a number');

// -- 固定所有参数 --
const partialRightAll = partialRight(add, 1, 2, 3);
expectIdentical<(this: unknown) => number>()(partialRightAll);
expectIdentical<number>()(partialRightAll());
// @ts-expect-error: 无参数函数不能传参喵！
partialRightAll(4);

// -- 固定超过原函数参数数量 --
// @ts-expect-error: 参数数量超过原函数参数数量喵！
partialRight(add, 1, 2, 3, 4, 5);

// ===================================================================
// 🎀 可选参数保留测试
// ===================================================================

declare const optionalFunc: (a: number, b?: string, c?: boolean) => string;

// -- 固定 1 个参数（从右侧，即固定 c）--
const optPartialRight1 = partialRight(optionalFunc, true);
expectIdentical<(this: unknown, a: number, b?: string) => string>()(
  optPartialRight1,
);
expectIdentical<string>()(optPartialRight1(42));
expectIdentical<string>()(optPartialRight1(42, 'hello'));
// @ts-expect-error: 参数类型错误喵！
optPartialRight1('not a number');

// -- 固定 2 个参数（从右侧，即固定 b 和 c）--
const optPartialRight2 = partialRight(optionalFunc, 'hello', true);
expectIdentical<(this: unknown, a: number) => string>()(optPartialRight2);
expectIdentical<string>()(optPartialRight2(42));
// @ts-expect-error: 只需要 1 个参数喵！
optPartialRight2(42, 'extra');

// -- 固定所有参数 --
const optPartialRightAll = partialRight(optionalFunc, 42, 'hello', true);
expectIdentical<(this: unknown) => string>()(optPartialRightAll);
expectIdentical<string>()(optPartialRightAll());

// ===================================================================
// 🛡️ 默认参数测试
// ===================================================================

const withDefaults = (a: number, b: number = 10, c: number = 20) => a + b + c;

// -- 固定 1 个参数（从右侧，即固定 c）--
const defPartialRight1 = partialRight(withDefaults, 15);
expectIdentical<(this: unknown, a: number, b?: number) => number>()(
  defPartialRight1,
);
expectIdentical<number>()(defPartialRight1(1));
expectIdentical<number>()(defPartialRight1(1, 5));

// -- 固定 2 个参数（从右侧，即固定 b 和 c）--
const defPartialRight2 = partialRight(withDefaults, 5, 15);
expectIdentical<(this: unknown, a: number) => number>()(defPartialRight2);
expectIdentical<number>()(defPartialRight2(1));

// ===================================================================
// ✨ Rest 参数函数测试（应该报错）
// ===================================================================

// Rest 参数无法从右边固定参数，应该报错
declare const sumAll: (...args: number[]) => number;

// @ts-expect-error: Rest 参数函数不能使用 partialRight 喵！
partialRight(sumAll, 4, 5);

// @ts-expect-error: Rest 参数函数不能使用 partialRight 喵！
partialRight(sumAll);

// -- 混合参数与 Rest（也应该报错）--
declare const mixedRest: (a: string, b: number, ...rest: boolean[]) => string;

// @ts-expect-error: 带 Rest 参数的函数不能使用 partialRight 喵！
partialRight(mixedRest, true, false);

// @ts-expect-error: 带 Rest 参数的函数不能使用 partialRight 喵！
partialRight(mixedRest);

// ===================================================================
// 🌟 高级类型场景测试
// ===================================================================

// -- 异步函数 --
declare const asyncAdd: (a: number, b: number) => Promise<number>;
const asyncPartialRight1 = partialRight(asyncAdd, 2);
expectIdentical<(this: unknown, a: number) => Promise<number>>()(
  asyncPartialRight1,
);
// @ts-expect-error: 返回值是 Promise<number> 喵～
expectIdentical<number>()(asyncPartialRight1(1));

// -- 泛型函数 --
declare const identity: <T>(val: T, _unused: number) => T;
const identityPartialRight = partialRight(identity<string>, 42);
expectIdentical<(this: unknown, val: string) => string>()(identityPartialRight);
expectIdentical<string>()(identityPartialRight('hello'));

// -- 函数作为参数 --
declare const applyFunc: (fn: (x: number) => number, x: number) => number;
const applyPartialRight1 = partialRight(applyFunc, 5);
expectIdentical<(this: unknown, fn: (x: number) => number) => number>()(
  applyPartialRight1,
);
expectIdentical<number>()(applyPartialRight1((x) => x * 2));
// @ts-expect-error: 参数类型错误喵！
applyPartialRight1('not a function');

// -- 元组类型参数 --
declare const tupleFunc: (a: [number, string], b: boolean) => string;
const tuplePartialRight1 = partialRight(tupleFunc, true);
expectIdentical<(this: unknown, a: [number, string]) => string>()(
  tuplePartialRight1,
);
expectIdentical<string>()(tuplePartialRight1([1, 'meow']));
// @ts-expect-error: 元组类型不匹配喵！
tuplePartialRight1([1, 2]);

// -- 联合类型参数 --
declare const unionFunc: (a: string | number, _b: boolean) => number;
const unionPartialRight1 = partialRight(unionFunc, true);
expectIdentical<(this: unknown, a: string | number) => number>()(
  unionPartialRight1,
);
expectIdentical<number>()(unionPartialRight1('hello'));
// @ts-expect-error: 参数类型错误喵！
unionPartialRight1(true);

// -- 交叉类型参数 --
type Point = {x: number; y: number};
type Color = {r: number; g: number; b: number};
declare const crossFunc: (point: Point & Color, z: number) => number;
const crossPartialRight1 = partialRight(crossFunc, 10);
expectIdentical<(this: unknown, point: Point & Color) => number>()(
  crossPartialRight1,
);
expectIdentical<number>()(crossPartialRight1({x: 1, y: 2, r: 3, g: 4, b: 5}));
// @ts-expect-error: 缺少属性喵！
crossPartialRight1({x: 1, y: 2});

// ===================================================================
// 🚀 This 绑定测试
// ===================================================================

declare const contextObj: {
  base: number;
  add(this: {base: number}, a: number, b: number): number;
};

// eslint-disable-next-line @typescript-eslint/unbound-method
const methodPartialRight1 = partialRight(contextObj.add, 2);
expectIdentical<(this: {base: number}, a: number) => number>()(
  methodPartialRight1,
);
expectIdentical<number>()(methodPartialRight1.call({base: 20}, 1));

// ===================================================================
// 🎨 非字面量元组长度参数测试
// ===================================================================

const args: number[] = [2, 3];
// 非固定长度元组时错误
// @ts-expect-error: 非固定长度元组不能作为固定参数喵！
partialRight(add, ...args);

// ===================================================================
// 🔢 边界情况测试
// ===================================================================

// -- 零参数函数 --
declare const noArgs: () => number;
// @ts-expect-error 毫无意义
partialRight(noArgs);

// -- 单参数函数 --
declare const singleArg: (x: number) => number;
const singlePartial = partialRight(singleArg, 5);
expectIdentical<(this: unknown) => number>()(singlePartial);
expectIdentical<number>()(singlePartial());

// ===================================================================
// 🧪 复杂链式调用测试
// ===================================================================

// -- 多次应用 partialRight（应该报错，因为返回函数使用 rest 参数形式）--
// @ts-expect-error: partialRight 是工厂函数，返回的函数使用 rest 参数形式，不能再次应用 partialRight 喵！
const doublePartialRight = partialRight(partialRight(add, 2, 3), 1);

// -- 与其他函数组合 --
declare const mapFunc: <T, U>(arr: T[], fn: (x: T) => U) => U[];
const mapPartialRight1 = partialRight(
  mapFunc<number, string>,
  (x: number) => `val-${x}`,
);
expectIdentical<(this: unknown, arr: number[]) => string[]>()(mapPartialRight1);
expectIdentical<string[]>()(mapPartialRight1([1, 2, 3]));

// ===================================================================
// 🚀 极端压力测试 (200个参数)
// ===================================================================

type BuildTuple<
  N extends number,
  T extends unknown[] = [],
> = T['length'] extends N ? T : BuildTuple<N, [...T, number]>;

type Args200 = BuildTuple<200>;

declare const sum200: (...args: Args200) => number;

// -- 固定 100 个参数（从右侧固定）--
// prettier-ignore
const partialRight100 = partialRight(sum200, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143, 144, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154, 155, 156, 157, 158, 159, 160, 161, 162, 163, 164, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174, 175, 176, 177, 178, 179, 180, 181, 182, 183, 184, 185, 186, 187, 188, 189, 190, 191, 192, 193, 194, 195, 196, 197, 198, 199, 200);
// prettier-ignore
expectIdentical<(this: unknown, rest_0: number, rest_1: number, rest_2: number, rest_3: number, rest_4: number, rest_5: number, rest_6: number, rest_7: number, rest_8: number, rest_9: number, rest_10: number, rest_11: number, rest_12: number, rest_13: number, rest_14: number, rest_15: number, rest_16: number, rest_17: number, rest_18: number, rest_19: number, rest_20: number, rest_21: number, rest_22: number, rest_23: number, rest_24: number, rest_25: number, rest_26: number, rest_27: number, rest_28: number, rest_29: number, rest_30: number, rest_31: number, rest_32: number, rest_33: number, rest_34: number, rest_35: number, rest_36: number, rest_37: number, rest_38: number, rest_39: number, rest_40: number, rest_41: number, rest_42: number, rest_43: number, rest_44: number, rest_45: number, rest_46: number, rest_47: number, rest_48: number, rest_49: number, rest_50: number, rest_51: number, rest_52: number, rest_53: number, rest_54: number, rest_55: number, rest_56: number, rest_57: number, rest_58: number, rest_59: number, rest_60: number, rest_61: number, rest_62: number, rest_63: number, rest_64: number, rest_65: number, rest_66: number, rest_67: number, rest_68: number, rest_69: number, rest_70: number, rest_71: number, rest_72: number, rest_73: number, rest_74: number, rest_75: number, rest_76: number, rest_77: number, rest_78: number, rest_79: number, rest_80: number, rest_81: number, rest_82: number, rest_83: number, rest_84: number, rest_85: number, rest_86: number, rest_87: number, rest_88: number, rest_89: number, rest_90: number, rest_91: number, rest_92: number, rest_93: number, rest_94: number, rest_95: number, rest_96: number, rest_97: number, rest_98: number, rest_99: number) => number>()(partialRight100);

// prettier-ignore
expectIdentical<number>()(partialRight100(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100));
// @ts-expect-error: 参数类型错误喵！
partialRight100('not a number');

// -- 固定 200 个参数（完整参数） --
// prettier-ignore
const partialRight200 = partialRight(sum200, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143, 144, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154, 155, 156, 157, 158, 159, 160, 161, 162, 163, 164, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174, 175, 176, 177, 178, 179, 180, 181, 182, 183, 184, 185, 186, 187, 188, 189, 190, 191, 192, 193, 194, 195, 196, 197, 198, 199, 200);
expectIdentical<(this: unknown) => number>()(partialRight200);
expectIdentical<number>()(partialRight200());
// @ts-expect-error: 无参数函数不能传参喵！
partialRight200(1);

// -- 固定参数类型错误检测 --
// prettier-ignore
// @ts-expect-error: 第 100 个参数类型错误喵～
partialRight(sum200, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, '有点想报错了喵', 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143, 144, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154, 155, 156, 157, 158, 159, 160, 161, 162, 163, 164, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174, 175, 176, 177, 178, 179, 180, 181, 182, 183, 184, 185, 186, 187, 188, 189, 190, 191, 192, 193, 194, 195, 196, 197, 198, 199, 200);

// -- 固定超过原函数参数数量检测 --
// prettier-ignore
// @ts-expect-error: 参数数量超过原函数参数数量喵！
partialRight(sum200, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143, 144, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154, 155, 156, 157, 158, 159, 160, 161, 162, 163, 164, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174, 175, 176, 177, 178, 179, 180, 181, 182, 183, 184, 185, 186, 187, 188, 189, 190, 191, 192, 193, 194, 195, 196, 197, 198, 199, 200, 201);
