// ========================================
// ./src/Utils/Functions/base.spec.ts
// ========================================
import {describe, it, expect, vi} from 'vitest';
import {
  identity,
  noop,
  asyncNoop,
  unary,
  negate,
  once,
  ary,
  rest,
  spread,
  partial,
  partialRight,
  after,
  before,
  memoize,
  attempt,
  NOT_INVOKED,
} from './base';

// ============================
// identity 函数测试
// ============================
describe.concurrent('identity function', () => {
  it('should return the same value for primitive types', () => {
    // 测试数字
    expect(identity(42)).toBe(42);

    // 测试字符串
    expect(identity('hello')).toBe('hello');

    // 测试布尔值
    expect(identity(true)).toBe(true);
    expect(identity(false)).toBe(false);

    // 测试 null 和 undefined
    expect(identity(null)).toBe(null);
    expect(identity(undefined)).toBe(undefined);
  });
});

// ============================
// noop 和 asyncNoop 函数测试
// ============================
describe.concurrent('noop and asyncNoop functions', () => {
  it('noop should return undefined', () => {
    // noop 应该返回 undefined
    expect(noop()).toBeUndefined();
  });

  it('asyncNoop should return a Promise that resolves to undefined', async () => {
    // asyncNoop 应该返回一个 Promise
    const result = asyncNoop();
    expect(result).toBeInstanceOf(Promise);

    // Promise 应该解析为 undefined
    await expect(result).resolves.toBeUndefined();
  });
});

// ============================
// unary 函数测试
// ============================
describe.concurrent('unary function', () => {
  it('should call the original function with only the first argument', () => {
    // 创建一个会收集所有参数的函数
    const mockFn = vi.fn((...args) => args.length);
    const unaryFn = unary(mockFn);

    // 调用一元化函数
    const result = unaryFn('first');

    // 应该只接收第一个参数
    expect(result).toBe(1);
    expect(mockFn).toHaveBeenCalledWith('first');
    expect(mockFn).not.toHaveBeenCalledWith('first', 'second', 'third');
  });

  it('should preserve the return type of the original function', () => {
    // 测试不同类型的返回值
    const stringFn = unary((x: string) => x.toUpperCase());
    expect(stringFn('hello')).toBe('HELLO');

    const numberFn = unary((x: number) => x * 2);
    expect(numberFn(5)).toBe(10);

    const objectFn = unary((x: {value: number}) => ({
      ...x,
      value: x.value + 1,
    }));
    expect(objectFn({value: 10})).toEqual({value: 11});
  });
});

// ============================
// negate 函数测试
// ============================
describe.concurrent('negate function', () => {
  it('should return the opposite boolean value of the predicate', () => {
    // 测试简单的谓词函数
    const isEven = (n: number) => n % 2 === 0;
    const isOdd = negate(isEven);

    expect(isOdd(2)).toBe(false); // 偶数，取反为 false
    expect(isOdd(3)).toBe(true); // 奇数，取反为 true
  });

  it('should work with predicates that take multiple arguments', () => {
    // 测试多参数谓词
    const equals = (a: number, b: number) => a === b;
    const notEquals = negate(equals);

    expect(notEquals(1, 1)).toBe(false); // 相等，取反为 false
    expect(notEquals(1, 2)).toBe(true); // 不相等，取反为 true
  });

  it('should pass all arguments to the original predicate', () => {
    // 测试参数传递是否正确
    const mockPredicate = vi.fn((..._args: unknown[]) => true);
    const negated = negate(mockPredicate);

    negated('arg1', 2, {key: 'value'});
    expect(mockPredicate).toHaveBeenCalledWith('arg1', 2, {key: 'value'});
  });
});

// ============================
// once 函数测试
// ============================
describe.concurrent('once function', () => {
  it('should call the original function only once', () => {
    // 创建一个模拟函数来追踪调用次数
    let callCount = 0;
    const increment = once(() => {
      callCount++;
      return callCount;
    });

    // 多次调用
    const result1 = increment();
    const result2 = increment();
    const result3 = increment();

    // 应该只被调用一次
    expect(callCount).toBe(1);
    expect(result1).toBe(1);
    expect(result2).toBe(1); // 返回第一次的结果
    expect(result3).toBe(1); // 返回第一次的结果
  });

  it('should preserve arguments on first call', () => {
    // 测试带参数的函数
    const mockFn = vi.fn((a: string, b: number) => a + b);
    const onceFn = once(mockFn);

    const result = onceFn('test', 123);
    expect(result).toBe('test123');
    expect(mockFn).toHaveBeenCalledWith('test', 123);

    // 第二次调用应该使用缓存结果，不再调用原始函数
    const result2 = onceFn('different', 999);
    expect(result2).toBe('test123'); // 仍然是第一次的结果
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should handle different return types', () => {
    // 测试返回对象的函数
    const createObject = once(() => ({id: Math.random()}));
    const obj1 = createObject();
    const obj2 = createObject();

    expect(obj1).toBe(obj2); // 应该是同一个对象引用
    expect(obj1.id).toBe(obj2.id);
  });
});

