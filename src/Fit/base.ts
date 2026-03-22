// ========================================
// ./src/Fit/base.ts
// ========================================

import {type MaybePromise, type Prettify} from 'src/Utils/type-tool';

// -- 联合类型检测工具 --
type IsUnion<T, U = T> = T extends unknown
  ? [U] extends [T]
    ? false
    : true
  : never;

/**
 * Symbol representing a void/missing value in validation.
 * Used as a placeholder for optional fields that are not present in the input.
 */
export const Void = Symbol('Void');
export type _void_ = typeof Void;

/**
 * Enumeration of operation types for the Fit validation pipeline.
 * @template that - Assertion/predicate check
 * @template off - Short-circuit with optional default value
 * @template transform - Value transformation
 * @template shape - Object shape validation
 * @template toArray - Array element validation
 */
export const enum type {
  that = 0,
  off = 1,
  transform = 2,
  shape = 3,
  toArray = 4,
}

/**
 * Function type for generating validation error messages.
 * @param val - The value being validated
 * @returns A string or promise resolving to a string message
 */
export type MessageGenerator = (val: unknown) => MaybePromise<string>;

/**
 * Union type representing all possible operations in the validation pipeline.
 * Each operation type has its own specific structure and purpose.
 */
export type OpItem =
  | {
      type: type.that;
      predicate: (val: unknown, signal?: AbortSignal) => MaybePromise<boolean>;
      message?: string | MessageGenerator | undefined;
    }
  | {
      type: type.off;
      predicate: (val: unknown, signal?: AbortSignal) => MaybePromise<boolean>;
      defaultValue?: unknown;
    }
  | {
      type: type.transform;
      fn: (val: unknown, signal?: AbortSignal) => MaybePromise<unknown>;
    }
  | {
      type: type.shape;
      fields: Record<string, BaseFit>;
    }
  | {
      type: type.toArray;
      elementFit: BaseFit;
    };

/**
 * Base interface for Fit instances, erasing type parameters for runtime use.
 * @template Ops - The array of operations to execute
 * @template isOptional - Whether this field is optional in a shape
 */
export interface BaseFit {
  readonly Ops: ReadonlyArray<OpItem>;
  readonly isOptional: boolean;
}

// ============================================
// Fit 类：类型安全的验证构建器
// ============================================

/**
 * A type-safe validation builder that uses a fluent API to construct validation pipelines.
 *
 * The Fit class uses several type parameters to track the validation state:
 * - T: The current type being validated
 * - Bail: The type returned when validation short-circuits via `off`
 * - Checked: Union of types already verified by type guards (prevents duplicate guards)
 * - Optional: Whether this field is optional in a shape schema
 * - IsReadonly: Whether the output should be wrapped in Readonly
 * - IsShape: Whether this schema includes a shape (prevents duplicate toShaped)
 * - IsArray: Whether this schema includes an array (prevents duplicate toArray)
 *
 * @template T - The output type after successful validation
 * @template Bail - The type returned when validation short-circuits
 * @template Checked - Union type of already-checked types
 * @template Optional - Whether the field is optional
 * @template IsReadonly - Whether the output should be readonly
 * @template IsShape - Whether this is a shape schema
 * @template IsArray - Whether this is an array schema
 */
export class Fit<
  T,
  Bail = never,
  Checked = never,
  Optional extends boolean = false,
  IsReadonly extends boolean = false,
  IsShape extends boolean = false,
  IsArray extends boolean = false,
