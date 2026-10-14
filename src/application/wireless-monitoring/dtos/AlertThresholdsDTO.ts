export interface SeverityThresholdsDTO {
  warning: number;
  critical: number;
}

export interface AlertThresholdsDTO {
  signalDbm: SeverityThresholdsDTO;
  snrDb: SeverityThresholdsDTO;
  ccqPercent: SeverityThresholdsDTO;
  latencyMs: SeverityThresholdsDTO;
  cpuPercent: number;
  memoryPercent: number;
  clockDriftSeconds: number;
  saturationPercent: number;
  clientDropPercent: number;
  // Keyed by channel width in MHz, e.g. { "40": 100 }.
  minCapacityMbps: Record<string, number>;
  maxDistanceKm: Record<string, number>;
  confirmBeforeAlerting: boolean;
}

// The confirmation switch came after the threshold screen; a save that
// leaves it out keeps the install's current setting (WLS-203).
export type UpdateAlertThresholdsRequestDTO = Omit<
  AlertThresholdsDTO,
  'confirmBeforeAlerting'
> & { confirmBeforeAlerting?: boolean };

export type AlertThresholdOverridesDTO = Partial<AlertThresholdsDTO>;

export interface GlobalAlertThresholdsResponseDTO {
  thresholds: AlertThresholdsDTO;
  defaults: AlertThresholdsDTO;
}

export interface DeviceAlertThresholdsRequestDTO {
  deviceId: string;
}

export interface UpdateDeviceAlertThresholdsRequestDTO {
  deviceId: string;
  overrides: AlertThresholdOverridesDTO;
}

export interface DeviceAlertThresholdsResponseDTO {
  deviceId: string;
  overrides: AlertThresholdOverridesDTO;
  install: AlertThresholdsDTO;
  effective: AlertThresholdsDTO;
}
