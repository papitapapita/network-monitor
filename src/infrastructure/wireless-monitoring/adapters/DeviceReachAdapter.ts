import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { IDeviceRepository } from 'domain/device-inventory/repository';
import {
  IDeviceReach,
  WirelessReader
} from 'application/wireless-monitoring/interfaces';

export class DeviceReachAdapter implements IDeviceReach {
  constructor(
    private readonly serverOnSite: boolean,
    private readonly devices: IDeviceRepository
  ) {}

  async isOutOfReach(): Promise<Result<boolean>> {
    return Result.ok(!this.serverOnSite);
  }

  // On site the server reads every radio itself, behind an agent or not, so
  // an install like that keeps working the day its agent is down.
  async readerFor(
    deviceId: DeviceId
  ): Promise<Result<WirelessReader>> {
    if (this.serverOnSite) return Result.ok({ by: 'server' });

    const found = await this.devices.findById(deviceId);
    if (found.isFailure) return Result.fail(found.error);
    const agentId = found.value?.agentId;
    return Result.ok(
      agentId
        ? { by: 'agent', agentId: agentId.toValue() }
        : { by: 'none' }
    );
  }
}
