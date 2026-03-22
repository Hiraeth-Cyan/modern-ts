// ========================================
// ./__benchmark__/mutex.ts
// ========================================

import {Mutex} from '../src/Concurrent/Lock/mutex';
import Table from 'cli-table3';
import {runGC, MemoryMonitor, formatBytes} from './helper';

// ========================================
// 辅助函数
// ========================================

/** 创建基准测试结果 */
function createResult(
  operations: number,
  duration: number,
  type: string,
  monitor?: MemoryMonitor,
) {
  const ops = (operations / duration) * 1000;
  return {
    type,
    duration: duration.toFixed(2),
    ops: ops.toFixed(0),
    memStart: monitor ? formatBytes(monitor.samples[0]) : '-',
    memEnd: monitor
      ? formatBytes(monitor.samples[monitor.samples.length - 1])
      : '-',
    monitor,
  };
}

/** 构建 CLI 表格 */
function createTable(title: string, data: Record<string, unknown>) {
  const table = new Table({
    colWidths: [30, 45],
    style: {head: [], border: ['grey']},
  });
  table.push([{colSpan: 2, content: title, hAlign: 'center'}]);
  Object.entries(data).forEach(([k, v]) => table.push([k, String(v)]));
  return table.toString();
}

/** JIT 预热函数 */
async function jitWarmup() {
  console.log('JIT Warmup...');

  runGC();

  const warmup_start = performance.now();

  for (let i = 0; i < 50000; i++) {
    const mutex = new Mutex();
    await mutex.lock();
    const dummy = performance.now();
    void (dummy + i);
    mutex.unlock();
    mutex.dispose();
  }

  const warmup_duration = performance.now() - warmup_start;
  console.log(`JIT Warmup completed: ${warmup_duration.toFixed(2)}ms\n`);

  runGC();
}

// ========================================
// 测试用例
// ========================================

/** 测试 A: 极限快速操作 */
async function testUltraFastOperations() {
  const ITERATIONS = 100000;
  const mutex = new Mutex();
  const monitor = new MemoryMonitor();

  runGC();
  monitor.snapshot('Start');

  const start = performance.now();
  let lock_count = 0;

  for (let i = 0; i < ITERATIONS; i++) {
    await mutex.lock();
    lock_count++;
    mutex.unlock();

    if (i % 5000 === 0) {
      monitor.snapshot(`${((i / ITERATIONS) * 100).toFixed(0)}%`);
      await Promise.resolve();
    }
  }

  const duration = performance.now() - start;

  monitor.snapshot('End');
  const final_stats = mutex.getStats();
  const result = createResult(ITERATIONS, duration, 'UltraFast', monitor);

  console.log(
    createTable('A. Ultra Fast Operations', {
      Iterations: ITERATIONS,
      'Lock Count': lock_count,
      Duration: `${result.duration}ms`,
      Throughput: `${result.ops} ops/sec`,
      'Final Queue Capacity': final_stats.queueCapacity,
      Status:
        lock_count === ITERATIONS && !final_stats.isLocked
          ? 'PASSED'
          : 'FAILED',
      Memory: `${result.memStart} → ${result.memEnd}`,
    }),
  );

  if (monitor.samples.length > 2) {
    console.log('\nMemory Chart:');
    console.log(monitor.renderChart());
  }

  mutex.dispose();
}

