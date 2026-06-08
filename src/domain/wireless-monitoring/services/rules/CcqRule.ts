import { WirelessMetrics } from '../../value-objects';
import { WirelessAlertRecord } from '../../aggregates';
import { AlertDecision, EvaluationContext } from '../IWirelessAlertEvaluator';
import { IAlertRule } from './IAlertRule';

// CCQ is an airMax M-series metric (M2, M5, M900). Not reported by AC-series devices.
const M_SERIES_PATTERN = /\bM[259]\d*\b/i;

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
    breach: (v) => v < 75,
    clear: (v) => v > 78,
    threshold: 75,
    formatMessage: (name, v) =>
      `Calidad de conexión degradada en ${name}: ${v}% (umbral: 75%)`
  },
  {
    severity: 'CRITICAL',
    breach: (v) => v < 50,
    clear: (v) => v > 55,
    threshold: 50,
    formatMessage: (name, v) =>
      `Calidad de conexión crítica en ${name}: ${v}% (umbral: 50%)`
  }
];

export class CcqRule implements IAlertRule {
  evaluate(
    metrics: WirelessMetrics,
    context: EvaluationContext,
    activeAlerts: Map<string, WirelessAlertRecord>
  ): AlertDecision[] {
    if (!context.deviceModel || !M_SERIES_PATTERN.test(context.deviceModel)) {
      return [];
    }

    const value = metrics.ccqPercent;
    if (value === null) return [];

    const decisions: AlertDecision[] = [];

    for (const def of THRESHOLDS) {
      const key = `ccq_percent:${def.severity}`;
      const active = activeAlerts.get(key);

      if (active) {
        if (def.clear(value)) {
          decisions.push({
            metric: 'ccq_percent',
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
            metric: 'ccq_percent',
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
