// ========================================
// ./src/Fit/parser.ts
// ========================================
import type {Result} from 'src/Result/types';
import {Void, Fit, type, type OpItem, type BaseFit} from './base';
import {Err, Ok} from 'src/Result/base';
import {ParameterError} from 'src/Errors';
import {dynamicAwait} from 'src/helper';

const DEFAULT_MSG = 'Validation failed';

type ToReadonly<T, IsReadonly> = IsReadonly extends true ? Readonly<T> : T;

/**
 * Context information for validation error messages.
 * @template key - The field name where the error occurred
 * @template index - The array index where the error occurred
 * @template expected - The expected type or value
 * @template received - The actual type or value received
 * @template depth - The current recursion depth
 * @template extra - Additional context-specific information
 */
export type ErrorContext = {
  key?: string;
  index?: number;
  expected?: string;
  received?: string;
  depth?: number;
  extra?: Record<string, unknown>;
};

/**
 * Function type for formatting validation error messages.
 * @param kind - The type of validation or structure error
 * @param ctx - The error context containing relevant details
 * @returns A formatted error message string
 */
export type MessageFormatter = (
  kind: ValidationError['kind'] | StructureError['kind'],
  ctx: ErrorContext,
) => string;

// -- 默认消息格式化器 --
const defaultFormatter: MessageFormatter = (kind, ctx) => {
  switch (kind) {
    case 'assertion':
      return ctx.extra?.message as string;
    case 'missing_field':
      return `Missing required field: ${ctx.key}`;
    case 'not_object':
      return `Expected an object, but got ${ctx.received}`;
    case 'not_array':
      return `Expected an array, but got ${ctx.received}`;
    case 'unknown_field':
      return `Unknown field(s): ${ctx.extra?.keys as string}`;
    case 'max_deep':
      return `Maximum recursion depth ${ctx.depth} exceeded`;
    case 'too_many_unknown':
      return `Too many unknown fields (limit: ${ctx.extra?.limit as number})`;
  }
};

// ========================================
// 类型定义
// ========================================

/**
 * Options for shape validation.
 * @template strict - Whether to reject unknown fields (default: true)
 * @template abortEarly - Whether to stop validation on first error (default: true)
 * @template maxDeep - Maximum recursion depth for nested structures (default: 10)
 * @template maxUnknownKeys - Maximum allowed unknown fields before error (default: 30)
 * @template formatMessage - Custom message formatter for errors
 */
type ShapeOptions = {
  strict?: boolean;
  abortEarly?: boolean;
  maxDeep?: number;
  maxUnknownKeys?: number;
  formatMessage?: MessageFormatter;
};

/**
 * Represents a validation error for individual field/value checks.
 * @template path - The path to the error location in the data structure
 * @template kind - The type of validation error
 * @template message - The human-readable error message
 * @template index - Optional array index for element errors
 */
export type ValidationError = {
  path: string[];
  kind: 'assertion' | 'missing_field' | 'not_object' | 'not_array';
  message: string;
  index?: number;
};

/**
 * Represents a structural error in the data shape.
 * @template path - The path to the error location in the data structure
 * @template kind - The type of structure error
 * @template detail - The detailed error description
 */
export type StructureError = {
  path: string[];
  kind: 'unknown_field' | 'max_deep' | 'too_many_unknown';
  detail: string;
};

/**
 * Collection of validation and structure errors.
 */
export type ShapeErrors = {
  validation: ValidationError[];
  structure: StructureError[];
};

// -- 工具函数：获取值的类型名 --
const getType = (v: unknown) => (v === null ? 'null' : typeof v);

// -- 添加校验错误 --
const addValidationError = (
  errors: ShapeErrors,
  path_stack: string[],
  kind: ValidationError['kind'],
  message: string,
): number => {
  errors.validation.push({path: path_stack.slice(), kind, message});
  return errors.validation.length;
};

// -- 添加结构错误 --
const addStructureError = (
  errors: ShapeErrors,
  path_stack: string[],
  kind: StructureError['kind'],
  detail: string,
): number => {
  errors.structure.push({path: path_stack.slice(), kind, detail});
  return errors.structure.length;
};

// ========================================
// 核心校验逻辑
// ========================================

