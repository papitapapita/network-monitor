import { Device } from 'domain/device-inventory/aggregates';
import { IPAddress, MACAddress } from 'domain/shared/value-objects';
import {
  DeviceId,
  DeviceModelId,
  LocationId
} from 'domain/shared/ids';
import { DeviceOwnerType } from 'domain/device-inventory/enums';
import {
  DeviceName,
  SerialNumber,
  DeviceStatus,
  DeviceCategory
} from 'domain/device-inventory/value-objects';
import { Result } from 'domain/shared/core';
import {
  DeviceStatus as PrismaDeviceStatus,
  DeviceCategory as PrismaDeviceCategory,
  DeviceOwnerType as PrismaDeviceOwnerType
} from 'generated/prisma/client';

type PrismaDeviceRecord = {
  id: string;
  deviceModelId: string;
  locationId: string | null;
  owner: string | null;
  status: string;
  category: string | null;
  name: string;
  serialNumber: string | null;
  macAddress: string | null;
  ipAddress: string | null;
  description: string | null;
  installedDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  monitoringEnabled: boolean;
};

type DevicePersistenceData = {
  id: string;
  deviceModelId: string;
  locationId: string | null;
  owner: PrismaDeviceOwnerType | null;
  status: PrismaDeviceStatus;
  category: PrismaDeviceCategory | null;
  name: string;
  serialNumber: string | null;
  macAddress: string | null;
  ipAddress: string | null;
  description: string | null;
  installedDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  monitoringEnabled: boolean;
};

export class DeviceMapper {
  public static toDomain(raw: PrismaDeviceRecord): Result<Device> {
    const deviceIdResult = DeviceId.parse(raw.id);
    if (deviceIdResult.isFailure) {
      return Result.fail<Device>(
        `Invalid device ID: ${deviceIdResult.error}`
      );
    }

    const deviceModelIdResult = DeviceModelId.parse(
      raw.deviceModelId
    );
    if (deviceModelIdResult.isFailure) {
      return Result.fail<Device>(
        `Invalid device model ID: ${deviceModelIdResult.error}`
      );
    }

    let locationId: LocationId | null = null;
    if (raw.locationId != null) {
      const locationIdResult = LocationId.parse(raw.locationId);
      if (locationIdResult.isFailure) {
        return Result.fail<Device>(
          `Invalid location ID: ${locationIdResult.error}`
        );
      }
      locationId = locationIdResult.value;
    }

    const ownerType =
      raw.owner != null
        ? this.mapOwnerTypeFromPrisma(raw.owner)
        : null;

    const category =
      raw.category != null
        ? this.mapCategoryFromPrisma(raw.category)
        : null;

    const device = Device.reconstitute(deviceIdResult.value, {
      deviceModelId: deviceModelIdResult.value,
      locationId,
      status: DeviceStatus.reconstitute(raw.status),
      category,
      ownerType,
      name: DeviceName.reconstitute(raw.name),
      serialNumber:
        raw.serialNumber != null
          ? SerialNumber.reconstitute(raw.serialNumber)
          : null,
      macAddress:
        raw.macAddress != null
          ? MACAddress.reconstitute(raw.macAddress)
          : null,
      ipAddress:
        raw.ipAddress != null
          ? IPAddress.reconstitute(raw.ipAddress)
          : null,
      description: raw.description ?? null,
      installedDate: raw.installedDate ?? null,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
      monitoringEnabled: raw.monitoringEnabled
    });

    return Result.ok<Device>(device);
  }

  public static toPersistence(device: Device): DevicePersistenceData {
    return {
      id: device.id.toString(),
      deviceModelId: device.deviceModelId.toString(),
      locationId: device.locationId?.toString() ?? null,
      status: device.status.toString() as PrismaDeviceStatus,
      category: (device.category?.toString() ??
        null) as PrismaDeviceCategory | null,
      owner: (device.ownerType?.toString() ??
        null) as PrismaDeviceOwnerType | null,
      name: device.name.toString(),
      serialNumber: device.serialNumber?.toString() ?? null,
      macAddress: device.macAddress?.toString() ?? null,
      ipAddress: device.ipAddress?.toString() ?? null,
      description: device.description ?? null,
      installedDate: device.installedDate ?? null,
      createdAt: device.createdAt,
      updatedAt: device.updatedAt,
      monitoringEnabled: device.monitoringEnabled
    };
  }

  // Deliberately strict: the stored value must match a domain category exactly,
  // with no trimming or case-folding, so a category the domain has dropped —
  // SMART_SWITCH_POE from before the DEV-043 recast — surfaces here rather than
  // as a silent getDisplayName() default downstream.
  private static mapCategoryFromPrisma(
    category: string
  ): DeviceCategory {
    if (!DeviceCategory.isValid(category)) {
      throw new Error(
        `Data integrity violation: unrecognised DeviceCategory "${category}" in persistence store`
      );
    }

    return DeviceCategory.reconstitute(category);
  }

  private static mapOwnerTypeFromPrisma(
    owner: string
  ): DeviceOwnerType {
    switch (owner) {
      case 'COMPANY':
        return DeviceOwnerType.COMPANY;
      case 'CLIENT':
        return DeviceOwnerType.CLIENT;
      default:
        throw new Error(
          `Data integrity violation: unrecognised DeviceOwnerType "${owner}" in persistence store`
        );
    }
  }
}
