// ========================================
// ./src/Utils/Functions/curry.test-d.ts
// ========================================

/* eslint-disable @typescript-eslint/no-explicit-any */

import {expectIdentical} from '../type-tool';
import {curry, __} from './curry';

// ===================================================================
// 🐱 基础柯里化测试
// ===================================================================

const add = (a: number, b: number, c: number) => a + b + c;
const curriedAdd = curry(add, 3);

// -- 全参数调用 --
expectIdentical<number>()(curriedAdd(1, 2, 3));
// @ts-expect-error: 结果是 number，不能赋值给 string 喵～
expectIdentical<string>()(curriedAdd(1, 2, 3));

// -- 分段调用 --
expectIdentical<number>()(curriedAdd(1)(2)(3));
// @ts-expect-error: 结果是 number 喵～
expectIdentical<string>()(curriedAdd(1)(2)(3));

// -- 混合调用方式 --
const partial1 = curriedAdd(1);
expectIdentical<number>()(partial1(2, 3));
expectIdentical<number>()(partial1(2)(3));

// -- 参数溢出检测 --
// @ts-expect-error: 参数已填满，不能再调用了喵！
curriedAdd(__, 2, __)(__, 3, 4);

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
const asyncAdd = async (a: number, b: number) => Promise.resolve(a + b);
const curriedAsync = curry(asyncAdd, 2);
// @ts-expect-error: 返回值是 Promise<number> 喵～
expectIdentical<number>()(curriedAsync(1)(2));
expectIdentical<Promise<number>>()(curriedAsync(1)(2));

// -- 可变参数函数 --
const sumAll = (...args: number[]) => args.reduce((a, b) => a + b, 0);
const curriedSum = curry(sumAll, 3);
expectIdentical<number>()(curriedSum(1)(2)(3));
expectIdentical<number>()(curriedSum(1, 2)(3));
expectIdentical<number>()(curriedSum(1, __, 3)(2));
// @ts-expect-error: 参数数量溢出！
curriedSum(1)(2)(3)(4);
// @ts-expect-error: 参数类型错误喵！
curriedSum(1)('s')(3);

// -- 泛型函数 --
const identity = <T>(val: T, _unused: number) => val;
const curriedId = curry(identity<string>, 2);
expectIdentical<string>()(curriedId('meow')(1));

// -- 混合类型参数 --
const mixedFunc = (a: string, b: number, c: boolean) => `${a}-${b}-${c}`;
const curriedMixed = curry(mixedFunc, 3);
expectIdentical<string>()(curriedMixed('hello')(42)(true));
// @ts-expect-error: 类型不匹配喵！
curriedMixed('hello')('world')(true);
// @ts-expect-error: 顺序错误！
curriedMixed(42)('hello')(true);

// -- 函数作为参数 --
const applyFunc = (fn: (x: number) => number, x: number) => fn(x);
const curriedApply = curry(applyFunc, 2);
const double = (x: number) => x * 2;
expectIdentical<number>()(curriedApply(double)(10));
// @ts-expect-error: 函数签名不匹配喵！
curriedApply((x: string) => x.length)(10);

// ===================================================================
// 🌟 边界情况测试
// ===================================================================

// -- 零参数函数 --
const noArgs = () => 42;
const curriedNoArgs = curry(noArgs, 0);
expectIdentical<{
  readonly __error: '0 parameters do not need currying, which is meaningless';
}>()(curriedNoArgs);

// -- 单参数函数 --
const singleArg = (x: number) => x * 2;
const curriedSingle = curry(singleArg, 1);
expectIdentical<number>()(curriedSingle(5));
// @ts-expect-error: 结果是 number，不能继续调用喵！
curriedSingle(5)(10);

// -- This 绑定 --
const contextObj = {
  base: 10,
  add(a: number, b: number) {
    return this.base + a + b;
  },
};
// eslint-disable-next-line @typescript-eslint/unbound-method
const curriedMethod = curry(contextObj.add, 2);
// @ts-expect-error: 柯里化通常会丢失 this 上下文喵～
expectIdentical<number>()(curriedMethod.call({base: 20}, 1, 2));

// -- 链式柯里化 --
const pipeline = (a: number) => (b: number) => (c: number) => a + b + c;
const curriedPipeline = curry(pipeline, 3);
expectIdentical<number>()(curriedPipeline(1)(2)(3));
// @ts-expect-error: 类型错误喵！
curriedPipeline('1')(2)(3);

// -- 柯里化柯里化函数 --
const doubleCurried = curry(curriedAdd, 3);
const result = doubleCurried(1)(2)(3);
expectIdentical<{
  readonly __error: '0 parameters do not need currying, which is meaningless';
}>()(result);

// ===================================================================
// 🎨 复杂类型推导测试
// ===================================================================

// -- 元组类型参数 --
const tupleFunc = (a: [number, string], b: boolean) => `${a[0]}-${a[1]}-${b}`;
const curriedTuple = curry(tupleFunc, 2);
const args: [number, string] = [1, 'meow'];
expectIdentical<string>()(curriedTuple(args)(true));
// @ts-expect-error: 元组类型不匹配喵！
curriedTuple([1, 2])(true);

// -- 联合类型参数 --
const unionFunc = (a: string | number, _b: boolean) =>
  typeof a === 'string' ? a.length : a;
const curriedUnion = curry(unionFunc, 2);
expectIdentical<number>()(curriedUnion('hello')(true));
expectIdentical<number>()(curriedUnion(42)(true));
// @ts-expect-error: 联合类型不包含 boolean 喵！
curriedUnion(true)(true);

// -- 可选参数 --
const optionalFunc = (a: number, b?: string) =>
  b ? `${a}-${b}` : a.toString();
const curriedOptional = curry(optionalFunc, 2);

// length=1 时只需填一个参数就返回结果
const curriedOptional1 = curry(optionalFunc, 1);
expectIdentical<string>()(curriedOptional1(42));
// @ts-expect-error: 填完 1 个参数后已经是 string，不能继续调用喵！
curriedOptional1(42)('extra');

// length=2 时需要填两个参数
expectIdentical<string>()(curriedOptional(42, 'hello'));
expectIdentical<string>()(curriedOptional(42)('hello'));

// -- 默认参数函数的 length 截取 --
const withDefaults = (a: number, b: number = 10, c: number = 20) => a + b + c;
const curriedDefaults1 = curry(withDefaults, 1);
const curriedDefaults2 = curry(withDefaults, 2);
const curriedDefaults3 = curry(withDefaults, 3);

// length=1: 填 1 个参数就返回
expectIdentical<number>()(curriedDefaults1(1));
// @ts-expect-error: 已返回 number，不能继续调用喵！
curriedDefaults1(1)(2);

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
const n = 1 - 0;
expectIdentical<number>()(n);
// @ts-expect-error 不是字面量喵！
expectIdentical<1>()(n);
// 非字面量时返回错误类型
expectIdentical<{
  readonly __error: 'The length parameter must be a literal number (e.g., 2), not a variable of type number.';
}>()(curry(withDefaults, n));

// -- 交叉类型参数 --
type Point = {x: number; y: number};
type Color = {r: number; g: number; b: number};
const crossFunc = (point: Point & Color, z: number) => point.x + point.r + z;
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

const sum100 = (...args: Args100): number => args.reduce((a, b) => a + b, 0);
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
