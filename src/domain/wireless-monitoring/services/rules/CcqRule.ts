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

// CCQ is an airMax M-series metric (M2, M5, M900). Not reported by AC-series devices.
const M_SERIES_PATTERN = /\bM[259]\d*\b/i;

interface ThresholdDef {
  severity: 'WARNING' | 'CRITICAL';
  breach: (v: number) => boolean;
  clear: (v: number) => boolean;
  threshold: number;
  formatMessage: (name: string, v: number) => string;
}

const CLEAR_MARGIN_PERCENT = { WARNING: 3, CRITICAL: 5 };

function thresholdDefs(t: AlertThresholds): ThresholdDef[] {
  const def = (
    severity: 'WARNING' | 'CRITICAL',
    threshold: number,
    label: string
  ): ThresholdDef => ({
    severity,
    breach: (v) => v < threshold,
    clear: (v) => v > threshold + CLEAR_MARGIN_PERCENT[severity],
    threshold,
    formatMessage: (name, v) =>
      `Calidad de conexión ${label} en ${name}: ${v}% (umbral: ${threshold}%)`
  });
  return [
    def('WARNING', t.ccqPercent.warning, 'degradada'),
    def('CRITICAL', t.ccqPercent.critical, 'crítica')
  ];
}

export class CcqRule implements IAlertRule {
  evaluate(
    metrics: WirelessMetrics,
    context: EvaluationContext,
    activeAlerts: Map<string, WirelessAlertRecord>
  ): AlertDecision[] {
    if (
      !context.deviceModel ||
      !M_SERIES_PATTERN.test(context.deviceModel)
    ) {
      return [];
    }

    const value = metrics.ccqPercent;
    if (value === null) return [];

    const decisions: AlertDecision[] = [];

    for (const def of thresholdDefs(context.thresholds)) {
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
