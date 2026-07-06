import { LocationResponseDTO } from './LocationResponseDTO';

export interface LocationListResponseDTO {
  locations: LocationResponseDTO[];
  total: number;
  hasMore: boolean;
  limit: number;
  offset: number;
}
