import { DeviceModelResponseDTO } from './DeviceModelResponseDTO';

export interface DeviceModelListResponseDTO {
  deviceModels: DeviceModelResponseDTO[];
  total: number;
  hasMore: boolean;
  limit: number;
  offset: number;
}
