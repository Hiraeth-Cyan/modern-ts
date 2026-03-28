// ========================================
// ./src/Utils/Functions/partial.test-d.ts
// ========================================

import {expectIdentical} from '../type-tool';
import {partial} from './partial';

// ===================================================================
// 🐱 基础参数固定测试
// ===================================================================
// @ts-expect-error: 非函数参数
partial('不是函数', 1);

declare const add: (a: number, b: number, c: number) => number;

// -- 固定 0 个参数 --
// @ts-expect-error: 毫无意义
partial(add);

// -- 固定 1 个参数 --
const partial1 = partial(add, 1);
expectIdentical<(b: number, c: number) => number>()(partial1);
expectIdentical<number>()(partial1(2, 3));
// @ts-expect-error: 参数不足喵！
partial1(2);
// @ts-expect-error: 参数类型错误喵！
partial1('not a number', 3);

// -- 固定 2 个参数 --
const partial2 = partial(add, 1, 2);
expectIdentical<(this: unknown, c: number) => number>()(partial2);
expectIdentical<number>()(partial2(3));
// @ts-expect-error: 只需要 1 个参数喵！
partial2(3, 4);
// @ts-expect-error: 参数类型错误喵！
partial2('not a number');

// -- 固定所有参数 --
const partialAll = partial(add, 1, 2, 3);
expectIdentical<(this: unknown) => number>()(partialAll);
expectIdentical<number>()(partialAll());
// @ts-expect-error: 无参数函数不能传参喵！
partialAll(4);

// -- 固定超过原函数参数数量 --
// @ts-expect-error: 参数数量超过原函数参数数量喵！
partial(add, 1, 2, 3, 4, 5);

// ===================================================================
// 🎀 可选参数保留测试
// ===================================================================

declare const optionalFunc: (a: number, b?: string, c?: boolean) => string;

// -- 固定 1 个参数，保留剩余可选性 --
const optPartial1 = partial(optionalFunc, 42);
expectIdentical<(this: unknown, b?: string, c?: boolean) => string>()(
  optPartial1,
);
expectIdentical<string>()(optPartial1());
expectIdentical<string>()(optPartial1('hello'));
expectIdentical<string>()(optPartial1('hello', true));
// @ts-expect-error: 参数类型错误喵！
optPartial1(123);

// -- 固定 2 个参数，第三个参数保留可选性 --
const optPartial2 = partial(optionalFunc, 42, 'hello');
expectIdentical<(this: unknown, c?: boolean) => string>()(optPartial2);
expectIdentical<string>()(optPartial2());
expectIdentical<string>()(optPartial2(true));
// @ts-expect-error: 参数类型错误喵！
optPartial2('not a boolean');

// -- 固定所有参数 --
const optPartialAll = partial(optionalFunc, 42, 'hello', true);
expectIdentical<(this: unknown) => string>()(optPartialAll);
expectIdentical<string>()(optPartialAll());

// ===================================================================
// 🛡️ 默认参数测试
// ===================================================================

declare const withDefaults: (a: number, b?: number, c?: number) => number;

// -- 固定 1 个参数 --
const defPartial1 = partial(withDefaults, 1);
expectIdentical<(this: unknown, b?: number, c?: number) => number>()(
  defPartial1,
);
expectIdentical<number>()(defPartial1());
expectIdentical<number>()(defPartial1(5));
expectIdentical<number>()(defPartial1(5, 15));

// -- 固定 2 个参数 --
const defPartial2 = partial(withDefaults, 1, 5);
expectIdentical<(this: unknown, c?: number) => number>()(defPartial2);
expectIdentical<number>()(defPartial2());
expectIdentical<number>()(defPartial2(15));

// ===================================================================
// ✨ Rest 参数函数测试
// ===================================================================

declare const sumAll: (...args: number[]) => number;

// -- Rest 参数函数固定参数 --
const restPartial2 = partial(sumAll, 1, 2);
expectIdentical<(this: unknown, ...args: number[]) => number>()(restPartial2);
expectIdentical<number>()(restPartial2(3, 4, 5));
expectIdentical<number>()(restPartial2());
// @ts-expect-error: Rest 参数类型错误喵！
restPartial2('not a number');

// -- 混合参数与 Rest --
declare const mixedRest: (a: string, b: number, ...rest: boolean[]) => string;
const mixedPartial = partial(mixedRest, 'hello', 42);
expectIdentical<(this: unknown, ...rest: boolean[]) => string>()(mixedPartial);
expectIdentical<string>()(mixedPartial(true, false, true));
expectIdentical<string>()(mixedPartial());
// @ts-expect-error: Rest 参数类型错误喵！
mixedPartial('not a boolean');

