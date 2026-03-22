// ========================================
// ./__benchmark__/event_emitter.ts
// ========================================

import {EventEmitter} from '../src/Reactive/event_emitter';
import {EventEmitter as NodeEventEmitter} from 'events';
import {runGC, MemoryMonitor, formatBytes} from './helper';
import Table from 'cli-table3';

// ========================================
// 辅助函数与类型
// ========================================

type BenchEvents = {
  test: [number];
  multi: [number, string, boolean];
  error: [Error];
  newListener: [string | symbol, (...args: unknown[]) => void];
  removeListener: [string | symbol, (...args: unknown[]) => void];
};

interface TestResult {
  duration: number;
  ops: number;
  memStart: string;
  memEnd: string;
  memStartRaw: number;
  memEndRaw: number;
}

function createResult(
  operations: number,
  duration: number,
  monitor: MemoryMonitor,
): TestResult {
  const ops = duration > 0 ? (operations / duration) * 1000 : 0;
  // 环境受控，直接访问 samples，增加防御性下标访问
  const startRaw = monitor.samples[0] || 0;
  const endRaw = monitor.samples[monitor.samples.length - 1] || 0;

  return {
    duration,
    ops,
    memStart: formatBytes(startRaw),
    memEnd: formatBytes(endRaw),
    memStartRaw: startRaw,
    memEndRaw: endRaw,
  };
}

// 通用对比表格生成器
function createComparisonTable(
  title: string,
  myRes: TestResult,
  nodeRes: TestResult,
  extraRows?: Record<string, {my: string | number; node: string | number}>,
) {
  const table = new Table({
    head: ['Metric', 'This Library', 'Node.js', 'Diff'],
    colWidths: [20, 20, 20, 20],
    style: {head: ['cyan'], border: ['grey']},
  });

  table.push([{colSpan: 4, content: title, hAlign: 'center'}]);

  // --- Duration ---
  const durDiffVal = myRes.duration - nodeRes.duration;
  const durDiffPct =
    nodeRes.duration > 0 ? (durDiffVal / nodeRes.duration) * 100 : 0;
  table.push([
    'Duration (ms)',
    myRes.duration.toFixed(2),
    nodeRes.duration.toFixed(2),
    `${durDiffVal > 0 ? '+' : ''}${durDiffVal.toFixed(2)}ms (${durDiffPct > 0 ? '+' : ''}${durDiffPct.toFixed(1)}%)`,
  ]);

  // --- Ops/sec ---
  const opsDiffVal = myRes.ops - nodeRes.ops;
  const opsDiffPct = nodeRes.ops > 0 ? (opsDiffVal / nodeRes.ops) * 100 : 0;
  table.push([
    'Ops/sec',
    myRes.ops.toFixed(0),
    nodeRes.ops.toFixed(0),
    `${opsDiffVal > 0 ? '+' : ''}${opsDiffPct.toFixed(1)}%`,
  ]);

  // --- Memory Helper ---
  const formatMemDiff = (my: number, node: number) => {
    const diff = my - node;
    if (diff === 0) return '0 B';
    // 处理 NaN 或非数值情况
    if (isNaN(diff)) return 'N/A';
    // 使用绝对值计算单位，然后补符号
    const absStr = formatBytes(Math.abs(diff));
    return `${diff > 0 ? '+' : '-'}${absStr}`;
  };

  // --- Memory Start ---
  table.push([
    'Memory (Start)',
    myRes.memStart,
    nodeRes.memStart,
    formatMemDiff(myRes.memStartRaw, nodeRes.memStartRaw),
  ]);

  // --- Memory End ---
  table.push([
    'Memory (End)',
    myRes.memEnd,
    nodeRes.memEnd,
    formatMemDiff(myRes.memEndRaw, nodeRes.memEndRaw),
  ]);

  // --- Extra checks (with 1% tolerance) ---
  if (extraRows) {
    Object.entries(extraRows).forEach(([k, v]) => {
      const myVal = parseFloat(String(v.my));
      const nodeVal = parseFloat(String(v.node));
      let diffContent = '-';

      if (!isNaN(myVal) && !isNaN(nodeVal) && nodeVal !== 0) {
        const diffPct = Math.abs((myVal - nodeVal) / nodeVal);
        if (diffPct <= 0.01) {
          diffContent = '✓ Match';
        } else {
          const diffVal = myVal - nodeVal;
          diffContent = `${diffVal > 0 ? '+' : ''}${diffVal.toFixed(0)} (${(diffPct * 100).toFixed(1)}%)`;
        }
      } else {
        diffContent = v.my === v.node ? '✓ Match' : 'Mismatch';
      }

      table.push([k, String(v.my), String(v.node), diffContent]);
    });
  }

  return table.toString();
}

function jitWarmup() {
  console.log('🔥 JIT Warmup (Both Libs)...');
  runGC();

  const warmup_start = performance.now();
  const myEmitter = new EventEmitter<BenchEvents>();
  for (let i = 0; i < 20000; i++) {
    const h = () => {};
    myEmitter.on('test', h);
    myEmitter.emit('test', i);
    myEmitter.off('test', h);
  }

  runGC();

  const nodeEmitter = new NodeEventEmitter();
  for (let i = 0; i < 20000; i++) {
    const h = () => {};
    nodeEmitter.on('test', h);
    nodeEmitter.emit('test', i);
    nodeEmitter.off('test', h);
  }

  const warmup_duration = performance.now() - warmup_start;
  console.log(`✅ JIT Warmup completed: ${warmup_duration.toFixed(2)}ms\n`);
  runGC();
}