// ============================
// ary 函数测试
// ============================
describe.concurrent('ary function', () => {
  it('should call function with only first n arguments', () => {
    // 创建一个收集所有参数的函数
    const collectArgs = vi.fn((...args: unknown[]) => args.length);

    // 限制为前 2 个参数
    const ary2 = ary(collectArgs, 2);

    // 调用时传入 4 个参数
    const result = ary2('a', 'b', 'c', 'd');

    // 应该只接收前 2 个参数
    expect(result).toBe(2);
    expect(collectArgs).toHaveBeenCalledWith('a', 'b');
  });

  it('should handle edge cases for n', () => {
    const mockFn = vi.fn((...args: unknown[]) => args);

    // n = 0，不传递任何参数
    const ary0 = ary(mockFn, 0);
    ary0('a', 'b', 'c');
    expect(mockFn).toHaveBeenCalledWith(); // 空参数列表

    // n 大于实际参数数量
    const ary5 = ary(mockFn, 5);
    ary5('a', 'b');
    expect(mockFn).toHaveBeenCalledWith('a', 'b'); // 只传递实际存在的参数
  });
});

// ============================
// rest 函数测试
// ============================
describe.concurrent('rest function', () => {
  it('should split arguments based on function length', () => {
    // 创建一个接受两个参数的函数：第一个是固定参数数组，第二个是剩余参数数组
    const processArgs = vi.fn((fixed: [string], rest: number[]) => ({
      fixed,
      rest,
    }));

    const restFn = rest(processArgs);

    // 调用转换后的函数
    const result = restFn('prefix', 1, 2, 3, 4);

    // 固定参数部分长度应为 fn.length - 1 = 1
    // 所以 'prefix' 是固定参数，[1, 2, 3, 4] 是剩余参数
    expect(result).toEqual({
      fixed: ['prefix'],
      rest: [1, 2, 3, 4],
    });
  });

  it('should work with zero fixed arguments', () => {
    const processAllAsRest = vi.fn(
      (_fixed: unknown[], ...restArgs: number[][]) => restArgs[0],
    );

    const restFn = rest(processAllAsRest);

    const result = restFn(1, 2, 3);
    expect(result).toEqual([1, 2, 3]);
    expect(processAllAsRest).toHaveBeenCalledWith([], [1, 2, 3]);
  });

  it('should handle function with length 0 (only rest parameters)', () => {
    // 定义一个只有剩余参数的函数，这样 fn.length 就是 0
    const processOnlyRest = vi.fn(
      (...allArgs: [unknown[], number[]]) => allArgs[1],
    );

    // 验证 length 确实是 0
    expect(processOnlyRest.length).toBe(0);

    const restFn = rest(processOnlyRest);

    const result = restFn(1, 2, 3);

    expect(result).toEqual([1, 2, 3]);
    expect(processOnlyRest).toHaveBeenCalledWith([], [1, 2, 3]);
  });

  it('should work with multiple fixed arguments (fn.length > 2)', () => {
    // fn.length = 3，所以 fixedLength = 2
    // fn 接受三个参数，但 rest 只传入两个（fixed 和 restParts）
    const processMultiple = vi.fn(
      (fixed: [string, number], rest: boolean[], _unused?: undefined) => ({
        fixed,
        rest,
      }),
    );

    const restFn = rest(processMultiple);

    const result = restFn('name', 42, true, false, true);

    expect(result).toEqual({
      fixed: ['name', 42],
      rest: [true, false, true],
    });
    expect(processMultiple).toHaveBeenCalledWith(
      ['name', 42],
      [true, false, true],
    );
  });

  it('should correctly infer types with empty FixedArgs', () => {
    // fn.length = 1，所以 fixedLength = 0
    // fn 使用 rest 参数接收第二个参数
    const processEmptyFixed = vi.fn((fixed: [], ...restArgs: [number[]]) => ({
      fixed,
      rest: restArgs[0],
    }));

    const restFn = rest(processEmptyFixed);

    const result = restFn(1, 2, 3);

    expect(result).toEqual({
      fixed: [],
      rest: [1, 2, 3],
    });
    expect(processEmptyFixed).toHaveBeenCalledWith([], [1, 2, 3]);
  });

  it('should preserve this context', () => {
    const context = {multiplier: 10};
    const processWithContext = vi.fn(function (
      this: typeof context,
      fixed: [number],
      rest: number[],
    ) {
      return fixed[0] * this.multiplier + rest.reduce((a, b) => a + b, 0);
    });

    const restFn = rest(processWithContext);

    const result = restFn.call(context, 5, 1, 2, 3);

    expect(result).toBe(5 * 10 + 1 + 2 + 3);
    expect(processWithContext).toHaveBeenCalledWith([5], [1, 2, 3]);
  });
});

