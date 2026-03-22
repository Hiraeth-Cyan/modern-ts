// ========================================
// ./src/Utils/Object/base.spec.ts
// ========================================

import {describe, it, expect} from 'vitest';
import {
  mapKeys,
  mapValues,
  invert,
  pick,
  pickBy,
  omit,
  omitBy,
  findKey,
  merge,
  mergeWith,
  MERGE_SKIP,
  MERGE_DEFAULT,
  flattenObject,
  toCamelCaseKeys,
  toSnakeCaseKeys,
} from './base';

// ============================
// 测试数据
// ============================

const TEST_OBJECT = {
  id: 1,
  name: 'Alice',
  age: 30,
  email: 'alice@example.com',
  is_active: true,
  created_at: '2023-01-01',
} as const;

const NESTED_OBJECT = {
  user: {
    id: 1,
    profile: {
      name: 'Bob',
      address: {
        city: 'New York',
        street: '123 Main St',
      },
    },
  },
  settings: {
    theme: 'dark',
    notifications: true,
  },
};

// ============================
// mapKeys 测试
// ============================
describe.concurrent('mapKeys', () => {
  it('should transform keys using the provided function', () => {
    const result = mapKeys(TEST_OBJECT, (_, key) => key.toUpperCase());

    expect(result).toEqual({
      ID: 1,
      NAME: 'Alice',
      AGE: 30,
      EMAIL: 'alice@example.com',
      IS_ACTIVE: true,
      CREATED_AT: '2023-01-01',
    });
  });

  it('should provide value and key to the iteratee', () => {
    const result = mapKeys(
      TEST_OBJECT,
      (value, key) => `${typeof value}_${key}`,
    );

    expect(result['number_age']).toBe(30);
    expect(result['string_name']).toBe('Alice');
    expect(result['boolean_is_active']).toBe(true);
  });

  it('should return empty object when input is empty', () => {
    const result = mapKeys({}, (_, key: string) => `prefix_${key}`);
    expect(result).toEqual({});
  });
});

// ============================
// mapValues 测试
// ============================
describe.concurrent('mapValues', () => {
  it('should transform values while keeping keys unchanged', () => {
    const result = mapValues(TEST_OBJECT, (value) =>
      typeof value === 'number' ? value * 2 : value,
    );

    expect(result).toEqual({
      id: 2,
      name: 'Alice',
      age: 60,
      email: 'alice@example.com',
      is_active: true,
      created_at: '2023-01-01',
    });
  });

  it('should have access to key in transformation function', () => {
    const result = mapValues(TEST_OBJECT, (value, key) => {
      if (key === 'name') return `Mr/Ms ${value}`;
      if (key === 'age') return `${value} years old`;
      return value;
    });

    expect(result.name).toBe('Mr/Ms Alice');
    expect(result.age).toBe('30 years old');
  });

  it('should allow returning different value types', () => {
    const result = mapValues({a: 1, b: 2}, (value) => `value: ${value}`);
    expect(result).toEqual({a: 'value: 1', b: 'value: 2'});
  });
});

// ============================
// invert 测试
// ============================
describe.concurrent('invert', () => {
  it('should create an object composed of the inverted keys and values', () => {
    const obj = {a: 1, b: 2, c: 3};
    const result = invert(obj);

    expect(result).toEqual({1: 'a', 2: 'b', 3: 'c'});
  });

  it('should handle string and number values correctly', () => {
    const obj = {key1: 'value1', key2: 100, key3: 'test'};
    const result = invert(obj);

    expect(result).toEqual({
      value1: 'key1',
      '100': 'key2',
      test: 'key3',
    });
  });

  it('should overwrite duplicate values with the last occurring key', () => {
    const obj = {a: 'same', b: 'same', c: 'different'};
    const result = invert(obj);

    expect(result).toEqual({
      same: 'b',
      different: 'c',
    });
  });
});

// ============================
// pick 测试
// ============================
describe.concurrent('pick', () => {
  it('should pick specified keys from object', () => {
    const result = pick(TEST_OBJECT, ['name', 'email', 'age']);

    expect(result).toEqual({
      name: 'Alice',
      email: 'alice@example.com',
      age: 30,
    });
    expect(result).not.toHaveProperty('id');
  });

  it('should ignore keys that do not exist in the object', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = pick(TEST_OBJECT, ['name', 'non_existent' as any, 'email']);

    expect(result).toEqual({
      name: 'Alice',
      email: 'alice@example.com',
    });
  });

  it('should return empty object if no keys match', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = pick(TEST_OBJECT, ['non_existent' as any]);
    expect(result).toEqual({});
  });
});

