import { WirelessMetrics } from '../value-objects';
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
  linkCapacityBps: number | null;
  clientsProvisionedLimit: number | null;
}

export interface IWirelessAlertEvaluator {
  evaluate(
    metrics: WirelessMetrics,
    activeAlerts: Map<string, WirelessAlertRecord>,
    context: EvaluationContext
  ): AlertDecision[];
}
