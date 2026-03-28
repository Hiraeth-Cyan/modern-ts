/* eslint-disable @typescript-eslint/no-explicit-any */
/* v8 ignore file -- @preserve */

/**
 * Represents any function type that can accept any arguments and return any value.
 * An alternative to the built-in overly broad `Function` interface.
 */
export type AnyFunction = (this: any, ...args: any[]) => any;

/**
 * Represents a value that can be either a plain value or a Promise-like object.
 * @template T - The type of the value or Promise-like object.
 */
export type MaybePromise<T> = T | PromiseLike<T>;

/**
 * Creates a deeply partial type where all properties become optional recursively.
 * @template T - The source type
 * @remarks Functions are left untouched (preserved as-is).
 */
export type PartialDeep<T> = T extends (...args: any[]) => any
  ? T
  : T extends object
    ? {[K in keyof T]?: PartialDeep<T[K]>}
    : T;

/**
 * Creates a deeply required type where all properties become non-optional recursively.
 * @template T - The source type
 * @remarks Functions are left untouched (preserved as-is).
 */
export type RequiredDeep<T> = T extends (...args: any[]) => any
  ? T
  : T extends object
    ? {[K in keyof T]-?: RequiredDeep<T[K]>}
    : T;

/**
 * Creates a deeply readonly type where all properties become immutable recursively.
 * @template T - The source type
 * @remarks Functions are left untouched (preserved as-is).
 */
export type ReadonlyDeep<T> = T extends (...args: any[]) => any
  ? T
  : T extends object
    ? {readonly [K in keyof T]: ReadonlyDeep<T[K]>}
    : T;

/**
 * Removes readonly modifiers from all properties at the first level only.
 * @template T - The source type
 */
export type Mutable<T> = {-readonly [P in keyof T]: T[P]};

/**
 * Removes readonly modifiers from all properties recursively.
 * @template T - The source type
 * @remarks This affects nested objects as well.
 */
export type MutableDeep<T> = {
  -readonly [K in keyof T]: T[K] extends object ? MutableDeep<T[K]> : T[K];
};

/**
 * Makes specific properties required while keeping others unchanged.
 * @template T - The source type
 * @template K - Keys of properties to make required
 */
export type SetRequired<T, K extends keyof T> = {
  [P in keyof T as P extends K ? never : P]: T[P];
} & {
  [P in K]-?: T[P];
} extends infer O
  ? {[P in keyof O]: O[P]}
  : never;

/**
 * Makes specific properties optional while keeping others unchanged.
 * @template T - The source type
 * @template K - Keys of properties to make optional
 */
export type SetOptional<T, K extends keyof T> = {
  [P in keyof T as P extends K ? never : P]: T[P];
} & {
  [P in K]?: T[P];
} extends infer O
  ? {[P in keyof O]: O[P]}
  : never;

/**
 * Creates a union type that includes literal values plus a base type.
 * @template Literal - The literal type(s) to include
 * @template Base - The base string or number type
 * @remarks Useful for allowing string literals while also accepting any string.
 */
export type LiteralUnion<Literal, Base extends string | number> =
  | Literal
  | (Base & Record<never, never>);

/**
 * Flattens type intersections for better IntelliSense display.
 * @template T - The type to prettify
 * @remarks This doesn't change the type, only its display in IDEs.
 */
export type Prettify<T> = {[K in keyof T]: T[K]} & {};

/**
 * Recursively expands all properties of an object type.
 * @template T - The source type
 * @remarks Functions are left untouched (preserved as-is).
 */
export type ExpandDeep<T> = T extends object
  ? T extends (...args: any[]) => any
    ? T
    : {[K in keyof T]: ExpandDeep<T[K]>}
  : T;

/**
 * Extracts the resolved return type of an async function.
 * @template T - The async function type
 * @remarks Unwraps Promise to get the actual return type.
 */
