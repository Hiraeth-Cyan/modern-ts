// ========================================
// ./src/Errors.ts
// ========================================
/* v8 ignore file -- @preserve */

/**
 * Error thrown when a resource is accessed after it has been disposed (Use After Free).
 */
export class UseAfterFreeError extends Error {
  /**
   * Creates an instance of UseAfterFreeError.
   * @param message - The error message. Defaults to 'Cannot access resource after it has been disposed.'
   */
  constructor(message: string) {
    super(message);
    this.name = 'UseAfterFreeError';
    if (typeof Error.captureStackTrace === 'function')
      Error.captureStackTrace(this, UseAfterFreeError);
  }
}

/**
 * Error thrown when a lock operation fails.
 * Base class for all lock-related errors.
 */
export class LockError extends Error {
  /**
   * Creates an instance of LockError.
   * @param message - The error message describing the lock failure.
   */
  constructor(message: string) {
    super(message);
    this.name = 'LockError';
    if (typeof Error.captureStackTrace === 'function')
      Error.captureStackTrace(this, LockError);
  }
}

/**
 * Error thrown when a mutex operation fails.
 * Used for mutual exclusion lock violations and failures.
 */
export class MutexError extends LockError {
  /**
   * Creates an instance of MutexError.
   * @param message - The error message describing the mutex failure.
   */
  constructor(message: string) {
    super(message);
    this.name = 'MutexError';
    if (typeof Error.captureStackTrace === 'function')
      Error.captureStackTrace(this, MutexError);
  }
}

/**
 * Error thrown when a read-write lock operation fails.
 * Used for reader-writer lock violations and failures.
 */
export class RWLockError extends LockError {
  /**
   * Creates an instance of RWLockError.
   * @param message - The error message describing the read-write lock failure.
   */
  constructor(message: string) {
    super(message);
    this.name = 'RWLockError';
    if (typeof Error.captureStackTrace === 'function')
      Error.captureStackTrace(this, RWLockError);
  }
}

/**
 * Error thrown when a function parameter is invalid.
 * Used for parameter validation failures.
 */
export class ParameterError extends Error {
  /**
   * Creates an instance of ParameterError.
   * @param message - The error message describing the parameter validation failure.
   */
  constructor(message: string) {
    super(message);
    this.name = 'ParameterError';
    if (typeof Error.captureStackTrace === 'function')
      Error.captureStackTrace(this, ParameterError);
  }
}

/**
 * Error thrown when a Flow completes before a run operation could finish.
 * This indicates that the Flow was completed or stopped while there were
 * still pending operations waiting for values.
 */
export class FlowCompletionError extends Error {
  /**
   * Creates an instance of FlowCompletionError.
   * @param message - The error message. Defaults to 'Flow completed before run could finish'.
   */
  constructor(message: string = 'Flow completed before run could finish') {
    super(message);
    this.name = 'FlowCompletionError';
    if (typeof Error.captureStackTrace === 'function')
      Error.captureStackTrace(this, FlowCompletionError);
  }
}
