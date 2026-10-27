import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import {
  IDeviceRepository,
  IDeviceModelRepository
} from 'domain/device-inventory/repository';
import {
  CatalogModel,
  DeviceHardware,
  IDeviceHardwareLookup
} from 'application/wireless-monitoring/interfaces';

export class DeviceHardwareAdapter implements IDeviceHardwareLookup {
  constructor(
    private readonly deviceRepo: IDeviceRepository,
    private readonly deviceModelRepo: IDeviceModelRepository
  ) {}

  async findHardware(
    deviceId: DeviceId
  ): Promise<Result<DeviceHardware | null>> {
    const device = await this.deviceRepo.findById(deviceId);
    if (device.isFailure) return Result.fail(device.error!);
    if (!device.value) return Result.ok(null);

    const model = await this.deviceModelRepo.findById(
      device.value.deviceModelId
    );
    if (model.isFailure) return Result.fail(model.error!);
    if (!model.value) return Result.ok(null);

    return Result.ok({
      inInventory: device.value.status.isInInventory(),
      deviceModelId: model.value.id.toString(),
      modelName: model.value.model,
      vendorId: model.value.vendorId.toString()
    });
  }

  async findCatalogModels(): Promise<Result<CatalogModel[]>> {
    const models = await this.deviceModelRepo.findAll();
    if (models.isFailure) return Result.fail(models.error!);

    return Result.ok(
      models.value.map((m) => ({
        id: m.id.toString(),
        model: m.model,
        vendorId: m.vendorId.toString()
      }))
    );
  }
}