// ========================================
// 测试用例
// ========================================

function testBasicOperations() {
  const ITERATIONS = 1_000_000;
  const handler = (_n: number) => {};

  // -- This Library Test --
  runGC();
  const myMonitor = new MemoryMonitor();
  myMonitor.snapshot('Start');

  const myEmitter = new EventEmitter<BenchEvents>();
  const myStart = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    myEmitter.on('test', handler);
    myEmitter.emit('test', i);
    myEmitter.off('test', handler);
  }
  const myDuration = performance.now() - myStart;
  myMonitor.snapshot('End');
  const myRes = createResult(ITERATIONS * 3, myDuration, myMonitor);

  // -- Node.js Test --
  runGC();
  const nodeMonitor = new MemoryMonitor();
  nodeMonitor.snapshot('Start');

  const nodeEmitter = new NodeEventEmitter();
  const nodeStart = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    nodeEmitter.on('test', handler);
    nodeEmitter.emit('test', i);
    nodeEmitter.off('test', handler);
  }
  const nodeDuration = performance.now() - nodeStart;
  nodeMonitor.snapshot('End');
  const nodeRes = createResult(ITERATIONS * 3, nodeDuration, nodeMonitor);

  console.log(
    createComparisonTable('A. Basic Operations (on/emit/off)', myRes, nodeRes),
  );
}

function testEmitPerformance() {
  const ITERATIONS = 5_000_000;
  let count_my = 0;
  let count_node = 0;
  const handler_my = (_n: number) => {
    count_my++;
  };
  const handler_node = (_n: number) => {
    count_node++;
  };

  // -- This Library --
  const myEmitter = new EventEmitter<BenchEvents>();
  myEmitter.on('test', handler_my);

  runGC();
  const myMonitor = new MemoryMonitor();
  myMonitor.snapshot('Start');

  const myStart = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    myEmitter.emit('test', i);
  }
  const myDuration = performance.now() - myStart;
  myMonitor.snapshot('End');
  const myRes = createResult(ITERATIONS, myDuration, myMonitor);

  // -- Node.js --
  const nodeEmitter = new NodeEventEmitter();
  nodeEmitter.on('test', handler_node);

  runGC();
  const nodeMonitor = new MemoryMonitor();
  nodeMonitor.snapshot('Start');

  const nodeStart = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    nodeEmitter.emit('test', i);
  }
  const nodeDuration = performance.now() - nodeStart;
  nodeMonitor.snapshot('End');
  const nodeRes = createResult(ITERATIONS, nodeDuration, nodeMonitor);

  console.log(
    createComparisonTable(
      'B. Emit Performance (single listener)',
      myRes,
      nodeRes,
      {
        'Call Count': {my: count_my, node: count_node},
      },
    ),
  );
}

function testMultipleListeners() {
  const ITERATIONS = 1_000_000;
  const LISTENER_COUNTS = [1, 5, 10, 50, 100];

  const table = new Table({
    head: ['Listeners', 'This Lib (ops/sec)', 'Node.js (ops/sec)', 'Diff'],
    style: {head: ['cyan'], border: ['grey']},
  });

  for (const count of LISTENER_COUNTS) {
    // -- This Library --
    const myEmitter = new EventEmitter<BenchEvents>();
    for (let i = 0; i < count; i++) myEmitter.on('test', () => {});

    runGC();
    const myStart = performance.now();
    for (let i = 0; i < ITERATIONS; i++) myEmitter.emit('test', i);
    const myDuration = performance.now() - myStart;
    const myOps = (ITERATIONS / myDuration) * 1000;

    // -- Node.js --
    const nodeEmitter = new NodeEventEmitter();
    for (let i = 0; i < count; i++) nodeEmitter.on('test', () => {});

    runGC();
    const nodeStart = performance.now();
    for (let i = 0; i < ITERATIONS; i++) nodeEmitter.emit('test', i);
    const nodeDuration = performance.now() - nodeStart;
    const nodeOps = (ITERATIONS / nodeDuration) * 1000;

    const diff = nodeOps > 0 ? ((myOps - nodeOps) / nodeOps) * 100 : 0;
    table.push([
      count,
      myOps.toFixed(0),
      nodeOps.toFixed(0),
      `${diff > 0 ? '+' : ''}${diff.toFixed(1)}%`,
    ]);
  }

  console.log(table.toString());
}

function testPrependListener() {
  const ITERATIONS = 500_000;
  const handler = (_n: number) => {};

  // -- This Library --
  const myEmitter = new EventEmitter<BenchEvents>();
  myEmitter.on('test', handler);

  runGC();
  const myMonitor = new MemoryMonitor();
  myMonitor.snapshot('Start');

  const myStart = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    myEmitter.prependListener('test', handler);
    myEmitter.emit('test', i);
    myEmitter.off('test', handler);
  }
  const myDuration = performance.now() - myStart;
  myMonitor.snapshot('End');
  const myRes = createResult(ITERATIONS * 3, myDuration, myMonitor);

  // -- Node.js --
  const nodeEmitter = new NodeEventEmitter();
  nodeEmitter.on('test', handler);

  runGC();
  const nodeMonitor = new MemoryMonitor();
  nodeMonitor.snapshot('Start');

  const nodeStart = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    nodeEmitter.prependListener('test', handler);
    nodeEmitter.emit('test', i);
    nodeEmitter.off('test', handler);
  }
  const nodeDuration = performance.now() - nodeStart;
  nodeMonitor.snapshot('End');
  const nodeRes = createResult(ITERATIONS * 3, nodeDuration, nodeMonitor);

  console.log(
    createComparisonTable('D. PrependListener Performance', myRes, nodeRes),
  );
}