export type AsyncReturnType<T extends (...args: any) => any> = Awaited<
  ReturnType<T>
>;

/**
 * Checks if a tuple type is a rest tuple.
 * @template A - The tuple type to check
 * @returns `true` if A is a rest tuple, otherwise `false`
 */
export type IsRestTuple<A extends readonly unknown[]> =
  number extends A['length'] ? true : false;

/**
 * Checks if a type is the `any` type.
 * @template T - The type to check
 * @returns `true` if T is `any`, otherwise `false`
 */
export type IsAny<T> = 0 extends 1 & T ? true : false;

/**
 * Checks if a type is exactly `undefined`.
 * @template T - The type to check
 * @returns `true` if T is `undefined`, otherwise `false`
 * @remarks Note: This distinguishes `undefined` from optional properties.
 */
export type IsUndefined<T> = [T] extends [undefined] ? true : false;

/**
 * Checks if a type is the `never` type.
 * @template T - The type to check
 * @returns `true` if T is `never`, otherwise `false`
 */
export type IsNever<T> = [T] extends [never] ? true : false;

/**
 * Checks if a type is a literal number type.
 * @template T - The type to check
 * @returns `true` if T is a literal number (e.g., 5, 3.14, -7), otherwise `false`
 * @remarks Returns `false` for the broad `number` type.
 */
export type IsLiteralNumber<T> = number extends T
  ? false
  : T extends number
    ? true
    : false;

/**
 * Checks if a type is an integer literal.
 * @template T - The type to check
 * @returns `true` if T is an integer literal (e.g., 5, -7, 0), otherwise `false`
 * @remarks Returns `false` for floating-point literals (e.g., 3.14) and the broad `number` type.
 */
export type IsIntegerLiteral<T> =
  IsLiteralNumber<T> extends true
    ? `${Extract<T, number>}` extends `${infer _}.${infer _}`
      ? false
      : true
    : false;

/**
 * Checks if a type is a non-negative integer literal.
 * @template T - The type to check
 * @returns `true` if T is a non-negative integer literal (e.g., 0, 1, 5, 100), otherwise `false`
 * @remarks Returns `false` for negative integers (e.g., -7), floating-point literals, and the broad `number` type.
 */
export type IsNonNegativeIntegerLiteral<T> =
  IsIntegerLiteral<T> extends true
    ? `${Extract<T, number>}` extends `-${infer _}`
      ? false
      : true
    : false;

/**
 * Constructs a tuple of a given length.
 * @template L - The target length (must be a non-negative integer literal)
 * @template Acc - Accumulator for recursion (internal use)
 * @returns A tuple type with exactly `L` elements
 */
export type BuildTuple<
  L extends number,
  Acc extends unknown[] = [],
> = Acc['length'] extends L ? Acc : BuildTuple<L, [...Acc, unknown]>;

/**
 * Subtracts two non-negative integer literals at the type level.
 * @template A - The minuend (must be a non-negative integer literal)
 * @template B - The subtrahend (must be a non-negative integer literal)
 * @returns `A - B` as a literal number, or `never` if `B > A`
 */
export type Subtract<A extends number, B extends number> =
  BuildTuple<A> extends [...BuildTuple<B>, ...infer Rest]
    ? Rest['length']
    : never;

/**
 * Checks if a type is a positive integer literal.
 * @template T - The type to check
 * @returns `true` if T is a positive integer literal (e.g., 1, 5, 100), otherwise `false`
 * @remarks Returns `false` for zero, negative integers (e.g., -7), floating-point literals, and the broad `number` type.
 */
export type IsPositiveIntegerLiteral<T> =
  IsNonNegativeIntegerLiteral<T> extends true
    ? T extends 0
      ? false
      : true
    : false;

/**
 * Checks if a type is the `unknown` type.
 * @template T - The type to check
 * @returns `true` if T is `unknown`, otherwise `false`
 * @remarks Note: Returns `false` for `any` type.
 */
