/**
 * Represents the outcome of an operation, encapsulating either a success
 * with a value or a failure with an error message.
 *
 * This pattern is widely used in functional programming and Domain-Driven Design
 * to avoid throwing exceptions for expected application errors, improving safety
 * and clarity.
 *
 * @template T The type of the successful result value.
 */
export class Result<T> {
  /**
   * Indicates whether the operation was successful.
   */
  public isSuccess: boolean;

  /**
   * Error message in case of failure.
   * Undefined when the result is successful.
   * @private
   */
  private _error: string | undefined;

  /**
   * Internal value for successful results.
   * Undefined when the result is a failure.
   * @private
   */
  private _value: T | undefined;

  /**
   * Creates a new Result instance.
   *
   * @private
   * @param {boolean} isSuccess - Whether the operation succeeded.
   * @param {string} [error] - Error message when operation fails.
   * @param {T} [value] - Successful result value.
   *
   * @throws {Error} Throws if `isSuccess` is true but an error is provided.
   * @throws {Error} Throws if `isSuccess` is false but no error is provided.
   */
  private constructor(isSuccess: boolean, error?: string, value?: T) {
    if (isSuccess && error) {
      throw new Error(
        'InvalidOperation: A result cannot be successful and contain an error'
      );
    }
    if (!isSuccess && !error) {
      throw new Error(
        'InvalidOperation: A failing result needs to contain an error message'
      );
    }

    this.isSuccess = isSuccess;
    this._error = error;
    this._value = value;

    Object.freeze(this);
  }

  /**
   * Returns the value contained in a successful result.
   *
   * @returns {T} The stored value.
   *
   * @throws {Error} Throws if attempting to retrieve a value from a failure result.
   */
  public get value(): T {
    if (!this.isSuccess) {
      throw new Error(
        "Can't get the value of an error result. Use 'errorValue' instead."
      );
    }

    return this._value as T;
  }

  /**
   * Returns the error message of a failed result.
   *
   * @returns {string} The stored error message.
   */
  public get error(): string {
    return this._error as string;
  }

  /**
   * Creates a successful result.
   *
   * @template U The type of the returned result value.
   * @param {U} [value] - Optional value to wrap in the result.
   * @returns {Result<U>} A successful Result instance.
   */
  public static ok<U>(value?: U): Result<U> {
    return new Result<U>(true, undefined, value);
  }

  /**
   * Creates a failed result.
   *
   * @template U The type of the result (unused because failures contain no value).
   * @param {string} error - Error message describing the failure.
   * @returns {Result<U>} A failure Result instance.
   */
  public static fail<U>(error: string): Result<U> {
    return new Result<U>(false, error);
  }

  /**
   * Combines an array of results into a single result.
   *
   * If any result in the array is a failure, the first failing result is returned.
   * If all results succeed, a successful empty Result is returned.
   *
   * @param {Result<any>[]} results - The list of results to combine.
   * @returns {Result<any>} A combined result representing collective success or the first failure.
   */
  public static combine(results: Result<any>[]): Result<any> {
    for (const result of results) {
      if (!result.isSuccess) return result;
    }
    return Result.ok();
  }
}
