/**
 * Represents the result of a guard validation.
 */
export interface IGuardResult {
  /**
   * Indicates whether the guard validation succeeded.
   */
  succeeded: boolean;

  /**
   * Optional message providing additional information
   * about the validation result, typically included on failures.
   */
  message?: string;
}
