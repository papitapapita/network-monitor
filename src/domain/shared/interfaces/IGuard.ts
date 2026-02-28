/**
 * Interface for guard results and arguments.
 */
export interface IGuardResult {
  succeeded: boolean;
  message?: string;
}

/**
 * Interface for guard arguments, representing a value and its name for validation purposes.
 */
export interface IGuardArgument {
  argument: unknown;
  argumentName: string;
}

/**
 * Type representing a collection of guard arguments, used for batch validation.
 */
export type GuardArgumentCollection = IGuardArgument[];
