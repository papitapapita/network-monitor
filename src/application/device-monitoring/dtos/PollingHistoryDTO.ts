import { PollingResultDTO } from './PollingResultDTO';

export interface PollingHistoryDTO {
  deviceId: string;
  results: PollingResultDTO[];
  totalCount: number;
  // Computed over every result in the date window, whatever the page and the
  // status filter (MON-043).
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
