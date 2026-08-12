import { DeviceId, DeviceModelId } from 'domain/shared/ids';
import { DeviceName, DeviceStatus } from '../value-objects';
import { IPAddress } from 'domain/shared/value-objects';

// Raised by the retired unit, so aggregateId is the OLD device — that is the
// row whose history the event explains.
export interface DeviceReplacedEventProps {
  readonly aggregateId: DeviceId;
  readonly deviceName: DeviceName;
  readonly retiredStatus: DeviceStatus;
  readonly previousDeviceModelId: DeviceModelId;
  readonly releasedIpAddress: IPAddress | null;
  readonly replacedAt: Date;
  readonly dateTimeOccurred: Date;
}
