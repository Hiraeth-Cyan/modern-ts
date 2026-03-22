/* eslint-disable @typescript-eslint/no-floating-promises */
import {Mutex} from '../src/Concurrent/Lock/mutex';

async function heavyTask(id: number, mutex: Mutex, signal?: AbortSignal) {
  try {
    await mutex.withLock(async () => {
      // --- 检查点 1：拿到锁后立刻检查喵！ ---
      if (signal?.aborted)
        throw new DOMException('Aborted before start', 'AbortError');

      console.log(`[喵呜~ ${id}] 成功抓到鱼！`);

      // 模拟耗时操作：分段检查
      for (let i = 0; i < 10; i++) {
        await new Promise((r) => setTimeout(r, 100));
        // --- 检查点 2：耗时任务中间也要检查喵！ ---
        if (signal?.aborted)
          throw new DOMException('Aborted during eating', 'AbortError');
      }

      console.log(`[喵呜~ ${id}] 鱼吃完了喵！`);
    }, signal);
  } catch (e) {
    console.error(`[拦截成功] ${id} 号猫撤退了喵！`);
  }
}

// --- 场景模拟 ---
const my_mutex = new Mutex();
const controller = new AbortController();

console.log('--- 派出一群猫去排队喵！ ---');

// 1. 正常的猫 1 号
heavyTask(1, my_mutex);

// 2. 没耐心的猫 2 号 (3秒后如果还没轮到它或还没干完，主人就把它抓走)
heavyTask(2, my_mutex, controller.signal);

// 3. 倒霉的猫 3 号 (直接排队)
heavyTask(3, my_mutex);

// 模拟 1.5 秒后，主人突然不想让 2 号猫排了
setTimeout(() => {
  console.log('--- [系统广播] 2 号猫，主人喊你回家吃饭！ ---');
  controller.abort();
}, 1500);