/** 测试 B: 大规模 FIFO 顺序测试 */
async function testMassiveFIFO() {
  const TASKS = 10000;
  const CANCELLATION_RATE = 0.2;
  const mutex = new Mutex();
  const monitor = new MemoryMonitor();

  runGC();
  monitor.snapshot('Start');

  const execution_order: number[] = [];
  let cancelled_count = 0;

  const start = performance.now();

  const monitor_interval = setInterval(() => {
    monitor.snapshot(`${execution_order.length} done`);
  }, 200);

  const all_task_promises = Array.from({length: TASKS}, (_, i) =>
    (async (task_id: number) => {
      const controller = new AbortController();

      if (Math.random() < CANCELLATION_RATE) {
        setTimeout(() => controller.abort(), Math.random() * 50);
      }

      try {
        await mutex.lock(controller.signal);
        try {
          execution_order.push(task_id);

          if (Math.random() < 0.1) {
            await new Promise((resolve) =>
              setTimeout(resolve, Math.random() * 2),
            );
          }
        } finally {
          mutex.unlock();
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          cancelled_count++;
        } else {
          throw error;
        }
      }
    })(i),
  );

  await Promise.allSettled(all_task_promises);
  clearInterval(monitor_interval);

  const duration = performance.now() - start;

  monitor.snapshot('End');

  let is_ordered = true;
  let first_mismatch = -1;
  for (let i = 0; i < execution_order.length - 1; i++) {
    if (execution_order[i] >= execution_order[i + 1]) {
      is_ordered = false;
      first_mismatch = i;
      break;
    }
  }

  const result = createResult(TASKS, duration, 'FIFO', monitor);

  console.log(
    createTable('B. Massive FIFO Test', {
      'Total Tasks': TASKS,
      Completed: execution_order.length,
      Cancelled: cancelled_count,
      Duration: `${result.duration}ms`,
      Throughput: `${result.ops} ops/sec`,
      'FIFO Order': is_ordered ? 'PASSED' : `FAILED (at ${first_mismatch})`,
      Memory: `${result.memStart} → ${result.memEnd}`,
    }),
  );

  if (monitor.samples.length > 2) {
    console.log('\nMemory Chart:');
    console.log(monitor.renderChart());
  }

  mutex.dispose();
}

/** 测试 C: 极端性能压力测试 */
async function testExtremePerformance() {
  const test_cases = [
    {name: 'Single Thread', workers: 1, ops_per_worker: 1000000},
    {name: 'Low Concurrency', workers: 10, ops_per_worker: 100000},
    {name: 'Medium Concurrency', workers: 100, ops_per_worker: 10000},
    {name: 'High Concurrency', workers: 500, ops_per_worker: 2000},
    {name: 'Extreme Concurrency', workers: 1000, ops_per_worker: 1000},
    {name: 'Super Extreme', workers: 10000, ops_per_worker: 100},
    {name: 'Ultimate', workers: 100000, ops_per_worker: 10},
  ];

  const results: Array<{
    name: string;
    workers: number;
    total_ops: number;
    duration: string;
    ops_per_sec: string;
    peak_queue: number;
    status: string;
  }> = [];

  for (const test_case of test_cases) {
    const mutex = new Mutex();
    const total_ops = test_case.workers * test_case.ops_per_worker;
    const start = performance.now();
    let peak_queue = 0;

    const monitor_interval = setInterval(() => {
      const stats_info = mutex.getStats();
      if (stats_info.queueCapacity > peak_queue) {
        peak_queue = stats_info.queueCapacity;
      }
    }, 10);

    const workers = Array.from({length: test_case.workers}, (_, worker_id) => {
      return (async () => {
        for (let i = 0; i < test_case.ops_per_worker; i++) {
          await mutex.lock();
          const dummy = performance.now();
          void (dummy + worker_id + i);
          mutex.unlock();
        }
      })();
    });

    await Promise.all(workers);
    clearInterval(monitor_interval);

    const duration = performance.now() - start;
    const ops_per_sec = total_ops / (duration / 1000);
    const stats_info = mutex.getStats();

    results.push({
      name: test_case.name,
      workers: test_case.workers,
      total_ops,
      duration: duration.toFixed(2),
      ops_per_sec: Math.round(ops_per_sec).toLocaleString(),
      peak_queue,
      status: !stats_info.isLocked ? 'PASSED' : 'FAILED',
    });

    mutex.dispose();
  }

  console.log(
    createTable('C. Extreme Performance Tests', {
      'Test Cases': results.length,
      '--- Results ---': '---',
      ...Object.fromEntries(
        results.map((r) => [
          `${r.name} (${r.workers}w)`,
          `${r.ops_per_sec} ops/s [${r.status}]`,
        ]),
      ),
    }),
  );
}

