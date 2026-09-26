import { DeviceListItemDTO } from './DeviceListItemDTO';

export interface DeviceListResponseDTO {
  devices: DeviceListItemDTO[];
  total: number;
  hasMore: boolean;
  limit: number;
  offset: number;
}
