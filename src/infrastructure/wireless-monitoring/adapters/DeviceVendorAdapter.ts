import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import {
  IDeviceRepository,
  IDeviceModelRepository,
  IVendorRepository
} from 'domain/device-inventory/repository';
import { IDeviceVendorLookup } from 'application/wireless-monitoring/interfaces';

export class DeviceVendorAdapter implements IDeviceVendorLookup {
  constructor(
    private readonly deviceRepo: IDeviceRepository,
    private readonly deviceModelRepo: IDeviceModelRepository,
    private readonly vendorRepo: IVendorRepository
  ) {}

  async findVendorSlug(
    deviceId: DeviceId
  ): Promise<Result<string | null>> {
    const device = await this.deviceRepo.findById(deviceId);
    if (device.isFailure) return Result.fail(device.error!);
    if (!device.value) return Result.ok(null);

    const model = await this.deviceModelRepo.findById(
      device.value.deviceModelId
    );
    if (model.isFailure) return Result.fail(model.error!);
    if (!model.value) return Result.ok(null);

    const vendor = await this.vendorRepo.findById(
      model.value.vendorId
    );
    if (vendor.isFailure) return Result.fail(vendor.error!);

    return Result.ok(vendor.value?.slug ?? null);
  }
}
