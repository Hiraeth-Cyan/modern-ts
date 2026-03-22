// ========================================
// ./src/Result/Operators/transform.spec.ts
// ========================================
import {beforeEach, describe, it, expect, vi} from 'vitest';
import {
  map,
  mapErr,
  mapBoth,
  andThen,
  recover,
  orElse,
  filter,
} from './transform';
import {Ok, Err} from '../base';
import type {Result} from '../types';

// ============================
// 测试辅助函数
// ============================
const numberValue = 42;
const stringValue = 'test';
const objectValue = {id: 1, name: 'test'};

const increment = vi.fn((x: number) => x + 1);
const toUpperCase = vi.fn((s: string) => s.toUpperCase());
const appendProcessed = vi.fn((obj: {id: number; name: string}) => ({
  ...obj,
  processed: true,
}));

const errorToString = vi.fn((error: Error) => error.message);

// ============================
// map 函数测试
// ============================
describe('map Function Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should transform Ok value using the provided function', () => {
    const result = Ok(numberValue);
    const mapped = map(result, increment);

    expect(increment).toHaveBeenCalledWith(numberValue);
    expect(mapped).toEqual(Ok(43));
  });

  it('should preserve Err without applying transformation', () => {
    const error = new Error('original error');
    const result = Err(error);
    const mapped = map(result, increment);

    expect(increment).not.toHaveBeenCalled();
    expect(mapped).toEqual(Err(error));
  });

  it('should handle different value types', () => {
    const stringResult = Ok(stringValue);
    const objectResult = Ok(objectValue);

    expect(map(stringResult, toUpperCase)).toEqual(Ok('TEST'));
    expect(map(objectResult, appendProcessed)).toEqual(
      Ok({...objectValue, processed: true}),
    );
  });

  it('should propagate null and undefined values through transformation', () => {
    const nullResult = Ok(null);
    const undefinedResult = Ok(undefined);

    expect(map(nullResult, (v) => v)).toEqual(Ok(null));
    expect(map(undefinedResult, (v) => v)).toEqual(Ok(undefined));
  });
});

// ============================
// mapErr 函数测试
// ============================
describe('mapErr Function Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should transform Err value using the provided function', () => {
    const error = new Error('database error');
    const result = Err(error);
    const mapped = mapErr(result, errorToString);

    expect(errorToString).toHaveBeenCalledWith(error);
    expect(mapped).toEqual(Err('database error'));
  });

  it('should preserve Ok without applying transformation', () => {
    const result = Ok(numberValue);
    const mapped = mapErr(result, errorToString);

    expect(errorToString).not.toHaveBeenCalled();
    expect(mapped).toEqual(Ok(numberValue));
  });

  it('should handle string error transformations', () => {
    const stringError = 'connection failed';
    const result = Err(stringError);

    const mapped = mapErr(result, (msg) => `Error: ${msg}`);
    expect(mapped).toEqual(Err('Error: connection failed'));
  });

  it('should change error type completely', () => {
    const result = Err('404');
    const mapped = mapErr(result, (code) => new Error(`HTTP ${code}`));

    expect(mapped).toEqual(Err(new Error('HTTP 404')));
  });
});

// ============================
// mapBoth 函数测试
// ============================
describe('mapBoth Function Tests', () => {
  const successTransform = vi.fn((x: number) => x * 2);
  const errorTransform = vi.fn((e: Error) => e.message.toUpperCase());

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should apply success transform to Ok values', () => {
    const result = Ok(21);
    const mapped = mapBoth(result, successTransform, errorTransform);

    expect(successTransform).toHaveBeenCalledWith(21);
    expect(errorTransform).not.toHaveBeenCalled();
    expect(mapped).toEqual(Ok(42));
  });

  it('should apply error transform to Err values', () => {
    const error = new Error('not found');
    const result = Err(error);
    const mapped = mapBoth(result, successTransform, errorTransform);

    expect(errorTransform).toHaveBeenCalledWith(error);
    expect(successTransform).not.toHaveBeenCalled();
    expect(mapped).toEqual(Err('NOT FOUND'));
  });

  it('should transform both value and error types', () => {
    const successResult = Ok(10);
    const errorResult = Err(new Error('failed'));

    const successMapped = mapBoth(
      successResult,
      (n) => ({value: n}),
      (e: Error) => ({error: e.message}),
    );

    const errorMapped = mapBoth(
      errorResult,
      (n) => ({value: n}),
      (e) => ({error: e.message}),
    );

    expect(successMapped).toEqual(Ok({value: 10}));
    expect(errorMapped).toEqual(Err({error: 'failed'}));
  });
});

