import { DeviceId } from 'domain/shared/ids';
import { AlertSeverity } from 'domain/shared/enums';

export interface AlertProps {
  deviceId: DeviceId;
  severity: AlertSeverity;
  source: string;
  type: string;
  description: string;
  details?: Record<string, unknown>;
  startedAt: Date;
  resolvedAt: Date | null;
  notifiedAt: Date | null;
  recoveryNotifiedAt: Date | null;
}
