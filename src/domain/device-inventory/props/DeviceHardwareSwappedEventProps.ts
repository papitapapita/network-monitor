import { DeviceId, DeviceModelId } from 'domain/shared/ids';
import { MACAddress } from 'domain/shared/value-objects';
import { DeviceName, SerialNumber } from '../value-objects';

export interface DeviceHardwareSwappedEventProps {
  readonly aggregateId: DeviceId;
  readonly deviceName: DeviceName;
  readonly counterpartDeviceId: DeviceId;
  readonly previousDeviceModelId: DeviceModelId;
  readonly newDeviceModelId: DeviceModelId;
  readonly previousSerialNumber: SerialNumber | null;
  readonly newSerialNumber: SerialNumber | null;
  readonly previousMacAddress: MACAddress | null;
  readonly newMacAddress: MACAddress | null;
  readonly dateTimeOccurred: Date;
}