// ============================
// andThen 函数测试
// ============================
describe('andThen Function Tests', () => {
  const safeDivide = vi.fn((x: number) =>
    x === 0 ? Err(new Error('division by zero')) : Ok(100 / x),
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should chain operations on Ok values', () => {
    const result = Ok(10);
    const chained = andThen(result, safeDivide);

    expect(safeDivide).toHaveBeenCalledWith(10);
    expect(chained).toEqual(Ok(10)); // 100 / 10 = 10
  });

  it('should propagate Err without calling the function', () => {
    const error = new Error('invalid input');
    const result = Err(error);
    const chained = andThen(result, safeDivide);

    expect(safeDivide).not.toHaveBeenCalled();
    expect(chained).toEqual(Err(error));
  });

  it('should handle chain that returns Err', () => {
    const result = Ok(0); // This will cause division by zero
    const chained = andThen(result, safeDivide);

    expect(safeDivide).toHaveBeenCalledWith(0);
    expect(chained).toEqual(Err(new Error('division by zero')));
  });

  it('should support different return types in the chain', () => {
    const parseNumber = (str: string): Result<number, Error> => {
      const num = parseInt(str, 10);
      return isNaN(num) ? Err(new Error('invalid number')) : Ok(num);
    };

    const result = Ok('42');
    const chained = andThen(result, parseNumber);

    expect(chained).toEqual(Ok(42));
  });
});

// ============================
// recover 函数测试
// ============================
describe('recover Function Tests', () => {
  const fallbackUser = {id: 0, name: 'Guest'};
  const recoveryFn = vi.fn(() => Ok(fallbackUser));

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return original Ok without calling recovery function', () => {
    const user = {id: 1, name: 'Alice'};
    const result = Ok(user);
    const recovered = recover(result, recoveryFn);
    const recovered1 = orElse(result, recoveryFn);

    expect(recoveryFn).not.toHaveBeenCalled();
    expect(recovered).toEqual(Ok(user));
    expect(recovered1).toEqual(Ok(user));
  });

  it('should attempt recovery on Err values', () => {
    const error = new Error('user not found');
    const result = Err(error);
    const recovered = recover(result, recoveryFn);

    expect(recoveryFn).toHaveBeenCalledWith(error);
    expect(recovered).toEqual(Ok(fallbackUser));
  });

  it('should handle recovery that also fails', () => {
    const alwaysFail = vi.fn(() => Err(new Error('recovery failed')));
    const result = Err(new Error('original error'));
    const recovered = recover(result, alwaysFail);

    expect(alwaysFail).toHaveBeenCalled();
    expect(recovered).toEqual(Err(new Error('recovery failed')));
  });

  it('should change both success and error types', () => {
    const result = Err('404');
    const recovered = recover(result, (code) => Ok({status: 'fallback', code}));

    expect(recovered).toEqual(Ok({status: 'fallback', code: '404'}));
  });
});