/**
 * Validates input data against a Fit schema synchronously.
 *
 * @template T - The output type after successful validation
 * @template Bail - The type returned when validation short-circuits
 * @template Checked - Union type of already-checked types (prevents duplicate guards)
 * @template IsOptional - Whether the field is optional
 * @template IsReadonly - Whether the output should be readonly
 * @template IsShape - Whether this is a shape schema (prevents duplicate toShaped)
 * @template IsArray - Whether this is an array schema (prevents duplicate toArray)
 * @param input - The raw input data to validate
 * @param fit - The Fit schema to validate against
 * @param options - Optional validation configuration
 * @returns A Result containing either the validated data or error details
 * @throws {ParameterError} If the Fit schema has no operations defined
 */
export const validate = <
  T,
  Bail,
  Checked,
  IsOptional extends boolean,
  IsReadonly extends boolean,
  IsShape extends boolean,
  IsArray extends boolean,
>(
  input: unknown,
  fit:
    | Fit<T, Bail, Checked, IsOptional, IsReadonly, IsShape, IsArray>
    | BaseFit,
  options?: ShapeOptions,
): Result<ToReadonly<T, IsReadonly> | Bail, ShapeErrors> => {
  const {
    strict = true,
    abortEarly = true,
    maxDeep = 10,
    maxUnknownKeys = 30,
    formatMessage = defaultFormatter,
  } = options ?? {};

  const ops = fit.Ops;
  if (ops.length === 0)
    throw new ParameterError(
      'validateShape: fit.Ops is empty, did you forget to add operations?',
    );

  const errors: ShapeErrors = {validation: [], structure: []};
  let error_count = 0;
  const path_stack: string[] = [];

  // ------ 核心操作处理器 ------
  const processOps = (
    current: unknown,
    currentOps: ReadonlyArray<OpItem>,
    depth: number,
  ): unknown => {
    for (let i = 0; i < currentOps.length; i++) {
      const op = currentOps[i];

      switch (op.type) {
        // 断言检查：验证值是否满足谓词条件
        case type.that: {
          if (!op.predicate(current)) {
            const msg = op.message;
            const userMsg = !msg
              ? DEFAULT_MSG
              : typeof msg === 'string'
                ? msg
                : (msg(current) as string);
            addValidationError(
              errors,
              path_stack,
              'assertion',
              formatMessage('assertion', {extra: {message: userMsg}}),
            );
            error_count++;
            if (abortEarly) return current;
          }
          break;
        }

        // 短路处理：满足条件时提前返回默认值或原值
        case type.off: {
          if (op.predicate(current))
            return 'defaultValue' in op ? op.defaultValue : current;
          break;
        }

        // 变换操作：对值进行转换处理
        case type.transform: {
          current = op.fn(current);
          break;
        }

        // 对象形状校验：递归验证对象字段
        case type.shape: {
          if (depth >= maxDeep) {
            addStructureError(
              errors,
              path_stack,
              'max_deep',
              formatMessage('max_deep', {depth: maxDeep}),
            );
            error_count++;
            if (abortEarly) return current;
            break;
          }

          if (typeof current !== 'object' || current === null) {
            addValidationError(
              errors,
              path_stack,
              'not_object',
              formatMessage('not_object', {received: getType(current)}),
            );
            error_count++;
            if (abortEarly) return current;
            break;
          }

          const obj = current as Record<string, unknown>;
          const fields = op.fields;
          const result_obj: Record<string, unknown> = {};
          const processed_keys = new Set<string>();
          let unknown_keys: string[] = [];

          // 处理输入对象中存在的字段
          for (const key in obj) {
            if (!Object.hasOwn(obj, key)) continue;

            if (key in fields) {
              processed_keys.add(key);
              path_stack.push(key);
              const field_fit = fields[key];
              const field_value = processOps(
                obj[key],
                field_fit.Ops,
                depth + 1,
              );
              if (abortEarly && error_count > 0) {
                path_stack.pop();
                return result_obj;
              }
              result_obj[key] = field_value;
              path_stack.pop();
            } else if (strict) {
              // 严格模式下收集未知字段
              unknown_keys.push(key);
              if (unknown_keys.length > maxUnknownKeys) {
                addStructureError(
                  errors,
                  path_stack,
                  'too_many_unknown',
                  formatMessage('too_many_unknown', {
                    extra: {
                      limit: maxUnknownKeys,
                      keys: unknown_keys.join(', '),
                    },
                  }),
                );
                error_count++;
                unknown_keys = [];
                if (abortEarly) return result_obj;
              }
            }
          }

          // 报告未知字段错误
          if (strict && unknown_keys.length > 0 && error_count === 0) {
            addStructureError(
              errors,
              path_stack,
              'unknown_field',
              formatMessage('unknown_field', {
                extra: {keys: unknown_keys.join(', ')},
              }),
            );
            error_count++;
            if (abortEarly) return result_obj;
          }

          // 处理缺失的必填字段
          for (const key of Object.keys(fields)) {
            if (processed_keys.has(key)) continue;

            path_stack.push(key);
            const field_fit = fields[key];

            if (!field_fit.isOptional) {
              addValidationError(
                errors,
                path_stack,
                'missing_field',
                formatMessage('missing_field', {key}),
              );
              error_count++;
              if (abortEarly) {
                path_stack.pop();
                return result_obj;
              }
            }
            // 可选字段缺失时传入 Void 让谓词处理
            const field_value = processOps(Void, field_fit.Ops, depth);
            if (abortEarly && error_count > 0) {
              path_stack.pop();
              return result_obj;
            }
            result_obj[key] = field_value;
            path_stack.pop();
          }

          current = result_obj;
          break;
        }

        // 数组校验：递归验证数组元素
        case type.toArray: {
          if (depth >= maxDeep) {
            addStructureError(
              errors,
              path_stack,
              'max_deep',
              formatMessage('max_deep', {depth: maxDeep}),
            );
            error_count++;
            if (abortEarly) return current;
            break;
          }

          if (!Array.isArray(current)) {
            addValidationError(
              errors,
              path_stack,
              'not_array',
              formatMessage('not_array', {received: getType(current)}),
            );
            error_count++;
            if (abortEarly) return current;
            break;
          }

          const elementFit = op.elementFit;
          const result_arr: unknown[] = [];

          // 逐个验证数组元素
          for (let idx = 0; idx < current.length; idx++) {
            path_stack.push(`[${idx}]`);
            const element_value = processOps(
              current[idx],
              elementFit.Ops,
              depth + 1,
            );
            if (abortEarly && error_count > 0) {
              path_stack.pop();
              return result_arr;
            }
            result_arr.push(element_value);
            path_stack.pop();
          }

          current = result_arr;
          break;
        }
      }
    }

    return current;
  };

  const result = processOps(input, ops, 0);

  if (error_count > 0) return Err(errors);
  return Ok(result as ToReadonly<T | Bail, IsReadonly>);
};