> implements BaseFit {
  declare private readonly __t: T;
  declare private readonly __bail: Bail;
  declare private readonly __checked: Checked;
  declare private readonly __optional: Optional;
  declare private readonly __readonly: IsReadonly;
  declare private readonly __hasShape: IsShape;
  declare private readonly __isArray: IsArray;

  private ops: Array<OpItem> = new Array<OpItem>();
  private is_optional: boolean = false;

  get Ops(): ReadonlyArray<OpItem> {
    return this.ops;
  }

  get isOptional() {
    return this.is_optional;
  }

  // -- 内部方法：从现有操作数组创建实例 --
  private static _fromOps<
    T,
    Bail = never,
    Checked = never,
    Optional extends boolean = false,
    IsReadonly extends boolean = false,
    IsShape extends boolean = false,
    IsArray extends boolean = false,
  >(
    ops: Array<OpItem>,
  ): Fit<T, Bail, Checked, Optional, IsReadonly, IsShape, IsArray> {
    const instance = new Fit<
      T,
      Bail,
      Checked,
      Optional,
      IsReadonly,
      IsShape,
      IsArray
    >();
    instance.ops = ops;
    return instance;
  }

  // ============================================
  // that: 类型守卫/断言检查
  // ============================================

  /**
   * Adds a type guard assertion that narrows the type if successful.
   *
   * When using a type guard predicate (val is S), the type is narrowed to S.
   * Duplicate type guards for the same type are prevented at compile time.
   *
   * @template S - The narrowed type after successful guard
   * @param predicate - A type guard function that returns true if the value is of type S
   * @param message - Optional error message (string or generator function)
   * @returns A new Fit with narrowed type S, or never if the type is already checked.
   */
  that<const S extends T>(
    predicate: IsReadonly extends true ? never : (val: T) => val is S,
    message?: string | MessageGenerator,
  ): [S] extends [Checked]
    ? never
    : [unknown] extends [Checked]
      ? Fit<S, Bail, S, Optional, IsReadonly, IsShape, IsArray>
      : Fit<S, Bail, Checked | S, Optional, IsReadonly, IsShape, IsArray>;

  /**
   * Adds a boolean assertion that validates the value without narrowing.
   *
   * When using a boolean predicate, the type remains unchanged but validation
   * will fail if the predicate returns false.
   *
   * @template P - The predicate function type
   * @param predicate - A function that returns true if validation passes
   * @param message - Optional error message (string or generator function)
   * @returns The same Fit instance for chaining
   */
  that<P extends (val: T, signal?: AbortSignal) => MaybePromise<boolean>>(
    predicate: IsReadonly extends true
      ? never
      : // eslint-disable-next-line @typescript-eslint/no-explicit-any
        P & (P extends (val: T) => val is any ? never : P),
    message?: string | MessageGenerator,
  ): Fit<T, Bail, Checked, Optional, IsReadonly, IsShape, IsArray>;

  that(
    predicate: (val: T, signal?: AbortSignal) => MaybePromise<boolean>,
    message?: string | MessageGenerator,
  ): Fit<T, Bail, Checked, Optional, IsReadonly, IsShape, IsArray> {
    this.ops.push({
      type: type.that,
      predicate: predicate as (
        val: unknown,
        signal?: AbortSignal,
      ) => MaybePromise<boolean>,
      message: message,
    });
    return this as Fit<
      T,
      Bail,
      Checked,
      Optional,
      IsReadonly,
      IsShape,
      IsArray
    >;
  }

  // ============================================
  // off: 短路处理
  // ============================================

  /**
   * Adds a short-circuit condition that exits validation early.
   *
   * When the predicate matches, validation stops and either the default value
   * is returned, or the original value is passed through. This is useful for
   * handling edge cases like null/undefined with fallback values.
   *
   * @template S - The type to match for short-circuit (must be subset of T)
   * @template D - The default value type to return on match
   * @param predicate - A type guard that identifies values to short-circuit
   * @param defaultValue - Optional value to return instead of the matched value
   * @returns A new Fit with S excluded from T and D added to Bail
   */
  off<S extends T, const D = S>(
    predicate: IsReadonly extends true ? never : (val: T) => val is S,
    defaultValue?: D,
  ): [S] extends [Checked]
    ? never
    : [unknown] extends [Checked]
      ? Fit<Exclude<T, S>, Bail | D, S, Optional, IsReadonly, IsShape, IsArray>
      : Fit<
          Exclude<T, S>,
          Bail | D,
          Checked | S,
          Optional,
          IsReadonly,
          IsShape,
          IsArray
        >;

  /**
   * Adds a short-circuit condition using a boolean predicate.
   *
   * When the predicate returns true, validation stops and either the default
   * value is returned, or the original value is passed through.
   *
   * @template P - The predicate function type
   * @template D - The default value type
   * @param predicate - A function that returns true to trigger short-circuit
   * @param defaultValue - Optional value to return on match
   * @returns A new Fit with D added to Bail
   */
  off<
    P extends (val: T, signal?: AbortSignal) => MaybePromise<boolean>,
    const D = T,
  >(
    predicate: IsReadonly extends true
      ? never
      : // eslint-disable-next-line @typescript-eslint/no-explicit-any
        P & (P extends (val: T) => val is any ? never : P),
    defaultValue?: D,
  ): Fit<T, Bail | D, Checked, Optional, IsReadonly, IsShape, IsArray>;

  off(
    predicate: (val: T, signal?: AbortSignal) => MaybePromise<boolean>,
    defaultValue?: unknown,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): any {
    const op: OpItem = {
      type: type.off,
      predicate: predicate as (
        val: unknown,
        signal?: AbortSignal,
      ) => MaybePromise<boolean>,
    };
    if (arguments.length > 1) op.defaultValue = defaultValue;
    this.ops.push(op);
    return this as Fit<
      T,
      Bail,
      Checked,
      Optional,
      IsReadonly,
      IsShape,
      IsArray
    >;
  }

  // ============================================
  // transform: 值变换
  // ============================================

  /**
   * Adds a transformation that converts the value to a new type.
   *
   * The transform function receives the current value and can return a new value
   * of any type. Async transforms are supported via MaybePromise.
   *
   * @template U - The output type of the transformation
   * @param fn - A function that transforms the value
   * @returns A new Fit with type U (Awaited for async transforms)
   */
  transform<U>(
    fn: IsReadonly extends true
      ? never
      : (val: T, signal?: AbortSignal) => MaybePromise<U>,
  ): Fit<Awaited<U>, Bail, never, Optional, IsReadonly, IsShape, IsArray> {
    this.ops.push({
      type: type.transform,
      fn: fn as (val: unknown, signal?: AbortSignal) => MaybePromise<unknown>,
    });
    return this as unknown as Fit<
      Awaited<U>,
      Bail,
      never,
      Optional,
      IsReadonly,
      IsShape,
      IsArray
    >;
  }

  // ============================================
  // toShaped: 对象形状校验
  // ============================================

  /**
   * Adds object shape validation with typed field schemas.
   *
   * Each field in the shape is validated by its own Fit schema. The resulting
   * type is derived from the field schemas, with optional fields marked with `?`
   * and readonly fields marked with `readonly`.
   *
   * Cannot be called on a readonly Fit or after another toShaped call.
   *
   * @template F - Record of field name to Fit schema
   * @param fields - An object mapping field names to their Fit schemas
   * @returns A new Fit with the derived shape type
   */
  toShaped<F extends Record<string, BaseFit>>(
    this: IsShape extends true
      ? never
      : IsReadonly extends true
        ? never
        : unknown extends T
          ? Fit<T, Bail, Checked, Optional, IsReadonly, false, IsArray>
          : T extends object
            ? IsUnion<T> extends false
              ? Fit<T, Bail, Checked, Optional, IsReadonly, false, IsArray>
              : never
            : never,
    fields: F & ShapeFieldsMatch<T, F>,
  ): Fit<
    Prettify<DeriveShape<F>>,
    Bail,
    Checked,
    Optional,
    IsReadonly,
    true,
    IsArray
  > {
    this.ops.push({
      type: type.shape,
      fields,
    });

    return this as unknown as Fit<
      Prettify<DeriveShape<F>>,
      Bail,
      Checked,
      Optional,
      IsReadonly,
      true,
      IsArray
    >;
  }

  // ============================================
  // toArray: 数组元素校验
  // ============================================

  /**
   * Adds array validation where each element is validated by the given schema.
   *
   * Cannot be called on a readonly Fit or after another toArray call.
   *
   * @template E - The element type after validation
   * @template EBail - The element's Bail type
   * @template EChecked - The element's Checked type
   * @template EOptional - Whether elements are optional
   * @template EReadonly - Whether elements are readonly
   * @template EShape - Whether elements have shape validation
   * @param elementFit - The Fit schema to validate each array element
   * @returns A new Fit with array type
   */
  toArray<
    E,
    EBail,
    EChecked,
    EOptional extends boolean,
    EReadonly extends boolean,
    EShape extends boolean,
  >(
    this: IsArray extends true
      ? never
      : IsReadonly extends true
        ? never
        : unknown extends T
          ? Fit<T, Bail, Checked, Optional, IsReadonly, IsShape, false>
          : T extends unknown[]
            ? IsUnion<T> extends false
              ? Fit<T, Bail, Checked, Optional, IsReadonly, IsShape, false>
              : never
            : never,
    elementFit: Fit<E, EBail, EChecked, EOptional, EReadonly, EShape, boolean> &
      ArrayElementMatch<
        T,
        Fit<E, EBail, EChecked, EOptional, EReadonly, EShape, boolean>
      >,
  ): Fit<
    (EReadonly extends true ? Readonly<E | EBail> : E | EBail)[],
    Bail,
    Checked,
    Optional,
    IsReadonly,
    IsShape,
    true
  > {
    this.ops.push({
      type: type.toArray,
      elementFit,
    });
    return this as unknown as Fit<
      (EReadonly extends true ? Readonly<E | EBail> : E | EBail)[],
      Bail,
      Checked,
      Optional,
      IsReadonly,
      IsShape,
      true
    >;
  }

  /**
   * Creates a copy of this Fit instance with its own operation array.
   *
   * Useful when you want to branch a validation pipeline without affecting
   * the original.
   *
   * @returns A new Fit instance with copied operations
   */
  fork(): Fit<T, Bail, Checked, Optional, IsReadonly, IsShape, IsArray> {
    const instance = Fit._fromOps<
      T,
      Bail,
      Checked,
      Optional,
      IsReadonly,
      IsShape,
      IsArray
    >([...this.ops]);
    instance.is_optional = this.is_optional;
    return instance;
  }
}

