export type LinkDiagnosisStatus = 'RUNNING' | 'COMPLETED' | 'STOPPED';

export type PingHop = 'TARGET' | 'PARENT';

export interface PingSampleDTO {
  hop: PingHop;
  at: string;
  // null means no reply within the probe timeout
  latencyMs: number | null;
}

export interface RadioSampleDTO {
  at: string;
  ok: boolean;
  error: string | null;
  throughputTxBps: number | null;
  throughputRxBps: number | null;
  capacityTxKbps: number | null;
  capacityRxKbps: number | null;
  signalRxDbm: number | null;
  signalTxDbm: number | null;
  noiseFloorDbm: number | null;
  snrDb: number | null;
  ccqPercent: number | null;
  radioLatencyMs: number | null;
  cpuLoadPercent: number | null;
  lanStatus: 'UP' | 'DOWN' | null;
  lanSpeedMbps: number | null;
}

export interface PingStatisticsDTO {
  sent: number;
  received: number;
  lossPercent: number;
  minMs: number | null;
  avgMs: number | null;
  maxMs: number | null;
  jitterMs: number | null;
  spikeCount: number;
}

export interface DiagnosisFindingDTO {
  code: string;
  hop: 'TARGET' | 'PARENT' | 'RADIO';
  severity: 'WARNING' | 'CRITICAL';
  value: number | null;
  threshold: number | null;
  message: string;
}

export interface ThroughputSummaryDTO {
  avgTxBps: number | null;
  avgRxBps: number | null;
  peakTxBps: number | null;
  peakRxBps: number | null;
  linkCapacityKbps: number | null;
}

export interface LinkDiagnosisReportDTO {
  verdict: 'HEALTHY' | 'DEGRADED' | 'FAILING' | 'INCONCLUSIVE';
  faultLocation: 'NONE' | 'TARGET_LINK' | 'UPSTREAM' | 'UNDETERMINED';
  summary: string;
  findings: DiagnosisFindingDTO[];
  target: PingStatisticsDTO;
  parent: PingStatisticsDTO | null;
  radio: {
    samples: number;
    failures: number;
    throughput: ThroughputSummaryDTO;
  };
  generatedAt: string;
}

export interface LinkDiagnosisHopDTO {
  deviceId: string | null;
  ipAddress: string;
  name: string | null;
}

export interface LinkDiagnosisDTO {
  deviceId: string;
  deviceType: 'STATION' | 'ACCESS_POINT';
  status: LinkDiagnosisStatus;
  startedAt: string;
  endsAt: string;
  endedAt: string | null;
  durationSeconds: number;
  target: LinkDiagnosisHopDTO;
  parent: LinkDiagnosisHopDTO | null;
  report: LinkDiagnosisReportDTO;
  // only on the full view (GET / stream opening frame) — a late viewer
  // redraws the charts from these
  samples?: {
    ping: PingSampleDTO[];
    radio: RadioSampleDTO[];
  };
}

export interface StartLinkDiagnosisResponseDTO {
  // false when the request joined a session already running for the device
  started: boolean;
  diagnosis: LinkDiagnosisDTO;
}
