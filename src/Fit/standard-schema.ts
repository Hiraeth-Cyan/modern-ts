// ========================================
// ./src/Fit/standard-schema.ts
// ========================================

import type {BaseFit, Fit, InferFit} from './base';
import type {ShapeErrors, ValidationError, StructureError} from './parser';
import {validate, validateAsync} from './parser';
import {isErr} from 'src/Result/base';

const FIT_VENDOR = 'fit-schema';

// ============================================
// Standard Typed V1
// ============================================

/** The Standard Typed properties interface. */
export interface StandardTypedV1Props<Input = unknown, Output = Input> {
  /** The version number of the standard. */
  readonly version: 1;
  /** The vendor name of the schema library. */
  readonly vendor: string;
  /** Inferred types associated with the schema. */
  readonly types?: StandardTypedV1Types<Input, Output>;
}

/** The Standard Typed types interface. */
export interface StandardTypedV1Types<Input = unknown, Output = Input> {
  /** The input type of the schema. */
  readonly input: Input;
  /** The output type of the schema. */
  readonly output: Output;
}

/** Infers the input type of a Standard Typed. */
export type StandardTypedV1InferInput<Schema extends StandardTypedV1> =
  NonNullable<Schema['~standard']['types']>['input'];

/** Infers the output type of a Standard Typed. */
export type StandardTypedV1InferOutput<Schema extends StandardTypedV1> =
  NonNullable<Schema['~standard']['types']>['output'];

/** The Standard Typed interface. This is a base type extended by other specs. */
export interface StandardTypedV1<Input = unknown, Output = Input> {
  /** The Standard properties. */
  readonly '~standard': StandardTypedV1Props<Input, Output>;
}

// ##########################
// ###   Standard Schema  ###
// ##########################

/** The result interface if validation succeeds. */
export interface StandardSchemaV1SuccessResult<Output> {
  /** The typed output value. */
  readonly value: Output;
  /** A falsy value for `issues` indicates success. */
  readonly issues?: undefined;
}

export interface StandardSchemaV1Options {
  /** Explicit support for additional vendor-specific parameters, if needed. */
  readonly libraryOptions?: Record<string, unknown>;
}

/** The result interface if validation fails. */
export interface StandardSchemaV1FailureResult {
  /** The issues of failed validation. */
  readonly issues: ReadonlyArray<StandardSchemaV1Issue>;
}

/** The issue interface of the failure output. */
export interface StandardSchemaV1Issue {
  /** The error message of the issue. */
  readonly message: string;
  /** The path of the issue, if any. */
  readonly path?: ReadonlyArray<PropertyKey | StandardSchemaV1PathSegment>;
}

/** The path segment interface of the issue. */
export interface StandardSchemaV1PathSegment {
  /** The key representing a path segment. */
  readonly key: PropertyKey;
}

/** The result interface of the validate function. */
export type StandardSchemaV1Result<Output> =
  | StandardSchemaV1SuccessResult<Output>
  | StandardSchemaV1FailureResult;

/** The Standard Schema properties interface. */
export interface StandardSchemaV1Props<
  Input = unknown,
  Output = Input,
> extends StandardTypedV1Props<Input, Output> {
  /** Validates unknown input values. */
  readonly validate: (
    value: unknown,
    options?: StandardSchemaV1Options,
  ) => StandardSchemaV1Result<Output> | Promise<StandardSchemaV1Result<Output>>;
}

/** The Standard types interface. */
export type StandardSchemaV1Types<
  Input = unknown,
  Output = Input,
> = StandardTypedV1Types<Input, Output>;

/** Infers the input type of a Standard. */
export type StandardSchemaV1InferInput<Schema extends StandardTypedV1> =
  StandardTypedV1InferInput<Schema>;

/** Infers the output type of a Standard. */
export type StandardSchemaV1InferOutput<Schema extends StandardTypedV1> =
  StandardTypedV1InferOutput<Schema>;

/** The Standard Schema interface. */
export interface StandardSchemaV1<Input = unknown, Output = Input> {
  /** The Standard Schema properties. */
  readonly '~standard': StandardSchemaV1Props<Input, Output>;
}

// ============================================
// Fit -> Standard Schema 转换器
// ============================================

type PathItem = PropertyKey | StandardSchemaV1PathSegment;

const ARRAY_INDEX_RE = /^\d+$/;

