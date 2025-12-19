import { RetryPolicy, BackoffStrategy } from '../../../src/domain';

describe('RetryPolicy', () => {
  describe('create', () => {
    describe('when valid props', () => {
      it('should create RetryPolicy with FIXED backoff', () => {
        const result = RetryPolicy.create({
          maxAttempts: 3,
          baseDelayMs: 1000,
          backoffStrategy: BackoffStrategy.FIXED
        });

        expect(result.isSuccess).toBe(true);
        expect(result.value.maxAttempts).toBe(3);
        expect(result.value.baseDelayMs).toBe(1000);
        expect(result.value.backoffStrategy).toBe(BackoffStrategy.FIXED);
      });

      it('should create RetryPolicy with LINEAR backoff', () => {
        const result = RetryPolicy.create({
          maxAttempts: 5,
          baseDelayMs: 2000,
          backoffStrategy: BackoffStrategy.LINEAR
        });

        expect(result.isSuccess).toBe(true);
        expect(result.value.backoffStrategy).toBe(BackoffStrategy.LINEAR);
      });

      it('should create RetryPolicy with EXPONENTIAL backoff', () => {
        const result = RetryPolicy.create({
          maxAttempts: 4,
          baseDelayMs: 500,
          backoffStrategy: BackoffStrategy.EXPONENTIAL
        });

        expect(result.isSuccess).toBe(true);
        expect(result.value.backoffStrategy).toBe(
          BackoffStrategy.EXPONENTIAL
        );
      });

      it('should create RetryPolicy with minimum attempts (0)', () => {
        const result = RetryPolicy.create({
          maxAttempts: 0,
          baseDelayMs: 1000,
          backoffStrategy: BackoffStrategy.FIXED
        });

        expect(result.isSuccess).toBe(true);
        expect(result.value.maxAttempts).toBe(0);
      });

      it('should create RetryPolicy with maximum attempts (10)', () => {
        const result = RetryPolicy.create({
          maxAttempts: 10,
          baseDelayMs: 1000,
          backoffStrategy: BackoffStrategy.FIXED
        });

        expect(result.isSuccess).toBe(true);
        expect(result.value.maxAttempts).toBe(10);
      });

      it('should create RetryPolicy with minimum delay (100ms)', () => {
        const result = RetryPolicy.create({
          maxAttempts: 3,
          baseDelayMs: 100,
          backoffStrategy: BackoffStrategy.FIXED
        });

        expect(result.isSuccess).toBe(true);
        expect(result.value.baseDelayMs).toBe(100);
      });

      it('should create RetryPolicy with maximum delay (60000ms)', () => {
        const result = RetryPolicy.create({
          maxAttempts: 3,
          baseDelayMs: 60000,
          backoffStrategy: BackoffStrategy.FIXED
        });

        expect(result.isSuccess).toBe(true);
        expect(result.value.baseDelayMs).toBe(60000);
      });

      it('should round decimal maxAttempts', () => {
        const result = RetryPolicy.create({
          maxAttempts: 3.7,
          baseDelayMs: 1000,
          backoffStrategy: BackoffStrategy.FIXED
        });

        expect(result.isSuccess).toBe(true);
        expect(result.value.maxAttempts).toBe(4);
      });

      it('should round decimal baseDelayMs', () => {
        const result = RetryPolicy.create({
          maxAttempts: 3,
          baseDelayMs: 1500.6,
          backoffStrategy: BackoffStrategy.FIXED
        });

        expect(result.isSuccess).toBe(true);
        expect(result.value.baseDelayMs).toBe(1501);
      });
    });

    describe('when invalid maxAttempts', () => {
      it('should fail for null maxAttempts', () => {
        const result = RetryPolicy.create({
          maxAttempts: null as any,
          baseDelayMs: 1000,
          backoffStrategy: BackoffStrategy.FIXED
        });

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('maxAttempts');
      });

      it('should fail for undefined maxAttempts', () => {
        const result = RetryPolicy.create({
          maxAttempts: undefined as any,
          baseDelayMs: 1000,
          backoffStrategy: BackoffStrategy.FIXED
        });

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('maxAttempts');
      });

      it('should fail for non-number maxAttempts', () => {
        const result = RetryPolicy.create({
          maxAttempts: '3' as any,
          baseDelayMs: 1000,
          backoffStrategy: BackoffStrategy.FIXED
        });

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('maxAttempts');
      });

      it('should fail for negative maxAttempts', () => {
        const result = RetryPolicy.create({
          maxAttempts: -1,
          baseDelayMs: 1000,
          backoffStrategy: BackoffStrategy.FIXED
        });

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('maxAttempts');
      });

      it('should fail for maxAttempts exceeding maximum (10)', () => {
        const result = RetryPolicy.create({
          maxAttempts: 11,
          baseDelayMs: 1000,
          backoffStrategy: BackoffStrategy.FIXED
        });

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('maxAttempts');
      });

      it('should fail for very large maxAttempts', () => {
        const result = RetryPolicy.create({
          maxAttempts: 20,
          baseDelayMs: 1000,
          backoffStrategy: BackoffStrategy.FIXED
        });

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('maxAttempts');
      });
    });

    describe('when invalid baseDelayMs', () => {
      it('should fail for null baseDelayMs', () => {
        const result = RetryPolicy.create({
          maxAttempts: 3,
          baseDelayMs: null as any,
          backoffStrategy: BackoffStrategy.FIXED
        });

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('baseDelayMs');
      });

      it('should fail for undefined baseDelayMs', () => {
        const result = RetryPolicy.create({
          maxAttempts: 3,
          baseDelayMs: undefined as any,
          backoffStrategy: BackoffStrategy.FIXED
        });

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('baseDelayMs');
      });

      it('should fail for non-number baseDelayMs', () => {
        const result = RetryPolicy.create({
          maxAttempts: 3,
          baseDelayMs: '1000' as any,
          backoffStrategy: BackoffStrategy.FIXED
        });

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('baseDelayMs');
      });

      it('should fail for baseDelayMs below minimum (100ms)', () => {
        const result = RetryPolicy.create({
          maxAttempts: 3,
          baseDelayMs: 99,
          backoffStrategy: BackoffStrategy.FIXED
        });

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('baseDelayMs');
      });

      it('should fail for baseDelayMs exceeding maximum (60000ms)', () => {
        const result = RetryPolicy.create({
          maxAttempts: 3,
          baseDelayMs: 60001,
          backoffStrategy: BackoffStrategy.FIXED
        });

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('baseDelayMs');
      });

      it('should fail for negative baseDelayMs', () => {
        const result = RetryPolicy.create({
          maxAttempts: 3,
          baseDelayMs: -100,
          backoffStrategy: BackoffStrategy.FIXED
        });

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('baseDelayMs');
      });

      it('should fail for very small baseDelayMs', () => {
        const result = RetryPolicy.create({
          maxAttempts: 3,
          baseDelayMs: 50,
          backoffStrategy: BackoffStrategy.FIXED
        });

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('baseDelayMs');
      });
    });

    describe('when invalid backoffStrategy', () => {
      it('should fail for null backoffStrategy', () => {
        const result = RetryPolicy.create({
          maxAttempts: 3,
          baseDelayMs: 1000,
          backoffStrategy: null as any
        });

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('backoffStrategy');
      });

      it('should fail for undefined backoffStrategy', () => {
        const result = RetryPolicy.create({
          maxAttempts: 3,
          baseDelayMs: 1000,
          backoffStrategy: undefined as any
        });

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('backoffStrategy');
      });

      it('should fail for invalid backoffStrategy string', () => {
        const result = RetryPolicy.create({
          maxAttempts: 3,
          baseDelayMs: 1000,
          backoffStrategy: 'RANDOM' as any
        });

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Invalid backoff strategy');
      });

      it('should fail for invalid backoffStrategy value', () => {
        const result = RetryPolicy.create({
          maxAttempts: 3,
          baseDelayMs: 1000,
          backoffStrategy: 'CUSTOM_BACKOFF' as any
        });

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Invalid backoff strategy');
      });
    });
  });

  describe('createDefault', () => {
    it('should create default RetryPolicy', () => {
      const policy = RetryPolicy.createDefault();

      expect(policy.maxAttempts).toBe(3);
      expect(policy.baseDelayMs).toBe(1000);
      expect(policy.backoffStrategy).toBe(BackoffStrategy.EXPONENTIAL);
    });

    it('should create policy that has retries', () => {
      const policy = RetryPolicy.createDefault();

      expect(policy.hasRetries()).toBe(true);
    });
  });

  describe('noRetry', () => {
    it('should create RetryPolicy with 0 attempts', () => {
      const policy = RetryPolicy.noRetry();

      expect(policy.maxAttempts).toBe(0);
      expect(policy.baseDelayMs).toBe(1000);
      expect(policy.backoffStrategy).toBe(BackoffStrategy.FIXED);
    });

    it('should create policy that has no retries', () => {
      const policy = RetryPolicy.noRetry();

      expect(policy.hasRetries()).toBe(false);
    });

    it('should not allow retries', () => {
      const policy = RetryPolicy.noRetry();

      expect(policy.shouldRetry(0)).toBe(false);
      expect(policy.shouldRetry(1)).toBe(false);
    });
  });

  describe('calculateDelay', () => {
    describe('when FIXED backoff strategy', () => {
      it('should return same delay for all attempts', () => {
        const policy = RetryPolicy.create({
          maxAttempts: 5,
          baseDelayMs: 1000,
          backoffStrategy: BackoffStrategy.FIXED
        }).value;

        expect(policy.calculateDelay(1)).toBe(1000);
        expect(policy.calculateDelay(2)).toBe(1000);
        expect(policy.calculateDelay(3)).toBe(1000);
        expect(policy.calculateDelay(5)).toBe(1000);
      });

      it('should return base delay regardless of attempt number', () => {
        const policy = RetryPolicy.create({
          maxAttempts: 3,
          baseDelayMs: 2500,
          backoffStrategy: BackoffStrategy.FIXED
        }).value;

        expect(policy.calculateDelay(1)).toBe(2500);
        expect(policy.calculateDelay(10)).toBe(2500);
      });
    });

    describe('when LINEAR backoff strategy', () => {
      it('should multiply delay by attempt number', () => {
        const policy = RetryPolicy.create({
          maxAttempts: 5,
          baseDelayMs: 1000,
          backoffStrategy: BackoffStrategy.LINEAR
        }).value;

        expect(policy.calculateDelay(1)).toBe(1000);
        expect(policy.calculateDelay(2)).toBe(2000);
        expect(policy.calculateDelay(3)).toBe(3000);
        expect(policy.calculateDelay(4)).toBe(4000);
        expect(policy.calculateDelay(5)).toBe(5000);
      });

      it('should calculate linear delay for different base delay', () => {
        const policy = RetryPolicy.create({
          maxAttempts: 3,
          baseDelayMs: 500,
          backoffStrategy: BackoffStrategy.LINEAR
        }).value;

        expect(policy.calculateDelay(1)).toBe(500);
        expect(policy.calculateDelay(2)).toBe(1000);
        expect(policy.calculateDelay(3)).toBe(1500);
      });
    });

    describe('when EXPONENTIAL backoff strategy', () => {
      it('should double delay each attempt', () => {
        const policy = RetryPolicy.create({
          maxAttempts: 5,
          baseDelayMs: 1000,
          backoffStrategy: BackoffStrategy.EXPONENTIAL
        }).value;

        expect(policy.calculateDelay(1)).toBe(1000); // 1000 * 2^0
        expect(policy.calculateDelay(2)).toBe(2000); // 1000 * 2^1
        expect(policy.calculateDelay(3)).toBe(4000); // 1000 * 2^2
        expect(policy.calculateDelay(4)).toBe(8000); // 1000 * 2^3
        expect(policy.calculateDelay(5)).toBe(16000); // 1000 * 2^4
      });

      it('should calculate exponential delay for different base delay', () => {
        const policy = RetryPolicy.create({
          maxAttempts: 4,
          baseDelayMs: 500,
          backoffStrategy: BackoffStrategy.EXPONENTIAL
        }).value;

        expect(policy.calculateDelay(1)).toBe(500); // 500 * 2^0
        expect(policy.calculateDelay(2)).toBe(1000); // 500 * 2^1
        expect(policy.calculateDelay(3)).toBe(2000); // 500 * 2^2
        expect(policy.calculateDelay(4)).toBe(4000); // 500 * 2^3
      });

      it('should cap delay at MAX_CALCULATED_DELAY_MS (300000ms)', () => {
        const policy = RetryPolicy.create({
          maxAttempts: 10,
          baseDelayMs: 60000,
          backoffStrategy: BackoffStrategy.EXPONENTIAL
        }).value;

        // 60000 * 2^4 = 960000 -> should cap to 300000
        const delay = policy.calculateDelay(5);
        expect(delay).toBe(RetryPolicy.MAX_CALCULATED_DELAY_MS);
        expect(delay).toBe(300000);
      });

      it('should cap very large exponential delays', () => {
        const policy = RetryPolicy.create({
          maxAttempts: 10,
          baseDelayMs: 10000,
          backoffStrategy: BackoffStrategy.EXPONENTIAL
        }).value;

        // Check that delay doesn't exceed cap for high attempts
        const delay6 = policy.calculateDelay(6);
        const delay7 = policy.calculateDelay(7);
        const delay10 = policy.calculateDelay(10);

        expect(delay6).toBeLessThanOrEqual(300000);
        expect(delay7).toBeLessThanOrEqual(300000);
        expect(delay10).toBeLessThanOrEqual(300000);
      });
    });

    describe('when edge cases', () => {
      it('should return 0 for attempt number 0', () => {
        const policy = RetryPolicy.createDefault();

        expect(policy.calculateDelay(0)).toBe(0);
      });

      it('should return 0 for negative attempt number', () => {
        const policy = RetryPolicy.createDefault();

        expect(policy.calculateDelay(-1)).toBe(0);
        expect(policy.calculateDelay(-5)).toBe(0);
      });

      it('should handle very large attempt numbers', () => {
        const policy = RetryPolicy.create({
          maxAttempts: 3,
          baseDelayMs: 1000,
          backoffStrategy: BackoffStrategy.EXPONENTIAL
        }).value;

        const delay = policy.calculateDelay(100);
        expect(delay).toBe(RetryPolicy.MAX_CALCULATED_DELAY_MS);
      });
    });
  });

  describe('hasRetries', () => {
    it('should return true when maxAttempts > 0', () => {
      const policy = RetryPolicy.create({
        maxAttempts: 1,
        baseDelayMs: 1000,
        backoffStrategy: BackoffStrategy.FIXED
      }).value;

      expect(policy.hasRetries()).toBe(true);
    });

    it('should return true for default policy', () => {
      const policy = RetryPolicy.createDefault();

      expect(policy.hasRetries()).toBe(true);
    });

    it('should return false when maxAttempts is 0', () => {
      const policy = RetryPolicy.create({
        maxAttempts: 0,
        baseDelayMs: 1000,
        backoffStrategy: BackoffStrategy.FIXED
      }).value;

      expect(policy.hasRetries()).toBe(false);
    });

    it('should return false for noRetry policy', () => {
      const policy = RetryPolicy.noRetry();

      expect(policy.hasRetries()).toBe(false);
    });
  });

  describe('shouldRetry', () => {
    it('should return true when attempts are below max', () => {
      const policy = RetryPolicy.create({
        maxAttempts: 3,
        baseDelayMs: 1000,
        backoffStrategy: BackoffStrategy.FIXED
      }).value;

      expect(policy.shouldRetry(0)).toBe(true);
      expect(policy.shouldRetry(1)).toBe(true);
      expect(policy.shouldRetry(2)).toBe(true);
    });

    it('should return false when attempts reach max', () => {
      const policy = RetryPolicy.create({
        maxAttempts: 3,
        baseDelayMs: 1000,
        backoffStrategy: BackoffStrategy.FIXED
      }).value;

      expect(policy.shouldRetry(3)).toBe(false);
    });

    it('should return false when attempts exceed max', () => {
      const policy = RetryPolicy.create({
        maxAttempts: 3,
        baseDelayMs: 1000,
        backoffStrategy: BackoffStrategy.FIXED
      }).value;

      expect(policy.shouldRetry(4)).toBe(false);
      expect(policy.shouldRetry(10)).toBe(false);
    });

    it('should return false for all attempts when maxAttempts is 0', () => {
      const policy = RetryPolicy.noRetry();

      expect(policy.shouldRetry(0)).toBe(false);
      expect(policy.shouldRetry(1)).toBe(false);
      expect(policy.shouldRetry(5)).toBe(false);
    });

    it('should handle boundary case for maxAttempts of 1', () => {
      const policy = RetryPolicy.create({
        maxAttempts: 1,
        baseDelayMs: 1000,
        backoffStrategy: BackoffStrategy.FIXED
      }).value;

      expect(policy.shouldRetry(0)).toBe(true);
      expect(policy.shouldRetry(1)).toBe(false);
    });
  });

  describe('toDisplayString', () => {
    it('should display "No retries" when maxAttempts is 0', () => {
      const policy = RetryPolicy.noRetry();

      expect(policy.toDisplayString()).toBe('No retries');
    });

    it('should display policy with singular attempt', () => {
      const policy = RetryPolicy.create({
        maxAttempts: 1,
        baseDelayMs: 500,
        backoffStrategy: BackoffStrategy.FIXED
      }).value;

      expect(policy.toDisplayString()).toBe(
        '1 attempt, 500ms base delay, fixed backoff'
      );
    });

    it('should display policy with plural attempts', () => {
      const policy = RetryPolicy.create({
        maxAttempts: 3,
        baseDelayMs: 1500,
        backoffStrategy: BackoffStrategy.LINEAR
      }).value;

      expect(policy.toDisplayString()).toBe(
        '3 attempts, 1500ms base delay, linear backoff'
      );
    });

    it('should display FIXED backoff correctly', () => {
      const policy = RetryPolicy.create({
        maxAttempts: 2,
        baseDelayMs: 1000,
        backoffStrategy: BackoffStrategy.FIXED
      }).value;

      expect(policy.toDisplayString()).toContain('fixed backoff');
    });

    it('should display LINEAR backoff correctly', () => {
      const policy = RetryPolicy.create({
        maxAttempts: 2,
        baseDelayMs: 1000,
        backoffStrategy: BackoffStrategy.LINEAR
      }).value;

      expect(policy.toDisplayString()).toContain('linear backoff');
    });

    it('should display EXPONENTIAL backoff correctly', () => {
      const policy = RetryPolicy.createDefault();

      expect(policy.toDisplayString()).toContain('exponential backoff');
    });

    it('should display all components for default policy', () => {
      const policy = RetryPolicy.createDefault();

      const display = policy.toDisplayString();
      expect(display).toContain('3 attempts');
      expect(display).toContain('1000ms base delay');
      expect(display).toContain('exponential backoff');
    });
  });

  describe('getters', () => {
    it('should have correct maxAttempts getter', () => {
      const policy = RetryPolicy.create({
        maxAttempts: 5,
        baseDelayMs: 1000,
        backoffStrategy: BackoffStrategy.FIXED
      }).value;

      expect(policy.maxAttempts).toBe(5);
    });

    it('should have correct baseDelayMs getter', () => {
      const policy = RetryPolicy.create({
        maxAttempts: 3,
        baseDelayMs: 2500,
        backoffStrategy: BackoffStrategy.FIXED
      }).value;

      expect(policy.baseDelayMs).toBe(2500);
    });

    it('should have correct backoffStrategy getter', () => {
      const policy = RetryPolicy.create({
        maxAttempts: 3,
        baseDelayMs: 1000,
        backoffStrategy: BackoffStrategy.LINEAR
      }).value;

      expect(policy.backoffStrategy).toBe(BackoffStrategy.LINEAR);
    });
  });

  describe('equals', () => {
    it('should return true for same policy values', () => {
      const policy1 = RetryPolicy.create({
        maxAttempts: 3,
        baseDelayMs: 1000,
        backoffStrategy: BackoffStrategy.FIXED
      }).value;

      const policy2 = RetryPolicy.create({
        maxAttempts: 3,
        baseDelayMs: 1000,
        backoffStrategy: BackoffStrategy.FIXED
      }).value;

      expect(policy1.equals(policy2)).toBe(true);
    });

    it('should return true for two default policies', () => {
      const policy1 = RetryPolicy.createDefault();
      const policy2 = RetryPolicy.createDefault();

      expect(policy1.equals(policy2)).toBe(true);
    });

    it('should return false for different maxAttempts', () => {
      const policy1 = RetryPolicy.create({
        maxAttempts: 3,
        baseDelayMs: 1000,
        backoffStrategy: BackoffStrategy.FIXED
      }).value;

      const policy2 = RetryPolicy.create({
        maxAttempts: 5,
        baseDelayMs: 1000,
        backoffStrategy: BackoffStrategy.FIXED
      }).value;

      expect(policy1.equals(policy2)).toBe(false);
    });

    it('should return false for different baseDelayMs', () => {
      const policy1 = RetryPolicy.create({
        maxAttempts: 3,
        baseDelayMs: 1000,
        backoffStrategy: BackoffStrategy.FIXED
      }).value;

      const policy2 = RetryPolicy.create({
        maxAttempts: 3,
        baseDelayMs: 2000,
        backoffStrategy: BackoffStrategy.FIXED
      }).value;

      expect(policy1.equals(policy2)).toBe(false);
    });

    it('should return false for different backoffStrategy', () => {
      const policy1 = RetryPolicy.create({
        maxAttempts: 3,
        baseDelayMs: 1000,
        backoffStrategy: BackoffStrategy.FIXED
      }).value;

      const policy2 = RetryPolicy.create({
        maxAttempts: 3,
        baseDelayMs: 1000,
        backoffStrategy: BackoffStrategy.LINEAR
      }).value;

      expect(policy1.equals(policy2)).toBe(false);
    });

    it('should return false for null', () => {
      const policy = RetryPolicy.createDefault();

      expect(policy.equals(null as any)).toBe(false);
    });

    it('should return false for undefined', () => {
      const policy = RetryPolicy.createDefault();

      expect(policy.equals(undefined as any)).toBe(false);
    });
  });

  describe('immutability', () => {
    it('should not allow mutation of props', () => {
      const policy = RetryPolicy.createDefault();

      expect(() => {
        // @ts-expect-error - Testing immutability
        policy.props.maxAttempts = 10;
      }).toThrow();
    });

    it('should not allow reassignment of props reference', () => {
      const policy = RetryPolicy.createDefault();

      // TypeScript prevents this at compile time
      // @ts-expect-error - props is readonly
      policy.props = {
        maxAttempts: 5,
        baseDelayMs: 2000,
        backoffStrategy: BackoffStrategy.LINEAR
      };
    });
  });
});
