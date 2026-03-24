/* eslint-disable @typescript-eslint/no-explicit-any */
/* v8 ignore file -- @preserve */

export type AnyFunction = (...args: any[]) => any;

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
 * Extracts the resolved return type of an async function.
 * @template T - The async function type
 * @remarks Unwraps Promise to get the actual return type.
 */
export type AsyncReturnType<T extends (...args: any) => any> = Awaited<
  ReturnType<T>
>;

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
 * Casts an unknown value to Error type.
 * @param e - The value to cast
 * @returns The casted Error value
 */
export const castErr = (e: unknown) => e as Error;

/**
 * Asserts that one type is assignable to another.
 * @template T - The source type
 * @template U - The target type
 * @param _ - The value to use for type inference
 * @returns A function that expects a value assignable to T
 */
export const expectAssignable = <T>(_: T): void => {};

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
export const expectIdentical =
  <T>() =>
  <U extends T>(_value: Equals<T, U> extends true ? U : never): void => {};
