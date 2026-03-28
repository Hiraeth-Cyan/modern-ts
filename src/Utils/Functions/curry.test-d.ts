// ========================================
// ./src/Utils/Functions/curry.test-d.ts
// ========================================

/* eslint-disable @typescript-eslint/no-explicit-any */

import {expectIdentical} from '../type-tool';
import {curry, __} from './curry';

// ===================================================================
// 🐱 基础柯里化测试
// ===================================================================

// @ts-expect-error: 参数类型应为 AnyFunction 喵～
curry('不是函数', 1);

declare const add: (a: number, b: number, c: number) => number;
const curriedAdd = curry(add, 3);

// -- 全参数调用 --
expectIdentical<number>()(curriedAdd(1, 2, 3));

// -- 分段调用 --
expectIdentical<number>()(curriedAdd(1)(2)(3));

// -- 混合调用方式 --
const partial1 = curriedAdd(1);
expectIdentical<number>()(partial1(2, 3));
expectIdentical<number>()(partial1(2)(3));

// -- 参数溢出检测 --
// @ts-expect-error: 参数已填满，不能再调用了喵！
curriedAdd(__, 2, __)(__, 3, 4);

const singleAdd = curriedAdd(1)(2);
expectIdentical<(arg: number) => number>()(singleAdd);
expectIdentical<number>()(singleAdd(3));

// ===================================================================
// 🎀 占位符魔法测试
// ===================================================================

// -- 基本占位符 --
expectIdentical<number>()(curriedAdd(1, __, 3)(2));
expectIdentical<number>()(curriedAdd(__, 2, 3)(1));
expectIdentical<number>()(curriedAdd(1, 2, __)(3));

// -- 多重占位符 --
const step1 = curriedAdd(__, 2, __);
const step2 = step1(1);
expectIdentical<number>()(step2(3));

// -- 深度嵌套占位符 --
const crazyStep = curriedAdd(__, __, __);
const part1 = crazyStep(__, 2);
expectIdentical<number>()(part1(1, 3));
// @ts-expect-error: 参数类型应为 number 喵～
part1('不是数字喵', 3);

const partial2 = curriedAdd(1, __, __);
const rePartial = partial2(__, 3);
expectIdentical<number>()(rePartial(2));
// @ts-expect-error: 参数数量溢出啦！
rePartial(2, 4);

// -- 递归占位符组合 --
const recursiveStep = curriedAdd(__, __, __)(__, 2, __);
const finalPush = recursiveStep(1);
expectIdentical<number>()(finalPush(3));
// @ts-expect-error: 剩余参数应为 number 喵～
finalPush('喵？');

// ===================================================================
// 🛡️ 类型安全边界测试
// ===================================================================

// -- 参数数量检查 --
// @ts-expect-error: 传入多余参数啦！
curriedAdd(1, 2, 3, 4);
// @ts-expect-error: 参数不足喵～
curriedAdd(1, 2)();
// @ts-expect-error: 空调用链！
curriedAdd()()()(1, 2, 3);
// @ts-expect-error: 空调用！
curriedAdd();

// -- 参数类型检查 --
// @ts-expect-error: 错误类型参数喵！
curriedAdd(1, '2', 3);
// @ts-expect-error: 占位符后类型不符！
curriedAdd(__, 2, 3)('不是数字');
// @ts-expect-error: 类型污染！
curriedAdd(__, 2, 3)('string_a');
// @ts-expect-error: 强行注入对象！
curriedAdd({meow: '?'}, [1, 2, 3], () => {});

// ===================================================================
// ✨ 高级类型场景测试
// ===================================================================

// -- 异步函数 --
declare const asyncAdd: (a: number, b: number) => Promise<number>;
const curriedAsync = curry(asyncAdd, 2);
// @ts-expect-error: 返回值是 Promise<number> 喵～
expectIdentical<number>()(curriedAsync(1)(2));
expectIdentical<Promise<number>>()(curriedAsync(1)(2));

// -- 可变参数函数 --
declare const sumAll: (...args: number[]) => number;
const curriedSum = curry(sumAll, 3);
expectIdentical<number>()(curriedSum(1)(2)(3));
expectIdentical<number>()(curriedSum(1, 2)(3));
expectIdentical<number>()(curriedSum(1, __, 3)(2));
// @ts-expect-error: 参数数量溢出！
curriedSum(1)(2)(3)(4);
// @ts-expect-error: 参数类型错误喵！
curriedSum(1)('s')(3);

// -- 泛型函数 --
declare const identity: <T>(val: T, _unused: number) => T;
const curriedId = curry(identity<string>, 2);
expectIdentical<string>()(curriedId('meow')(1));