/** 测试 D: 马拉松稳定性测试 */
async function testMarathonStability() {
  const DURATION = 10000;
  const WORKER_COUNT = 100;
  const mutex = new Mutex();
  const monitor = new MemoryMonitor();

  runGC();
  monitor.snapshot('Start');

  const start = performance.now();
  let operations = 0;
  let max_queue_length = 0;
  let errors = 0;

  const monitor_interval = setInterval(() => {
    const current_stats = mutex.getStats();
    if (current_stats.queueCapacity > max_queue_length) {
      max_queue_length = current_stats.queueCapacity;
    }
    monitor.snapshot(`${((performance.now() - start) / 1000).toFixed(1)}s`);
  }, 500);

  const workers = Array.from({length: WORKER_COUNT}, (_) => {
    return (async () => {
      while (performance.now() - start < DURATION) {
        try {
          await mutex.lock();
          operations++;

          const workload_type = Math.random();
          if (workload_type < 0.9) {
            await Promise.resolve();
          } else {
            await new Promise((resolve) =>
              setTimeout(resolve, Math.random() * 5),
            );
          }

          mutex.unlock();

          if (Math.random() < 0.05) {
            await Promise.resolve();
          }
        } catch (error) {
          errors++;
        }
      }
    })();
  });

  await Promise.all(workers);
  clearInterval(monitor_interval);

  const actual_duration = performance.now() - start;

  const final_stats = mutex.getStats();

  monitor.snapshot('End');
  const result = createResult(operations, actual_duration, 'Marathon', monitor);

  console.log(
    createTable('D. Marathon Stability Test', {
      Duration: `${actual_duration.toFixed(0)}ms`,
      'Total Operations': operations.toLocaleString(),
      'Error Count': errors,
      Throughput: `${result.ops} ops/sec`,
      'Peak Queue Length': max_queue_length,
      Status: !final_stats.isLocked && errors === 0 ? 'PASSED' : 'FAILED',
      Memory: `${result.memStart} → ${result.memEnd}`,
    }),
  );

  if (monitor.samples.length > 2) {
    console.log('\nMemory Chart:');
    console.log(monitor.renderChart());
  }

  mutex.dispose();
}

/** 测试 E: 随机取消测试 */
async function testCancellationRandom() {
  const TASKS = 2000;
  const CANCELLATION_PROBABILITY = 0.5;
  const mutex = new Mutex();
  const monitor = new MemoryMonitor();

  runGC();
  monitor.snapshot('Start');

  let completed = 0;
  let cancelled = 0;
  let errors = 0;

  const start = performance.now();

  const monitor_interval = setInterval(() => {
    monitor.snapshot(`${completed + cancelled} processed`);
  }, 500);

  const controllers: AbortController[] = [];
  const promises: Promise<void>[] = [];

  for (let i = 0; i < TASKS; i++) {
    const controller = new AbortController();
    controllers.push(controller);

    const promise = mutex
      .lock(controller.signal)
      .then(() => {
        completed++;
        const process_time = Math.random() * 10;
        return new Promise<void>((resolve) => {
          setTimeout(() => {
            mutex.unlock();
            resolve();
          }, process_time);
        });
      })
      .catch((error) => {
        if (error instanceof Error && error.name === 'AbortError') {
          cancelled++;
        } else {
          errors++;
        }
      });

    promises.push(promise);
  }

  const cancel_promises: Promise<void>[] = [];

  for (let i = 0; i < TASKS; i++) {
    if (Math.random() < CANCELLATION_PROBABILITY) {
      const delay = Math.random() * 100;
      cancel_promises.push(
        new Promise<void>((resolve) => {
          setTimeout(() => {
            controllers[i].abort();
            resolve();
          }, delay);
        }),
      );
    }
  }

  await Promise.all(cancel_promises);
  await Promise.allSettled(promises);
  clearInterval(monitor_interval);

  const duration = performance.now() - start;

  monitor.snapshot('End');
  const final_stats = mutex.getStats();
  const result = createResult(completed, duration, 'RandomCancel', monitor);

  const passed =
    completed + cancelled + errors === TASKS &&
    errors === 0 &&
    !final_stats.isLocked;

  console.log(
    createTable('E. Random Cancellation Test', {
      'Total Tasks': TASKS,
      Completed: completed,
      Cancelled: cancelled,
      Errors: errors,
      Duration: `${result.duration}ms`,
      Throughput: `${result.ops} ops/sec`,
      Status: passed ? 'PASSED' : 'FAILED',
      Memory: `${result.memStart} → ${result.memEnd}`,
    }),
  );

  if (monitor.samples.length > 2) {
    console.log('\nMemory Chart:');
    console.log(monitor.renderChart());
  }

  mutex.dispose();
}

