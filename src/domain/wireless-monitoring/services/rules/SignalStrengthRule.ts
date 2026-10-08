import {
  WirelessMetrics,
  AlertThresholds
} from '../../value-objects';
import { WirelessAlertRecord } from '../../aggregates';
import {
  AlertDecision,
  EvaluationContext
} from '../IWirelessAlertEvaluator';
import { IAlertRule } from './IAlertRule';

interface ThresholdDef {
  metric: string;
  severity: 'WARNING' | 'CRITICAL';
  getValue: (m: WirelessMetrics) => number | null;
  breach: (v: number) => boolean;
  clear: (v: number) => boolean;
  threshold: number;
  formatMessage: (name: string, v: number) => string;
}

const CLEAR_MARGIN_DB = 2;

function thresholdDefs(t: AlertThresholds): ThresholdDef[] {
  const { warning, critical } = t.signalDbm;
  const def = (
    metric: string,
    severity: 'WARNING' | 'CRITICAL',
    getValue: (m: WirelessMetrics) => number | null,
    threshold: number,
    label: string
  ): ThresholdDef => ({
    metric,
    severity,
    getValue,
    breach: (v) => v < threshold,
    clear: (v) => v > threshold + CLEAR_MARGIN_DB,
    threshold,
    formatMessage: (name, v) =>
      `${label} en equipo ${name}: ${v} dBm (umbral: ${threshold} dBm)`
  });
  return [
    def(
      'signal_rx_dbm',
      'WARNING',
      (m) => m.signalRxDbm,
      warning,
      'Señal débil'
    ),
    def(
      'signal_rx_dbm',
      'CRITICAL',
      (m) => m.signalRxDbm,
      critical,
      'Señal crítica'
    ),
    def(
      'signal_tx_dbm',
      'WARNING',
      (m) => m.signalTxDbm,
      warning,
      'Señal de transmisión débil'
    ),
    def(
      'signal_tx_dbm',
      'CRITICAL',
      (m) => m.signalTxDbm,
      critical,
      'Señal de transmisión crítica'
    )
  ];
}

export class SignalStrengthRule implements IAlertRule {
  evaluate(
    metrics: WirelessMetrics,
    context: EvaluationContext,
    activeAlerts: Map<string, WirelessAlertRecord>
  ): AlertDecision[] {
    const decisions: AlertDecision[] = [];

    for (const def of thresholdDefs(context.thresholds)) {
      const value = def.getValue(metrics);
      if (value === null) continue;

      const key = `${def.metric}:${def.severity}`;
      const active = activeAlerts.get(key);

      if (active) {
        if (def.clear(value)) {
          decisions.push({
            metric: def.metric,
            action: 'CLEAR',
            severity: def.severity,
            currentValue: value,
            threshold: def.threshold,
            message: def.formatMessage(context.deviceName, value)
          });
        }
      } else {
        if (def.breach(value)) {
          decisions.push({
            metric: def.metric,
            action: 'OPEN',
            severity: def.severity,
            currentValue: value,
            threshold: def.threshold,
            message: def.formatMessage(context.deviceName, value)
          });
        }
      }
    }

    return decisions;
  }
}
