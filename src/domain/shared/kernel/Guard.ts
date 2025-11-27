import { GuardArgumentCollection, IGuardResult } from '../interfaces';

export class Guard {
  public static combine(guardResults: IGuardResult[]): IGuardResult {
    for (const result of guardResults) {
      if (!result.succeeded) return result;
    }

    return { succeeded: true };
  }

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

  public static againstNullOrUndefinedBulk<T>(
    args: GuardArgumentCollection<T>
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

  public static isOneOf<T>(
    value: T,
    validValues: T[],
    argumentName: string
  ): IGuardResult {
    let isValid = false;
    for (const validValue of validValues) {
      if (value === validValue) {
        isValid = true;
      }
    }

    if (isValid) {
      return { succeeded: true };
    } else {
      return {
        succeeded: false,
        message: `${argumentName} isn't oneOf the correct types in ${JSON.stringify(
          validValues
        )}. Got "${value}".`
      };
    }
  }

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

  public static allInRange(
    numbers: number[],
    min: number,
    max: number,
    argumentName: string
  ): IGuardResult {
    let failingResult: IGuardResult | null = null;

    for (const num of numbers) {
      const numIsInRangeResult = this.inRange(
        num,
        min,
        max,
        argumentName
      );
      if (!numIsInRangeResult.succeeded)
        failingResult = numIsInRangeResult;
    }

    if (failingResult) {
      return {
        succeeded: false,
        message: `${argumentName} is not within the range.`
      };
    }
    return { succeeded: true };
  }

  public static againstAtLeast(
    numChars: number,
    argumentName: string
  ): IGuardResult {
    if (numChars < 1) {
      return {
        succeeded: false,
        message: `${argumentName} must be at least 1 character.`
      };
    }
    return { succeeded: true };
  }

  public static againstAtMost(
    numChars: number,
    argumentName: string
  ): IGuardResult {
    if (numChars > 255) {
      return {
        succeeded: false,
        message: `${argumentName} must be at most 255 characters.`
      };
    }
    return { succeeded: true };
  }

  public static againstInvalidEmail(
    email: string,
    argumentName: string
  ): IGuardResult {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      return {
        succeeded: false,
        message: `${argumentName} is not a valid email address.`
      };
    }
    return { succeeded: true };
  }

  public static isString(
    value: any,
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

  public static isNumber(
    value: any,
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

  public static isBoolean(
    value: any,
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

  public static isDate(
    value: any,
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
