import { DeviceId } from 'domain/shared/ids';
import { QuietHours } from '../value-objects';

// INHERIT: the install's quiet hours, if any. CUSTOM: the device's own
// window. ALWAYS_NOTIFY: never silenced by quiet hours (NOT-170).
export type QuietHoursMode = 'INHERIT' | 'CUSTOM' | 'ALWAYS_NOTIFY';

export interface DeviceNotificationPolicyProps {
  readonly deviceId: DeviceId;
  quietHoursMode: QuietHoursMode;
  // Set exactly when quietHoursMode is CUSTOM.
  quietHours: QuietHours | null;
  // null = use the system default alert delay.
  alertDelayMinutes: number | null;
  createdAt: Date;
  updatedAt: Date;
}
