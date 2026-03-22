# Lazy



使用 `wrap` 将 值 包装在一个函数中，只有在显式调用（或使用 `run`）时才会执行并返回该值。



## 使用场景：

在开发高性能应用时，我们经常遇到一些“昂贵”的操作，Lazy 机制能帮我们实现：
- 按需计算：如果一个复杂的计算结果或 API 请求在某些逻辑分支下并不需要，Lazy 可以确保这些开销永远不会发生。
- 性能优化：通过 Memoized，我们可以确保即便多次访问，昂贵的函数也只运行一次，随后直接返回缓存。
- 资源解耦：允许你先定义“如何获取资源”，而在真正需要资源的地方才去执行它，增加代码的灵活性。
- 安全执行：内置了 runWithCleanup，在执行逻辑的同时确保资源得到释放（比如关闭文件句柄或清除定时器），类似 Try-Finally 的函数式包装。



## 使用例子：

### 1. 基础包装与执行

```
const lazy_val = wrap(520); // 只是定义不会执行
console.log(run(lazy_val));
// 输出：520
```
### 2. 记忆化

```

let count = 0;
const expensive_task = Memoized(() => {
  count++;
  return `次数：${count}`;
});

console.log(expensive_task()); // 输出：次数：1
console.log(expensive_task()); // 输出：次数：1 (不再增加)
```

### 3. 链式操作
可以使用 map 或 andThen 像处理数组或 Promise 一样组合多个延迟任务

```
const lazy_val = wrap(520);
const double_lazy_val = map(lazy_val, (x) => x * 2);

console.log(run(double_lazy_val)); // 输出：1040
```

### 4. 异步并行执行

```
const task_a = wrapAsync("🍎");
const task_b = wrapAsync("🍌");

const combined = zipAsync(task_a, task_b);
const [resA, resB] = await runAsync(combined); 
// 两个任务会通过 Promise.all 并发启动
console.log(resA, resB) // 输出：🍎 🍌或🍌 🍎
```