/** 测试 F: 极端取消场景 */
async function testCancellationExtreme() {
  // 场景 1: 信号在进入 lock 之前就已经被 abort 了
  await (async () => {
    const TASKS = 2000;
    const mutex = new Mutex();
    const monitor = new MemoryMonitor();

    runGC();
    monitor.snapshot('Start');

    let cancelled = 0;
    let errors = 0;

    const start = performance.now();

    const controllers = Array.from({length: TASKS}, () => {
      const c = new AbortController();
      c.abort();
      return c;
    });

    const promises = controllers.map((c) =>
      mutex
        .lock(c.signal)
        .then(() => {
          mutex.unlock();
        })
        .catch((err) => {
          if (err instanceof Error && err.name === 'AbortError') cancelled++;
          else errors++;
        }),
    );

    await Promise.allSettled(promises);

    const duration = performance.now() - start;

    monitor.snapshot('End');
    const result = createResult(0, duration, 'PreAborted', monitor);

    const passed = cancelled === TASKS && errors === 0;

    console.log(
      createTable('F1. Pre-Aborted Signal Test', {
        'Total Tasks': TASKS,
        Cancelled: cancelled,
        Errors: errors,
        Duration: `${result.duration}ms`,
        Status: passed ? 'PASSED' : 'FAILED',
        Memory: `${result.memStart} → ${result.memEnd}`,
      }),
    );

    mutex.dispose();
  })();

  // 场景 2: 任务都在 queue 里排队时，突然集体 abort
  await (async () => {
    const TASKS = 3000;
    const mutex = new Mutex();
    const monitor = new MemoryMonitor();

    runGC();
    monitor.snapshot('Start');

    let completed = 0;
    let cancelled = 0;
    let errors = 0;

    const start = performance.now();

    await mutex.lock();

    const controllers: AbortController[] = [];
    const promises = Array.from({length: TASKS}, (_) => {
      const c = new AbortController();
      controllers.push(c);
      return mutex
        .lock(c.signal)
        .then(() => {
          completed++;
          mutex.unlock();
        })
        .catch((err) => {
          if (err instanceof Error && err.name === 'AbortError') cancelled++;
          else errors++;
        });
    });

    controllers.forEach((c) => c.abort());
    mutex.unlock();

    await Promise.allSettled(promises);

    const duration = performance.now() - start;

    monitor.snapshot('End');
    const result = createResult(0, duration, 'QueueAbort', monitor);

    const passed = cancelled === TASKS && completed === 0 && errors === 0;

    console.log(
      createTable('F2. Queue Abort Test', {
        'Total Tasks': TASKS,
        Completed: completed,
        Cancelled: cancelled,
        Errors: errors,
        Duration: `${result.duration}ms`,
        Status: passed ? 'PASSED' : 'FAILED',
        Memory: `${result.memStart} → ${result.memEnd}`,
      }),
    );

    mutex.dispose();
  })();
}

