export interface WirelessAlertResponseDTO {
  id: string;
  deviceId: string;
  metric: string;
  severity: 'WARNING' | 'CRITICAL';
  threshold: number;
  lastValue: number;
  message: string;
  triggeredAt: string;
  clearedAt: string | null;
  isActive: boolean;
}
