// ========================================
// ./src/Other/secret.ts
// ========================================

/**
 * A unique Symbol used to represent the state of a Secret instance when its original
 * sensitive value has been destroyed or erased from memory.
 * @internal
 */
export const EMPTY = Symbol('Empty');

export class SecretError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecretError';
  }
}

/**
 * A secure container class for sensitive values (T).
 *
 * The class uses private fields, controlled access, and disposal mechanisms
 * to protect data from accidental exposure in logs, serialization, and memory dumps.
 *
 * @template T The type of the sensitive value being protected.
 * @implements {Disposable} (Implicitly, for TypeScript 5.2+ `using` support)
 */
export class Secret<T> {
  /**
   * The private field storing the sensitive value or the `EMPTY` Symbol if destroyed.
   * This is the core mechanism to prevent serialization and accidental console logging.
   * @private
   */
  #original_value: T | typeof EMPTY;

  /**
   * Creates a new Secret container for the given sensitive value.
   *
   * @param {T} value The sensitive value (e.g., an API key or password) to be secured.
   */
  constructor(value: T) {
    this.#original_value = value;
    Object.seal(this);
  }

  /**
   * A factory method to create a new Secret instance.
   *
   * @template T The type of the sensitive value.
   * @param {T} value The sensitive value to be wrapped.
   * @returns {Secret<T>} A new Secret instance containing the value.
   */
  static make<T>(value: T): Secret<T> {
    return new Secret(value);
  }

  /**
   * Reveals the original sensitive value stored within the Secret container.
   * This is the only intended method to retrieve the protected data.
   *
   * @template T The type of the value being revealed.
   * @param {Secret<T>} secret The Secret instance to reveal the value from.
   * @returns {T} The original sensitive value.
   * @throws {Error} If the Secret value has already been destroyed (`destroy` or `using` block exited).
   */
  static reveal<T>(secret: Secret<T>): T {
    if (secret.#original_value == EMPTY)
      throw new SecretError('Attempt to access the deleted secret value.');

    return secret.#original_value;
  }

  /**
   * Destroys the sensitive value by overwriting its memory location with the `Empty` Symbol.
   * This minimizes the duration the sensitive data resides in memory.
   *
   * After destruction, `reveal()` will throw an error.
   *
   * @template T The type of the value being destroyed.
   * @param {Secret<T>} secret The Secret instance to destroy.
   */
  static destroy<T>(secret: Secret<T>): void {
    secret.#original_value = EMPTY;
  }

  /**
   * Executes a callback function with the revealed sensitive value and ensures the secret
   * is destroyed immediately after the callback completes, regardless of success or failure.
   *
   * @template T The type of the sensitive value.
   * @template R The return type of the callback function.
   * @param {Secret<T>} secret The Secret instance to operate on.
   * @param {(value: T) => R} callback The function to execute with the revealed value.
   * @returns {R} The result of the callback function.
   */
  static dispose<T, R>(secret: Secret<T>, callback: (value: T) => R): R {
    try {
      const value = Secret.reveal(secret);
      return callback(value);
    } finally {
      Secret.destroy(secret);
    }
  }

  /**
   * Executes an asynchronous callback function with the revealed sensitive value and ensures the secret
   * is destroyed immediately after the callback completes, regardless of success or failure.
   *
   * @template T The type of the sensitive value.
   * @template R The resolved type of the callback function's Promise.
   * @param {Secret<T>} secret The Secret instance to operate on.
   * @param {(value: T) => Promise<R>} callback The asynchronous function to execute with the revealed value.
   * @returns {Promise<R>} A Promise that resolves to the result of the asynchronous callback.
   */
  static async disposeAsync<T, R>(
    secret: Secret<T>,
    callback: (value: T) => Promise<R>,
  ): Promise<R> {
    try {
      const value = Secret.reveal(secret);
      return await callback(value);
    } finally {
      Secret.destroy(secret);
    }
  }

  /**
   * Prevents accidental serialization of the secret value via `JSON.stringify()`.
   * @throws {SecretError} Always throws an error to prevent serialization.
   */
  toJSON() {
    throw new SecretError('Secret values cannot be serialized via toJSON()');
  }

  /**
   * Prevents accidental string conversion of the secret value.
   * @throws {SecretError} Always throws an error to prevent conversion.
   */
  toString() {
    throw new SecretError(
      'Secret values cannot be converted to String via toString()',
    );
  }

  /**
   * Prevents accidental serialization of the secret value via `console.*`.
   * @throws {SecretError} Always throws an error to prevent serialization.
   */
  [Symbol.for('nodejs.util.inspect.custom')]() {
    throw new SecretError('Secret values cannot be inspected via console.log');
  }

  /**
   * Prevents accidental primitive conversion of the secret value.
   * @throws {SecretError} Always throws an error to prevent conversion.
   */
  valueOf() {
    throw new SecretError(
      'Secret values cannot be converted to Primitive via valueOf()',
    );
  }

  /**
   * Prevents accidental primitive conversion of the secret value, respecting the `hint`.
   * @param {'string' | 'number' | 'default'} hint The desired conversion hint.
   * @throws {SecretError} Always throws an error to prevent conversion.
   */
  [Symbol.toPrimitive](hint: 'string' | 'number' | 'default') {
    throw new SecretError(
      `Secret values cannot be converted to Primitive via [Symbol.toPrimitive] (Hint: ${hint})`,
    );
  }

  /**
   * Prevents accidental inspection via `Object.prototype.toString.call()`.
   * @throws {SecretError} Always throws an error to prevent inspection.
   */
  get [Symbol.toStringTag]() {
    throw new SecretError(
      'Secret values cannot be inspected via [Symbol.toStringTag]',
    );
  }

  /**
   * Implements the `[Symbol.dispose]` method, making the Secret compatible with
   * the TypeScript 5.2+ `using` declaration for automatic resource management.
   *
   * When a `using` block exits, this method is called, which internally calls `destroy`.
   * @internal
   */
  [Symbol.dispose](): void {
    this.#original_value = EMPTY;
  }
}