/** 测试 G: 极端性能压力测试（含随机取消） */
async function testExtremePerformanceWithCancellation() {
  const test_cases = [
    {
      name: 'Single Thread',
      workers: 1,
      ops_per_worker: 1000000,
      cancel_ratio: 0,
    },
    {
      name: 'Low Concurrency',
      workers: 10,
      ops_per_worker: 100000,
      cancel_ratio: 0.01,
    },
    {
      name: 'Medium Concurrency',
      workers: 100,
      ops_per_worker: 10000,
      cancel_ratio: 0.03,
    },
    {
      name: 'High Concurrency',
      workers: 500,
      ops_per_worker: 2000,
      cancel_ratio: 0.05,
    },
    {
      name: 'Extreme Concurrency',
      workers: 1000,
      ops_per_worker: 1000,
      cancel_ratio: 0.1,
    },
  ];

  const results: Array<{
    name: string;
    workers: number;
    completed: number;
    cancelled: number;
    duration: string;
    ops_per_sec: string;
    status: string;
  }> = [];

  for (const test_case of test_cases) {
    const mutex = new Mutex();
    const start = performance.now();
    let completed_ops = 0;
    let cancelled_ops = 0;
    let errors = 0;

    const workers = Array.from({length: test_case.workers}, (_, worker_id) => {
      return (async () => {
        for (let i = 0; i < test_case.ops_per_worker; i++) {
          const should_cancel = Math.random() < test_case.cancel_ratio;

          if (should_cancel && test_case.cancel_ratio > 0) {
            const controller = new AbortController();
            const cancel_delay = Math.random() * 100;

            const task_promise = mutex
              .lock(controller.signal)
              .then(() => {
                completed_ops++;
                const dummy = performance.now();
                void (dummy + worker_id + i);
                mutex.unlock();
              })
              .catch((error) => {
                if (error instanceof Error && error.name === 'AbortError') {
                  cancelled_ops++;
                } else {
                  errors++;
                }
              });

            setTimeout(() => {
              controller.abort();
            }, cancel_delay);

            await task_promise;
          } else {
            try {
              await mutex.lock();
              completed_ops++;
              const dummy = performance.now();
              void (dummy + worker_id + i);
              mutex.unlock();
            } catch (error) {
              errors++;
            }
          }
        }
      })();
    });

    await Promise.all(workers);

    const duration = performance.now() - start;
    const ops_per_sec = completed_ops / (duration / 1000);
    const stats_info = mutex.getStats();

    results.push({
      name: test_case.name,
      workers: test_case.workers,
      completed: completed_ops,
      cancelled: cancelled_ops,
      duration: duration.toFixed(2),
      ops_per_sec: Math.round(ops_per_sec).toLocaleString(),
      status: !stats_info.isLocked && errors === 0 ? 'PASSED' : 'FAILED',
    });

    mutex.dispose();
  }

  console.log(
    createTable('G. Extreme Performance with Cancellation', {
      'Test Cases': results.length,
      '--- Results ---': '---',
      ...Object.fromEntries(
        results.map((r) => [
          `${r.name} (${r.workers}w)`,
          `${r.ops_per_sec} ops/s [${r.status}]`,
        ]),
      ),
    }),
  );
}

// ========================================
// 主入口
// ========================================
async function main() {
  console.log('Mutex Benchmark Suite\n');

  await jitWarmup();

  await testUltraFastOperations();
  console.log('\n');

  await testMassiveFIFO();
  console.log('\n');

  await testExtremePerformance();
  console.log('\n');

  await testMarathonStability();
  console.log('\n');

  await testCancellationRandom();
  console.log('\n');

  await testCancellationExtreme();
  console.log('\n');

  await testExtremePerformanceWithCancellation();

  console.log('\nAll tests completed.');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
