// ========================================
// ./src/Fit/sugar.ts
// ========================================

/* v8 ignore file -- @preserve */
import type {Prettify} from 'src/Utils/type-tool';
import {
  Void,
  Fit,
  toOptional,
  type BaseFit,
  type DeriveShape,
  type _void_,
} from './base';
import {
  array,
  bigint,
  boolean,
  date,
  error,
  falsy,
  function as _function,
  iterable,
  map,
  null as _null,
  nullish,
  number,
  object,
  plainObject,
  primitive,
  regexp,
  set,
  string,
  symbol,
  truthy,
  undefined as _undefined,
  weakMap,
  weakSet,
  asyncIterable,
  oneOf,
} from './tool';

/**
 * Checks if a value is optional (null, undefined, or Void).
 * @param x - The value to check
 * @returns True if the value is null, undefined, or Void
 */
export const optionality = (x: unknown): x is null | undefined | _void_ =>
  x === null || x === undefined || x === Void;

// ============================================
// Basic Types
// ============================================

/**
 * Creates a Fit validator for string type.
 * @returns A Fit instance that validates strings
 */
export const String = () => new Fit().that(string);

/**
 * Creates a Fit validator for number type.
 * @returns A Fit instance that validates numbers
 */
export const Number = () => new Fit().that(number);

/**
 * Creates a Fit validator for boolean type.
 * @returns A Fit instance that validates booleans
 */
export const Boolean = () => new Fit().that(boolean);

/**
 * Creates a Fit validator for symbol type.
 * @returns A Fit instance that validates symbols
 */
export const Symbol = () => new Fit().that(symbol);

/**
 * Creates a Fit validator for bigint type.
 * @returns A Fit instance that validates bigints
 */
export const Bigint = () => new Fit().that(bigint);

/**
 * Creates a Fit validator for function type.
 * @returns A Fit instance that validates functions
 */
export const Function = () => new Fit().that(_function);

/**
 * Creates a Fit validator for object type (non-null objects).
 * @returns A Fit instance that validates objects
 */
export const Object = () => new Fit().that(object);

/**
 * Creates a Fit validator for array type.
 * @returns A Fit instance that validates arrays
 */
export const Array = () => new Fit().that(array);

/**
 * Creates a Fit validator for undefined type.
 * @returns A Fit instance that validates undefined values
 */
export const Undefined = () => new Fit().that(_undefined);

/**
 * Creates a Fit validator for null type.
 * @returns A Fit instance that validates null values
 */
export const Null = () => new Fit().that(_null);

/**
 * Creates a Fit validator for nullish values (null or undefined).
 * @returns A Fit instance that validates nullish values
 */
export const Nullish = () => new Fit().that(nullish);

/**
 * Creates a Fit validator for primitive types.
 * @returns A Fit instance that validates primitives (string, number, boolean, null, undefined, symbol, bigint)
 */
export const Primitive = () => new Fit().that(primitive);

/**
 * Creates a Fit validator for Date objects.
 * @returns A Fit instance that validates Date instances
 */
export const Date = () => new Fit().that(date);

/**
 * Creates a Fit validator for RegExp objects.
 * @returns A Fit instance that validates RegExp instances
 */
export const RegExp = () => new Fit().that(regexp);

/**
 * Creates a Fit validator for Error objects.
 * @returns A Fit instance that validates Error instances
 */
export const Error = () => new Fit().that(error);

/**
 * Creates a Fit validator for Map objects.
 * @returns A Fit instance that validates Map instances
 */
export const Map = () => new Fit().that(map);

/**
 * Creates a Fit validator for Set objects.
 * @returns A Fit instance that validates Set instances
 */
export const Set = () => new Fit().that(set);

/**
 * Creates a Fit validator for WeakMap objects.
 * @returns A Fit instance that validates WeakMap instances
 */
export const WeakMap = () => new Fit().that(weakMap);

/**
 * Creates a Fit validator for WeakSet objects.
 * @returns A Fit instance that validates WeakSet instances
 */
export const WeakSet = () => new Fit().that(weakSet);