// ============================
// filter 函数测试
// ============================
describe('filter Function Tests', () => {
  describe('Boolean predicate overload', () => {
    const isEven = vi.fn((n: number) => n % 2 === 0);
    const getError = vi.fn((n: number) => `Number ${n} is not even`);

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should return original Ok when predicate passes', () => {
      const result = Ok(42);
      const filtered = filter(result, isEven, getError);

      expect(isEven).toHaveBeenCalledWith(42);
      expect(getError).not.toHaveBeenCalled();
      expect(filtered).toEqual(Ok(42));
    });

    it('should return Err when predicate fails on Ok value', () => {
      const result = Ok(41);
      const filtered = filter(result, isEven, getError);

      expect(isEven).toHaveBeenCalledWith(41);
      expect(getError).toHaveBeenCalledWith(41);
      expect(filtered).toEqual(Err('Number 41 is not even'));
    });

    it('should preserve original Err without applying predicate', () => {
      const error = new Error('invalid');
      const result = Err(error);
      const filtered = filter(result, isEven, getError);

      expect(isEven).not.toHaveBeenCalled();
      expect(getError).not.toHaveBeenCalled();
      expect(filtered).toEqual(Err(error));
    });
  });

  describe('Type-guard predicate overload', () => {
    type Animal = {type: string; name: string};
    type Dog = Animal & {type: 'dog'; breed: string};

    const isDog = vi.fn(
      (animal: Animal): animal is Dog => animal.type === 'dog',
    );
    const getError = vi.fn(
      (animal: Animal) => new Error(`${animal.name} is not a dog`),
    );

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should narrow type when type guard passes', () => {
      const dog: Dog = {type: 'dog', name: 'Buddy', breed: 'Golden Retriever'};
      const result = Ok(dog);
      const filtered = filter(result, isDog, getError);

      expect(isDog).toHaveBeenCalledWith(dog);
      expect(getError).not.toHaveBeenCalled();

      // Type should be narrowed to Dog
      expect(filtered).toEqual(Ok(dog));
    });

    it('should return Err when type guard fails', () => {
      const cat: Animal = {type: 'cat', name: 'Whiskers'};
      const result = Ok(cat);
      const filtered = filter(result, isDog, getError);

      expect(isDog).toHaveBeenCalledWith(cat);
      expect(getError).toHaveBeenCalledWith(cat);
      expect(filtered).toEqual(Err(new Error('Whiskers is not a dog')));
    });

    it('should maintain type narrowing in subsequent operations', () => {
      const animals: Animal[] = [
        {type: 'dog', name: 'Rex', breed: 'German Shepherd'} as Dog,
        {type: 'cat', name: 'Mittens'},
      ];

      const processAnimal = (animal: Animal): Result<Dog, Error> =>
        filter(Ok(animal), isDog, getError) as Result<Dog, Error>;

      const dogResult = processAnimal(animals[0]);
      const catResult = processAnimal(animals[1]);

      expect(dogResult).toEqual(Ok(animals[0]));
      expect(catResult).toEqual(
        Err(new Error(`${animals[1].name} is not a dog`)),
      );
    });
  });

  describe('Edge cases', () => {
    it('should handle predicates that throw exceptions', () => {
      const throwingPredicate = vi.fn(() => {
        throw new Error('predicate error');
      });
      const getError = vi.fn(() => 'filter error');

      const result = Ok(42);

      expect(() => filter(result, throwingPredicate, getError)).toThrow(
        'predicate error',
      );
      expect(throwingPredicate).toHaveBeenCalled();
      expect(getError).not.toHaveBeenCalled();
    });

    it('should work with null and undefined values', () => {
      const isTruthy = vi.fn((v) => !!v);
      const getError = vi.fn(() => 'value is falsy');

      expect(filter(Ok(null), isTruthy, getError)).toEqual(
        Err('value is falsy'),
      );
      expect(filter(Ok(undefined), isTruthy, getError)).toEqual(
        Err('value is falsy'),
      );
      expect(filter(Ok(0), isTruthy, getError)).toEqual(Err('value is falsy'));
      expect(filter(Ok(''), isTruthy, getError)).toEqual(Err('value is falsy'));
      expect(filter(Ok('test'), isTruthy, getError)).toEqual(Ok('test'));
    });
  });
});
