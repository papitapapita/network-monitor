import { AlertResponseDTO } from './AlertResponseDTO';

export interface AlertListResponseDTO {
  alerts: AlertResponseDTO[];
  total: number;
  hasMore: boolean;
  limit: number;
  offset: number;
}
