// ========================================
// ./__benchmark__/Schema/performance.ts
// ========================================

import * as f from '../../src/Fit/__export__';
import * as z from 'zod';
import * as v from 'valibot';
import Table from 'cli-table3';
import {runGC, formatBytes, MemoryMonitor} from '../helper';

// ============================================
// Configuration
// ============================================

const ITERATIONS = 200_000;
const RUNS = 10;
const WARMUP_ITERATIONS = 10_000;

// 统一配置
const FIT_OPTIONS = {strict: true, abortEarly: false};
const VALIBOT_CONFIG = {
  abortEarly: false,
  abortPipeEarly: false,
  unknownEntries: 'deny',
};

// ============================================
// Test Data Factories
// ============================================
// 使用工厂函数确保每次验证的数据是独立的（主要用于正确性检查）

const createValidUser = () => ({
  id: '123e4567-e89b-12d3-a456-426614174000',
  username: 'johndoe',
  email: 'john@example.com',
  age: 30,
  isActive: true,
  role: 'admin',
  tags: ['tag1', 'tag2'],
  address: {
    street: '123 Main St',
    city: 'New York',
    country: 'USA',
    postalCode: '10001',
    coordinates: {lat: 40.7128, lng: -74.006},
  },
  metadata: {key: 'value'},
  createdAt: '2024-01-15T10:30:00Z',
  updatedAt: '2024-01-20T15:45:00Z',
  preferences: {
    theme: 'dark',
    language: 'en',
    notifications: true,
  },
});

const createValidPost = () => ({
  id: '123e4567-e89b-12d3-a456-426614174001',
  title: 'Test Post Title',
  content: 'This is the content of the test post.',
  authorId: '123e4567-e89b-12d3-a456-426614174000',
  status: 'published',
  views: 100,
  likes: 50,
  comments: [
    {
      id: '123e4567-e89b-12d3-a456-426614174002',
      userId: '123e4567-e89b-12d3-a456-426614174003',
      content: 'Great post!',
      createdAt: '2024-01-16T08:00:00Z',
    },
  ],
  createdAt: '2024-01-15T10:30:00Z',
  updatedAt: '2024-01-20T15:45:00Z',
});

const createInvalidUser = () => ({
  id: 'invalid-uuid',
  username: 'ab',
  email: 'invalid-email',
  age: -5,
  isActive: 'not-boolean',
  role: 'invalid-role',
  tags: [],
  address: {
    street: '',
    city: '',
    country: 'A',
    postalCode: 'invalid',
  },
  metadata: null,
  createdAt: 'invalid-date',
});

function createDeepObject(
  depth: number,
  invalid = false,
): Record<string, unknown> {
  let obj: Record<string, unknown> = {value: 'test', count: 0};
  for (let i = 0; i < depth; i++) {
    obj = {nested: obj, level: i, id: `level-${i}`};
  }
  if (invalid) {
    obj.extraField = 'fail';
  }
  return obj;
}

// Benchmark 跑循环时使用静态数据，避免 GC 和创建对象的开销干扰验证逻辑本身
const STATIC_VALID_USER = createValidUser();
const STATIC_VALID_POST = createValidPost();
const STATIC_INVALID_USER = createInvalidUser();
const STATIC_DEEP_VALID = createDeepObject(8);
const STATIC_DEEP_INVALID = createDeepObject(8, true);

// ============================================
// Schemas
// ============================================

// --- Fit Schemas ---
const fitAddressSchema = f.shape({
  street: f.String().that(f.min_len(1)),
  city: f.String().that(f.min_len(1)),
  country: f.String().that(f.min_len(2)),
  postalCode: f.String().that(f.matches(/^\d{5,6}$/)),
  coordinates: f.ShapeOpt({
    lat: f.Number().that(f.range(-90, 90)),
    lng: f.Number().that(f.range(-180, 180)),
  }),
});

