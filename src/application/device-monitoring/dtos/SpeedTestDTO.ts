export type SpeedTestPhase = 'LATENCY' | 'DOWNLOAD' | 'UPLOAD';

// How long each phase lasts, so a progress bar knows its end.
export interface SpeedTestPlanDTO {
  latencySamples: number;
  downloadSeconds: number;
  uploadSeconds: number;
}

export interface SpeedTestStartDTO extends SpeedTestPlanDTO {
  startedAt: string;
}

// LATENCY frames carry latencyMs, DOWNLOAD and UPLOAD frames carry mbps.
export interface SpeedTestProgressDTO {
  phase: SpeedTestPhase;
  // since the phase began
  elapsedMs: number;
  mbps: number | null;
  latencyMs: number | null;
}

export interface SpeedTestResultDTO {
  id: string;
  status: 'COMPLETED' | 'FAILED';
  downloadMbps: number | null;
  uploadMbps: number | null;
  latencyMs: number | null;
  jitterMs: number | null;
  serverLocation: string | null;
  error: string | null;
  startedByEmail: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
}

export interface RunSpeedTestDTO {
  startedBy: { userId: string; email: string };
  onStart: (start: SpeedTestStartDTO) => void;
  onProgress: (progress: SpeedTestProgressDTO) => void;
  signal?: AbortSignal;
}

// result is null when the caller stopped the test (MON-101)
export interface SpeedTestRunDTO {
  cancelled: boolean;
  result: SpeedTestResultDTO | null;
}

export interface ListSpeedTestsDTO {
  limit?: number;
  offset?: number;
}

export interface SpeedTestListResponseDTO {
  results: SpeedTestResultDTO[];
  total: number;
  hasMore: boolean;
  limit: number;
  offset: number;
}
