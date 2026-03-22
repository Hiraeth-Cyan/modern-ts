// ========================================
// ./__benchmark__/await-benchmark.ts
// ========================================

import {dynamicAwait} from '../src/helper';
import Table from 'cli-table3';

// ========================================
// 辅助函数
// ========================================

/** 运行基准测试 */
async function runBenchmark(
  iterations: number,
  test_fn: (value: unknown) => unknown,
  value: unknown,
) {
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    await test_fn(value);
  }
  return (performance.now() - start).toFixed(2);
}

/** 构建 CLI 表格 */
function createTable(title: string, data: Record<string, unknown>) {
  const table = new Table({
    colWidths: [30, 25],
    style: {head: [], border: ['grey']},
  });
  table.push([{colSpan: 2, content: title, hAlign: 'center'}]);
  Object.entries(data).forEach(([k, v]) => table.push([k, String(v)]));
  return table.toString();
}

// ========================================
// 测试用例
// ========================================

/** 测试 A: 同步值性能对比 */
async function testSync() {
  const ITERATIONS = 1_000_000;
  const syncValue = 42;

  console.log('⏳ Running Sync Value Test...');

  const alwaysAwaitRes = await runBenchmark(
    ITERATIONS,
    async (v) => await v,
    syncValue,
  );
  const dynamicAwaitRes = await runBenchmark(
    ITERATIONS,
    async (v) => await dynamicAwait(v),
    syncValue,
  );

  const diff = parseFloat(alwaysAwaitRes) - parseFloat(dynamicAwaitRes);
  const winner = diff > 0 ? 'dynamicAwait is faster' : 'alwaysAwait is faster';

  console.log(
    createTable('A. Sync Value Benchmark', {
      Iterations: ITERATIONS,
      '--- Results ---': '---',
      alwaysAwait: `${alwaysAwaitRes}ms`,
      dynamicAwait: `${dynamicAwaitRes}ms`,
      '--- Comparison ---': '---',
      Difference: `${Math.abs(diff).toFixed(2)}ms`,
      Winner: winner,
    }),
  );
}

/** 测试 B: 异步值性能对比 */
async function testAsync() {
  const ITERATIONS = 1_000_000;
  const asyncValue = Promise.resolve(42);

  console.log('⏳ Running Async Value Test...');

  const alwaysAwaitRes = await runBenchmark(
    ITERATIONS,
    async (v) => await v,
    asyncValue,
  );
  const dynamicAwaitRes = await runBenchmark(
    ITERATIONS,
    async (v) => await dynamicAwait(v),
    asyncValue,
  );

  const diff = parseFloat(alwaysAwaitRes) - parseFloat(dynamicAwaitRes);
  const winner = diff > 0 ? 'dynamicAwait is faster' : 'alwaysAwait is faster';

  console.log(
    createTable('B. Async Value Benchmark', {
      Iterations: ITERATIONS,
      '--- Results ---': '---',
      alwaysAwait: `${alwaysAwaitRes}ms`,
      dynamicAwait: `${dynamicAwaitRes}ms`,
      '--- Comparison ---': '---',
      Difference: `${Math.abs(diff).toFixed(2)}ms`,
      Winner: winner,
    }),
  );
}

/** 测试 C: 混合值性能对比 (50% 同步 + 50% 异步) */
async function testMixed() {
  const ITERATIONS = 1_000_000;
  const syncValue = 42;

  const values: (number | Promise<number>)[] = [];
  for (let i = 0; i < ITERATIONS; i++) {
    values.push(i % 2 === 0 ? syncValue : Promise.resolve(syncValue));
  }

  console.log('⏳ Running Mixed Value Test (50% Sync + 50% Async)...');

  const alwaysAwaitRes = await runBenchmark(
    ITERATIONS,
    async (v) => await v,
    values,
  );
  const dynamicAwaitRes = await runBenchmark(
    ITERATIONS,
    async (v) => await dynamicAwait(v),
    values,
  );

  const diff = parseFloat(alwaysAwaitRes) - parseFloat(dynamicAwaitRes);
  const winner = diff > 0 ? 'dynamicAwait is faster' : 'alwaysAwait is faster';

  console.log(
    createTable('C. Mixed Value Benchmark', {
      Iterations: ITERATIONS,
      Distribution: '50% Sync + 50% Async',
      '--- Results ---': '---',
      alwaysAwait: `${alwaysAwaitRes}ms`,
      dynamicAwait: `${dynamicAwaitRes}ms`,
      '--- Comparison ---': '---',
      Difference: `${Math.abs(diff).toFixed(2)}ms`,
      Winner: winner,
    }),
  );
}

// ========================================
// 主入口
// ========================================
async function main() {
  console.log('🚀 Await Performance Benchmark Suite\n');
  await testSync();
  console.log('\n');
  await testAsync();
  console.log('\n');
  await testMixed();

  console.log('\n✨ All tests completed.');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