// ===================================================================
// 🌟 高级类型场景测试
// ===================================================================

// -- 异步函数 --
declare const asyncAdd: (a: number, b: number) => Promise<number>;
const asyncPartial1 = partial(asyncAdd, 1);
expectIdentical<(this: unknown, b: number) => Promise<number>>()(asyncPartial1);
// @ts-expect-error: 返回值是 Promise<number> 喵～
expectIdentical<number>()(asyncPartial1(2));

// -- 泛型函数 --
declare const identity: <T>(val: T, _unused: number) => T;
const identityPartial = partial(identity<string>, 'hello');
expectIdentical<(this: unknown, _unused: number) => string>()(identityPartial);
expectIdentical<string>()(identityPartial(42));

// -- 函数作为参数 --
declare const applyFunc: (fn: (x: number) => number, x: number) => number;
const applyPartial1 = partial(applyFunc, (x: number) => x * 2);
expectIdentical<(this: unknown, x: number) => number>()(applyPartial1);
expectIdentical<number>()(applyPartial1(5));
// @ts-expect-error: 第一个固定参数已经是函数了喵！
partial(applyFunc, 'not a function');

// -- 元组类型参数 --
declare const tupleFunc: (a: [number, string], b: boolean) => string;
const tuplePartial1 = partial(tupleFunc, [1, 'meow'] as [number, string]);
expectIdentical<(this: unknown, b: boolean) => string>()(tuplePartial1);
expectIdentical<string>()(tuplePartial1(true));
// @ts-expect-error: 元组类型不匹配喵！
partial(tupleFunc, [1, 2]);

// -- 联合类型参数 --
declare const unionFunc: (a: string | number, _b: boolean) => number;
const unionPartial1 = partial(unionFunc, 'hello');
expectIdentical<(this: unknown, _b: boolean) => number>()(unionPartial1);
expectIdentical<number>()(unionPartial1(true));
// @ts-expect-error: 联合类型不包含 boolean 喵！
partial(unionFunc, true);

// -- 交叉类型参数 --
type Point = {x: number; y: number};
type Color = {r: number; g: number; b: number};
declare const crossFunc: (point: Point & Color, z: number) => number;
const crossPartial1 = partial(crossFunc, {x: 1, y: 2, r: 3, g: 4, b: 5});
expectIdentical<(this: unknown, z: number) => number>()(crossPartial1);
expectIdentical<number>()(crossPartial1(10));
// @ts-expect-error: 缺少属性喵！
partial(crossFunc, {x: 1, y: 2});

// ===================================================================
// 🚀 This 绑定测试
// ===================================================================

declare const contextObj: {
  base: number;
  add(this: {base: number}, a: number, b: number): number;
};

// eslint-disable-next-line @typescript-eslint/unbound-method
const methodPartial1 = partial(contextObj.add, 1);
expectIdentical<(this: {base: number}, b: number) => number>()(methodPartial1);
expectIdentical<number>()(methodPartial1.call({base: 20}, 2));

// ===================================================================
// 🎨 非字面量元组长度参数测试
// ===================================================================

const args: number[] = [1, 2];
// 非固定长度元组时错误
// @ts-expect-error: 非固定长度元组不能作为固定参数喵！
partial(add, ...args);

// ===================================================================
// 🔢 边界情况测试
// ===================================================================

// -- 零参数函数 --
declare const noArgs: () => number;
// 这个应该报错，但这个1让noArgs拥有了“参数”，然后在TS中参数少的函数可以赋值给参数多的函数，导致检测失效
// 但实现检测（类似PartialRight那样分离检测）会让类型系统变得复杂，而实际上运行时也不会有什么严重后果（实际上不管怎么传运行时和类型系统最后都等同于noArgs），划不来
const noArgsPartial = partial(noArgs, 1);
expectIdentical<(this: unknown) => number>()(noArgsPartial);
expectIdentical<number>()(noArgsPartial());

// -- 单参数函数 --
declare const singleArg: (x: number) => number;
const singlePartial = partial(singleArg, 5);
expectIdentical<(this: unknown) => number>()(singlePartial);
expectIdentical<number>()(singlePartial());

// -- 固定 0 个参数的单参数函数 --
// @ts-expect-error: 固定 0 个参数的单参数函数毫无意义
partial(singleArg);

// ===================================================================
// 🧪 复杂链式调用测试
// ===================================================================

// -- 多次应用 partial --
const doublePartial = partial(partial(add, 1), 2);
expectIdentical<(this: unknown, c: number) => number>()(doublePartial);
expectIdentical<number>()(doublePartial(3));

