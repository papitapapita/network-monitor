import { WirelessMetrics } from '../../value-objects';
import { WirelessAlertRecord } from '../../aggregates';
import { AlertDecision, EvaluationContext } from '../IWirelessAlertEvaluator';
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

const THRESHOLDS: ThresholdDef[] = [
  {
    metric: 'signal_rx_dbm',
    severity: 'WARNING',
    getValue: (m) => m.signalRxDbm,
    breach: (v) => v < -70,
    clear: (v) => v > -68,
    threshold: -70,
    formatMessage: (name, v) =>
      `Señal débil en equipo ${name}: ${v} dBm (umbral: -70 dBm)`
  },
  {
    metric: 'signal_rx_dbm',
    severity: 'CRITICAL',
    getValue: (m) => m.signalRxDbm,
    breach: (v) => v < -80,
    clear: (v) => v > -78,
    threshold: -80,
    formatMessage: (name, v) =>
      `Señal crítica en equipo ${name}: ${v} dBm (umbral: -80 dBm)`
  },
  {
    metric: 'signal_tx_dbm',
    severity: 'WARNING',
    getValue: (m) => m.signalTxDbm,
    breach: (v) => v < -70,
    clear: (v) => v > -68,
    threshold: -70,
    formatMessage: (name, v) =>
      `Señal de transmisión débil en equipo ${name}: ${v} dBm (umbral: -70 dBm)`
  },
  {
    metric: 'signal_tx_dbm',
    severity: 'CRITICAL',
    getValue: (m) => m.signalTxDbm,
    breach: (v) => v < -80,
    clear: (v) => v > -78,
    threshold: -80,
    formatMessage: (name, v) =>
      `Señal de transmisión crítica en equipo ${name}: ${v} dBm (umbral: -80 dBm)`
  }
];

export class SignalStrengthRule implements IAlertRule {
  evaluate(
    metrics: WirelessMetrics,
    context: EvaluationContext,
    activeAlerts: Map<string, WirelessAlertRecord>
  ): AlertDecision[] {
    const decisions: AlertDecision[] = [];

    for (const def of THRESHOLDS) {
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
