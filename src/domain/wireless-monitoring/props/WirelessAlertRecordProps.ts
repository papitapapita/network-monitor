import { DeviceId } from 'domain/shared';

export interface WirelessAlertRecordProps {
  readonly deviceId: DeviceId;
  readonly metric: string;
  readonly severity: 'WARNING' | 'CRITICAL';
  readonly threshold: number;
  readonly triggeredAt: Date;
  clearedAt: Date | null;
  isActive: boolean;
  lastValue: number;
  message: string;
}
