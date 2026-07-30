import { Device } from 'domain/device-inventory/aggregates';
import {
  DeviceResponseDTO,
  DeviceListResponseDTO,
  CreateDeviceRequestDTO,
  UpdateDeviceRequestDTO
} from '../dtos';

export class DeviceMapper {
  public static toDTO(device: Device): DeviceResponseDTO {
    return {
      id: device.id.toString(),
      deviceModelId: device.deviceModelId.toString(),
      locationId: device.locationId
        ? device.locationId.toString()
        : null,
      status: device.status.toString(),
      category: device.category ? device.category.toString() : null,
      ownerType: device.ownerType ?? null,
      name: device.name.toString(),
      serialNumber: device.serialNumber
        ? device.serialNumber.toString()
        : null,
      macAddress: device.macAddress
        ? device.macAddress.toString()
        : null,
      ipAddress: device.ipAddress
        ? device.ipAddress.toString()
        : null,
      description: device.description,
      installedDate: device.installedDate
        ? device.installedDate.toISOString()
        : null,
      monitoringEnabled: device.monitoringEnabled,
      createdAt: device.createdAt.toISOString(),
      updatedAt: device.updatedAt.toISOString()
    };
  }

  public static toListDTO(
    devices: Device[],
    total: number,
    limit: number = 20,
    offset: number = 0
  ): DeviceListResponseDTO {
    return {
      devices: devices.map((device) => this.toDTO(device)),
      total,
      hasMore: offset + devices.length < total,
      limit,
      offset
    };
  }

  public static extractCreateData(dto: CreateDeviceRequestDTO) {
    return {
      deviceModelId: dto.deviceModelId,
      locationId: dto.locationId ?? null,
      name: dto.name,
      ownerType: dto.ownerType ?? null,
      status: dto.status ?? null,
      category: dto.category ?? null,
      serialNumber: dto.serialNumber ?? null,
      macAddress: dto.macAddress ?? null,
      ipAddress: dto.ipAddress ?? null,
      description: dto.description ?? null,
      installedDate: dto.installedDate ?? null,
      monitoringEnabled: dto.monitoringEnabled
    };
  }

  public static extractUpdateData(dto: UpdateDeviceRequestDTO) {
    const updates: {
      name?: string;
      deviceModelId?: string;
      status?: string;
      category?: string | null;
      ownerType?: string;
      locationId?: string | null;
      serialNumber?: string | null;
      macAddress?: string | null;
      ipAddress?: string | null;
      description?: string | null;
      installedDate?: string | null;
      monitoringEnabled?: boolean;
    } = {};
    if (dto.name !== undefined) updates.name = dto.name;
    if (dto.deviceModelId !== undefined)
      updates.deviceModelId = dto.deviceModelId;
    if (dto.status !== undefined) updates.status = dto.status;
    if (dto.category !== undefined) updates.category = dto.category;
    if (dto.ownerType !== undefined) updates.ownerType = dto.ownerType;
    if (dto.locationId !== undefined) updates.locationId = dto.locationId;
    if (dto.serialNumber !== undefined) updates.serialNumber = dto.serialNumber;
    if (dto.macAddress !== undefined) updates.macAddress = dto.macAddress;
    if (dto.ipAddress !== undefined) updates.ipAddress = dto.ipAddress;
    if (dto.description !== undefined) updates.description = dto.description;
    if (dto.installedDate !== undefined) updates.installedDate = dto.installedDate;
    if (dto.monitoringEnabled !== undefined) {
      updates.monitoringEnabled = dto.monitoringEnabled;
    }
    return updates;
  }
}