// ============================================
// 类型推导工具
// ============================================

/**
 * Extracts the output type (T | Bail) from a Fit instance.
 * @template F - The Fit instance type
 */
export type InferFit<F> =
  F extends Fit<
    infer T,
    infer Bail,
    infer _Checked,
    boolean,
    infer R extends boolean,
    boolean,
    boolean
  >
    ? R extends true
      ? Readonly<T | Bail>
      : T | Bail
    : never;

/**
 * Extracts the Optional flag from a Fit instance.
 * @template F - The Fit instance type
 */
type IsOptional<F extends BaseFit> =
  F extends Fit<
    infer _T,
    infer _Bail,
    infer _Checked,
    infer O extends boolean,
    infer _IsReadonly extends boolean,
    infer _HasShape extends boolean,
    infer _IsArray extends boolean
  >
    ? O
    : never;

/**
 * Extracts the IsReadonly flag from a Fit instance.
 * @template F - The Fit instance type
 */
type IsReadonly<F extends BaseFit> =
  F extends Fit<
    infer _T,
    infer _Bail,
    infer _Checked,
    infer _Optional extends boolean,
    infer R extends boolean,
    infer _HasShape extends boolean,
    infer _IsArray extends boolean
  >
    ? R
    : never;

/**
 * Derives the object type from a record of Fit field schemas.
 *
 * Handles four combinations of optional/readonly:
 * - Required, mutable: normal property
 * - Required, readonly: readonly property
 * - Optional, mutable: optional property
 * - Optional, readonly: readonly optional property
 *
 * @template F - Record of field name to Fit schema
 */
