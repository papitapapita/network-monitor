import { PingCycleOutcome } from '../services';

export interface IngestPingResultsDTO {
  deviceId: string;
  outcome: PingCycleOutcome;
  // On the backend's clock — an agent's result is already corrected for its
  // clock offset before it gets here (ADR 0002, R12).
  measuredAt: Date;
  // Set for results measured elsewhere and sent in (an on-site agent's):
  // the id makes a resend a no-op (R8), and the arrival time decides whether
  // the result is live or only history (R9). Absent for an in-process poll,
  // which is live by construction.
  source?: { resultId: string; receivedAt: Date };
}
