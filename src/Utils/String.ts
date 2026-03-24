// ========================================
// ./src/Utils/String.ts
// ========================================
// cSpell:ignore deburr

import {ParameterError} from 'src/Errors';

// ------ 常量预编译 ------
const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
} as const;

const HTML_UNESCAPE_MAP: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
} as const;

const HTML_ESCAPE_REGEXP = /[&<>"']/g;
const HTML_UNESCAPE_REGEXP = /&(?:amp|lt|gt|quot|#39);/g;
const WORD_SPLIT_REGEXP =
  /[A-Z]{2,}(?=[A-Z][a-z]+|[0-9]|$)|[A-Z]?[a-z]+[0-9]*|[A-Z]+[0-9]*|[0-9]+[a-z]+|[0-9]+/g;
const UNICODE_WORD_REGEXP = /[\p{L}\p{N}]+/gu;

const TRIM_START_REGEXP = /^\s+/;
const TRIM_END_REGEXP = /\s+$/;

// ------ 修剪与填充 ------

/**
 * Removes whitespace or specified characters from both ends of a string
 * @param str - String to trim
 * @param chars - Characters to trim (defaults to whitespace). If provided, removes all characters in this string from both ends.
 * @returns Trimmed string. Returns empty string if input is empty.
 * @example
 * trim('  hello  ') // 'hello'
 * trim('--hello--', '-') // 'hello'
 * trim('', '-') // ''
 */
export const trim = (str: string, chars?: string): string => {
  if (chars === undefined) return str.trim();
  if (!chars) return str;

  const safeChars = escapeRegExp(chars);
  return str.replace(new RegExp(`^[${safeChars}]+|[${safeChars}]+$`, 'g'), '');
};

/**
 * Removes whitespace or specified characters from the start of a string
 * @param str - String to trim
 * @param chars - Characters to trim (defaults to whitespace). If provided, removes all characters in this string from the start.
 * @returns Trimmed string. Returns empty string if input is empty.
 * @example
 * trimStart('  hello  ') // 'hello  '
 * trimStart('--hello', '-') // 'hello'
 */
export const trimStart = (str: string, chars?: string): string => {
  if (chars === undefined) return str.replace(TRIM_START_REGEXP, '');
  if (!chars) return str;

  const safeChars = escapeRegExp(chars);
  return str.replace(new RegExp(`^[${safeChars}]+`), '');
};

/**
 * Removes whitespace or specified characters from the end of a string
 * @param str - String to trim
 * @param chars - Characters to trim (defaults to whitespace). If provided, removes all characters in this string from the end.
 * @returns Trimmed string. Returns empty string if input is empty.
 * @example
 * trimEnd('  hello  ') // '  hello'
 * trimEnd('hello--', '-') // 'hello'
 */
export const trimEnd = (str: string, chars?: string): string => {
  if (chars === undefined) return str.replace(TRIM_END_REGEXP, '');
  if (!chars) return str;

  const safeChars = escapeRegExp(chars);
  return str.replace(new RegExp(`[${safeChars}]+$`), '');
};

/**
 * Pads a string on both sides with specified characters to reach given length
 * @param str - String to pad
 * @param length - Target length after padding. If str length >= length, returns original string.
 * @param chars - Padding characters (defaults to space). If empty string, returns original string.
 * @returns Padded string. Returns original string if padding not needed or chars empty.
 * @throws If length is negative
 * @example
 * pad('hi', 5) // '  hi  '
 * pad('hi', 5, '-') // '--hi-'
 * pad('hello', 3) // 'hello'
 * pad('hi', 6, 'abc') // 'abhiab'
 */
export const pad = (
  str: string,
  length: number,
  chars: string = ' ',
): string => {
  if (!Number.isFinite(length) || length < 0) {
    throw new ParameterError('Length must be a finite non-negative number');
  }
  const strLen = str.length;
  // 提前检查 chars 长度，避免后续计算
  if (strLen >= length || chars.length === 0) return str;

  const totalPad = length - strLen;
  const leftPad = Math.floor(totalPad / 2);
  const rightPad = totalPad - leftPad;

  const repeatLeft = chars
    .repeat(Math.ceil(leftPad / chars.length))
    .slice(0, leftPad);
  const repeatRight = chars
    .repeat(Math.ceil(rightPad / chars.length))
    .slice(0, rightPad);

  return repeatLeft + str + repeatRight;
};

// ------ 转义处理 ------

/**
 * Removes diacritical marks (accents) from characters using Unicode normalization
 * @param str - String to process
 * @returns String with diacritical marks removed. Returns empty string if input is empty.
 * @example
 * deburr('déjà vu') // 'deja vu'
 * deburr('') // ''
 */
export const deburr = (str: string): string =>
  str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/**
 * Escapes special regex characters in a string
 * @param str - String containing regex special characters
 * @returns Escaped string safe for use in regex construction. Returns empty string if input is empty.
 * @example
 * escapeRegExp('[test].*') // '\\[test\\]\\.\\*'
 */
export const escapeRegExp = (str: string): string =>
  str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Escapes HTML special characters (&, <, >, ", ')
 * @param str - String containing HTML
 * @returns Escaped string with HTML entities. Returns empty string if input is empty.
 * @example
 * escape('<div>"test"</div>') // '&lt;div&gt;&quot;test&quot;&lt;/div&gt;'
 */
export const escape = (str: string): string =>
  str.replace(HTML_ESCAPE_REGEXP, (match) => HTML_ESCAPE_MAP[match]);

/**
 * Unescapes HTML entities (&amp;, &lt;, &gt;, &quot;, &#39;)
 * @param str - String with HTML entities
 * @returns Unescaped string. Returns empty string if input is empty.
 * @example
 * unescape('&lt;div&gt;') // '<div>'
 */
export const unescape = (str: string): string =>
  str.replace(HTML_UNESCAPE_REGEXP, (match) => HTML_UNESCAPE_MAP[match]);

// ------ Unicode 安全操作 ------

/**
 * Reverses a string while preserving Unicode characters and emojis
 * @param str - String to reverse
 * @returns Reversed string. Returns empty string if input is empty.
 * @example
 * reverseString('hello') // 'olleh'
 * reverseString('👍👋') // '👋👍'
 */
export const reverseString = (str: string): string =>
  [...str].reverse().join('');

// ------ 大小写转换核心 ------
const splitWordsForCase = (str: string): string[] => {
  const normalized = deburr(str);
  return normalized.match(WORD_SPLIT_REGEXP) || [];
};

const capitalizeWord = (word: string): string =>
  word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : word;

/**
 * Converts string to Start Case (capitalizes first letter of each word)
 * @param str - String to convert
 * @returns Start case string. Returns empty string if input contains no words.
 * @remarks Handles alphanumeric boundaries (e.g., "test123" becomes "Test 123")
 * @example
 * startCase('hello world') // 'Hello World'
 * startCase('hello-world') // 'Hello World'
 * startCase('test123abc') // 'Test 123 Abc'
 */
export const startCase = (str: string): string => {
  return splitWordsForCase(str)
    .map(capitalizeWord)
    .join(' ')
    .replace(
      /([a-z])(\d)|(\d)([a-z])/gi,
      (_, p1, p2, p3, p4) => `${p1 || p3} ${p2 || p4}`,
    )
    .split(' ')
    .map(capitalizeWord)
    .join(' ')
    .trim();
};

// ------ 大小写转换函数 ------

/**
 * Converts string to camelCase
 * @param str - String to convert
 * @returns camelCase string. Returns empty string if input contains no words.
 * @example
 * camelCase('Hello World') // 'helloWorld'
 * camelCase('hello-world') // 'helloWorld'
 * camelCase('') // ''
 */
export const camelCase = (str: string): string => {
  const words = splitWordsForCase(str);
  if (!words.length) return '';
  return words[0].toLowerCase() + words.slice(1).map(capitalizeWord).join('');
};

/**
 * Capitalizes first character and lowercases the rest
 * @param str - String to capitalize
 * @returns Capitalized string. Returns empty string if input is empty.
 * @example
 * capitalize('hello') // 'Hello'
 * capitalize('HELLO') // 'Hello'
 */
export const capitalize = (str: string): string =>
  str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : str;

/**
 * Converts string to CONSTANT_CASE (UPPERCASE_WITH_UNDERSCORES)
 * @param str - String to convert
 * @returns CONSTANT_CASE string. Returns empty string if input contains no words.
 * @example
 * constantCase('hello world') // 'HELLO_WORLD'
 */
export const constantCase = (str: string): string =>
  splitWordsForCase(str)
    .map((w) => w.toUpperCase())
    .join('_');

/**
 * Converts string to kebab-case (lowercase-with-hyphens)
 * @param str - String to convert
 * @returns kebab-case string. Returns empty string if input contains no words.
 * @example
 * kebabCase('Hello World') // 'hello-world'
 */
export const kebabCase = (str: string): string =>
  splitWordsForCase(str)
    .map((w) => w.toLowerCase())
    .join('-');

/**
 * Converts string to lowercase with spaces
 * @param str - String to convert
 * @returns Lowercase string with words separated by spaces. Returns empty string if input contains no words.
 * @example
 * lowerCase('HelloWorld') // 'hello world'
 */
export const lowerCase = (str: string): string =>
  splitWordsForCase(str)
    .map((w) => w.toLowerCase())
    .join(' ');

/**
 * Converts first character to lowercase
 * @param str - String to convert
 * @returns String with first character lowercased. Returns empty string if input is empty.
 * @example
 * lowerFirst('Hello') // 'hello'
 * lowerFirst('HELLO') // 'hELLO'
 */
export const lowerFirst = (str: string): string =>
  str ? str.charAt(0).toLowerCase() + str.slice(1) : str;

/**
 * Converts string to PascalCase (capitalizes first letter of each word)
 * @param str - String to convert
 * @returns PascalCase string. Returns empty string if input contains no words.
 * @example
 * pascalCase('hello world') // 'HelloWorld'
 */
export const pascalCase = (str: string): string =>
  splitWordsForCase(str).map(capitalizeWord).join('');

/**
 * Converts string to snake_case (lowercase_with_underscores)
 * @param str - String to convert
 * @returns snake_case string. Returns empty string if input contains no words.
 * @example
 * snakeCase('Hello World') // 'hello_world'
 */
export const snakeCase = (str: string): string =>
  splitWordsForCase(str)
    .map((w) => w.toLowerCase())
    .join('_');

/**
 * Converts string to UPPERCASE WITH SPACES
 * @param str - String to convert
 * @returns Uppercase string with words separated by spaces. Returns empty string if input contains no words.
 * @example
 * upperCase('hello-world') // 'HELLO WORLD'
 */
export const upperCase = (str: string): string =>
  splitWordsForCase(str)
    .map((w) => w.toUpperCase())
    .join(' ');

/**
 * Converts first character to uppercase
 * @param str - String to convert
 * @returns String with first character uppercased. Returns empty string if input is empty.
 * @example
 * upperFirst('hello') // 'Hello'
 * upperFirst('hELLO') // 'HELLO'
 */
export const upperFirst = (str: string): string =>
  str ? str.charAt(0).toUpperCase() + str.slice(1) : str;

// ------ 单词提取 ------

/**
 * Extracts words from string using Unicode-aware regex (supports all languages)
 * @param str - String to extract words from
 * @returns Array of words (Unicode letters and numbers). Returns empty array if no words found.
 * @example
 * words('Hello world!') // ['Hello', 'world']
 * words('你好，世界！') // ['你好', '世界']
 * words('123 abc') // ['123', 'abc']
 */
export const words = (str: string): string[] =>
  str.match(UNICODE_WORD_REGEXP) || [];

// ------ 随机字符串生成 ------

/**
 * Generates a random string from the specified character set
 * @param length - Length of the string to generate. Must be a non-negative integer.
 * @param charset - Character set to use for generation. Defaults to alphanumeric (a-z, A-Z, 0-9).
 * @returns Randomly generated string
 * @throws ParameterError if length is negative or not an integer
 * @example
 * randomString(8) // 'aB3xK9pL'
 * randomString(6, '0123456789') // '384729'
 * randomString(10, 'abc') // 'abccabacba'
 */
export const randomString = (length: number, charset?: string): string => {
  if (!Number.isInteger(length) || length < 0)
    throw new ParameterError('Length must be a non-negative integer');
  const chars =
    charset ?? 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  if (chars.length === 0) return '';

  let result = '';
  for (let i = 0; i < length; i++)
    result += chars.charAt(Math.floor(Math.random() * chars.length));

  return result;
};

// ------ 模板字符串 ------

/**
 * Replaces placeholders in template string with values from data object
 * @template T - Type of data object
 * @param str - Template string with {{placeholder}} syntax
 * @param data - Object containing values to replace placeholders. Supports nested paths like {{user.name}}
 * @returns String with placeholders replaced by corresponding values. Undefined values are replaced with empty string.
 * @example
 * template('Hello {{name}}!', {name: 'Alice'}) // 'Hello Alice!'
 * template('Hello {{user.name}}!', {user: {name: 'Bob'}}) // 'Hello Bob!'
 * template('Welcome to {{company}}!', {company: 'Tech Corp'}) // 'Welcome to Tech Corp!'
 */
export const template = <T extends Record<string, unknown>>(
  str: string,
  data: T,
): string => {
  return str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
    const trimmed_path = path.trim();
    const keys = trimmed_path.split('.');
    let current: unknown = data;
    for (const key of keys) {
      if (current === null || typeof current !== 'object') {
        current = undefined;
        break;
      }
      current = (current as Record<string, unknown>)[key];
    }
    if (current === undefined || current === null) return '';
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    return String(current);
  });
};