// ============================
// pickBy 测试
// ============================
describe.concurrent('pickBy', () => {
  it('should pick properties where predicate returns true', () => {
    const result = pickBy(TEST_OBJECT, (value) => typeof value === 'number');

    expect(result).toEqual({id: 1, age: 30});
  });

  it('should provide key to the predicate function', () => {
    const result = pickBy(TEST_OBJECT, (_, key) => key.includes('at'));

    expect(result).toEqual({created_at: '2023-01-01'});
  });

  it('should handle complex filtering logic', () => {
    const result = pickBy(TEST_OBJECT, (value) => {
      if (typeof value === 'number') return value > 10;
      return typeof value === 'string' && value.length > 5;
    });

    expect(result).toEqual({
      age: 30,
      email: 'alice@example.com',
      created_at: '2023-01-01',
    });
  });
});

// ============================
// omit 测试
// ============================
describe.concurrent('omit', () => {
  it('should remove specified keys from object', () => {
    const result = omit(TEST_OBJECT, ['id', 'created_at']);

    expect(result).toEqual({
      name: 'Alice',
      age: 30,
      email: 'alice@example.com',
      is_active: true,
    });
    expect(result).not.toHaveProperty('id');
  });

  it('should ignore non-existent keys during omission', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = omit(TEST_OBJECT, ['id', 'non_existent' as any]);

    expect(result).toEqual({
      name: 'Alice',
      age: 30,
      email: 'alice@example.com',
      is_active: true,
      created_at: '2023-01-01',
    });
  });

  it('should return a clone when no keys are provided', () => {
    const result = omit(TEST_OBJECT, []);
    expect(result).toEqual(TEST_OBJECT);
  });
});

// ============================
// omitBy 测试
// ============================
describe.concurrent('omitBy', () => {
  it('should remove properties where predicate returns true', () => {
    const result = omitBy(TEST_OBJECT, (value) => typeof value === 'boolean');

    expect(result).toEqual({
      id: 1,
      name: 'Alice',
      age: 30,
      email: 'alice@example.com',
      created_at: '2023-01-01',
    });
  });

  it('should provide key to the predicate function', () => {
    const result = omitBy(TEST_OBJECT, (_, key) => key.includes('e'));
    expect(result).toEqual({id: 1});
  });

  it('should return empty object if predicate matches all', () => {
    const result = omitBy(TEST_OBJECT, () => true);
    expect(result).toEqual({});
  });
});

// ============================
// findKey 测试
// ============================
describe.concurrent('findKey', () => {
  it('should return the first key matching the predicate', () => {
    const key = findKey(TEST_OBJECT, (value) => typeof value === 'string');
    expect(key).toBe('name');
  });

  it('should support checking both value and key in predicate', () => {
    const key = findKey(
      TEST_OBJECT,
      (value, key) => value === 30 && key === 'age',
    );
    expect(key).toBe('age');
  });

  it('should skip inherited properties', () => {
    const parent = {inheritedKey: 'parentValue'};
    const child = Object.create(parent) as Record<string, unknown>;
    child.ownKey = 'ownValue';

    const key = findKey(child, (val) => val === 'parentValue');
    expect(key).toBeUndefined();
  });
});

// ============================
// merge 测试
// ============================
describe.concurrent('merge', () => {
  it('should deep merge multiple objects', () => {
    const obj1 = {a: 1, b: {x: 1}};
    const obj2 = {b: {y: 2}, c: 3};
    const obj3 = {d: 4};

    const result = merge(obj1, obj2, obj3);

    expect(result).toEqual({
      a: 1,
      b: {x: 1, y: 2},
      c: 3,
      d: 4,
    });
  });

  it('should not mutate source or target objects', () => {
    const source = {a: 1};
    const target = {b: 2};

    const result = merge(target, source);

    expect(result).toEqual({a: 1, b: 2});
    expect(source).toEqual({a: 1});
    expect(target).toEqual({b: 2});
  });

  it('should handle empty objects gracefully', () => {
    expect(merge({})).toEqual({});
    expect(merge({}, {})).toEqual({});
    expect(merge({a: 1}, {})).toEqual({a: 1});
  });

  it('should overwrite primitive values with objects during deep merge', () => {
    const target = {a: 1, b: {c: 2}};
    const source = {a: {x: 10}};

    const result = merge(target, source);

    expect(result).toEqual({
      a: {x: 10},
      b: {c: 2},
    });
  });

  it('should skip inherited properties of the source object', () => {
    const parent = {inheritedProp: 'parent_value'};
    const source = Object.create(parent) as Record<string, unknown>;
    source.ownProp = 'own_value';

    const result = merge({}, source);

    expect(result).toEqual({ownProp: 'own_value'});
    expect(result).not.toHaveProperty('inheritedProp');
  });
});