// -- 混合类型参数 --
declare const mixedFunc: (a: string, b: number, c: boolean) => string;
const curriedMixed = curry(mixedFunc, 3);
expectIdentical<string>()(curriedMixed('hello')(42)(true));
// @ts-expect-error: 类型不匹配喵！
curriedMixed('hello')('world')(true);
// @ts-expect-error: 顺序错误！
curriedMixed(42)('hello')(true);

// -- 函数作为参数 --
declare const applyFunc: (fn: (x: number) => number, x: number) => number;
const curriedApply = curry(applyFunc, 2);
declare const double: (x: number) => number;
expectIdentical<number>()(curriedApply(double)(10));
// @ts-expect-error: 函数签名不匹配喵！
curriedApply((x: string) => x.length)(10);

// ===================================================================
// 🌟 边界情况测试
// ===================================================================

// -- 零参数函数 --
declare const noArgs: () => number;
// @ts-expect-error: 0参数函数无意义
curry(noArgs, 1);

// -- 单参数函数 --

declare const singleArg: (x: number) => number;
// @ts-expect-error: 单参数函数无意义
curry(singleArg, 1);

declare const doubleArg: (x: number, y: number) => number;
// @ts-expect-error: 0长度毫无意义
curry(doubleArg, 0);

// @ts-expect-error: 1长度毫无意义
curry(doubleArg, 1);

// @ts-expect-error: 3长度超了
curry(doubleArg, 3);
// 报错：类型“3”的参数不能赋给类型“"The length parameter must be <= 2."”的参数

// @ts-expect-error: 类型系统要求正整数
curry(doubleArg, -1);

// @ts-expect-error: 类型系统要求正整数
curry(doubleArg, 1.1);

// @ts-expect-error: 非字面量
curry(doubleArg, NaN);
// @ts-expect-error: 非字面量
curry(doubleArg, Infinity);
// @ts-expect-error: 非字面量
curry(doubleArg, -Infinity);

// -- This 绑定 --
declare const contextObj: {
  base: number;
  add(a: number, b: number): number;
};
// eslint-disable-next-line @typescript-eslint/unbound-method
const curriedMethod = curry(contextObj.add, 2);
// @ts-expect-error: 柯里化通常会丢失 this 上下文喵～
expectIdentical<number>()(curriedMethod.call({base: 20}, 1, 2));

// -- 链式柯里化 --
declare const pipeline: (a: number, b: number, c: number) => number;
const curriedPipeline = curry(pipeline, 3);
expectIdentical<number>()(curriedPipeline(1)(2)(3));

// @ts-expect-error: 类型错误喵！
curriedPipeline('1')(2)(3);

// -- 柯里化柯里化函数 --
// @ts-expect-error: 不能双重柯里化
curry(curriedAdd, 3);

// ===================================================================
// 🎨 复杂类型推导测试
// ===================================================================

// -- 元组类型参数 --
declare const tupleFunc: (a: [number, string], b: boolean) => string;
const curriedTuple = curry(tupleFunc, 2);
const args: [number, string] = [1, 'meow'];
expectIdentical<string>()(curriedTuple(args)(true));
// @ts-expect-error: 元组类型不匹配喵！
curriedTuple([1, 2])(true);

// -- 联合类型参数 --
declare const unionFunc: (a: string | number, _b: boolean) => number;
const curriedUnion = curry(unionFunc, 2);
expectIdentical<number>()(curriedUnion('hello')(true));
expectIdentical<number>()(curriedUnion(42)(true));
// @ts-expect-error: 联合类型不包含 boolean 喵！
curriedUnion(true)(true);

// -- 可选参数 --
declare const optionalFunc: (a?: number, b?: string) => string;
const curriedOptional = curry(optionalFunc, 2);

// length=2 时需要填两个参数
expectIdentical<string>()(curriedOptional(42, 'hello'));
expectIdentical<string>()(curriedOptional(42)('hello'));
expectIdentical<string>()(curriedOptional(undefined, undefined));
expectIdentical<string>()(curriedOptional(undefined)(undefined));
expectIdentical<string>()(curriedOptional(__)(undefined)(undefined));

// @ts-expect-error: 缺少参数喵！
curriedOptional();

const singleOptional = curriedOptional(1);
expectIdentical<(b?: string) => string>()(singleOptional);

// -- 默认参数函数的 length 截取 --
const withDefaults = (a: number, b: number = 10, c: number = 20) => a + b + c;
const curriedDefaults2 = curry(withDefaults, 2);
const curriedDefaults3 = curry(withDefaults, 3);

// length=2: 填 2 个参数就返回
expectIdentical<number>()(curriedDefaults2(1, 2));
expectIdentical<number>()(curriedDefaults2(1)(2));
// @ts-expect-error: 已返回 number，不能继续调用喵！
curriedDefaults2(1)(2)(3);

