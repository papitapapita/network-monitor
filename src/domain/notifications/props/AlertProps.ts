import { DeviceId } from 'domain/shared/ids';
import { AlertSeverity } from '../enums';

export interface AlertProps {
  deviceId: DeviceId;
  severity: AlertSeverity;
  startedAt: Date;
  resolvedAt: Date | null;
  notifiedAt: Date | null;
  recoveryNotifiedAt: Date | null;
  durationSecs: number | null;
}
