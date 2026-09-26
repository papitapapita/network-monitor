import { AlertListItemDTO } from './AlertListItemDTO';

export interface AlertListResponseDTO {
  alerts: AlertListItemDTO[];
  total: number;
  hasMore: boolean;
  limit: number;
  offset: number;
}