// ============================
// spread 函数测试
// ============================
describe.concurrent('spread function', () => {
  it('should spread array arguments when calling the original function', () => {
    // 创建一个接受三个参数的函数
    const sumThree = vi.fn((a: number, b: number, c: number) => a + b + c);
    const spreadFn = spread(sumThree);

    // 使用数组调用
    const result = spreadFn([1, 2, 3]);

    expect(result).toBe(6);
    expect(sumThree).toHaveBeenCalledWith(1, 2, 3);
  });

  it('should work with different types of arguments', () => {
    // 测试不同类型的参数
    const createObject = vi.fn(
      (name: string, age: number, active: boolean) => ({
        name,
        age,
        active,
      }),
    );

    const spreadFn = spread(createObject);
    const result = spreadFn(['Alice', 30, true]);

    expect(result).toEqual({
      name: 'Alice',
      age: 30,
      active: true,
    });
  });
});

// ============================
// partial 函数测试
// ============================
describe.concurrent('partial function', () => {
  it('should prepend fixed arguments to function calls', () => {
    // 创建一个接受三个参数的函数
    const greet = vi.fn(
      (greeting: string, name: string, punctuation: string) =>
        `${greeting}, ${name}${punctuation}`,
    );

    // 固定前两个参数
    const partialGreet = partial(greet, 'Hello', 'Alice');

    // 只需要提供剩余的参数
    const result = partialGreet('!');

    expect(result).toBe('Hello, Alice!');
    expect(greet).toHaveBeenCalledWith('Hello', 'Alice', '!');
  });

  it('should work with multiple remaining arguments', () => {
    const joinValues = vi.fn(
      (prefix: string, a: number, b: number, c: number) =>
        `${prefix}: ${a}, ${b}, ${c}`,
    );

    const partialJoin = partial(joinValues, 'Numbers');
    const result = partialJoin(1, 2, 3);

    expect(result).toBe('Numbers: 1, 2, 3');
  });

  it('should handle empty fixed arguments', () => {
    // 测试不固定任何参数的情况
    const identityPartial = partial(identity, 'test');
    const result = identityPartial();

    expect(result).toBe('test');
  });
});

// ============================
// partialRight 函数测试
// ============================
describe.concurrent('partialRight function', () => {
  it('should append fixed arguments to function calls', () => {
    // 创建一个接受三个参数的函数
    const formatMessage = vi.fn(
      (name: string, action: string, target: string) =>
        `${name} ${action} ${target}`,
    );

    // 固定后两个参数
    const partialRightFormat = partialRight(
      formatMessage,
      'ran to',
      'the store',
    );

    // 只需要提供第一个参数
    const result = partialRightFormat('Alice');

    expect(result).toBe('Alice ran to the store');
    expect(formatMessage).toHaveBeenCalledWith('Alice', 'ran to', 'the store');
  });

  it('should work with multiple initial arguments', () => {
    const calculate = vi.fn(
      (a: number, b: number, c: number, d: number) => a + b + c + d,
    );

    const partialRightCalc = partialRight(calculate, 3, 4);
    const result = partialRightCalc(1, 2);

    expect(result).toBe(10); // 1 + 2 + 3 + 4
  });
});

