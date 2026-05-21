import { DeviceModel } from 'domain/device-inventory';
import {
  DeviceModelResponseDTO,
  DeviceModelListResponseDTO,
  CreateDeviceModelRequestDTO,
  UpdateDeviceModelRequestDTO
} from '../dtos';

export class DeviceModelMapper {
  public static toDTO(
    deviceModel: DeviceModel
  ): DeviceModelResponseDTO {
    return {
      id: deviceModel.id.toString(),
      vendorId: deviceModel.vendorId.toString(),
      vendorName: deviceModel.vendorName,
      vendorSlug: deviceModel.vendorSlug,
      model: deviceModel.model,
      deviceType: deviceModel.deviceType,
      createdAt: deviceModel.createdAt.toISOString(),
      updatedAt: deviceModel.updatedAt.toISOString()
    };
  }

  public static toListDTO(
    deviceModels: DeviceModel[],
    total: number,
    limit: number = 20,
    offset: number = 0
  ): DeviceModelListResponseDTO {
    return {
      deviceModels: deviceModels.map((m) => this.toDTO(m)),
      total,
      hasMore: offset + deviceModels.length < total,
      limit,
      offset
    };
  }

  public static extractCreateData(dto: CreateDeviceModelRequestDTO) {
    return {
      vendorId: dto.vendorId,
      model: dto.model,
      deviceType: dto.deviceType
    };
  }

  public static extractUpdateData(dto: UpdateDeviceModelRequestDTO) {
    const updates: {
      vendorId?: string;
      model?: string;
      deviceType?: string;
    } = {};
    if (dto.vendorId !== undefined) updates.vendorId = dto.vendorId;
    if (dto.model !== undefined) updates.model = dto.model;
    if (dto.deviceType !== undefined) updates.deviceType = dto.deviceType;
    return updates;
  }
}
