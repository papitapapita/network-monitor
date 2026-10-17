export type NetworkSweepOutcome = 'UP' | 'DOWN' | 'ERROR' | 'SKIPPED';

export type NetworkSweepSkipReason =
  | 'MONITORING_DISABLED'
  | 'NOT_ON_MONITORED_NETWORK'
  | 'NO_IP_ADDRESS';

export interface NetworkSweepFilterDTO {
  locationId?: string;
  category?: string;
}

export interface NetworkSweepStartDTO {
  startedAt: string;
  // every device the sweep reports on, skipped ones included
  total: number;
  toPing: number;
  filters: NetworkSweepFilterDTO;
}

export interface NetworkSweepResultDTO {
  deviceId: string;
  deviceName: string;
  ipAddress: string | null;
  category: string | null;
  locationId: string | null;
  locationName: string | null;
  // the on-site agent that pings it; null when this server does
  agentName: string | null;
  outcome: NetworkSweepOutcome;
  latencyMs: number | null;
  attempts: number;
  reason: NetworkSweepSkipReason | null;
  // why it was skipped, or why the ping could not run
  detail: string | null;
  at: string;
}

export interface NetworkSweepSummaryDTO {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  total: number;
  up: number;
  down: number;
  error: number;
  skipped: number;
  cancelled: boolean;
}

export interface RunNetworkSweepDTO {
  filters: NetworkSweepFilterDTO;
  onStart: (start: NetworkSweepStartDTO) => void;
  onResult: (result: NetworkSweepResultDTO) => void;
  signal?: AbortSignal;
}
