import {
  ValueObject,
  Result,
  Guard,
  RetryPolicyProps,
  BackoffStrategy
} from '../';

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
 * Business Rules:
 * - maxAttempts, baseDelayMs, and backoffStrategy cannot be null or undefined
 * - maxAttempts must be between 0 and 10
 * - baseDelayMs must be between 100ms and 60000ms (1 minute)
 * - backoffStrategy must be a valid BackoffStrategy enum value
 * - Calculated delay is capped at 300000ms (5 minutes) regardless of backoff
 * - maxAttempts of 0 means no retries (immediate failure)
 * - Values are automatically rounded to nearest integer
 *
 * @example
 * const policyResult = RetryPolicy.create({
 *   maxAttempts: 3,
 *   baseDelayMs: 1000,
 *   backoffStrategy: BackoffStrategy.EXPONENTIAL
 * });
 *
 * if (policyResult.isSuccess) {
 *   const policy = policyResult.value;
 *   console.log(policy.calculateDelay(1)); // 1000ms
 *   console.log(policy.calculateDelay(2)); // 2000ms
 *   console.log(policy.calculateDelay(3)); // 4000ms
 * }
 */
export class RetryPolicy extends ValueObject<RetryPolicyProps> {
  public static readonly MIN_ATTEMPTS = 0;
  public static readonly MAX_ATTEMPTS = 10;
  public static readonly MIN_DELAY_MS = 100;
  public static readonly MAX_DELAY_MS = 60000; // 1 minute
  public static readonly MAX_CALCULATED_DELAY_MS = 300000; // 5 minutes

  get maxAttempts(): number {
    return this._props.maxAttempts;
  }

  get baseDelayMs(): number {
    return this._props.baseDelayMs;
  }

  get backoffStrategy(): BackoffStrategy {
    return this._props.backoffStrategy;
  }

  private constructor(_props: RetryPolicyProps) {
    super(_props);
  }

  /**
   * Creates a new RetryPolicy.
   *
   * @param _props - Retry policy configuration
   * @returns Result containing RetryPolicy or error message
   */
  public static create(_props: {
    maxAttempts: number;
    baseDelayMs: number;
    backoffStrategy: BackoffStrategy;
  }): Result<RetryPolicy> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(_props.maxAttempts, 'maxAttempts'),
      Guard.againstNullOrUndefined(_props.baseDelayMs, 'baseDelayMs'),
      Guard.againstNullOrUndefined(
        _props.backoffStrategy,
        'backoffStrategy'
      ),
      Guard.isNumber(_props.maxAttempts, 'maxAttempts'),
      Guard.isNumber(_props.baseDelayMs, 'baseDelayMs'),
      Guard.inRange(
        _props.maxAttempts,
        this.MIN_ATTEMPTS,
        this.MAX_ATTEMPTS,
        'maxAttempts'
      ),
      Guard.inRange(
        _props.baseDelayMs,
        this.MIN_DELAY_MS,
        this.MAX_DELAY_MS,
        'baseDelayMs'
      )
    ]);

    if (!guardResult.succeeded) {
      return Result.fail<RetryPolicy>(guardResult.message!);
    }

    if (
      !Object.values(BackoffStrategy).includes(_props.backoffStrategy)
    ) {
      return Result.fail<RetryPolicy>(
        `Invalid backoff strategy: ${_props.backoffStrategy}`
      );
    }

    return Result.ok<RetryPolicy>(
      new RetryPolicy({
        maxAttempts: Math.round(_props.maxAttempts),
        baseDelayMs: Math.round(_props.baseDelayMs),
        backoffStrategy: _props.backoffStrategy
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

    switch (this._props.backoffStrategy) {
      case BackoffStrategy.FIXED:
        delay = this._props.baseDelayMs;
        break;

      case BackoffStrategy.LINEAR:
        delay = this._props.baseDelayMs * attemptNumber;
        break;

      case BackoffStrategy.EXPONENTIAL:
        delay =
          this._props.baseDelayMs * Math.pow(2, attemptNumber - 1);
        break;

      default:
        delay = this._props.baseDelayMs;
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
    return this._props.maxAttempts > 0;
  }

  /**
   * Checks if a specific attempt number should be retried.
   *
   * @param attemptNumber - Current attempt number (0-based: 0, 1, 2...)
   * @returns True if should retry, false if max attempts reached
   */
  public shouldRetry(attemptNumber: number): boolean {
    return attemptNumber < this._props.maxAttempts;
  }

  /**
   * Returns a human-readable description of the policy.
   */
  public toDisplayString(): string {
    if (this._props.maxAttempts === 0) {
      return 'No retries';
    }

    const attemptsText = `${this._props.maxAttempts} attempt${
      this._props.maxAttempts !== 1 ? 's' : ''
    }`;
    const delayText = `${this._props.baseDelayMs}ms base delay`;
    const strategyText = this._props.backoffStrategy.toLowerCase();

    return `${attemptsText}, ${delayText}, ${strategyText} backoff`;
  }
}
