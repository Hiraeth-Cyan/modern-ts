import {Secret, SecretError} from '../src/Other/secret';

// 创建一个 Secret
const API_KEY = Secret.make(123456);
// 或使用 new Secret(123456)

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

console.log('--- 显式访问 ---');
const original_value = Secret.reveal(API_KEY);
console.log(`揭示的值: ${original_value}`);
// 输出：揭示的值: 123456

console.log('--- 手动销毁 ---');
Secret.destroy(API_KEY);
console.log('秘密已手动销毁。');

try {
  Secret.reveal(API_KEY); // 这会报错
} catch (e) {
  if (e instanceof SecretError) {
    console.log(`销毁后访问报错: ${e.message}`);
    // 输出：销毁后访问报错: Attempt to access the deleted secret value.
  }
}

const api_key = 'sk-123456';
const initial_secret = Secret.make(api_key); // 创建一个新的 Secret 实例

console.log('\n--- 进入 using 块 ---');
{
  // 使用 using 声明来绑定 Secret 实例
  // 当代码块结束时，无论如何（正常退出或抛出异常），都会调用 user_api_key_secret[Symbol.dispose]()
  using user_api_key_secret = initial_secret;
  const actual_key = Secret.reveal(user_api_key_secret);
  console.log(`正在使用 API Key: ${actual_key.substring(0, 5)}...`);
}

console.log('--- 离开 using 块 ---');
try {
  Secret.reveal(initial_secret);
} catch (e) {
  if (e instanceof SecretError) {
    console.log(`using 块后访问报错: ${e.message}`);
  }
}

/*
输出:
--- 进入 using 块 ---
正在使用 API Key: sk-12...
--- 离开 using 块 ---
using 块后访问报错: Attempt to access the deleted secret value.
*/
