// ========================================
// ./src/Utils/Array/flatten.ts
// ========================================

/**
 * Extracts deepest type from nested array structure.
 * @typeParam T - Input type (possibly nested array).
 * @example
 * // Returns: number
 * type Example = DeepExtract<number[][][]>;
 */
type DeepExtract<T> =
  T extends ReadonlyArray<infer Inner> ? DeepExtract<Inner> : T;

/**
 * Recursively flattens array while **skipping sparse holes** (not converting to undefined).
 * Implementation: Manual stack-based iteration (no recursion risk) + explicit hole skipping.
 * Hole behavior: `i in array` check ensures holes are **completely skipped**
 * Order preserved: DFS with index tracking maintains original element order
 * @param array - Array with arbitrary nesting and possible sparse holes.
 * @returns Fully flattened array with all holes skipped at every nesting level.
 * @example
 * flattenDeep([1, , [2, , [3]]]) // => [1, 2, 3]  (holes at all levels skipped!)
 */
export const flattenDeep = <T>(array: readonly T[]): DeepExtract<T>[] => {
  const result: DeepExtract<T>[] = [];
  const stack: Array<{array: readonly unknown[]; nextIndex: number}> = [
    {array, nextIndex: 0},
  ];

  while (stack.length > 0) {
    const frame = stack[stack.length - 1];
    const {array: current} = frame;

    if (frame.nextIndex >= current.length) {
      stack.pop();
      continue;
    }

    const currentIndex = frame.nextIndex++;

    if (!(currentIndex in current)) {
      continue;
    }

    const element = current[currentIndex];

    if (Array.isArray(element)) {
      stack.push({array: element, nextIndex: 0});
    } else {
      result.push(element as DeepExtract<T>);
    }
  }

  return result;
};

/**
 * Maps each element then fully flattens while **skipping sparse holes**.
 * Hole behavior: Original array holes skipped BEFORE mapping (callback never sees holes)
 * Nested holes: flattenDeep() skips holes in mapped arrays too
 * @param array - Source array (may be sparse).
 * @param callback - Mapping function (receives ONLY existing elements + their real index).
 * @returns Fully flattened mapped array with all holes skipped.
 * @example
 * flatMapDeep([1, , 2], x => [x, , x*10]) // => [1, 10, 2, 20]  (all holes skipped!)
 */
export const flatMapDeep = <T, U>(
  array: readonly T[],
  callback: (item: T, index: number) => U,
): DeepExtract<U>[] => {
  const mapped: DeepExtract<U>[] = [];

  for (let i = 0; i < array.length; i++) {
    if (i in array) {
      const value = callback(array[i], i);
      if (Array.isArray(value)) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        mapped.push(...flattenDeep(value));
      } else {
        mapped.push(value as DeepExtract<U>);
      }
    }
  }

  return mapped;
};

/**
 * Async mapped flattening with concurrency limit + **strict hole skipping**.
 * Hole behavior: ONLY existing indices trigger callback (holes completely ignored)
 * Order preserved: Results inserted at original non-hole positions
 * No wasted work: Zero callbacks for hole positions
 * @param array - Source array (may be sparse).
 * @param callback - Async mapper (called ONLY for existing elements).
 * @param concurrency - Max parallel operations (default: Infinity).
 * @returns Promise of flattened results with all holes skipped.
 * @example
 * await flatMapAsync([1, , 2], async x => [x, , x*10], 2)
 * // => [1, 10, 2, 20]  (no callbacks for holes!)
 */
export const flatMapAsync = async <T, U>(
  array: readonly T[],
  callback: (item: T, index: number) => Promise<U | readonly U[]>,
  concurrency: number = Infinity,
): Promise<U[]> => {
  const existingIndices: number[] = [];
  for (let i = 0; i < array.length; i++) {
    if (i in array) existingIndices.push(i);
  }

  const total = existingIndices.length;
  if (total === 0) return [];

  const safeConcurrency = Math.max(
    1,
    Math.floor(isNaN(concurrency) ? 1 : concurrency),
  );
  const results = new Array<U | readonly U[]>(total);
  let cursor = 0;

  const worker = async () => {
    let pos: number;
    while ((pos = cursor++) < total) {
      const origIdx = existingIndices[pos];
      results[pos] = await callback(array[origIdx], origIdx);
    }
  };

  const workers = Array.from({length: Math.min(safeConcurrency, total)}, () =>
    worker(),
  );
  await Promise.all(workers);

  const final: U[] = [];
  for (const res of results) {
    if (Array.isArray(res)) final.push(...res);
    else final.push(res as U);
  }
  return final;
};
