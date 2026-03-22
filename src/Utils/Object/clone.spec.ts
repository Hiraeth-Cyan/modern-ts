// ========================================
// ./src/Utils/Object/clone.spec.ts
// ========================================

import {
  clone,
  cloneDeep,
  cloneDeepWith,
  CLONE_FILTER,
  CLONE_DEFAULT,
  CLONE_HOLE,
  type CloneCustomizer,
  isArrayIndex,
} from './clone';

import {describe, it, expect, vi} from 'vitest';

// ============================
// 测试克隆
// ============================
describe.concurrent('Utils/Object/clone', () => {
  describe('Shallow Clone (clone)', () => {
    it('should return the same value for primitives', () => {
      const num = 42;
      const str = 'hello';
      const bool = true;
      const nul = null;
      const und = undefined;

      expect(clone(num)).toBe(num);
      expect(clone(str)).toBe(str);
      expect(clone(bool)).toBe(bool);
      expect(clone(nul)).toBe(nul);
      expect(clone(und)).toBe(und);
    });

    it('should create a new shallow copy of an Array', () => {
      const arr = [1, 2, 3];
      const clonedArr = clone(arr);

      expect(clonedArr).toEqual(arr);
      expect(clonedArr).not.toBe(arr); // 引用不同
    });

    it('should create a new shallow copy of a plain Object', () => {
      const obj = {a: 1, b: 2};
      const clonedObj = clone(obj);

      expect(clonedObj).toEqual(obj);
      expect(clonedObj).not.toBe(obj); // 引用不同
    });

    it('should not deep clone nested properties (Shallow behavior)', () => {
      const nested = {data: {value: 100}};
      const cloned = clone(nested);

      // 第一层引用不同
      expect(cloned).not.toBe(nested);
      // 嵌套对象引用相同（浅拷贝）
      expect(cloned.data).toBe(nested.data);
    });

    it('should clone Date objects', () => {
      const date = new Date('2025-05-20T12:00:00Z');
      const cloned = clone(date);

      expect(cloned).toBeInstanceOf(Date);
      expect(cloned.getTime()).toBe(date.getTime());
      expect(cloned).not.toBe(date);
    });

    it('should clone RegExp objects', () => {
      const regex = /test/gi;
      const cloned = clone(regex);

      expect(cloned).toBeInstanceOf(RegExp);
      expect(cloned.source).toBe(regex.source);
      expect(cloned.flags).toBe(regex.flags);
      expect(cloned).not.toBe(regex);
    });
  });

  // ============================
  // 测试深克隆
  // ============================
  describe('Deep Clone (cloneDeep)', () => {
    it('should deep clone plain objects', () => {
      const original = {a: 1, b: {c: 2}};
      const copied = cloneDeep(original);

      expect(copied).toEqual(original);
      expect(copied).not.toBe(original);
      expect(copied.b).not.toBe(original.b);
    });

    it('should deep clone arrays', () => {
      const original = [1, [2, [3]]];
      const copied = cloneDeep(original);

      expect(copied).toEqual(original);
      expect(copied).not.toBe(original);
      expect(copied[1]).not.toBe(original[1]);
      expect((copied[1] as number[])[1]).not.toBe((original[1] as number[])[1]);
    });

    it('should handle circular references correctly', () => {
      const node: {value: number; next?: unknown} = {value: 1};
      node.next = node; // 创建循环引用

      const cloned = cloneDeep(node);

      expect(cloned).not.toBe(node);
      expect(cloned.value).toBe(1);
      // 验证循环引用也被正确克隆，指向新的自身
      expect(cloned.next).toBe(cloned);
    });

    it('should clone Date objects', () => {
      const date = new Date('2025-05-20T12:00:00Z');
      const cloned = cloneDeep(date);

      expect(cloned).toBeInstanceOf(Date);
      expect(cloned.getTime()).toBe(date.getTime());
      expect(cloned).not.toBe(date);
    });

    it('should clone RegExp objects', () => {
      const regex = /test/gi;
      regex.lastIndex = 5; // 验证状态复制
      const cloned = cloneDeep(regex);

      expect(cloned).toBeInstanceOf(RegExp);
      expect(cloned.source).toBe(regex.source);
      expect(cloned.flags).toBe(regex.flags);
      expect(cloned.lastIndex).toBe(regex.lastIndex);
    });

    it('should clone Error objects', () => {
      const error = new Error('Something went wrong');
      const cloned = cloneDeep(error);

      expect(cloned).toBeInstanceOf(Error);
      expect(cloned.message).toBe(error.message);
      expect(cloned.name).toBe(error.name);
      expect(cloned).not.toBe(error);
    });

    it('should clone Error objects with cause', () => {
      const cause = new Error('Root cause');
      const error = new Error('Surface error');
      error.cause = cause;

      const cloned = cloneDeep(error);

      expect(cloned).toBeInstanceOf(Error);
      expect(cloned.message).toBe('Surface error');

      // 深度克隆后引用应该不同，但内容应该相等
      expect(cloned.cause).not.toBe(cause); // 确认是新对象
      expect(cloned.cause).toBeInstanceOf(Error);
      expect((cloned.cause as Error).message).toBe('Root cause');
    });

    it('should clone Error objects without stack property', () => {
      const error = new Error('No stack error');
      delete error.stack;

      const cloned = cloneDeep(error);

      expect(cloned).toBeInstanceOf(Error);
      expect(cloned.message).toBe('No stack error');
      expect(cloned.name).toBe('Error');
      expect(cloned).not.toBe(error);
      expect('stack' in cloned).toBe(false);
    });

    it('should clone Map objects (deep clone keys and values)', () => {
      const key = {id: 1};
      const map = new Map<string | {id: number}, string | number>([
        [key, 'value1'], // Key 是对象，Value 是字符串
        ['key2', 100], // Key 是字符串，Value 是数字
      ]);
      const cloned = cloneDeep(map);

      expect(cloned).toBeInstanceOf(Map);
      expect(cloned).not.toBe(map);

      // 验证 Key 和 Value 都被深拷贝
      const clonedKey = Array.from(cloned.keys())[0] as typeof key;

      expect(clonedKey).not.toBe(key); // Key 是对象，被深拷贝了
      expect(clonedKey.id).toBe(1);
      expect(cloned.get(clonedKey)).toBe('value1');
      expect(cloned.get('key2')).toBe(100);
    });

    it('should deeply clone complex objects used as Map keys', () => {
      const complexKey = [{id: 'map-key'}];
      const map = new Map([[complexKey, 'value']]);

      const cloned = cloneDeep(map);
      const clonedKey = Array.from(cloned.keys())[0];

      expect(clonedKey).not.toBe(complexKey);
      expect(clonedKey[0]).not.toBe(complexKey[0]);
      expect(clonedKey[0].id).toBe('map-key');
    });

    it('should clone Set objects (deep clone items)', () => {
      const item = {val: 10};
      const set = new Set([item, 'string']);
      const cloned = cloneDeep(set);

      expect(cloned).toBeInstanceOf(Set);
      expect(cloned).not.toBe(set);

      // Set 内容是深拷贝的
      const clonedItem = Array.from(cloned).find(
        (x) => typeof x === 'object',
      ) as typeof item;
      expect(clonedItem).not.toBe(item);
      expect(clonedItem.val).toBe(10);
      expect(cloned.has('string')).toBe(true);
    });

    it('should clone WeakMap and WeakSet (instances only)', () => {
      const wm = new WeakMap();
      const ws = new WeakSet();

      // WeakMap/WeakSet 无法枚举，无法复制内容，只能得到新实例
      const clonedWM = cloneDeep(wm);
      const clonedWS = cloneDeep(ws);

      expect(clonedWM).toBeInstanceOf(WeakMap);
      expect(clonedWM).not.toBe(wm);
      expect(clonedWS).toBeInstanceOf(WeakSet);
      expect(clonedWS).not.toBe(ws);
    });

    it('should clone TypedArrays', () => {
      const arr = new Int8Array([1, 2, 3]);
      const cloned = cloneDeep(arr);

      expect(cloned).toBeInstanceOf(Int8Array);
      expect(cloned).not.toBe(arr);
      expect(cloned).toEqual(arr);
    });

    it('should clone TypedArray with offset and limited length correctly', () => {
      const buffer = new ArrayBuffer(16);
      const view = new Int32Array(buffer, 4, 2); // 从字节4开始，取2个元素
      view[0] = 100;
      view[1] = 200;

      const cloned = cloneDeep(view);

      expect(cloned.length).toBe(2);
      expect(cloned[0]).toBe(100);
      expect(cloned.byteOffset).toBe(4);
      expect(cloned.buffer).not.toBe(buffer); // 必须是新的 Buffer！
      expect(cloned.buffer.byteLength).toBe(16); // 保持原 Buffer 大小
    });

    it('should clone ArrayBuffer', () => {
      const buffer = new ArrayBuffer(8);
      const view = new Uint8Array(buffer);
      view[0] = 255;

      const cloned = cloneDeep(buffer);

      expect(cloned).not.toBe(buffer);
      expect(cloned.byteLength).toBe(buffer.byteLength);
      const clonedView = new Uint8Array(cloned);
      expect(clonedView[0]).toBe(255);
    });

    it('should clone DataView objects with correct offset, length, and underlying buffer', () => {
      const bufferSize = 32;
      const originalBuffer = new ArrayBuffer(bufferSize);

      const byteOffset = 4;
      const byteLength = 8;
      const originalView = new DataView(originalBuffer, byteOffset, byteLength);

      originalView.setUint8(0, 255);
      originalView.setFloat32(4, 3.14);

      const clonedView = cloneDeep(originalView);

      expect(clonedView).toBeInstanceOf(DataView);
      expect(clonedView).not.toBe(originalView);

      expect(clonedView.buffer).not.toBe(originalBuffer);
      expect(clonedView.buffer.byteLength).toBe(bufferSize);

      expect(clonedView.byteOffset).toBe(byteOffset);
      expect(clonedView.byteLength).toBe(byteLength);

      expect(clonedView.getUint8(0)).toBe(255);
      expect(clonedView.getFloat32(4)).toBeCloseTo(3.14);
      const originalUint8 = new Uint8Array(originalBuffer);
      const clonedUint8 = new Uint8Array(clonedView.buffer);

      expect(clonedUint8).toEqual(originalUint8);
    });

    it('should clone Symbol properties', () => {
      const sym = Symbol('desc');
      const obj = {[sym]: 'symbol value', normal: 'normal value'};
      const cloned = cloneDeep(obj);

      expect(cloned[sym]).toBe('symbol value');
      expect(cloned.normal).toBe('normal value');
      expect(cloned).not.toBe(obj);
    });
  });

  // ============================
  // 测试自定义定制器 (cloneDeepWith)
  // ============================
  describe('Customizer (cloneDeepWith)', () => {
    it('should fallback to default cloning when customizer returns CLONE_DEFAULT', () => {
      const obj = {a: {b: 1}};
      const customizer = vi.fn((val) => {
        if (typeof val === 'number') return CLONE_DEFAULT;
        return CLONE_DEFAULT;
      });

      const cloned = cloneDeepWith(obj, customizer);
      expect(cloned).toEqual(obj);
      expect(cloned.a).not.toBe(obj.a); // 依然执行了深克隆
      expect(customizer).toHaveBeenCalled();
    });
    it('should allow customizing values via customizer', () => {
      const obj = {a: 1, b: 'custom'};
      const customizer: CloneCustomizer = (val) => {
        if (val === 'custom') return 'replaced';
        return CLONE_DEFAULT;
      };

      const cloned = cloneDeepWith(obj, customizer);
      expect(cloned.a).toBe(1);
      expect(cloned.b).toBe('replaced');
    });

    it('should pass context (key, object, stack) to customizer', () => {
      const obj = {nested: {value: 10}};
      const spyCustomizer = vi.fn<CloneCustomizer>((_val, key) => {
        if (key === 'value') return 999;
        return CLONE_DEFAULT;
      });

      cloneDeepWith(obj, spyCustomizer);

      expect(spyCustomizer).toHaveBeenCalled();
      // 验证参数传递
      const calls = spyCustomizer.mock.calls;
      const callForValue = calls.find((c) => c[1] === 'value');
      expect(callForValue).toBeDefined();
      expect(callForValue![0]).toBe(10); // value
      expect(callForValue![1]).toBe('value'); // key
    });

    // --- CLONE_FILTER 逻辑测试 ---
    describe('CLONE_FILTER behavior', () => {
      describe('Objects', () => {
        it('should skip assigning the property if value is CLONE_FILTER (String key)', () => {
          const obj = {a: 1, b: 'skip_prop', c: 3};
          const customizer: CloneCustomizer = (val) => {
            if (val === 'skip_prop') return CLONE_FILTER;
            return CLONE_DEFAULT;
          };

          const cloned = cloneDeepWith(obj, customizer);
          expect(cloned.a).toBe(1);
          expect('b' in cloned).toBe(false);
          expect(cloned.c).toBe(3);
        });

        it('should skip assigning the property if value is CLONE_FILTER (Symbol key)', () => {
          const sym = Symbol('secret');
          const obj = {normal: 'data', [sym]: 'skip_sym'};
          const customizer: CloneCustomizer = (val) => {
            if (val === 'skip_sym') return CLONE_FILTER;
            return CLONE_DEFAULT;
          };

          const cloned = cloneDeepWith(obj, customizer);
          expect(cloned.normal).toBe('data');
          const symbols = Object.getOwnPropertySymbols(cloned);
          expect(symbols.length).toBe(0);
        });

        it('should set properties to undefined if customizer returns undefined explicitly', () => {
          const obj = {a: 1, b: 2};
          const customizer: CloneCustomizer = (_val, key) => {
            if (key === 'b') return undefined;
            return CLONE_DEFAULT;
          };

          const cloned = cloneDeepWith(obj, customizer);
          expect(cloned.a).toBe(1);
          expect(cloned.b).toBe(undefined);
          expect('b' in cloned).toBe(true); // 键存在，值为 undefined
        });
      });

      describe('Arrays', () => {
        it('should filter out element when customizer returns CLONE_FILTER', () => {
          const arr = [10, 'skip_item', 30];
          const customizer: CloneCustomizer = (val) => {
            if (val === 'skip_item') return CLONE_FILTER;
            return CLONE_DEFAULT;
          };

          const cloned = cloneDeepWith(arr, customizer);

          // 既然是过滤，长度应该从 3 变成 2 喵！
          expect(cloned.length).toBe(2);
          expect(cloned[0]).toBe(10);
          expect(cloned[1]).toBe(30); // 30 往前挪了一位
        });

        it('should create array holes (CLONE_HOLE) when customizer returns CLONE_HOLE', () => {
          const arr = [1, 'empty_me', 3];
          const customizer: CloneCustomizer = (_val, key) => {
            if (key === 1) return CLONE_HOLE;
            return CLONE_DEFAULT;
          };

          const cloned = cloneDeepWith(arr, customizer);
          expect(cloned.length).toBe(3); // 长度依然是 3
          expect(cloned[0]).toBe(1);
          expect(1 in cloned).toBe(false); // 索引 1 变成了洞
          expect(cloned[2]).toBe(3);
        });
      });

      describe('Maps', () => {
        it('should skip the entry entirely if the customizer returns CLONE_FILTER for the key', () => {
          const map = new Map([
            ['keep', 1],
            ['skip_key', 2],
          ]);
          const customizer: CloneCustomizer = (_val, key) => {
            if (key === 'skip_key') return CLONE_FILTER;
            return CLONE_DEFAULT;
          };

          const cloned = cloneDeepWith(map, customizer);
          expect(cloned.size).toBe(1);
          expect(cloned.has('keep')).toBe(true);
          expect(cloned.has('skip_key')).toBe(false);
        });

        it('should skip the entry if the customizer returns CLONE_FILTER for the value', () => {
          const map = new Map<string, string | number>([
            ['a', 100],
            ['b', 'skip_val'],
          ]);
          const customizer: CloneCustomizer = (val) => {
            if (val === 'skip_val') return CLONE_FILTER;
            return CLONE_DEFAULT;
          };

          const cloned = cloneDeepWith(map, customizer);
          expect(cloned.size).toBe(1);
          expect(cloned.get('a')).toBe(100);
          expect(cloned.has('b')).toBe(false);
        });
      });

      describe('Sets', () => {
        it('should not add the value to the new Set if customizer returns CLONE_FILTER', () => {
          const set = new Set([1, 'skip_me', 3]);
          const customizer: CloneCustomizer = (val) => {
            if (val === 'skip_me') return CLONE_FILTER;
            return CLONE_DEFAULT;
          };

          const cloned = cloneDeepWith(set, customizer);
          expect(cloned.size).toBe(2);
          expect(cloned.has(1)).toBe(true);
          expect(cloned.has('skip_me')).toBe(false);
          expect(cloned.has(3)).toBe(true);
        });
      });
    });
  });

  // ============================
  // 测试深度限制
  // ============================
  describe('Depth Limit', () => {
    it('should stop cloning at depth 0', () => {
      const obj = {l1: {l2: {l3: 'deep'}}};
      const result = cloneDeep(obj, 0);
      expect(result).toBe(obj);
    });

    it('should clone only 1 level deep when depth is 1', () => {
      const original = {l1: {l2: 'deep'}};
      const cloned = cloneDeep(original, 1);

      expect(cloned).not.toBe(original); // 第一层复制
      expect(cloned.l1).toBe(original.l1); // 第二层未复制，引用相同
    });

    it('should handle depth correctly with nested structures', () => {
      const original = {a: {b: {c: 'value'}}};
      const cloned = cloneDeep(original, 2);

      expect(cloned).not.toBe(original);
      expect(cloned.a).not.toBe(original.a); // depth 1, cloned
      expect(cloned.a.b).toBe(original.a.b); // depth 2, reached limit, original ref
    });
  });

  // ============================
  // 边缘情况
  // ============================
  describe('Edge Cases', () => {
    it('should handle Promise objects (reference copy)', () => {
      const promise = Promise.resolve('data');
      const cloned = cloneDeep(promise);
      expect(cloned).toBe(promise);
    });

    it('should handle Functions (reference copy)', () => {
      const fn = () => 'result';
      const cloned = cloneDeep(fn);
      expect(cloned).toBe(fn);
    });

    it('should handle array holes (sparse arrays)', () => {
      // eslint-disable-next-line no-sparse-arrays
      const arr = [1, , 3]; // hole at index 1
      const cloned = cloneDeep(arr);

      expect(cloned[0]).toBe(1);
      expect(1 in cloned).toBe(false); // hole preserved
      expect(cloned[2]).toBe(3);
    });
    it('should handle extremely deep nested objects (50,000 levels) without stack overflow', () => {
      interface DeepNode {
        a?: DeepNode;
        end?: string;
      }

      const depth = 50000;
      const root: DeepNode = {};
      let current: DeepNode = root;

      for (let i = 0; i < depth; i++) {
        current.a = {};
        current = current.a;
      }
      current.end = 'nya~';

      // 执行克隆
      let cloned: DeepNode = {};

      expect(() => {
        cloned = cloneDeep<DeepNode>(root);
      }).not.toThrow();

      // 这里不能用vitest的断言expect(cloned).not.toBe(root);，它会栈溢出
      if (cloned === root) throw new Error('Root reference same!');

      // 遍历到最深处验证数据
      let check: DeepNode | undefined = cloned;
      for (let i = 0; i < depth; i++) {
        check = check?.a;
      }

      // 最后的检查：确保数据完整且是深拷贝
      expect(check).toBeDefined();

      expect(check!.end).toBe('nya~');
      expect(check).not.toBe(current);
    });
  });

  describe('Prototype & Constructor', () => {
    it('should preserve the prototype of a class instance', () => {
      class MyClass {
        constructor(public value: number) {}
        sayHi() {
          return `Hi ${this.value}`;
        }
      }

      const instance = new MyClass(42);
      const cloned = cloneDeep<MyClass>(instance);

      expect(cloned).toBeInstanceOf(MyClass);
      expect(cloned.sayHi()).toBe('Hi 42');
      expect(cloned).not.toBe(instance);
    });

    it('should handle Object.create(null) correctly', () => {
      const obj = Object.create(null) as Record<string, number>;
      obj.a = 1;

      const cloned = cloneDeep<Record<string, number>>(obj);

      expect(Object.getPrototypeOf(cloned)).toBeNull();
      expect(cloned.a).toBe(1); // 现在访问 .a 是安全的了喵！

      // 对于可能不存在的属性，使用类型守卫或断言
      const unknownCloned = cloned as unknown as Record<string, unknown>;
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(unknownCloned.toString).toBeUndefined();
    });

    it('should not clone properties from the prototype (only own properties)', () => {
      interface MyObj {
        mine: string;
        shared?: string;
      }
      const proto = {shared: 'gold'};
      const obj = Object.create(proto) as MyObj;
      obj.mine = 'silver';

      const cloned = cloneDeep<MyObj>(obj);

      expect(cloned.mine).toBe('silver');
      expect(cloned.shared).toBe('gold');

      expect(Object.prototype.hasOwnProperty.call(cloned, 'shared')).toBe(
        false,
      );
      expect(Object.prototype.hasOwnProperty.call(cloned, 'mine')).toBe(true);
    });
  });

  describe('Internal: isArrayIndex', () => {
    it('should return false for symbols (just in case)', () => {
      const sym = Symbol('index');
      const obj: Record<symbol, number> = {[sym]: 1};
      expect(cloneDeep(obj)).toEqual({[sym]: 1});
    });

    it('should return false for symbols (just in case)', () => {
      const sym = Symbol('index');
      expect(isArrayIndex(sym)).toBe(false);
    });

    it('should identify valid and invalid array indices without crashing', () => {
      const obj = [] as unknown as string[] & Record<string, string>;

      obj[10] = 'index_10'; // 合法索引
      obj['10'] = 'index_10_str'; // 也是合法索引，会覆盖上面那个
      obj['01'] = 'not_index'; // 带有前导零，不是合法索引（String(Number('01')) !== '01'）
      obj['2.5'] = 'not_index'; // 浮点数，不是合法索引

      const cloned = cloneDeep(obj);

      expect(cloned.length).toBe(11); // 索引到 10，长度应该是 11
      expect(cloned[10]).toBe('index_10_str');
      expect(cloned['01']).toBe('not_index');
      expect(cloned['2.5']).toBe('not_index');
    });
  });

  // ============================
  // 不可枚举属性测试
  // ============================
  describe('Non-Enumerable Properties', () => {
    it('should ignore non-enumerable string keys', () => {
      const source: {a?: number; b?: number} = {a: 1};
      Object.defineProperty(source, 'b', {
        value: 2,
        enumerable: false,
        writable: true,
        configurable: true,
      });

      const result = cloneDeep(source);
      expect(result.a).toBe(1);
      expect('b' in result).toBe(false);
      expect(result.b).toBeUndefined();
    });

    it('should ignore non-enumerable symbol keys', () => {
      const source: {a?: number} = {a: 1};
      const hiddenSym = Symbol('hidden');

      Object.defineProperty(source, hiddenSym, {
        value: 'secret',
        enumerable: false,
      });

      const result = cloneDeep(source);
      expect(result.a).toBe(1);
      const symbols = Object.getOwnPropertySymbols(result);
      expect(symbols.includes(hiddenSym)).toBe(false);
      expect(symbols.length).toBe(0);
    });

    it('should not call customizer for non-enumerable properties', () => {
      const source: {a?: number; b?: number} = {a: 1};
      Object.defineProperty(source, 'b', {
        value: 99,
        enumerable: false,
      });

      const customizerSpy: CloneCustomizer = vi.fn((val) => {
        if (val === 99) return 'INTERCEPTED';
        return CLONE_DEFAULT;
      });

      const result = cloneDeepWith(source, customizerSpy);
      expect(customizerSpy).not.toHaveBeenCalledWith(
        99,
        'b',
        source,
        expect.anything(),
      );
      expect('b' in result).toBe(false);
    });
  });
});
