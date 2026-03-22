// ========================================
// ./__benchmark__/scheduler.ts
// ========================================

import {Scheduler} from '../src/Concurrent/scheduler';
import {runGC, MemoryMonitor, formatBytes} from './helper';
import {flushPromises} from '../src/helper';
import Table from 'cli-table3';

// ========================================
// 辅助函数
// ========================================

/** 创建基准测试结果 */
function createResult(
  iterations: number,
  duration: number,
  type: string,
  monitor: MemoryMonitor,
) {
  const ops = duration > 0 ? (iterations / duration) * 1000 : 0;

  // 防御性编程：确保有采样数据
  const memStart = monitor.samples.length > 0 ? monitor.samples[0] : 0;
  const memEnd =
    monitor.samples.length > 1
      ? monitor.samples[monitor.samples.length - 1]
      : memStart;

  return {
    type,
    duration: duration.toFixed(2),
    ops: ops.toFixed(0),
    memStart: formatBytes(memStart),
    memEnd: formatBytes(memEnd),
    monitor,
  };
}

/** 运行同步基准测试 */
function runSyncBenchmark(
  iterations: number,
  workload: () => void,
  monitor: MemoryMonitor,
) {
  runGC();
  monitor.snapshot('Start');

  const start = performance.now();
  for (let i = 0; i < iterations; i++) workload();
  const duration = performance.now() - start;

  monitor.snapshot('End');
  return createResult(iterations, duration, 'Sync', monitor);
}

/** 运行异步基准测试 */
async function runAsyncBenchmark(
  iterations: number,
  test_fn: () => Promise<void>,
  monitor: MemoryMonitor,
  type: string,
) {
  runGC();
  monitor.snapshot('Start');

  const start = performance.now();
  await test_fn();
  const duration = performance.now() - start;

  monitor.snapshot('End');
  return createResult(iterations, duration, type, monitor);
}

/** Linux CFS 权重映射表 (Nice -20 ~ 19) */
const WEIGHT_TABLE = new Uint32Array([
  88761, 71755, 56483, 46273, 36291, 29154, 23254, 18705, 14949, 11916, 9548,
  7620, 6100, 4904, 3906, 3121, 2501, 1991, 1586, 1277, 1024, 820, 655, 526,
  423, 335, 272, 215, 172, 137, 110, 87, 70, 56, 45, 36, 29, 23, 18, 15,
]);

/** 获取 Nice 值对应的调度权重 */
const getWeight = (nice: number): number => {
  const index = nice + 20;
  return index >= 0 && index < WEIGHT_TABLE.length ? WEIGHT_TABLE[index] : 1024;
};

/** 构建 CLI 表格 */
function createTable(title: string, data: Record<string, unknown>) {
  const table = new Table({
    colWidths: [28, 50],
    style: {head: [], border: ['grey']},
  });
  table.push([{colSpan: 2, content: title, hAlign: 'center'}]);
  Object.entries(data).forEach(([k, v]) => table.push([k, String(v)]));
  return table.toString();
}

// ========================================
// 测试用例
// ========================================

