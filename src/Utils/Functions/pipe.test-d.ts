// ========================================
// ./__tests__/Utils/Functions/pipe-type.ts
// ========================================

import {run, runAsync, pipe, pipeAsync} from './pipe';

// ===================================================================
// 辅助工具：类型断言
// ===================================================================

const expectType = <T>(_: T): void => {};

// ===================================================================
// 1. 基础功能类型测试
// ===================================================================

const add1 = (x: number) => x + 1;
const mul2 = (x: number) => x * 2;
const toString = (x: number) => x.toString();

// 1.1 同步 pipe 基础
const syncPipe = pipe(add1, mul2, toString);
expectType<string>(syncPipe(5));
// @ts-expect-error: 结果是 string，不能赋值给 number
expectType<number>(syncPipe(5));

// 1.2 异步 pipe 基础
const asyncAdd1 = async (x: number) => Promise.resolve(x + 1);
const asyncPipe = pipeAsync(asyncAdd1, mul2, toString);
expectType<Promise<string>>(asyncPipe(5));
// @ts-expect-error: 结果是 Promise<string>，不能赋值给 string
expectType<string>(asyncPipe(5));

// 1.3 空 pipe (Identity)
const emptyPipe = pipe();
expectType<number>(emptyPipe(42));

// ===================================================================
// 2. 参数兼容性测试
// ===================================================================

// 2.1 第一个函数多参数
const multiParam = (a: number, b: number) => a + b;
const pipeWithMulti = pipe(multiParam, toString);
expectType<string>(pipeWithMulti(2, 42));

// @ts-expect-error: 参数数量不足
pipeWithMulti(1);
// @ts-expect-error: 参数类型错误
pipeWithMulti(42, 'world');

// 2.2 中间函数类型错位
// @ts-expect-error: number 不能赋值给 string
pipe(add1, (x: string) => x.length);

// ===================================================================
// 3. run / runAsync 输入校验
// ===================================================================

// 3.1 run 正确输入
expectType<number>(run(10, add1, mul2));

// 3.2 run 错误输入
// @ts-expect-error: 初始值类型不匹配
run('10', add1, mul2);

// 3.3 runAsync 正确输入
expectType<Promise<number>>(runAsync(10, asyncAdd1, mul2));

// 3.4 runAsync 错误输入
// @ts-expect-error: 初始值类型错误
void runAsync('10', asyncAdd1, mul2);

// ===================================================================
// 4. 异步/同步混合测试
// ===================================================================

// 4.1 允许同步 pipe 中混入 async 函数
const _await = async (v: Promise<unknown>) => await v;
void pipe(add1, asyncAdd1, _await);

// 4.2 异步 pipe 中使用同步函数
const mixedAsyncPipe = pipeAsync(add1, asyncAdd1, mul2);
expectType<Promise<number>>(mixedAsyncPipe(5));

// 4.3 异步 pipe 中第一个函数是同步
const syncFirstAsyncPipe = pipeAsync(mul2, asyncAdd1);
expectType<Promise<number>>(syncFirstAsyncPipe(5));

// ===================================================================
// 5. 泛型与类型推导
// ===================================================================

// 5.1 泛型函数保持类型
const id = <T>(x: T) => x;
const genericPipe = pipe(id<number>, add1);
expectType<number>(genericPipe(100));
// @ts-expect-error: 结果是 number
expectType<string>(genericPipe(100));

// 5.2 复杂泛型
const wrap = <T>(x: T) => ({value: x});
const unwrap = <T>(obj: {value: T}) => obj.value;
const complexPipe = pipe(wrap<string>, unwrap<string>);
expectType<string>(complexPipe('meow'));
// @ts-expect-error: 结果是 string
expectType<number>(complexPipe('meow'));

// ===================================================================
// 6. 边界与错误场景
// ===================================================================

// 6.1 单函数 pipe
const singlePipe = pipe(add1);
expectType<number>(singlePipe(1));

// 6.2 run with single function
expectType<number>(run(1, add1));

// 6.3 错误：后续函数多参数
const badFn = (a: number, b: number) => a + b;
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
expectType<Promise<string>>(asyncToSync(1));

// 7.2 runAsync 返回同步值（全同步链）
expectType<Promise<number>>(runAsync(1, add1, mul2));

// 7.3 异步函数返回非 Promise
const fakeAsync = (x: number) => x; // 实际同步
const fakePipe = pipeAsync(fakeAsync, asyncAdd1);
expectType<Promise<number>>(fakePipe(1));

// ===================================================================
// 8. 极端测试：长链 + 复杂类型
// ===================================================================

type User = {name: string; age: number};
const fetchUser = async (id: number): Promise<User> =>
  Promise.resolve({name: '喵', age: id});
const getName = (user: User) => user.name;
const greet = (name: string) => `Hello, ${name}!`;

const longAsyncPipe = pipeAsync(fetchUser, getName, greet);
expectType<Promise<string>>(longAsyncPipe(5));

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
