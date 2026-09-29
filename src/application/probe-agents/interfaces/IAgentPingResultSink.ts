import { Result } from 'domain/shared/core';

export type AgentPingOutcome =
  | {
      kind: 'measured';
      isReachable: boolean;
      latencyMs: number | null;
      attempts: number;
    }
  | { kind: 'probe-unavailable'; error: string; attempts: number };

export interface AgentPingResult {
  deviceId: string;
  // The agent's own id for the result: a resend carries the same one.
  resultId: string;
  outcome: AgentPingOutcome;
  // Already corrected to the backend's clock (ADR 0002, R12).
  measuredAt: Date;
  receivedAt: Date;
}

// Where a measured result goes. The device's state belongs to
// device-monitoring (ADR 0002, "Ingest use cases stay with the context that
// owns the state"), so probe-agents hands results over and never applies
// them itself.
export interface IAgentPingResultSink {
  accept(result: AgentPingResult): Promise<Result<void>>;
}
