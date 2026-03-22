// ========================================
// ./src/Utils/Functions/debounce.spec.ts
// ========================================

import {describe, it, expect, vi, afterAll, beforeAll} from 'vitest';
import {Debounced, SKIPPED} from './debounce';
import {ParameterError} from '../../Errors';
import {
  MockClock,
  withTimeline,
  restoreGlobals,
  hijackTimeGlobals,
} from '../../MockClock/__export__';

// @ts-expect-error - 访问私有静态属性
const original_getTime = Debounced.getTime;

// 因为getTime是IIFE💢，在导入时就绑定时间源了，这里手动处理下
beforeAll(() => {
  hijackTimeGlobals();
  // @ts-expect-error - 访问私有静态属性
  Debounced.getTime = Date.now;
});

afterAll(() => {
  restoreGlobals();
  // @ts-expect-error - 访问私有静态属性
  Debounced.getTime = original_getTime;
});

// ============================
// 参数验证测试
// 验证构造函数对各种无效参数的健壮性
// ============================
describe.concurrent('Parameter Validation Tests', () => {
  const mock_fn = vi.fn();

  describe('Parameter Value Validation', () => {
    // 测试无效的wait参数值
    it('should throw for invalid wait values', () => {
      // 负数
      expect(() => new Debounced(mock_fn, -1)).toThrow(ParameterError);
      // 无穷大
      expect(() => new Debounced(mock_fn, Infinity)).toThrow(ParameterError);
      // NaN
      expect(() => new Debounced(mock_fn, NaN)).toThrow(ParameterError);
    });

    // 测试无效的max_wait参数值
    it('should throw for invalid max_wait values', () => {
      // 0值
      expect(() => new Debounced(mock_fn, 100, true, true, 0)).toThrow(
        ParameterError,
      );
      // 负值
      expect(() => new Debounced(mock_fn, 100, true, true, -50)).toThrow(
        ParameterError,
      );
      // NaN
      expect(() => new Debounced(mock_fn, 100, true, true, NaN)).toThrow(
        ParameterError,
      );
    });

    // 测试leading和trailing同时为false的情况（无意义配置）
    it('should throw when both leading and trailing are false', () => {
      expect(() => new Debounced(mock_fn, 100, false, false)).toThrow(
        'Error: Both leading and trailing are false, which is meaningless.',
      );
    });
  });
});