// length=3: 填 3 个参数才返回
expectIdentical<number>()(curriedDefaults3(1, 2, 3));
expectIdentical<number>()(curriedDefaults3(1)(2)(3));
expectIdentical<number>()(curriedDefaults3(1, __, 3)(2));

// -- 非字面量 length 参数 --
const n = 2 - 0;
expectIdentical<number>()(n);
// @ts-expect-error 不是字面量喵！
expectIdentical<2>()(n);
// 非字面量时报错
// @ts-expect-error: 非字面量 length 参数喵！
curry(withDefaults, n);

// -- 交叉类型参数 --
type Point = {x: number; y: number};
type Color = {r: number; g: number; b: number};
declare const crossFunc: (point: Point & Color, z: number) => number;
const curriedCross = curry(crossFunc, 2);
expectIdentical<number>()(curriedCross({x: 1, y: 2, r: 3, g: 4, b: 5})(10));
// @ts-expect-error: 缺少属性喵！
curriedCross({x: 1, y: 2})(10);

// ===================================================================
// 🚀 极端压力测试 (100个参数)
// ===================================================================

type BuildTuple<N extends number, T extends any[] = []> = T['length'] extends N
  ? T
  : BuildTuple<N, [...T, number]>;

type Args100 = BuildTuple<100>;

declare const sum100: (...args: Args100) => number;
const curriedSum100 = curry(sum100, 100);

// -- 完整参数校验 (链式调用) --
// prettier-ignore
const test = curriedSum100(1)(2)(3)(4)(5);
// prettier-ignore
const _test1 = test(6)(7)(8)(9)(10)(11)(12)(13)(14)(15)(16)(17)(18)(19)(20)(21)(22)(23)(24)(25)(26)(27)(28)(29)(30)(31)(32)(33)(34)(35)(36)(37)(38)(39)(40)(41)(42)(43)(44)(45)(46)(47)(48)(49)(50)(51)(52)(53)(54)(55)(56)(57)(58)(59)(60)(61)(62)(63)(64)(65)(66)(67)(68)(69)(70)(71)(72)(73)(74)(75)(76)(77)(78)(79)(80)(81)(82)(83)(84)(85)(86)(87)(88)(89)(90)(91)(92)(93)(94)(95)(96)(97)(98)(99)(100);
expectIdentical<number>()(_test1);

// -- 错误类型注入 (链式调用中途) --
// prettier-ignore
// @ts-expect-error: 注入错误类型 string 喵～
const test2 = test(6)(7)(8)(9)(10)(11)(12)(13)(14)(15)(16)(17)(18)(19)(20)(21)(22)(23)(24)(25)(26)(27)(28)(29)(30)(31)(32)(33)(34)(35)(36)(37)(38)(39)(40)(41)(42)(43)(44)(45)(46)(47)(48)(49)(50)(51)(52)(53)(54)(55)(56)(57)(58)(59)(60)(61)(62)(63)(64)(65)(66)(67)(68)(69)(70)(71)(72)(73)(74)(75)(76)(77)(78)(79)(80)(81)(82)(83)(84)(85)(86)(87)(88)(89)(90)(91)(92)(93)(94)(95)(96)(97)(98)(99)('有点想报错了喵');

// -- 多参数风格调用错误 --
// prettier-ignore
const _test3 = test(
6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40,
41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60,
61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80,
81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99,
// @ts-expect-error: 最后一个参数类型错误喵～
'有点想报错了喵'
);
expectIdentical<number>()(_test3);

// -- 参数溢出校验 --
// prettier-ignore
// @ts-expect-error: 传入 101 个参数啦！
curriedSum100(1)(2)(3)(4)(5)(6)(7)(8)(9)(10)(11)(12)(13)(14)(15)(16)(17)(18)(19)(20)(21)(22)(23)(24)(25)(26)(27)(28)(29)(30)(31)(32)(33)(34)(35)(36)(37)(38)(39)(40)(41)(42)(43)(44)(45)(46)(47)(48)(49)(50)(51)(52)(53)(54)(55)(56)(57)(58)(59)(60)(61)(62)(63)(64)(65)(66)(67)(68)(69)(70)(71)(72)(73)(74)(75)(76)(77)(78)(79)(80)(81)(82)(83)(84)(85)(86)(87)(88)(89)(90)(91)(92)(93)(94)(95)(96)(97)(98)(99)(100)(101);

// -- 占位符长链测试 --
// prettier-ignore
// @ts-expect-error: 占位符链尾部类型错误喵～
curriedSum100(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)('有点想报错了喵');
