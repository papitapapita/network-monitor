import { WirelessAlertRecordId, DeviceId } from 'domain/shared/ids';

export interface WirelessAlertClearedEventProps {
  readonly aggregateId: WirelessAlertRecordId;
  readonly deviceId: DeviceId;
  readonly metric: string;
  readonly severity: 'WARNING' | 'CRITICAL';
  readonly reason: string | null;
  readonly clearedAt: Date;
  readonly dateTimeOccurred: Date;
}
