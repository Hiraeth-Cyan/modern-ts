// ========================================
// ./src/Utils/Functions/flip.test-d.ts
// ========================================

import {expectIdentical} from '../type-tool';
import {flip, reverseArgs} from './flip';

// ===================================================================
// 🔄 flip 基础测试
// ===================================================================

declare const subtract: (a: number, b: string) => string;
// @ts-expect-error: 非函数参数不能翻转
flip('不是函数');
// @ts-expect-error: 非函数参数不能翻转
reverseArgs('不是函数');

// -- 翻转二元函数 --
const flippedSubtract = flip(subtract);
expectIdentical<(b: string, a: number) => string>()(flippedSubtract);
expectIdentical<string>()(flippedSubtract('hello', 42));

// -- 翻转三元函数 --
declare const threeArgs: (a: string, b: number, c: boolean) => string;
const flippedThree = flip(threeArgs);
expectIdentical<(b: number, a: string, c: boolean) => string>()(flippedThree);
expectIdentical<string>()(flippedThree(42, 'hello', true));
// @ts-expect-error: 第一个参数应该是 number 喵！
flippedThree('wrong', 42, true);

// -- 翻转四元函数 --
declare const fourArgs: (a: string, b: number, c: boolean, d: bigint) => string;
const flippedFour = flip(fourArgs);
expectIdentical<(b: number, a: string, c: boolean, d: bigint) => string>()(
  flippedFour,
);
expectIdentical<string>()(flippedFour(42, 'hello', true, 100n));

// -- 单参数函数 --
declare const singleArg: (x: number) => number;
// @ts-expect-error: 单参数函数不能翻转
flip(singleArg);

// -- 零参数函数 --
declare const noArgs: () => number;
// @ts-expect-error: 零参数函数不能翻转
flip(noArgs);

// ===================================================================
// 🔄 reverseArgs 基础测试
// ===================================================================

// -- 反转二元函数 --
const reversedSubtract = reverseArgs(subtract);
expectIdentical<(b: string, a: number) => string>()(reversedSubtract);
expectIdentical<string>()(reversedSubtract('hello', 42));

// -- 反转三元函数 --
const reversedThree = reverseArgs(threeArgs);
expectIdentical<(c: boolean, b: number, a: string) => string>()(reversedThree);
expectIdentical<string>()(reversedThree(true, 42, 'hello'));
// @ts-expect-error: 第一个参数应该是 boolean 喵！
reversedThree('wrong', 42, 'hello');

// -- 反转四元函数 --
const reversedFour = reverseArgs(fourArgs);
expectIdentical<(d: bigint, c: boolean, b: number, a: string) => string>()(
  reversedFour,
);
expectIdentical<string>()(reversedFour(100n, true, 42, 'hello'));

// -- 反转单参数函数 --
// @ts-expect-error: 单参数函数不能反转
reverseArgs(singleArg);

// -- 反转零参数函数 --
// @ts-expect-error: 零参数函数不能反转
reverseArgs(noArgs);

// 对于二元函数，flip 和 reverseArgs 效果相同
declare const compareBinary: (a: string, b: number) => string;
const f1 = flip(compareBinary);
const r1 = reverseArgs(compareBinary);
expectIdentical<(b: number, a: string) => string>()(f1);
expectIdentical<(b: number, a: string) => string>()(r1);
expectIdentical<typeof f1>()(r1);

// ===================================================================
// 🌟 高级类型场景测试
// ===================================================================

// -- 异步函数 --
declare const asyncAdd: (a: number, b: string) => Promise<string>;
const flippedAsync = flip(asyncAdd);
expectIdentical<(b: string, a: number) => Promise<string>>()(flippedAsync);

const reversedAsync = reverseArgs(asyncAdd);
expectIdentical<(b: string, a: number) => Promise<string>>()(reversedAsync);

// -- 泛型函数 --
declare const pair: <T, U>(a: T, b: U) => [T, U];
const flippedPair = flip(pair<string, number>);
expectIdentical<(b: number, a: string) => [string, number]>()(flippedPair);
expectIdentical<[string, number]>()(flippedPair(42, 'hello'));

const reversedPair = reverseArgs(pair<string, number>);
expectIdentical<(b: number, a: string) => [string, number]>()(reversedPair);
expectIdentical<[string, number]>()(reversedPair(42, 'hello'));

// -- 函数作为参数 --
declare const applyFunc: (fn: (x: number) => number, x: number) => number;
const flippedApply = flip(applyFunc);
expectIdentical<(x: number, fn: (x: number) => number) => number>()(
  flippedApply,
);
declare const double: (x: number) => number;
expectIdentical<number>()(flippedApply(5, double));

const reversedApply = reverseArgs(applyFunc);
expectIdentical<(x: number, fn: (x: number) => number) => number>()(
  reversedApply,
);