// ============================
// 核心行为测试
// 测试防抖函数的核心功能和各种配置模式
// ============================
describe.concurrent('Core Behavior Tests', () => {
  describe('Different Configuration Modes', () => {
    // 测试leading=true, trailing=false模式
    it('should debounce with leading=true, trailing=false', () => {
      const clock = MockClock();
      withTimeline(clock, () => {
        const mock_fn = vi.fn();
        const debounced = new Debounced(mock_fn, 100, true, false);

        // 第一次调用立即执行
        debounced.call(null);
        expect(mock_fn).toHaveBeenCalledTimes(1);

        // 快速连续调用，只有第一次执行
        debounced.call(null);
        debounced.call(null);
        expect(mock_fn).toHaveBeenCalledTimes(1);

        // 等待超过等待时间后再次调用
        clock.tick(150);
        clock.runAll();
        debounced.call(null);
        expect(mock_fn).toHaveBeenCalledTimes(2);
      });
    });

    // 测试leading=false, trailing=true模式
    it('should debounce with leading=false, trailing=true', () => {
      const clock = MockClock();
      withTimeline(clock, () => {
        const mock_fn = vi.fn();
        const debounced = new Debounced(mock_fn, 100, false, true);

        // 第一次调用不立即执行
        debounced.call(null);
        expect(mock_fn).toHaveBeenCalledTimes(0);

        // 等待计时器触发
        clock.tick(100);
        clock.runAll();
        expect(mock_fn).toHaveBeenCalledTimes(1);

        // 快速连续调用，只执行最后一次
        debounced.call(null);
        debounced.call(null);
        clock.tick(100);
        clock.runAll();
        expect(mock_fn).toHaveBeenCalledTimes(2);
      });
    });

    // 测试leading=true, trailing=true模式
    it('should debounce with leading=true, trailing=true', () => {
      const clock = MockClock();
      withTimeline(clock, () => {
        const mock_fn = vi.fn();
        const debounced = new Debounced(mock_fn, 100, true, true);

        // 第一次调用立即执行
        debounced.call(null);
        expect(mock_fn).toHaveBeenCalledTimes(1);

        // 快速第二次调用，会设置trailing计时器
        debounced.call(null);
        expect(mock_fn).toHaveBeenCalledTimes(1);

        // 等待计时器触发，执行第二次调用
        clock.tick(100);
        clock.runAll();
        expect(mock_fn).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('maxWait Constraint', () => {
    // 测试maxWait约束的基本功能
    it('should respect maxWait constraint', () => {
      const clock = MockClock();
      withTimeline(clock, () => {
        const mock_fn = vi.fn();
        const debounced = new Debounced(mock_fn, 100, false, true, 200);

        // T=0: 第一次调用, 因为是后沿计时器开启
        debounced.call(null);

        // T=50: 还没到wait(100)
        clock.tick(50);
        debounced.call(null); // 计时器将被推迟
        expect(mock_fn).toHaveBeenCalledTimes(0);

        // T=100: 还没到wait(100-50 = 50)，继续推迟
        clock.tick(50);
        debounced.call(null);
        expect(mock_fn).toHaveBeenCalledTimes(0);

        // T=200: 此时距离第一次invoke时间(0)已接近maxWait(200)
        clock.tick(100);
        // 后沿应该触发
        expect(mock_fn).toHaveBeenCalledTimes(1);

        debounced.call(null); // 重新排队

        clock.tick(50);
        debounced.call(null);
        clock.tick(50);
        debounced.call(null);
        expect(mock_fn).toHaveBeenCalledTimes(1);
        clock.tick(100);
        expect(mock_fn).toHaveBeenCalledTimes(2);
      });
    });

    // 测试由于进程运行时间导致的延迟执行
    it('should not fire immediately on second call due to process uptime', () => {
      const clock = MockClock();
      withTimeline(clock, () => {
        const mock_fn = vi.fn<() => void>();
        clock.setSystemTime(10000); // 模拟时间偏移
        const debounced = new Debounced(mock_fn, 100, false, true, 200);

        const res1 = debounced.call(null);
        expect(res1).toBe(SKIPPED); // 应该是被跳过的

        clock.tick(50);
        const res2 = debounced.call(null);

        expect(mock_fn).toHaveBeenCalledTimes(0);
        expect(res2).toBe(SKIPPED);
        expect(debounced.pending).toBe(true); // 计时器应该还在运行
      });
    });

    // 测试wait和maxWait重合时的情况
    it('should trigger once when wait and maxWait coincide', () => {
      const clock = MockClock();
      withTimeline(clock, () => {
        const mock_fn = vi.fn();
        // wait=100, maxWait=100
        const debounced = new Debounced(mock_fn, 100, false, true, 100);

        debounced.call(null);
        clock.tick(100);

        expect(mock_fn).toHaveBeenCalledTimes(1);
        // 此时计时器应该已经清理，不应有残留的pending状态
        expect(debounced.pending).toBe(false);
      });
    });

    // 测试取消后重置maxWait计时器
    it('should reset maxWait timer after cancel', () => {
      const clock = MockClock();
      withTimeline(clock, () => {
        const mock_fn = vi.fn();
        const debounced = new Debounced(mock_fn, 100, false, true, 200);

        // --- 第一轮：通过连续调用逼近maxWait ---
        debounced.call(null);
        clock.tick(80);
        debounced.call(null); // T=80, wait重置，当前总耗时80
        clock.tick(80);
        debounced.call(null); // T=160, wait重置，当前总耗时160

        debounced.cancel(); // 此时cancel，maxWait的计时起点必须重置

        // --- 第二轮：重新开始 ---
        debounced.call(null);
        clock.tick(150);

        // 虽然160(旧) + 150(新) > 200，但因为之前cancel了
        // 这里mock_fn只会因为wait=100在100ms时触发1次
        expect(mock_fn).toHaveBeenCalledTimes(1);

        clock.tick(100);
        expect(mock_fn).toHaveBeenCalledTimes(1); // 不会因为旧的maxWait再次触发
      });
    });

    // 测试频繁调用时maxWait的行为
    it('should violate maxWait when leading=false and calls are frequent', () => {
      const clock = MockClock();
      withTimeline(clock, () => {
        const mock_fn = vi.fn();

        const debounced = new Debounced(mock_fn, 100, false, true, 200);
        for (let i = 0; i < 8; i++) {
          debounced.call(null);
          clock.tick(50);
        }

        // 此时T=400 wait还在运行，但maxWait(200)应该已经让它执行了2次
        expect(mock_fn).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Lifecycle Methods', () => {
    describe('flush() Method', () => {
      // 测试没有待处理执行时的flush行为
      it('should return SKIPPED when flushing with no pending execution', () => {
        const clock = MockClock();
        withTimeline(clock, () => {
          const mock_fn = vi.fn();
          const debounced = new Debounced<[], void>(mock_fn, 100, false, true);

          // 没有调用，直接flush
          const result = debounced.flush();
          expect(result).toBe(SKIPPED);
        });
      });

      // 测试flush分支逻辑（if分支）
      it('should handle flush branch logic (if branch)', () => {
        const clock = MockClock();
        withTimeline(clock, () => {
          const mock_fn = vi.fn();

          const debounced = new Debounced(mock_fn, 100, false, true);

          debounced.call(null); // 启动计时器
          expect(mock_fn).toHaveBeenCalledTimes(0);

          debounced.flush(); // 立即执行触发分支1
          expect(mock_fn).toHaveBeenCalledTimes(1);
        });
      });

      // 测试flush分支逻辑（else分支）
      it('should handle flush branch logic (else branch)', () => {
        const clock = MockClock();
        withTimeline(clock, () => {
          const mock_fn = vi.fn();
          const debounced = new Debounced(mock_fn, 100, true, true);

          debounced.call(null); // 启动与执行计时器
          expect(mock_fn).toHaveBeenCalledTimes(1);

          debounced.flush(); // 触发分支2（参数被前沿消耗掉了）, 只清除计时器
          expect(debounced.pending).toBe(false);
        });
      });
    });

    describe('cancel() Method', () => {
      // 测试取消待处理执行的基本功能
      it('should cancel pending execution', () => {
        const clock = MockClock();
        withTimeline(clock, () => {
          const mock_fn = vi.fn();
          const debounced = new Debounced(mock_fn, 100, false, true);

          debounced.call(null);
          expect(debounced.pending).toBe(true);

          debounced.cancel();
          expect(debounced.pending).toBe(false);

          // 等待时间过后不应该执行
          clock.tick(150);
          expect(mock_fn).toHaveBeenCalledTimes(0);
        });
      });

      // 测试多次快速调用后取消的行为
      it('should handle multiple rapid calls followed by cancel', () => {
        const clock = MockClock();
        withTimeline(clock, () => {
          const mock_fn = vi.fn();
          const debounced = new Debounced(mock_fn, 100, false, true);

          debounced.call(null);
          debounced.call(null);
          debounced.call(null);

          clock.tick(50);
          debounced.cancel();

          clock.tick(100);
          expect(mock_fn).not.toHaveBeenCalled();
        });
      });
    });

    describe('dispose() Method', () => {
      // 测试Symbol.dispose支持
      it('should support Symbol.dispose directly', () => {
        const clock = MockClock();
        withTimeline(clock, () => {
          const mock_fn = vi.fn();
          const instance = new Debounced(mock_fn, 100);

          // 显式调用Symbol方法
          instance[Symbol.dispose]();
          expect(instance.pending).toBe(false);
          expect(instance['fn']).toBe(null);
        });
      });
    });
  });

  describe('Edge Cases', () => {
    // 验证上下文绑定
    it('should maintain correct this context', () => {
      const clock = MockClock();
      withTimeline(clock, () => {
        const context = {name: 'Boom'};
        let captured_context: unknown;
        const debounced = new Debounced(function (this: unknown) {
          // eslint-disable-next-line @typescript-eslint/no-this-alias
          captured_context = this;
        }, 100);

        debounced.call(context);
        clock.tick(100);
        expect(captured_context).toBe(context);
      });
    });

    // 验证参数透传
    it('should pass all arguments to the original function', () => {
      const clock = MockClock();
      withTimeline(clock, () => {
        const mock_fn = vi.fn();
        const debounced = new Debounced(mock_fn, 100);

        debounced.call(null, 'param1', 2, {a: 3});
        clock.tick(100);
        expect(mock_fn).toHaveBeenCalledWith('param1', 2, {a: 3});
      });
    });

    // 测试计时器提前触发的处理
    it('should re-queue when timer fires too early', () => {
      const clock = MockClock();
      withTimeline(clock, () => {
        const mock_fn = vi.fn();
        const debounced = new Debounced(mock_fn, 100, false, true);

        debounced.call(null); // T=0, 计划T=100执行

        // 模拟一个"意外"：时间才过50ms，手动触发StaticTask
        clock.tick(50); // T=50
        // @ts-expect-error - 调用私有静态方法来模拟计时器提前触发
        Debounced.Task(debounced);

        expect(debounced.pending).toBe(true);

        clock.tick(50); // T=100
        expect(mock_fn).toHaveBeenCalledTimes(1);
      });
    });

    // 测试时间回退的情况（leading模式）
    it('HELL: should handle time going backwards (leading mode)', () => {
      const clock = MockClock();
      withTimeline(clock, () => {
        const mock_fn = vi.fn();
        // 开启leading
        const debounced = new Debounced(mock_fn, 100, true, false);

        debounced.call(null); // 第一次执行
        expect(mock_fn).toHaveBeenCalledTimes(1);

        const now = Date.now();
        clock.setSystemTime(now - 1000); // 模拟时间回退

        // 此时shouldInvoke为true，且leading为true，应该立即再次执行
        debounced.call(null);
        expect(mock_fn).toHaveBeenCalledTimes(2);
      });
    });

    // 测试无参数调用时invokeFunc的行为
    it('should invokeFunc lead to SKIPPED if it takes no arguments', () => {
      const clock = MockClock();
      withTimeline(clock, () => {
        const mock_fn = vi.fn();
        const debounced = new Debounced(mock_fn, 100, true, true);

        debounced.call(null); // 启动与执行计时器
        expect(mock_fn).toHaveBeenCalledTimes(1);

        // 调用了，但没有参数
        clock.tick(100);
        expect(debounced.result).toBe(SKIPPED); // 上一次的结果会被重置为SKIPPED
        expect(mock_fn).toHaveBeenCalledTimes(1);
      });
    });

    // HELL: 测试极端时钟偏移与maxWait的组合
    it('HELL: should handle extreme clock skew with maxWait', () => {
      const clock = MockClock();
      withTimeline(clock, () => {
        const mock_fn = vi.fn();
        const debounced = new Debounced(mock_fn, 100, false, true, 200);

        debounced.call(null);
        clock.tick(50);

        clock.setSystemTime(Date.now() + 500); // 假设因为某种原因穿越到未来了

        debounced.call(null);

        // 推动宏队列响应
        clock.runAll();

        expect(mock_fn).toHaveBeenCalledTimes(1);
      });
    });
  });
});

// ============================
// 防重入行为测试
// 测试防抖函数在重入情况下的安全性
// ============================
describe.concurrent('Reentrancy Tests', () => {
  // 测试防抖重入安全性（无无限循环）
  it('should handle debounced reentrancy safely (no infinite loops)', () => {
    const clock = MockClock();
    withTimeline(clock, () => {
      let call_count = 0;

      // 构造一个在执行时会再次触发自身的函数
      const debounced = new Debounced(
        () => {
          call_count++;
          // 核心测试点：执行过程中再次调用
          // 如果invokeFunc没有清空last_args，这里可能会导致无限逻辑递归
          debounced.call(null);
        },
        100,
        false,
        true,
      );

      // 触发第一次调用
      debounced.call(null);

      // T=100: 触发执行
      clock.tick(100);

      // 此时回调已经执行了一次，且内部又注册了一个新的等待
      expect(call_count).toBe(1);
      expect(debounced.pending).toBe(true);

      // T=200: 触发内部重入产生的第二次执行
      clock.tick(100);

      expect(call_count).toBe(2);
      // 系统不会因为重入而崩溃，并且能正确排队下一次调用
    });
  });

  // 测试清除last_args后防止立即重新执行
  it.concurrent(
    'should prevent immediate re-execution if last_args is cleared',
    () => {
      const clock = MockClock();
      withTimeline(clock, () => {
        const execution_order: string[] = [];

        const debounced = new Debounced(
          () => {
            execution_order.push('start');
            // 试图在执行期间同步触发flush
            expect(debounced.flush()).toBe(SKIPPED);
            expect(debounced.pending).toBe(false);
            execution_order.push('end');
            return 5201314;
          },
          100,
          false,
          true,
        );

        debounced.call(null);
        clock.tick(100);

        // 最终顺序应该是 [start, end]，而不是 [start, start, end, end]
        expect(execution_order).toEqual(['start', 'end']);
        expect(debounced.result).toBe(5201314); // 函数最后的结果应该是5201314
      });
    },
  );

  // HELL: 确保参数在不同周期中被正确消费且不可重用
  it.concurrent(
    'HELL: should ensure parameters are consumed and not reusable across cycles',
    () => {
      const clock = MockClock();
      withTimeline(clock, () => {
        const captured: unknown[] = [];
        const debounced = new Debounced(
          (...args) => {
            captured.push(args);
          },
          100,
          true,
          true,
        );

        debounced.call(null, 'first'); // Leading执行
        debounced.call(null, 'second'); // 排队Trailing

        clock.tick(100); // 触发Trailing

        // 在这之后立即call，此时内部状态必须是干净的
        debounced.call(null, 'third');
        clock.tick(100);

        expect(captured).toEqual([['first'], ['second'], ['third']]);
      });
    },
  );

  it.concurrent(
    'should handle async exceptions and keep the state clean',
    () => {
      const clock = MockClock();
      withTimeline(clock, () => {
        let fail_once = true;
        // eslint-disable-next-line @typescript-eslint/require-await
        const mock_fn = vi.fn(async () => {
          if (fail_once) {
            fail_once = false;
            throw new Error('Boom!'); // 模拟执行中崩溃
          }
          return 'Success';
        });

        const debounced = new Debounced(mock_fn, 100, false, true);

        // 第一次：预定执行
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        debounced.call(null);

        clock.tick(100);
        expect(mock_fn).toHaveBeenCalledTimes(1);
        expect(debounced.pending).toBe(false); // 崩溃后也得把锁给我解开

        // 第二次：尝试恢复调用
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        debounced.call(null);
        clock.tick(100);
        expect(mock_fn).toHaveBeenCalledTimes(2); // 依然能正常工作
      });
    },
  );

  it('should not leak timers when maxWait is enabled', () => {
    const clock = MockClock();
    withTimeline(clock, () => {
      const mockFn = vi.fn();
      const spySetTimeout = vi.spyOn(global, 'setTimeout');
      const spyClearTimeout = vi.spyOn(global, 'clearTimeout');

      const debounced = new Debounced(mockFn, 100, false, true, 200);

      // 模拟紧密循环调用
      for (let i = 0; i < 10; i++) {
        debounced.call(null, i);
        clock.tick(50); // 每次调用前进50ms
      }

      // 等待所有可能的定时器执行
      clock.tick(500);

      expect(spySetTimeout).toHaveBeenCalledTimes(10);
      // 验证每个新定时器创建前是否清理了旧定时器
      expect(spyClearTimeout).toHaveBeenCalledTimes(10);
    });
  });
});