function testOncePerformance() {
  const ITERATIONS = 500_000;
  let count_my = 0;
  let count_node = 0;

  // -- This Library --
  runGC();
  const myMonitor = new MemoryMonitor();
  myMonitor.snapshot('Start');

  const myStart = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    const emitter = new EventEmitter<BenchEvents>();
    emitter.once('test', () => {
      count_my++;
    });
    emitter.emit('test', i);
  }
  const myDuration = performance.now() - myStart;
  myMonitor.snapshot('End');
  const myRes = createResult(ITERATIONS, myDuration, myMonitor);

  // -- Node.js --
  runGC();
  const nodeMonitor = new MemoryMonitor();
  nodeMonitor.snapshot('Start');

  const nodeStart = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    const emitter = new NodeEventEmitter();
    emitter.once('test', () => {
      count_node++;
    });
    emitter.emit('test', i);
  }
  const nodeDuration = performance.now() - nodeStart;
  nodeMonitor.snapshot('End');
  const nodeRes = createResult(ITERATIONS, nodeDuration, nodeMonitor);

  console.log(
    createComparisonTable('E. Once Performance', myRes, nodeRes, {
      'Call Count': {my: count_my, node: count_node},
    }),
  );
}

function testArgumentCount() {
  const ITERATIONS = 2_000_000;

  console.log('📊 Testing impact of argument count on emit...');

  const cases = [
    {name: '0 args', args: []},
    {name: '1 arg', args: [1]},
    {name: '4 args', args: [1, 's', true, {}]},
  ];

  const table = new Table({
    head: ['Args', 'This Lib (ops/sec)', 'Node.js (ops/sec)', 'Diff'],
    style: {head: ['cyan'], border: ['grey']},
  });

  for (const c of cases) {
    const myEmitter = new EventEmitter<Record<string, unknown[]>>();
    const nodeEmitter = new NodeEventEmitter();

    const noop = () => {};
    myEmitter.on('test', noop);
    nodeEmitter.on('test', noop);

    // My Lib
    runGC();
    const mStart = performance.now();
    for (let i = 0; i < ITERATIONS; i++) myEmitter.emit('test', ...c.args);
    const mOps = (ITERATIONS / (performance.now() - mStart)) * 1000;

    // Node
    runGC();
    const nStart = performance.now();
    for (let i = 0; i < ITERATIONS; i++) nodeEmitter.emit('test', ...c.args);
    const nOps = (ITERATIONS / (performance.now() - nStart)) * 1000;

    const diff = nOps > 0 ? ((mOps - nOps) / nOps) * 100 : 0;
    table.push([
      c.name,
      mOps.toFixed(0),
      nOps.toFixed(0),
      `${diff > 0 ? '+' : ''}${diff.toFixed(1)}%`,
    ]);
  }
  console.log(table.toString());
}

function testSymbolEvent() {
  const ITERATIONS = 2_000_000;
  const sym = Symbol('test');
  let count_my = 0;
  let count_node = 0;

  // -- This Library --
  const myEmitter = new EventEmitter();
  myEmitter.on(sym, () => count_my++);

  runGC();
  const myMonitor = new MemoryMonitor();
  myMonitor.snapshot('Start');

  const myStart = performance.now();
  for (let i = 0; i < ITERATIONS; i++) myEmitter.emit(sym);
  const myDuration = performance.now() - myStart;
  myMonitor.snapshot('End');
  const myRes = createResult(ITERATIONS, myDuration, myMonitor);

  // -- Node.js --
  const nodeEmitter = new NodeEventEmitter();
  nodeEmitter.on(sym, () => count_node++);

  runGC();
  const nodeMonitor = new MemoryMonitor();
  nodeMonitor.snapshot('Start');

  const nodeStart = performance.now();
  for (let i = 0; i < ITERATIONS; i++) nodeEmitter.emit(sym);
  const nodeDuration = performance.now() - nodeStart;
  nodeMonitor.snapshot('End');
  const nodeRes = createResult(ITERATIONS, nodeDuration, nodeMonitor);

  console.log(
    createComparisonTable('F. Symbol Event Performance', myRes, nodeRes, {
      'Trigger Count': {my: count_my, node: count_node},
    }),
  );
}