const convertPath = (path: string[]): PathItem[] => {
  const len = path.length;
  if (len === 0) return [];
  const result: PathItem[] = new Array<PathItem>(len);
  for (let i = 0; i < len; i++) {
    const segment = path[i];
    if (segment[0] === '[' && segment[segment.length - 1] === ']') {
      const inner = segment.slice(1, -1);
      if (ARRAY_INDEX_RE.test(inner)) {
        result[i] = {key: Number(inner)};
        continue;
      }
    }
    result[i] = segment;
  }
  return result;
};

const convertValidationErrors = (
  errors: ValidationError[],
): StandardSchemaV1Issue[] => {
  const issues: StandardSchemaV1Issue[] = [];
  for (const err of errors) {
    issues.push({
      message: err.message,
      path: convertPath(err.path),
    });
  }
  return issues;
};

const convertStructureErrors = (
  errors: StructureError[],
): StandardSchemaV1Issue[] => {
  const issues: StandardSchemaV1Issue[] = [];
  for (const err of errors) {
    issues.push({
      message: err.detail,
      path: convertPath(err.path),
    });
  }
  return issues;
};

const convertErrors = (errors: ShapeErrors): StandardSchemaV1Issue[] => [
  ...convertValidationErrors(errors.validation),
  ...convertStructureErrors(errors.structure),
];

type ValidateOptions = StandardSchemaV1Options;

/**
 * Converts a Fit schema to a Standard Schema compatible object.
 *
 * This function wraps a Fit instance so it can be used with any library
 * that supports the Standard Schema specification.
 *
 * @template T - The Fit instance type
 * @param fit - The Fit schema to convert
 * @returns A Standard Schema compatible object
 * @example
 * ```ts
 *
 * const schema = toStandardSchema(shape({
 *   name: String(),
 *   age: Number(),
 * }));
 *
 * // Use with any Standard Schema compatible library
 * const result = schema['~standard'].validate({name: 'Alice', age: 30});
 * if (result.issues) {
 *   console.log('Validation failed:', result.issues);
 * } else {
 *   console.log('Valid data:', result.value);
 * }
 * ```
 */
export const toStandardSchema = <
  T extends BaseFit,
  Output = T extends Fit<
    infer _T,
    infer _Bail,
    infer _Checked,
    infer _Optional,
    infer _IsReadonly,
    infer _IsShape,
    infer _IsArray
  >
    ? InferFit<T>
    : never,
>(
  fit: T,
): StandardSchemaV1<unknown, Output> => {
  const standardValidate = (
    value: unknown,
    _options?: ValidateOptions,
  ): StandardSchemaV1Result<Output> => {
    const result = validate(value, fit);
    if (isErr(result)) {
      return {issues: convertErrors(result.error)};
    }
    return {value: result.value as Output};
  };

  return {
    '~standard': {
      version: 1 as const,
      vendor: FIT_VENDOR,
      types: {
        input: undefined as unknown,
        output: undefined as Output,
      },
      validate: standardValidate,
    },
  };
};

/**
 * Converts a Fit schema to an async Standard Schema compatible object.
 *
 * This function wraps a Fit instance so it can be used with any library
 * that supports the Standard Schema specification. The validation is
 * performed asynchronously, supporting async predicates and transforms.
 *
 * @template T - The Fit instance type
 * @param fit - The Fit schema to convert
 * @returns A Standard Schema compatible object with async validation
 * @example
 * ```ts
 *
 * const schema = toStandardSchemaAsync(shape({
 *   name: String(),
 *   email: String().that(asyncEmailValidator),
 * }));
 *
 * // Use with any Standard Schema compatible library
 * const result = await schema['~standard'].validate({name: 'Alice', email: 'a@b.c'});
 * if (result.issues) {
 *   console.log('Validation failed:', result.issues);
 * } else {
 *   console.log('Valid data:', result.value);
 * }
 * ```
 */
export const toStandardSchemaAsync = <
  T extends BaseFit,
  Output = T extends Fit<
    infer _T,
    infer _Bail,
    infer _Checked,
    infer _Optional,
    infer _IsReadonly,
    infer _IsShape,
    infer _IsArray
  >
    ? InferFit<T>
    : never,
>(
  fit: T,
): StandardSchemaV1<unknown, Output> => {
  const standardValidate = async (
    value: unknown,
    _options?: ValidateOptions,
  ): Promise<StandardSchemaV1Result<Output>> => {
    const result = await validateAsync(value, fit);
    if (isErr(result)) {
      return {issues: convertErrors(result.error)};
    }
    return {value: result.value as Output};
  };

  return {
    '~standard': {
      version: 1 as const,
      vendor: FIT_VENDOR,
      types: {
        input: undefined as unknown,
        output: undefined as Output,
      },
      validate: standardValidate,
    },
  };
};
