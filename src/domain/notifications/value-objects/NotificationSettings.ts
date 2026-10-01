import { ValueObject, Result } from 'domain/shared/core';
import { isTelegramChatId } from 'domain/shared/value-objects';
import { NotificationSettingsProps } from '../props';

export const MAX_DOWN_ALERT_DELAY_MINUTES = 1440;

// The install's own notification settings (NOT-200), edited by the
// customer's administrator and replaced as a whole.
export class NotificationSettings extends ValueObject<NotificationSettingsProps> {
  get telegramChatId(): string | null {
    return this._props.telegramChatId;
  }

  get downAlertDelayMinutes(): number {
    return this._props.downAlertDelayMinutes;
  }

  get downAlertDelayMs(): number {
    return this._props.downAlertDelayMinutes * 60_000;
  }

  get wirelessAlertsEnabled(): boolean {
    return this._props.wirelessAlertsEnabled;
  }

  private constructor(props: NotificationSettingsProps) {
    super(props);
  }

  public static create(
    props: NotificationSettingsProps
  ): Result<NotificationSettings> {
    const normalized: NotificationSettingsProps = {
      ...props,
      telegramChatId: props.telegramChatId?.trim() || null
    };
    const error = NotificationSettings.validate(normalized);
    if (error) return Result.fail<NotificationSettings>(error);
    return Result.ok(new NotificationSettings(normalized));
  }

  // bypasses validation — for repository use only
  public static reconstitute(
    props: NotificationSettingsProps
  ): NotificationSettings {
    return new NotificationSettings(props);
  }

  private static validate(
    props: NotificationSettingsProps
  ): string | null {
    if (
      props.telegramChatId !== null &&
      !isTelegramChatId(props.telegramChatId)
    ) {
      return 'telegramChatId must be a numeric chat id or a @channel name';
    }
    if (
      !Number.isInteger(props.downAlertDelayMinutes) ||
      props.downAlertDelayMinutes < 0 ||
      props.downAlertDelayMinutes > MAX_DOWN_ALERT_DELAY_MINUTES
    ) {
      return `downAlertDelayMinutes must be a whole number from 0 to ${MAX_DOWN_ALERT_DELAY_MINUTES}`;
    }
    if (typeof props.wirelessAlertsEnabled !== 'boolean') {
      return 'wirelessAlertsEnabled must be true or false';
    }
    return null;
  }
}
