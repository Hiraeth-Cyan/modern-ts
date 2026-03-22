# Secret



使用 `Secret.make` 创建一个秘密，它可以保证你API、Key等敏感值不会意外地在出现在日志或错误消息中



## 使用场景

在现代应用开发中，API Key、数据库密码、OAuth Token 等敏感信息是攻击者的主要目标。Secret 机制就是为了应对这些意外的、无意的信息泄露风险而设计的。

敏感信息经常通过以下几种场景意外暴露：

- **日志记录**：在调试或异常捕获时，开发者常不小心将整个对象（例如包含 API Key 的配置对象）打印到日志系统或终端，例如 `console.log(config)`。日志一旦记录，便长期固化了敏感值。
- **错误消息与崩溃报告**：当程序崩溃或抛出异常时，**堆栈跟踪**和**错误报告** 通常会包含所有作用域内的变量值，有时甚至包含**内存快照**，从而意外暴露敏感 Key。
- **调试器与序列化**：在使用调试器检查变量时，或通过 `JSON.stringify()` 等方法进行序列化时，敏感字段可能会意外暴露
- **内存驻留**：敏感值一旦被加载到内存中，即使不再使用，也可能长时间驻留，并可能通过内存检查工具或进程快照被提取。

我们如何解决？

- 通过覆盖 `toString()`/`toJSON` 方法，Secret 实例被打印时会自己`throw`报错，从根源上阻止了日志泄露
- 利用 ES Private Fields (#)，从引擎底层屏蔽外部遍历、反射获取且不可序列化，它极大地降低了被意外包含在崩溃报告中的风险。
- 强制使用 `Secret.reveal()` 唯一入口来访问原始值，防止了对 Secret 实例的默认遍历或序列化操作暴露数据。
- 提供 `destroy` 和 `using` 机制，强制短期使用后立即抹除（用无意义的 `Symbol` 替换原始值），最大程度地减少敏感信息在内存中的暴露窗口



## 使用例子：

### 1. 创建

```typescript

// 创建一个 Secret
const API_KEY = Secret.make(123456);
// new Secret(123456)

// 尝试打印 Secret
try {
  console.log(API_KEY);
} catch (e) {
  if (e instanceof SecretError) {
    console.log(`console.log() 报错: ${e.message}`);
    // console.log() 报错: Secret values cannot be inspected via console.log
  }
}


console.log('--- 隐式转换测试 ---');
// 尝试对 Secret 实例进行隐式转换（如 toString(), JSON.stringify()）
try {
    console.log(String(API_KEY));
} catch (e) {
    if (e instanceof SecretError) {
        console.log(`String() 报错: ${e.message}`);
        // 输出：String() 报错: Secret values cannot be converted to Primitive via [Symbol.toPrimitive] (Hint: string)
    }
}

try {
    console.log(JSON.stringify(API_KEY));
} catch (e) {
    if (e instanceof SecretError) {
        console.log(`JSON.stringify() 报错: ${e.message}`);
        // 输出：JSON.stringify() 报错: Secret values cannot be serialized via toJSON()
    }
}

```

### 2. 揭秘

> 此操作是危险的，它将暴露敏感信息。请谨慎使用！


```typescript

const API_KEY = Secret.make(123456);
const original_value = Secret.reveal(API_KEY);
console.log(original_value);
// 输出：123456
```

#### 3. 销毁

> 由于仅通过内存替换实现抹除，Secret 无法保证操作系统或底层运行时（如 V8 引擎）不对原始值进行**额外的内存复制或堆外存储**

```typescript

const API_KEY = Secret.make(123456);
Secret.destroy(API_KEY);

try {
  Secret.reveal(API_KEY); // 这会报错
} catch (e) {
  if (e instanceof SecretError) {
    console.log(e.message);
    // 输出：Error: Attempt to access the deleted secret value.
  }
}
```

### 4. 自动清理

使用现代的using语句，在离开作用域时自动销毁

```typescript

const api_key = 'sk-123456'
const initial_secret = Secret.make(api_key)

// 使用 using 声明来绑定 Secret 实例
// 当代码块结束时，无论如何（正常退出或抛出异常），都会调用 secret[Symbol.dispose]() 
{
    using user_api_key_secret = initial_secret;
    const actual_key = Secret.reveal(user_api_key_secret);
    console.log(`正在使用 API Key: ${actual_key.substring(0, 5)}...`);
}

console.log("--- 离开 using 块 ---");
// 尝试在 using 块结束后访问秘密的值
try {
    Secret.reveal(initial_secret); // 尝试访问已经被销毁的值
} catch (e) {
  if (e instanceof SecretError) {
    console.log(e.message);
  }
}

/*
输出：
正在使用 API Key: sk-12...
--- 离开 using 块 ---
Error: Attempt to access the deleted secret value.
*/

```
