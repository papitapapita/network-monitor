import { DeviceModelRecord } from '../../../domain/device-inventory/repository';
import {
  DeviceModelResponseDTO,
  DeviceModelListResponseDTO
} from '../dtos';

export class DeviceModelMapper {
  public static toDTO(
    record: DeviceModelRecord
  ): DeviceModelResponseDTO {
    return {
      id: record.id,
      manufacturer: record.manufacturer,
      model: record.model,
      deviceType: record.deviceType,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString()
    };
  }

  public static toListDTO(
    records: DeviceModelRecord[],
    total: number,
    limit: number = 20,
    offset: number = 0
  ): DeviceModelListResponseDTO {
    return {
      deviceModels: records.map((r) => this.toDTO(r)),
      total,
      hasMore: offset + records.length < total,
      limit,
      offset
    };
  }
}
