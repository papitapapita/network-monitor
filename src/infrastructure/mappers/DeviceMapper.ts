import { Device } from '../../domain/device-inventory/aggregates/Device';
import { DeviceId, DeviceModelId, LocationId } from '../../domain/shared/ids';
import { DeviceOwnerType } from '../../domain/device-inventory/enums';
import {
  IPAddress,
  MACAddress,
  DeviceName,
  SerialNumber,
  DeviceStatus,
  DeviceCategory
} from '../../domain/device-inventory/value-objects';
import { Result } from '../../domain/shared/core';

export class DeviceMapper {
  public static toDomain(raw: any): Result<Device> {
    const deviceIdResult = DeviceId.parse(raw.id);
    if (deviceIdResult.isFailure) {
      return Result.fail<Device>(`Invalid device ID: ${deviceIdResult.error}`);
    }

    const deviceModelIdResult = DeviceModelId.parse(raw.deviceModelId);
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

    const ownerType = this.mapOwnerTypeFromPrisma(raw.owner);

    const device = Device.reconstitute(deviceIdResult.value, {
      deviceModelId: deviceModelIdResult.value as any,
      locationId,
      status: DeviceStatus.reconstitute(raw.status),
      category: raw.category != null ? DeviceCategory.reconstitute(raw.category) : null,
      ownerType,
      name: DeviceName.reconstitute(raw.name),
      serialNumber: raw.serialNumber != null ? SerialNumber.reconstitute(raw.serialNumber) : null,
      macAddress: raw.macAddress != null ? MACAddress.reconstitute(raw.macAddress) : null,
      ipAddress: raw.ipAddress != null ? IPAddress.reconstitute(raw.ipAddress) : null,
      description: raw.description ?? null,
      installedDate: raw.installedDate ?? null,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
      monitoringEnabled: raw.monitoringEnabled
    });

    return Result.ok<Device>(device);
  }

  public static toPersistence(device: Device): any {
    return {
      id: device.id.toString(),
      deviceModelId: device.deviceModelId.toString(),
      locationId: device.locationId?.toString() ?? null,
      status: device.status.toString(),
      category: device.category?.toString() ?? null,
      owner: device.ownerType.toString(),
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

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private static mapOwnerTypeFromPrisma(owner: string): DeviceOwnerType {
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
