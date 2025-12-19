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
