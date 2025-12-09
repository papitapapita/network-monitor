import { ValueObject, Result, Guard } from '../';

/**
 * RetryPolicy Value Object
 *
 * Encapsulates retry logic for failed polling operations.
 * Defines how many times to retry, with what delay, and using which backoff strategy.
 *
 * Supports three backoff strategies:
 * - FIXED: Always use the same delay
 * - LINEAR: Increase delay linearly (delay * attemptNumber)
 * - EXPONENTIAL: Increase delay exponentially (delay * 2^attemptNumber)
 *
 * @example
 * const policy = RetryPolicy.create({
 *   maxAttempts: 3,
 *   baseDelayMs: 1000,
 *   backoffStrategy: BackoffStrategy.EXPONENTIAL
 * });
 */

export enum BackoffStrategy {
  /**
   * Use the same delay for all retries
   */
  FIXED = 'FIXED',

  /**
   * Increase delay linearly: baseDelay * attemptNumber
   */
  LINEAR = 'LINEAR',

  /**
   * Increase delay exponentially: baseDelay * 2^attemptNumber
   */
  EXPONENTIAL = 'EXPONENTIAL'
}

interface RetryPolicyProps {
  maxAttempts: number; // 0-10, where 0 means no retries
  baseDelayMs: number; // 100-60000ms (100ms to 1 minute)
  backoffStrategy: BackoffStrategy;
}

export class RetryPolicy extends ValueObject<RetryPolicyProps> {
  public static readonly MIN_ATTEMPTS = 0;
  public static readonly MAX_ATTEMPTS = 10;
  public static readonly MIN_DELAY_MS = 100;
  public static readonly MAX_DELAY_MS = 60000; // 1 minute
  public static readonly MAX_CALCULATED_DELAY_MS = 300000; // 5 minutes

  get maxAttempts(): number {
    return this.props.maxAttempts;
  }

  get baseDelayMs(): number {
    return this.props.baseDelayMs;
  }

  get backoffStrategy(): BackoffStrategy {
    return this.props.backoffStrategy;
  }

  private constructor(props: RetryPolicyProps) {
    super(props);
  }

  /**
   * Creates a new RetryPolicy.
   *
   * @param props - Retry policy configuration
   * @returns Result containing RetryPolicy or error message
   */
  public static create(props: {
    maxAttempts: number;
    baseDelayMs: number;
    backoffStrategy: BackoffStrategy;
  }): Result<RetryPolicy> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(props.maxAttempts, 'maxAttempts'),
      Guard.againstNullOrUndefined(props.baseDelayMs, 'baseDelayMs'),
      Guard.againstNullOrUndefined(
        props.backoffStrategy,
        'backoffStrategy'
      ),
      Guard.isNumber(props.maxAttempts, 'maxAttempts'),
      Guard.isNumber(props.baseDelayMs, 'baseDelayMs'),
      Guard.inRange(
        props.maxAttempts,
        this.MIN_ATTEMPTS,
        this.MAX_ATTEMPTS,
        'maxAttempts'
      ),
      Guard.inRange(
        props.baseDelayMs,
        this.MIN_DELAY_MS,
        this.MAX_DELAY_MS,
        'baseDelayMs'
      )
    ]);

    if (!guardResult.succeeded) {
      return Result.fail<RetryPolicy>(guardResult.message!);
    }

    if (
      !Object.values(BackoffStrategy).includes(props.backoffStrategy)
    ) {
      return Result.fail<RetryPolicy>(
        `Invalid backoff strategy: ${props.backoffStrategy}`
      );
    }

    return Result.ok<RetryPolicy>(
      new RetryPolicy({
        maxAttempts: Math.round(props.maxAttempts),
        baseDelayMs: Math.round(props.baseDelayMs),
        backoffStrategy: props.backoffStrategy
      })
    );
  }

  /**
   * Creates a default retry policy with conservative settings.
   * 3 attempts, 1 second base delay, exponential backoff.
   *
   * @returns RetryPolicy with default settings
   */
  public static createDefault(): RetryPolicy {
    const result = this.create({
      maxAttempts: 3,
      baseDelayMs: 1000,
      backoffStrategy: BackoffStrategy.EXPONENTIAL
    });

    // This should never fail with hardcoded valid values
    if (!result.isSuccess) {
      throw new Error('Failed to create default RetryPolicy');
    }

    return result.value;
  }

  /**
   * Creates a retry policy with no retries (immediate failure).
   *
   * @returns RetryPolicy with 0 attempts
   */
  public static noRetry(): RetryPolicy {
    const result = this.create({
      maxAttempts: 0,
      baseDelayMs: 1000,
      backoffStrategy: BackoffStrategy.FIXED
    });

    if (!result.isSuccess) {
      throw new Error('Failed to create no-retry RetryPolicy');
    }

    return result.value;
  }

  /**
   * Calculates the delay in milliseconds for a specific retry attempt.
   *
   * @param attemptNumber - Which attempt this is (1-based: 1, 2, 3...)
   * @returns Delay in milliseconds before this attempt
   */
  public calculateDelay(attemptNumber: number): number {
    if (attemptNumber <= 0) {
      return 0;
    }

    let delay: number;

    switch (this.props.backoffStrategy) {
      case BackoffStrategy.FIXED:
        delay = this.props.baseDelayMs;
        break;

      case BackoffStrategy.LINEAR:
        delay = this.props.baseDelayMs * attemptNumber;
        break;

      case BackoffStrategy.EXPONENTIAL:
        delay =
          this.props.baseDelayMs * Math.pow(2, attemptNumber - 1);
        break;

      default:
        delay = this.props.baseDelayMs;
    }

    // Cap the maximum delay to prevent excessive wait times
    return Math.min(delay, RetryPolicy.MAX_CALCULATED_DELAY_MS);
  }

  /**
   * Checks if retries are enabled.
   *
   * @returns True if maxAttempts > 0
   */
  public hasRetries(): boolean {
    return this.props.maxAttempts > 0;
  }

  /**
   * Checks if a specific attempt number should be retried.
   *
   * @param attemptNumber - Current attempt number (0-based: 0, 1, 2...)
   * @returns True if should retry, false if max attempts reached
   */
  public shouldRetry(attemptNumber: number): boolean {
    return attemptNumber < this.props.maxAttempts;
  }

  /**
   * Returns a human-readable description of the policy.
   */
  public toDisplayString(): string {
    if (this.props.maxAttempts === 0) {
      return 'No retries';
    }

    const attemptsText = `${this.props.maxAttempts} attempt${
      this.props.maxAttempts !== 1 ? 's' : ''
    }`;
    const delayText = `${this.props.baseDelayMs}ms base delay`;
    const strategyText = this.props.backoffStrategy.toLowerCase();

    return `${attemptsText}, ${delayText}, ${strategyText} backoff`;
  }
}
