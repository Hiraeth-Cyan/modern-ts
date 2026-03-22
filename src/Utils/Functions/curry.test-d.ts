// ========================================
// ./src/Utils/Functions/curry.test-t.ts
// ========================================

/* eslint-disable @typescript-eslint/no-explicit-any */

import {curry, __} from './curry';

// ===================================================================
// 辅助工具：类型断言
// ===================================================================

/**
 * 用于在编译时断言表达式的类型，同时消除 "unused expression" 的 lint 警告。
 * 如果类型不匹配，TypeScript 编译会失败。
 */
const expectType = <T>(_: T): void => {};

// ===================================================================
// 1. 基础功能类型测试
// ===================================================================

const add = (a: number, b: number, c: number) => a + b + c;
const curriedAdd = curry(add, 3);

// 1.1 全参数调用
expectType<number>(curriedAdd(1, 2, 3));
// @ts-expect-error: 结果是 number，不能赋值给 string
expectType<string>(curriedAdd(1, 2, 3));

// 1.2 分段调用
expectType<number>(curriedAdd(1)(2)(3));
// @ts-expect-error: 结果是 number
expectType<string>(curriedAdd(1)(2)(3));

// 1.3 混合调用方式
const partial1 = curriedAdd(1);
expectType<number>(partial1(2, 3));
expectType<number>(partial1(2)(3));

// 1.4 参数溢出与占位符滥用
// @ts-expect-error: 参数已填满，不应再接受调用
curriedAdd(__, 2, __)(__, 3, 4);

// ===================================================================
// 2. 占位符功能类型测试
// ===================================================================

// 2.1 基本占位符
expectType<number>(curriedAdd(1, __, 3)(2));
expectType<number>(curriedAdd(__, 2, 3)(1));
expectType<number>(curriedAdd(1, 2, __)(3));

// 2.2 多重占位符
const step1 = curriedAdd(__, 2, __);
const step2 = step1(1);
expectType<number>(step2(3));

// 2.3 深度嵌套占位符
const crazyStep = curriedAdd(__, __, __);
const part1 = crazyStep(__, 2);
expectType<number>(part1(1, 3));
// @ts-expect-error: 参数类型应为 number
part1('不是数字', 3);

const partial2 = curriedAdd(1, __, __);
const rePartial = partial2(__, 3);
expectType<number>(rePartial(2));
// @ts-expect-error: 参数数量溢出
rePartial(2, 4);

// 2.4 递归占位符组合
const recursiveStep = curriedAdd(__, __, __)(__, 2, __); // 锁定 b=2
const finalPush = recursiveStep(1); // 锁定 a=1
expectType<number>(finalPush(3));
// @ts-expect-error: 剩余参数应为 number
finalPush('喵？');

// ===================================================================
// 3. 类型安全边界测试
// ===================================================================

// 3.1 参数数量检查
// @ts-expect-error: 传入多余参数
curriedAdd(1, 2, 3, 4);
// @ts-expect-error: 参数不足（最终调用时）
curriedAdd(1, 2)();
// @ts-expect-error: 空调用链
curriedAdd()()()(1, 2, 3);
// @ts-expect-error: 空调用
curriedAdd();

// 3.2 参数类型检查
// @ts-expect-error: 错误类型参数
curriedAdd(1, '2', 3);
// @ts-expect-error: 占位符后类型不符
curriedAdd(__, 2, 3)('不是数字');
// @ts-expect-error: 类型污染
curriedAdd(__, 2, 3)('string_a');
// @ts-expect-error: 强行注入对象
curriedAdd({meow: '?'}, [1, 2, 3], () => {});

// ===================================================================
// 4. 高级类型场景测试
// ===================================================================

// 4.1 异步函数
const asyncAdd = async (a: number, b: number) => Promise.resolve(a + b);
const curriedAsync = curry(asyncAdd, 2);
// @ts-expect-error: 返回值是 Promise<number>
expectType<number>(curriedAsync(1)(2));
expectType<Promise<number>>(curriedAsync(1)(2));