const fitUserSchema = f.shape({
  id: f.String().that(f.uuid),
  username: f.String().that(f.len_range(3, 20)),
  email: f.String().that(f.email),
  age: f.NumberOpt().that(f.range(0, 150)).that(f.integer),
  isActive: f.Boolean(),
  role: f.OneOf('admin', 'user', 'guest'),
  tags: f.items(f.String().that(f.min_len(1))),
  address: fitAddressSchema,
  metadata: f.Object(),
  createdAt: f.String().that(f.iso_datetime),
  updatedAt: f.StringOpt().that(f.iso_datetime),
  preferences: f.ShapeOpt({
    theme: f.OneOf('light', 'dark', 'system'),
    language: f.String().that(f.min_len(2)),
    notifications: f.Boolean(),
  }),
});

const fitPostSchema = f.shape({
  id: f.toReadonly(f.String().that(f.uuid)),
  title: f.String().that(f.len_range(1, 200)),
  content: f.String().that(f.min_len(1)),
  authorId: f.String().that(f.uuid),
  status: f.OneOf('draft', 'published', 'archived'),
  views: f.fit().that(f.nonNegativeInt),
  likes: f.fit().that(f.nonNegativeInt),
  comments: f.items(
    f.shape({
      id: f.String().that(f.uuid),
      userId: f.String().that(f.uuid),
      content: f.String().that(f.min_len(1)),
      createdAt: f.String(),
    }),
  ),
  createdAt: f.String().that(f.iso_datetime),
  updatedAt: f.StringOpt().that(f.iso_datetime),
});

type AnyFit = f.BaseFit;

function createFitDeepSchema(depth: number): AnyFit {
  if (depth <= 0) {
    return f.shape({value: f.String(), count: f.Number()}) as unknown as AnyFit;
  }
  return f.shape({
    nested: createFitDeepSchema(depth - 1),
    level: f.Number(),
    id: f.String(),
  }) as unknown as AnyFit;
}

const fitDeepSchema = createFitDeepSchema(8);

// --- Zod Schemas ---
const zodAddressSchema = z.strictObject({
  street: z.string().min(1),
  city: z.string().min(1),
  country: z.string().min(2),
  postalCode: z.string().regex(/^\d{5,6}$/),
  coordinates: z
    .strictObject({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    })
    .optional(),
});

const zodUserSchema = z.strictObject({
  id: z.uuid(), // Note: requires zod@canary or custom refinement for older versions
  username: z.string().min(3).max(20),
  email: z.email(),
  age: z.number().int().min(0).max(150).optional(),
  isActive: z.boolean(),
  role: z.enum(['admin', 'user', 'guest']),
  tags: z.array(z.string().min(1)),
  address: zodAddressSchema,
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime().optional(),
  preferences: z
    .strictObject({
      theme: z.enum(['light', 'dark', 'system']),
      language: z.string().min(2),
      notifications: z.boolean(),
    })
    .optional(),
});

const zodPostSchema = z.strictObject({
  id: z.uuid(),
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  authorId: z.uuid(),
  status: z.enum(['draft', 'published', 'archived']),
  views: z.number().int().nonnegative(),
  likes: z.number().int().nonnegative(),
  comments: z.array(
    z.strictObject({
      id: z.uuid(),
      userId: z.uuid(),
      content: z.string().min(1),
      createdAt: z.string(),
    }),
  ),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime().optional(),
});

function createZodDeepSchema(depth: number): z.ZodTypeAny {
  if (depth <= 0) return z.strictObject({value: z.string(), count: z.number()});
  return z.strictObject({
    nested: createZodDeepSchema(depth - 1),
    level: z.number(),
    id: z.string(),
  });
}
const zodDeepSchema = createZodDeepSchema(8);

// --- Valibot Schemas ---
const valibotAddressSchema = v.strictObject({
  street: v.pipe(v.string(), v.minLength(1)),
  city: v.pipe(v.string(), v.minLength(1)),
  country: v.pipe(v.string(), v.minLength(2)),
  postalCode: v.pipe(v.string(), v.regex(/^\d{5,6}$/)),
  coordinates: v.optional(
    v.strictObject({
      lat: v.pipe(v.number(), v.minValue(-90), v.maxValue(90)),
      lng: v.pipe(v.number(), v.minValue(-180), v.maxValue(180)),
    }),
  ),
});

