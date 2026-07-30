import { DeviceId, DeviceModelId } from 'domain/shared/ids';
import { DeviceName } from '../value-objects';

export interface DeviceModelCorrectedEventProps {
  readonly aggregateId: DeviceId;
  readonly deviceName: DeviceName;
  readonly previousDeviceModelId: DeviceModelId;
  readonly newDeviceModelId: DeviceModelId;
  readonly dateTimeOccurred: Date;
}