// ============================
// after 函数测试
// ============================
describe.concurrent('after function', () => {
  it('should only invoke the function after being called n times', () => {
    let callCount = 0;
    const increment = after(3, () => {
      callCount++;
      return 'executed';
    });

    // 前两次调用应该返回 NOT_INVOKED
    expect(increment()).toBe(NOT_INVOKED);
    expect(increment()).toBe(NOT_INVOKED);

    // 第三次调用应该执行函数
    expect(increment()).toBe('executed');
    expect(callCount).toBe(1);

    // 后续调用应该继续执行函数
    expect(increment()).toBe('executed');
    expect(callCount).toBe(2);
  });

  it('should pass arguments on the execution call', () => {
    const mockFn = vi.fn((a: string, b: number) => a + b);
    const afterFn = after(2, mockFn);

    // 第一次调用不执行
    afterFn('test', 1);
    expect(mockFn).not.toHaveBeenCalled();

    // 第二次调用执行并传递参数
    const result = afterFn('hello', 2);
    expect(result).toBe('hello2');
    expect(mockFn).toHaveBeenCalledWith('hello', 2);
  });

  it('should distinguish NOT_INVOKED from undefined return value', () => {
    // 函数返回 undefined 时，应该能区分是未调用还是真的返回 undefined
    const returnUndefined = after(2, () => undefined);
    const returnUndefinedType = after(2, (): undefined => undefined);

    // 第一次调用返回 NOT_INVOKED
    expect(returnUndefined()).toBe(NOT_INVOKED);
    expect(returnUndefinedType()).toBe(NOT_INVOKED);

    // 第二次调用返回真正的 undefined
    const result1 = returnUndefined();
    const result2 = returnUndefinedType();
    expect(result1).toBeUndefined();
    expect(result2).toBeUndefined();
    expect(result1).not.toBe(NOT_INVOKED);
    expect(result2).not.toBe(NOT_INVOKED);
  });
});

// ============================
// before 函数测试
// ============================
describe.concurrent('before function', () => {
  it('should only invoke the function before being called n times', () => {
    let callCount = 0;
    const increment = before(3, () => {
      callCount++;
      return callCount;
    });

    // 前三次调用应该执行
    expect(increment()).toBe(1);
    expect(increment()).toBe(2);
    expect(increment()).toBe(3);

    // 第四次及之后应该返回最后一次结果
    expect(increment()).toBe(3);
    expect(increment()).toBe(3);

    // 总共应该只执行了3次
    expect(callCount).toBe(3);
  });

  it('should return the last result after reaching the limit', () => {
    const random = before(2, () => Math.random());

    const firstResult = random();
    const secondResult = random();
    const thirdResult = random();

    // 前两次结果不同，第三次应该和第二次相同
    expect(firstResult).not.toBe(secondResult);
    expect(thirdResult).toBe(secondResult);
  });

  it('should return NOT_INVOKED when n is 0', () => {
    const fn = vi.fn(() => 'result');
    const beforeFn = before(0, fn);

    // n=0 时，函数永远不会被调用
    expect(beforeFn()).toBe(NOT_INVOKED);
    expect(beforeFn()).toBe(NOT_INVOKED);
    expect(fn).not.toHaveBeenCalled();
  });

  it('should distinguish NOT_INVOKED from undefined return value', () => {
    const returnUndefined = before(2, () => undefined);

    // 第一次调用返回真正的 undefined（函数被执行了）
    const firstResult = returnUndefined();
    expect(firstResult).toBeUndefined();
    expect(firstResult).not.toBe(NOT_INVOKED);

    // 第二次调用返回真正的 undefined
    const secondResult = returnUndefined();
    expect(secondResult).toBeUndefined();
    expect(secondResult).not.toBe(NOT_INVOKED);

    // 第三次调用返回缓存的 undefined
    const thirdResult = returnUndefined();
    expect(thirdResult).toBeUndefined();
    expect(thirdResult).not.toBe(NOT_INVOKED);
  });
});

// ============================
// memoize 函数测试
// ============================
describe.concurrent('memoize function', () => {
  it('should cache results based on arguments', () => {
    let computationCount = 0;
    const expensive = memoize((x: number) => {
      computationCount++;
      return x * x;
    });

    // 第一次调用应该计算
    expect(expensive(5)).toBe(25);
    expect(computationCount).toBe(1);

    // 相同参数第二次调用应该使用缓存
    expect(expensive(5)).toBe(25);
    expect(computationCount).toBe(1); // 没有增加

    // 不同参数应该重新计算
    expect(expensive(10)).toBe(100);
    expect(computationCount).toBe(2);
  });

  it('should use custom resolver when provided', () => {
    let callCount = 0;
    const process = memoize(
      (obj: {id: number; name: string}) => {
        callCount++;
        return `${obj.name}#${obj.id}`;
      },
      (obj) => obj.id, // 只根据 id 缓存
    );

    const obj1 = {id: 1, name: 'Alice'};
    const obj2 = {id: 1, name: 'Bob'}; // 相同 id，不同 name

    // 第一次调用
    expect(process(obj1)).toBe('Alice#1');
    expect(callCount).toBe(1);

    // 第二次调用，id 相同，应该使用缓存
    expect(process(obj2)).toBe('Alice#1'); // 注意：返回的是缓存的结果
    expect(callCount).toBe(1); // 没有重新计算
  });

  it('should handle multiple arguments correctly', () => {
    const add = memoize((a: number, b: number, c: number) => {
      return a + b + c;
    });

    // 第一次调用
    expect(add(1, 2, 3)).toBe(6);

    // 相同参数第二次调用
    expect(add(1, 2, 3)).toBe(6);

    // 不同参数
    expect(add(2, 3, 4)).toBe(9);
  });

  it('should have limitations with JSON.stringify for cache key', () => {
    // 测试 JSON.stringify 的局限性：函数和循环引用无法正确处理
    const fn = memoize((obj: unknown) => obj);

    const func = () => {};
    const objWithFunc = {fn: func};

    // 第一次调用
    const result1 = fn(objWithFunc);

    // 第二次调用相同对象
    const result2 = fn(objWithFunc);

    // 虽然对象包含函数，但 JSON.stringify 会丢弃函数
    // 所以缓存键相同，应该返回缓存结果
    expect(result2).toBe(result1);
  });
});

