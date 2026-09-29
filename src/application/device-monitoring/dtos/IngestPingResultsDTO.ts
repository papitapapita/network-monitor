import { PingCycleOutcome } from '../services';

export interface IngestPingResultsDTO {
  deviceId: string;
  outcome: PingCycleOutcome;
  measuredAt: Date;
}
