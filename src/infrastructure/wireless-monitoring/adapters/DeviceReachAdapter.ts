import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { IDeviceReach } from 'application/wireless-monitoring/interfaces';
import { PrismaDeviceRepository } from 'infrastructure/persistence/PrismaDeviceRepository';

export class DeviceReachAdapter implements IDeviceReach {
  constructor(
    private readonly deviceRepo: PrismaDeviceRepository,
    private readonly serverOnSite: boolean
  ) {}

  async isOutOfReach(deviceId: DeviceId): Promise<Result<boolean>> {
    if (this.serverOnSite) return Result.ok(false);

    const result = await this.deviceRepo.findById(deviceId);
    if (result.isFailure) return Result.fail(result.error!);
    return Result.ok((result.value?.agentId ?? null) !== null);
  }
}
