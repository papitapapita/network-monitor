import { Result } from 'domain/shared/core';
import { IDeviceReach } from 'application/wireless-monitoring/interfaces';

export class DeviceReachAdapter implements IDeviceReach {
  constructor(private readonly serverOnSite: boolean) {}

  async isOutOfReach(): Promise<Result<boolean>> {
    return Result.ok(!this.serverOnSite);
  }
}
