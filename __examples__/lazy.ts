import {
  wrap,
  wrapAsync,
  run,
  runAsync,
  Memoized,
  map,
  zipAsync,
} from '../src/Other/lazy';

const lazy_val = wrap(520); // 只是定义不会执行
console.log(run(lazy_val));
// 输出：520

let count = 0;
const expensive_task = Memoized(() => {
  count++;
  return `次数：${count}`;
});

console.log(expensive_task()); // 输出：次数：1
console.log(expensive_task()); // 输出：次数：1 (不再增加)

const _lazy_val = wrap(520);
const double_lazy_val = map(_lazy_val, (x) => x * 2);

console.log(run(double_lazy_val)); // 输出：1040

const task_a = wrapAsync('🍎');
const task_b = wrapAsync('🍌');

const combined = zipAsync(task_a, task_b);
const [resA, resB] = await runAsync(combined);
// 两个任务会通过 Promise.all 并发启动
console.log(resA, resB); // 输出：🍎 🍌或🍌 🍎
