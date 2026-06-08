import { WirelessMetrics } from '../../value-objects';
import { WirelessAlertRecord } from '../../aggregates';
import { AlertDecision, EvaluationContext } from '../IWirelessAlertEvaluator';
import { IAlertRule } from './IAlertRule';

interface ThresholdDef {
  severity: 'WARNING' | 'CRITICAL';
  breach: (v: number) => boolean;
  clear: (v: number) => boolean;
  threshold: number;
  formatMessage: (name: string, v: number) => string;
}

const THRESHOLDS: ThresholdDef[] = [
  {
    severity: 'WARNING',
    breach: (v) => v < 15,
    clear: (v) => v > 17,
    threshold: 15,
    formatMessage: (name, v) =>
      `Relación señal/ruido baja en ${name}: ${v} dB (umbral: 15 dB)`
  },
  {
    severity: 'CRITICAL',
    breach: (v) => v < 10,
    clear: (v) => v > 12,
    threshold: 10,
    formatMessage: (name, v) =>
      `Relación señal/ruido crítica en ${name}: ${v} dB (umbral: 10 dB)`
  }
];

export class SnrRule implements IAlertRule {
  evaluate(
    metrics: WirelessMetrics,
    context: EvaluationContext,
    activeAlerts: Map<string, WirelessAlertRecord>
  ): AlertDecision[] {
    // Uses getSnr() so the value is computed from signal − noise when snrDb is null
    const value = metrics.getSnr();
    if (value === null) return [];

    const decisions: AlertDecision[] = [];

    for (const def of THRESHOLDS) {
      const key = `snr_db:${def.severity}`;
      const active = activeAlerts.get(key);

      if (active) {
        if (def.clear(value)) {
          decisions.push({
            metric: 'snr_db',
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
            metric: 'snr_db',
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
