import { Result } from 'domain/shared/core';
import { BillingSettings } from '../value-objects';

export interface IBillingSettingsRepository {
  // Always answers: the saved settings, or the defaults when the
  // administrator has never saved any (BIL-281).
  get(): Promise<Result<BillingSettings>>;
  save(settings: BillingSettings): Promise<Result<void>>;
}
