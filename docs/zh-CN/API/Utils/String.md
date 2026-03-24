# String

字符串工具函数集合，提供修剪填充、HTML转义、大小写转换、单词提取、随机字符串生成等功能

---

## 使用场景

- **字符串清理**：去除空白、修剪指定字符、填充对齐
- **HTML处理**：转义/反转义HTML特殊字符
- **大小写转换**：camelCase、snake_case、kebab-case 等多种格式转换
- **文本处理**：Unicode安全操作、单词提取、模板替换
- **随机生成**：生成随机字符串

---

## API

### trim

移除字符串两端的空白或指定字符

```typescript
function trim(str: string, chars?: string): string;
```

| 参数    | 类型     | 描述                                 |
| ------- | -------- | ------------------------------------ |
| `str`   | `string` | 要修剪的字符串                       |
| `chars` | `string` | 可选，要移除的字符，默认移除空白字符 |

**返回值：** 修剪后的字符串

**示例：**

```typescript
trim('  hello  ');           // 'hello'
trim('--hello--', '-');      // 'hello'
trim('__hello__', '_');      // 'hello'
trim('');                    // ''
```

---

### trimStart

移除字符串开头的空白或指定字符

```typescript
function trimStart(str: string, chars?: string): string;
```

| 参数    | 类型     | 描述                                 |
| ------- | -------- | ------------------------------------ |
| `str`   | `string` | 要修剪的字符串                       |
| `chars` | `string` | 可选，要移除的字符，默认移除空白字符 |

**返回值：** 开头修剪后的字符串

**示例：**

```typescript
trimStart('  hello  ');       // 'hello  '
trimStart('--hello', '-');    // 'hello'
trimStart('__hello__', '_');  // 'hello__'
```

---

### trimEnd

移除字符串结尾的空白或指定字符

```typescript
function trimEnd(str: string, chars?: string): string;
```

| 参数    | 类型     | 描述                                 |
| ------- | -------- | ------------------------------------ |
| `str`   | `string` | 要修剪的字符串                       |
| `chars` | `string` | 可选，要移除的字符，默认移除空白字符 |

**返回值：** 结尾修剪后的字符串

**示例：**

```typescript
trimEnd('  hello  ');         // '  hello'
trimEnd('hello--', '-');      // 'hello'
trimEnd('__hello__', '_');    // '__hello'
```

---

### pad

在字符串两侧填充指定字符以达到目标长度

```typescript
function pad(str: string, length: number, chars?: string): string;
```

| 参数     | 类型     | 描述                       |
| -------- | -------- | -------------------------- |
| `str`    | `string` | 要填充的字符串             |
| `length` | `number` | 目标长度                   |
| `chars`  | `string` | 可选，填充字符，默认为空格 |

**返回值：** 填充后的字符串

**抛出：** 当 `length` 为负数时抛出 `ParameterError`

**示例：**

```typescript
pad('hi', 5);              // '  hi  '
pad('hi', 5, '-');         // '--hi-'
pad('hi', 6, 'abc');       // 'abhiab'
pad('hello', 3);           // 'hello' (原字符串已足够长)
```

---

### deburr

移除字符串中的变音符号（重音符号）

```typescript
function deburr(str: string): string;
```

| 参数  | 类型     | 描述           |
| ----- | -------- | -------------- |
| `str` | `string` | 要处理的字符串 |

**返回值：** 移除变音符号后的字符串

**示例：**

```typescript
deburr('déjà vu');         // 'deja vu'
deburr('café');            // 'cafe'
deburr('naïve');           // 'naive'
deburr('');                // ''
```

---

### escapeRegExp

转义字符串中的正则表达式特殊字符

```typescript
function escapeRegExp(str: string): string;
```

| 参数  | 类型     | 描述           |
| ----- | -------- | -------------- |
| `str` | `string` | 要转义的字符串 |

**返回值：** 转义后的字符串，可安全用于正则表达式

**示例：**

```typescript
escapeRegExp('[test].*');   // '\\[test\\]\\.\\*'
escapeRegExp('(a+b)*');     // '\\(a\\+b\\)\\*'
escapeRegExp('price $10');  // 'price \\$10'
```

---

### escape

转义 HTML 特殊字符

```typescript
function escape(str: string): string;
```

| 参数  | 类型     | 描述           |
| ----- | -------- | -------------- |
| `str` | `string` | 要转义的字符串 |

**返回值：** HTML 转义后的字符串

**转义映射：**
- `&` → `&amp;`
- `<` → `&lt;`
- `>` → `&gt;`
- `"` → `&quot;`
- `'` → `&#39;`

**示例：**

