import { Result } from 'domain/shared/core';
import { NotificationSettings } from '../value-objects';

export interface INotificationSettingsRepository {
  // Always answers: the saved settings, or the install's defaults when the
  // administrator has never saved any (NOT-201).
  get(): Promise<Result<NotificationSettings>>;
  save(settings: NotificationSettings): Promise<Result<void>>;
}