export type IsUnknown<T> = unknown extends T
  ? IsAny<T> extends true
    ? false
    : true
  : false;

/**
 * Transforms a union type into an intersection type.
 * @template U - The union type to transform
 * @example UnionToIntersection<{a:1}|{b:2}> becomes {a:1}&{b:2}
 */
export type UnionToIntersection<U> = (
  U extends any ? (k: U) => void : never
) extends (k: infer I) => void
  ? I
  : never;

/**
 * Represents valid JSON value types.
 * @remarks This is a recursive definition allowing nested structures.
 */
export type JSONValue =
  | string
  | number
  | boolean
  | null
  | {[key: string]: JSONValue}
  | JSONValue[];

/**
 * Asserts that one type is assignable to another.
 * @template T - The source type
 * @template U - The target type
 * @param _ - The value to use for type inference
 * @returns A function that expects a value assignable to T
 */
export const expectAssignable = <T>(_: T): void => {};

/**
 * Asserts that one type is strictly assignable to another (excludes `any`).
 *
 * @template T - The target type to check assignability against
 * @returns A curried function that expects a value of type U
 *
 * @remarks
 * This function uses currying to separate type parameter specification from value inference:
 * - First call: Specify the target type `T` explicitly
 * - Second call: Pass the actual value, from which `U` is inferred
 *
 * The curried form is necessary because:
 * 1. It ensures `T` is explicitly provided rather than inferred from the value
 * 2. It allows `U` to be inferred independently from the passed value
 * 3. It prevents TypeScript from incorrectly unifying `T` and `U` during inference
 *
 * The `any` type is explicitly rejected via `0 extends 1 & T` check.
 *
 * @example
 * ```ts
 * type Target = { x: number };
 * type GoodSource = { x: number; y: string }; // Extra properties are OK
 * type BadSource = { x: string }; // Wrong type for x
 *
 * expectAssignableStrict<Target>()({} as GoodSource); // OK
 * expectAssignableStrict<Target>()({} as BadSource); // Error
 * expectAssignableStrict<any>()({} as GoodSource); // Error: any is rejected
 * ```
 */
export function expectAssignableStrict<const T>(): <const U>(
  this: [T] extends [never] ? never : [U] extends [never] ? never : void,
  _: 0 extends 1 & T ? never : U extends T ? U : never,
) => void {
  return function <U>(
    _: 0 extends 1 & T ? never : U extends T ? U : never,
  ): void {};
}

/**
 * Asserts that one type is identical to another.
 * @template T - The source type
 * @template U - The target type
 * @param _value - The value to use for type inference
 * @returns A function that expects a value identical to T
 */
export type Equals<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2
    ? true
    : false;

// 用于生成更友好的类型错误信息
type Fail<T> = {
  readonly __brand: unique symbol;
  readonly _expected: T;
};

/**
 * Asserts that one type is identical to another.
 * @template T - The source type
 * @template U - The target type
 * @returns A function that expects a value identical to T
 *
 * @example
 * ```ts
 * type A = { x: number };
 * type B = { x: number };
 * type C = { x: string };
 *
 * expectIdentical<A>()({} as B); // OK: A and B are identical
 * expectIdentical<A>()({} as C); // Error: C is not assignable to never
 * ```
 */
export function expectIdentical<const T>(): <const U>(
  this: [U] extends [never] ? ([T] extends [never] ? void : Fail<T>) : void,
  _value: Equals<T, U> extends true ? U : Fail<T>,
) => void {
  return function <U>(_value: Equals<T, U> extends true ? U : Fail<T>): void {};
}

/**
 * Gets the arity (number of parameters) of a function, including optional parameters.
 * @template F - The function type to get arity from
 * @returns The total number of parameters (required + optional)
 */
export type FunctionArity<F extends AnyFunction> = F extends (
  ...args: infer A
) => unknown
  ? Required<A>['length']
  : never;