// -- 与其他函数组合 --
declare const mapFunc: <T, U>(arr: T[], fn: (x: T) => U) => U[];
const mapPartial1 = partial(mapFunc<number, string>, [1, 2, 3]);
expectIdentical<(this: unknown, fn: (x: number) => string) => string[]>()(
  mapPartial1,
);

// ===================================================================
// 🚀 极端压力测试 (200个参数)
// ===================================================================

type BuildTuple<
  N extends number,
  T extends unknown[] = [],
> = T['length'] extends N ? T : BuildTuple<N, [...T, number]>;

type Args200 = BuildTuple<200>;

declare const sum200: (...args: Args200) => number;

// -- 固定 100 个参数 --
// prettier-ignore
const partial100 = partial(sum200, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100);
// prettier-ignore
expectIdentical<(this: unknown, rest_0: number, rest_1: number, rest_2: number, rest_3: number, rest_4: number, rest_5: number, rest_6: number, rest_7: number, rest_8: number, rest_9: number, rest_10: number, rest_11: number, rest_12: number, rest_13: number, rest_14: number, rest_15: number, rest_16: number, rest_17: number, rest_18: number, rest_19: number, rest_20: number, rest_21: number, rest_22: number, rest_23: number, rest_24: number, rest_25: number, rest_26: number, rest_27: number, rest_28: number, rest_29: number, rest_30: number, rest_31: number, rest_32: number, rest_33: number, rest_34: number, rest_35: number, rest_36: number, rest_37: number, rest_38: number, rest_39: number, rest_40: number, rest_41: number, rest_42: number, rest_43: number, rest_44: number, rest_45: number, rest_46: number, rest_47: number, rest_48: number, rest_49: number, rest_50: number, rest_51: number, rest_52: number, rest_53: number, rest_54: number, rest_55: number, rest_56: number, rest_57: number, rest_58: number, rest_59: number, rest_60: number, rest_61: number, rest_62: number, rest_63: number, rest_64: number, rest_65: number, rest_66: number, rest_67: number, rest_68: number, rest_69: number, rest_70: number, rest_71: number, rest_72: number, rest_73: number, rest_74: number, rest_75: number, rest_76: number, rest_77: number, rest_78: number, rest_79: number, rest_80: number, rest_81: number, rest_82: number, rest_83: number, rest_84: number, rest_85: number, rest_86: number, rest_87: number, rest_88: number, rest_89: number, rest_90: number, rest_91: number, rest_92: number, rest_93: number, rest_94: number, rest_95: number, rest_96: number, rest_97: number, rest_98: number, rest_99: number) => number>()(partial100);

// prettier-ignore
expectIdentical<number>()(partial100(101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143, 144, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154, 155, 156, 157, 158, 159, 160, 161, 162, 163, 164, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174, 175, 176, 177, 178, 179, 180, 181, 182, 183, 184, 185, 186, 187, 188, 189, 190, 191, 192, 193, 194, 195, 196, 197, 198, 199, 200));
// @ts-expect-error: Rest 参数类型错误喵！
partial100('not a number');

// -- 固定 200 个参数（完整参数） --
// prettier-ignore
const partial200 = partial(sum200, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143, 144, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154, 155, 156, 157, 158, 159, 160, 161, 162, 163, 164, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174, 175, 176, 177, 178, 179, 180, 181, 182, 183, 184, 185, 186, 187, 188, 189, 190, 191, 192, 193, 194, 195, 196, 197, 198, 199, 200);
expectIdentical<(this: unknown) => number>()(partial200);
expectIdentical<number>()(partial200());
// @ts-expect-error: 无参数函数不能传参喵！
partial200(1);

// -- 固定参数类型错误检测 --
// prettier-ignore
// @ts-expect-error: 第 100 个参数类型错误喵～
partial(sum200, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, '有点想报错了喵', 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143, 144, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154, 155, 156, 157, 158, 159, 160, 161, 162, 163, 164, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174, 175, 176, 177, 178, 179, 180, 181, 182, 183, 184, 185, 186, 187, 188, 189, 190, 191, 192, 193, 194, 195, 196, 197, 198, 199, 200);

// -- 固定超过原函数参数数量检测 --
// prettier-ignore
// @ts-expect-error: 参数数量超过原函数参数数量喵！
partial(sum200, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143, 144, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154, 155, 156, 157, 158, 159, 160, 161, 162, 163, 164, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174, 175, 176, 177, 178, 179, 180, 181, 182, 183, 184, 185, 186, 187, 188, 189, 190, 191, 192, 193, 194, 195, 196, 197, 198, 199, 200, 201);
