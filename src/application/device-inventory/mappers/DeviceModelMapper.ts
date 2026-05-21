import { DeviceModel } from '../../../domain/device-inventory/aggregates';
import {
  DeviceModelResponseDTO,
  DeviceModelListResponseDTO
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
}