export type DeriveShape<F extends Record<string, unknown>> = {
  [K in keyof F as F[K] extends BaseFit
    ? IsOptional<F[K]> extends false
      ? IsReadonly<F[K]> extends false
        ? K
        : never
      : never
    : never]: InferFit<F[K]>;
} & {
  readonly [K in keyof F as F[K] extends BaseFit
    ? IsOptional<F[K]> extends false
      ? IsReadonly<F[K]> extends true
        ? K
        : never
      : never
    : never]: InferFit<F[K]>;
} & {
  [K in keyof F as F[K] extends BaseFit
    ? IsOptional<F[K]> extends true
      ? IsReadonly<F[K]> extends false
        ? K
        : never
      : never
    : never]?: InferFit<F[K]>;
} & {
  readonly [K in keyof F as F[K] extends BaseFit
    ? IsOptional<F[K]> extends true
      ? IsReadonly<F[K]> extends true
        ? K
        : never
      : never
    : never]?: InferFit<F[K]>;
};

/**
 * Validates that shape field schemas are compatible with the target type T.
 * Returns F if all fields match, or a constraint error type if not.
 *
 * @template T - The target object type
 * @template F - Record of field name to Fit schema
 */
type ShapeFieldsMatch<T, F extends Record<string, BaseFit>> = unknown extends T
  ? F
  : T extends object
    ? keyof F extends keyof T
      ? {
          [K in keyof F]: InferFit<F[K]> extends T[K]
            ? F[K]
            : TypeMismatchError<F[K], T[K]>;
        }
      : {[K in Exclude<keyof F, keyof T>]: ExtraFieldError<K, T>}
    : F;