// -- 元组类型参数 --
declare const tupleFunc: (a: [number, string], b: boolean) => string;
const flippedTuple = flip(tupleFunc);
expectIdentical<(b: boolean, a: [number, string]) => string>()(flippedTuple);
const tupleArg: [number, string] = [1, 'meow'];
expectIdentical<string>()(flippedTuple(true, tupleArg));

const reversedTuple = reverseArgs(tupleFunc);
expectIdentical<(b: boolean, a: [number, string]) => string>()(reversedTuple);

// -- 联合类型参数 --
declare const unionFunc: (a: string | number, b: boolean) => number;
const flippedUnion = flip(unionFunc);
expectIdentical<(b: boolean, a: string | number) => number>()(flippedUnion);
expectIdentical<number>()(flippedUnion(true, 'hello'));
expectIdentical<number>()(flippedUnion(false, 42));

const reversedUnion = reverseArgs(unionFunc);
expectIdentical<(b: boolean, a: string | number) => number>()(reversedUnion);

// -- 可选参数（翻转后变为必选，类型加上 undefined） --

declare const optionalFunc: (a: number, b?: string) => string;
const flippedOptional = flip(optionalFunc);
// 可选参数翻转后变为必选，类型变为 string | undefined
expectIdentical<(b: string | undefined, a: number) => string>()(
  flippedOptional,
);
expectIdentical<string>()(flippedOptional('hello', 42));

declare const optionalFunc2: (a: number, b?: string, c?: boolean) => string;
const flippedOptional2 = flip(optionalFunc2);
// b变成必选，但不应该影响c
expectIdentical<(b: string | undefined, a: number, c?: boolean) => string>()(
  flippedOptional2,
);

declare const optionalFunc3: (a?: number, b?: string) => string;
const flippedOptional3 = flip(optionalFunc3);
// 不应该变成必选
expectIdentical<(b?: string, a?: number) => string>()(flippedOptional3);

declare const optionalFunc4: (
  a?: number,
  b?: string,
  c?: boolean,
  d?: bigint,
) => string;
const flippedOptional4 = flip(optionalFunc4);
// 不应该变成必选
expectIdentical<(b?: string, a?: number, c?: boolean, d?: bigint) => string>()(
  flippedOptional4,
);

const reversedOptional = reverseArgs(optionalFunc);
// 可选参数反转后变为必选，类型变为 string | undefined
expectIdentical<(b: string | undefined, a: number) => string>()(
  reversedOptional,
);

const reversedOptional2 = reverseArgs(optionalFunc2);
expectIdentical<
  (c: boolean | undefined, b: string | undefined, a: number) => string
>()(reversedOptional2);

const reversedOptional3 = reverseArgs(optionalFunc3);
// 不应该变成必选
expectIdentical<(b?: string, a?: number) => string>()(reversedOptional3);

const reversedOptional4 = reverseArgs(optionalFunc4);
// 不应该变成必选
expectIdentical<(d?: bigint, c?: boolean, b?: string, a?: number) => string>()(
  reversedOptional4,
);

// -- 默认参数（翻转后变为必选+undefined） --
const defaultFunc = (a: number, b: string = 'hello') => `${a}-${b}`;
const flippedDefault = flip(defaultFunc);
// 默认参数翻转后变为必选
expectIdentical<(b: string | undefined, a: number) => string>()(flippedDefault);
expectIdentical<string>()(flippedDefault('hello', 42));

const reversedDefault = reverseArgs(defaultFunc);
// 默认参数反转后变为必选
expectIdentical<(b: string | undefined, a: number) => string>()(
  reversedDefault,
);

// ===================================================================
// 🚀 This 绑定测试
// ===================================================================

declare const contextObj: {
  base: number;
  add(this: {base: number}, a: number, b: string): number;
};

// eslint-disable-next-line @typescript-eslint/unbound-method
const flippedMethod = flip(contextObj.add);
expectIdentical<(this: {base: number}, b: string, a: number) => number>()(
  flippedMethod,
);
expectIdentical<number>()(flippedMethod.call({base: 20}, 'hello', 3));

// eslint-disable-next-line @typescript-eslint/unbound-method
const reversedMethod = reverseArgs(contextObj.add);
expectIdentical<(this: {base: number}, b: string, a: number) => number>()(
  reversedMethod,
);
expectIdentical<number>()(reversedMethod.call({base: 20}, 'hello', 3));

// ===================================================================
// 🔢 Rest 参数测试（应该报错）
// ===================================================================

// -- Rest 参数函数 --
declare const restFunc: (...args: number[]) => number;
// @ts-expect-error: Rest 参数函数不能翻转
flip(restFunc);

// @ts-expect-error: Rest 参数函数不能翻转
reverseArgs(restFunc);

// -- 混合参数与 Rest --
declare const mixedRest: (a: string, b: number, ...rest: boolean[]) => string;
// @ts-expect-error: Rest 参数函数不能翻转
flip(mixedRest);

// @ts-expect-error: Rest 参数函数不能翻转
reverseArgs(mixedRest);

// ===================================================================
// 🧪 复杂链式调用测试
// ===================================================================

