import { WirelessPollingConfigId } from 'domain/shared/ids';
import { DeviceId } from 'domain/shared';

export interface WirelessPollingConfigToggledEventProps {
  readonly aggregateId: WirelessPollingConfigId;
  readonly deviceId: DeviceId;
  readonly enabled: boolean;
  readonly dateTimeOccurred: Date;
}