// ============================
// attempt 函数测试
// ============================
describe.concurrent('attempt function', () => {
  it('should return [undefined, result] for successful sync function', () => {
    const divide = (a: number, b: number) => a / b;
    const safeDivide = attempt(divide);

    const [err, result] = safeDivide(10, 2) as [undefined, number];

    expect(err).toBeUndefined();
    expect(result).toBe(5);
  });

  it('should return [error, undefined] for throwing sync function', () => {
    const risky = () => {
      throw new Error('Something went wrong');
    };
    const safeRisky = attempt(risky);

    const [err, result] = safeRisky() as [Error, undefined];

    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('Something went wrong');
    expect(result).toBeUndefined();
  });

  it('should return [undefined, result] for successful async function', async () => {
    const fetchData = async (id: number): Promise<{id: number; name: string}> =>
      Promise.resolve({id, name: 'test'});
    const safeFetch = attempt(fetchData);

    const [err, result] = (await safeFetch(42)) as [
      undefined,
      {id: number; name: string},
    ];

    expect(err).toBeUndefined();
    expect(result).toEqual({id: 42, name: 'test'});
  });

  it('should return [error, undefined] for rejecting async function', async () => {
    const failingAsync = (): Promise<never> => {
      throw new Error('Async failure');
    };
    const safeFailing = attempt(failingAsync);

    const [err, result] = (await safeFailing()) as [Error, undefined];

    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('Async failure');
    expect(result).toBeUndefined();
  });

  it('should return [error, undefined] for Promise.reject', async () => {
    // 使用 Promise.reject 来覆盖 then 的第二个回调分支
    const rejectingAsync = (): Promise<string> =>
      Promise.reject(new Error('Promise rejected'));
    const safeRejecting = attempt(rejectingAsync);

    const [err, result] = (await safeRejecting()) as [Error, undefined];

    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('Promise rejected');
    expect(result).toBeUndefined();
  });

  it('should preserve function arguments', () => {
    const concat = (a: string, b: string, c: string) => a + b + c;
    const safeConcat = attempt(concat);

    const [err, result] = safeConcat('Hello', ' ', 'World') as [
      undefined,
      string,
    ];

    expect(err).toBeUndefined();
    expect(result).toBe('Hello World');
  });

  it('should work with JSON.parse as common use case', () => {
    const safeParse = attempt(JSON.parse);

    // 成功解析
    const [err1, data1] = safeParse('{"a":1}');
    expect(err1).toBeUndefined();
    expect(data1).toEqual({a: 1});

    // 解析失败
    const [err2, data2] = safeParse('invalid json');
    expect(err2).toBeInstanceOf(Error);
    expect(data2).toBeUndefined();
  });

  it('should handle non-Error throws', () => {
    const throwString = () => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw 'string error';
    };
    const safeThrow = attempt(throwString);

    const [err, result] = safeThrow();

    expect(err).toBe('string error');
    expect(result).toBeUndefined();
  });

  it('should handle null and undefined return values correctly', () => {
    const returnNull = () => null;
    const returnUndefined = () => undefined;

    const safeNull = attempt(returnNull);
    const safeUndefined = attempt(returnUndefined);

    const [err1, result1] = safeNull();
    expect(err1).toBeUndefined();
    expect(result1).toBeNull();

    const [err2, result2] = safeUndefined();
    expect(err2).toBeUndefined();
    expect(result2).toBeUndefined();
  });
});
