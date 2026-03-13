import { BackoffStrategy } from '../../device-inventory';

export interface RetryPolicyProps {
  maxAttempts: number; // 0-10, where 0 means no retries
  baseDelayMs: number; // 100-60000ms (100ms to 1 minute)
  backoffStrategy: BackoffStrategy;
}