/** 测试 A: 吞吐量与调度开销基准 */
async function testThroughput() {
  const ITERATIONS = 2000_000;
  const WARMUP_ITERATIONS = 100_000;
  const WORKLOAD_SIZE = 200;

  const doWork = () => {
    let d = 0;
    for (let i = 0; i < WORKLOAD_SIZE; i++) d += Math.sqrt(i);
    return d;
  };

  console.log('⏳ Running Throughput Test (with warmup)...');

  // ============================================
  // 统一预热阶段
  // ============================================
  console.log('  🔥 Warming up...');

  // -- Sync 预热 --
  for (let i = 0; i < WARMUP_ITERATIONS; i++) doWork();

  // -- Microtask 预热 --
  await new Promise<void>((resolve) => {
    let count = 0;
    const tick = () => {
      if (count++ < WARMUP_ITERATIONS) {
        doWork();
        queueMicrotask(tick);
      } else {
        resolve();
      }
    };
    queueMicrotask(tick);
  });

  // -- Immediate 预热 --
  await new Promise<void>((resolve) => {
    let count = 0;
    const tick = () => {
      if (count++ < WARMUP_ITERATIONS) {
        doWork();
        setImmediate(tick);
      } else {
        resolve();
      }
    };
    setImmediate(tick);
  });

  // -- MessageChannel 预热 --
  await new Promise<void>((resolve) => {
    let count = 0;
    const channel = new MessageChannel();
    channel.port1.onmessage = () => {
      if (count++ < WARMUP_ITERATIONS) {
        doWork();
        channel.port2.postMessage(null);
      } else {
        channel.port1.close();
        resolve();
      }
    };
    channel.port2.postMessage(null);
  });

  // -- Scheduler 预热 --
  const warmupScheduler = new Scheduler(1);
  await new Promise<void>((resolve) => {
    let count = 0;
    void warmupScheduler.add(
      async (_, pause) => {
        while (count++ < WARMUP_ITERATIONS) {
          doWork();
          await pause();
        }
        resolve();
      },
      {nice: 0},
    );
    void warmupScheduler.add(
      async (_, pause) => {
        while (count++ < WARMUP_ITERATIONS) {
          doWork();
          await pause();
        }
        resolve();
      },
      {nice: 0},
    );
  });

  // -- 预热后清理 --
  runGC();
  await flushPromises();
  await flushPromises();
  await flushPromises();

  // ============================================
  // 正式测试阶段
  // ============================================
  console.log('  📊 Running benchmarks...');

  // -- 1. Sync 基准测试 --
  const syncRes = runSyncBenchmark(ITERATIONS, doWork, new MemoryMonitor());

  // -- 2. Microtask 基准测试 --
  const microRes = await runAsyncBenchmark(
    ITERATIONS,
    () =>
      new Promise<void>((resolve) => {
        let count = 0;
        const tick = () => {
          if (count++ < ITERATIONS) {
            doWork();
            queueMicrotask(tick);
          } else {
            resolve();
          }
        };
        queueMicrotask(tick);
      }),
    new MemoryMonitor(),
    'Microtask',
  );

  // -- 3. MessageChannel 基准测试 --
  const msgRes = await runAsyncBenchmark(
    ITERATIONS,
    () =>
      new Promise<void>((resolve) => {
        let count = 0;
        const channel = new MessageChannel();
        channel.port1.onmessage = () => {
          if (count++ < ITERATIONS) {
            doWork();
            channel.port2.postMessage(null);
          } else {
            channel.port1.close();
            resolve();
          }
        };
        channel.port2.postMessage(null);
      }),
    new MemoryMonitor(),
    'MessageChannel',
  );

  // -- 4. Immediate 基准测试 --
  const immRes = await runAsyncBenchmark(
    ITERATIONS,
    () =>
      new Promise<void>((resolve) => {
        let count = 0;
        const tick = () => {
          if (count++ < ITERATIONS) {
            doWork();
            setImmediate(tick);
          } else {
            resolve();
          }
        };
        setImmediate(tick);
      }),
    new MemoryMonitor(),
    'Immediate',
  );

  // -- 5. Scheduler 基准测试 (单任务) --
  const scheduler = new Scheduler(1);
  const schedRes = await runAsyncBenchmark(
    ITERATIONS,
    () =>
      new Promise<void>((resolve) => {
        let count = 0;
        void scheduler.add(
          async (_, pause) => {
            while (count++ < ITERATIONS) {
              doWork();
              await pause();
            }
            resolve();
          },
          {nice: 0},
        );
      }),
    new MemoryMonitor(),
    'Scheduler (1 Task)',
  );

  // -- 6. Scheduler 基准测试 (双任务, 并发=1, 竞争模式) --
  const schedulerB = new Scheduler(1);
  const schedResB = await runAsyncBenchmark(
    ITERATIONS,
    () =>
      new Promise<void>((resolve) => {
        let count = 0;
        void schedulerB.add(
          async (_, pause) => {
            while (count++ < ITERATIONS) {
              doWork();
              await pause();
            }
            resolve();
          },
          {nice: 0},
        );
        void schedulerB.add(
          async (_, pause) => {
            while (count++ < ITERATIONS) {
              doWork();
              await pause();
            }
            resolve();
          },
          {nice: 0},
        );
      }),
    new MemoryMonitor(),
    'Scheduler (Contended)',
  );

  // -- 7. Scheduler 基准测试 (八任务, 并发=1, 竞争模式) --
  const schedulerD = new Scheduler(1);
  const schedResD = await runAsyncBenchmark(
    ITERATIONS,
    () =>
      new Promise<void>((resolve) => {
        let count = 0;
        const createTask = () =>
          schedulerD.add(
            async (_, pause) => {
              while (count++ < ITERATIONS) {
                doWork();
                await pause();
              }
              resolve();
            },
            {nice: 0},
          );
        void createTask();
        void createTask();
        void createTask();
        void createTask();
        void createTask();
        void createTask();
        void createTask();
        void createTask();
      }),
    new MemoryMonitor(),
    'Scheduler (8-Way Contended)',
  );

  // -- 8. Scheduler 基准测试 (双任务, 并发=2, 并发模式) --
  const schedulerC = new Scheduler(2);
  const schedResC = await runAsyncBenchmark(
    ITERATIONS,
    () =>
      new Promise<void>((resolve) => {
        let count = 0;
        void schedulerC.add(
          async (_, pause) => {
            while (count++ < ITERATIONS) {
              doWork();
              await pause();
            }
            resolve();
          },
          {nice: 0},
        );
        void schedulerC.add(
          async (_, pause) => {
            while (count++ < ITERATIONS) {
              doWork();
              await pause();
            }
            resolve();
          },
          {nice: 0},
        );
      }),
    new MemoryMonitor(),
    'Scheduler (Parallel)',
  );

  // 结果计算辅助函数
  const calcOverhead = (base: string, target: string) => {
    const baseOps = parseFloat(base);
    const targetOps = parseFloat(target);
    if (targetOps === 0) return 'Inf';
    return ((baseOps / targetOps - 1) * 100).toFixed(1) + '%';
  };

  console.log(
    createTable('Throughput Benchmark', {
      Iterations: ITERATIONS,
      Warmup: WARMUP_ITERATIONS,
      '--- Baselines ---': '---',
      '1. Sync Ops/s': `${syncRes.ops} (Max)`,
      '2. Microtask Ops/s': microRes.ops,
      '3. MessageChannel Ops/s': msgRes.ops,
      '4. Immediate Ops/s': immRes.ops,
      '--- Scheduler ---': '---',
      '5. Single Task': schedRes.ops,
      'Overhead (vs Sync)': calcOverhead(schedRes.ops, syncRes.ops),
      'Overhead (vs Micro)': calcOverhead(schedRes.ops, microRes.ops),
      '--- Scalability ---': '---',
      '6. 2-Way Contended (C=1)': schedResB.ops,
      '7. 8-Way Contended (C=1)': schedResD.ops,
      'Drop (2→8 Tasks)': calcOverhead(schedResD.ops, schedResB.ops),
      '8. Parallel (C=2)': schedResC.ops,
      'Memory (Single)': `${schedRes.memStart} → ${schedRes.memEnd}`,
    }),
  );
}