function testDynamicOperations() {
  const ITERATIONS = 100_000;

  // -- This Library --
  runGC();
  let my_calls = 0;
  const myEmitter = new EventEmitter<BenchEvents>();
  const my_base = () => {
    my_calls++;
  };
  const my_inner = () => {};

  const myMonitor = new MemoryMonitor();
  myMonitor.snapshot('Start');

  const myStart = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    const dynamic = () => {
      myEmitter.on('test', my_inner);
      myEmitter.off('test', my_base);
    };
    myEmitter.on('test', my_base);
    myEmitter.on('test', dynamic);
    myEmitter.emit('test', i);
    myEmitter.off('test', dynamic);
    myEmitter.off('test', my_inner);
    myEmitter.on('test', my_base);
  }
  const myDuration = performance.now() - myStart;
  myMonitor.snapshot('End');
  const myRes = createResult(ITERATIONS, myDuration, myMonitor);

  // -- Node.js --
  runGC();
  let node_calls = 0;
  const nodeEmitter = new NodeEventEmitter();
  const node_base = () => {
    node_calls++;
  };
  const node_inner = () => {};

  const nodeMonitor = new MemoryMonitor();
  nodeMonitor.snapshot('Start');

  const nodeStart = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    const dynamic = () => {
      nodeEmitter.on('test', node_inner);
      nodeEmitter.off('test', node_base);
    };
    nodeEmitter.on('test', node_base);
    nodeEmitter.on('test', dynamic);
    nodeEmitter.emit('test', i);
    nodeEmitter.off('test', dynamic);
    nodeEmitter.off('test', node_inner);
    nodeEmitter.on('test', node_base);
  }
  const nodeDuration = performance.now() - nodeStart;
  nodeMonitor.snapshot('End');
  const nodeRes = createResult(ITERATIONS, nodeDuration, nodeMonitor);

  console.log(
    createComparisonTable('G. Dynamic Operations', myRes, nodeRes, {
      'Call Count': {my: my_calls, node: node_calls},
    }),
  );
}

function testMassiveListeners() {
  const LISTENER_COUNT = 10_000;
  const EMIT_COUNT = 1_000;

  // -- This Library --
  runGC();
  const myEmitter = new EventEmitter<BenchEvents>();
  const myAddStart = performance.now();
  for (let i = 0; i < LISTENER_COUNT; i++) myEmitter.on('test', () => {});
  const myAddDur = performance.now() - myAddStart;

  const myEmitStart = performance.now();
  for (let i = 0; i < EMIT_COUNT; i++) myEmitter.emit('test', i);
  const myEmitDur = performance.now() - myEmitStart;

  const myRemoveStart = performance.now();
  myEmitter.removeAllListeners('test');
  const myRemoveDur = performance.now() - myRemoveStart;

  // -- Node.js --
  runGC();
  const nodeEmitter = new NodeEventEmitter();
  const nodeAddStart = performance.now();
  for (let i = 0; i < LISTENER_COUNT; i++) nodeEmitter.on('test', () => {});
  const nodeAddDur = performance.now() - nodeAddStart;

  const nodeEmitStart = performance.now();
  for (let i = 0; i < EMIT_COUNT; i++) nodeEmitter.emit('test', i);
  const nodeEmitDur = performance.now() - nodeEmitStart;

  const nodeRemoveStart = performance.now();
  nodeEmitter.removeAllListeners('test');
  const nodeRemoveDur = performance.now() - nodeRemoveStart;

  const table = new Table({
    head: ['Operation', 'This Library (ms)', 'Node.js (ms)', 'Diff'],
    style: {head: ['cyan'], border: ['grey']},
  });
  table.push([
    {colSpan: 4, content: 'H. Massive Listeners (10k)', hAlign: 'center'},
  ]);

  const formatRow = (name: string, my: number, node: number) => {
    const diff = node > 0 ? ((my - node) / node) * 100 : 0;
    return [
      name,
      my.toFixed(2),
      node.toFixed(2),
      `${diff > 0 ? '+' : ''}${diff.toFixed(1)}%`,
    ];
  };

  table.push(formatRow('Add All', myAddDur, nodeAddDur));
  table.push(formatRow('Emit x1000', myEmitDur, nodeEmitDur));
  table.push(formatRow('Remove All', myRemoveDur, nodeRemoveDur));

  console.log(table.toString());
}