const valibotUserSchema = v.strictObject({
  id: v.pipe(v.string(), v.uuid()),
  username: v.pipe(v.string(), v.minLength(3), v.maxLength(20)),
  email: v.pipe(v.string(), v.email()),
  age: v.optional(
    v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(150)),
  ),
  isActive: v.boolean(),
  role: v.picklist(['admin', 'user', 'guest']),
  tags: v.array(v.pipe(v.string(), v.minLength(1))),
  address: valibotAddressSchema,
  metadata: v.record(v.string(), v.unknown()),
  createdAt: v.pipe(v.string(), v.isoTimestamp()),
  updatedAt: v.optional(v.pipe(v.string(), v.isoTimestamp())),
  preferences: v.optional(
    v.strictObject({
      theme: v.picklist(['light', 'dark', 'system']),
      language: v.pipe(v.string(), v.minLength(2)),
      notifications: v.boolean(),
    }),
  ),
});

const valibotPostSchema = v.strictObject({
  id: v.pipe(v.string(), v.uuid()),
  title: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
  content: v.pipe(v.string(), v.minLength(1)),
  authorId: v.pipe(v.string(), v.uuid()),
  status: v.picklist(['draft', 'published', 'archived']),
  views: v.pipe(v.number(), v.integer(), v.minValue(0)),
  likes: v.pipe(v.number(), v.integer(), v.minValue(0)),
  comments: v.array(
    v.strictObject({
      id: v.pipe(v.string(), v.uuid()),
      userId: v.pipe(v.string(), v.uuid()),
      content: v.pipe(v.string(), v.minLength(1)),
      createdAt: v.string(),
    }),
  ),
  createdAt: v.pipe(v.string(), v.isoTimestamp()),
  updatedAt: v.optional(v.pipe(v.string(), v.isoTimestamp())),
});

function createValibotDeepSchema(depth: number): v.GenericSchema {
  if (depth <= 0) return v.strictObject({value: v.string(), count: v.number()});
  return v.strictObject({
    nested: createValibotDeepSchema(depth - 1),
    level: v.number(),
    id: v.string(),
  });
}
const valibotDeepSchema = createValibotDeepSchema(8);

// ============================================
// Utils
// ============================================

interface StatsResult {
  mean: number;
  stdDev: number;
  samples: number[];
}

function getStats(samples: number[]): StatsResult {
  const sum = samples.reduce((a, b) => a + b, 0);
  const mean = sum / samples.length;
  const sqDiffs = samples.map((val) => Math.pow(val - mean, 2));
  const variance = sqDiffs.reduce((a, b) => a + b, 0) / samples.length;
  return {
    mean,
    stdDev: Math.sqrt(variance),
    samples,
  };
}

// ============================================
// Benchmark Runner
// ============================================

type TestCaseKey =
  | 'validUser'
  | 'validPost'
  | 'invalidUser'
  | 'deepValid'
  | 'deepInvalid';

interface TestCase {
  data: unknown;
  fitSchema: AnyFit;
  zodSchema: z.ZodTypeAny;
  valibotSchema: v.GenericSchema;
}

// 将测试用例集中管理
const TEST_CASES: Record<TestCaseKey, TestCase> = {
  validUser: {
    data: STATIC_VALID_USER,
    fitSchema: fitUserSchema,
    zodSchema: zodUserSchema,
    valibotSchema: valibotUserSchema,
  },
  validPost: {
    data: STATIC_VALID_POST,
    fitSchema: fitPostSchema,
    zodSchema: zodPostSchema,
    valibotSchema: valibotPostSchema,
  },
  invalidUser: {
    data: STATIC_INVALID_USER,
    fitSchema: fitUserSchema,
    zodSchema: zodUserSchema,
    valibotSchema: valibotUserSchema,
  },
  deepValid: {
    data: STATIC_DEEP_VALID,
    fitSchema: fitDeepSchema,
    zodSchema: zodDeepSchema,
    valibotSchema: valibotDeepSchema,
  },
  deepInvalid: {
    data: STATIC_DEEP_INVALID,
    fitSchema: fitDeepSchema,
    zodSchema: zodDeepSchema,
    valibotSchema: valibotDeepSchema,
  },
};