// ============================
// mergeWith 测试
// ============================
describe.concurrent('mergeWith', () => {
  it('should use customizer to resolve values', () => {
    const customizer = (targetVal: unknown, sourceVal: unknown) => {
      if (typeof targetVal === 'number' && typeof sourceVal === 'number') {
        return targetVal + sourceVal;
      }
      return MERGE_DEFAULT;
    };

    const target = {a: 1, b: 'hello', c: {x: 1}};
    const source = {a: 2, b: 'world', c: {y: 2}};

    const result = mergeWith(target, customizer, source);

    expect(result).toEqual({
      a: 3,
      b: 'world',
      c: {x: 1, y: 2},
    });
    expect(target.a).toBe(1); // Verify immutability
  });

  it('should support skipping merge with MERGE_SKIP', () => {
    const customizer = (
      _targetVal: unknown,
      _sourceVal: unknown,
      key: string,
    ) => {
      if (key === 'skipMe') return MERGE_SKIP;
      return MERGE_DEFAULT;
    };

    const result = mergeWith({a: 1, skipMe: 'original'}, customizer, {
      a: 2,
      skipMe: 'new',
    });

    expect(result).toEqual({
      a: 2,
      skipMe: 'original',
    });
  });

  it('should handle deep merge with recursive customizer', () => {
    const customizer = (targetValue: unknown, sourceValue: unknown) => {
      if (
        targetValue &&
        sourceValue &&
        typeof targetValue === 'object' &&
        typeof sourceValue === 'object' &&
        !Array.isArray(targetValue) &&
        !Array.isArray(sourceValue)
      ) {
        return mergeWith(
          targetValue as Record<string, unknown>,
          customizer,
          sourceValue as Record<string, unknown>,
        );
      }
      return MERGE_DEFAULT;
    };

    const result = mergeWith({a: 1, nested: {x: 1, y: 2}}, customizer, {
      b: 2,
      nested: {y: 20, z: 3},
    });

    expect(result).toEqual({
      a: 1,
      b: 2,
      nested: {x: 1, y: 20, z: 3},
    });
  });

  it('should overwrite primitives with objects when customizer returns MERGE_DEFAULT', () => {
    const customizer = () => MERGE_DEFAULT;

    const target = {config: 'string_config'};
    const source = {config: {enabled: true}};

    const result = mergeWith(target, customizer, source);

    expect(result).toEqual({
      config: {enabled: true},
    });
    expect(typeof result.config).toBe('object');
  });

  it('should assign custom value directly if not MERGE_DEFAULT or MERGE_SKIP', () => {
    const customizer = () => 'custom_value';

    const result = mergeWith({a: 1}, customizer, {a: 2});

    expect(result).toEqual({a: 'custom_value'});
  });
});

// ============================
// flattenObject 测试
// ============================
describe.concurrent('flattenObject', () => {
  it('should flatten nested object with default separator', () => {
    const result = flattenObject(NESTED_OBJECT);

    expect(result).toEqual({
      'user.id': 1,
      'user.profile.name': 'Bob',
      'user.profile.address.city': 'New York',
      'user.profile.address.street': '123 Main St',
      'settings.theme': 'dark',
      'settings.notifications': true,
    });
  });

  it('should use custom separator', () => {
    const result = flattenObject(NESTED_OBJECT, '_');

    expect(result).toEqual({
      user_id: 1,
      user_profile_name: 'Bob',
      user_profile_address_city: 'New York',
      user_profile_address_street: '123 Main St',
      settings_theme: 'dark',
      settings_notifications: true,
    });
  });

  it('should handle empty nested objects', () => {
    const obj = {a: {b: {}}, c: 1};
    const result = flattenObject(obj);

    expect(result).toEqual({
      'a.b': {},
      c: 1,
    });
  });

  it('should handle non-object values (null, array, primitive)', () => {
    const obj = {a: null, b: undefined, c: [1, 2], d: 123};
    const result = flattenObject(obj);

    expect(result).toEqual({
      a: null,
      b: undefined,
      c: [1, 2],
      d: 123,
    });
  });

  it('should skip inherited properties', () => {
    const parent = {inherited: true};
    const child = Object.create(parent) as Record<string, unknown>;
    child.own = true;

    const result = flattenObject(child);

    expect(result).toEqual({own: true});
    expect(result).not.toHaveProperty('inherited');
  });
});

