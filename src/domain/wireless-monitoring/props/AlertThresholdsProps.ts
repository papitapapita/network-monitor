export interface SeverityThresholds {
  readonly warning: number;
  readonly critical: number;
}

// Keyed by channel width in MHz. A width with no entry is not checked.
export type ChannelWidthThresholds = Readonly<Record<number, number>>;

export interface AlertThresholdsProps {
  readonly signalDbm: SeverityThresholds;
  readonly snrDb: SeverityThresholds;
  readonly ccqPercent: SeverityThresholds;
  readonly latencyMs: SeverityThresholds;
  readonly cpuPercent: number;
  readonly memoryPercent: number;
  readonly clockDriftSeconds: number;
  readonly saturationPercent: number;
  readonly clientDropPercent: number;
  readonly minCapacityMbps: ChannelWidthThresholds;
  readonly maxDistanceKm: ChannelWidthThresholds;
  // Re-read the radio before opening a flicker-prone alert (WLS-203).
  readonly confirmBeforeAlerting: boolean;
}

export type AlertThresholdOverridesProps =
  Partial<AlertThresholdsProps>;
