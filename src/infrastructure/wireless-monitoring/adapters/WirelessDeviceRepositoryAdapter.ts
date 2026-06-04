import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { MACAddress } from 'domain/shared/value-objects';
import { IDeviceRepository } from 'application/wireless-monitoring/interfaces';
import { PrismaDeviceRepository } from 'infrastructure/persistence/PrismaDeviceRepository';

export class WirelessDeviceRepositoryAdapter implements IDeviceRepository {
  constructor(
    private readonly deviceRepo: PrismaDeviceRepository
  ) {}

  async findIdByMacAddress(mac: string): Promise<Result<DeviceId | null>> {
    const macResult = MACAddress.create(mac);
    if (macResult.isFailure) return Result.ok(null);

    const result = await this.deviceRepo.findByMacAddress(macResult.value);
    if (result.isFailure) return Result.fail(result.error!);
    if (!result.value) return Result.ok(null);

    return Result.ok(result.value.id);
  }
}
