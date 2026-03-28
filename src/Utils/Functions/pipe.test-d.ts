// ========================================
// ./__tests__/Utils/Functions/pipe-type.ts
// ========================================

import {expectIdentical} from '../type-tool';
import {run, runAsync, pipe, pipeAsync} from './pipe';

// ===================================================================
// 1. 基础功能类型测试
// ===================================================================

declare const add1: (x: number) => number;
declare const mul2: (x: number) => number;
declare const toString: (x: number) => string;

// 1.1 同步 pipe 基础
const syncPipe = pipe(add1, mul2, toString);
expectIdentical<string>()(syncPipe(5));
// @ts-expect-error: 结果是 string，不能赋值给 number
expectIdentical<number>()(syncPipe(5));

// 1.2 异步 pipe 基础
declare const asyncAdd1: (x: number) => Promise<number>;
const asyncPipe = pipeAsync(asyncAdd1, mul2, toString);
expectIdentical<Promise<string>>()(asyncPipe(5));
// @ts-expect-error: 结果是 Promise<string>，不能赋值给 string
expectIdentical<string>()(asyncPipe(5));

// 1.3 空 pipe (Identity)
const emptyPipe_value = pipe()(42);
expectIdentical<42>()(emptyPipe_value);

// ===================================================================
// 2. 参数兼容性测试
// ===================================================================

// 2.1 第一个函数多参数
declare const multiParam: (a: number, b: number) => number;
const pipeWithMulti = pipe(multiParam, toString);
expectIdentical<string>()(pipeWithMulti(2, 42));

// @ts-expect-error: 参数数量不足
pipeWithMulti(1);
// @ts-expect-error: 参数类型错误
pipeWithMulti(42, 'world');

// 2.2 中间函数类型错位
// @ts-expect-error: number 不能赋值给 string
pipe(add1, (x: string) => x.length);

// 2.3 可选参数
declare const optionalParam: (x?: number) => number;
const pipeWithOptional = pipe(optionalParam, toString);
expectIdentical<string>()(pipeWithOptional(5));
expectIdentical<string>()(pipeWithOptional());

// ===================================================================
// 3. run / runAsync 输入校验
// ===================================================================

// 3.1 run 正确输入
expectIdentical<number>()(run(10, add1, mul2));

// 3.2 run 错误输入
// @ts-expect-error: 初始值类型不匹配
run('10', add1, mul2);

// 3.3 runAsync 正确输入
expectIdentical<Promise<number>>()(runAsync(10, asyncAdd1, mul2));

// 3.4 runAsync 错误输入
// @ts-expect-error: 初始值类型错误
void runAsync('10', asyncAdd1, mul2);

// ===================================================================
// 4. 异步/同步混合测试
// ===================================================================

// 4.1 允许同步 pipe 中混入 async 函数
declare const _await: (v: Promise<unknown>) => Promise<unknown>;
void pipe(add1, asyncAdd1, _await);

// 4.2 异步 pipe 中使用同步函数
const mixedAsyncPipe = pipeAsync(add1, asyncAdd1, mul2);
expectIdentical<Promise<number>>()(mixedAsyncPipe(5));

// 4.3 异步 pipe 中第一个函数是同步
const syncFirstAsyncPipe = pipeAsync(mul2, asyncAdd1);
expectIdentical<Promise<number>>()(syncFirstAsyncPipe(5));

// ===================================================================
// 5. 泛型与类型推导
// ===================================================================

// 5.1 泛型函数保持类型
declare const id: <T>(x: T) => T;
const genericPipe = pipe(id<number>, add1);
expectIdentical<number>()(genericPipe(100));
// @ts-expect-error: 结果是 number
expectIdentical<string>()(genericPipe(100));

// 5.2 复杂泛型
declare const wrap: <T>(x: T) => {value: T};
declare const unwrap: <T>(obj: {value: T}) => T;
const complexPipe = pipe(wrap<string>, unwrap<string>);
expectIdentical<string>()(complexPipe('meow'));
// @ts-expect-error: 结果是 string
expectIdentical<number>()(complexPipe('meow'));

// ===================================================================
// 6. 边界与错误场景
// ===================================================================

// 6.1 单函数 pipe
const singlePipe = pipe(add1);
expectIdentical<number>()(singlePipe(1));

// 6.2 run with single function
expectIdentical<number>()(run(1, add1));

// 6.3 错误：后续函数多参数
declare const badFn: (a: number, b: number) => number;
// @ts-expect-error: 后续函数必须是单参数
const badPipe2 = pipe(add1, badFn);

// 6.4 错误：run 传入空函数列表
// @ts-expect-error: 至少需要一个函数
run(1);

// ===================================================================
// 7. 异步边界测试
// ===================================================================

// 7.1 异步 pipe 最终返回
const asyncToSync = pipeAsync(asyncAdd1, add1, toString);
expectIdentical<Promise<string>>()(asyncToSync(1));

// 7.2 runAsync 返回同步值（全同步链）
expectIdentical<Promise<number>>()(runAsync(1, add1, mul2));

// 7.3 异步函数返回非 Promise
declare const fakeAsync: (x: number) => number;
const fakePipe = pipeAsync(fakeAsync, asyncAdd1);
expectIdentical<Promise<number>>()(fakePipe(1));

// ===================================================================
// 8. 极端测试：长链 + 复杂类型
// ===================================================================

type User = {name: string; age: number};
declare const fetchUser: (id: number) => Promise<User>;
declare const getName: (user: User) => User['name'];
declare const greet: (name: User['name']) => string;

const longAsyncPipe = pipeAsync(fetchUser, getName, greet);
expectIdentical<Promise<string>>()(longAsyncPipe(5));

// @ts-expect-error: 类型链断裂 (User -> string 不匹配)
pipeAsync(fetchUser, (x: string) => x, greet);

// 130个函数长链测试
// prettier-ignore
pipe(
  add1, add1, add1, add1, add1, add1, add1, add1, add1, add1,
  add1, add1, add1, add1, add1, add1, add1, add1, add1, add1,
  add1, add1, add1, add1, add1, add1, add1, add1, add1, add1,
  add1, add1, add1, add1, add1, add1, add1, add1, add1, add1,
  add1, add1, add1, add1, add1, add1, add1, add1, add1, add1,
  add1, add1, add1, add1, add1, add1, add1, add1, add1, add1,
  add1, add1, add1, add1, add1, add1, add1, add1, add1, add1,
  add1, add1, add1, add1, add1, add1, add1, add1, add1, add1,
  add1, add1, add1, add1, add1, add1, add1, add1, add1, add1,
  add1, add1, add1, add1, add1, add1, add1, add1, add1, add1,
  add1, add1, add1, add1, add1, add1, add1, add1, add1, add1,
  add1, add1, add1, add1, add1, add1, add1, add1, add1, add1,
  add1, add1, add1, add1, add1, add1, add1, add1, add1, add1,
  // @ts-expect-error: 末尾类型不匹配 (number -> string)
  (s: string) => s
);
