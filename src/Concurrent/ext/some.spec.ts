import {describe, it, expect, vi} from 'vitest';
import {asyncAny, asyncEvery, asyncSome} from './some';
import {ParameterError} from '../../Errors';
import {sleep} from '../delay';

describe.concurrent('asyncEvery & asyncSome & asyncAny', () => {
  // ============================================
  // Shared Helpers
  // ============================================
  const invalidConcurrencyValues = [-1, 1.5, 0];
  const validConcurrencyValues = [1, Infinity];

  // ============================================
  // asyncEvery Tests
  // ============================================
  describe('asyncEvery', () => {
    describe('parameter validation', () => {
      it('should throw ParameterError for invalid concurrency values', async () => {
        for (const value of invalidConcurrencyValues) {
          await expect(
            asyncEvery([Promise.resolve(1)], () => true, {concurrency: value}),
          ).rejects.toThrow(ParameterError);
        }
      });

      it('should accept valid concurrency values', async () => {
        for (const value of validConcurrencyValues) {
          await expect(
            asyncEvery([Promise.resolve(1)], () => true, {concurrency: value}),
          ).resolves.toBe(true);
        }
      });

      it('should throw when signal is already aborted', async () => {
        const controller = new AbortController();
        controller.abort();
        await expect(
          asyncEvery([Promise.resolve(1)], () => true, {
            signal: controller.signal,
          }),
        ).rejects.toThrow();
      });
    });

    describe('basic functionality', () => {
      it('should return true for empty array', async () => {
        expect(await asyncEvery([], () => true)).toBe(true);
      });

      it('should return true when all elements satisfy predicate', async () => {
        const result = await asyncEvery(
          [Promise.resolve(1), Promise.resolve(2), Promise.resolve(3)],
          (n) => n > 0,
        );
        expect(result).toBe(true);
      });

      it('should return false when any element fails predicate', async () => {
        const result = await asyncEvery(
          [Promise.resolve(1), Promise.resolve(-1), Promise.resolve(3)],
          (n) => n > 0,
        );
        expect(result).toBe(false);
      });

      it('should work with async predicate and pass correct index', async () => {
        const indices: number[] = [];
        const result = await asyncEvery(
          [Promise.resolve(1), Promise.resolve(2)],
          async (n, index) => {
            indices.push(index);
            await sleep(1);
            return n > 0;
          },
        );
        expect(result).toBe(true);
        expect(indices).toEqual([0, 1]);
      });

      it('should handle non-array iterable', async () => {
        function* generator() {
          yield Promise.resolve(1);
          yield Promise.resolve(2);
          yield Promise.resolve(3);
        }
        expect(await asyncEvery(generator(), (n) => n > 0)).toBe(true);
      });
    });

    describe('short-circuit behavior', () => {
      it('should short-circuit when predicate returns false', async () => {
        const processed: number[] = [];
        const result = await asyncEvery(
          [Promise.resolve(1), Promise.resolve(2), Promise.resolve(3)],
          async (n) => {
            processed.push(n);
            await sleep(1);
            return n < 2;
          },
        );
        expect(result).toBe(false);
        expect(processed).toContain(1);
        expect(processed).toContain(2);
      });
    });

    describe('concurrency control', () => {
      it('should respect concurrency limit', async () => {
        const concurrency = 2;
        let running = 0;
        let maxRunning = 0;

        await asyncEvery(
          Array.from({length: 5}, (_, i) => Promise.resolve(i)),
          async () => {
            running++;
            maxRunning = Math.max(maxRunning, running);
            await sleep(5);
            running--;
            return true;
          },
          {concurrency},
        );

        expect(maxRunning).toBeLessThanOrEqual(concurrency);
      });
    });

    describe('abort signal', () => {
      it('should abort when signal is triggered during execution', async () => {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), 5);

        await expect(
          asyncEvery(
            Array.from({length: 10}, (_, i) => Promise.resolve(i)),
            async () => {
              await sleep(20);
              return true;
            },
            {signal: controller.signal},
          ),
        ).rejects.toThrow();
      });

      it('should abort during await in worker', async () => {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), 30);

        await expect(
          asyncEvery(
            [
              new Promise<number>((resolve) =>
                setTimeout(() => resolve(1), 50),
              ),
              Promise.resolve(2),
            ],
            () => true,
            {signal: controller.signal},
          ),
        ).rejects.toThrow();
      });

      it('should abort in worker loop when signal is triggered', async () => {
        const controller = new AbortController();

        const promise = asyncEvery(
          [
            Promise.resolve(1),
            new Promise<number>((resolve) => setTimeout(() => resolve(2), 100)),
            Promise.resolve(3),
          ],
          async (n) => {
            if (n === 1) controller.abort();
            await sleep(1);
            return true;
          },
          {signal: controller.signal, concurrency: 1},
        );

        await expect(promise).rejects.toThrow();
      });
    });

    describe('error handling', () => {
      it('should throw error when predicate throws', async () => {
        await expect(
          asyncEvery([Promise.resolve(1), Promise.resolve(2)], () => {
            throw new Error('test error');
          }),
        ).rejects.toThrow('test error');
      });

      it('should throw error when promise rejects', async () => {
        await expect(
          asyncEvery(
            [Promise.resolve(1), Promise.reject(new Error('rejected'))],
            () => true,
          ),
        ).rejects.toThrow('rejected');
      });
    });
  });

  // ============================================
  // asyncSome Tests
  // ============================================
  describe('asyncSome', () => {
    describe('parameter validation', () => {
      it('should throw ParameterError for invalid count values', async () => {
        for (const value of [-1, 1.5, 0]) {
          await expect(
            asyncSome([Promise.resolve(1)], {count: value}),
          ).rejects.toThrow(ParameterError);
        }
      });

      it('should throw ParameterError for invalid concurrency values', async () => {
        for (const value of invalidConcurrencyValues) {
          await expect(
            asyncSome([Promise.resolve(1)], {concurrency: value}),
          ).rejects.toThrow(ParameterError);
        }
      });

      it('should accept valid count and concurrency values', async () => {
        await expect(
          asyncSome([Promise.resolve(1)], {count: 1, concurrency: 1}),
        ).resolves.toEqual([1]);
      });

      it('should throw RangeError when elements.length < count', async () => {
        await expect(
          asyncSome([Promise.resolve(1), Promise.resolve(2)], {count: 3}),
        ).rejects.toThrow(RangeError);
      });

      it('should throw when signal is already aborted', async () => {
        const controller = new AbortController();
        controller.abort();
        await expect(
          asyncSome([Promise.resolve(1)], {signal: controller.signal}),
        ).rejects.toThrow();
      });
    });

    describe('basic functionality', () => {
      it('should return elements by count with default count=1', async () => {
        const result1 = await asyncSome(
          [Promise.resolve(1), Promise.resolve(2), Promise.resolve(3)],
          {},
        );
        expect(result1).toEqual([1]);

        const result2 = await asyncSome(
          [Promise.resolve(1), Promise.resolve(2), Promise.resolve(3)],
          {count: 2},
        );
        expect(result2.length).toBe(2);
      });

      it('should apply filter function with sync and async predicate', async () => {
        const syncResult = await asyncSome(
          [Promise.resolve(1), Promise.resolve(2), Promise.resolve(3)],
          {count: 2, filter: (n) => n > 1},
        );
        expect(syncResult).toEqual([2, 3]);

        const asyncResult = await asyncSome(
          [Promise.resolve(1), Promise.resolve(2), Promise.resolve(3)],
          {
            count: 2,
            filter: async (n) => {
              await sleep(1);
              return n > 1;
            },
          },
        );
        expect(asyncResult).toEqual([2, 3]);
      });

      it('should handle iterable input', async () => {
        function* generator() {
          yield Promise.resolve(1);
          yield Promise.resolve(2);
          yield Promise.resolve(3);
        }
        const result = await asyncSome(generator(), {count: 2});
        expect(result.length).toBe(2);
      });

      it('should filter mixed values correctly', async () => {
        const result = await asyncSome(
          [
            Promise.resolve(1),
            Promise.resolve(2),
            Promise.resolve(3),
            Promise.resolve(4),
          ],
          {count: 2, filter: (n) => n % 2 === 0},
        );
        expect(result).toEqual([2, 4]);
      });
    });

    describe('short-circuit behavior', () => {
      it('should stop when count is reached', async () => {
        const filter = vi.fn(() => true);
        const result = await asyncSome(
          [Promise.resolve(1), Promise.resolve(2), Promise.resolve(3)],
          {count: 2, filter},
        );
        expect(result.length).toBe(2);
        expect(filter).toHaveBeenCalled();
      });

      it('should stop and throw when impossible to reach count', async () => {
        const processed: number[] = [];
        await expect(
          asyncSome(
            [Promise.resolve(1), Promise.resolve(2), Promise.resolve(3)],
            {
              count: 2,
              filter: (n) => {
                processed.push(n);
                return n > 2;
              },
            },
          ),
        ).rejects.toThrow(AggregateError);
        expect(processed).toEqual([1, 2, 3]);
      });
    });

    describe('concurrency control', () => {
      it('should respect concurrency limit', async () => {
        const concurrency = 2;
        let running = 0;
        let maxRunning = 0;

        await asyncSome(
          Array.from({length: 5}, (_, i) => Promise.resolve(i)),
          {
            count: 5,
            filter: async () => {
              running++;
              maxRunning = Math.max(maxRunning, running);
              await sleep(5);
              running--;
              return true;
            },
            concurrency,
          },
        );

        expect(maxRunning).toBeLessThanOrEqual(concurrency);
      });
    });

    describe('abort signal', () => {
      it('should abort when signal is triggered during execution', async () => {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), 5);

        await expect(
          asyncSome(
            Array.from({length: 10}, (_, i) => Promise.resolve(i)),
            {
              count: 10,
              filter: async () => {
                await sleep(10);
                return true;
              },
              signal: controller.signal,
            },
          ),
        ).rejects.toThrow();
      });

      it('should abort during await in worker', async () => {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), 5);

        await expect(
          asyncSome(
            [
              new Promise<number>((resolve) =>
                setTimeout(() => resolve(1), 20),
              ),
              Promise.resolve(2),
            ],
            {count: 2, filter: () => true, signal: controller.signal},
          ),
        ).rejects.toThrow();
      });

      it('should abort in worker loop when signal is triggered', async () => {
        const controller = new AbortController();

        const promise = asyncSome(
          [
            Promise.resolve(1),
            new Promise<number>((resolve) => setTimeout(() => resolve(2), 20)),
            Promise.resolve(3),
          ],
          {
            count: 3,
            filter: async (n) => {
              if (n === 1) controller.abort();
              await sleep(1);
              return true;
            },
            concurrency: 1,
            signal: controller.signal,
          },
        );

        await expect(promise).rejects.toThrow();
      });
    });

    describe('error handling', () => {
      it('should throw AggregateError when cannot collect enough values', async () => {
        await expect(
          asyncSome([Promise.resolve(1), Promise.resolve(2)], {
            count: 2,
            filter: () => false,
          }),
        ).rejects.toThrow(AggregateError);
      });

      it('should collect errors from rejected promises', async () => {
        try {
          await asyncSome(
            [
              Promise.reject(new Error('error1')),
              Promise.reject(new Error('error2')),
            ],
            {count: 1},
          );
          expect.fail('should have thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(AggregateError);
          if (error instanceof AggregateError) {
            expect(error.errors.length).toBe(2);
          }
        }
      });

      it('should collect errors from filter exceptions', async () => {
        try {
          await asyncSome([Promise.resolve(1), Promise.resolve(2)], {
            count: 1,
            filter: () => {
              throw new Error('filter error');
            },
          });
          expect.fail('should have thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(AggregateError);
          if (error instanceof AggregateError) {
            expect(error.errors.length).toBe(2);
          }
        }
      });

      it('should not collect errors when enough values are already collected', async () => {
        const result = await asyncSome(
          [Promise.resolve(1), Promise.resolve(2), Promise.resolve(3)],
          {
            count: 1,
            filter: async (n) => {
              if (n === 1) {
                await sleep(10);
                return true;
              }
              await sleep(50);
              throw new Error(`error for ${n}`);
            },
            concurrency: 3,
          },
        );
        expect(result).toEqual([1]);
      });
    });
  });

  // ============================================
  // asyncAny Tests
  // ============================================
  describe('asyncAny', () => {
    describe('parameter validation', () => {
      it('should throw ParameterError for invalid concurrency values', async () => {
        for (const value of invalidConcurrencyValues) {
          await expect(
            asyncAny([Promise.resolve(1)], {concurrency: value}),
          ).rejects.toThrow(ParameterError);
        }
      });

      it('should accept valid concurrency values', async () => {
        for (const value of validConcurrencyValues) {
          await expect(
            asyncAny([Promise.resolve(1)], {concurrency: value}),
          ).resolves.toBe(1);
        }
      });

      it('should throw when signal is already aborted', async () => {
        const controller = new AbortController();
        controller.abort();
        await expect(
          asyncAny([Promise.resolve(1)], {signal: controller.signal}),
        ).rejects.toThrow();
      });
    });

    describe('basic functionality', () => {
      it('should throw AggregateError for empty array', async () => {
        await expect(asyncAny([], {})).rejects.toThrow(AggregateError);
      });

      it('should return first element with default filter', async () => {
        const result = await asyncAny([
          Promise.resolve(1),
          Promise.resolve(2),
          Promise.resolve(3),
        ]);
        expect(result).toBe(1);
      });

      it('should return first element that passes filter', async () => {
        const result = await asyncAny(
          [Promise.resolve(1), Promise.resolve(2), Promise.resolve(3)],
          {filter: (n) => n > 1},
        );
        expect(result).toBe(2);
      });

      it('should work with async filter', async () => {
        const result = await asyncAny(
          [Promise.resolve(1), Promise.resolve(2), Promise.resolve(3)],
          {
            filter: async (n) => {
              await sleep(1);
              return n > 1;
            },
          },
        );
        expect(result).toBe(2);
      });

      it('should handle non-array iterable', async () => {
        function* generator() {
          yield Promise.resolve(1);
          yield Promise.resolve(2);
          yield Promise.resolve(3);
        }
        const result = await asyncAny(generator(), {filter: (n) => n > 1});
        expect(result).toBe(2);
      });
    });

    describe('short-circuit behavior', () => {
      it('should short-circuit when element passes filter', async () => {
        const processed: number[] = [];
        const result = await asyncAny(
          [Promise.resolve(1), Promise.resolve(2), Promise.resolve(3)],
          {
            filter: async (n) => {
              processed.push(n);
              await sleep(1);
              return n === 2;
            },
          },
        );
        expect(result).toBe(2);
        expect(processed).toContain(2);
      });

      it('should return first resolved value that passes filter', async () => {
        const result = await asyncAny(
          [
            new Promise<number>((resolve) => setTimeout(() => resolve(1), 20)),
            new Promise<number>((resolve) => setTimeout(() => resolve(2), 10)),
            Promise.resolve(3),
          ],
          {filter: (n) => n > 1},
        );
        expect(result).toBe(3);
      });
    });

    describe('concurrency control', () => {
      it('should respect concurrency limit', async () => {
        const concurrency = 2;
        let running = 0;
        let maxRunning = 0;

        await asyncAny(
          Array.from({length: 5}, (_, i) => Promise.resolve(i)),
          {
            filter: async () => {
              running++;
              maxRunning = Math.max(maxRunning, running);
              await sleep(5);
              running--;
              return false;
            },
            concurrency,
          },
        ).catch(() => {});

        expect(maxRunning).toBeLessThanOrEqual(concurrency);
      });
    });

    describe('abort signal', () => {
      it('should abort when signal is triggered during execution', async () => {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), 5);

        await expect(
          asyncAny(
            Array.from({length: 10}, (_, i) => Promise.resolve(i)),
            {
              filter: async () => {
                await sleep(20);
                return false;
              },
              signal: controller.signal,
            },
          ),
        ).rejects.toThrow();
      });

      it('should abort during await in worker', async () => {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), 5);

        await expect(
          asyncAny(
            [
              new Promise<number>((resolve) =>
                setTimeout(() => resolve(1), 20),
              ),
              Promise.resolve(2),
            ],
            {filter: () => true, signal: controller.signal},
          ),
        ).rejects.toThrow();
      });

      it('should abort in worker loop when signal is triggered', async () => {
        const controller = new AbortController();

        const promise = asyncAny(
          [
            Promise.resolve(1),
            new Promise<number>((resolve) => setTimeout(() => resolve(2), 100)),
            Promise.resolve(3),
          ],
          {
            filter: async (n) => {
              if (n === 1) controller.abort();
              await sleep(1);
              return true;
            },
            concurrency: 1,
            signal: controller.signal,
          },
        );

        await expect(promise).rejects.toThrow();
      });

      it('should abort in worker loop at start of next iteration', async () => {
        const controller = new AbortController();
        let processedCount = 0;

        const promise = asyncAny(
          [
            Promise.resolve(1),
            Promise.resolve(2),
            Promise.resolve(3),
            Promise.resolve(4),
          ],
          {
            filter: async (n) => {
              processedCount++;
              if (n === 2) controller.abort();
              await sleep(10);
              return false;
            },
            concurrency: 2,
            signal: controller.signal,
          },
        );

        await expect(promise).rejects.toThrow();
      });
    });

    describe('error handling', () => {
      it('should throw AggregateError when no elements pass filter', async () => {
        await expect(
          asyncAny([Promise.resolve(1), Promise.resolve(2)], {
            filter: () => false,
          }),
        ).rejects.toThrow(AggregateError);
      });

      it('should throw AggregateError with collected errors when promises reject', async () => {
        try {
          await asyncAny([
            Promise.reject(new Error('error1')),
            Promise.reject(new Error('error2')),
          ]);
          expect.fail('should have thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(AggregateError);
          if (error instanceof AggregateError) {
            expect(error.errors.length).toBe(2);
          }
        }
      });

      it('should collect errors from filter exceptions', async () => {
        try {
          await asyncAny([Promise.resolve(1), Promise.resolve(2)], {
            filter: () => {
              throw new Error('filter error');
            },
          });
          expect.fail('should have thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(AggregateError);
          if (error instanceof AggregateError) {
            expect(error.errors.length).toBe(2);
          }
        }
      });

      it('should not collect errors after result is found', async () => {
        const result = await asyncAny(
          [Promise.resolve(1), Promise.resolve(2), Promise.resolve(3)],
          {
            filter: async (n) => {
              if (n === 1) {
                await sleep(5);
                return true;
              }
              throw new Error(`error for ${n}`);
            },
            concurrency: 3,
          },
        );
        expect(result).toBe(1);
      });

      it('should throw first error when all promises reject', async () => {
        await expect(
          asyncAny([
            Promise.reject(new Error('first error')),
            Promise.reject(new Error('second error')),
          ]),
        ).rejects.toThrow(AggregateError);
      });

      it('should not collect errors when is_finished is already true', async () => {
        const result = await asyncAny(
          [Promise.resolve(1), Promise.resolve(2), Promise.resolve(3)],
          {
            filter: async (n) => {
              if (n === 1) return true;
              await sleep(5);
              throw new Error(`error for ${n}`);
            },
            concurrency: 3,
          },
        );
        expect(result).toBe(1);
      });
    });
  });
});
