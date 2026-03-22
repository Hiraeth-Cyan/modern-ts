// ========================================
// ./src/unknown-error.ts
// ========================================

/**
 * Standardized error classification structure.
 * Categorizes unknown error values into distinct types for consistent handling.
 */
export interface ErrorType {
  /**
   * Error classification code:
   * 0 = Standard Error instance
   * 1 = DOMException (specifically AbortError)
   * 2 = null or undefined value
   * 3 = Error-like object with 'message' property
   * 4 = Complex objects or primitive values without standard error structure
   */
  readonly type_code: 0 | 1 | 2 | 3 | 4;
  /** Human-readable error description, sanitized for safe display */
  readonly message: string;
}

/**
 * Safely extracts structured error information from any unknown value.
 * Handles edge cases including DOMExceptions, primitive values,
 * objects with circular references, getters, and Proxy traps.
 *
 * @param error_data - The captured exception value (typically from catch block)
 * @returns Normalized error object with classification and sanitized message
 *
 * @example
 * try { throw "Raw string error"; }
 * catch (e) { extractErrorInfo(e); }
 * // Returns: { type_code: 4, message: "Primitive [string]: Raw string error" }
 */
export function extractErrorInfo(error_data: unknown): ErrorType {
  // Handle AbortError DOMException (special case for abort signals)
  if (
    typeof DOMException !== 'undefined' &&
    error_data instanceof DOMException
  ) {
    return {type_code: 1, message: ''};
  }

  // Handle standard Error instances
  if (error_data instanceof Error) {
    return {type_code: 0, message: ''};
  }

  // Handle null/undefined values
  if (error_data === null || error_data === undefined) {
    return {
      type_code: 2,
      message: 'An unknown or null/undefined error occurred.',
    };
  }

  // Handle error-like objects (non-Error objects with 'message' property)
  if (typeof error_data === 'object') {
    // Safely check for own 'message' property (avoids getters/Proxy traps)
    const has_message_property = Object.prototype.hasOwnProperty.call(
      error_data,
      'message',
    );

    if (has_message_property) {
      const maybeError = error_data as Partial<{message: unknown}>;

      // Safely extract message value
      try {
        const message_value = maybeError.message;

        // Use string message directly
        if (typeof message_value === 'string') {
          return {
            type_code: 3,
            message: message_value,
          };
        }
        // Convert non-object message values to string
        else if (
          message_value !== undefined &&
          (typeof message_value !== 'object' || Array.isArray(message_value))
        ) {
          return {
            type_code: 3,
            // eslint-disable-next-line @typescript-eslint/no-base-to-string
            message: String(message_value),
          };
        }
      } catch {
        // If accessing 'message' throws, treat as complex object
      }
    }
  }

  // Handle primitive types and complex objects
  let error_message: string;
  const data_type: string = typeof error_data;

  // Primitive types (non-object, non-function)
  if (data_type !== 'object' && data_type !== 'function') {
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    error_message = `Primitive [${data_type}]: ${String(error_data)}`;
  }
  // Complex objects (non-Error, non-error-like)
  else {
    let type_name: string;
    try {
      // Safely get type string (handles Proxy traps)
      type_name = Object.prototype.toString.call(error_data);
    } catch {
      type_name = '[object Object]'; // Fallback for trapped calls
    }

    let detail = type_name;

    // Attempt JSON serialization
    try {
      const json_string = JSON.stringify(error_data, null, 2);
      detail = `${type_name}: ${json_string.substring(0, 512)}`;
    } catch {
      // Fallback for circular references, BigInt, or getter exceptions
      const fallback_info: string[] = [];

      try {
        // Safely extract enumerable own properties using reflection
        for (const key of Object.keys(error_data)) {
          const descriptor = Object.getOwnPropertyDescriptor(error_data, key);

          // Only read non-getter properties safely
          if (descriptor && descriptor.value !== undefined) {
            const value: unknown = descriptor.value;
            const str_value = String(value).substring(0, 80);
            fallback_info.push(`${key}: ${str_value}`);
          }
        }
      } catch {
        fallback_info.push('Object details unavailable due to internal error.');
      }

      const details_string =
        fallback_info.length > 0
          ? `{ ${fallback_info.join(', ')} }`
          : type_name;
      detail = `${type_name}: ${details_string} (Serialization Failed)`;
    }

    error_message = `Complex Object ${detail}`;
  }

  return {
    type_code: 4,
    message: error_message,
  };
}

