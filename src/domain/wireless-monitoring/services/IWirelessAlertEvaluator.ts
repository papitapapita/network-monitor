import { WirelessMetrics, AlertThresholds } from '../value-objects';
import { WirelessAlertRecord } from '../aggregates';

export interface AlertDecision {
  metric: string;
  action: 'OPEN' | 'CLEAR' | 'NONE';
  severity: 'WARNING' | 'CRITICAL';
  currentValue: number;
  threshold: number;
  message: string;
}

export interface EvaluationContext {
  deviceName: string;
  deviceModel: string | null;
  linkCapacityKbps: number | null;
  clientsProvisionedLimit: number | null;
  provisionedLanSpeedMbps: number | null;
  previousMetrics: WirelessMetrics | null;
  collectedAt: Date;
  // The install's thresholds with this device's overrides applied.
  thresholds: AlertThresholds;
}

export interface IWirelessAlertEvaluator {
  evaluate(
    metrics: WirelessMetrics,
    activeAlerts: Map<string, WirelessAlertRecord>,
    context: EvaluationContext
  ): AlertDecision[];
}
