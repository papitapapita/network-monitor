import { WirelessPollingConfigId, DeviceId } from 'domain/shared/ids';

export interface WirelessPollingConfigToggledEventProps {
  readonly aggregateId: WirelessPollingConfigId;
  readonly deviceId: DeviceId;
  readonly enabled: boolean;
  readonly dateTimeOccurred: Date;
}
