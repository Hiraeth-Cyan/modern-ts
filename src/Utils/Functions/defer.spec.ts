// ========================================
// ./src/Utils/Functions/defer.spec.ts
// ========================================
import {describe, it, expect, vi} from 'vitest';
import {defer} from './defer';

describe.concurrent('defer', () => {
  describe('basic functionality', () => {
    it('should execute task and return result', async () => {
      const result = await defer(() => 'success');
      expect(result).toBe('success');
    });

    it('should execute async task and return result', async () => {
      const result = await defer(() => 'async success');
      expect(result).toBe('async success');
    });

    it('should execute callbacks in LIFO order on success', async () => {
      const order: number[] = [];
      await defer((register) => {
        register(() => {
          order.push(1);
        });
        register(() => {
          order.push(2);
        });
        register(() => {
          order.push(3);
        });
        return 'result';
      });
      expect(order).toEqual([3, 2, 1]);
    });

    it('should execute async callbacks in LIFO order', async () => {
      const order: number[] = [];
      await defer((register) => {
        register(() => {
          order.push(1);
        });
        register(() => {
          order.push(2);
        });
        return 'result';
      });
      expect(order).toEqual([2, 1]);
    });
  });

  describe('error handling', () => {
    it('should throw task error when task fails', async () => {
      const task_error = new Error('Task failed');
      const callback_spy = vi.fn();

      try {
        await defer((register) => {
          register(callback_spy);
          throw task_error;
        });
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBe(task_error);
        expect(callback_spy).toHaveBeenCalledWith(task_error);
      }
    });

    it('should throw AggregateError when task and callbacks fail', async () => {
      const task_error = new Error('Task failed');
      const callback_error = new Error('Callback failed');

      try {
        await defer((register) => {
          register(() => {
            throw callback_error;
          });
          throw task_error;
        });
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(AggregateError);
        const agg = e as AggregateError;
        expect(agg.errors).toContain(task_error);
        expect(agg.errors).toContain(callback_error);
        expect(agg.message).toBe('defer: task and callbacks failed');
      }
    });

    it('should throw AggregateError when multiple callbacks fail', async () => {
      const error1 = new Error('Callback 1 failed');
      const error2 = new Error('Callback 2 failed');
      const error3 = new Error('Callback 3 failed');

      try {
        await defer((register) => {
          register(() => {
            throw error1;
          });
          register(() => {
            throw error2;
          });
          register(() => {
            throw error3;
          });
          return 'success';
        });
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(AggregateError);
        const agg = e as AggregateError;
        expect(agg.errors).toContain(error1);
        expect(agg.errors).toContain(error2);
        expect(agg.errors).toContain(error3);
        expect(agg.message).toBe('defer: callbacks failed');
      }
    });

    it('should throw AggregateError when callbacks fail after task success', async () => {
      const callback_error = new Error('Callback failed');

      try {
        await defer((register) => {
          register(() => {
            throw callback_error;
          });
          return 'success';
        });
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(AggregateError);
        const agg = e as AggregateError;
        expect(agg.errors).toHaveLength(1);
        expect(agg.errors[0]).toBe(callback_error);
        expect(agg.message).toBe('defer: callbacks failed');
      }
    });
  });

  describe('callback execution', () => {
    it('should pass NO_ERROR to callbacks when task succeeds', async () => {
      let received_error: unknown;
      await defer((register) => {
        register((error) => {
          received_error = error;
        });
        return 'success';
      });
      expect(typeof received_error).toBe('symbol');
      expect(String(received_error)).toBe('Symbol(No Error)');
    });

    it('should pass task error to callbacks when task fails', async () => {
      const task_error = new Error('Task error');
      let received_error: unknown;
      const callback_spy = vi.fn((error) => {
        received_error = error;
      });

      try {
        await defer((register) => {
          register(callback_spy);
          throw task_error;
        });
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBe(task_error);
      }
      expect(received_error).toBe(task_error);
    });

    it('should continue executing callbacks even if one fails', async () => {
      const order: number[] = [];
      const error1 = new Error('Error 1');
      const error2 = new Error('Error 2');

      try {
        await defer((register) => {
          register(() => {
            order.push(1);
            throw error1;
          });
          register(() => {
            order.push(2);
          });
          register(() => {
            order.push(3);
            throw error2;
          });
          return 'success';
        });
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(AggregateError);
      }
      expect(order).toEqual([3, 2, 1]);
    });
  });

  describe('resource management pattern', () => {
    it('should support resource cleanup pattern', async () => {
      const cleanup_log: string[] = [];
      const result = await defer((register) => {
        const resource1 = {
          name: 'resource1',
          cleanup: () => cleanup_log.push('cleanup1'),
        };
        const resource2 = {
          name: 'resource2',
          cleanup: () => cleanup_log.push('cleanup2'),
        };
        const resource3 = {
          name: 'resource3',
          cleanup: () => cleanup_log.push('cleanup3'),
        };

        register(() => resource1.cleanup());
        register(() => resource2.cleanup());
        register(() => resource3.cleanup());

        return 'result';
      });
      expect(result).toBe('result');
      expect(cleanup_log).toEqual(['cleanup3', 'cleanup2', 'cleanup1']);
    });

    it('should cleanup resources even when task fails', async () => {
      const cleanup_log: string[] = [];
      const task_error = new Error('Task failed');

      try {
        await defer((register) => {
          const resource1 = {cleanup: () => cleanup_log.push('cleanup1')};
          const resource2 = {cleanup: () => cleanup_log.push('cleanup2')};

          register(() => resource1.cleanup());
          register(() => resource2.cleanup());

          throw task_error;
        });
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBe(task_error);
      }
      expect(cleanup_log).toEqual(['cleanup2', 'cleanup1']);
    });

    it('should support async resource cleanup', async () => {
      const cleanup_log: string[] = [];
      const result = await defer((register) => {
        const resource1 = {
          cleanup: () => {
            cleanup_log.push('cleanup1');
          },
        };
        const resource2 = {
          cleanup: () => {
            cleanup_log.push('cleanup2');
          },
        };

        register(() => resource1.cleanup());
        register(() => resource2.cleanup());

        return 'result';
      });
      expect(result).toBe('result');
      expect(cleanup_log).toEqual(['cleanup2', 'cleanup1']);
    });
  });

  describe('edge cases', () => {
    it('should handle no callbacks registered', async () => {
      const result = await defer(() => 'no callbacks');
      expect(result).toBe('no callbacks');
    });

    it('should handle task returning undefined', async () => {
      const result = await defer(() => undefined);
      expect(result).toBeUndefined();
    });

    it('should handle sync task with sync callbacks', async () => {
      const order: number[] = [];
      const result = await defer((register) => {
        register(() => order.push(1));
        register(() => order.push(2));
        return 'sync result';
      });
      expect(result).toBe('sync result');
      expect(order).toEqual([2, 1]);
    });

    it('should handle mixed sync and async callbacks', async () => {
      const order: number[] = [];
      await defer((register) => {
        register(() => {
          order.push(1);
        });
        register(() => {
          order.push(2);
        });
        register(() => {
          order.push(3);
        });
        return 'result';
      });
      expect(order).toEqual([3, 2, 1]);
    });
  });
});
