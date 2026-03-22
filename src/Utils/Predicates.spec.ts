// ============================================
// ./src/Utils/Predicates.spec.ts
// ============================================
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {describe, it, expect, vi, afterEach} from 'vitest';
import {
  getTag,
  isString,
  isNumber,
  isFinite,
  isBoolean,
  isSymbol,
  isNull,
  isUndefined,
  isNil,
  isNotNil,
  isNotNullish,
  isPrimitive,
  isObject,
  isFunction,
  isArray,
  isPlainObject,
  isInteger,
  isSafeInteger,
  isLength,
  isDate,
  isRegExp,
  isError,
  isMap,
  isSet,
  isWeakMap,
  isWeakSet,
  isArrayBuffer,
  isTypedArray,
  isBrowser,
  isNode,
  isClient,
  isBuffer,
  isBlob,
  isFile,
  isIterable,
  isAsyncIterable,
  isPromise,
  isInstanceOf,
  isPropertyKey,
  isEmpty,
  isEmptyObject,
  isSerializable,
  isJSONValue,
  isJSONObject,
  isJSONArray,
  isJSON,
  isEmail,
  isUrl,
  isUUID,
  isEqualWith,
  isEqual,
} from './Predicates';

describe.concurrent('Predicates', () => {
  // ================= 基础类型检查测试 =================
  describe('Basic Type Checking Tests', () => {
    describe('getTag function', () => {
      it('should return correct tag for various values', () => {
        // 合并测试原始值和内置对象
        expect(getTag(undefined)).toBe('[object Undefined]');
        expect(getTag(null)).toBe('[object Null]');
        expect(getTag('test')).toBe('[object String]');
        expect(getTag(123)).toBe('[object Number]');
        expect(getTag(true)).toBe('[object Boolean]');
        expect(getTag(Symbol())).toBe('[object Symbol]');
        expect(getTag([])).toBe('[object Array]');
        expect(getTag({})).toBe('[object Object]');
        expect(getTag(new Date())).toBe('[object Date]');
        expect(getTag(/regex/)).toBe('[object RegExp]');
        expect(getTag(new Error())).toBe('[object Error]');
      });
    });

    describe('String type checking', () => {
      it('should correctly identify string values', () => {
        expect(isString('hello')).toBe(true);
        expect(isString('')).toBe(true);
        expect(isString(String('test'))).toBe(true);
        expect(isString(123)).toBe(false);
        expect(isString(true)).toBe(false);
        expect(isString(null)).toBe(false);
        expect(isString(undefined)).toBe(false);
        expect(isString({})).toBe(false);
      });
    });

    describe('Number type checking', () => {
      it('should correctly identify number values', () => {
        expect(isNumber(123)).toBe(true);
        expect(isNumber(0)).toBe(true);
        expect(isNumber(-123)).toBe(true);
        expect(isNumber(1.23)).toBe(true);
        expect(isNumber(Number('123'))).toBe(true);
        expect(isNumber(NaN)).toBe(true);
        expect(isNumber(Infinity)).toBe(true);
        expect(isNumber('123')).toBe(false);
        expect(isNumber(null)).toBe(false);
        expect(isNumber(undefined)).toBe(false);
      });

      it('should correctly identify finite numbers', () => {
        expect(isFinite(123)).toBe(true);
        expect(isFinite(0)).toBe(true);
        expect(isFinite(-123)).toBe(true);
        expect(isFinite(1.23)).toBe(true);
        expect(isFinite(Infinity)).toBe(false);
        expect(isFinite(-Infinity)).toBe(false);
        expect(isFinite(NaN)).toBe(false);
        expect(isFinite('123')).toBe(false);
      });
    });

    describe('Boolean type checking', () => {
      it('should correctly identify boolean values', () => {
        expect(isBoolean(true)).toBe(true);
        expect(isBoolean(false)).toBe(true);
        expect(isBoolean(Boolean(1))).toBe(true);
        expect(isBoolean(1)).toBe(false);
        expect(isBoolean('true')).toBe(false);
        expect(isBoolean(null)).toBe(false);
        expect(isBoolean(undefined)).toBe(false);
      });
    });

    describe('Symbol type checking', () => {
      it('should correctly identify symbol values', () => {
        expect(isSymbol(Symbol())).toBe(true);
        expect(isSymbol(Symbol('test'))).toBe(true);
        expect(isSymbol(Symbol.iterator)).toBe(true);
        expect(isSymbol('symbol')).toBe(false);
        expect(isSymbol(123)).toBe(false);
        expect(isSymbol(null)).toBe(false);
      });
    });

    describe('Null and undefined checking', () => {
      it('should correctly identify nullish values', () => {
        // isNull
        expect(isNull(null)).toBe(true);
        expect(isNull(undefined)).toBe(false);
        expect(isNull('')).toBe(false);
        expect(isNull(0)).toBe(false);

        // isUndefined
        expect(isUndefined(undefined)).toBe(true);
        expect(isUndefined(null)).toBe(false);
        expect(isUndefined('')).toBe(false);

        // isNil
        expect(isNil(null)).toBe(true);
        expect(isNil(undefined)).toBe(true);
        expect(isNil('')).toBe(false);
        expect(isNil(0)).toBe(false);

        // isNotNil
        expect(isNotNil('test')).toBe(true);
        expect(isNotNil(0)).toBe(true);
        expect(isNotNil(false)).toBe(true);
        expect(isNotNil(null)).toBe(false);
        expect(isNotNil(undefined)).toBe(false);

        // isNotNullish 泛型测试
        const testValues: Array<string | null | undefined> = [
          'a',
          null,
          'b',
          undefined,
        ];
        const filtered = testValues.filter(isNotNullish);
        expect(filtered).toEqual(['a', 'b']);
        expect(filtered[0].toUpperCase()).toBe('A'); // 类型推断测试
      });
    });
  });

  // ================= 复合类型检查测试 =================
  describe('Composite Type Checking Tests', () => {
    describe('Primitive type checking', () => {
      it('should correctly identify primitive values', () => {
        expect(isPrimitive('string')).toBe(true);
        expect(isPrimitive(123)).toBe(true);
        expect(isPrimitive(true)).toBe(true);
        expect(isPrimitive(Symbol())).toBe(true);
        expect(isPrimitive(BigInt(123))).toBe(true);
        expect(isPrimitive(null)).toBe(true);
        expect(isPrimitive(undefined)).toBe(true);
        expect(isPrimitive({})).toBe(false);
        expect(isPrimitive([])).toBe(false);
        expect(isPrimitive(() => {})).toBe(false);
        expect(isPrimitive(new Date())).toBe(false);
      });
    });

    describe('Object type checking', () => {
      it('should correctly identify object values', () => {
        expect(isObject({})).toBe(true);
        expect(isObject([])).toBe(true);
        expect(isObject(new Date())).toBe(true);
        expect(isObject(() => {})).toBe(true);
        expect(isObject(null)).toBe(false);
        expect(isObject(undefined)).toBe(false);
        expect(isObject(123)).toBe(false);
        expect(isObject('string')).toBe(false);
      });
    });

    describe('Function type checking', () => {
      it('should correctly identify function values', () => {
        expect(isFunction(() => {})).toBe(true);
        expect(isFunction(function () {})).toBe(true);
        expect(isFunction(class {})).toBe(true);
        expect(isFunction(Array.isArray)).toBe(true);
        expect(isFunction({})).toBe(false);
        expect(isFunction([])).toBe(false);
        expect(isFunction('function')).toBe(false);
        expect(isFunction(123)).toBe(false);
      });
    });

    describe('Array type checking', () => {
      it('should correctly identify array values', () => {
        expect(isArray([])).toBe(true);
        expect(isArray([1, 2, 3])).toBe(true);
        expect(isArray(new Array<unknown>())).toBe(true);
        expect(isArray({})).toBe(false);
        expect(isArray('array')).toBe(false);
        expect(isArray(123)).toBe(false);
        expect(isArray({length: 0})).toBe(false);
      });
    });

    describe('Plain object checking', () => {
      it('should correctly identify plain objects', () => {
        expect(isPlainObject({})).toBe(true);
        expect(isPlainObject({a: 1})).toBe(true);
        expect(isPlainObject(Object.create(null))).toBe(true);
        expect(isPlainObject([])).toBe(false);
        expect(isPlainObject(new Date())).toBe(false);
        expect(isPlainObject(null)).toBe(false);
        expect(isPlainObject(undefined)).toBe(false);
        expect(isPlainObject(() => {})).toBe(false);
        class CustomClass {}
        expect(isPlainObject(new CustomClass())).toBe(false);
      });
    });
  });

  // ================= 数字相关检查测试 =================
  describe('Number Validation Tests', () => {
    describe('Integer checking', () => {
      it('should correctly identify integers', () => {
        expect(isInteger(123)).toBe(true);
        expect(isInteger(0)).toBe(true);
        expect(isInteger(-123)).toBe(true);
        expect(isInteger(1.23)).toBe(false);
        expect(isInteger(NaN)).toBe(false);
        expect(isInteger(Infinity)).toBe(false);
        expect(isInteger('123')).toBe(false);
      });

      it('should correctly identify safe integers', () => {
        expect(isSafeInteger(0)).toBe(true);
        expect(isSafeInteger(Number.MAX_SAFE_INTEGER)).toBe(true);
        expect(isSafeInteger(Number.MIN_SAFE_INTEGER)).toBe(true);
        expect(isSafeInteger(Number.MAX_SAFE_INTEGER + 1)).toBe(false);
        expect(isSafeInteger(Number.MIN_SAFE_INTEGER - 1)).toBe(false);
        expect(isSafeInteger(1.23)).toBe(false);
        expect(isSafeInteger('123')).toBe(false);
      });
    });

    describe('Length checking', () => {
      it('should correctly identify valid lengths', () => {
        expect(isLength(0)).toBe(true);
        expect(isLength(10)).toBe(true);
        expect(isLength(Number.MAX_SAFE_INTEGER)).toBe(true);
        expect(isLength(-1)).toBe(false);
        expect(isLength(1.5)).toBe(false);
        expect(isLength(Number.MAX_SAFE_INTEGER + 1)).toBe(false);
        expect(isLength(NaN)).toBe(false);
        expect(isLength(Infinity)).toBe(false);
      });
    });
  });

  // ================= 内置对象检查测试 =================
  describe('Built-in Object Checking Tests', () => {
    describe('Date checking', () => {
      it('should correctly identify Date objects', () => {
        expect(isDate(new Date())).toBe(true);
        expect(isDate(new Date('2024-01-01'))).toBe(true);
        expect(isDate('2024-01-01')).toBe(false);
        expect(isDate(1704067200000)).toBe(false);
        expect(isDate({})).toBe(false);
      });
    });

    describe('RegExp checking', () => {
      it('should correctly identify RegExp objects', () => {
        expect(isRegExp(/test/)).toBe(true);
        expect(isRegExp(new RegExp('test'))).toBe(true);
        expect(isRegExp('/test/')).toBe(false);
        expect(isRegExp({})).toBe(false);
      });
    });

    describe('Error checking', () => {
      it('should correctly identify Error objects', () => {
        expect(isError(new Error())).toBe(true);
        expect(isError(new TypeError())).toBe(true);
        expect(isError(new RangeError())).toBe(true);
        expect(isError('error')).toBe(false);
        expect(isError({message: 'error'})).toBe(false);
      });
    });

    describe('Collection type checking', () => {
      it('should correctly identify Map, Set, WeakMap, and WeakSet', () => {
        // Map
        expect(isMap(new Map())).toBe(true);
        expect(isMap(new Map([['key', 'value']]))).toBe(true);
        expect(isMap({})).toBe(false);

        // Set
        expect(isSet(new Set())).toBe(true);
        expect(isSet(new Set([1, 2, 3]))).toBe(true);
        expect(isSet([])).toBe(false);

        // WeakMap
        expect(isWeakMap(new WeakMap())).toBe(true);
        const objKey = {};
        expect(isWeakMap(new WeakMap([[objKey, 'value']]))).toBe(true);
        expect(isWeakMap(new Map())).toBe(false);

        // WeakSet
        expect(isWeakSet(new WeakSet())).toBe(true);
        expect(isWeakSet(new WeakSet([objKey]))).toBe(true);
        expect(isWeakSet(new Set())).toBe(false);
      });
    });

    describe('ArrayBuffer and TypedArray checking', () => {
      it('should correctly identify ArrayBuffer and TypedArray objects', () => {
        const buffer = new ArrayBuffer(16);
        expect(isArrayBuffer(buffer)).toBe(true);
        expect(isArrayBuffer(new Uint8Array())).toBe(false);
        expect(isTypedArray(new Uint8Array())).toBe(true);
        expect(isTypedArray(new Int32Array())).toBe(true);
        expect(isTypedArray(new Float64Array())).toBe(true);
        expect(isTypedArray([])).toBe(false);
        expect(isTypedArray({})).toBe(false);
      });
    });
  });

  // ================= 环境特定类型检查测试 =================
  describe('Environment-Specific Type Checking Tests', () => {
    afterEach(() => {
      vi.unstubAllGlobals(); // 清理所有全局 stub
    });

    describe('Environment Detection', () => {
      // 合并 isBrowser 的多个场景
      it('should correctly detect browser environment', () => {
        // 完整浏览器环境
        const mockDocument = {title: '文档'};
        vi.stubGlobal('window', {document: mockDocument});
        vi.stubGlobal('document', mockDocument);
        expect(isBrowser()).toBe(true);
        vi.unstubAllGlobals();

        // window.document 和 document 不匹配
        vi.stubGlobal('window', {document: {}});
        vi.stubGlobal('document', {foo: 'bar'});
        expect(isBrowser()).toBe(false);
        vi.unstubAllGlobals();

        // 缺少 window
        vi.stubGlobal('window', undefined);
        vi.stubGlobal('document', {});
        expect(isBrowser()).toBe(false);
        vi.unstubAllGlobals();
      });

      // 合并 isClient 的多个场景
      it('should correctly detect client environment (window or self)', () => {
        // window 存在
        vi.stubGlobal('window', {});
        expect(isClient()).toBe(true);
        vi.unstubAllGlobals();

        // self 存在
        vi.stubGlobal('self', {});
        expect(isClient()).toBe(true);
        vi.unstubAllGlobals();

        // 两者都不存在
        vi.stubGlobal('window', undefined);
        vi.stubGlobal('self', undefined);
        expect(isClient()).toBe(false);
        vi.unstubAllGlobals();
      });

      // 合并 isNode 的多个场景
      it('should correctly detect Node.js environment', () => {
        // 标准 Node 环境
        vi.stubGlobal('process', {versions: {node: '20.0.0'}});
        expect(isNode()).toBe(true);
        vi.unstubAllGlobals();

        // process 不存在
        vi.stubGlobal('process', undefined);
        expect(isNode()).toBe(false);
        vi.unstubAllGlobals();

        // process.versions 缺失
        vi.stubGlobal('process', {});
        expect(isNode()).toBe(false);
        vi.unstubAllGlobals();

        // process.versions.node 缺失
        vi.stubGlobal('process', {versions: {}});
        expect(isNode()).toBe(false);
        vi.unstubAllGlobals();
      });
    });

    describe('Buffer checking', () => {
      // 合并 Buffer 的多个测试场景
      it('should correctly identify Buffer objects', () => {
        // 真实 Buffer
        if (typeof Buffer !== 'undefined') {
          const buf = Buffer.from('ok');
          expect(isBuffer(buf)).toBe(true);
        }

        // 假 Buffer（无 isBuffer 方法）
        const fakeBuf = {constructor: {}};
        expect(isBuffer(fakeBuf)).toBe(false);

        // 无原型的对象
        const noProto = Object.create(null);
        expect(isBuffer(noProto)).toBe(false);

        // 访问 constructor 抛出异常的对象
        const evilObj = {};
        Object.defineProperty(evilObj, 'constructor', {
          get: () => {
            throw new Error('模拟错误');
          },
        });
        expect(isBuffer(evilObj)).toBe(false);
      });
    });

    describe('Blob and File checking', () => {
      it('should correctly identify Blob and File objects in browser', () => {
        expect(typeof isBlob).toBe('function');
        expect(typeof isFile).toBe('function');
        expect(isBlob({})).toBe(false);
        expect(isFile({})).toBe(false);

        if (typeof Blob !== 'undefined') {
          expect(isBlob(new Blob())).toBe(true);
        }
        if (typeof File !== 'undefined') {
          expect(isFile(new File([], 'test.txt'))).toBe(true);
        }
      });
    });
  });

  // ================= 迭代器和Promise检查测试 =================
  describe('Iterator and Promise Checking Tests', () => {
    describe('Iterable checking', () => {
      it('should correctly identify iterable objects', () => {
        expect(isIterable([])).toBe(true);
        expect(isIterable('string')).toBe(true);
        expect(isIterable(new Map())).toBe(true);
        expect(isIterable(new Set())).toBe(true);
        expect(isIterable({})).toBe(false);
        expect(isIterable(123)).toBe(false);
        expect(isIterable(null)).toBe(false);
        const customIterable = {
          *[Symbol.iterator]() {
            yield 1;
            yield 2;
          },
        };
        expect(isIterable(customIterable)).toBe(true);
      });

      it('should correctly identify async iterable objects', () => {
        const asyncIterable = {
          // eslint-disable-next-line @typescript-eslint/require-await
          [Symbol.asyncIterator]: async function* () {
            yield 1;
          },
        };
        expect(isAsyncIterable(asyncIterable)).toBe(true);
        expect(isAsyncIterable([])).toBe(false);
        expect(isAsyncIterable({})).toBe(false);
      });
    });

    describe('Promise checking', () => {
      it('should correctly identify Promise objects', () => {
        expect(isPromise(Promise.resolve())).toBe(true);
        expect(isPromise(new Promise(() => {}))).toBe(true);
        expect(isPromise({then: () => {}})).toBe(true); // thenable
        expect(isPromise({})).toBe(false);
        expect(isPromise(() => {})).toBe(false);
        class CustomPromise extends Promise<unknown> {}
        expect(isPromise(new CustomPromise(() => {}))).toBe(true);
      });
    });
  });

  // ================= 实例检查测试 =================
  describe('Instance Checking Tests', () => {
    it('should correctly check instance of constructor', () => {
      class Animal {}
      class Dog extends Animal {}
      const animal = new Animal();
      const dog = new Dog();
      expect(isInstanceOf(animal, Animal)).toBe(true);
      expect(isInstanceOf(dog, Dog)).toBe(true);
      expect(isInstanceOf(dog, Animal)).toBe(true);
      expect(isInstanceOf({}, Animal)).toBe(false);
      expect(isInstanceOf(null, Animal)).toBe(false);
      expect(isInstanceOf(undefined, Animal)).toBe(false);
      expect(isInstanceOf([], Array)).toBe(true);
      expect(isInstanceOf(new Date(), Date)).toBe(true);
      expect(isInstanceOf(/test/, RegExp)).toBe(true);
    });
  });

  // ================= 属性键检查测试 =================
  describe('Property Key Checking Tests', () => {
    it('should correctly identify valid property keys', () => {
      expect(isPropertyKey('name')).toBe(true);
      expect(isPropertyKey(123)).toBe(true);
      expect(isPropertyKey(Symbol('key'))).toBe(true);
      expect(isPropertyKey({})).toBe(false);
      expect(isPropertyKey([])).toBe(false);
      expect(isPropertyKey(null)).toBe(false);
      expect(isPropertyKey(undefined)).toBe(false);
    });
  });

  // ================= 空值检查测试 =================
  describe('Empty Value Checking Tests', () => {
    describe('General emptiness checking', () => {
      it('should correctly identify empty values', () => {
        expect(isEmpty(null)).toBe(true);
        expect(isEmpty(undefined)).toBe(true);
        expect(isEmpty('')).toBe(true);
        expect(isEmpty([])).toBe(true);
        expect(isEmpty({})).toBe(true);
        expect(isEmpty(new Map())).toBe(true);
        expect(isEmpty(new Set())).toBe(true);
        expect(isEmpty('a')).toBe(false);
        expect(isEmpty([1])).toBe(false);
        expect(isEmpty({a: 1})).toBe(false);
        expect(isEmpty(new Map([['key', 'value']]))).toBe(false);
        expect(isEmpty(new Set([1]))).toBe(false);
        expect(isEmpty(0)).toBe(false);
        expect(isEmpty(false)).toBe(false);
      });
    });

    describe('Empty object checking', () => {
      it('should correctly identify empty plain objects', () => {
        expect(isEmptyObject({})).toBe(true);
        expect(isEmptyObject({a: 1})).toBe(false);
        expect(isEmptyObject([])).toBe(false);
        expect(isEmptyObject(null)).toBe(false);
        expect(isEmptyObject(undefined)).toBe(false);
        expect(isEmptyObject('')).toBe(false);
      });
    });
  });

  // ================= 序列化检查测试 =================
  describe('Serialization Checking Tests', () => {
    describe('Serializable checking', () => {
      it('should correctly identify serializable values', () => {
        expect(isSerializable(null)).toBe(true);
        expect(isSerializable('string')).toBe(true);
        expect(isSerializable(123)).toBe(true);
        expect(isSerializable(true)).toBe(true);
        expect(isSerializable([])).toBe(true);
        expect(isSerializable([1, 'a', true])).toBe(true);
        expect(isSerializable({})).toBe(true);
        expect(isSerializable({a: 1, b: 'test'})).toBe(true);
        expect(isSerializable({a: {b: [1, 2]}})).toBe(true);
        expect(isSerializable(() => {})).toBe(false);
        expect(isSerializable(new Date())).toBe(false);
        expect(isSerializable(/regex/)).toBe(false);
        expect(isSerializable(new Map())).toBe(false);
        expect(isSerializable(Symbol())).toBe(false);
        expect(isSerializable(undefined)).toBe(false);
      });
    });

    describe('JSON value checking', () => {
      it('should correctly identify JSON-compatible values', () => {
        expect(isJSONValue(null)).toBe(true);
        expect(isJSONValue('string')).toBe(true);
        expect(isJSONValue(123)).toBe(true);
        expect(isJSONValue(true)).toBe(true);
        expect(isJSONValue(false)).toBe(true);
        expect(isJSONValue([])).toBe(true);
        expect(isJSONValue({})).toBe(true);
        expect(isJSONValue(undefined)).toBe(false);
        expect(isJSONValue(() => {})).toBe(false);
        expect(isJSONValue(Symbol())).toBe(false);
      });

      it('should correctly identify JSON objects', () => {
        expect(isJSONObject({})).toBe(true);
        expect(isJSONObject({a: 1, b: 'test'})).toBe(true);
        expect(isJSONObject({a: {b: 2}})).toBe(true);
        expect(isJSONObject({a: undefined})).toBe(false);
        expect(isJSONObject({a: () => {}})).toBe(false);
        expect(isJSONObject(null)).toBe(false);
        expect(isJSONObject([])).toBe(false);
      });

      it('should correctly identify JSON arrays', () => {
        expect(isJSONArray([])).toBe(true);
        expect(isJSONArray([1, 'a', true])).toBe(true);
        expect(isJSONArray([{a: 1}, [2, 3]])).toBe(true);
        expect(isJSONArray([undefined])).toBe(false);
        expect(isJSONArray([() => {}])).toBe(false);
        expect(isJSONArray({})).toBe(false);
        expect(isJSONArray('array')).toBe(false);
      });
    });

    describe('JSON string checking', () => {
      it('should correctly identify JSON strings', () => {
        expect(isJSON('null')).toBe(true);
        expect(isJSON('true')).toBe(true);
        expect(isJSON('false')).toBe(true);
        expect(isJSON('123')).toBe(true);
        expect(isJSON('"string"')).toBe(true);
        expect(isJSON('{}')).toBe(true);
        expect(isJSON('{"a":1}')).toBe(true);
        expect(isJSON('[]')).toBe(true);
        expect(isJSON('[1,2,3]')).toBe(true);
        expect(isJSON('  {"a": 1}  ')).toBe(true);
        expect(isJSON(114514)).toBe(false);
        expect(isJSON('')).toBe(false);
        expect(isJSON('undefined')).toBe(false);
        expect(isJSON('{a:1}')).toBe(false);
        expect(isJSON('[1,2,3')).toBe(false);
        expect(isJSON('test')).toBe(false);
      });
    });
  });

  // ================= 格式验证测试 =================
  describe('Format Validation Tests', () => {
    describe('Email validation', () => {
      it('should correctly validate email addresses', () => {
        expect(isEmail('test@example.com')).toBe(true);
        expect(isEmail('user.name@domain.co.uk')).toBe(true);
        expect(isEmail('a@b.c')).toBe(true);
        expect(isEmail('notanemail')).toBe(false);
        expect(isEmail('test@')).toBe(false);
        expect(isEmail('@example.com')).toBe(false);
        expect(isEmail('test@example')).toBe(false);
        expect(isEmail('test@example.')).toBe(false);
        expect(isEmail(123)).toBe(false);
        expect(isEmail(null)).toBe(false);
      });
    });

    describe('URL validation', () => {
      it('should correctly validate URLs', () => {
        expect(isUrl('https://example.com')).toBe(true);
        expect(isUrl('http://localhost:3000')).toBe(true);
        expect(isUrl('ftp://ftp.example.com')).toBe(true);
        expect(isUrl('file:///path/to/file')).toBe(true);
        expect(isUrl('not a url')).toBe(false);
        expect(isUrl('example.com')).toBe(false);
        expect(isUrl('http://')).toBe(false);
        expect(isUrl(123)).toBe(false);
        expect(isUrl(null)).toBe(false);
      });
    });

    describe('UUID validation', () => {
      it('should correctly validate UUIDs', () => {
        expect(isUUID('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
        expect(isUUID('00000000-0000-0000-0000-000000000000')).toBe(true);
        expect(isUUID('A987FBC9-4BED-3078-CF07-9141BA07C9F3')).toBe(true);
        expect(isUUID('not-a-uuid')).toBe(false);
        expect(isUUID('123e4567-e89b-12d3-a456-42661417400')).toBe(false);
        expect(isUUID('123e4567-e89b-12d3-a456-4266141740000')).toBe(false);
        expect(isUUID('g123e4567-e89b-12d3-a456-426614174000')).toBe(false);
        expect(isUUID(123)).toBe(false);
        expect(isUUID(null)).toBe(false);
      });
    });
  });

  // ================= 深度相等检查测试 =================
  describe('Deep Equality Checking Tests', () => {
    it('should correctly compare primitive values and handle different types', () => {
      // 原始值
      expect(isEqual(1, 1)).toBe(true);
      expect(isEqual('a', 'a')).toBe(true);
      expect(isEqual(true, true)).toBe(true);
      expect(isEqual(null, null)).toBe(true);
      expect(isEqual(undefined, undefined)).toBe(true);
      expect(isEqual(NaN, NaN)).toBe(true);
      expect(isEqual(1, 2)).toBe(false);
      expect(isEqual('a', 'b')).toBe(false);
      expect(isEqual(true, false)).toBe(false);
      expect(isEqual(null, undefined)).toBe(false);

      // 对象引用
      const obj = {a: 1};
      expect(isEqual(obj, obj)).toBe(true);
      expect(isEqual({a: 1}, {a: 1})).toBe(true);
      expect(isEqual({a: 1}, {a: 2})).toBe(false);

      // 不同标签
      expect(isEqual({}, [])).toBe(false);
      expect(isEqual({}, new Date())).toBe(false);
      expect(isEqual([], /test/)).toBe(false);
    });

    it('should correctly compare arrays and objects', () => {
      // 数组
      expect(isEqual([1, 2, 3], [1, 2, 3])).toBe(true);
      expect(isEqual([], [])).toBe(true);
      expect(isEqual([1, 2], [1, 2, 3])).toBe(false);
      expect(isEqual([1, 2], [2, 1])).toBe(false);
      expect(
        isEqual(
          [
            [1, 2],
            [3, 4],
          ],
          [
            [1, 2],
            [3, 4],
          ],
        ),
      ).toBe(true);
      expect(isEqual([[1, 2]], [[1, 2, 3]])).toBe(false);

      // 对象
      expect(isEqual({a: 1, b: 2}, {a: 1, b: 2})).toBe(true);
      expect(isEqual({a: 1, b: 2}, {b: 2, a: 1})).toBe(true);
      expect(isEqual({a: 1}, {a: 2})).toBe(false);
      expect(isEqual({a: 1}, {b: 1})).toBe(false);
      expect(isEqual({a: 1}, {a: 1, b: 2})).toBe(false);
      expect(isEqual({a: {b: 1}}, {a: {b: 1}})).toBe(true);
      expect(isEqual({a: {b: 1}}, {a: {b: 2}})).toBe(false);

      // 类实例 vs 普通对象
      class MyClass {
        constructor(public a: number) {}
      }
      expect(isEqual(new MyClass(1), {a: 1})).toBe(false);
      expect(isEqual(new MyClass(1), new MyClass(1))).toBe(false);
    });

    it('should correctly compare ArrayBuffer, Date, RegExp, Map, Set', () => {
      // ArrayBuffer
      const buffer1 = new ArrayBuffer(8);
      new Uint8Array(buffer1).set([10, 20]);
      const buffer2 = new ArrayBuffer(8);
      new Uint8Array(buffer2).set([10, 20]);
      expect(isEqual(buffer1, buffer2)).toBe(true);
      new Uint8Array(buffer2)[1] = 99;
      expect(isEqual(buffer1, buffer2)).toBe(false);
      const buffer3 = new ArrayBuffer(4);
      expect(isEqual(buffer1, buffer3)).toBe(false);

      // Date
      const date1 = new Date('2024-01-01');
      const date2 = new Date('2024-01-01');
      const date3 = new Date('2024-01-02');
      expect(isEqual(date1, date2)).toBe(true);
      expect(isEqual(date1, date3)).toBe(false);

      // RegExp
      const regex1 = /test/gi;
      const regex2 = /test/gi;
      const regex3 = /test/g;
      expect(isEqual(regex1, regex2)).toBe(true);
      expect(isEqual(regex1, regex3)).toBe(false);

      // Map
      const map1 = new Map([
        ['a', 1],
        ['b', 2],
      ]);
      const map2 = new Map([
        ['a', 1],
        ['b', 2],
      ]);
      const map3 = new Map([['a', 1]]);
      expect(isEqual(map1, map2)).toBe(true);
      expect(isEqual(map1, map3)).toBe(false);

      // Map 内容不同
      const map4 = new Map([
        ['a', 1],
        ['c', 2],
      ]);
      expect(isEqual(map1, map4)).toBe(false);
      const map5 = new Map([
        ['a', 1],
        ['b', 99],
      ]);
      expect(isEqual(map1, map5)).toBe(false);

      // Set
      const set1 = new Set([1, 2, 3]);
      const set2 = new Set([1, 2, 3]);
      const set3 = new Set([1, 2]);
      expect(isEqual(set1, set2)).toBe(true);
      expect(isEqual(set1, set3)).toBe(false);

      // Set 内容不同
      const set4 = new Set([1, 2, 4]);
      expect(isEqual(set1, set4)).toBe(false);
      const set5 = new Set([{id: 1}]);
      const set6 = new Set([{id: 2}]);
      expect(isEqual(set5, set6)).toBe(false);
    });

    it('should handle circular and shared references correctly', () => {
      // 自引用
      const obj: any = {a: 1};
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      obj.self = obj;
      const obj2: any = {a: 1};
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      obj2.self = obj2;
      expect(isEqual(obj, obj2)).toBe(true);

      // 交叉引用
      const a: any = {value: 1};
      const b: any = {value: 2};
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      a.ref = b;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      b.ref = a;
      const a2: any = {value: 1};
      const b2: any = {value: 2};
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      a2.ref = b2;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      b2.ref = a2;
      expect(isEqual(a, a2)).toBe(true);

      // 共享引用
      const shared = {value: 1};
      const left = {a: shared, b: shared};
      const right = {a: {value: 1}, b: {value: 1}};
      expect(isEqual(left, right)).toBe(true);
    });

    it('should support custom comparison logic via isEqualWith', () => {
      // 部分自定义
      const partialCustomizer = (v1: unknown, v2: unknown) => {
        if (v1 === '喵喵' && v2 === '汪汪') return true;
        return undefined;
      };
      const complexObj1 = {a: [1, 2], b: '喵喵'};
      const complexObj2 = {a: [1, 2], b: '汪汪'};
      expect(isEqualWith(complexObj1, complexObj2, partialCustomizer)).toBe(
        true,
      );

      // 完全自定义：忽略 id，比较 value，数字允许误差
      const customizer = (value1: unknown, value2: unknown) => {
        if (
          typeof value1 === 'object' &&
          value1 !== null &&
          'id' in value1 &&
          typeof value2 === 'object' &&
          value2 !== null &&
          'id' in value2
        ) {
          const v1 = value1 as {value?: unknown};
          const v2 = value2 as {value?: unknown};
          return isEqual(v1.value, v2.value);
        }
        if (typeof value1 === 'number' && typeof value2 === 'number') {
          return Math.abs(value1 - value2) < 0.01;
        }
        return undefined;
      };
      const obj1 = {id: 1, value: 100};
      const obj2 = {id: 2, value: 100};
      const obj3 = {id: 1, value: 101};
      expect(isEqualWith(obj1, obj2, customizer)).toBe(true);
      expect(isEqualWith(obj1, obj3, customizer)).toBe(false);
      expect(isEqualWith(1.0, 1.005, customizer)).toBe(true);
      expect(isEqualWith(1.0, 1.02, customizer)).toBe(false);

      // 自定义返回显式布尔值
      const alwaysTrue = () => true;
      expect(isEqualWith({a: 1}, {b: 2}, alwaysTrue)).toBe(true);
      const alwaysFalse = () => false;
      expect(isEqualWith({a: 1}, {a: 1}, alwaysFalse)).toBe(false);
      const specific = (val1: unknown, val2: unknown) => {
        if (typeof val1 === 'number' && typeof val2 === 'number') return false;
        return undefined;
      };
      expect(isEqualWith(1, 1, specific)).toBe(false);
    });
  });
});