```typescript
escape('<div>"test"</div>');  // '&lt;div&gt;&quot;test&quot;&lt;/div&gt;'
escape('a < b && c > d');     // 'a &lt; b &amp;&amp; c &gt; d'
```

---

### unescape

反转义 HTML 实体

```typescript
function unescape(str: string): string;
```

| 参数  | 类型     | 描述             |
| ----- | -------- | ---------------- |
| `str` | `string` | 要反转义的字符串 |

**返回值：** 反转义后的字符串

**示例：**

```typescript
unescape('&lt;div&gt;');           // '<div>'
unescape('&quot;hello&quot;');     // '"hello"'
unescape('a &lt; b &amp;&amp; c');  // 'a < b && c'
```

---

### reverseString

反转字符串（Unicode安全）

```typescript
function reverseString(str: string): string;
```

| 参数  | 类型     | 描述           |
| ----- | -------- | -------------- |
| `str` | `string` | 要反转的字符串 |

**返回值：** 反转后的字符串，正确处理 Unicode 字符和 emoji

**示例：**

```typescript
reverseString('hello');      // 'olleh'
reverseString('👍👋');        // '👋👍'
reverseString('你好世界');    // '界世好你'
reverseString('');           // ''
```

---

### startCase

转换为 Start Case（每个单词首字母大写，空格分隔）

```typescript
function startCase(str: string): string;
```

| 参数  | 类型     | 描述           |
| ----- | -------- | -------------- |
| `str` | `string` | 要转换的字符串 |

**返回值：** Start Case 格式的字符串

**示例：**

```typescript
startCase('hello world');    // 'Hello World'
startCase('hello-world');    // 'Hello World'
startCase('hello_world');    // 'Hello World'
startCase('test123abc');     // 'Test 123 Abc'
startCase('helloWorld');     // 'Hello World'
```

---

### camelCase

转换为 camelCase（小驼峰）

```typescript
function camelCase(str: string): string;
```

| 参数  | 类型     | 描述           |
| ----- | -------- | -------------- |
| `str` | `string` | 要转换的字符串 |

**返回值：** camelCase 格式的字符串

**示例：**

```typescript
camelCase('Hello World');    // 'helloWorld'
camelCase('hello-world');    // 'helloWorld'
camelCase('hello_world');    // 'helloWorld'
camelCase('HelloWorld');     // 'helloWorld'
camelCase('');               // ''
```

---

### capitalize

首字母大写，其余小写

```typescript
function capitalize(str: string): string;
```

| 参数  | 类型     | 描述           |
| ----- | -------- | -------------- |
| `str` | `string` | 要转换的字符串 |

**返回值：** 首字母大写的字符串

**示例：**

```typescript
capitalize('hello');         // 'Hello'
capitalize('HELLO');         // 'Hello'
capitalize('hELLO');         // 'Hello'
capitalize('');              // ''
```

---

### constantCase

转换为 CONSTANT_CASE（大写下划线）

```typescript
function constantCase(str: string): string;
```

| 参数  | 类型     | 描述           |
| ----- | -------- | -------------- |
| `str` | `string` | 要转换的字符串 |

**返回值：** CONSTANT_CASE 格式的字符串

**示例：**

```typescript
constantCase('hello world');  // 'HELLO_WORLD'
constantCase('hello-world');  // 'HELLO_WORLD'
constantCase('helloWorld');   // 'HELLO_WORLD'
constantCase('test123');      // 'TEST_123'
```

---

### kebabCase

转换为 kebab-case（短横线连接的小写）

```typescript
function kebabCase(str: string): string;
```

| 参数  | 类型     | 描述           |
| ----- | -------- | -------------- |
| `str` | `string` | 要转换的字符串 |

**返回值：** kebab-case 格式的字符串

**示例：**

```typescript
kebabCase('Hello World');    // 'hello-world'
kebabCase('hello_world');    // 'hello-world'
kebabCase('helloWorld');     // 'hello-world'
kebabCase('test123');        // 'test-123'
```

---

### lowerCase

转换为小写空格分隔

```typescript
function lowerCase(str: string): string;
```

| 参数  | 类型     | 描述           |
| ----- | -------- | -------------- |
| `str` | `string` | 要转换的字符串 |

**返回值：** 小写空格分隔的字符串

**示例：**

```typescript
lowerCase('HelloWorld');     // 'hello world'
lowerCase('hello-world');    // 'hello world'
lowerCase('HELLO_WORLD');    // 'hello world'
lowerCase('test123');        // 'test 123'
```

---

### lowerFirst

首字母小写

```typescript
function lowerFirst(str: string): string;
```

| 参数  | 类型     | 描述           |
| ----- | -------- | -------------- |
| `str` | `string` | 要转换的字符串 |

**返回值：** 首字母小写的字符串

**示例：**