function testMemoryPressure() {
  const BATCHES = 500;
  const LISTENERS_PER_BATCH = 100;

  console.log('⏳ Running Memory Pressure Test (Both Libs)...\n');

  // ============================================
  // 1. This Library Test
  // ============================================
  const myMonitor = new MemoryMonitor();

  runGC();
  myMonitor.snapshot('Init');

  for (let b = 0; b < BATCHES; b++) {
    const emitter = new EventEmitter<BenchEvents>();
    for (let i = 0; i < LISTENERS_PER_BATCH; i++) {
      emitter.on('test', () => {});
    }
    emitter.emit('test', b);

    if ((b + 1) % 100 === 0) {
      runGC();
      myMonitor.snapshot(`${Math.round(((b + 1) / BATCHES) * 100)}%`);
    }
  }
  runGC();
  myMonitor.snapshot('Final');

  // ============================================
  // 2. Node.js Test
  // ============================================
  const nodeMonitor = new MemoryMonitor();

  runGC();
  nodeMonitor.snapshot('Init');

  for (let b = 0; b < BATCHES; b++) {
    const emitter = new NodeEventEmitter();
    for (let i = 0; i < LISTENERS_PER_BATCH; i++) {
      emitter.on('test', () => {});
    }
    emitter.emit('test', b);

    if ((b + 1) % 100 === 0) {
      runGC();
      nodeMonitor.snapshot(`${Math.round(((b + 1) / BATCHES) * 100)}%`);
    }
  }
  runGC();
  nodeMonitor.snapshot('Final');

  // ============================================
  // 3. Result Comparison
  // ============================================
  const myStart = myMonitor.samples[0];
  const myEnd = myMonitor.samples[myMonitor.samples.length - 1];
  const nodeStart = nodeMonitor.samples[0];
  const nodeEnd = nodeMonitor.samples[nodeMonitor.samples.length - 1];

  const myLeaked = myEnd > myStart * 1.5 && myEnd - myStart > 1024 * 1024;
  const nodeLeaked =
    nodeEnd > nodeStart * 1.5 && nodeEnd - nodeStart > 1024 * 1024;

  const table = new Table({
    head: ['Metric', 'This Library', 'Node.js', 'Diff'],
    colWidths: [20, 20, 20, 20],
    style: {head: ['cyan'], border: ['grey']},
  });

  table.push([
    {colSpan: 4, content: 'I. Memory Pressure Test', hAlign: 'center'},
  ]);

  const diffBytes = myEnd - myStart - (nodeEnd - nodeStart);
  // 手动格式化以处理负数
  const diffBytesStr =
    diffBytes === 0
      ? '0 B'
      : `${diffBytes > 0 ? '+' : '-'}${formatBytes(Math.abs(diffBytes))}`;

  table.push([
    'Start Memory',
    formatBytes(myStart),
    formatBytes(nodeStart),
    '-',
  ]);
  table.push(['End Memory', formatBytes(myEnd), formatBytes(nodeEnd), '-']);
  table.push([
    'Memory Growth',
    formatBytes(myEnd - myStart),
    formatBytes(nodeEnd - nodeStart),
    diffBytesStr,
  ]);
  table.push([
    'Leak Status',
    myLeaked ? '⚠ Suspected' : '✓ Stable',
    nodeLeaked ? '⚠ Suspected' : '✓ Stable',
    '-',
  ]);

  console.log(table.toString());

  console.log('\n📈 This Library Memory Trend:');
  console.log(myMonitor.renderChart());
  console.log('\n📈 Node.js Memory Trend:');
  console.log(nodeMonitor.renderChart());
}

function testListenerQueryMethods() {
  const ITERATIONS = 1_000_000;

  // -- This Library --
  const myEmitter = new EventEmitter<BenchEvents>();
  for (let i = 0; i < 10; i++) myEmitter.on('test', () => {});

  runGC();
  const myMonitor = new MemoryMonitor();
  myMonitor.snapshot('Start');

  const myStart = performance.now();
  for (let i = 0; i < ITERATIONS; i++) myEmitter.listenerCount('test');
  const myDuration = performance.now() - myStart;

  myMonitor.snapshot('End');
  const myRes = createResult(ITERATIONS, myDuration, myMonitor);

  // -- Node.js --
  const nodeEmitter = new NodeEventEmitter();
  for (let i = 0; i < 10; i++) nodeEmitter.on('test', () => {});

  runGC();
  const nodeMonitor = new MemoryMonitor();
  nodeMonitor.snapshot('Start');

  const nodeStart = performance.now();
  for (let i = 0; i < ITERATIONS; i++) nodeEmitter.listenerCount('test');
  const nodeDuration = performance.now() - nodeStart;

  nodeMonitor.snapshot('End');
  const nodeRes = createResult(ITERATIONS, nodeDuration, nodeMonitor);

  console.log(
    createComparisonTable('J. Listener Query Methods', myRes, nodeRes),
  );
}

function testRemoveAllListeners() {
  const ITERATIONS = 50_000;
  const LISTENERS = 50;

  // -- This Library --
  runGC();
  const myMonitor = new MemoryMonitor();
  myMonitor.snapshot('Start');

  const myStart = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    const emitter = new EventEmitter<BenchEvents>();
    for (let j = 0; j < LISTENERS; j++) emitter.on('test', () => {});
    emitter.removeAllListeners('test');
  }
  const myDuration = performance.now() - myStart;
  myMonitor.snapshot('End');
  const myRes = createResult(ITERATIONS, myDuration, myMonitor);

  // -- Node.js --
  runGC();
  const nodeMonitor = new MemoryMonitor();
  nodeMonitor.snapshot('Start');

  const nodeStart = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    const emitter = new NodeEventEmitter();
    for (let j = 0; j < LISTENERS; j++) emitter.on('test', () => {});
    emitter.removeAllListeners('test');
  }
  const nodeDuration = performance.now() - nodeStart;
  nodeMonitor.snapshot('End');
  const nodeRes = createResult(ITERATIONS, nodeDuration, nodeMonitor);

  console.log(
    createComparisonTable('K. RemoveAllListeners Performance', myRes, nodeRes),
  );
}

function testNewRemoveListenerEvents() {
  const ITERATIONS = 300_000;
  let my_new = 0,
    my_rm = 0;
  let node_new = 0,
    node_rm = 0;

  // -- This Library --
  runGC();
  const myMonitor = new MemoryMonitor();
  myMonitor.snapshot('Start');

  const myStart = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    const emitter = new EventEmitter<BenchEvents>();
    emitter.on('newListener', () => my_new++);
    emitter.on('removeListener', () => my_rm++);

    const h = () => {};
    emitter.on('test', h);
    emitter.off('test', h);
  }
  const myDuration = performance.now() - myStart;
  myMonitor.snapshot('End');
  const myRes = createResult(ITERATIONS, myDuration, myMonitor);

  // -- Node.js --
  runGC();
  const nodeMonitor = new MemoryMonitor();
  nodeMonitor.snapshot('Start');

  const nodeStart = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    const emitter = new NodeEventEmitter();
    emitter.on('newListener', () => node_new++);
    emitter.on('removeListener', () => node_rm++);

    const h = () => {};
    emitter.on('test', h);
    emitter.off('test', h);
  }
  const nodeDuration = performance.now() - nodeStart;
  nodeMonitor.snapshot('End');
  const nodeRes = createResult(ITERATIONS, nodeDuration, nodeMonitor);

  console.log(
    createComparisonTable(
      'L. newListener/removeListener Events',
      myRes,
      nodeRes,
      {
        'New Count': {my: my_new, node: node_new},
        'Remove Count': {my: my_rm, node: node_rm},
      },
    ),
  );
}

