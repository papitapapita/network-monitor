/**
 * Represents a single argument used in a guard check.
 */
export interface IGuardArgument<T> {
  /**
   * The actual value of the argument being validated.
   */
  argument: T;
  /**
   * The name of the argument, used to provide meaningful
   * error messages when validation fails.
   */
  argumentName: string;
}

/**
 * Defines a collection of guard arguments, typically used
 * to validate multiple inputs in bulk.
 */
export type GuardArgumentCollection<T> = IGuardArgument<T>[];
