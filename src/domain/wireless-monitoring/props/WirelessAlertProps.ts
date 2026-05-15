export interface WirelessAlertProps {
  metric: string;
  severity: 'WARNING' | 'CRITICAL';
  threshold: number;
  currentValue: number;
  message: string;
  triggeredAt: Date;
}
