// ========================================
// ./src/Reactive/flow-combination.spec.ts
// ========================================
import {describe, it, expect, vi, afterAll} from 'vitest';
import {Flow, of, fromProducer, type Observer} from './flow';
import {
  mergeFlow,
  concatFlow,
  raceFlow,
  combineLatestFlow,
  withLatestFromFlow,
  forkJoinFlow,
  zipFlow,
} from './flow-combination';
import {
  MockClock,
  withTimelineAsync,
  restoreGlobals,
} from 'src/MockClock/__export__';

afterAll(restoreGlobals);

describe.concurrent('flow-combination', () => {
  // ============================================
  // merge
  // ============================================
  describe('merge', () => {
    it('should merge multiple flows and emit all values', () => {
      const flow1 = of(1, 2);
      const flow2 = of(3, 4);
      const merged = mergeFlow(flow1, flow2);
      const values: number[] = [];
      merged.subscribe((v) => values.push(v));
      expect(values).toEqual([1, 2, 3, 4]);
    });

    it('should complete when all sources complete', () => {
      const flow1 = of(1);
      const flow2 = of(2);
      const merged = mergeFlow(flow1, flow2);
      const completeHandler = vi.fn();
      merged.subscribe({complete: completeHandler});
      expect(completeHandler).toHaveBeenCalledTimes(1);
    });

    it('should propagate error from any source', () => {
      const flow1 = new Flow<number>();
      const flow2 = new Flow<number>();
      const merged = mergeFlow(flow1, flow2);
      const errorHandler = vi.fn();
      merged.subscribe({error: errorHandler});
      const err = new Error('test error');
      flow1.error(err);
      expect(errorHandler).toHaveBeenCalledWith(err);
    });

    it('should unsubscribe from all sources when unsubscribed', () => {
      const flow1 = new Flow<number>();
      const flow2 = new Flow<number>();
      const merged = mergeFlow(flow1, flow2);
      const handler = vi.fn();
      const sub = merged.subscribe(handler);
      flow1.next(1);
      flow2.next(2);
      sub.unsubscribe();
      flow1.next(3);
      flow2.next(4);
      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('should handle single source', () => {
      const flow = of(1, 2, 3);
      const merged = mergeFlow(flow);
      const values: number[] = [];
      merged.subscribe((v) => values.push(v));
      expect(values).toEqual([1, 2, 3]);
    });

    it('should merge values from hot flows concurrently', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const flow1 = fromProducer<number>((dest) => {
          setTimeout(() => dest.next(1), 10);
          setTimeout(() => dest.next(2), 20);
        });
        const flow2 = fromProducer<number>((dest) => {
          setTimeout(() => dest.next(10), 5);
          setTimeout(() => dest.next(20), 15);
        });
        const merged = mergeFlow(flow1, flow2);
        const values: number[] = [];
        merged.subscribe((v) => values.push(v));
        await clock.tickAsync(25);
        expect(values).toEqual([10, 1, 20, 2]);
      });
    });
  });

  // ============================================
  // concat
  // ============================================
  describe('concat', () => {
    it('should concatenate flows in order', () => {
      const flow1 = of(1, 2);
      const flow2 = of(3, 4);
      const concated = concatFlow(flow1, flow2);
      const values: number[] = [];
      concated.subscribe((v) => values.push(v));
      expect(values).toEqual([1, 2, 3, 4]);
    });

    it('should wait for previous flow to complete before subscribing to next', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const flow1 = fromProducer<number>((dest) => {
          setTimeout(() => {
            dest.next(1);
            dest.complete();
          }, 10);
        });
        const flow2 = fromProducer<number>((dest) => {
          dest.next(2);
          dest.complete();
        });
        const concated = concatFlow(flow1, flow2);
        const values: number[] = [];
        concated.subscribe((v) => values.push(v));
        expect(values).toEqual([]);
        await clock.tickAsync(10);
        expect(values).toEqual([1, 2]);
      });
    });

    it('should propagate error from any source', () => {
      const flow1 = new Flow<number>();
      const flow2 = new Flow<number>();
      const concated = concatFlow(flow1, flow2);
      const errorHandler = vi.fn();
      concated.subscribe({error: errorHandler});
      const err = new Error('concat error');
      flow1.error(err);
      expect(errorHandler).toHaveBeenCalledWith(err);
    });

    it('should complete when all sources complete', () => {
      const flow1 = of(1);
      const flow2 = of(2);
      const concated = concatFlow(flow1, flow2);
      const completeHandler = vi.fn();
      concated.subscribe({complete: completeHandler});
      expect(completeHandler).toHaveBeenCalledTimes(1);
    });

    it('should unsubscribe from current source only', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const flow1 = fromProducer((dest) => {
          setTimeout(() => {
            dest.next(1);
            dest.complete();
          }, 5);
        });
        const flow2 = fromProducer((dest) => {
          setTimeout(() => dest.next(2), 10);
        });
        const concated = concatFlow(flow1, flow2);
        const handler = vi.fn();
        const sub = concated.subscribe(handler);
        await clock.tickAsync(5);
        expect(handler).toHaveBeenCalledWith(1);
        sub.unsubscribe();
        await clock.tickAsync(15);
        expect(handler).toHaveBeenCalledTimes(1);
      });
    });

    it('should handle single source', () => {
      const flow = of(1, 2, 3);
      const concated = concatFlow(flow);
      const values: number[] = [];
      concated.subscribe((v) => values.push(v));
      expect(values).toEqual([1, 2, 3]);
    });
  });

  // ============================================
  // race
  // ============================================
  describe('race', () => {
    it('should emit first value and complete', () => {
      const flow1 = of(1);
      const flow2 = of(2);
      const raced = raceFlow(flow1, flow2);
      const values: number[] = [];
      const completeHandler = vi.fn();
      raced.subscribe({
        next: (v) => values.push(v),
        complete: completeHandler,
      });
      expect(values.length).toBe(1);
      expect([1, 2]).toContain(values[0]);
      expect(completeHandler).toHaveBeenCalledTimes(1);
    });

    it('should unsubscribe from all other sources when one emits', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const flow1 = fromProducer<number>((dest) => {
          setTimeout(() => dest.next(1), 10);
        });
        const flow2 = fromProducer<number>((dest) => {
          setTimeout(() => dest.next(2), 5);
        });
        const raced = raceFlow(flow1, flow2);
        const values: number[] = [];
        raced.subscribe((v) => values.push(v));
        await clock.tickAsync(15);
        expect(values).toEqual([2]);
      });
    });

    it('should propagate error from first error source', () => {
      const flow1 = new Flow<number>();
      const flow2 = new Flow<number>();
      const raced = raceFlow(flow1, flow2);
      const errorHandler = vi.fn();
      raced.subscribe({error: errorHandler});
      const err = new Error('race error');
      flow1.error(err);
      expect(errorHandler).toHaveBeenCalledWith(err);
    });

    it('should complete when first source completes without emitting', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const flow1 = fromProducer<number | undefined>((dest) => {
          setTimeout(() => dest.complete(), 5);
        });
        const flow2 = fromProducer<number | undefined>((dest) => {
          setTimeout(() => dest.next(2), 10);
        });
        const raced = raceFlow(flow1, flow2);
        const completeHandler = vi.fn();
        raced.subscribe({complete: completeHandler});
        await clock.tickAsync(15);
        expect(completeHandler).toHaveBeenCalledTimes(1);
      });
    });

    it('should unsubscribe all when unsubscribed externally', () => {
      const flow1 = new Flow<number>();
      const flow2 = new Flow<number>();
      const raced = raceFlow(flow1, flow2);
      const handler = vi.fn();
      const sub = raced.subscribe(handler);
      sub.unsubscribe();
      flow1.next(1);
      flow2.next(2);
      expect(handler).not.toHaveBeenCalled();
    });

    it('should ignore error after first value emitted', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const flow1 = fromProducer<number | undefined>((dest) => {
          setTimeout(() => dest.next(1), 5);
        });
        const flow2 = fromProducer<number | undefined>((dest) => {
          setTimeout(() => dest.error(new Error('late error')), 10);
        });
        const raced = raceFlow(flow1, flow2);
        const errorHandler = vi.fn();
        const completeHandler = vi.fn();
        raced.subscribe({
          error: errorHandler,
          complete: completeHandler,
        });
        await clock.tickAsync(15);
        expect(errorHandler).not.toHaveBeenCalled();
        expect(completeHandler).toHaveBeenCalledTimes(1);
      });
    });

    it('should ignore error after first error emitted', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const flow1 = fromProducer<number | undefined>((dest) => {
          setTimeout(() => dest.error(new Error('first error')), 5);
        });
        const flow2 = fromProducer<number | undefined>((dest) => {
          setTimeout(() => dest.error(new Error('late error')), 10);
        });
        const raced = raceFlow(flow1, flow2);
        const errorHandler = vi.fn();
        raced.subscribe({error: errorHandler});
        await clock.tickAsync(15);
        expect(errorHandler).toHaveBeenCalledTimes(1);
        expect(errorHandler).toHaveBeenCalledWith(new Error('first error'));
      });
    });

    it('should ignore error emitted during unsubscribe', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const flow1 = fromProducer<number>((dest) => {
          const timer = setTimeout(
            () => dest.error(new Error('first error')),
            5,
          );
          return () => clearTimeout(timer);
        });
        const flow2 = fromProducer<number>((dest) => {
          const timer = setTimeout(() => {}, 100);
          return () => {
            clearTimeout(timer);
            dest.error(new Error('error during unsubscribe'));
          };
        });

        const raced = raceFlow(flow1, flow2);
        const errorHandler = vi.fn();
        raced.subscribe({error: errorHandler});

        await clock.tickAsync(10);

        expect(errorHandler).toHaveBeenCalledTimes(1);
        expect(errorHandler).toHaveBeenCalledWith(new Error('first error'));
      });
    });

    it('should ignore error from other source when finished', () => {
      const flow1 = new Flow<number>();
      const flow2 = new Flow<number>();

      const raced = raceFlow(flow1, flow2);
      const errorHandler = vi.fn();

      raced.subscribe({error: errorHandler});

      flow1.error(new Error('first error'));
      flow2.error(new Error('second error'));

      expect(errorHandler).toHaveBeenCalledTimes(1);
      expect(errorHandler).toHaveBeenCalledWith(new Error('first error'));
    });

    it('should ignore error from other source during unsubscribe', () => {
      const flow1 = new Flow<number>();
      let observerRef: Observer<number> | undefined;
      const flow2 = {
        subscribe: (observer: Observer<number>) => {
          observerRef = observer;
          return {
            unsubscribe: () => {
              observerRef?.error?.(new Error('error during unsubscribe'));
            },
            [Symbol.dispose]: () => {},
          };
        },
      };

      const raced = raceFlow(flow1, flow2);
      const errorHandler = vi.fn();

      raced.subscribe({error: errorHandler});

      flow1.error(new Error('first error'));

      expect(errorHandler).toHaveBeenCalledTimes(1);
      expect(errorHandler).toHaveBeenCalledWith(new Error('first error'));
    });
  });

  // ============================================
  // combineLatest
  // ============================================
  describe('combineLatest', () => {
    it('should combine latest values from all sources', () => {
      const flow1 = of(1, 2);
      const flow2 = of(10, 20);
      const combined = combineLatestFlow(flow1, flow2);
      const values: [number, number][] = [];
      combined.subscribe((v) => values.push(v));
      expect(values.length).toBeGreaterThan(0);
      expect(values[values.length - 1]).toEqual([2, 20]);
    });

    it('should not emit until all sources have emitted', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, () => {
        const flow1 = new Flow<number>();
        const flow2 = new Flow<number>();
        const combined = combineLatestFlow(flow1, flow2);
        const values: [number, number][] = [];
        combined.subscribe((v) => values.push(v));
        flow1.next(1);
        expect(values).toEqual([]);
        flow2.next(10);
        expect(values).toEqual([[1, 10]]);
      });
    });

    it('should emit new combination when any source emits', () => {
      const flow1 = new Flow<number>();
      const flow2 = new Flow<number>();
      const combined = combineLatestFlow(flow1, flow2);
      const values: [number, number][] = [];
      combined.subscribe((v) => values.push(v));
      flow1.next(1);
      flow2.next(10);
      flow1.next(2);
      expect(values).toEqual([
        [1, 10],
        [2, 10],
      ]);
    });

    it('should complete when all sources complete', () => {
      const flow1 = of(1);
      const flow2 = of(2);
      const combined = combineLatestFlow(flow1, flow2);
      const completeHandler = vi.fn();
      combined.subscribe({complete: completeHandler});
      expect(completeHandler).toHaveBeenCalledTimes(1);
    });

    it('should propagate error from any source', () => {
      const flow1 = new Flow<number>();
      const flow2 = new Flow<number>();
      const combined = combineLatestFlow(flow1, flow2);
      const errorHandler = vi.fn();
      combined.subscribe({error: errorHandler});
      const err = new Error('combine error');
      flow1.error(err);
      expect(errorHandler).toHaveBeenCalledWith(err);
    });

    it('should handle three or more sources', () => {
      const flow1 = of(1);
      const flow2 = of(2);
      const flow3 = of(3);
      const combined = combineLatestFlow(flow1, flow2, flow3);
      const values: [number, number, number][] = [];
      combined.subscribe((v) => values.push(v));
      expect(values).toEqual([[1, 2, 3]]);
    });

    it('should unsubscribe from all sources', () => {
      const flow1 = new Flow<number>();
      const flow2 = new Flow<number>();
      const combined = combineLatestFlow(flow1, flow2);
      const handler = vi.fn();
      const sub = combined.subscribe(handler);
      sub.unsubscribe();
      flow1.next(1);
      flow2.next(2);
      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // withLatestFrom
  // ============================================
  describe('withLatestFrom', () => {
    it('should combine main source with latest from others', () => {
      const main = new Flow<number>();
      const other = new Flow<string>();
      const combined = withLatestFromFlow(main, other);
      const values: [number, string][] = [];
      combined.subscribe((v) => values.push(v));
      other.next('a');
      main.next(1);
      expect(values).toEqual([[1, 'a']]);
    });

    it('should not emit until all other sources have emitted', () => {
      const main = new Flow<number>();
      const other = new Flow<string>();
      const combined = withLatestFromFlow(main, other);
      const values: [number, string][] = [];
      combined.subscribe((v) => values.push(v));
      main.next(1);
      expect(values).toEqual([]);
      other.next('a');
      main.next(2);
      expect(values).toEqual([[2, 'a']]);
    });

    it('should use latest value from other sources', () => {
      const main = new Flow<number>();
      const other = new Flow<string>();
      const combined = withLatestFromFlow(main, other);
      const values: [number, string][] = [];
      combined.subscribe((v) => values.push(v));
      other.next('a');
      main.next(1);
      other.next('b');
      main.next(2);
      expect(values).toEqual([
        [1, 'a'],
        [2, 'b'],
      ]);
    });

    it('should complete when main source completes', () => {
      const main = new Flow<number>();
      const other = new Flow<string>();
      const combined = withLatestFromFlow(main, other);
      const completeHandler = vi.fn();
      combined.subscribe({complete: completeHandler});
      other.next('a');
      main.complete();
      expect(completeHandler).toHaveBeenCalledTimes(1);
    });

    it('should not complete when other source completes', () => {
      const main = new Flow<number>();
      const other = new Flow<string>();
      const combined = withLatestFromFlow(main, other);
      const completeHandler = vi.fn();
      combined.subscribe({complete: completeHandler});
      other.complete();
      expect(completeHandler).not.toHaveBeenCalled();
    });

    it('should propagate error from any source', () => {
      const main = new Flow<number>();
      const other = new Flow<string>();
      const combined = withLatestFromFlow(main, other);
      const errorHandler = vi.fn();
      combined.subscribe({error: errorHandler});
      const err = new Error('withLatestFrom error');
      other.error(err);
      expect(errorHandler).toHaveBeenCalledWith(err);
    });

    it('should propagate error from main source', () => {
      const main = new Flow<number>();
      const other = new Flow<string>();
      const combined = withLatestFromFlow(main, other);
      const errorHandler = vi.fn();
      combined.subscribe({error: errorHandler});
      other.next('a');
      const err = new Error('main error');
      main.error(err);
      expect(errorHandler).toHaveBeenCalledWith(err);
    });

    it('should handle multiple other sources', () => {
      const main = new Flow<number>();
      const other1 = new Flow<string>();
      const other2 = new Flow<boolean>();
      const combined = withLatestFromFlow(main, other1, other2);
      const values: [number, string, boolean][] = [];
      combined.subscribe((v) => values.push(v));
      other1.next('a');
      other2.next(true);
      main.next(1);
      expect(values).toEqual([[1, 'a', true]]);
    });

    it('should unsubscribe from all sources', () => {
      const main = new Flow<number>();
      const other = new Flow<string>();
      const combined = withLatestFromFlow(main, other);
      const handler = vi.fn();
      const sub = combined.subscribe(handler);
      sub.unsubscribe();
      other.next('a');
      main.next(1);
      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // forkJoin
  // ============================================
  describe('forkJoin', () => {
    it('should emit last values when all sources complete', () => {
      const flow1 = of(1, 2, 3);
      const flow2 = of(10, 20, 30);
      const joined = forkJoinFlow(flow1, flow2);
      const values: [number, number][] = [];
      const completeHandler = vi.fn();
      joined.subscribe({
        next: (v) => values.push(v),
        complete: completeHandler,
      });
      expect(values).toEqual([[3, 30]]);
      expect(completeHandler).toHaveBeenCalledTimes(1);
    });

    it('should complete immediately if any source completes without emitting', () => {
      const flow1 = new Flow<number>();
      const flow2 = new Flow<number>();
      const joined = forkJoinFlow(flow1, flow2);
      const completeHandler = vi.fn();
      const nextHandler = vi.fn();
      joined.subscribe({
        next: nextHandler,
        complete: completeHandler,
      });
      flow1.complete();
      expect(nextHandler).not.toHaveBeenCalled();
      expect(completeHandler).toHaveBeenCalledTimes(1);
    });

    it('should propagate error from any source', () => {
      const flow1 = new Flow<number>();
      const flow2 = new Flow<number>();
      const joined = forkJoinFlow(flow1, flow2);
      const errorHandler = vi.fn();
      joined.subscribe({error: errorHandler});
      const err = new Error('forkJoin error');
      flow1.error(err);
      expect(errorHandler).toHaveBeenCalledWith(err);
    });

    it('should handle three or more sources', () => {
      const flow1 = of(1);
      const flow2 = of(2);
      const flow3 = of(3);
      const joined = forkJoinFlow(flow1, flow2, flow3);
      const values: [number, number, number][] = [];
      joined.subscribe((v) => values.push(v));
      expect(values).toEqual([[1, 2, 3]]);
    });

    it('should wait for all sources to complete', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const flow1 = fromProducer<number>((dest) => {
          setTimeout(() => {
            dest.next(1);
            dest.complete();
          }, 5);
        });
        const flow2 = fromProducer<number>((dest) => {
          setTimeout(() => {
            dest.next(2);
            dest.complete();
          }, 10);
        });
        const joined = forkJoinFlow(flow1, flow2);
        const values: [number, number][] = [];
        const completeHandler = vi.fn();
        joined.subscribe({
          next: (v) => values.push(v),
          complete: completeHandler,
        });
        await clock.tickAsync(5);
        expect(values).toEqual([]);
        expect(completeHandler).not.toHaveBeenCalled();
        await clock.tickAsync(5);
        expect(values).toEqual([[1, 2]]);
        expect(completeHandler).toHaveBeenCalledTimes(1);
      });
    });

    it('should unsubscribe from all sources', () => {
      const flow1 = new Flow<number>();
      const flow2 = new Flow<number>();
      const joined = forkJoinFlow(flow1, flow2);
      const handler = vi.fn();
      const sub = joined.subscribe(handler);
      sub.unsubscribe();
      flow1.next(1);
      flow1.complete();
      flow2.next(2);
      flow2.complete();
      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // zip
  // ============================================
  describe('zip', () => {
    it('should zip values by index', () => {
      const flow1 = of(1, 2, 3);
      const flow2 = of(10, 20, 30);
      const zipped = zipFlow(flow1, flow2);
      const values: [number, number][] = [];
      zipped.subscribe((v) => values.push(v));
      expect(values).toEqual([
        [1, 10],
        [2, 20],
        [3, 30],
      ]);
    });

    it('should complete when shortest source completes', () => {
      const flow1 = of(1, 2);
      const flow2 = of(10, 20, 30);
      const zipped = zipFlow(flow1, flow2);
      const values: [number, number][] = [];
      const completeHandler = vi.fn();
      zipped.subscribe({
        next: (v) => values.push(v),
        complete: completeHandler,
      });
      expect(values).toEqual([
        [1, 10],
        [2, 20],
      ]);
      expect(completeHandler).toHaveBeenCalledTimes(1);
    });

    it('should handle single source', () => {
      const flow = of(1, 2, 3);
      const zipped = zipFlow(flow);
      const values: [number][] = [];
      zipped.subscribe((v) => values.push(v));
      expect(values).toEqual([[1], [2], [3]]);
    });

    it('should propagate error from any source', () => {
      const flow1 = new Flow<number>();
      const flow2 = new Flow<number>();
      const zipped = zipFlow(flow1, flow2);
      const errorHandler = vi.fn();
      zipped.subscribe({error: errorHandler});
      const err = new Error('zip error');
      flow1.error(err);
      expect(errorHandler).toHaveBeenCalledWith(err);
    });

    it('should handle three or more sources', () => {
      const flow1 = of(1, 2);
      const flow2 = of(10, 20);
      const flow3 = of(100, 200);
      const zipped = zipFlow(flow1, flow2, flow3);
      const values: [number, number, number][] = [];
      zipped.subscribe((v) => values.push(v));
      expect(values).toEqual([
        [1, 10, 100],
        [2, 20, 200],
      ]);
    });

    it('should buffer values until all sources have emitted', () => {
      const flow1 = new Flow<number>();
      const flow2 = new Flow<number>();
      const zipped = zipFlow(flow1, flow2);
      const values: [number, number][] = [];
      zipped.subscribe((v) => values.push(v));
      flow1.next(1);
      flow1.next(2);
      expect(values).toEqual([]);
      flow2.next(10);
      expect(values).toEqual([[1, 10]]);
      flow2.next(20);
      expect(values).toEqual([
        [1, 10],
        [2, 20],
      ]);
    });

    it('should complete when one source completes with empty buffer', () => {
      const flow1 = of(1, 2);
      const flow2 = new Flow<number>();
      const zipped = zipFlow(flow1, flow2);
      const values: [number, number][] = [];
      const completeHandler = vi.fn();
      zipped.subscribe({
        next: (v) => values.push(v),
        complete: completeHandler,
      });
      flow2.next(10);
      flow2.complete();
      expect(values).toEqual([[1, 10]]);
      expect(completeHandler).toHaveBeenCalledTimes(1);
    });

    it('should unsubscribe from all sources', () => {
      const flow1 = new Flow<number>();
      const flow2 = new Flow<number>();
      const zipped = zipFlow(flow1, flow2);
      const handler = vi.fn();
      const sub = zipped.subscribe(handler);
      sub.unsubscribe();
      flow1.next(1);
      flow2.next(10);
      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle async emission correctly', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, async () => {
        const flow1 = fromProducer<number>((dest) => {
          setTimeout(() => dest.next(1), 5);
          setTimeout(() => dest.next(2), 15);
          setTimeout(() => dest.complete(), 25);
        });
        const flow2 = fromProducer<number>((dest) => {
          setTimeout(() => dest.next(10), 10);
          setTimeout(() => dest.next(20), 20);
        });
        const zipped = zipFlow(flow1, flow2);
        const values: [number, number][] = [];
        zipped.subscribe((v) => values.push(v));
        await clock.tickAsync(25);
        expect(values).toEqual([
          [1, 10],
          [2, 20],
        ]);
      });
    });

    it('should stop subscribing when dest is closed', async () => {
      const clock = MockClock();
      await withTimelineAsync(clock, () => {
        const flow1 = new Flow<number>();
        const flow2 = new Flow<number>();
        const zipped = zipFlow(flow1, flow2);
        const handler = vi.fn();
        zipped.subscribe(handler);
        flow1.error(new Error('test'));
        flow2.next(10);
        expect(handler).not.toHaveBeenCalled();
      });
    });

    it('should not subscribe remaining sources when dest is closed during forEach', () => {
      const subscribeSpy = vi.fn();
      const flow1 = fromProducer<number>((dest) => {
        dest.error(new Error('immediate error'));
      });
      const flow2 = fromProducer<number>((dest) => {
        subscribeSpy();
        dest.next(2);
      });

      const zipped = zipFlow(flow1, flow2);
      const errorHandler = vi.fn();
      zipped.subscribe({error: errorHandler});

      expect(errorHandler).toHaveBeenCalledWith(new Error('immediate error'));
      expect(subscribeSpy).not.toHaveBeenCalled();
    });
  });
});
