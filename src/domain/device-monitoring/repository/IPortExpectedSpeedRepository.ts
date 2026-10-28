import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { PortExpectedSpeed } from '../entities';

export interface IPortExpectedSpeedRepository {
  listForDevices(
    deviceIds: DeviceId[]
  ): Promise<Result<PortExpectedSpeed[]>>;
  find(
    deviceId: DeviceId,
    portName: string
  ): Promise<Result<PortExpectedSpeed | null>>;
  // Inserts, or replaces the speed of the row with the same device and port.
  saveAll(speeds: PortExpectedSpeed[]): Promise<Result<void>>;
  delete(deviceId: DeviceId, portName: string): Promise<Result<void>>;
}