/**
 * Creates a Fit validator for plain objects (non-null objects that are not arrays).
 * @returns A Fit instance that validates plain objects
 */
export const PlainObject = () => new Fit().that(plainObject);

/**
 * Creates a Fit validator for iterable objects.
 * @returns A Fit instance that validates objects implementing the Iterable protocol
 */
export const Iterable = () => new Fit().that(iterable);

/**
 * Creates a Fit validator for async iterable objects.
 * @returns A Fit instance that validates objects implementing the AsyncIterable protocol
 */
export const AsyncIterable = () => new Fit().that(asyncIterable);

/**
 * Creates a Fit validator that checks if a value is one of the specified values.
 * @template T - The type of allowed values
 * @param fits - The values to check against
 * @returns A Fit instance that validates if the value is in the list
 */
export const OneOf = <const T extends [unknown, ...unknown[]]>(...fits: T) =>
  new Fit<T[number]>().that<T[number]>(oneOf(...fits));

/**
 * Creates a Fit validator for truthy values.
 * @template T - The expected truthy type
 * @returns A Fit instance that validates truthy values (excludes null, undefined, false, 0, '', 0n)
 */
export const Truthy = <T>() =>
  new Fit<T | null | undefined | false | 0 | '' | 0n>().that(truthy);

/**
 * Creates a Fit validator for falsy values.
 * @returns A Fit instance that validates falsy values (null, undefined, false, 0, '', 0n)
 */
export const Falsy = () => new Fit().that(falsy);

// ============================================
// Optional Types
// ============================================

/**
 * Creates an optional Fit validator for string type.
 * @param defaultValue - The default value to use when the input is nullish (default: undefined)
 * @returns A Fit instance that validates strings or returns the default value for nullish inputs
 */
export const StringOpt = (defaultValue = undefined) => {
  const fit = new Fit<string | null | undefined | _void_>();
  return toOptional(fit).off(optionality, defaultValue).that(string);
};

/**
 * Creates an optional Fit validator that checks if a value is one of the specified values.
 * @template T - The type of allowed values
 * @param fits - The values to check against
 * @returns A Fit instance that validates if the value is in the list or returns undefined for nullish inputs
 */
export const OneOfOpt = <const T extends [unknown, ...unknown[]]>(
  ...fits: T
) => {
  const fit = new Fit<T | null | undefined | _void_>();
  return toOptional(fit)
    .off(optionality, undefined)
    .that(
      oneOf(...fits) as (
        x: unknown,
      ) => x is Exclude<T, null | undefined | _void_>,
    );
};

/**
 * Creates an optional Fit validator for number type.
 * @param defaultValue - The default value to use when the input is nullish (default: undefined)
 * @returns A Fit instance that validates numbers or returns the default value for nullish inputs
 */
export const NumberOpt = (defaultValue = undefined) => {
  const fit = new Fit<number | null | undefined | _void_>();
  return toOptional(fit).off(optionality, defaultValue).that(number);
};

/**
 * Creates an optional Fit validator for boolean type.
 * @param defaultValue - The default value to use when the input is nullish (default: undefined)
 * @returns A Fit instance that validates booleans or returns the default value for nullish inputs
 */
export const BooleanOpt = (defaultValue = undefined) => {
  const fit = new Fit<boolean | null | undefined | _void_>();
  return toOptional(fit).off(optionality, defaultValue).that(boolean);
};

/**
 * Creates an optional Fit validator for symbol type.
 * @param defaultValue - The default value to use when the input is nullish (default: undefined)
 * @returns A Fit instance that validates symbols or returns the default value for nullish inputs
 */
export const SymbolOpt = (defaultValue = undefined) => {
  const fit = new Fit<symbol | null | undefined | _void_>();
  return toOptional(fit).off(optionality, defaultValue).that(symbol);
};

/**
 * Creates an optional Fit validator for bigint type.
 * @param defaultValue - The default value to use when the input is nullish (default: undefined)
 * @returns A Fit instance that validates bigints or returns the default value for nullish inputs
 */