// ========================================
// 异步校验逻辑
// ========================================

/**
 * Validates input data against a Fit schema asynchronously.
 *
 * Supports async predicates, transforms, and nested validations.
 *
 * @template T - The output type after successful validation
 * @template Bail - The type returned when validation short-circuits
 * @template Checked - Union type of already-checked types
 * @template IsOptional - Whether the field is optional
 * @template IsReadonly - Whether the output should be readonly
 * @template IsShape - Whether this is a shape schema
 * @template IsArray - Whether this is an array schema
 * @param input - The raw input data to validate
 * @param fit - The Fit schema to validate against
 * @param options - Optional validation configuration
 * @returns A Promise resolving to a Result containing either the validated data or error details
 * @throws {ParameterError} If the Fit schema has no operations defined
 */
export const validateAsync = async <
  T,
  Bail,
  Checked,
  IsOptional extends boolean,
  IsReadonly extends boolean,
  IsShape extends boolean,
  IsArray extends boolean,
>(
  input: unknown,
  fit:
    | Fit<T, Bail, Checked, IsOptional, IsReadonly, IsShape, IsArray>
    | BaseFit,
  options?: ShapeOptions,
): Promise<Result<ToReadonly<T, IsReadonly> | Bail, ShapeErrors>> => {
  const {
    strict = true,
    abortEarly = true,
    maxDeep = 10,
    maxUnknownKeys = 30,
    formatMessage = defaultFormatter,
  } = options ?? {};

  const ops = fit.Ops;
  if (ops.length === 0)
    throw new ParameterError(
      'validateAsync: fit.Ops is empty, did you forget to add operations?',
    );

  const errors: ShapeErrors = {validation: [], structure: []};
  let error_count = 0;
  const path_stack: string[] = [];

  // ------ 异步核心操作处理器 ------
  const processOps = async (
    current: unknown,
    currentOps: ReadonlyArray<OpItem>,
    depth: number,
  ): Promise<unknown> => {
    for (let i = 0; i < currentOps.length; i++) {
      const op = currentOps[i];

      switch (op.type) {
        // 异步断言检查
        case type.that: {
          if (!(await dynamicAwait(op.predicate(current)))) {
            const msg = op.message;
            const userMsg = !msg
              ? DEFAULT_MSG
              : typeof msg === 'string'
                ? msg
                : await dynamicAwait(msg(current));
            addValidationError(
              errors,
              path_stack,
              'assertion',
              formatMessage('assertion', {extra: {message: userMsg}}),
            );
            error_count++;
            if (abortEarly) {
              return current;
            } else {
              /* empty */
            }
          }
          break;
        }

        // 异步短路处理
        case type.off: {
          if (await dynamicAwait(op.predicate(current)))
            return 'defaultValue' in op ? op.defaultValue : current;
          break;
        }

        // 异步变换操作
        case type.transform: {
          current = await dynamicAwait(op.fn(current));
          break;
        }

        // 异步对象形状校验
        case type.shape: {
          if (depth >= maxDeep) {
            addStructureError(
              errors,
              path_stack,
              'max_deep',
              formatMessage('max_deep', {depth: maxDeep}),
            );
            error_count++;
            if (abortEarly) return current;
            break;
          }

          if (typeof current !== 'object' || current === null) {
            addValidationError(
              errors,
              path_stack,
              'not_object',
              formatMessage('not_object', {received: getType(current)}),
            );
            error_count++;
            if (abortEarly) return current;
            break;
          }

          const obj = current as Record<string, unknown>;
          const fields = op.fields;
          const result_obj: Record<string, unknown> = {};
          const processed_keys = new Set<string>();
          let unknown_keys: string[] = [];

          // 异步处理输入对象中存在的字段
          for (const key in obj) {
            if (!Object.hasOwn(obj, key)) continue;

            if (key in fields) {
              processed_keys.add(key);
              path_stack.push(key);
              const field_fit = fields[key];
              const field_value = await processOps(
                obj[key],
                field_fit.Ops,
                depth + 1,
              );
              if (abortEarly && error_count > 0) {
                path_stack.pop();
                return result_obj;
              }
              result_obj[key] = field_value;
              path_stack.pop();
            } else if (strict) {
              unknown_keys.push(key);
              if (unknown_keys.length > maxUnknownKeys) {
                addStructureError(
                  errors,
                  path_stack,
                  'too_many_unknown',
                  formatMessage('too_many_unknown', {
                    extra: {
                      limit: maxUnknownKeys,
                      keys: unknown_keys.join(', '),
                    },
                  }),
                );
                error_count++;
                unknown_keys = [];
                if (abortEarly) return result_obj;
              }
            }
          }

          // 报告未知字段错误
          if (strict && unknown_keys.length > 0 && error_count === 0) {
            addStructureError(
              errors,
              path_stack,
              'unknown_field',
              formatMessage('unknown_field', {
                extra: {keys: unknown_keys.join(', ')},
              }),
            );
            error_count++;
            if (abortEarly) return result_obj;
          }

          // 异步处理缺失的必填字段
          for (const key of Object.keys(fields)) {
            if (processed_keys.has(key)) continue;

            path_stack.push(key);
            const field_fit = fields[key];

            if (!field_fit.isOptional) {
              addValidationError(
                errors,
                path_stack,
                'missing_field',
                formatMessage('missing_field', {key}),
              );
              error_count++;
              if (abortEarly) {
                path_stack.pop();
                return result_obj;
              }
            }
            const field_value = await processOps(Void, field_fit.Ops, depth);
            if (abortEarly && error_count > 0) {
              path_stack.pop();
              return result_obj;
            }
            result_obj[key] = field_value;
            path_stack.pop();
          }

          current = result_obj;
          break;
        }

        // 异步数组校验
        case type.toArray: {
          if (depth >= maxDeep) {
            addStructureError(
              errors,
              path_stack,
              'max_deep',
              formatMessage('max_deep', {depth: maxDeep}),
            );
            error_count++;
            if (abortEarly) return current;
            break;
          }

          if (!Array.isArray(current)) {
            addValidationError(
              errors,
              path_stack,
              'not_array',
              formatMessage('not_array', {received: getType(current)}),
            );
            error_count++;
            if (abortEarly) return current;
            break;
          }

          const elementFit = op.elementFit;
          const result_arr: unknown[] = [];

          // 异步逐个验证数组元素
          for (let idx = 0; idx < current.length; idx++) {
            path_stack.push(`[${idx}]`);
            const element_value = await processOps(
              current[idx],
              elementFit.Ops,
              depth + 1,
            );
            if (abortEarly && error_count > 0) {
              path_stack.pop();
              return result_arr;
            }
            result_arr.push(element_value);
            path_stack.pop();
          }

          current = result_arr;
          break;
        }
      }
    }

    return current;
  };

  const result = await processOps(input, ops, 0);

  if (error_count > 0) return Err(errors);
  return Ok(result as ToReadonly<T | Bail, IsReadonly>);
};

