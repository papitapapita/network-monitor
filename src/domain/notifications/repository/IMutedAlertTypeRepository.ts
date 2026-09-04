import { Result } from 'domain/shared/core';
import { MutedAlertType } from '../entities';

export interface IMutedAlertTypeRepository {
  listAll(): Promise<Result<MutedAlertType[]>>;
  isMuted(metric: string): Promise<Result<boolean>>;
  // Wholesale replace — the whole list is small and edited as a set, not
  // grown one row at a time (see NotificationPolicyController's bulk
  // endpoints for the same shape of decision).
  replaceAll(metrics: string[]): Promise<Result<MutedAlertType[]>>;
}