// 4.2 可变参数函数
const sumAll = (...args: number[]) => args.reduce((a, b) => a + b, 0);
const curriedSum = curry(sumAll, 3);
expectType<{
  readonly __error: 'Cannot curry a function with rest parameters (...args). Please use fixed-arity functions.';
}>(curriedSum);

// 4.3 泛型函数
const identity = <T>(val: T, _unused: number) => val;
const curriedId = curry(identity<string>, 2);
expectType<string>(curriedId('meow')(1));

// 4.4 混合类型参数
const mixedFunc = (a: string, b: number, c: boolean) => `${a}-${b}-${c}`;
const curriedMixed = curry(mixedFunc, 3);
expectType<string>(curriedMixed('hello')(42)(true));
// @ts-expect-error: 类型不匹配
curriedMixed('hello')('world')(true);
// @ts-expect-error: 顺序错误
curriedMixed(42)('hello')(true);

// 4.5 函数作为参数
const applyFunc = (fn: (x: number) => number, x: number) => fn(x);
const curriedApply = curry(applyFunc, 2);
const double = (x: number) => x * 2;
expectType<number>(curriedApply(double)(10));
// @ts-expect-error: 函数签名不匹配
curriedApply((x: string) => x.length)(10);

// ===================================================================
// 5. 边界情况类型测试
// ===================================================================

// 5.1 零参数函数
const noArgs = () => 42;
const curriedNoArgs = curry(noArgs, 0);
expectType<{
  readonly __error: '0 parameters do not need currying, which is meaningless';
}>(curriedNoArgs);

// 5.2 单参数函数
const singleArg = (x: number) => x * 2;
const curriedSingle = curry(singleArg, 1);
expectType<number>(curriedSingle(5));
// @ts-expect-error: 结果是 number，不能继续调用
curriedSingle(5)(10);

// 5.5 This 绑定
const contextObj = {
  base: 10,
  add(a: number, b: number) {
    return this.base + a + b;
  },
};
// eslint-disable-next-line @typescript-eslint/unbound-method
const curriedMethod = curry(contextObj.add, 2);
// @ts-expect-error: 柯里化通常会丢失 this 上下文，或者类型系统无法推断 bind
expectType<number>(curriedMethod.call({base: 20}, 1, 2));

// 5.6 链式柯里化
const pipeline = (a: number) => (b: number) => (c: number) => a + b + c;
const curriedPipeline = curry(pipeline, 3);
expectType<number>(curriedPipeline(1)(2)(3));
// @ts-expect-error: 类型错误
curriedPipeline('1')(2)(3);

// 5.7 柯里化柯里化函数
const doubleCurried = curry(curriedAdd, 3);
// @ts-expect-error: 对已柯里化函数再次柯里化通常会导致类型错误或签名不匹配
// eslint-disable-next-line @typescript-eslint/no-unsafe-call
void doubleCurried(1)(2)(3);

// ===================================================================
// 6. 复杂类型推导测试
// ===================================================================

// 6.1 元组类型参数
const tupleFunc = (a: [number, string], b: boolean) => `${a[0]}-${a[1]}-${b}`;
const curriedTuple = curry(tupleFunc, 2);
const args: [number, string] = [1, 'meow'];
expectType<string>(curriedTuple(args)(true));
// @ts-expect-error: 元组类型不匹配
curriedTuple([1, 2])(true);

// 6.2 联合类型参数
const unionFunc = (a: string | number, _b: boolean) =>
  typeof a === 'string' ? a.length : a;
const curriedUnion = curry(unionFunc, 2);
expectType<number>(curriedUnion('hello')(true));
expectType<number>(curriedUnion(42)(true));
// @ts-expect-error: 联合类型不包含 boolean
curriedUnion(true)(true);

// 6.3 可选参数
const optionalFunc = (a: number, b?: string) =>
  b ? `${a}-${b}` : a.toString();
curry(optionalFunc, 2);
// 注意：类型系统通常将可选参数视为必选，但可能允许 undefined

