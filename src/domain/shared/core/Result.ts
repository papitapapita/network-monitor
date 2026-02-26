/**
 * Represents the outcome of an operation, encapsulating either a success
 * with a value or a failure with an error message.
 * The instance is immutable.
 *
 * @template T The type of the successful result value.
 * @property {boolean} isSuccess - Indicates if the operation was successful.
 * @property {boolean} isFailure - Indicates if the operation failed.
 * @property {string} error - The error message when the operation fails.
 * @property {T} value - The value when the operation succeeds.
 */
export class Result<T> {
  public isSuccess: boolean;
  public isFailure: boolean;
  private _error: string | undefined;
  private _value: T | undefined;

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
    this.isFailure = !isSuccess;
    this._error = error;
    this._value = value;

    Object.freeze(this);
  }

  public get value(): T {
    if (!this.isSuccess) {
      throw new Error(
        "Can't get the value of an error result. Use 'errorValue' instead."
      );
    }

    return this._value as T;
  }

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
   * @param {Result<unknown>[]} results - The list of results to combine.
   * @returns {Result<unknown>} A combined result representing collective success or the first failure.
   */
  public static combine(results: Result<unknown>[]): Result<unknown> {
    for (const result of results) {
      if (!result.isSuccess) return result;
    }
    return Result.ok();
  }
}
