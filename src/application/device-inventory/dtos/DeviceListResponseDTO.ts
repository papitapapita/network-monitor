import { DeviceResponseDTO } from './DeviceResponseDTO';

export interface DeviceListResponseDTO {
  devices: DeviceResponseDTO[];
  total: number;
  hasMore: boolean;
  limit: number;
  offset: number;
}