// 6.4 交叉类型参数
type Point = {x: number; y: number};
type Color = {r: number; g: number; b: number};
const crossFunc = (point: Point & Color, z: number) => point.x + point.r + z;
const curriedCross = curry(crossFunc, 2);
expectType<number>(curriedCross({x: 1, y: 2, r: 3, g: 4, b: 5})(10));
// @ts-expect-error: 缺少属性
curriedCross({x: 1, y: 2})(10);

// ===================================================================
// 极端压力测试 (100个参数)
// ===================================================================

type BuildTuple<N extends number, T extends any[] = []> = T['length'] extends N
  ? T
  : BuildTuple<N, [...T, number]>;

type Args100 = BuildTuple<100>;

const sum100 = (...args: Args100): number => args.reduce((a, b) => a + b, 0);
const curriedSum100 = curry(sum100, 100);

// 7.1 完整参数校验 (链式调用)
// prettier-ignore
const test = curriedSum100(1)(2)(3)(4)(5);
// prettier-ignore
const _test1: number = test(6)(7)(8)(9)(10)(11)(12)(13)(14)(15)(16)(17)(18)(19)(20)(21)(22)(23)(24)(25)(26)(27)(28)(29)(30)(31)(32)(33)(34)(35)(36)(37)(38)(39)(40)(41)(42)(43)(44)(45)(46)(47)(48)(49)(50)(51)(52)(53)(54)(55)(56)(57)(58)(59)(60)(61)(62)(63)(64)(65)(66)(67)(68)(69)(70)(71)(72)(73)(74)(75)(76)(77)(78)(79)(80)(81)(82)(83)(84)(85)(86)(87)(88)(89)(90)(91)(92)(93)(94)(95)(96)(97)(98)(99)(100);
expectType<number>(_test1);

// 7.2 错误类型注入 (链式调用中途)
// prettier-ignore
// @ts-expect-error: 注入错误类型 string
const test2: number = test(6)(7)(8)(9)(10)(11)(12)(13)(14)(15)(16)(17)(18)(19)(20)(21)(22)(23)(24)(25)(26)(27)(28)(29)(30)(31)(32)(33)(34)(35)(36)(37)(38)(39)(40)(41)(42)(43)(44)(45)(46)(47)(48)(49)(50)(51)(52)(53)(54)(55)(56)(57)(58)(59)(60)(61)(62)(63)(64)(65)(66)(67)(68)(69)(70)(71)(72)(73)(74)(75)(76)(77)(78)(79)(80)(81)(82)(83)(84)(85)(86)(87)(88)(89)(90)(91)(92)(93)(94)(95)(96)(97)(98)(99)('有点想报错了喵');

// 7.3 多参数风格调用错误
// prettier-ignore
const _test3: number = test(
  6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
  21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40,
  41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60,
  61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80,
  81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99,
  // @ts-expect-error: 最后一个参数类型错误
  '有点想报错了喵'
);
expectType<number>(_test3);

// 7.4 参数溢出校验
// prettier-ignore
// @ts-expect-error: 传入 101 个参数
curriedSum100(1)(2)(3)(4)(5)(6)(7)(8)(9)(10)(11)(12)(13)(14)(15)(16)(17)(18)(19)(20)(21)(22)(23)(24)(25)(26)(27)(28)(29)(30)(31)(32)(33)(34)(35)(36)(37)(38)(39)(40)(41)(42)(43)(44)(45)(46)(47)(48)(49)(50)(51)(52)(53)(54)(55)(56)(57)(58)(59)(60)(61)(62)(63)(64)(65)(66)(67)(68)(69)(70)(71)(72)(73)(74)(75)(76)(77)(78)(79)(80)(81)(82)(83)(84)(85)(86)(87)(88)(89)(90)(91)(92)(93)(94)(95)(96)(97)(98)(99)(100)(101);

// 7.5 占位符长链测试
// prettier-ignore
// @ts-expect-error: 占位符链尾部类型错误
curriedSum100(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)(__)('有点想报错了喵');