interface BenchmarkResult {
  name: string;
  stats: Record<TestCaseKey, StatsResult>;
  total: StatsResult;
  memory: {delta: number};
  memMonitor: MemoryMonitor;
}

function runBenchmark(
  lib: 'fit' | 'zod' | 'valibot',
  iterations: number,
  runs: number,
): BenchmarkResult {
  const times: Record<TestCaseKey, number[]> = {
    validUser: [],
    validPost: [],
    invalidUser: [],
    deepValid: [],
    deepInvalid: [],
  };

  // 防止 V8 Dead Code Elimination 的“黑洞”变量
  let blackhole: unknown = 0;

  // 创建适配器，预先绑定 schema 和 data，避免在循环中做判断
  const adapters: Record<TestCaseKey, () => void> = {} as Record<
    TestCaseKey,
    () => void
  >;

  for (const key of Object.keys(TEST_CASES) as TestCaseKey[]) {
    const {data} = TEST_CASES[key];
    const schema = TEST_CASES[key][`${lib}Schema`];

    if (lib === 'fit') {
      adapters[key] = () => {
        const res = f.validate(
          data,
          schema as f.Fit<
            unknown,
            unknown,
            unknown,
            boolean,
            boolean,
            boolean,
            boolean
          >,
          FIT_OPTIONS,
        );
        blackhole = res; // 消费结果
      };
    } else if (lib === 'zod') {
      adapters[key] = () => {
        const res = (schema as z.ZodTypeAny).safeParse(data);
        blackhole = res;
      };
    } else {
      adapters[key] = () => {
        const res = v.safeParse(
          schema as v.GenericSchema,
          data,
          VALIBOT_CONFIG,
        );
        blackhole = res;
      };
    }
  }

  // 1. Warmup
  // 预热所有用例，确保 JIT 编译所有相关代码路径
  for (let i = 0; i < WARMUP_ITERATIONS; i++) {
    for (const key of Object.keys(adapters) as TestCaseKey[]) {
      adapters[key]();
    }
  }

  // 2. Memory Setup
  const memMonitor = new MemoryMonitor();
  runGC();
  memMonitor.snapshot('start');

  // 3. Measurement
  for (let r = 0; r < runs; r++) {
    runGC(); // 每次 run 前清理，保证内存测量准确

    for (const key of Object.keys(times) as TestCaseKey[]) {
      const fn = adapters[key];
      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        fn();
      }
      times[key].push(performance.now() - start);
    }

    runGC(); // 每次 run 后清理，保证内存快照准确
    memMonitor.snapshot(`run-${r + 1}`);
  }

  memMonitor.snapshot('end');

  // Calculate Stats
  const stats = Object.fromEntries(
    Object.keys(times).map((k) => [k, getStats(times[k as TestCaseKey])]),
  ) as Record<TestCaseKey, StatsResult>;

  // Calculate Total
  const totalSamples = stats.validUser.samples.map((_, i) =>
    (Object.keys(stats) as TestCaseKey[]).reduce(
      (sum, key) => sum + stats[key].samples[i],
      0,
    ),
  );

  const memDelta =
    memMonitor.samples[memMonitor.samples.length - 1] - memMonitor.samples[0];

  // 防止 V8 过度优化 blackhole，做一次无用检查
  if (blackhole === 'magic_value_never_happens') console.log('impossible');

  return {
    name: lib,
    stats,
    total: getStats(totalSamples),
    memory: {delta: memDelta},
    memMonitor,
  };
}

