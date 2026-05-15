import { WirelessAlertRecordId } from 'domain/shared/ids';
import { DeviceId } from 'domain/shared';

export interface WirelessAlertClearedEventProps {
  readonly aggregateId: WirelessAlertRecordId;
  readonly deviceId: DeviceId;
  readonly metric: string;
  readonly severity: 'WARNING' | 'CRITICAL';
  readonly clearedAt: Date;
  readonly dateTimeOccurred: Date;
}