// ============================
// toCamelCaseKeys 测试
// ============================
describe.concurrent('toCamelCaseKeys', () => {
  it('should convert snake_case keys to camelCase recursively', () => {
    const snakeCaseObj = {
      first_name: 'John',
      last_name: 'Doe',
      user_age: 30,
      contact_info: {
        email_address: 'john@example.com',
        phone_number: '1234567890',
      },
    };

    const result = toCamelCaseKeys(snakeCaseObj);

    expect(result).toEqual({
      firstName: 'John',
      lastName: 'Doe',
      userAge: 30,
      contactInfo: {
        emailAddress: 'john@example.com',
        phoneNumber: '1234567890',
      },
    });
  });

  it('should convert keys within arrays', () => {
    const obj = {
      user_list: [
        {user_name: 'Alice', user_age: 25},
        {user_name: 'Bob', user_age: 30},
      ],
    };

    const result = toCamelCaseKeys(obj);

    expect(result).toEqual({
      userList: [
        {userName: 'Alice', userAge: 25},
        {userName: 'Bob', userAge: 30},
      ],
    });
  });

  it('should not modify non-object values', () => {
    const obj = {
      test_key: 'value',
      nested: {another_key: 123},
      primitive: 456,
      array: [{array_key: 'test'}],
    };

    const result = toCamelCaseKeys(obj);

    expect(result).toEqual({
      testKey: 'value',
      nested: {anotherKey: 123},
      primitive: 456,
      array: [{arrayKey: 'test'}],
    });
  });

  it('should return primitive values as-is', () => {
    expect(toCamelCaseKeys(123)).toBe(123);
    expect(toCamelCaseKeys(null)).toBe(null);
    expect(toCamelCaseKeys('string')).toBe('string');
    expect(toCamelCaseKeys(undefined)).toBe(undefined);
  });

  it('should preserve class instances', () => {
    class MyClass {
      constructor(public value: number) {}
    }
    const instance = new MyClass(10);

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const result = toCamelCaseKeys({data: instance}) as {data: MyClass};

    expect(result.data).toBe(instance);
    expect(result.data.value).toBe(10);
  });
});

// ============================
// toSnakeCaseKeys 测试
// ============================
describe.concurrent('toSnakeCaseKeys', () => {
  it('should convert camelCase keys to snake_case recursively', () => {
    const camelCaseObj = {
      firstName: 'John',
      lastName: 'Doe',
      userAge: 30,
      contactInfo: {
        emailAddress: 'john@example.com',
        phoneNumber: '1234567890',
      },
    };

    const result = toSnakeCaseKeys(camelCaseObj);

    expect(result).toEqual({
      first_name: 'John',
      last_name: 'Doe',
      user_age: 30,
      contact_info: {
        email_address: 'john@example.com',
        phone_number: '1234567890',
      },
    });
  });

  it('should handle mixed case patterns (PascalCase, consecutive capitals)', () => {
    const obj = {
      HTTPRequest: 'test',
      userId: 123,
      XMLHttpRequest: 'data',
      already_snake: 'unchanged',
    };

    const result = toSnakeCaseKeys(obj);

    expect(result).toEqual({
      http_request: 'test',
      user_id: 123,
      xml_http_request: 'data',
      already_snake: 'unchanged',
    });
  });

  it('should preserve non-plain objects like Date and RegExp', () => {
    const date = new Date();
    const regex = /test/;

    const obj = {
      createdAt: date,
      pattern: regex,
      data: {userName: 'Test'},
    };

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const result = toSnakeCaseKeys(obj) as {
      created_at: Date;
      pattern: RegExp;
      data: {user_name: string};
    };

    expect(result.created_at).toBe(date);
    expect(result.pattern).toBe(regex);
    expect(result.data).toEqual({user_name: 'Test'});
  });
});