export const BigintOpt = (defaultValue = undefined) => {
  const fit = new Fit<bigint | null | undefined | _void_>();
  return toOptional(fit).off(optionality, defaultValue).that(bigint);
};

/**
 * Creates an optional Fit validator for function type.
 * @param defaultValue - The default value to use when the input is nullish (default: undefined)
 * @returns A Fit instance that validates functions or returns the default value for nullish inputs
 */
export const FunctionOpt = (defaultValue = undefined) => {
  const fit = new Fit<
    ((...args: unknown[]) => unknown) | null | undefined | _void_
  >();
  return toOptional(fit).off(optionality, defaultValue).that(_function);
};

/**
 * Creates an optional Fit validator for object type.
 * @param defaultValue - The default value to use when the input is nullish (default: undefined)
 * @returns A Fit instance that validates objects or returns the default value for nullish inputs
 */
export const ObjectOpt = (defaultValue = undefined) => {
  const fit = new Fit<Record<string, unknown> | null | undefined | _void_>();
  return toOptional(fit).off(optionality, defaultValue).that(object);
};

/**
 * Creates an optional Fit validator for array type.
 * @param defaultValue - The default value to use when the input is nullish (default: undefined)
 * @returns A Fit instance that validates arrays or returns the default value for nullish inputs
 */
export const ArrayOpt = (defaultValue = undefined) => {
  const fit = new Fit<unknown[] | null | undefined | _void_>();
  return toOptional(fit).off(optionality, defaultValue).that(array);
};

/**
 * Creates an optional Fit validator for Date objects.
 * @param defaultValue - The default value to use when the input is nullish (default: undefined)
 * @returns A Fit instance that validates Date instances or returns the default value for nullish inputs
 */
export const DateOpt = (defaultValue = undefined) => {
  const fit = new Fit<Date | null | undefined | _void_>();
  return toOptional(fit).off(optionality, defaultValue).that(date);
};

/**
 * Creates an optional Fit validator for RegExp objects.
 * @param defaultValue - The default value to use when the input is nullish (default: undefined)
 * @returns A Fit instance that validates RegExp instances or returns the default value for nullish inputs
 */
export const RegExpOpt = (defaultValue = undefined) => {
  const fit = new Fit<RegExp | null | undefined | _void_>();
  return toOptional(fit).off(optionality, defaultValue).that(regexp);
};

/**
 * Creates an optional Fit validator for Error objects.
 * @param defaultValue - The default value to use when the input is nullish (default: undefined)
 * @returns A Fit instance that validates Error instances or returns the default value for nullish inputs
 */
export const ErrorOpt = (defaultValue = undefined) => {
  const fit = new Fit<Error | null | undefined | _void_>();
  return toOptional(fit).off(optionality, defaultValue).that(error);
};

/**
 * Creates an optional Fit validator for Map objects.
 * @param defaultValue - The default value to use when the input is nullish (default: undefined)
 * @returns A Fit instance that validates Map instances or returns the default value for nullish inputs
 */
export const MapOpt = (defaultValue = undefined) => {
  const fit = new Fit<Map<unknown, unknown> | null | undefined | _void_>();
  return toOptional(fit).off(optionality, defaultValue).that(map);
};

/**
 * Creates an optional Fit validator for Set objects.
 * @param defaultValue - The default value to use when the input is nullish (default: undefined)
 * @returns A Fit instance that validates Set instances or returns the default value for nullish inputs
 */
export const SetOpt = (defaultValue = undefined) => {
  const fit = new Fit<Set<unknown> | null | undefined | _void_>();
  return toOptional(fit).off(optionality, defaultValue).that(set);
};

/**
 * Creates an optional Fit validator for WeakMap objects.
 * @param defaultValue - The default value to use when the input is nullish (default: undefined)
 * @returns A Fit instance that validates WeakMap instances or returns the default value for nullish inputs
 */
export const WeakMapOpt = (defaultValue = undefined) => {
  const fit = new Fit<WeakMap<object, unknown> | null | undefined | _void_>();
  return toOptional(fit).off(optionality, defaultValue).that(weakMap);
};