// ========================================
// 主入口
// ========================================
function main() {
  console.log('🚀 EventEmitter Benchmark Suite: VS Node.js\n');

  jitWarmup();

  testBasicOperations();
  console.log('\n');

  testEmitPerformance();
  console.log('\n');

  testMultipleListeners();
  console.log('\n');

  testPrependListener();
  console.log('\n');

  testOncePerformance();
  console.log('\n');

  testArgumentCount();
  console.log('\n');

  testSymbolEvent();
  console.log('\n');

  testDynamicOperations();
  console.log('\n');

  testMassiveListeners();
  console.log('\n');

  testMemoryPressure();
  console.log('\n');

  testListenerQueryMethods();
  console.log('\n');

  testRemoveAllListeners();
  console.log('\n');

  testNewRemoveListenerEvents();

  console.log('\n✨ All tests completed.');
  process.exit(0);
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exit(1);
}
/*
 pnpm vite-node scripts/run.ts "d:\SoftwareDevelopment\Web\modern-ts\__benchmark__\event_emitter.ts"
✅ GC enabled
🚀 EventEmitter Benchmark Suite: VS Node.js

🔥 JIT Warmup (Both Libs)...
✅ JIT Warmup completed: 71.50ms

┌────────────────────┬────────────────────┬────────────────────┬────────────────────┐
│ Metric             │ This Library       │ Node.js            │ Diff               │
├────────────────────┴────────────────────┴────────────────────┴────────────────────┤
│                         A. Basic Operations (on/emit/off)                         │
├────────────────────┬────────────────────┬────────────────────┬────────────────────┤
│ Duration (ms)      │ 120.50             │ 120.12             │ +0.38ms (+0.3%)    │
├────────────────────┼────────────────────┼────────────────────┼────────────────────┤
│ Ops/sec            │ 24896390           │ 24974672           │ -0.3%              │
├────────────────────┼────────────────────┼────────────────────┼────────────────────┤
│ Memory (Start)     │ 79.48 MB           │ 79.48 MB           │ -9.13 KB           │
├────────────────────┼────────────────────┼────────────────────┼────────────────────┤
│ Memory (End)       │ 98.41 MB           │ 79.92 MB           │ +18.49 MB          │
└────────────────────┴────────────────────┴────────────────────┴────────────────────┘


┌────────────────────┬────────────────────┬────────────────────┬────────────────────┐
│ Metric             │ This Library       │ Node.js            │ Diff               │
├────────────────────┴────────────────────┴────────────────────┴────────────────────┤
│                       B. Emit Performance (single listener)                       │
├────────────────────┬────────────────────┬────────────────────┬────────────────────┤
│ Duration (ms)      │ 63.95              │ 75.47              │ -11.52ms (-15.3%)  │
├────────────────────┼────────────────────┼────────────────────┼────────────────────┤
│ Ops/sec            │ 78188161           │ 66252193           │ +18.0%             │
├────────────────────┼────────────────────┼────────────────────┼────────────────────┤
│ Memory (Start)     │ 79.79 MB           │ 79.80 MB           │ -10.46 KB          │
├────────────────────┼────────────────────┼────────────────────┼────────────────────┤
│ Memory (End)       │ 82.33 MB           │ 79.81 MB           │ +2.52 MB           │
├────────────────────┼────────────────────┼────────────────────┼────────────────────┤
│ Call Count         │ 5000000            │ 5000000            │ ✓ Match            │
└────────────────────┴────────────────────┴────────────────────┴────────────────────┘


┌───────────┬────────────────────┬───────────────────┬─────────┐
│ Listeners │ This Lib (ops/sec) │ Node.js (ops/sec) │ Diff    │
├───────────┼────────────────────┼───────────────────┼─────────┤
│ 1         │ 59700067           │ 67988823          │ -12.2%  │
├───────────┼────────────────────┼───────────────────┼─────────┤
│ 5         │ 36090660           │ 23188997          │ +55.6%  │
├───────────┼────────────────────┼───────────────────┼─────────┤
│ 10        │ 23737633           │ 11112580          │ +113.6% │
├───────────┼────────────────────┼───────────────────┼─────────┤
│ 50        │ 12759399           │ 2201708           │ +479.5% │
├───────────┼────────────────────┼───────────────────┼─────────┤
│ 100       │ 7750568            │ 1147983           │ +575.1% │
└───────────┴────────────────────┴───────────────────┴─────────┘


┌────────────────────┬────────────────────┬────────────────────┬────────────────────┐
│ Metric             │ This Library       │ Node.js            │ Diff               │
├────────────────────┴────────────────────┴────────────────────┴────────────────────┤
│                          D. PrependListener Performance                           │
├────────────────────┬────────────────────┬────────────────────┬────────────────────┤
│ Duration (ms)      │ 66.12              │ 62.69              │ +3.43ms (+5.5%)    │
├────────────────────┼────────────────────┼────────────────────┼────────────────────┤
│ Ops/sec            │ 22687295           │ 23928063           │ -5.2%              │
├────────────────────┼────────────────────┼────────────────────┼────────────────────┤
│ Memory (Start)     │ 79.87 MB           │ 79.88 MB           │ -18.18 KB          │
├────────────────────┼────────────────────┼────────────────────┼────────────────────┤
│ Memory (End)       │ 84.58 MB           │ 80.95 MB           │ +3.63 MB           │
└────────────────────┴────────────────────┴────────────────────┴────────────────────┘


┌────────────────────┬────────────────────┬────────────────────┬────────────────────┐
│ Metric             │ This Library       │ Node.js            │ Diff               │
├────────────────────┴────────────────────┴────────────────────┴────────────────────┤
│                                E. Once Performance                                │
├────────────────────┬────────────────────┬────────────────────┬────────────────────┤
│ Duration (ms)      │ 96.59              │ 243.69             │ -147.10ms (-60.4%) │
├────────────────────┼────────────────────┼────────────────────┼────────────────────┤
│ Ops/sec            │ 5176573            │ 2051788            │ +152.3%            │
├────────────────────┼────────────────────┼────────────────────┼────────────────────┤
│ Memory (Start)     │ 79.91 MB           │ 79.92 MB           │ -14.87 KB          │
├────────────────────┼────────────────────┼────────────────────┼────────────────────┤
│ Memory (End)       │ 85.99 MB           │ 82.57 MB           │ +3.43 MB           │
├────────────────────┼────────────────────┼────────────────────┼────────────────────┤
│ Call Count         │ 500000             │ 500000             │ ✓ Match            │
└────────────────────┴────────────────────┴────────────────────┴────────────────────┘


📊 Testing impact of argument count on emit...
┌────────┬────────────────────┬───────────────────┬────────┐
│ Args   │ This Lib (ops/sec) │ Node.js (ops/sec) │ Diff   │
├────────┼────────────────────┼───────────────────┼────────┤
│ 0 args │ 41106758           │ 37883810          │ +8.5%  │
├────────┼────────────────────┼───────────────────┼────────┤
│ 1 arg  │ 36999558           │ 32391339          │ +14.2% │
├────────┼────────────────────┼───────────────────┼────────┤
│ 4 args │ 34012333           │ 28611730          │ +18.9% │
└────────┴────────────────────┴───────────────────┴────────┘


┌────────────────────┬────────────────────┬────────────────────┬────────────────────┐
│ Metric             │ This Library       │ Node.js            │ Diff               │
├────────────────────┴────────────────────┴────────────────────┴────────────────────┤
│                            F. Symbol Event Performance                            │
├────────────────────┬────────────────────┬────────────────────┬────────────────────┤
│ Duration (ms)      │ 39.99              │ 42.16              │ -2.17ms (-5.1%)    │
├────────────────────┼────────────────────┼────────────────────┼────────────────────┤
│ Ops/sec            │ 50011127           │ 47441256           │ +5.4%              │
├────────────────────┼────────────────────┼────────────────────┼────────────────────┤
│ Memory (Start)     │ 79.95 MB           │ 79.96 MB           │ -7.39 KB           │
├────────────────────┼────────────────────┼────────────────────┼────────────────────┤
│ Memory (End)       │ 80.91 MB           │ 80.56 MB           │ +355.80 KB         │
├────────────────────┼────────────────────┼────────────────────┼────────────────────┤
│ Trigger Count      │ 2000000            │ 2000000            │ ✓ Match            │
└────────────────────┴────────────────────┴────────────────────┴────────────────────┘


┌────────────────────┬────────────────────┬────────────────────┬────────────────────┐
│ Metric             │ This Library       │ Node.js            │ Diff               │
├────────────────────┴────────────────────┴────────────────────┴────────────────────┤
│                               G. Dynamic Operations                               │
├────────────────────┬────────────────────┬────────────────────┬────────────────────┤
│ Duration (ms)      │ 55832.89           │ 93715.22           │ -37882.33ms (-40.… │
├────────────────────┼────────────────────┼────────────────────┼────────────────────┤
│ Ops/sec            │ 1791               │ 1067               │ +67.8%             │
├────────────────────┼────────────────────┼────────────────────┼────────────────────┤
│ Memory (Start)     │ 79.97 MB           │ 80.96 MB           │ -1012.26 KB        │
├────────────────────┼────────────────────┼────────────────────┼────────────────────┤
│ Memory (End)       │ 107.60 MB          │ 149.86 MB          │ -42.26 MB          │
├────────────────────┼────────────────────┼────────────────────┼────────────────────┤
│ Call Count         │ 5000050000         │ 5000050000         │ ✓ Match            │
└────────────────────┴────────────────────┴────────────────────┴────────────────────┘


┌────────────┬───────────────────┬──────────────┬─────────┐
│ Operation  │ This Library (ms) │ Node.js (ms) │ Diff    │
├────────────┴───────────────────┴──────────────┴─────────┤
│               H. Massive Listeners (10k)                │
├────────────┬───────────────────┬──────────────┬─────────┤
│ Add All    │ 0.83              │ 3.08         │ -73.0%  │
├────────────┼───────────────────┼──────────────┼─────────┤
│ Emit x1000 │ 83.68             │ 132.39       │ -36.8%  │
├────────────┼───────────────────┼──────────────┼─────────┤
│ Remove All │ 0.74              │ 0.19         │ +287.5% │
└────────────┴───────────────────┴──────────────┴─────────┘


⏳ Running Memory Pressure Test (Both Libs)...

┌────────────────────┬────────────────────┬────────────────────┬────────────────────┐
│ Metric             │ This Library       │ Node.js            │ Diff               │
├────────────────────┴────────────────────┴────────────────────┴────────────────────┤
│                              I. Memory Pressure Test                              │
├────────────────────┬────────────────────┬────────────────────┬────────────────────┤
│ Start Memory       │ 76.73 MB           │ 76.74 MB           │ -                  │
├────────────────────┼────────────────────┼────────────────────┼────────────────────┤
│ End Memory         │ 76.74 MB           │ 80.86 MB           │ -                  │
├────────────────────┼────────────────────┼────────────────────┼────────────────────┤
│ Memory Growth      │ 13.07 KB           │ 4.12 MB            │ -4.11 MB           │
├────────────────────┼────────────────────┼────────────────────┼────────────────────┤
│ Leak Status        │ ✓ Stable           │ ✓ Stable           │ -                  │
└────────────────────┴────────────────────┴────────────────────┴────────────────────┘

📈 This Library Memory Trend:
  76.77 MB │   █
  76.76 MB │ █████
  76.75 MB │ █████
  76.74 MB │ ██████
  76.73 MB │███████
           └────────────────────────────────────────
Legend: [0]Init -> [1]20% -> [2]40% -> [3]60% -> [4]80% -> [5]100% -> [6]Final

📈 Node.js Memory Trend:
  80.88 MB │     ██
  79.85 MB │    ███
  78.81 MB │  █████
  77.78 MB │ ██████
  76.74 MB │███████
           └────────────────────────────────────────
Legend: [0]Init -> [1]20% -> [2]40% -> [3]60% -> [4]80% -> [5]100% -> [6]Final


┌────────────────────┬────────────────────┬────────────────────┬────────────────────┐
│ Metric             │ This Library       │ Node.js            │ Diff               │
├────────────────────┴────────────────────┴────────────────────┴────────────────────┤
│                             J. Listener Query Methods                             │
├────────────────────┬────────────────────┬────────────────────┬────────────────────┤
│ Duration (ms)      │ 22.40              │ 10.07              │ +12.33ms (+122.5%) │
├────────────────────┼────────────────────┼────────────────────┼────────────────────┤
│ Ops/sec            │ 44652226           │ 99349262           │ -55.1%             │
├────────────────────┼────────────────────┼────────────────────┼────────────────────┤
│ Memory (Start)     │ 80.87 MB           │ 80.88 MB           │ -7.98 KB           │
├────────────────────┼────────────────────┼────────────────────┼────────────────────┤
│ Memory (End)       │ 80.89 MB           │ 80.89 MB           │ +2.74 KB           │
└────────────────────┴────────────────────┴────────────────────┴────────────────────┘


┌────────────────────┬────────────────────┬────────────────────┬────────────────────┐
│ Metric             │ This Library       │ Node.js            │ Diff               │
├────────────────────┴────────────────────┴────────────────────┴────────────────────┤
│                         K. RemoveAllListeners Performance                         │
├────────────────────┬────────────────────┬────────────────────┬────────────────────┤
│ Duration (ms)      │ 74.21              │ 1116.92            │ -1042.71ms (-93.4… │
├────────────────────┼────────────────────┼────────────────────┼────────────────────┤
│ Ops/sec            │ 673754             │ 44766              │ +1405.1%           │
├────────────────────┼────────────────────┼────────────────────┼────────────────────┤
│ Memory (Start)     │ 80.88 MB           │ 80.90 MB           │ -12.45 KB          │
├────────────────────┼────────────────────┼────────────────────┼────────────────────┤
│ Memory (End)       │ 127.98 MB          │ 186.43 MB          │ -58.45 MB          │
└────────────────────┴────────────────────┴────────────────────┴────────────────────┘


┌────────────────────┬────────────────────┬────────────────────┬────────────────────┐
│ Metric             │ This Library       │ Node.js            │ Diff               │
├────────────────────┴────────────────────┴────────────────────┴────────────────────┤
│                       L. newListener/removeListener Events                        │
├────────────────────┬────────────────────┬────────────────────┬────────────────────┤
│ Duration (ms)      │ 66.77              │ 218.98             │ -152.21ms (-69.5%) │
├────────────────────┼────────────────────┼────────────────────┼────────────────────┤
│ Ops/sec            │ 4493258            │ 1369995            │ +228.0%            │
├────────────────────┼────────────────────┼────────────────────┼────────────────────┤
│ Memory (Start)     │ 156.84 MB          │ 156.85 MB          │ -13.30 KB          │
├────────────────────┼────────────────────┼────────────────────┼────────────────────┤
│ Memory (End)       │ 166.24 MB          │ 209.27 MB          │ -43.03 MB          │
├────────────────────┼────────────────────┼────────────────────┼────────────────────┤
│ New Count          │ 600000             │ 600000             │ ✓ Match            │
├────────────────────┼────────────────────┼────────────────────┼────────────────────┤
│ Remove Count       │ 300000             │ 300000             │ ✓ Match            │
└────────────────────┴────────────────────┴────────────────────┴────────────────────┘

✨ All tests completed.
*/
