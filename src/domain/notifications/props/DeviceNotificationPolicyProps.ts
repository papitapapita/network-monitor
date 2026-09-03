import { DeviceId } from 'domain/shared/ids';
import { QuietHours } from '../value-objects';

export interface DeviceNotificationPolicyProps {
  readonly deviceId: DeviceId;
  // null = no window configured — the device always notifies.
  quietHours: QuietHours | null;
  // null = use the system default alert delay.
  alertDelayMinutes: number | null;
  createdAt: Date;
  updatedAt: Date;
}
