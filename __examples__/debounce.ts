import {Debounced, SKIPPED} from '../src/Utils/Functions/debounce';

function print(...args: unknown[]) {
  console.log(`[${performance.now()}]:`, ...args);
}

function test1() {
  const log = new Debounced(print, 50, true, true);

  const test = ['first', 'second', 'third'];
  test.forEach((val) => {
    if (log.call(null, val) == SKIPPED) {
      print(val + '被跳过');
    }
  });

  setTimeout(() => {
    if (log.pending) {
      print('25ms 已到，强制 Flush');
      log.flush();
    } else {
      print(
        '后沿执行的结果为: ' + (log.result === SKIPPED ? '无' : log.result),
      );
    }
  }, 25);

  /*输出：
  [1758.365]: first
  [1758.708]: second被跳过
  [1758.833]: third被跳过 
  [1786.2479]: 25ms 已到，强制 Flush
  [1786.5386]: third
  */
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function test2() {
  async function fetchSnacks(id: string) {
    await sleep(20);
    return `小鱼干[${id}]`;
  }

  const log = new Debounced(fetchSnacks, 50, true, true);

  console.log('--- 快速连点三次，只有第一次会立即触发 ---');
  const ids = ['A', 'B', 'C'];

  for (const id of ids) {
    const callResult = log.call(null, id);

    if (callResult !== SKIPPED) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      callResult.then((res) => print('前沿执行拿到了:', res));
    } else {
      print(`${id} 被跳过`);
    }
  }

  await sleep(30);

  if (log.pending) {
    print('--- 30ms 等不及了，强制 Flush！ ---');
    const finalRes = await log.flush();
    print('强制刷新后拿到了:', finalRes);
  }

  // 最后检查
  await sleep(100);
  print(
    '最终状态:',
    log.pending ? '还在等' : '已完成',
    '最后结果:',
    await log.result,
  );
  /*输出：
  --- 快速连点三次，只有第一次会立即触发 ---
  [1788.7322]: B 被跳过
  [1788.9035]: C 被跳过
  [1818.3675]: 前沿执行拿到了: 小鱼干[A]
  [1818.7607]: --- 30ms 等不及了，强制 Flush！ ---
  [1849.6386]: 强制刷新后拿到了: 小鱼干[C]
  [1957.643]: 最终状态: 已完成 最后结果: 小鱼干[C]
  */
}

test1();
await sleep(25);
await test2();
