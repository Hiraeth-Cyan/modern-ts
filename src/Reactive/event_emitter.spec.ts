// ========================================
// ./src/Reactive/event_emitter.spec.ts
// ========================================
/* eslint-disable @typescript-eslint/no-misused-promises */
/* eslint-disable @typescript-eslint/require-await */
import {describe, it, expect, vi} from 'vitest';
import {EventEmitter} from './event_emitter';

type TestEvents = {
  foo: [number];
  bar: [string, boolean];
  baz: [];
  error: [Error];
  newListener: [string | symbol, (...args: unknown[]) => void];
  removeListener: [string | symbol, (...args: unknown[]) => void];
};

describe.concurrent('EventEmitter', () => {
  // ============================================
  // 基本事件监听与触发
  // ============================================
  describe('Basic on/off/emit', () => {
    it('should register and trigger event listener', () => {
      const emitter = new EventEmitter<TestEvents>();
      const handler = vi.fn();
      emitter.on('foo', handler);
      emitter.emit('foo', 42);
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(42);
    });

    it('should support multiple listeners for the same event', () => {
      const emitter = new EventEmitter<TestEvents>();
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      emitter.on('foo', handler1);
      emitter.on('foo', handler2);
      emitter.emit('foo', 100);
      expect(handler1).toHaveBeenCalledWith(100);
      expect(handler2).toHaveBeenCalledWith(100);
    });

    it('should remove listener with off()', () => {
      const emitter = new EventEmitter<TestEvents>();
      const handler = vi.fn();
      emitter.on('foo', handler);
      emitter.off('foo', handler);
      emitter.emit('foo', 42);
      expect(handler).not.toHaveBeenCalled();
    });

    it('should return false when emitting event with no listeners', () => {
      const emitter = new EventEmitter<TestEvents>();
      expect(emitter.emit('foo', 1)).toBe(false);
    });

    it('should return true when emitting event with listeners', () => {
      const emitter = new EventEmitter<TestEvents>();
      emitter.on('foo', () => {});
      expect(emitter.emit('foo', 1)).toBe(true);
    });

    it('should support multiple arguments', () => {
      const emitter = new EventEmitter<TestEvents>();
      const handler = vi.fn();
      emitter.on('bar', handler);
      emitter.emit('bar', 'hello', true);
      expect(handler).toHaveBeenCalledWith('hello', true);
    });

    it('should support zero arguments', () => {
      const emitter = new EventEmitter<TestEvents>();
      const handler = vi.fn();
      emitter.on('baz', handler);
      emitter.emit('baz');
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should do nothing when removing non-existent listener', () => {
      const emitter = new EventEmitter<TestEvents>();
      const handler = vi.fn();
      expect(() => emitter.off('foo', handler)).not.toThrow();
    });

    it('should do nothing when removing mismatched callback from single-function storage', () => {
      const emitter = new EventEmitter<TestEvents>();
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      emitter.on('foo', handler1);
      emitter.off('foo', handler2);
      expect(emitter.listenerCount('foo')).toBe(1);
      emitter.emit('foo', 42);
      expect(handler1).toHaveBeenCalledWith(42);
    });
  });

  // ============================================
  // once 方法
  // ============================================
  describe('once()', () => {
    it('should only trigger once', () => {
      const emitter = new EventEmitter<TestEvents>();
      const handler = vi.fn();
      emitter.once('foo', handler);
      emitter.emit('foo', 1);
      emitter.emit('foo', 2);
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(1);
    });

    it('should remove listener after first trigger', () => {
      const emitter = new EventEmitter<TestEvents>();
      const handler = vi.fn();
      emitter.once('foo', handler);
      emitter.emit('foo', 42);
      expect(emitter.listenerCount('foo')).toBe(0);
    });

    it('should allow removal via off() before trigger', () => {
      const emitter = new EventEmitter<TestEvents>();
      const handler = vi.fn();
      emitter.once('foo', handler);
      emitter.off('foo', handler);
      emitter.emit('foo', 42);
      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // prependListener 和 prependOnceListener
  // ============================================
  describe('prependListener() and prependOnceListener()', () => {
    it('should add listener to the beginning', () => {
      const emitter = new EventEmitter<TestEvents>();
      const order: number[] = [];
      emitter.on('foo', () => order.push(2));
      emitter.prependListener('foo', () => order.push(1));
      emitter.emit('foo', 0);
      expect(order).toEqual([1, 2]);
    });

    it('should handle multiple prepend listeners in order', () => {
      const emitter = new EventEmitter<TestEvents>();
      const order: number[] = [];
      emitter.on('foo', () => order.push(3));
      emitter.prependListener('foo', () => order.push(1));
      emitter.prependListener('foo', () => order.push(2));
      emitter.emit('foo', 0);
      expect(order).toEqual([2, 1, 3]);
    });

    it('should trigger prependOnceListener only once at the beginning', () => {
      const emitter = new EventEmitter<TestEvents>();
      const order: number[] = [];
      emitter.on('foo', () => order.push(2));
      emitter.prependOnceListener('foo', () => order.push(1));
      emitter.emit('foo', 0);
      emitter.emit('foo', 0);
      expect(order).toEqual([1, 2, 2]);
    });
  });

  // ============================================
  // newListener 和 removeListener 特殊事件
  // ============================================
  describe('newListener and removeListener events', () => {
    it('should emit newListener when adding listener', () => {
      const emitter = new EventEmitter<TestEvents>();
      const newListenerHandler = vi.fn();
      emitter.on('newListener', newListenerHandler);
      const handler = vi.fn();
      emitter.on('foo', handler);
      expect(newListenerHandler).toHaveBeenCalledWith('foo', handler);
    });

    it('should not emit newListener for the first newListener event listener', () => {
      const emitter = new EventEmitter<TestEvents>();
      const newListenerHandler = vi.fn();
      emitter.on('newListener', newListenerHandler);
      expect(newListenerHandler).not.toHaveBeenCalled();
    });

    it('should emit newListener for subsequent newListener listeners', () => {
      const emitter = new EventEmitter<TestEvents>();
      const newListenerHandler = vi.fn();
      emitter.on('newListener', newListenerHandler);
      emitter.on('newListener', () => {});
      expect(newListenerHandler).toHaveBeenCalledTimes(1);
    });

    it('should emit removeListener when removing listener', () => {
      const emitter = new EventEmitter<TestEvents>();
      const removeListenerHandler = vi.fn();
      emitter.on('removeListener', removeListenerHandler);
      const handler = vi.fn();
      emitter.on('foo', handler);
      emitter.off('foo', handler);
      expect(removeListenerHandler).toHaveBeenCalledWith('foo', handler);
    });

    it('should emit removeListener for removeListener event itself', () => {
      const emitter = new EventEmitter<TestEvents>();
      const removeListenerHandler = vi.fn();
      emitter.on('removeListener', removeListenerHandler);
      const handler = () => {};
      emitter.on('removeListener', handler);
      emitter.off('removeListener', handler);
      expect(removeListenerHandler).toHaveBeenCalledTimes(1);
    });

    it('should emit removeListener for newListener event', () => {
      const emitter = new EventEmitter<TestEvents>();
      const removeListenerHandler = vi.fn();
      emitter.on('removeListener', removeListenerHandler);
      const handler = () => {};
      emitter.on('newListener', handler);
      emitter.off('newListener', handler);
      expect(removeListenerHandler).toHaveBeenCalledTimes(1);
    });

    it('should catch error in removeListener handler', () => {
      const emitter = new EventEmitter<TestEvents>();
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      emitter.on('removeListener', () => {
        throw new Error('removeListener error');
      });
      const handler = vi.fn();
      emitter.on('foo', handler);
      emitter.removeAllListeners();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error in removeListener handler:',
        expect.any(Error),
      );
      consoleSpy.mockRestore();
    });

    it('should catch error in removeListener handler when removing specific event', () => {
      const emitter = new EventEmitter<TestEvents>();
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      emitter.on('removeListener', () => {
        throw new Error('removeListener error');
      });
      const handler = vi.fn();
      emitter.on('foo', handler);
      emitter.removeAllListeners('foo');
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error in removeListener handler:',
        expect.any(Error),
      );
      consoleSpy.mockRestore();
    });

    it('should trigger newListener when using prependListener', () => {
      const emitter = new EventEmitter<TestEvents>();
      const newListenerHandler = vi.fn();
      emitter.on('newListener', newListenerHandler);
      const handler = vi.fn();
      emitter.prependListener('foo', handler);
      expect(newListenerHandler).toHaveBeenCalledWith('foo', handler);
    });
  });

  // ============================================
  // emit 过程中的动态操作
  // ============================================
  describe('Dynamic operations during emit', () => {
    it('should defer listener addition during emit', () => {
      const emitter = new EventEmitter<TestEvents>();
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      emitter.on('foo', () => {
        emitter.on('foo', handler2);
      });
      emitter.on('foo', handler1);
      emitter.emit('foo', 42);
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).not.toHaveBeenCalled();
      emitter.emit('foo', 42);
      expect(handler1).toHaveBeenCalledTimes(2);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('should defer listener removal during emit', () => {
      const emitter = new EventEmitter<TestEvents>();
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      emitter.on('foo', handler1);
      emitter.on('foo', () => {
        emitter.off('foo', handler2);
      });
      emitter.on('foo', handler2);
      emitter.emit('foo', 42);
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
      emitter.emit('foo', 42);
      expect(handler1).toHaveBeenCalledTimes(2);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('should handle self-removing listener during emit', () => {
      const emitter = new EventEmitter<TestEvents>();
      const handler = vi.fn(function (this: typeof handler) {
        emitter.off('foo', handler);
      });
      emitter.on('foo', handler);
      emitter.emit('foo', 42);
      emitter.emit('foo', 42);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should defer prependListener during emit', () => {
      const emitter = new EventEmitter<TestEvents>();
      const order: number[] = [];
      emitter.on('foo', () => {
        order.push(1);
        emitter.prependListener('foo', () => order.push(0));
      });
      emitter.emit('foo', 0);
      expect(order).toEqual([1]);
      order.length = 0;
      emitter.emit('foo', 0);
      expect(order).toEqual([0, 1]);
    });

    it('should defer removal of single-function listener during emit of another event', () => {
      const emitter = new EventEmitter<TestEvents>();
      const foo_handler = vi.fn();
      emitter.on('foo', foo_handler);
      emitter.on('bar', () => {});
      emitter.on('bar', () => {
        emitter.off('foo', foo_handler);
      });
      emitter.emit('bar', 'test', true);
      expect(foo_handler).not.toHaveBeenCalled();
      expect(emitter.listenerCount('foo')).toBe(0);
    });

    it('should handle nested emit correctly', () => {
      const emitter = new EventEmitter<TestEvents>();
      const order: string[] = [];
      emitter.on('foo', () => {
        order.push('foo1');
        emitter.emit('baz');
      });
      emitter.on('foo', () => order.push('foo2'));
      emitter.on('baz', () => order.push('baz'));
      emitter.emit('foo', 0);
      expect(order).toEqual(['foo1', 'baz', 'foo2']);
    });

    it('should remove prependOnceListener during emit via original callback', () => {
      const emitter = new EventEmitter<TestEvents>();
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const prepend_handler = vi.fn();
      emitter.on('foo', handler1);
      emitter.prependOnceListener('foo', prepend_handler);
      emitter.on('foo', () => {
        emitter.off('foo', prepend_handler);
      });
      emitter.on('foo', handler2);
      emitter.emit('foo', 42);
      expect(prepend_handler).toHaveBeenCalledTimes(1);
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
      emitter.emit('foo', 42);
      expect(prepend_handler).toHaveBeenCalledTimes(1);
      expect(handler1).toHaveBeenCalledTimes(2);
      expect(handler2).toHaveBeenCalledTimes(2);
    });

    it('should find wrapped fn in prepend array with multiple elements during emit', () => {
      const emitter = new EventEmitter<TestEvents>();
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const prepend_handler1 = vi.fn();
      const prepend_handler2 = vi.fn();
      emitter.on('foo', handler1);
      emitter.prependListener('foo', prepend_handler1);
      emitter.prependOnceListener('foo', prepend_handler2);
      emitter.on('foo', () => {
        emitter.off('foo', prepend_handler2);
      });
      emitter.on('foo', handler2);
      emitter.emit('foo', 42);
      expect(prepend_handler1).toHaveBeenCalledTimes(1);
      expect(prepend_handler2).toHaveBeenCalledTimes(1);
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
      emitter.emit('foo', 42);
      expect(prepend_handler1).toHaveBeenCalledTimes(2);
      expect(prepend_handler2).toHaveBeenCalledTimes(1);
    });

    it('should add listener to new event during emit', () => {
      const emitter = new EventEmitter<TestEvents>();
      const handler = vi.fn();
      emitter.on('foo', () => {
        emitter.on('bar', handler);
      });
      emitter.on('foo', () => {}); // 第二个监听器，确保 emitting_depth > 0
      emitter.emit('foo', 42);
      expect(emitter.listenerCount('bar')).toBe(1);
      emitter.emit('bar', 'test', true);
      expect(handler).toHaveBeenCalled();
    });

    it('should add listener to single-function storage during emit', () => {
      const emitter = new EventEmitter<TestEvents>();
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      emitter.on('bar', handler1); // 'bar' has single listener (function storage)
      emitter.on('foo', () => {
        emitter.on('bar', handler2); // Add to 'bar' during 'foo' emit
      });
      emitter.on('foo', () => {}); // 第二个监听器，确保 emitting_depth > 0
      emitter.emit('foo', 42);
      expect(emitter.listenerCount('bar')).toBe(2);
      emitter.emit('bar', 'test', true);
      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    it('should prepend listener to single-function storage during emit', () => {
      const emitter = new EventEmitter<TestEvents>();
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      emitter.on('bar', handler1); // 'bar' has single listener (function storage)
      emitter.on('foo', () => {
        emitter.prependListener('bar', handler2); // Prepend to 'bar' during 'foo' emit
      });
      emitter.on('foo', () => {}); // 第二个监听器，确保 emitting_depth > 0
      emitter.emit('foo', 42);
      expect(emitter.listenerCount('bar')).toBe(2);
      // Verify structure: prepend array should have handler2, normal array should have handler1
      const listeners = emitter.listeners('bar');
      expect(listeners[0]).toBe(handler2);
      expect(listeners[1]).toBe(handler1);
    });

    it('should defer removal of single listener event via removeAllListeners during emit', () => {
      const emitter = new EventEmitter<TestEvents>();
      const handler = vi.fn();
      emitter.on('foo', () => {
        emitter.removeAllListeners('bar');
      });
      emitter.on('foo', () => {}); // 第二个监听器，确保 emitting_depth > 0
      emitter.on('bar', handler);
      emitter.emit('foo', 42);
      expect(emitter.listenerCount('bar')).toBe(0);
    });

    it('should defer removal of event with prepend listeners via removeAllListeners during emit', () => {
      const emitter = new EventEmitter<TestEvents>();
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      emitter.on('bar', handler1);
      emitter.prependListener('bar', handler2);
      emitter.on('foo', () => {
        emitter.removeAllListeners('bar');
      });
      emitter.on('foo', () => {}); // 第二个监听器，确保 emitting_depth > 0
      emitter.emit('foo', 42);
      expect(emitter.listenerCount('bar')).toBe(0);
    });

    it('should handle removeAllListeners (all) with prepend listeners during emit', () => {
      const emitter = new EventEmitter<TestEvents>();
      const handler = vi.fn();
      emitter.on('bar', handler);
      emitter.prependListener('bar', handler);
      emitter.on('foo', () => {
        emitter.removeAllListeners();
      });
      emitter.on('foo', () => {}); // 第二个监听器，确保 emitting_depth > 0
      emitter.emit('foo', 42);
      expect(emitter.listenerCount('bar')).toBe(0);
    });

    it('should handle removeAllListeners (all) with single-function storage during emit', () => {
      const emitter = new EventEmitter<TestEvents>();
      const handler = vi.fn();
      emitter.on('bar', handler); // 单函数存储
      emitter.on('foo', () => {
        emitter.removeAllListeners();
      });
      emitter.on('foo', () => {}); // 第二个监听器，确保 emitting_depth > 0
      emitter.emit('foo', 42);
      expect(emitter.listenerCount('bar')).toBe(0);
    });

    it('should skip pending removal when event storage is already deleted', () => {
      const emitter = new EventEmitter<TestEvents>();
      const handler = vi.fn();
      emitter.on('bar', handler);
      emitter.on('foo', () => {
        emitter.off('bar', handler); // 创建 pending_removals
        emitter.removeAllListeners('bar'); // 删除 bar 事件，storage 变为 null
      });
      emitter.on('foo', () => {}); // 第二个监听器，确保 emitting_depth > 0
      expect(() => emitter.emit('foo', 42)).not.toThrow();
      expect(emitter.listenerCount('bar')).toBe(0);
    });

    it('should not remove single-function storage when callback does not match', () => {
      const emitter = new EventEmitter<TestEvents>();
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      emitter.on('bar', handler1); // 单函数存储
      emitter.on('foo', () => {
        emitter.off('bar', handler2); // 尝试移除不匹配的 callback
      });
      emitter.on('foo', () => {}); // 第二个监听器，确保 emitting_depth > 0
      emitter.emit('foo', 42);
      expect(emitter.listenerCount('bar')).toBe(1);
      emitter.emit('bar', 'test', true);
      expect(handler1).toHaveBeenCalled();
    });

    it('should not remove from ListenerList when callback not found in prepend or normal', () => {
      const emitter = new EventEmitter<TestEvents>();
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const wrong_handler = vi.fn();
      emitter.on('bar', handler1);
      emitter.prependListener('bar', handler2); // ListenerList 存储
      emitter.on('foo', () => {
        emitter.off('bar', wrong_handler); // 尝试移除不存在的 callback
      });
      emitter.on('foo', () => {}); // 第二个监听器，确保 emitting_depth > 0
      emitter.emit('foo', 42);
      expect(emitter.listenerCount('bar')).toBe(2);
    });
  });

  // ============================================
  // 错误处理
  // ============================================
  describe('Error handling', () => {
    it('should handle error event when listener throws', () => {
      const emitter = new EventEmitter<TestEvents>();
      const errorHandler = vi.fn();
      emitter.on('error', errorHandler);
      emitter.on('foo', () => {
        throw new Error('test error');
      });
      const result = emitter.emit('foo', 42);
      expect(result).toBe(false);
      expect(errorHandler).toHaveBeenCalledTimes(1);
    });

    it('should continue calling other listeners after error', () => {
      const emitter = new EventEmitter<TestEvents>();
      const errorHandler = vi.fn();
      const handler1 = vi.fn(() => {
        throw new Error('error');
      });
      const handler2 = vi.fn();
      emitter.on('error', errorHandler);
      emitter.on('foo', handler1);
      emitter.on('foo', handler2);
      emitter.emit('foo', 42);
      expect(handler2).toHaveBeenCalledTimes(1);
      expect(errorHandler).toHaveBeenCalledTimes(1);
    });

    it('should throw when error event listener throws', () => {
      const emitter = new EventEmitter<TestEvents>();
      emitter.on('error', () => {
        throw new Error('error in error handler');
      });
      expect(() => emitter.emit('error', new Error('original'))).toThrow(
        'error in error handler',
      );
    });

    it('should throw error directly when emitting error event without listener', () => {
      const emitter = new EventEmitter<TestEvents>();
      expect(() => emitter.emit('error', new Error('direct error'))).toThrow(
        'direct error',
      );
    });

    it('should throw when error handler throws during other event error', () => {
      const emitter = new EventEmitter<TestEvents>();
      emitter.on('error', () => {
        throw new Error('error in error handler');
      });
      emitter.on('foo', () => {
        throw new Error('original error');
      });
      expect(() => emitter.emit('foo', 42)).toThrow('error in error handler');
    });

    it('should throw error when error listener is pending removal', () => {
      const emitter = new EventEmitter<TestEvents>();
      const errorHandler = vi.fn();
      emitter.on('error', errorHandler);
      emitter.on('foo', () => {
        emitter.off('error', errorHandler);
        throw new Error('test');
      });
      expect(() => emitter.emit('foo', 42)).toThrow('test');
      expect(errorHandler).not.toHaveBeenCalled();
    });

    it('should throw error when single error listener is pending removal during multi-listener emit', () => {
      const emitter = new EventEmitter<TestEvents>();
      const errorHandler = vi.fn();
      emitter.on('error', errorHandler);
      emitter.on('foo', () => {});
      emitter.on('foo', () => {
        emitter.off('error', errorHandler);
        throw new Error('test');
      });
      expect(() => emitter.emit('foo', 42)).toThrow('test');
      expect(errorHandler).not.toHaveBeenCalled();
    });

    it('should handle error from prependListener', () => {
      const emitter = new EventEmitter<TestEvents>();
      const errorHandler = vi.fn();
      const normalHandler = vi.fn();
      emitter.on('error', errorHandler);
      emitter.on('foo', normalHandler);
      emitter.prependListener('foo', () => {
        throw new Error('prepend error');
      });
      const result = emitter.emit('foo', 42);
      expect(result).toBe(false);
      expect(errorHandler).toHaveBeenCalledWith(expect.any(Error));
      expect(normalHandler).toHaveBeenCalledTimes(1);
    });

    it('should handle error with multiple error listeners (ListenerList)', () => {
      const emitter = new EventEmitter<TestEvents>();
      const error1 = vi.fn();
      const error2 = vi.fn();
      emitter.on('error', error1);
      emitter.on('error', error2);
      emitter.on('foo', () => {
        throw new Error('test');
      });
      emitter.emit('foo', 42);
      expect(error1).toHaveBeenCalledWith(expect.any(Error));
      expect(error2).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should skip prepend error listener if pending removal during error handling', () => {
      const emitter = new EventEmitter<TestEvents>();
      const prependErrorHandler = vi.fn();
      const normalErrorHandler = vi.fn();
      emitter.on('error', normalErrorHandler);
      emitter.prependListener('error', prependErrorHandler);
      emitter.on('foo', () => {
        emitter.off('error', prependErrorHandler);
        throw new Error('test');
      });
      emitter.emit('foo', 42);
      expect(prependErrorHandler).not.toHaveBeenCalled();
      expect(normalErrorHandler).toHaveBeenCalled();
    });

    it('should skip normal error listener if pending removal during error handling', () => {
      const emitter = new EventEmitter<TestEvents>();
      const error1 = vi.fn();
      const error2 = vi.fn();
      emitter.on('error', error1);
      emitter.on('error', error2);
      emitter.on('foo', () => {
        emitter.off('error', error1);
        throw new Error('test');
      });
      emitter.emit('foo', 42);
      expect(error1).not.toHaveBeenCalled();
      expect(error2).toHaveBeenCalled();
    });

    it('should check pending removal with multiple pending entries', () => {
      const emitter = new EventEmitter<TestEvents>();
      const error1 = vi.fn();
      const error2 = vi.fn();
      const error3 = vi.fn();
      emitter.on('error', error1);
      emitter.on('error', error2);
      emitter.on('error', error3);
      emitter.on('foo', () => {
        emitter.off('error', error1);
        emitter.off('error', error2);
        throw new Error('test');
      });
      emitter.emit('foo', 42);
      expect(error1).not.toHaveBeenCalled();
      expect(error2).not.toHaveBeenCalled();
      expect(error3).toHaveBeenCalled();
    });

    it('should not skip error listener for mismatching pending removal event', () => {
      const emitter = new EventEmitter<TestEvents>();
      const fooHandler = vi.fn();
      const errorHandler = vi.fn();
      emitter.on('foo', fooHandler);
      emitter.on('error', errorHandler);
      emitter.on('bar', () => {
        emitter.off('foo', fooHandler); // Pending removal for 'foo'
        throw new Error('test');
      });
      emitter.on('bar', () => {}); // 第二个监听器，确保 emitting_depth > 0
      emitter.emit('bar', 'test', true);
      // errorHandler should be called because it's not pending removal for 'error' event
      expect(errorHandler).toHaveBeenCalled();
    });

    it('should skip prepend error listener in handleEmitError when emitting_depth > 0', () => {
      const emitter = new EventEmitter<TestEvents>();
      const prependErrorHandler = vi.fn();
      const normalErrorHandler = vi.fn();
      emitter.on('error', normalErrorHandler);
      emitter.prependListener('error', prependErrorHandler);
      emitter.on('foo', () => {}); // 第一个监听器
      emitter.on('foo', () => {
        emitter.off('error', prependErrorHandler);
        throw new Error('test');
      });
      emitter.emit('foo', 42);
      expect(prependErrorHandler).not.toHaveBeenCalled();
      expect(normalErrorHandler).toHaveBeenCalled();
    });

    it('should skip normal error listener in handleEmitError when emitting_depth > 0', () => {
      const emitter = new EventEmitter<TestEvents>();
      const error1 = vi.fn();
      const error2 = vi.fn();
      emitter.on('error', error1);
      emitter.on('error', error2);
      emitter.on('foo', () => {}); // 第一个监听器
      emitter.on('foo', () => {
        emitter.off('error', error1);
        throw new Error('test');
      });
      emitter.emit('foo', 42);
      expect(error1).not.toHaveBeenCalled();
      expect(error2).toHaveBeenCalled();
    });

    it('should throw when prepend error handler throws in ListenerList', () => {
      const emitter = new EventEmitter<TestEvents>();
      const normalErrorHandler = vi.fn();
      emitter.on('error', normalErrorHandler);
      emitter.prependListener('error', () => {
        throw new Error('prepend error handler failed');
      });
      emitter.on('foo', () => {
        throw new Error('test');
      });
      expect(() => emitter.emit('foo', 42)).toThrow(
        'prepend error handler failed',
      );
    });

    it('should throw when normal error handler throws in ListenerList', () => {
      const emitter = new EventEmitter<TestEvents>();
      const prependErrorHandler = vi.fn();
      emitter.on('error', () => {
        throw new Error('normal error handler failed');
      });
      emitter.prependListener('error', prependErrorHandler);
      emitter.on('foo', () => {
        throw new Error('test');
      });
      expect(() => emitter.emit('foo', 42)).toThrow(
        'normal error handler failed',
      );
    });
  });

  // ============================================
  // 监听器查询方法
  // ============================================
  describe('Listener query methods', () => {
    it('should return correct count using listenerCount()', () => {
      const emitter = new EventEmitter<TestEvents>();
      expect(emitter.listenerCount('foo')).toBe(0);
      emitter.on('foo', () => {});
      expect(emitter.listenerCount('foo')).toBe(1);
      emitter.on('foo', () => {});
      expect(emitter.listenerCount('foo')).toBe(2);
    });

    it('should return array of listeners using listeners()', () => {
      const emitter = new EventEmitter<TestEvents>();
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      emitter.on('foo', handler1);
      emitter.on('foo', handler2);
      const listeners = emitter.listeners('foo');
      expect(listeners).toHaveLength(2);
      expect(listeners).toContain(handler1);
      expect(listeners).toContain(handler2);
    });

    it('should return array for single listener using listeners()', () => {
      const emitter = new EventEmitter<TestEvents>();
      const handler = vi.fn();
      emitter.on('foo', handler);
      const listeners = emitter.listeners('foo');
      expect(listeners).toEqual([handler]);
    });

    it('should return empty array for no listeners using listeners()', () => {
      const emitter = new EventEmitter<TestEvents>();
      expect(emitter.listeners('foo')).toEqual([]);
    });

    it('should return all registered event names using eventNames()', () => {
      const emitter = new EventEmitter<TestEvents>();
      emitter.on('foo', () => {});
      emitter.on('bar', () => {});
      const names = emitter.eventNames();
      expect(names).toContain('foo');
      expect(names).toContain('bar');
    });

    it('should return empty array when no events using eventNames()', () => {
      const emitter = new EventEmitter<TestEvents>();
      expect(emitter.eventNames()).toEqual([]);
    });
  });

  // ============================================
  // removeAllListeners
  // ============================================
  describe('removeAllListeners()', () => {
    it('should remove all listeners for a specific event', () => {
      const emitter = new EventEmitter<TestEvents>();
      emitter.on('foo', () => {});
      emitter.on('foo', () => {});
      emitter.on('bar', () => {});
      emitter.removeAllListeners('foo');
      expect(emitter.listenerCount('foo')).toBe(0);
      expect(emitter.listenerCount('bar')).toBe(1);
    });

    it('should emit removeListener for prepend listeners when removing all', () => {
      const emitter = new EventEmitter<TestEvents>();
      const removeListenerHandler = vi.fn();
      emitter.on('removeListener', removeListenerHandler);
      const prependHandler = vi.fn();
      const normalHandler = vi.fn();
      emitter.on('foo', normalHandler);
      emitter.prependListener('foo', prependHandler);
      emitter.removeAllListeners('foo');
      expect(removeListenerHandler).toHaveBeenCalledTimes(2);
    });

    it('should remove all listeners with prepend and normal without removeListener event', () => {
      const emitter = new EventEmitter<TestEvents>();
      const prependHandler = vi.fn();
      const normalHandler = vi.fn();
      emitter.on('foo', normalHandler);
      emitter.prependListener('foo', prependHandler);
      expect(emitter.listenerCount('foo')).toBe(2);
      emitter.removeAllListeners('foo');
      expect(emitter.listenerCount('foo')).toBe(0);
    });

    it('should remove all listeners with only prepend listeners', () => {
      const emitter = new EventEmitter<TestEvents>();
      const prependHandler1 = vi.fn();
      const prependHandler2 = vi.fn();
      emitter.prependListener('foo', prependHandler1);
      emitter.prependListener('foo', prependHandler2);
      expect(emitter.listenerCount('foo')).toBe(2);
      emitter.removeAllListeners('foo');
      expect(emitter.listenerCount('foo')).toBe(0);
    });

    it('should remove all listeners for all events when no event specified', () => {
      const emitter = new EventEmitter<TestEvents>();
      emitter.on('foo', () => {});
      emitter.on('bar', () => {});
      emitter.removeAllListeners();
      expect(emitter.listenerCount('foo')).toBe(0);
      expect(emitter.listenerCount('bar')).toBe(0);
    });

    it('should emit removeListener for each removed listener', () => {
      const emitter = new EventEmitter<TestEvents>();
      const removeHandler = vi.fn();
      emitter.on('removeListener', removeHandler);
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      emitter.on('foo', handler1);
      emitter.on('foo', handler2);
      emitter.removeAllListeners('foo');
      expect(removeHandler).toHaveBeenCalledTimes(2);
    });

    it('should emit removeListener for single-function storage', () => {
      const emitter = new EventEmitter<TestEvents>();
      const removeHandler = vi.fn();
      emitter.on('removeListener', removeHandler);
      const handler = vi.fn();
      emitter.on('foo', handler); // 单函数存储
      emitter.removeAllListeners('foo');
      expect(removeHandler).toHaveBeenCalledTimes(1);
      expect(removeHandler).toHaveBeenCalledWith('foo', handler);
    });

    it('should defer removal during emit', () => {
      const emitter = new EventEmitter<TestEvents>();
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      emitter.on('foo', () => {
        emitter.removeAllListeners('foo');
      });
      emitter.on('foo', handler1);
      emitter.on('foo', handler2);
      emitter.emit('foo', 42);
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
      expect(emitter.listenerCount('foo')).toBe(0);
    });

    it('should handle removeAllListeners during emit for all events', () => {
      const emitter = new EventEmitter<TestEvents>();
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      emitter.on('foo', () => {
        emitter.removeAllListeners();
      });
      emitter.on('foo', handler1);
      emitter.on('bar', handler2);
      emitter.emit('foo', 42);
      expect(emitter.listenerCount('foo')).toBe(0);
      expect(emitter.listenerCount('bar')).toBe(0);
    });

    it('should process removeListener listeners last when removing all', () => {
      const emitter = new EventEmitter<TestEvents>();
      const order: string[] = [];
      emitter.on('foo', () => order.push('foo'));
      emitter.on('bar', () => order.push('bar'));
      emitter.on('removeListener', () => order.push('remove'));
      emitter.removeAllListeners();
      expect(order.indexOf('remove')).toBeGreaterThan(order.indexOf('foo'));
      expect(order.indexOf('remove')).toBeGreaterThan(order.indexOf('bar'));
    });
  });

  // ============================================
  // 边界情况
  // ============================================
  describe('Edge cases', () => {
    it('should handle removing same listener multiple times', () => {
      const emitter = new EventEmitter<TestEvents>();
      const handler = vi.fn();
      emitter.on('foo', handler);
      emitter.off('foo', handler);
      emitter.off('foo', handler);
      expect(emitter.listenerCount('foo')).toBe(0);
    });

    it('should do nothing when removing non-existent callback from list storage', () => {
      const emitter = new EventEmitter<TestEvents>();
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();
      emitter.on('foo', handler1);
      emitter.on('foo', handler2);
      emitter.off('foo', handler3);
      expect(emitter.listenerCount('foo')).toBe(2);
    });

    it('should delete event when last listener removed from list', () => {
      const emitter = new EventEmitter<TestEvents>();
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      emitter.on('foo', handler1);
      emitter.on('foo', handler2);
      emitter.off('foo', handler1);
      emitter.off('foo', handler2);
      expect(emitter.listenerCount('foo')).toBe(0);
      expect(emitter.eventNames()).not.toContain('foo');
    });

    it('should emit removeListener when removing from list storage', () => {
      const emitter = new EventEmitter<TestEvents>();
      const removeListenerHandler = vi.fn();
      emitter.on('removeListener', removeListenerHandler);
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      emitter.on('foo', handler1);
      emitter.on('foo', handler2);
      emitter.off('foo', handler1);
      expect(removeListenerHandler).toHaveBeenCalledWith('foo', handler1);
    });

    it('should emit removeListener when removing from list with multiple remaining', () => {
      const emitter = new EventEmitter<TestEvents>();
      const removeListenerHandler = vi.fn();
      emitter.on('removeListener', removeListenerHandler);
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();
      emitter.on('foo', handler1);
      emitter.on('foo', handler2);
      emitter.on('foo', handler3);
      emitter.off('foo', handler1);
      expect(removeListenerHandler).toHaveBeenCalledWith('foo', handler1);
      expect(emitter.listenerCount('foo')).toBe(2);
    });

    it('should convert to single storage when only one listener remains', () => {
      const emitter = new EventEmitter<TestEvents>();
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      emitter.on('foo', handler1);
      emitter.on('foo', handler2);
      emitter.off('foo', handler2);
      expect(emitter.listenerCount('foo')).toBe(1);
      emitter.emit('foo', 42);
      expect(handler1).toHaveBeenCalledTimes(1);
    });

    it('should handle symbol events', () => {
      const sym = Symbol('test');
      type SymEvents = {[sym]: [number]};
      const symEmitter = new EventEmitter<SymEvents>();
      const handler = vi.fn();
      symEmitter.on(sym, handler);
      symEmitter.emit(sym, 42);
      expect(handler).toHaveBeenCalledWith(42);
    });

    it('should handle many arguments (more than 3)', () => {
      type ManyArgs = {event: [number, string, boolean, object, number[]]};
      const manyEmitter = new EventEmitter<ManyArgs>();
      const handler = vi.fn();
      manyEmitter.on('event', handler);
      const obj = {a: 1};
      const arr = [1, 2, 3];
      manyEmitter.emit('event', 1, 'test', true, obj, arr);
      expect(handler).toHaveBeenCalledWith(1, 'test', true, obj, arr);
    });

    it('should return this for method chaining', () => {
      const emitter = new EventEmitter<TestEvents>();
      const handler = vi.fn();
      const result = emitter.on('foo', handler);
      expect(result).toBe(emitter);
      const result2 = emitter.off('foo', handler);
      expect(result2).toBe(emitter);
      const result3 = emitter.once('foo', handler);
      expect(result3).toBe(emitter);
      const result4 = emitter.prependListener('foo', handler);
      expect(result4).toBe(emitter);
      const result5 = emitter.removeAllListeners();
      expect(result5).toBe(emitter);
    });

    it('should handle once wrapper removal via off with original callback', () => {
      const emitter = new EventEmitter<TestEvents>();
      const handler = vi.fn();
      emitter.once('foo', handler);
      emitter.off('foo', handler);
      emitter.emit('foo', 42);
      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle prependOnceListener wrapper removal', () => {
      const emitter = new EventEmitter<TestEvents>();
      const handler = vi.fn();
      emitter.prependOnceListener('foo', handler);
      emitter.off('foo', handler);
      emitter.emit('foo', 42);
      expect(handler).not.toHaveBeenCalled();
    });

    it('should remove prependListener from list storage', () => {
      const emitter = new EventEmitter<TestEvents>();
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      emitter.on('foo', handler1);
      emitter.prependListener('foo', handler2);
      expect(emitter.listenerCount('foo')).toBe(2);
      emitter.off('foo', handler2);
      expect(emitter.listenerCount('foo')).toBe(1);
      emitter.emit('foo', 42);
      expect(handler1).toHaveBeenCalledWith(42);
      expect(handler2).not.toHaveBeenCalled();
    });

    it('should remove prependOnceListener from list storage via original callback', () => {
      const emitter = new EventEmitter<TestEvents>();
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      emitter.on('foo', handler1);
      emitter.prependOnceListener('foo', handler2);
      expect(emitter.listenerCount('foo')).toBe(2);
      emitter.off('foo', handler2);
      expect(emitter.listenerCount('foo')).toBe(1);
      emitter.emit('foo', 42);
      expect(handler1).toHaveBeenCalledWith(42);
      expect(handler2).not.toHaveBeenCalled();
    });

    it('should remove second prependListener from list with multiple prepends', () => {
      const emitter = new EventEmitter<TestEvents>();
      const prepend_handler1 = vi.fn();
      const prepend_handler2 = vi.fn();
      const normal_handler = vi.fn();
      emitter.prependListener('foo', prepend_handler1);
      emitter.prependListener('foo', prepend_handler2);
      emitter.on('foo', normal_handler);
      expect(emitter.listenerCount('foo')).toBe(3);
      emitter.off('foo', prepend_handler1);
      expect(emitter.listenerCount('foo')).toBe(2);
      emitter.emit('foo', 42);
      expect(prepend_handler1).not.toHaveBeenCalled();
      expect(prepend_handler2).toHaveBeenCalledWith(42);
      expect(normal_handler).toHaveBeenCalledWith(42);
    });

    it('should handle event already deleted in process_removal', () => {
      const emitter = new EventEmitter<TestEvents>();
      const foo_handler = vi.fn();
      const bar_handler = vi.fn();
      emitter.on('foo', foo_handler);
      emitter.on('bar', bar_handler);
      emitter.on('removeListener', (event) => {
        if (event === 'foo') {
          emitter.removeAllListeners('bar');
        }
      });
      emitter.removeAllListeners();
      expect(emitter.listenerCount('foo')).toBe(0);
      expect(emitter.listenerCount('bar')).toBe(0);
    });

    it('should handle ListenerList storage in process_removal during removeAllListeners', () => {
      const emitter = new EventEmitter<TestEvents>();
      const prepend_handler = vi.fn();
      const normal_handler1 = vi.fn();
      const normal_handler2 = vi.fn();
      emitter.prependListener('foo', prepend_handler);
      emitter.on('foo', normal_handler1);
      emitter.on('foo', normal_handler2);
      emitter.on('removeListener', () => {});
      emitter.removeAllListeners();
      expect(emitter.listenerCount('foo')).toBe(0);
    });

    it('should handle callback not found in normal array during process_removal', () => {
      const emitter = new EventEmitter<TestEvents>();
      const prepend_handler = vi.fn();
      const normal_handler = vi.fn();
      emitter.prependListener('foo', prepend_handler);
      emitter.on('foo', normal_handler);
      emitter.on('removeListener', () => {
        emitter.removeAllListeners('foo');
      });
      emitter.removeAllListeners();
      expect(emitter.listenerCount('foo')).toBe(0);
    });

    it('should emit newListener when adding newListener via prependListener', () => {
      const emitter = new EventEmitter<TestEvents>();
      const newListenerHandler = vi.fn();
      emitter.on('newListener', newListenerHandler);
      emitter.prependListener('newListener', () => {});
      expect(newListenerHandler).toHaveBeenCalledTimes(1);
    });

    it('should handle removeAllListeners for non-existent event during emit', () => {
      const emitter = new EventEmitter<TestEvents>();
      const handler = vi.fn();
      emitter.on('foo', () => {
        emitter.removeAllListeners('bar');
      });
      emitter.on('foo', handler);
      emitter.emit('foo', 42);
      expect(handler).toHaveBeenCalled();
    });

    it('should not delete single-function storage when callback does not match in process_removal', () => {
      const emitter = new EventEmitter<TestEvents>();
      const foo_handler = vi.fn();
      const bar_handler = vi.fn();
      emitter.on('foo', foo_handler);
      emitter.on('bar', bar_handler);
      const wrong_handler = vi.fn();
      emitter.on('removeListener', (event) => {
        if (event === 'foo') {
          emitter.removeAllListeners('bar');
        }
      });
      emitter.on('removeListener', () => {
        emitter.off('foo', wrong_handler);
      });
      emitter.removeAllListeners();
      expect(emitter.listenerCount('foo')).toBe(0);
    });

    it('should handle single-function storage with mismatched callback in process_removal', () => {
      const emitter = new EventEmitter<TestEvents>();
      const foo_handler = vi.fn();
      const bar_handler = vi.fn();
      const wrong_handler = vi.fn();
      emitter.on('foo', foo_handler);
      emitter.on('bar', bar_handler);
      let remove_count = 0;
      emitter.on('removeListener', () => {
        remove_count++;
        if (remove_count === 1) {
          emitter.off('foo', wrong_handler);
        }
      });
      emitter.removeAllListeners();
      expect(emitter.listenerCount('foo')).toBe(0);
    });

    it('should handle ListenerList with callback not in normal array in process_removal', () => {
      const emitter = new EventEmitter<TestEvents>();
      const prepend_handler = vi.fn();
      const normal_handler = vi.fn();
      const wrong_handler = vi.fn();
      emitter.prependListener('foo', prepend_handler);
      emitter.on('foo', normal_handler);
      let remove_count = 0;
      emitter.on('removeListener', (event) => {
        remove_count++;
        if (remove_count === 1 && event === 'foo') {
          emitter.off('foo', wrong_handler);
        }
      });
      emitter.removeAllListeners();
      expect(emitter.listenerCount('foo')).toBe(0);
    });

    it('should remove listeners added during removeAllListeners', () => {
      const emitter = new EventEmitter<TestEvents>();
      const foo_handler = vi.fn();
      const bar_handler = vi.fn();
      const new_handler = vi.fn();
      emitter.on('foo', foo_handler);
      emitter.on('bar', bar_handler);
      emitter.on('removeListener', (event) => {
        if (event === 'foo') {
          emitter.removeAllListeners('foo');
          emitter.on('foo', new_handler);
        }
      });
      emitter.removeAllListeners();
      expect(emitter.listenerCount('foo')).toBe(0);
    });

    it('should handle ListenerList normal array changed before process_removal', () => {
      const emitter = new EventEmitter<TestEvents>();
      const prepend_handler = vi.fn();
      const normal_handler1 = vi.fn();
      const normal_handler2 = vi.fn();
      emitter.prependListener('foo', prepend_handler);
      emitter.on('foo', normal_handler1);
      emitter.on('foo', normal_handler2);
      emitter.on('removeListener', (event, callback) => {
        if (event === 'foo' && callback === prepend_handler) {
          emitter.removeAllListeners('foo');
        }
      });
      emitter.removeAllListeners();
      expect(emitter.listenerCount('foo')).toBe(0);
    });

    it('should remove listeners added during removeAllListeners (bar triggers)', () => {
      const emitter = new EventEmitter<TestEvents>();
      const foo_handler = vi.fn();
      const bar_handler = vi.fn();
      const new_handler = vi.fn();
      emitter.on('foo', foo_handler);
      emitter.on('bar', bar_handler);
      emitter.on('removeListener', (event) => {
        if (event === 'bar') {
          emitter.removeAllListeners('foo');
          emitter.on('foo', new_handler);
        }
      });
      emitter.removeAllListeners();
      expect(emitter.listenerCount('foo')).toBe(0);
    });

    it('should handle ListenerList callback already removed from normal array', () => {
      const emitter = new EventEmitter<TestEvents>();
      const prepend_handler = vi.fn();
      const normal_handler = vi.fn();
      emitter.prependListener('foo', prepend_handler);
      emitter.on('foo', normal_handler);
      emitter.on('removeListener', (event, callback) => {
        if (event === 'foo' && callback === prepend_handler) {
          emitter.removeAllListeners('foo');
        }
      });
      emitter.removeAllListeners();
      expect(emitter.listenerCount('foo')).toBe(0);
    });

    it('should remove listeners added during removeAllListeners (bar before foo)', () => {
      const emitter = new EventEmitter<TestEvents>();
      const foo_handler = vi.fn();
      const bar_handler = vi.fn();
      const new_foo_handler = vi.fn();
      emitter.on('bar', bar_handler);
      emitter.on('foo', foo_handler);
      emitter.on('removeListener', (event) => {
        if (event === 'bar') {
          emitter.removeAllListeners('foo');
          emitter.on('foo', new_foo_handler);
        }
      });
      emitter.removeAllListeners();
      expect(emitter.listenerCount('foo')).toBe(0);
    });

    it('should handle callback not found in normal after prepend removal', () => {
      const emitter = new EventEmitter<TestEvents>();
      const prepend_handler = vi.fn();
      const normal_handler = vi.fn();
      const other_handler = vi.fn();
      emitter.on('bar', other_handler);
      emitter.prependListener('foo', prepend_handler);
      emitter.on('foo', normal_handler);
      emitter.on('removeListener', (event) => {
        if (event === 'bar') {
          emitter.removeAllListeners('foo');
        }
      });
      emitter.removeAllListeners();
      expect(emitter.listenerCount('foo')).toBe(0);
    });

    it('should handle callback not in prepend or normal arrays', () => {
      const emitter = new EventEmitter<TestEvents>();
      const prepend_handler = vi.fn();
      const normal_handler = vi.fn();
      const removeListener_handler = vi.fn();
      emitter.on('removeListener', removeListener_handler);
      emitter.prependListener('foo', prepend_handler);
      emitter.on('foo', normal_handler);
      let call_count = 0;
      emitter.on('removeListener', (event) => {
        call_count++;
        if (call_count === 1 && event === 'removeListener') {
          emitter.removeAllListeners('foo');
        }
      });
      emitter.removeAllListeners();
      expect(emitter.listenerCount('foo')).toBe(0);
    });

    it('should handle normal callback removed during prepend processing', () => {
      const emitter = new EventEmitter<TestEvents>();
      const prepend_handler = vi.fn();
      const normal_handler = vi.fn();
      emitter.prependListener('foo', prepend_handler);
      emitter.on('foo', normal_handler);
      emitter.on('removeListener', (event, callback) => {
        if (event === 'foo' && callback === prepend_handler) {
          emitter.off('foo', normal_handler);
        }
      });
      emitter.removeAllListeners();
      expect(emitter.listenerCount('foo')).toBe(0);
    });

    it('should emit removeListener for ListenerList storage added during removeAllListeners', () => {
      const emitter = new EventEmitter<TestEvents>();
      const prependHandler = vi.fn();
      const normalHandler = vi.fn();
      emitter.on('removeListener', (event) => {
        if (event === 'foo') {
          // 先添加 normal，再添加 prepend，确保 prepend 数组非空
          emitter.on('bar', normalHandler);
          emitter.prependListener('bar', prependHandler);
        }
      });
      emitter.on('foo', () => {});
      emitter.removeAllListeners();
      expect(emitter.listenerCount('bar')).toBe(0);
    });

    it('should NOT call handler added during removeAllListeners', () => {
      const emitter = new EventEmitter<TestEvents>();
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      emitter.on('removeListener', handler1);
      emitter.on('foo', () => {});

      // 在回调中搞事情
      emitter.on('removeListener', (event_name) => {
        if (event_name === 'foo') {
          emitter.on('removeListener', handler2); // 偷偷塞入
        }
      });

      emitter.removeAllListeners();

      expect(handler2).not.toHaveBeenCalled();
    });

    it('should emit newListener recursively when adding listener in newListener callback', () => {
      const emitter = new EventEmitter<TestEvents>();
      const events: (string | symbol)[] = [];
      emitter.on('newListener', (event) => {
        events.push(event);
        if (event === 'foo') {
          emitter.on('bar', () => {});
        }
      });
      emitter.on('foo', () => {});
      expect(events).toEqual(['foo', 'bar']);
    });

    it('should emit newListener recursively when prepending listener in newListener callback', () => {
      const emitter = new EventEmitter<TestEvents>();
      const events: (string | symbol)[] = [];
      emitter.on('newListener', (event) => {
        events.push(event);
        if (event === 'foo') {
          // 在 newListener 回调中调用 prependListener，此时 emitting_newListener 为 true
          emitter.prependListener('bar', () => {});
        }
      });
      // 添加 foo 监听器，会触发 newListener 事件
      emitter.on('foo', () => {});
      expect(events).toEqual(['foo', 'bar']);
    });

    it('should NOT emit removeListener recursively when removing listener in removeListener callback', () => {
      const emitter = new EventEmitter<TestEvents>();
      const removeListenerCalls: (string | symbol)[] = [];
      emitter.on('removeListener', (event) => {
        removeListenerCalls.push(event);
        if (event === 'foo') {
          emitter.off('bar', barHandler);
        }
      });
      const fooHandler = () => {};
      const barHandler = () => {};
      emitter.on('foo', fooHandler);
      emitter.on('bar', barHandler);
      emitter.off('foo', fooHandler);
      expect(removeListenerCalls).toEqual(['foo', 'bar']);
    });

    it('should cover removeFromList prepend false branch with once wrapper', () => {
      const emitter = new EventEmitter<TestEvents>();
      const once_handler1 = vi.fn();
      const once_handler2 = vi.fn();
      const normal_handler = vi.fn();
      emitter.prependOnceListener('foo', once_handler1);
      emitter.prependOnceListener('foo', once_handler2);
      emitter.on('foo', normal_handler);
      emitter.off('foo', once_handler1);
      expect(emitter.listenerCount('foo')).toBe(2);
      emitter.emit('foo', 42);
      expect(once_handler1).not.toHaveBeenCalled();
      expect(once_handler2).toHaveBeenCalledTimes(1);
      expect(normal_handler).toHaveBeenCalledTimes(1);
    });

    it('should cover removeFromList prepend loop false branch with multiple prepends', () => {
      const emitter = new EventEmitter<TestEvents>();
      const prepend1 = vi.fn();
      const prepend2 = vi.fn();
      const prepend3 = vi.fn();
      emitter.prependListener('foo', prepend1);
      emitter.prependListener('foo', prepend2);
      emitter.prependListener('foo', prepend3);
      // 存储结构: {prepend: [prepend2, prepend3], normal: [prepend1]}
      // 从后向前遍历 prepend: prepend3, prepend2
      // 移除 prepend2，需要先遍历 prepend3（触发 false 分支）
      emitter.off('foo', prepend2);
      expect(emitter.listenerCount('foo')).toBe(2);
    });

    it('should throw error when all error listeners in ListenerList are pending removal', () => {
      const emitter = new EventEmitter<TestEvents>();
      const error1 = vi.fn();
      const error2 = vi.fn();
      emitter.on('error', error1);
      emitter.on('error', error2);
      emitter.on('foo', () => {});
      emitter.on('foo', () => {
        emitter.off('error', error1);
        emitter.off('error', error2);
        throw new Error('all errors pending');
      });
      expect(() => emitter.emit('foo', 42)).toThrow('all errors pending');
      expect(error1).not.toHaveBeenCalled();
      expect(error2).not.toHaveBeenCalled();
    });

    it('should handle duplicate pending removals in flushPendingOperations', () => {
      const emitter = new EventEmitter<TestEvents>();
      const handler = vi.fn();
      emitter.on('foo', handler);
      emitter.on('bar', () => {
        emitter.off('foo', handler);
        emitter.off('foo', handler);
      });
      emitter.on('bar', () => {});
      emitter.emit('bar', 'test', true);
      expect(emitter.listenerCount('foo')).toBe(0);
    });

    it('should handle duplicate pending removals with prepend listener', () => {
      const emitter = new EventEmitter<TestEvents>();
      const prepend_handler = vi.fn();
      const normal_handler = vi.fn();
      emitter.prependListener('foo', prepend_handler);
      emitter.on('foo', normal_handler);
      emitter.on('bar', () => {
        emitter.off('foo', prepend_handler);
        emitter.off('foo', prepend_handler);
      });
      emitter.on('bar', () => {});
      emitter.emit('bar', 'test', true);
      expect(emitter.listenerCount('foo')).toBe(1);
    });

    it('should handle pending removal already processed in flushPendingOperations', () => {
      const emitter = new EventEmitter<TestEvents>();
      const prepend_handler = vi.fn();
      const normal_handler1 = vi.fn();
      const normal_handler2 = vi.fn();
      // 创建 ListenerList 存储，有多个监听器确保处理后仍是 ListenerList
      emitter.prependListener('foo', prepend_handler);
      emitter.on('foo', normal_handler1);
      emitter.on('foo', normal_handler2);
      emitter.on('bar', () => {});
      emitter.on('bar', () => {
        // 先通过 off 把 prepend_handler 加入 pending_removals
        emitter.off('foo', prepend_handler);
        // 再通过 removeAllListeners 把所有监听器（包括 prepend_handler）加入 pending_removals
        // 这样 pending_removals 中就有两个 prepend_handler
        emitter.removeAllListeners('foo');
      });
      emitter.emit('bar', 'test', true);
      expect(emitter.listenerCount('foo')).toBe(0);
    });

    it('should delete event when last listener removed via pending_removals in ListenerList', () => {
      const emitter = new EventEmitter<TestEvents>();
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      // 创建 ListenerList 存储
      emitter.on('foo', handler1);
      emitter.prependListener('foo', handler2);
      // 在 emit 过程中移除所有监听器，触发 pending_removals
      emitter.on('bar', () => {
        emitter.off('foo', handler1);
        emitter.off('foo', handler2);
      });
      emitter.on('bar', () => {});
      emitter.emit('bar', 'test', true);
      expect(emitter.listenerCount('foo')).toBe(0);
      expect(emitter.eventNames()).not.toContain('foo');
    });

    it('should not delete single-function storage when callback does not match in pending_removals', () => {
      const emitter = new EventEmitter<TestEvents>();
      const handler = vi.fn();
      const wrong_handler = vi.fn();
      emitter.on('foo', handler); // 单函数存储
      // 在 emit 过程中尝试移除不匹配的 callback
      // 覆盖 L317 false 分支: storage !== callback
      emitter.on('bar', () => {
        emitter.off('foo', wrong_handler);
      });
      emitter.on('bar', () => {});
      emitter.emit('bar', 'test', true);
      expect(emitter.listenerCount('foo')).toBe(1);
      emitter.emit('foo', 42);
      expect(handler).toHaveBeenCalledWith(42);
    });

    it('should not delete single-function storage when callback does not match in pending_removals', () => {
      const emitter = new EventEmitter<TestEvents>();
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      // 初始：foo 有两个监听器（ListenerList）
      emitter.on('foo', handler1);
      emitter.on('foo', handler2);

      // 在 removeListener 回调中替换 storage
      let removeListener_count = 0;
      emitter.on('removeListener', (event) => {
        if (event === 'foo') {
          removeListener_count++;
          if (removeListener_count === 1) {
            // 第一次 removeListener（处理 handler1 时触发）
            // 此时 foo 的 storage 是单函数 handler2
            // 我们通过 removeAllListeners + on 替换为 handler3
            emitter.removeAllListeners('foo');
            emitter.on('foo', handler3);
          }
        }
      });

      // 在 emit 过程中调用 removeAllListeners，把 handler1, handler2 加入 pending_removals
      emitter.on('bar', () => {
        emitter.removeAllListeners('foo');
      });
      emitter.on('bar', () => {});

      emitter.emit('bar', 'test', true);

      // 验证最终状态：foo 应该只有 handler3
      expect(emitter.listenerCount('foo')).toBe(1);
      emitter.emit('foo', 42);
      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
      expect(handler3).toHaveBeenCalledWith(42);
    });
  });

  // ============================================
  // emitAsync 方法
  // ============================================
  describe('emitAsync()', () => {
    it('should await all async listeners', async () => {
      const emitter = new EventEmitter<TestEvents>();
      const results: number[] = [];
      emitter.on('foo', async (): Promise<void> => {
        await new Promise((r) => setTimeout(r, 10));
        results.push(1);
      });
      emitter.on('foo', async (): Promise<void> => {
        results.push(2);
      });
      const result = await emitter.emitAsync('foo', 42);
      expect(result).toBe(true);
      expect(results).toEqual([2, 1]);
    });

    it('should return false when listener throws', async () => {
      const emitter = new EventEmitter<TestEvents>();
      const errorHandler = vi.fn();
      emitter.on('error', errorHandler);
      emitter.on('foo', async () => {
        throw new Error('async error');
      });
      const result = await emitter.emitAsync('foo', 42);
      expect(result).toBe(false);
      expect(errorHandler).toHaveBeenCalled();
    });

    it('should return false when no listeners', async () => {
      const emitter = new EventEmitter<TestEvents>();
      const result = await emitter.emitAsync('foo', 42);
      expect(result).toBe(false);
    });

    it('should throw when emitting error event with no listeners', async () => {
      const emitter = new EventEmitter<TestEvents>();
      await expect(
        emitter.emitAsync('error', new Error('test')),
      ).rejects.toThrow('test');
    });

    it('should handle mixed sync and async listeners', async () => {
      const emitter = new EventEmitter<TestEvents>();
      const results: number[] = [];
      emitter.on('foo', () => results.push(1));
      emitter.on('foo', async () => {
        await new Promise((r) => setTimeout(r, 5));
        results.push(2);
      });
      emitter.on('foo', () => results.push(3));
      await emitter.emitAsync('foo', 42);
      expect(results).toContain(1);
      expect(results).toContain(2);
      expect(results).toContain(3);
    });

    it('should handle error in error handler during emitAsync', async () => {
      const emitter = new EventEmitter<TestEvents>();
      emitter.on('error', async () => {
        throw new Error('error handler failed');
      });
      emitter.on('foo', async () => {
        throw new Error('original error');
      });
      await expect(emitter.emitAsync('foo', 42)).rejects.toThrow(
        'error handler failed',
      );
    });

    it('should throw error when no error listeners during emitAsync', async () => {
      const emitter = new EventEmitter<TestEvents>();
      emitter.on('foo', async () => {
        throw new Error('no error handler');
      });
      await expect(emitter.emitAsync('foo', 42)).rejects.toThrow(
        'no error handler',
      );
    });

    it('should handle multiple error listeners in emitAsync', async () => {
      const emitter = new EventEmitter<TestEvents>();
      const error1 = vi.fn();
      const error2 = vi.fn();
      emitter.on('error', error1);
      emitter.on('error', error2);
      emitter.on('foo', async () => {
        throw new Error('test');
      });
      const result = await emitter.emitAsync('foo', 42);
      expect(result).toBe(false);
      expect(error1).toHaveBeenCalled();
      expect(error2).toHaveBeenCalled();
    });

    it('should push error directly when emitting error event and listener throws', async () => {
      const emitter = new EventEmitter<TestEvents>();
      emitter.on('error', async () => {
        throw new Error('error listener failed');
      });
      await expect(
        emitter.emitAsync('error', new Error('original')),
      ).rejects.toThrow('error listener failed');
    });

    it('should throw AggregateError when multiple listeners throw errors', async () => {
      const emitter = new EventEmitter<TestEvents>();
      emitter.on('foo', async () => {
        throw new Error('error1');
      });
      emitter.on('foo', async () => {
        throw new Error('error2');
      });
      await expect(emitter.emitAsync('foo', 42)).rejects.toSatisfy(
        (e) => e instanceof AggregateError && e.errors.length === 2,
      );
    });

    it('should return original error when error listeners array is empty', async () => {
      const emitter = new EventEmitter<TestEvents>();
      const handler = vi.fn();
      emitter.on('error', handler);
      emitter.off('error', handler);
      emitter.on('foo', async () => {
        throw new Error('no handlers');
      });
      await expect(emitter.emitAsync('foo', 42)).rejects.toThrow('no handlers');
    });
  });

  // ============================================
  // waitFor 方法
  // ============================================
  describe('waitFor()', () => {
    it('should resolve when event is emitted', async () => {
      const emitter = new EventEmitter<TestEvents>();
      const promise = emitter.waitFor('foo');
      emitter.emit('foo', 42);
      const args = await promise;
      expect(args).toEqual([42]);
    });

    it('should resolve with multiple arguments', async () => {
      const emitter = new EventEmitter<TestEvents>();
      const promise = emitter.waitFor('bar');
      emitter.emit('bar', 'hello', true);
      const args = await promise;
      expect(args).toEqual(['hello', true]);
    });

    it('should reject on timeout', async () => {
      const emitter = new EventEmitter<TestEvents>();
      const promise = emitter.waitFor('foo', {timeout: 10});
      await expect(promise).rejects.toThrow('Timeout waiting for event "foo"');
    });

    it('should resolve with filter', async () => {
      const emitter = new EventEmitter<TestEvents>();
      const promise = emitter.waitFor('foo', {
        filter: (n) => n > 50,
      });
      emitter.emit('foo', 30);
      emitter.emit('foo', 60);
      const args = await promise;
      expect(args).toEqual([60]);
    });

    it('should clean up listener after resolve', async () => {
      const emitter = new EventEmitter<TestEvents>();
      const promise = emitter.waitFor('foo');
      emitter.emit('foo', 42);
      await promise;
      expect(emitter.listenerCount('foo')).toBe(0);
    });

    it('should clean up listener on timeout', async () => {
      const emitter = new EventEmitter<TestEvents>();
      const promise = emitter.waitFor('foo', {timeout: 10});
      await expect(promise).rejects.toThrow();
      expect(emitter.listenerCount('foo')).toBe(0);
    });

    it('should clean up timeout on resolve', async () => {
      const emitter = new EventEmitter<TestEvents>();
      const promise = emitter.waitFor('foo', {timeout: 1000});
      emitter.emit('foo', 42);
      const args = await promise;
      expect(args).toEqual([42]);
    });

    it('should handle zero arguments event', async () => {
      const emitter = new EventEmitter<TestEvents>();
      const promise = emitter.waitFor('baz');
      emitter.emit('baz');
      const args = await promise;
      expect(args).toEqual([]);
    });

    // -- AbortSignal 测试 --
    it('should reject immediately when signal is already aborted', async () => {
      const emitter = new EventEmitter<TestEvents>();
      const controller = new AbortController();
      controller.abort(new Error('already aborted'));

      const promise = emitter.waitFor('foo', {signal: controller.signal});
      await expect(promise).rejects.toThrow('already aborted');
      expect(emitter.listenerCount('foo')).toBe(0);
    });

    it('should reject and clean up when signal aborts', async () => {
      const emitter = new EventEmitter<TestEvents>();
      const controller = new AbortController();

      const promise = emitter.waitFor('foo', {signal: controller.signal});
      expect(emitter.listenerCount('foo')).toBe(1);

      controller.abort(new Error('aborted'));
      await expect(promise).rejects.toThrow('aborted');
      expect(emitter.listenerCount('foo')).toBe(0);
    });

    it('should clean up timeout when signal aborts', async () => {
      const emitter = new EventEmitter<TestEvents>();
      const controller = new AbortController();

      const promise = emitter.waitFor('foo', {
        timeout: 10000,
        signal: controller.signal,
      });

      controller.abort();
      await expect(promise).rejects.toThrow();
    });

    it('should clean up abort listener when event resolves', async () => {
      const emitter = new EventEmitter<TestEvents>();
      const controller = new AbortController();
      const abortSpy = vi.fn();

      controller.signal.addEventListener('abort', abortSpy);

      const promise = emitter.waitFor('foo', {signal: controller.signal});
      emitter.emit('foo', 42);
      await promise;

      controller.abort();
      expect(abortSpy).toHaveBeenCalledTimes(1);
    });

    it('should clean up abort listener on timeout', async () => {
      const emitter = new EventEmitter<TestEvents>();
      const controller = new AbortController();
      const abortSpy = vi.fn();

      controller.signal.addEventListener('abort', abortSpy);

      const promise = emitter.waitFor('foo', {
        timeout: 10,
        signal: controller.signal,
      });
      await expect(promise).rejects.toThrow();

      controller.abort();
      expect(abortSpy).toHaveBeenCalledTimes(1);
    });

    it('should work with filter and signal', async () => {
      const emitter = new EventEmitter<TestEvents>();
      const controller = new AbortController();

      const promise = emitter.waitFor('foo', {
        filter: (n) => n > 50,
        signal: controller.signal,
      });

      emitter.emit('foo', 30);
      expect(emitter.listenerCount('foo')).toBe(1);

      controller.abort();
      await expect(promise).rejects.toThrow();
    });
  });

  // ============================================
  // onceAsync 方法
  // ============================================
  describe('onceAsync()', () => {
    it('should resolve when event is emitted once', async () => {
      const emitter = new EventEmitter<TestEvents>();
      const promise = emitter.onceAsync('foo');
      emitter.emit('foo', 42);
      const args = await promise;
      expect(args).toEqual([42]);
    });

    it('should reject on timeout', async () => {
      const emitter = new EventEmitter<TestEvents>();
      const promise = emitter.onceAsync('foo', {timeout: 10});
      await expect(promise).rejects.toThrow('Timeout waiting for event "foo"');
    });

    it('should only listen once', async () => {
      const emitter = new EventEmitter<TestEvents>();
      const promise = emitter.onceAsync('foo');
      emitter.emit('foo', 1);
      emitter.emit('foo', 2);
      const args = await promise;
      expect(args).toEqual([1]);
      expect(emitter.listenerCount('foo')).toBe(0);
    });

    it('should work with multiple arguments', async () => {
      const emitter = new EventEmitter<TestEvents>();
      const promise = emitter.onceAsync('bar');
      emitter.emit('bar', 'test', false);
      const args = await promise;
      expect(args).toEqual(['test', false]);
    });

    // -- AbortSignal 测试 --
    it('should reject immediately when signal is already aborted', async () => {
      const emitter = new EventEmitter<TestEvents>();
      const controller = new AbortController();
      controller.abort(new Error('already aborted'));

      const promise = emitter.onceAsync('foo', {signal: controller.signal});
      await expect(promise).rejects.toThrow('already aborted');
    });

    it('should reject when signal aborts', async () => {
      const emitter = new EventEmitter<TestEvents>();
      const controller = new AbortController();

      const promise = emitter.onceAsync('foo', {signal: controller.signal});
      controller.abort(new Error('aborted'));
      await expect(promise).rejects.toThrow('aborted');
    });

    it('should work with timeout and signal', async () => {
      const emitter = new EventEmitter<TestEvents>();
      const controller = new AbortController();

      const promise = emitter.onceAsync('foo', {
        timeout: 10000,
        signal: controller.signal,
      });
      controller.abort();
      await expect(promise).rejects.toThrow();
    });
  });
});