/** 测试 B: 公平性验证 */
async function testFairness() {
  runGC();
  const monitor = new MemoryMonitor();
  monitor.snapshot('Init');

  const scheduler = new Scheduler(1);

  const TOTAL_TICKS = 3000_000;
  const WORK_PER_TICK = 5200;

  const ticks = {high: 0, low: 0};
  let is_finished = false;

  const nice_high = 0;
  const nice_low = 6;
  const weight_high = getWeight(nice_high);
  const weight_low = getWeight(nice_low);
  const theoretical_ratio = weight_high / weight_low;

  // 误差范围 ±1%
  const Tolerance = 0.01;
  const lower_threshold = theoretical_ratio * (1 - Tolerance);
  const upper_threshold = theoretical_ratio * (1 + Tolerance);

  const create_task = (name: keyof typeof ticks, nice: number) => {
    void scheduler.add(
      async (_expired, pause) => {
        while (!is_finished) {
          let dummy = 0;
          for (let i = 0; i < WORK_PER_TICK; i++) dummy += Math.sqrt(i);

          ticks[name]++;

          if (ticks.high + ticks.low >= TOTAL_TICKS) {
            is_finished = true;
            break;
          }
          await pause();
        }
      },
      {nice, guaranteed: true},
    );
  };

  create_task('high', nice_high);
  create_task('low', nice_low);

  // 监控循环
  let lastCheck = 0;
  while (!is_finished) {
    await new Promise((res) => setTimeout(res, 50));
    const progress = (ticks.high + ticks.low) / TOTAL_TICKS;

    if (progress > lastCheck + 0.25) {
      lastCheck = Math.floor(progress * 4) / 4;
      monitor.snapshot(`${Math.round(lastCheck * 100)}%`);
    }
  }

  runGC();
  monitor.snapshot('Final');

  // 结果分析
  const actual_ratio = ticks.high / Math.max(1, ticks.low);
  const passed =
    actual_ratio >= lower_threshold && actual_ratio <= upper_threshold;

  const memStart = monitor.samples[0];
  const memEnd = monitor.samples[monitor.samples.length - 1];
  const memGrowth = memEnd - memStart;

  console.log(
    createTable('B. Fairness Benchmark', {
      'Config: Total Ticks': TOTAL_TICKS,
      'Nice Config': `${nice_high} (High) vs ${nice_low} (Low)`,
      Weights: `${weight_high} vs ${weight_low}`,
      'Theoretical Ratio': theoretical_ratio.toFixed(3),
      'Actual Ratio': actual_ratio.toFixed(3),
      'Range [min, max]': `[${lower_threshold.toFixed(3)}, ${upper_threshold.toFixed(3)}]`,
      Result: passed ? '✅ PASSED' : '❌ FAILED',
      Details: `High: ${ticks.high} / Low: ${ticks.low}`,
      '--- Memory ---': '--- Monitor Results ---',
      'Start Memory': formatBytes(memStart),
      'End Memory': formatBytes(memEnd),
      'Memory Growth': `${formatBytes(memGrowth)} (${(memGrowth > 0 ? '+' : '') + ((memGrowth / memStart) * 100).toFixed(2)}%)`,
    }),
  );

  console.log('\n📈 Fairness Memory Trend:');
  console.log(monitor.renderChart());
}