/**
 * Creates an optional Fit validator for WeakSet objects.
 * @param defaultValue - The default value to use when the input is nullish (default: undefined)
 * @returns A Fit instance that validates WeakSet instances or returns the default value for nullish inputs
 */
export const WeakSetOpt = (defaultValue = undefined) => {
  const fit = new Fit<WeakSet<object> | null | undefined | _void_>();
  return toOptional(fit).off(optionality, defaultValue).that(weakSet);
};

/**
 * Creates an optional Fit validator for plain objects.
 * @param defaultValue - The default value to use when the input is nullish (default: undefined)
 * @returns A Fit instance that validates plain objects or returns the default value for nullish inputs
 */
export const PlainObjectOpt = (defaultValue = undefined) => {
  const fit = new Fit<Record<string, unknown> | null | undefined | _void_>();
  return toOptional(fit).off(optionality, defaultValue).that(plainObject);
};

/**
 * Creates an optional Fit validator for iterable objects.
 * @param defaultValue - The default value to use when the input is nullish (default: undefined)
 * @returns A Fit instance that validates iterables or returns the default value for nullish inputs
 */
export const IterableOpt = (defaultValue = undefined) => {
  const fit = new Fit<Iterable<unknown> | null | undefined | _void_>();
  return toOptional(fit).off(optionality, defaultValue).that(iterable);
};

/**
 * Creates an optional Fit validator for async iterable objects.
 * @param defaultValue - The default value to use when the input is nullish (default: undefined)
 * @returns A Fit instance that validates async iterables or returns the default value for nullish inputs
 */
export const AsyncIterableOpt = (defaultValue = undefined) => {
  const fit = new Fit<AsyncIterable<unknown> | null | undefined | _void_>();
  return toOptional(fit).off(optionality, defaultValue).that(asyncIterable);
};

// ============================================
// Composite Optional Types
// ============================================

/**
 * Creates an optional Fit validator for object shapes.
 * @template F - The record of field Fit validators
 * @template D - The default value type
 * @param fields - A record mapping field names to their Fit validators
 * @param defaultValue - The default value to use when the input is nullish (default: undefined)
 * @returns A Fit instance that validates object shapes or returns the default value for nullish inputs
 */
export function ShapeOpt<
  F extends Record<string, BaseFit>,
  const D = undefined,
>(
  fields: F,
  defaultValue: D | undefined = undefined,
): Fit<
  Prettify<DeriveShape<F>>,
  D,
  null | undefined | _void_,
  true,
  false,
  true,
  false
> {
  const fit = new Fit();
  const result = fit.off(optionality, defaultValue).toShaped(fields);
  return toOptional(result) as Fit<
    Prettify<DeriveShape<F>>,
    D,
    null | undefined | _void_,
    true,
    false,
    true,
    false
  >;
}

/**
 * Creates an optional Fit validator for arrays with typed elements.
 * @template E - The element type
 * @template EBail - The bail type for the element Fit
 * @template EChecked - The checked type for the element Fit
 * @template EOptional - Whether the element Fit is optional
 * @template EReadonly - Whether the element Fit is readonly
 * @template EShape - Whether the element Fit has a shape
 * @template D - The default value type
 * @param elementFit - The Fit validator for array elements
 * @param defaultValue - The default value to use when the input is nullish (default: undefined)
 * @returns A Fit instance that validates arrays of the specified element type or returns the default value for nullish inputs
 */
export function ItemsOpt<
  E,
  EBail,
  EChecked,
  EOptional extends boolean,
  EReadonly extends boolean,
  EShape extends boolean,
  const D = undefined,
>(
  elementFit: Fit<E, EBail, EChecked, EOptional, EReadonly, EShape, boolean>,
  defaultValue: D | undefined = undefined,
): Fit<
  (EReadonly extends true ? Readonly<E | EBail> : E | EBail)[],
  D,
  null | undefined | _void_,
  true,
  false,
  false,
  true
> {
  const fit = new Fit();
  const result = fit.off(optionality, defaultValue).toArray(elementFit);
  return toOptional(result);
}
