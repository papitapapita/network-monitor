import { WirelessDeviceConfigId, DeviceId } from 'domain/shared/ids';

export interface WirelessDeviceConfigToggledEventProps {
  readonly aggregateId: WirelessDeviceConfigId;
  readonly deviceId: DeviceId;
  readonly enabled: boolean;
  readonly dateTimeOccurred: Date;
}
