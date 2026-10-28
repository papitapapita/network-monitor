import { Result } from 'domain/shared/core';
import { RouterHealthThresholds } from '../value-objects';

export interface IRouterHealthThresholdsRepository {
  // Always answers: the saved thresholds, or the defaults when none were
  // ever saved (MON-172).
  get(): Promise<Result<RouterHealthThresholds>>;
  save(thresholds: RouterHealthThresholds): Promise<Result<void>>;
}