// ============================================
// Main
// ============================================

function main() {
  if (!global.gc) {
    console.warn(
      '\n⚠️  Warning: Run with --expose-gc for accurate memory results.',
    );
    console.warn(
      '   Example: node --expose-gc dist/__benchmark__/Schema/performance.js\n',
    );
  }

  console.log('\n🔬 Schema Validation Benchmark (Strict Mode)');
  console.log('─'.repeat(70));
  console.log(`Node: ${process.version} | Platform: ${process.platform}`);
  console.log(
    `Config: ${RUNS} runs x ${ITERATIONS.toLocaleString()} iterations (Warmup: ${WARMUP_ITERATIONS})`,
  );
  console.log('─'.repeat(70));

  // 1. Correctness Verification (使用工厂函数产生的新鲜数据)
  console.log('\n🔎 Verifying correctness...');

  const fitOk = f.validate(createValidUser(), fitUserSchema, FIT_OPTIONS);
  const zodOk = zodUserSchema.safeParse(createValidUser());
  const vOk = v.safeParse(valibotUserSchema, createValidUser(), VALIBOT_CONFIG);

  if (!fitOk.ok || !zodOk.success || !vOk.success) {
    console.error('❌ Valid User verification failed!');
    console.error('Fit:', fitOk);
    console.error('Zod:', zodOk);
    console.error('Valibot:', vOk);
    process.exit(1);
  }

  const fitBad = f.validate(createInvalidUser(), fitUserSchema, FIT_OPTIONS);
  if (fitBad.ok) {
    console.error('❌ Invalid User verification failed! (Expected rejection)');
    process.exit(1);
  }
  console.log('   ✓ Schemas behave correctly.\n');

  // 2. Run Benchmarks
  const results: BenchmarkResult[] = [];
  const libs: Array<'fit' | 'zod' | 'valibot'> = ['fit', 'zod', 'valibot'];

  for (const lib of libs) {
    process.stdout.write(`⏳ Running ${lib.padEnd(8)}... `);
    results.push(runBenchmark(lib, ITERATIONS, RUNS));
    console.log('✅ Done');
  }

  // 3. Report
  const sorted = [...results].sort((a, b) => a.total.mean - b.total.mean);
  const fastest = sorted[0].total.mean;

  const table = new Table({
    head: [
      'Library',
      'Valid User',
      'Invalid User',
      'Deep Valid',
      'Total (ms)',
      'Ratio',
      'StdDev (±%)',
    ],
    colWidths: [10, 14, 14, 14, 14, 8, 12],
    style: {head: ['cyan']},
  });

  for (const res of sorted) {
    const ratio = (res.total.mean / fastest).toFixed(2);
    const stdDevPercent = ((res.total.stdDev / res.total.mean) * 100).toFixed(
      1,
    );

    table.push([
      res.name,
      res.stats.validUser.mean.toFixed(2),
      res.stats.invalidUser.mean.toFixed(2),
      res.stats.deepValid.mean.toFixed(2),
      res.total.mean.toFixed(2),
      `${ratio}x`,
      `${stdDevPercent}%`,
    ]);
  }

  console.log('\n📊 Results (Average of ' + RUNS + ' runs):');
  console.log(table.toString());

  // Memory Report
  console.log('\n💾 Memory Impact (Heap Delta after GC):');
  const memTable = new Table({
    head: ['Library', 'Heap Delta'],
    colWidths: [10, 20],
    style: {head: ['cyan']},
  });

  for (const res of sorted) {
    memTable.push([res.name, formatBytes(res.memory.delta)]);
  }
  console.log(memTable.toString());

  // Memory Curve
  console.log('\n📈 Memory Usage Curves:');
  for (const res of sorted) {
    console.log(`\n[${res.name}]`);
    console.log(res.memMonitor.renderChart(50, 6));
  }
  console.log('\n');
}

try {
  main();
} catch (e) {
  console.error(e);
  process.exit(1);
}