/** 测试 C: 内存压力与泄漏检测 */
async function testMemoryPressure() {
  const scheduler = new Scheduler(5);
  const monitor = new MemoryMonitor();
  const TASK_COUNT = 100;
  const BATCHES = 300;
  const SAMPLE_INTERVAL = Math.floor(BATCHES / 5); // 每 20% 采样一次

  console.log('⏳ Running Memory Pressure Test...');
  runGC();
  monitor.snapshot('Init');

  for (let b = 0; b < BATCHES; b++) {
    for (let i = 0; i < TASK_COUNT; i++) {
      void scheduler.add(
        async (_, pause) => {
          await pause();
        },
        {nice: 0},
      );
    }

    // 等待并触发 GC，模拟任务处理间隙
    await new Promise((r) => setTimeout(r, 20));
    runGC();

    // 只在关键节点记录快照，避免图表过宽
    if ((b + 1) % SAMPLE_INTERVAL === 0) {
      const percent = Math.round(((b + 1) / BATCHES) * 100);
      monitor.snapshot(`${percent}%`);
    }
  }

  runGC();
  monitor.snapshot('Final');

  const startMem = monitor.samples[0];
  const endMem = monitor.samples[monitor.samples.length - 1];

  // 泄漏判定：增长超过 50% 且 > 1MB
  const leaked = endMem > startMem * 1.5 && endMem - startMem > 1024 * 1024;

  console.log(
    createTable('C. Memory & Leak Test', {
      Operations: `${BATCHES} Batches x ${TASK_COUNT} Tasks`,
      'Start Memory': formatBytes(startMem),
      'End Memory': formatBytes(endMem),
      Growth: formatBytes(endMem - startMem),
      Status: leaked ? '⚠️ Leak Suspected' : '✅ Stable',
    }),
  );

  console.log('\n📈 Memory Trend Visualization:');
  console.log(monitor.renderChart());
}

