import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { MACAddress } from 'domain/shared/value-objects';
import { IDeviceEligibilityService } from 'domain/device-inventory/services';
import { IDeviceRepository } from 'application/wireless-monitoring/interfaces';
import { PrismaDeviceRepository } from 'infrastructure/persistence/PrismaDeviceRepository';

export class WirelessDeviceRepositoryAdapter
  implements IDeviceRepository
{
  constructor(
    private readonly deviceRepo: PrismaDeviceRepository,
    private readonly eligibility: IDeviceEligibilityService
  ) {}

  async findWirelessIneligibilityReason(
    deviceId: DeviceId
  ): Promise<Result<string | null>> {
    const result = await this.deviceRepo.findById(deviceId);
    if (result.isFailure) return Result.fail(result.error!);

    // findById hides soft-deleted rows, so a tombstone arrives as null.
    if (!result.value) {
      return Result.ok('the device no longer exists');
    }

    const decision = this.eligibility.canPollWireless(result.value);
    return Result.ok(decision.eligible ? null : decision.message);
  }

  async findIdByMacAddress(
    mac: string
  ): Promise<Result<DeviceId | null>> {
    const macResult = MACAddress.create(mac);
    if (macResult.isFailure) return Result.ok(null);

    const result = await this.deviceRepo.findByMacAddress(
      macResult.value
    );
    if (result.isFailure) return Result.fail(result.error!);
    if (!result.value) return Result.ok(null);

    return Result.ok(result.value.id);
  }
}
