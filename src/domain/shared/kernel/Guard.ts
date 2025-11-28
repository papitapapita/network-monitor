import { GuardArgumentCollection, IGuardResult } from '../interfaces';

/**
 * The Guard class provides a collection of reusable validation helpers.
 *
 * Guards are used primarily inside Domain Entities, Value Objects and Use Cases
 * to enforce invariants, validate input, and prevent invalid states.
 *
 * Each method returns an `IGuardResult` describing whether the validation succeeded
 * and, if not, why it failed. No exceptions are thrown — this makes error handling
 * explicit, predictable, and friendly for Result-based workflows.
 */
export class Guard {
  /**
   * Combines multiple guard results into a single result.
   * Returns the first failing result, or `{ succeeded: true }` if all succeed.
   *
   * @param {IGuardResult[]} guardResults - A list of guard results to evaluate.
   * @returns {IGuardResult} The combined validation result.
   */
  public static combine(guardResults: IGuardResult[]): IGuardResult {
    for (const result of guardResults) {
      if (!result.succeeded) return result;
    }
    return { succeeded: true };
  }

  /**
   * Ensures that a value is neither null nor undefined.
   *
   * @param {any} argument - The value to validate.
   * @param {string} argumentName - The name of the argument for error messages.
   * @returns {IGuardResult} Validation result.
   */
  public static againstNullOrUndefined<T>(
    argument: T,
    argumentName: string
  ): IGuardResult {
    if (argument === null || argument === undefined) {
      return {
        succeeded: false,
        message: `${argumentName} is null or undefined`
      };
    }
    return { succeeded: true };
  }

  /**
   * Validates multiple arguments for null/undefined.
   *
   * @param {GuardArgumentCollection} args - Array containing argument names and values.
   * @returns {IGuardResult} Validation result.
   */
  public static againstNullOrUndefinedBulk(
    args: GuardArgumentCollection
  ): IGuardResult {
    for (const arg of args) {
      const result = this.againstNullOrUndefined(
        arg.argument,
        arg.argumentName
      );
      if (!result.succeeded) return result;
    }
    return { succeeded: true };
  }

  /**
   * Ensures a number is within a specific inclusive range.
   *
   * @param {number} num - The value to validate.
   * @param {number} min - Lower bound.
   * @param {number} max - Upper bound.
   * @param {string} argumentName - Argument label.
   * @returns {IGuardResult} Validation result.
   */
  public static inRange(
    num: number,
    min: number,
    max: number,
    argumentName: string
  ): IGuardResult {
    const isInRange = num >= min && num <= max;

    if (!isInRange) {
      return {
        succeeded: false,
        message: `${argumentName} is not within range ${min} to ${max}.`
      };
    }
    return { succeeded: true };
  }

  /**
   * Ensures all numbers in an array fall within a specific range.
   *
   * @param {number[]} numbers - Array of numbers to validate.
   * @param {number} min - Minimum allowed value.
   * @param {number} max - Maximum allowed value.
   * @param {string} argumentName - Label for error messages.
   * @returns {IGuardResult} Validation result.
   */
  public static allInRange(
    numbers: number[],
    min: number,
    max: number,
    argumentName: string
  ): IGuardResult {
    let failingResult: IGuardResult | null = null;

    for (const num of numbers) {
      const check = this.inRange(num, min, max, argumentName);
      if (!check.succeeded) failingResult = check;
    }

    if (failingResult) {
      return {
        succeeded: false,
        message: `${argumentName} is not within the range.`
      };
    }

    return { succeeded: true };
  }

  /**
   * Ensures a string has at least 1 character.
   *
   * @param {number} numChars - Number of characters.
   * @param {string} argumentName - Argument name.
   * @returns {IGuardResult} Validation result.
   */
  public static againstAtLeast(
    numChars: number,
    min: number,
    argumentName: string
  ): IGuardResult {
    if (numChars < min) {
      return {
        succeeded: false,
        message: `${argumentName} must be at least ${min} characters.`
      };
    }
    return { succeeded: true };
  }

  /**
   * Ensures a string is no longer than 255 characters.
   *
   * @param {number} numChars - Number of characters.
   * @param {string} argumentName - Argument name.
   * @returns {IGuardResult} Validation result.
   */
  public static againstAtMost(
    numChars: number,
    max: number,
    argumentName: string
  ): IGuardResult {
    if (numChars > max) {
      return {
        succeeded: false,
        message: `${argumentName} must be at most ${max} characters.`
      };
    }
    return { succeeded: true };
  }

  /**
   * Validates that a value is a string.
   *
   * @param {any} value - Value to check.
   * @param {string} argumentName - Input label.
   * @returns {IGuardResult} Validation result.
   */
  public static isString<T>(
    value: T,
    argumentName: string
  ): IGuardResult {
    if (typeof value !== 'string') {
      return {
        succeeded: false,
        message: `${argumentName} must be a string.`
      };
    }
    return { succeeded: true };
  }

  /**
   * Validates that a value is a number and not NaN.
   *
   * @param {any} value - Value to check.
   * @param {string} argumentName - Argument label.
   * @returns {IGuardResult} Validation result.
   */
  public static isNumber<T>(
    value: T,
    argumentName: string
  ): IGuardResult {
    if (typeof value !== 'number' || isNaN(value)) {
      return {
        succeeded: false,
        message: `${argumentName} must be a valid number.`
      };
    }
    return { succeeded: true };
  }

  /**
   * Validates that a value is a boolean.
   *
   * @param {any} value - Value to check.
   * @param {string} argumentName - Argument name.
   * @returns {IGuardResult} Validation result.
   */
  public static isBoolean<T>(
    value: T,
    argumentName: string
  ): IGuardResult {
    if (typeof value !== 'boolean') {
      return {
        succeeded: false,
        message: `${argumentName} must be a boolean.`
      };
    }
    return { succeeded: true };
  }

  /**
   * Validates that a value is a valid Date instance.
   *
   * @param {any} value - The value to check.
   * @param {string} argumentName - The argument identifier.
   * @returns {IGuardResult} Validation result.
   */
  public static isDate<T>(
    value: T,
    argumentName: string
  ): IGuardResult {
    if (!(value instanceof Date) || isNaN(value.getTime())) {
      return {
        succeeded: false,
        message: `${argumentName} must be a valid Date.`
      };
    }
    return { succeeded: true };
  }

  /**
   * Validates that a string is a well-formed email.
   *
   * @param {string} email - Email value to validate.
   * @param {string} argumentName - Label for messaging.
   * @returns {IGuardResult} Validation result.
   */
  public static isValidEmail(
    email: string,
    argumentName: string
  ): IGuardResult {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      return {
        succeeded: false,
        message: `${argumentName} is not a valid email address`
      };
    }
    return { succeeded: true };
  }

  /**
   * Ensures a number is greater than a minimum.
   *
   * @param {number} minValue - Minimum allowed value.
   * @param {number} actualValue - Actual value being validated.
   * @param {string} argumentName - Name used in error messaging.
   * @returns {IGuardResult} Validation result.
   */
  public static greaterThan(
    minValue: number,
    actualValue: number,
    argumentName: string
  ): IGuardResult {
    if (actualValue <= minValue) {
      return {
        succeeded: false,
        message: `${argumentName} must be greater than ${minValue}.`
      };
    }
    return { succeeded: true };
  }
}
