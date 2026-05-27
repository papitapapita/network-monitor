import { DeviceModel } from 'domain/device-inventory/aggregates';
import { DeviceModelId, VendorId } from 'domain/shared/ids';
import { Result } from 'domain/shared/core';

type PrismaDeviceModelRecord = {
  id: string;
  vendorId: string;
  model: string;
  deviceType: string;
  createdAt: Date;
  updatedAt: Date;
  vendor: {
    name: string;
    slug: string;
  };
};

type DeviceModelPersistenceData = {
  id: string;
  vendorId: string;
  model: string;
  deviceType: string;
  createdAt: Date;
  updatedAt: Date;
};

export class DeviceModelMapper {
  public static toDomain(
    raw: PrismaDeviceModelRecord
  ): Result<DeviceModel> {
    const idResult = DeviceModelId.parse(raw.id);
    if (idResult.isFailure) {
      return Result.fail<DeviceModel>(
        `Invalid device model ID: ${idResult.error}`
      );
    }

    const vendorIdResult = VendorId.parse(raw.vendorId);
    if (vendorIdResult.isFailure) {
      return Result.fail<DeviceModel>(
        `Invalid vendor ID: ${vendorIdResult.error}`
      );
    }

    const deviceModel = DeviceModel.reconstitute(idResult.value, {
      vendorId: vendorIdResult.value,
      vendorName: raw.vendor.name,
      vendorSlug: raw.vendor.slug,
      model: raw.model,
      deviceType: raw.deviceType,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt
    });

    return Result.ok<DeviceModel>(deviceModel);
  }

  public static toPersistence(
    deviceModel: DeviceModel
  ): DeviceModelPersistenceData {
    return {
      id: deviceModel.id.toString(),
      vendorId: deviceModel.vendorId.toString(),
      model: deviceModel.model,
      deviceType: deviceModel.deviceType,
      createdAt: deviceModel.createdAt,
      updatedAt: deviceModel.updatedAt
    };
  }
}
