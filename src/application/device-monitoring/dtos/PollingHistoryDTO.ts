import { PollingResultDTO } from './PollingResultDTO';

export interface PollingHistoryDTO {
  deviceId: string;
  results: PollingResultDTO[];
  totalCount: number;
  // Statistics are computed across all matching results, not just the current page.
  statistics: {
    successRate: number;
    averageResponseTime: number;
    minResponseTime: number;
    maxResponseTime: number;
    // Identical to successRate for V1 single-ping polling; kept separate for
    // forward compatibility when multi-ping polling is added.
    uptimePercentage: number;
  };
}
