// ============================================
// ./src/Utils/String.spec.ts
// ============================================
import {describe, it, expect} from 'vitest';
import {
  trim,
  trimStart,
  trimEnd,
  pad,
  deburr,
  escapeRegExp,
  escape,
  unescape,
  reverseString,
  camelCase,
  capitalize,
  constantCase,
  kebabCase,
  lowerCase,
  lowerFirst,
  pascalCase,
  snakeCase,
  startCase,
  upperCase,
  upperFirst,
  words,
  randomString,
  template,
} from './String';
import {ParameterError} from '../Errors';

describe.concurrent('String Utils', () => {
  // ============================
  // 修剪与填充函数
  // ============================
  describe('trim', () => {
    it('should trim whitespace or specified characters from both ends', () => {
      // 默认空格去除
      expect(trim('  hello  ')).toBe('hello');
      expect(trim('\t\nhello\t\n')).toBe('hello');

      // 指定字符去除
      expect(trim('---hello---', '-')).toBe('hello');
      expect(trim('***hello***', '*')).toBe('hello');
      expect(trim('hello ', '')).toBe('hello '); // 空字符不处理

      // 多种字符混合
      expect(trim('-_hello_-', '-_')).toBe('hello');
      expect(trim('123hello321', '123')).toBe('hello');

      // 处理正则特殊字符（原集成测试移入）
      expect(trim('.*+hello.*+', '.*+')).toBe('hello');
    });
  });

  describe('trimStart', () => {
    it('should trim whitespace or specified characters from the start only', () => {
      // 默认开头空格去除
      expect(trimStart('  hello  ')).toBe('hello  ');
      expect(trimStart('\t\nhello\t\n')).toBe('hello\t\n');

      // 指定字符去除开头
      expect(trimStart('---hello---', '-')).toBe('hello---');
      expect(trimStart('***hello***', '*')).toBe('hello***');
      expect(trimStart('hello ', '')).toBe('hello ');
    });
  });

  describe('trimEnd', () => {
    it('should trim whitespace or specified characters from the end only', () => {
      // 默认末尾空格去除
      expect(trimEnd('  hello  ')).toBe('  hello');
      expect(trimEnd('\t\nhello\t\n')).toBe('\t\nhello');

      // 指定字符去除末尾
      expect(trimEnd('---hello---', '-')).toBe('---hello');
      expect(trimEnd('***hello***', '*')).toBe('***hello');
      expect(trimEnd('hello ', '')).toBe('hello ');
    });
  });

  describe('pad', () => {
    it('should pad string to given length with specified characters', () => {
      // 默认空格填充
      expect(pad('hello', 10)).toBe('  hello   ');
      expect(pad('test', 6)).toBe(' test ');

      // 指定字符填充
      expect(pad('hello', 8, '*')).toBe('*hello**');
      expect(pad('test', 7, '-+')).toBe('-test-+');

      // 长度已满足或小于原长度
      expect(pad('hello', 5)).toBe('hello');
      expect(pad('test', 3)).toBe('test');

      // 奇数填充处理
      expect(pad('hi', 5)).toBe(' hi  ');
      expect(pad('hi', 5, '*')).toBe('*hi**');
    });

    it('should throw ParameterError for negative length', () => {
      // 边界情况：负数长度
      expect(() => pad('', -1)).toThrow(ParameterError);
    });
  });

  // ============================
  // 转义与变换函数
  // ============================
  describe('deburr', () => {
    it('should remove diacritical marks from letters', () => {
      expect(deburr('déjà vu')).toBe('deja vu');
      expect(deburr('naïve')).toBe('naive');
      expect(deburr('café')).toBe('cafe');
      expect(deburr('çafe')).toBe('cafe');
      expect(deburr('über')).toBe('uber');
      expect(deburr('ångström')).toBe('angstrom');
    });
  });

  describe('escapeRegExp', () => {
    it('should escape regex special characters', () => {
      expect(escapeRegExp('.*+?^${}()|[]\\')).toBe(
        '\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\',
      );
      expect(escapeRegExp('^test$')).toBe('\\^test\\$');
      expect(escapeRegExp('hello world')).toBe('hello world');
      expect(escapeRegExp('test123')).toBe('test123');
    });
  });

  describe('escape', () => {
    it('should escape HTML special characters', () => {
      expect(escape('<div>')).toBe('&lt;div&gt;');
      expect(escape('"quotes" & \'apostrophes\'')).toBe(
        '&quot;quotes&quot; &amp; &#39;apostrophes&#39;',
      );
      expect(escape('hello')).toBe('hello');
      expect(escape('test123')).toBe('test123');
    });
  });

  describe('unescape', () => {
    it('should unescape HTML entities', () => {
      expect(unescape('&lt;div&gt;')).toBe('<div>');
      expect(unescape('&quot;test&quot;')).toBe('"test"');
      expect(unescape('&#39;apostrophe&#39;')).toBe("'apostrophe'");
      expect(unescape('&lt;div&gt; and &amp;')).toBe('<div> and &');
      expect(unescape('a &lt; b &gt; c')).toBe('a < b > c');
      // 未知实体保持原样（覆盖第87行保护逻辑）
      expect(unescape('&unknown;')).toBe('&unknown;');
      expect(unescape('&lt;div&gt;&copy;&lt;/div&gt;')).toBe(
        '<div>&copy;</div>',
      );
      expect(unescape('&#38;')).toBe('&#38;');
      expect(unescape('&ampersand;')).toBe('&ampersand;');
    });
  });

  describe('reverseString', () => {
    it('should reverse string correctly', () => {
      expect(reverseString('hello')).toBe('olleh');
      expect(reverseString('世界')).toBe('界世');
      expect(reverseString('')).toBe('');
      expect(reverseString('🎉🎈')).toBe('🎈🎉');
      expect(reverseString('a😀b')).toBe('b😀a');
    });
  });

  // ============================
  // 大小写转换函数
  // ============================
  describe('camelCase', () => {
    it('should convert strings to camelCase', () => {
      expect(camelCase('foo bar')).toBe('fooBar');
      expect(camelCase('Foo Bar')).toBe('fooBar');
      expect(camelCase('--foo-bar--')).toBe('fooBar');
      expect(camelCase('__FOO_BAR__')).toBe('fooBar');
      expect(camelCase('test 123 case')).toBe('test123Case');
      expect(camelCase('123test')).toBe('123test');
      expect(camelCase('')).toBe('');
    });
  });

  describe('capitalize', () => {
    it('should capitalize first letter and lowercase the rest', () => {
      expect(capitalize('hello')).toBe('Hello');
      expect(capitalize('HELLO')).toBe('Hello');
      expect(capitalize('hElLo')).toBe('Hello');
      expect(capitalize('')).toBe(''); // 空字符串保护（原第101行）
      expect(capitalize('a')).toBe('A');
      expect(capitalize('A')).toBe('A');
    });
  });

  describe('constantCase', () => {
    it('should convert to UPPER_SNAKE_CASE', () => {
      expect(constantCase('foo bar')).toBe('FOO_BAR');
      expect(constantCase('__foo_bar__')).toBe('FOO_BAR');
      expect(constantCase('testURL')).toBe('TEST_URL');
      expect(constantCase('XMLHttpRequest')).toBe('XML_HTTP_REQUEST');
    });
  });

  describe('kebabCase', () => {
    it('should convert to kebab-case', () => {
      expect(kebabCase('foo bar')).toBe('foo-bar');
      expect(kebabCase('Foo Bar')).toBe('foo-bar');
      expect(kebabCase('__FOO_BAR__')).toBe('foo-bar');
      expect(kebabCase('camelCase')).toBe('camel-case');
      expect(kebabCase('PascalCase')).toBe('pascal-case');
    });
  });

  describe('lowerCase', () => {
    it('should convert to lower case with spaces', () => {
      expect(lowerCase('fooBar')).toBe('foo bar');
      expect(lowerCase('__FOO_BAR__')).toBe('foo bar');
      expect(lowerCase('FOO BAR')).toBe('foo bar');
      expect(lowerCase('foo-bar')).toBe('foo bar');
      expect(lowerCase('foo_bar')).toBe('foo bar');
    });
  });

  describe('lowerFirst', () => {
    it('should lower case first character only', () => {
      expect(lowerFirst('Hello')).toBe('hello');
      expect(lowerFirst('HELLO')).toBe('hELLO');
      expect(lowerFirst('hELLO')).toBe('hELLO');
      expect(lowerFirst('')).toBe('');
    });
  });

  describe('pascalCase', () => {
    it('should convert to PascalCase', () => {
      expect(pascalCase('foo bar')).toBe('FooBar');
      expect(pascalCase('foo-bar')).toBe('FooBar');
      expect(pascalCase('foo_bar')).toBe('FooBar');
      expect(pascalCase('xml http request')).toBe('XmlHttpRequest');
      expect(pascalCase('test url')).toBe('TestUrl');
      expect(pascalCase('')).toBe('');
    });
  });

  describe('snakeCase', () => {
    it('should convert to snake_case', () => {
      expect(snakeCase('foo bar')).toBe('foo_bar');
      expect(snakeCase('foo-bar')).toBe('foo_bar');
      expect(snakeCase('FooBar')).toBe('foo_bar');
      expect(snakeCase('test123Case')).toBe('test123_case');
      expect(snakeCase('123test')).toBe('123test');
    });
  });

  describe('startCase', () => {
    it('should capitalize each word', () => {
      expect(startCase('foo bar')).toBe('Foo Bar');
      expect(startCase('--foo-bar--')).toBe('Foo Bar');
      expect(startCase('fooBar')).toBe('Foo Bar');
      expect(startCase('test123')).toBe('Test 123');
      expect(startCase('123test')).toBe('123 Test');
      expect(startCase('fooBarBaz')).toBe('Foo Bar Baz');
      expect(startCase('XMLHttpRequest')).toBe('Xml Http Request');
      expect(startCase('')).toBe('');
      // 单字母场景（原集成测试移入）
      expect(startCase('a')).toBe('A');
      expect(startCase('a b c')).toBe('A B C');
      expect(startCase('a1 b2')).toBe('A 1 B 2');
    });
  });

  describe('upperCase', () => {
    it('should convert to upper case with spaces', () => {
      expect(upperCase('foo bar')).toBe('FOO BAR');
      expect(upperCase('--foo-bar--')).toBe('FOO BAR');
      expect(upperCase('fooBar')).toBe('FOO BAR');
      expect(upperCase('foo_bar-baz')).toBe('FOO BAR BAZ');
      expect(upperCase('fooBarBaz')).toBe('FOO BAR BAZ');
    });
  });

  describe('upperFirst', () => {
    it('should upper case first character only', () => {
      expect(upperFirst('hello')).toBe('Hello');
      expect(upperFirst('hELLO')).toBe('HELLO');
      expect(upperFirst('HELLO')).toBe('HELLO');
      expect(upperFirst('')).toBe('');
    });
  });

  // ============================
  // 单词提取函数
  // ============================
  describe('words', () => {
    it('should extract words from string', () => {
      expect(words('hello world')).toEqual(['hello', 'world']);
      expect(words('foo, bar & baz')).toEqual(['foo', 'bar', 'baz']);
      expect(words('hello-world')).toEqual(['hello', 'world']);
      expect(words('你好 世界')).toEqual(['你好', '世界']);
      expect(words('café crème')).toEqual(['café', 'crème']);
      expect(words('test123')).toEqual(['test123']);
      expect(words('123 456')).toEqual(['123', '456']);
      expect(words('')).toEqual([]);
      expect(words('!@#$%')).toEqual([]);
    });
  });

  // ============================
  // 随机字符串生成函数
  // ============================
  describe('randomString', () => {
    it('should generate string with specified length using default charset', () => {
      const result = randomString(10);
      expect(result.length).toBe(10);
      // 验证只包含默认字符集字符
      expect(result).toMatch(/^[A-Za-z0-9]+$/);
    });

    it('should generate empty string when length is 0', () => {
      expect(randomString(0)).toBe('');
    });

    it('should use custom charset when provided', () => {
      const result = randomString(8, 'abc');
      expect(result.length).toBe(8);
      expect(result).toMatch(/^[abc]+$/);
    });

    it('should generate numeric string with digit charset', () => {
      const result = randomString(6, '0123456789');
      expect(result.length).toBe(6);
      expect(result).toMatch(/^\d+$/);
    });

    it('should return empty string when charset is empty', () => {
      expect(randomString(5, '')).toBe('');
    });

    it('should throw ParameterError for negative length', () => {
      expect(() => randomString(-1)).toThrow(ParameterError);
      expect(() => randomString(-5, 'abc')).toThrow(ParameterError);
    });

    it('should throw ParameterError for non-integer length', () => {
      expect(() => randomString(3.5)).toThrow(ParameterError);
      expect(() => randomString(3.14, 'abc')).toThrow(ParameterError);
    });

    it('should generate different results on multiple calls', () => {
      // 由于随机性，多次调用应该大概率产生不同结果
      const results = new Set<string>();
      for (let i = 0; i < 10; i++) {
        results.add(randomString(10));
      }
      // 10次调用中至少应该有多个不同结果（极大概率）
      expect(results.size).toBeGreaterThan(1);
    });

    it('should handle unicode characters in charset', () => {
      const result = randomString(5, '你好世界');
      expect(result.length).toBe(5);
      expect(result).toMatch(/^[你好世界]+$/);
    });

    it('should handle special characters in charset', () => {
      const result = randomString(10, '!@#$%^&*()');
      expect(result.length).toBe(10);
      expect(result).toMatch(/^[ !@#$%^&*()]+$/);
    });
  });

  // ============================
  // 模板字符串函数
  // ============================
  describe('template', () => {
    it('should replace simple placeholders', () => {
      expect(template('Hello {{name}}!', {name: 'Alice'})).toBe('Hello Alice!');
      expect(template('Welcome to {{company}}!', {company: 'Tech Corp'})).toBe(
        'Welcome to Tech Corp!',
      );
    });

    it('should replace multiple placeholders', () => {
      expect(
        template('Hello {{name}}, welcome to {{company}}!', {
          name: 'Alice',
          company: 'Tech Corp',
        }),
      ).toBe('Hello Alice, welcome to Tech Corp!');
    });

    it('should support nested paths', () => {
      expect(template('Hello {{user.name}}!', {user: {name: 'Bob'}})).toBe(
        'Hello Bob!',
      );
      expect(
        template('Welcome to {{company.info.name}}!', {
          company: {info: {name: 'Tech Corp'}},
        }),
      ).toBe('Welcome to Tech Corp!');
    });

    it('should support deeply nested paths', () => {
      expect(
        template('Value: {{data.nested.deep.value}}', {
          data: {nested: {deep: {value: 42}}},
        }),
      ).toBe('Value: 42');
    });

    it('should handle placeholders with spaces', () => {
      expect(template('Hello {{ name }}!', {name: 'Alice'})).toBe(
        'Hello Alice!',
      );
      expect(
        template('Welcome to {{ company }}!', {
          company: 'Tech Corp',
        }),
      ).toBe('Welcome to Tech Corp!');
    });

    it('should replace undefined and null values with empty string', () => {
      expect(template('Hello {{name}}!', {})).toBe('Hello !');
      expect(template('Hello {{name}}!', {name: undefined})).toBe('Hello !');
      expect(template('Hello {{name}}!', {name: null})).toBe('Hello !');
      expect(template('Hello {{user.name}}!', {user: {}})).toBe('Hello !');
    });

    it('should handle numeric values', () => {
      expect(template('Age: {{age}}', {age: 25})).toBe('Age: 25');
      expect(template('Score: {{score}}', {score: 99.9})).toBe('Score: 99.9');
    });

    it('should handle boolean values', () => {
      expect(template('Active: {{active}}', {active: true})).toBe(
        'Active: true',
      );
      expect(template('Active: {{active}}', {active: false})).toBe(
        'Active: false',
      );
    });

    it('should handle repeated placeholders', () => {
      expect(
        template('{{name}} says hello to {{name}}', {
          name: 'Alice',
        }),
      ).toBe('Alice says hello to Alice');
    });

    it('should handle mixed nested and simple paths', () => {
      expect(
        template('{{user.name}} works at {{company}}', {
          user: {name: 'Alice'},
          company: 'Tech Corp',
        }),
      ).toBe('Alice works at Tech Corp');
    });

    it('should handle empty template string', () => {
      expect(template('', {name: 'Alice'})).toBe('');
    });

    it('should handle template with no placeholders', () => {
      expect(template('Hello World!', {name: 'Alice'})).toBe('Hello World!');
    });

    it('should handle array values', () => {
      expect(template('Items: {{items}}', {items: [1, 2, 3]})).toBe(
        'Items: 1,2,3',
      );
    });

    it('should handle object values', () => {
      expect(
        template('Config: {{config}}', {
          config: {key: 'value'},
        }),
      ).toBe('Config: [object Object]');
    });

    it('should handle missing nested paths gracefully', () => {
      expect(template('Hello {{user.profile.name}}!', {user: {}})).toBe(
        'Hello !',
      );
      expect(template('Hello {{missing.path}}!', {})).toBe('Hello !');
    });

    it('should handle special characters in values', () => {
      expect(
        template('Message: {{msg}}', {
          msg: 'Hello & <world> "test"',
        }),
      ).toBe('Message: Hello & <world> "test"');
    });

    it('should handle consecutive placeholders', () => {
      expect(template('{{first}}{{last}}', {first: 'John', last: 'Doe'})).toBe(
        'JohnDoe',
      );
    });

    it('should handle placeholders at start and end', () => {
      expect(
        template('{{start}} middle {{end}}', {
          start: 'START',
          end: 'END',
        }),
      ).toBe('START middle END');
    });

    it('should handle zero and empty string values', () => {
      expect(template('Value: {{value}}', {value: 0})).toBe('Value: 0');
      expect(template('Value: {{value}}', {value: ''})).toBe('Value: ');
    });

    it('should handle complex nested structures', () => {
      const data = {
        user: {
          profile: {
            name: 'Alice',
            age: 30,
            address: {
              city: 'New York',
              country: 'USA',
            },
          },
        },
      };
      expect(
        template(
          '{{user.profile.name}} is {{user.profile.age}} years old from {{user.profile.address.city}}, {{user.profile.address.country}}',
          data,
        ),
      ).toBe('Alice is 30 years old from New York, USA');
    });
  });

  // ============================
  // 跨函数集成测试
  // ============================
  describe('Integration Tests', () => {
    it('should handle diacritical marks in case conversions', () => {
      expect(camelCase('déjà-vu')).toBe('dejaVu');
      expect(pascalCase('café-au-lait')).toBe('CafeAuLait');
    });

    it('should chain transformations correctly', () => {
      const original = '  Héllo-Wörld!  ';
      const trimmed = trim(original);
      const deburred = deburr(trimmed);
      const kebabed = kebabCase(deburred);
      expect(kebabed).toBe('hello-world');
    });

    it('should handle edge cases in unescape and capitalize integration', () => {
      const html = '&lt;b&gt;&unknown;&lt;/b&gt;';
      const unescaped = unescape(html);
      const capitalized = capitalize(unescaped);
      expect(unescaped).toBe('<b>&unknown;</b>');
      expect(capitalized).toBe('<b>&unknown;</b>');
      expect(capitalize(unescape(''))).toBe('');
    });
  });
});