// -- 多次应用 flip --
const doubleFlipped = flip(flip(subtract));
expectIdentical<(a: number, b: string) => string>()(doubleFlipped);
expectIdentical<string>()(doubleFlipped(42, 'hello'));

// -- 多次应用 reverseArgs --
const doubleReversed = reverseArgs(reverseArgs(subtract));
expectIdentical<(a: number, b: string) => string>()(doubleReversed);
expectIdentical<string>()(doubleReversed(42, 'hello'));

// -- flip 后 reverseArgs --
const flipThenReverse = reverseArgs(flip(threeArgs));
// flip: [b, a, c] -> reverseArgs: [c, a, b]
expectIdentical<(c: boolean, a: string, b: number) => string>()(
  flipThenReverse,
);

// -- reverseArgs 后 flip --
const reverseThenFlip = flip(reverseArgs(threeArgs));
// reverseArgs: [c, b, a] -> flip: [b, c, a]
expectIdentical<(b: number, c: boolean, a: string) => string>()(
  reverseThenFlip,
);

// ===================================================================
// 🚀 极端压力测试 (100个参数)
// ===================================================================

type BuildTuple<
  N extends number,
  T extends unknown[] = [],
> = T['length'] extends N
  ? T
  : BuildTuple<
      N,
      [
        ...T,
        T['length'] extends 0
          ? string
          : T['length'] extends 1
            ? boolean
            : number,
      ]
    >;

type Args100 = BuildTuple<100>;

declare const sum100: (...args: Args100) => number;

// -- flip 对 100 参数函数（前两个参数类型不同，可验证翻转） --
const flippedRest100 = flip(sum100);
// prettier-ignore
expectIdentical<(this: unknown, args_1: boolean, args_0: string, args_2: number, args_3: number, args_4: number, args_5: number, args_6: number, args_7: number, args_8: number, args_9: number, args_10: number, args_11: number, args_12: number, args_13: number, args_14: number, args_15: number, args_16: number, args_17: number, args_18: number, args_19: number, args_20: number, args_21: number, args_22: number, args_23: number, args_24: number, args_25: number, args_26: number, args_27: number, args_28: number, args_29: number, args_30: number, args_31: number, args_32: number, args_33: number, args_34: number, args_35: number, args_36: number, args_37: number, args_38: number, args_39: number, args_40: number, args_41: number, args_42: number, args_43: number, args_44: number, args_45: number, args_46: number, args_47: number, args_48: number, args_49: number, args_50: number, args_51: number, args_52: number, args_53: number, args_54: number, args_55: number, args_56: number, args_57: number, args_58: number, args_59: number, args_60: number, args_61: number, args_62: number, args_63: number, args_64: number, args_65: number, args_66: number, args_67: number, args_68: number, args_69: number, args_70: number, args_71: number, args_72: number, args_73: number, args_74: number, args_75: number, args_76: number, args_77: number, args_78: number, args_79: number, args_80: number, args_81: number, args_82: number, args_83: number, args_84: number, args_85: number, args_86: number, args_87: number, args_88: number, args_89: number, args_90: number, args_91: number, args_92: number, args_93: number, args_94: number, args_95: number, args_96: number, args_97: number, args_98: number, args_99: number) => number>()(flippedRest100);

// -- reverseArgs 对 100 参数函数 --
const reversedRest100 = reverseArgs(sum100);
// prettier-ignore
expectIdentical<(this: unknown, args_99: number, args_98: number, args_97: number, args_96: number, args_95: number, args_94: number, args_93: number, args_92: number, args_91: number, args_90: number, args_89: number, args_88: number, args_87: number, args_86: number, args_85: number, args_84: number, args_83: number, args_82: number, args_81: number, args_80: number, args_79: number, args_78: number, args_77: number, args_76: number, args_75: number, args_74: number, args_73: number, args_72: number, args_71: number, args_70: number, args_69: number, args_68: number, args_67: number, args_66: number, args_65: number, args_64: number, args_63: number, args_62: number, args_61: number, args_60: number, args_59: number, args_58: number, args_57: number, args_56: number, args_55: number, args_54: number, args_53: number, args_52: number, args_51: number, args_50: number, args_49: number, args_48: number, args_47: number, args_46: number, args_45: number, args_44: number, args_43: number, args_42: number, args_41: number, args_40: number, args_39: number, args_38: number, args_37: number, args_36: number, args_35: number, args_34: number, args_33: number, args_32: number, args_31: number, args_30: number, args_29: number, args_28: number, args_27: number, args_26: number, args_25: number, args_24: number, args_23: number, args_22: number, args_21: number, args_20: number, args_19: number, args_18: number, args_17: number, args_16: number, args_15: number, args_14: number, args_13: number, args_12: number, args_11: number, args_10: number, args_9: number, args_8: number, args_7: number, args_6: number, args_5: number, args_4: number, args_3: number, args_2: number, args_1: boolean, args_0: string) => number>()(reversedRest100);