```typescript
lowerFirst('Hello');         // 'hello'
lowerFirst('HELLO');         // 'hELLO'
lowerFirst('');              // ''
```

---

### pascalCase

转换为 PascalCase（大驼峰）

```typescript
function pascalCase(str: string): string;
```

| 参数  | 类型     | 描述           |
| ----- | -------- | -------------- |
| `str` | `string` | 要转换的字符串 |

**返回值：** PascalCase 格式的字符串

**示例：**

```typescript
pascalCase('hello world');   // 'HelloWorld'
pascalCase('hello-world');   // 'HelloWorld'
pascalCase('hello_world');   // 'HelloWorld'
pascalCase('helloWorld');    // 'HelloWorld'
```

---

### snakeCase

转换为 snake_case（下划线连接的小写）

```typescript
function snakeCase(str: string): string;
```

| 参数  | 类型     | 描述           |
| ----- | -------- | -------------- |
| `str` | `string` | 要转换的字符串 |

**返回值：** snake_case 格式的字符串

**示例：**

```typescript
snakeCase('Hello World');    // 'hello_world'
snakeCase('hello-world');    // 'hello_world'
snakeCase('helloWorld');     // 'hello_world'
snakeCase('test123');        // 'test_123'
```

---

### upperCase

转换为大写空格分隔

```typescript
function upperCase(str: string): string;
```

| 参数  | 类型     | 描述           |
| ----- | -------- | -------------- |
| `str` | `string` | 要转换的字符串 |

**返回值：** 大写空格分隔的字符串

**示例：**

```typescript
upperCase('hello-world');    // 'HELLO WORLD'
upperCase('hello_world');    // 'HELLO WORLD'
upperCase('helloWorld');     // 'HELLO WORLD'
upperCase('test123');        // 'TEST 123'
```

---

### upperFirst

首字母大写

```typescript
function upperFirst(str: string): string;
```

| 参数  | 类型     | 描述           |
| ----- | -------- | -------------- |
| `str` | `string` | 要转换的字符串 |

**返回值：** 首字母大写的字符串

**示例：**

```typescript
upperFirst('hello');         // 'Hello'
upperFirst('hELLO');         // 'HELLO'
upperFirst('');              // ''
```

---

### words

从字符串中提取单词（Unicode 感知）

```typescript
function words(str: string): string[];
```

| 参数  | 类型     | 描述           |
| ----- | -------- | -------------- |
| `str` | `string` | 要提取的字符串 |

**返回值：** 单词数组，支持所有语言的 Unicode 字符

**示例：**

```typescript
words('Hello world!');       // ['Hello', 'world']
words('你好，世界！');        // ['你好', '世界']
words('123 abc');            // ['123', 'abc']
words('');                   // []
```

---

### randomString

生成随机字符串

```typescript
function randomString(length: number, charset?: string): string;
```

| 参数      | 类型     | 描述                                |
| --------- | -------- | ----------------------------------- |
| `length`  | `number` | 生成的字符串长度                    |
| `charset` | `string` | 可选，字符集，默认为大小写字母+数字 |

**返回值：** 随机生成的字符串

**抛出：** 当 `length` 为负数或非整数时抛出 `ParameterError`

**示例：**

```typescript
randomString(8);                    // 'aB3xK9pL' (示例)
randomString(6, '0123456789');      // '384729' (仅数字)
randomString(10, 'abc');            // 'abccabacba' (仅 a,b,c)
randomString(0);                    // ''
```

---

### template

模板字符串替换

```typescript
function template<T extends Record<string, unknown>>(
  str: string,
  data: T,
): string;
```

| 参数   | 类型                      | 描述       |
| ------ | ------------------------- | ---------- |
| `str`  | `string`                  | 模板字符串 |
| `data` | `Record<string, unknown>` | 数据对象   |

**返回值：** 替换后的字符串

**模板语法：** 使用 `{{placeholder}}` 语法，支持嵌套路径如 `{{user.name}}`

**示例：**

```typescript
template('Hello {{name}}!', { name: 'Alice' });
// 'Hello Alice!'

template('Hello {{user.name}}!', { user: { name: 'Bob' } });
// 'Hello Bob!'

template('Welcome to {{company}}!', { company: 'Tech Corp' });
// 'Welcome to Tech Corp!'

template('Hello {{name}}!', {});
// 'Hello !' (未定义值替换为空字符串)
```

---

## 注意事项

1. **Unicode 支持**：`reverseString` 和 `words` 正确处理 Unicode 字符和 emoji
2. **大小写转换**：所有大小写转换函数都会先移除变音符号（`deburr`）
3. **边界处理**：空字符串输入通常返回空字符串
4. **错误处理**：`pad` 和 `randomString` 在参数无效时抛出 `ParameterError`