/**
 * Converts any thrown value into a DOMException while preserving original context.
 *
 * Error type handling:
 * - DOMException (type 1): Returns directly
 * - Error instances (type 0): Creates DOMException with preserved stack trace
 * - Other types (2-4): Creates wrapped DOMException with extracted message
 *
 * Original error is attached to the 'cause' property for debugging.
 *
 * @param error_data - Raw value caught in try/catch block
 * @param name - DOMException name (defaults to 'AbortError')
 * @returns DOMException instance with optional 'cause' property
 * @throws {TypeError} If DOMException constructor is unavailable
 *
 * @example
 * try { throw new Error("Network failure"); }
 * catch (e) {
 *   const domError = ensureDOMException(e);
 *   console.log(domError.name);  // "DOMException"
 *   console.log(domError.cause); // Original Error instance
 * }
 *
 * @example
 * try { throw { code: 404, msg: "Not found" }; }
 * catch (e) {
 *   const domError = ensureDOMException(e);
 *   console.log(domError.message);
 *   // "DOMException Wrapped: Complex Object [object Object]..."
 * }
 */
export function ensureDOMException(
  error_data: unknown,
  name: string = 'AbortError',
): DOMException & {cause?: unknown} {
  const extract = extractErrorInfo(error_data);

  // Return DOMException directly
  if (extract.type_code === 1) {
    return error_data as DOMException & {cause?: unknown};
  }

  // Convert Error to DOMException with stack preservation
  if (extract.type_code === 0) {
    const e = error_data as Error;
    const dome = new DOMException(e.message);

    if ('stack' in e && typeof e.stack === 'string') {
      dome.stack = e.stack;
    }

    dome.cause = e;
    return dome as DOMException & {cause?: unknown};
  }

  // Wrap non-Error types in DOMException
  const error_message = `DOMException Wrapped: ${extract.message}`;
  const final_error = new DOMException(error_message, name);
  final_error.cause = error_data;

  return final_error as DOMException & {cause?: unknown};
}

/**
 * Ensures that the captured value is an Error instance. If not, it wraps the value in an Error object that includes the original information.
 * @param error_data - The value caught by the try...catch block (typically of type unknown).
 * @returns An object guaranteed to be of type Error, with an optional 'cause' property.
 */
export function ensureError(error_data: unknown): Error & {cause?: unknown} {
  const extract = extractErrorInfo(error_data);
  if (extract.type_code === 1 || extract.type_code === 0) {
    return error_data as Error & {cause?: unknown};
  }
  let error_message = extract.message;
  if (extract.type_code === 4) {
    error_message = `Wrapped: ${error_message}`;
  }

  const final_error = new Error(error_message);
  final_error.cause = error_data;
  return final_error as Error & {cause?: unknown};
}

/**
 * Used to wrap unknown type errors caught in try-catch blocks, ensuring the error chain remains intact.
 * @extends Error
 */
export class UnknownError extends Error {
  public override readonly cause: unknown;

  /**
   * Handles unknown type errors caught in try-catch blocks.
   * @param raw_error - The value caught by the try...catch block, of type unknown.
   * @param message - An optional custom message, which will be the primary message for this UnknownError.
   */
  constructor(raw_error: unknown, message?: string) {
    // 确保一定是 Error 类型 (返回值包含 cause 属性)
    const ensured_error = ensureError(raw_error);
    // 添加自定义消息
    const final_message = message ?? `UnknownError: ${ensured_error.message}`;
    super(final_message);
    this.name = 'UnknownError';
    this.cause = raw_error; // 手动添加，保证兼容性

    /* v8 ignore if -- @preserve */
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, UnknownError);
    }
  }

  /**
   * Static constructor used to quickly create and wrap an UnknownError instance.
   * @param raw_error - The value caught by the try...catch block, of type unknown.
   * @param message - An optional custom message.
   * @returns The wrapped UnknownError instance.
   */
  static from(raw_error: unknown, message?: string): UnknownError {
    // -- 直接调用构造函数 --
    return new UnknownError(raw_error, message);
  }

  /**
   * Returns a visual representation of the error (excluding the stack trace).
   * @returns The visual error representation.
   */
  toString(): string {
    const causeString =
      this.cause instanceof Error ? this.cause.toString() : String(this.cause);
    return `${this.name}: ${this.message}\nCaused by: ${causeString}`;
  }
}
