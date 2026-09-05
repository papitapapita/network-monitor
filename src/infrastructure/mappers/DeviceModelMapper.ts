import { DeviceModel } from 'domain/device-inventory/aggregates';
import { DeviceType } from 'domain/device-inventory/value-objects';
import { DeviceModelId, VendorId } from 'domain/shared/ids';
import { Result } from 'domain/shared/core';
import { DeviceType as PrismaDeviceType } from 'generated/prisma/client';

type PrismaDeviceModelRecord = {
  id: string;
  vendorId: string;
  model: string;
  deviceType: string;
  isWireless: boolean;
  imageUrl: string | null;
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
  deviceType: PrismaDeviceType;
  isWireless: boolean;
  imageUrl: string | null;
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

    if (!DeviceType.isValid(raw.deviceType)) {
      return Result.fail<DeviceModel>(
        `Data integrity violation: unrecognised DeviceType "${raw.deviceType}" in persistence store`
      );
    }

    const deviceModel = DeviceModel.reconstitute(idResult.value, {
      vendorId: vendorIdResult.value,
      vendorName: raw.vendor.name,
      vendorSlug: raw.vendor.slug,
      model: raw.model,
      deviceType: DeviceType.reconstitute(raw.deviceType),
      isWireless: raw.isWireless,
      imageUrl: raw.imageUrl,
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
      deviceType: deviceModel.deviceType.value as PrismaDeviceType,
      isWireless: deviceModel.isWireless,
      imageUrl: deviceModel.imageUrl,
      createdAt: deviceModel.createdAt,
      updatedAt: deviceModel.updatedAt
    };
  }
}