// ========================================
// 主入口
// ========================================
async function main() {
  console.log('🚀 Scheduler Benchmark Suite\n');
  await testThroughput();
  console.log('\n');
  await testFairness();
  console.log('\n');
  await testMemoryPressure();

  console.log('\n✨ All tests completed.');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
/*
 pnpm vite-node scripts/run.ts __benchmark__\scheduler.ts
✅ GC enabled
🚀 Scheduler Benchmark Suite

⏳ Running Throughput Test (with warmup)...
  🔥 Warming up...
  📊 Running benchmarks...
┌───────────────────────────────────────────────────────────────────────────────┐
│                             Throughput Benchmark                              │
├────────────────────────────┬──────────────────────────────────────────────────┤
│ Iterations                 │ 2000000                                          │
├────────────────────────────┼──────────────────────────────────────────────────┤
│ Warmup                     │ 100000                                           │
├────────────────────────────┼──────────────────────────────────────────────────┤
│ --- Baselines ---          │ ---                                              │
├────────────────────────────┼──────────────────────────────────────────────────┤
│ 1. Sync Ops/s              │ 3315879 (Max)                                    │
├────────────────────────────┼──────────────────────────────────────────────────┤
│ 2. Microtask Ops/s         │ 2520874                                          │
├────────────────────────────┼──────────────────────────────────────────────────┤
│ 3. MessageChannel Ops/s    │ 603359                                           │
├────────────────────────────┼──────────────────────────────────────────────────┤
│ 4. Immediate Ops/s         │ 555359                                           │
├────────────────────────────┼──────────────────────────────────────────────────┤
│ --- Scheduler ---          │ ---                                              │
├────────────────────────────┼──────────────────────────────────────────────────┤
│ 5. Single Task             │ 1902407                                          │
├────────────────────────────┼──────────────────────────────────────────────────┤
│ Overhead (vs Sync)         │ -42.6%                                           │
├────────────────────────────┼──────────────────────────────────────────────────┤
│ Overhead (vs Micro)        │ -24.5%                                           │
├────────────────────────────┼──────────────────────────────────────────────────┤
│ --- Scalability ---        │ ---                                              │
├────────────────────────────┼──────────────────────────────────────────────────┤
│ 6. 2-Way Contended (C=1)   │ 1072516                                          │
├────────────────────────────┼──────────────────────────────────────────────────┤
│ 7. 8-Way Contended (C=1)   │ 1007035                                          │
├────────────────────────────┼──────────────────────────────────────────────────┤
│ Drop (2→8 Tasks)           │ -6.1%                                            │
├────────────────────────────┼──────────────────────────────────────────────────┤
│ 8. Parallel (C=2)          │ 1869199                                          │
├────────────────────────────┼──────────────────────────────────────────────────┤
│ Memory (Single)            │ 79.70 MB → 99.72 MB                              │
└────────────────────────────┴──────────────────────────────────────────────────┘


┌───────────────────────────────────────────────────────────────────────────────┐
│                             B. Fairness Benchmark                             │
├────────────────────────────┬──────────────────────────────────────────────────┤
│ Config: Total Ticks        │ 3000000                                          │
├────────────────────────────┼──────────────────────────────────────────────────┤
│ Nice Config                │ 0 (High) vs 6 (Low)                              │
├────────────────────────────┼──────────────────────────────────────────────────┤
│ Weights                    │ 1024 vs 272                                      │
├────────────────────────────┼──────────────────────────────────────────────────┤
│ Theoretical Ratio          │ 3.765                                            │
├────────────────────────────┼──────────────────────────────────────────────────┤
│ Actual Ratio               │ 3.779                                            │
├────────────────────────────┼──────────────────────────────────────────────────┤
│ Range [min, max]           │ [3.727, 3.802]                                   │
├────────────────────────────┼──────────────────────────────────────────────────┤
│ Result                     │ ✅ PASSED                                        │
├────────────────────────────┼──────────────────────────────────────────────────┤
│ Details                    │ High: 2372213 / Low: 627787                      │
├────────────────────────────┼──────────────────────────────────────────────────┤
│ --- Memory ---             │ --- Monitor Results ---                          │
├────────────────────────────┼──────────────────────────────────────────────────┤
│ Start Memory               │ 80.08 MB                                         │
├────────────────────────────┼──────────────────────────────────────────────────┤
│ End Memory                 │ 80.11 MB                                         │
├────────────────────────────┼──────────────────────────────────────────────────┤
│ Memory Growth              │ 34.09 KB (+0.04%)                                │
└────────────────────────────┴──────────────────────────────────────────────────┘

📈 Fairness Memory Trend:
 116.20 MB │  █
 107.17 MB │  █
  98.14 MB │  ██
  89.11 MB │  ██
  80.08 MB │█████
           └────────────────────────────────────────
Legend: [0]Init -> [1]25% -> [2]50% -> [3]75% -> [4]Final


⏳ Running Memory Pressure Test...
┌───────────────────────────────────────────────────────────────────────────────┐
│                             C. Memory & Leak Test                             │
├────────────────────────────┬──────────────────────────────────────────────────┤
│ Operations                 │ 300 Batches x 100 Tasks                          │
├────────────────────────────┼──────────────────────────────────────────────────┤
│ Start Memory               │ 80.14 MB                                         │
├────────────────────────────┼──────────────────────────────────────────────────┤
│ End Memory                 │ 80.14 MB                                         │
├────────────────────────────┼──────────────────────────────────────────────────┤
│ Growth                     │ 6.80 KB                                          │
├────────────────────────────┼──────────────────────────────────────────────────┤
│ Status                     │ ✅ Stable                                        │
└────────────────────────────┴──────────────────────────────────────────────────┘

📈 Memory Trend Visualization:
  80.20 MB │   ███
  80.18 MB │ █ ███
  80.17 MB │ █████
  80.15 MB │ █████
  80.14 MB │███████
           └────────────────────────────────────────
Legend: [0]Init -> [1]20% -> [2]40% -> [3]60% -> [4]80% -> [5]100% -> [6]Final

✨ All tests completed.
*/
