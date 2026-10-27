import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { IPAddress, MACAddress } from 'domain/shared/value-objects';
import { IDeviceEligibilityService } from 'domain/device-inventory/services';
import { UpstreamAssignment } from 'application/device-inventory/services';
import {
  IDeviceRepository,
  DeviceBasicInfo
} from 'application/wireless-monitoring/interfaces';
import { PrismaDeviceRepository } from 'infrastructure/persistence/PrismaDeviceRepository';

export class WirelessDeviceRepositoryAdapter
  implements IDeviceRepository
{
  constructor(
    private readonly deviceRepo: PrismaDeviceRepository,
    private readonly eligibility: IDeviceEligibilityService,
    private readonly upstreamAssignment: UpstreamAssignment
  ) {}

  async findUpstreamId(
    deviceId: DeviceId
  ): Promise<Result<DeviceId | null>> {
    const result = await this.deviceRepo.findById(deviceId);
    if (result.isFailure) return Result.fail(result.error!);
    return Result.ok(result.value?.upstreamDeviceId ?? null);
  }

  async declareUpstreamIfUnset(
    deviceId: DeviceId,
    upstreamId: DeviceId
  ): Promise<Result<boolean>> {
    const result = await this.deviceRepo.findById(deviceId);
    if (result.isFailure) return Result.fail(result.error!);
    const device = result.value;
    if (!device || device.upstreamDeviceId !== null) {
      return Result.ok(false);
    }

    const checked = await this.upstreamAssignment.check(
      device,
      upstreamId
    );
    if (checked.isFailure) return Result.ok(false);

    const linkResult = device.setUpstream(checked.value);
    if (linkResult.isFailure) return Result.ok(false);

    const saveResult = await this.deviceRepo.save(device);
    if (saveResult.isFailure) return Result.fail(saveResult.error!);
    return Result.ok(true);
  }

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

  async findIdByIpAddress(
    ip: string
  ): Promise<Result<DeviceId | null>> {
    const ipResult = IPAddress.create(ip);
    if (ipResult.isFailure) return Result.ok(null);

    const result = await this.deviceRepo.findByIpAddress(
      ipResult.value
    );
    if (result.isFailure) return Result.fail(result.error!);
    if (!result.value) return Result.ok(null);

    return Result.ok(result.value.id);
  }

  async findBasicInfoById(
    deviceId: DeviceId
  ): Promise<Result<DeviceBasicInfo | null>> {
    const result = await this.deviceRepo.findById(deviceId);
    if (result.isFailure) return Result.fail(result.error!);
    if (!result.value) return Result.ok(null);

    return Result.ok({
      name: result.value.name.value,
      macAddress: result.value.macAddress?.value ?? null
    });
  }
}
