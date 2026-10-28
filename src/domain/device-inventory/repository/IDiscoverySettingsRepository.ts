import { Result } from 'domain/shared/core';
import { DiscoverySettings } from '../value-objects';

export interface IDiscoverySettingsRepository {
  // Always answers: the saved settings, or the defaults when the
  // administrator has never saved any (DEV-210).
  get(): Promise<Result<DiscoverySettings>>;
  save(settings: DiscoverySettings): Promise<Result<void>>;
  // When the last scheduled run started; null before the first (DEV-211).
  lastRunAt(): Promise<Result<Date | null>>;
  recordRun(startedAt: Date): Promise<Result<void>>;
}
