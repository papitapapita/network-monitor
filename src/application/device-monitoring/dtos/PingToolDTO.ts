export type PingToolSource = 'SERVER' | 'AGENT';

// REPLY: it answered. NO_REPLY: no answer in time. ERROR: the ping could
// not be sent, which says nothing about the address.
export type PingToolOutcome = 'REPLY' | 'NO_REPLY' | 'ERROR';

export interface PingToolStartDTO {
  ipAddress: string;
  source: PingToolSource;
  agentId: string | null;
  agentName: string | null;
  count: number;
  startedAt: string;
}

export interface PingToolReplyDTO {
  // 1-based, in the order sent
  seq: number;
  outcome: PingToolOutcome;
  latencyMs: number | null;
  detail: string | null;
  at: string;
}

export interface PingToolSummaryDTO {
  ipAddress: string;
  sent: number;
  received: number;
  // pings that could not be sent are left out of the loss
  errors: number;
  lossPercent: number | null;
  minMs: number | null;
  avgMs: number | null;
  maxMs: number | null;
  startedAt: string;
  finishedAt: string;
  // set when an offline or outdated agent ended the run early
  stoppedEarly: string | null;
  cancelled: boolean;
}

export interface RunPingToolDTO {
  ipAddress: string;
  agentId?: string;
  count?: number;
  onStart: (start: PingToolStartDTO) => void;
  onReply: (reply: PingToolReplyDTO) => void;
  signal?: AbortSignal;
}