type TypeMismatchError<Actual, Expected> = {
  __type_mismatch__: {actual: Actual; expected: Expected};
};

type ExtraFieldError<K extends PropertyKey, T> = {
  __extra_field__: {field: K; targetKeys: keyof T};
};

type ArrayElementMatch<T, F extends BaseFit> = unknown extends T
  ? F
  : T extends unknown[]
    ? InferFit<F> extends T[number]
      ? F
      : TypeMismatchError<InferFit<F>, T[number]>
    : F;

// ============================================
// 工具函数
// ============================================

/**
 * Marks a Fit schema as readonly, wrapping the output type in Readonly<T>.
 *
 * Once marked as readonly, the schema cannot be modified further
 * (that, off, transform, toShaped, toArray will return never).
 *
 * @template T - The output type
 * @template Bail - The short-circuit return type
 * @template Checked - The checked types union
 * @template Optional - Whether the field is optional
 * @template IsShape - Whether this is a shape schema
 * @template IsArray - Whether this is an array schema
 * @param fit - The Fit instance to mark as readonly
 * @returns The same Fit instance with IsReadonly set to true
 */
export const toReadonly = <
  T,
  Bail,
  Checked,
  Optional extends boolean,
  IsShape extends boolean,
  IsArray extends boolean,
>(
  fit: Fit<T, Bail, Checked, Optional, false, IsShape, IsArray>,
) => {
  return fit as unknown as Fit<
    T,
    Bail,
    Checked,
    Optional,
    true,
    IsShape,
    IsArray
  >;
};

/**
 * Marks a Fit schema as optional for use in shape fields.
 *
 * This serves two purposes:
 * 1. Adds the `?` modifier to the field type in the derived shape
 * 2. Signals the validator to pass {@link Void} for missing fields instead of erroring
 *
 * Note: The field's predicate must handle Void, otherwise runtime errors will occur.
 *
 * @template T - The output type
 * @template Bail - The short-circuit return type
 * @template Checked - The checked types union
 * @template _Optional - Previous optional state (unused)
 * @template IsReadonly - Whether the field is readonly
 * @template IsShape - Whether this is a shape schema
 * @template IsArray - Whether this is an array schema
 * @param fit - The Fit instance to mark as optional
 * @returns The same Fit instance with Optional set to true
 */
export const toOptional = <
  T,
  Bail,
  Checked,
  _Optional extends boolean,
  IsReadonly extends boolean,
  IsShape extends boolean,
  IsArray extends boolean,
>(
  fit: Fit<T, Bail, Checked, false, IsReadonly, IsShape, IsArray>,
) => {
  fit['is_optional'] = true;
  return fit as unknown as Fit<
    T,
    Bail,
    Checked,
    true,
    IsReadonly,
    IsShape,
    IsArray
  >;
};

// ============================================
// 快捷创建函数
// ============================================

/**
 * Creates a new Fit instance starting from type T.
 *
 * @template T - The initial type to validate
 * @returns A new Fit<T> instance
 */
export const fit = <T>() => new Fit<T>();

/**
 * Creates a Fit schema for object shape validation.
 *
 * Shortcut for `fit().toShaped(fields)`.
 *
 * @template T - Record of field name to Fit schema
 * @param fields - An object mapping field names to their Fit schemas
 * @returns A Fit instance with the derived shape type
 */
export const shape = <T extends Record<string, BaseFit>>(fields: T) =>
  new Fit().toShaped(fields);

/**
 * Creates a Fit schema for array validation.
 *
 * Shortcut for `fit().toArray(elementFit)`.
 *
 * @template E - The element type
 * @template EBail - The element's Bail type
 * @template EChecked - The element's Checked type
 * @template EOptional - Whether elements are optional
 * @template EReadonly - Whether elements are readonly
 * @template EShape - Whether elements have shape validation
 * @param elementFit - The Fit schema to validate each array element
 * @returns A Fit instance with array type
 */
export const items = <
  E,
  EBail,
  EChecked,
  EOptional extends boolean,
  EReadonly extends boolean,
  EShape extends boolean,
>(
  elementFit: Fit<E, EBail, EChecked, EOptional, EReadonly, EShape, boolean>,
) => new Fit().toArray(elementFit);
