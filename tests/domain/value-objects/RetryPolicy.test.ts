import {
  RetryPolicy,
  BackoffStrategy
} from '../../../src/domain/value-objects/RetryPolicy';

describe('RetryPolicy Value Object', () => {
  // -----------------------------------------------------
  // CREATE METHOD - VALIDATION
  // -----------------------------------------------------
  describe('create()', () => {
    it('should create successfully with valid props', () => {
      const result = RetryPolicy.create({
        maxAttempts: 3,
        baseDelayMs: 1000,
        backoffStrategy: BackoffStrategy.FIXED
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value.maxAttempts).toBe(3);
      expect(result.value.baseDelayMs).toBe(1000);
      expect(result.value.backoffStrategy).toBe(
        BackoffStrategy.FIXED
      );
    });

    it('should fail if maxAttempts is out of range', () => {
      const result = RetryPolicy.create({
        maxAttempts: 20,
        baseDelayMs: 1000,
        backoffStrategy: BackoffStrategy.FIXED
      });

      expect(result.isSuccess).toBe(false);
      expect(result.error).toContain('maxAttempts');
    });

    it('should fail if baseDelayMs is below min', () => {
      const result = RetryPolicy.create({
        maxAttempts: 2,
        baseDelayMs: 50,
        backoffStrategy: BackoffStrategy.LINEAR
      });

      expect(result.isSuccess).toBe(false);
      expect(result.error).toContain('baseDelayMs');
    });

    it('should fail for invalid backoff strategy', () => {
      const result = RetryPolicy.create({
        maxAttempts: 2,
        baseDelayMs: 1000,
        // @ts-expect-error intentionally invalid for test
        backoffStrategy: 'RANDOM'
      });

      expect(result.isSuccess).toBe(false);
      expect(result.error).toContain('Invalid backoff strategy');
    });
  });

  // -----------------------------------------------------
  // FACTORIES
  // -----------------------------------------------------
  describe('factory methods', () => {
    it('createDefault() should return correct default policy', () => {
      const policy = RetryPolicy.createDefault();
      expect(policy.maxAttempts).toBe(3);
      expect(policy.baseDelayMs).toBe(1000);
      expect(policy.backoffStrategy).toBe(
        BackoffStrategy.EXPONENTIAL
      );
    });

    it('noRetry() should return a policy with 0 attempts', () => {
      const policy = RetryPolicy.noRetry();
      expect(policy.maxAttempts).toBe(0);
      expect(policy.hasRetries()).toBe(false);
    });
  });

  // -----------------------------------------------------
  // CALCULATE DELAY
  // -----------------------------------------------------
  describe('calculateDelay()', () => {
    it('should return 0 when attempt number <= 0', () => {
      const policy = RetryPolicy.createDefault();
      expect(policy.calculateDelay(0)).toBe(0);
      expect(policy.calculateDelay(-1)).toBe(0);
    });

    it('FIXED strategy should always return same delay', () => {
      const policy = RetryPolicy.create({
        maxAttempts: 3,
        baseDelayMs: 1000,
        backoffStrategy: BackoffStrategy.FIXED
      }).value;

      expect(policy.calculateDelay(1)).toBe(1000);
      expect(policy.calculateDelay(5)).toBe(1000);
    });

    it('LINEAR strategy should multiply delay by attempt number', () => {
      const policy = RetryPolicy.create({
        maxAttempts: 3,
        baseDelayMs: 1000,
        backoffStrategy: BackoffStrategy.LINEAR
      }).value;

      expect(policy.calculateDelay(1)).toBe(1000);
      expect(policy.calculateDelay(3)).toBe(3000);
    });

    it('EXPONENTIAL strategy should double each attempt', () => {
      const policy = RetryPolicy.create({
        maxAttempts: 3,
        baseDelayMs: 1000,
        backoffStrategy: BackoffStrategy.EXPONENTIAL
      }).value;

      expect(policy.calculateDelay(1)).toBe(1000);
      expect(policy.calculateDelay(2)).toBe(2000);
      expect(policy.calculateDelay(3)).toBe(4000);
    });

    it('should cap delay at MAX_CALCULATED_DELAY_MS', () => {
      const policy = RetryPolicy.create({
        maxAttempts: 5,
        baseDelayMs: 60000,
        backoffStrategy: BackoffStrategy.EXPONENTIAL
      }).value;

      // Exponential would be 60k * 2^4 = 960k -> should cap to 300,000
      expect(policy.calculateDelay(5)).toBe(
        RetryPolicy.MAX_CALCULATED_DELAY_MS
      );
    });
  });

  // -----------------------------------------------------
  // BOOLEAN HELPERS
  // -----------------------------------------------------
  describe('retry checks', () => {
    it('hasRetries() should reflect maxAttempts', () => {
      const retryPolicy = RetryPolicy.createDefault();
      const noRetryPolicy = RetryPolicy.noRetry();

      expect(retryPolicy.hasRetries()).toBe(true);
      expect(noRetryPolicy.hasRetries()).toBe(false);
    });

    it('shouldRetry() should return false when attempts exceeded', () => {
      const policy = RetryPolicy.create({
        maxAttempts: 2,
        baseDelayMs: 1000,
        backoffStrategy: BackoffStrategy.FIXED
      }).value;

      expect(policy.shouldRetry(0)).toBe(true);
      expect(policy.shouldRetry(1)).toBe(true);
      expect(policy.shouldRetry(2)).toBe(false);
      expect(policy.shouldRetry(3)).toBe(false);
    });
  });

  // -----------------------------------------------------
  // DISPLAY STRING
  // -----------------------------------------------------
  describe('toDisplayString()', () => {
    it('should return formatted description', () => {
      const policy = RetryPolicy.create({
        maxAttempts: 3,
        baseDelayMs: 1500,
        backoffStrategy: BackoffStrategy.LINEAR
      }).value;

      expect(policy.toDisplayString()).toBe(
        '3 attempts, 1500ms base delay, linear backoff'
      );
    });

    it('should return "No retries" when maxAttempts is 0', () => {
      const policy = RetryPolicy.noRetry();
      expect(policy.toDisplayString()).toBe('No retries');
    });
  });
});
