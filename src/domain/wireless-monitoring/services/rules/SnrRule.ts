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
  severity: 'WARNING' | 'CRITICAL';
  breach: (v: number) => boolean;
  clear: (v: number) => boolean;
  threshold: number;
  formatMessage: (name: string, v: number) => string;
}

const CLEAR_MARGIN_DB = 2;

function thresholdDefs(t: AlertThresholds): ThresholdDef[] {
  const def = (
    severity: 'WARNING' | 'CRITICAL',
    threshold: number,
    label: string
  ): ThresholdDef => ({
    severity,
    breach: (v) => v < threshold,
    clear: (v) => v > threshold + CLEAR_MARGIN_DB,
    threshold,
    formatMessage: (name, v) =>
      `Relación señal/ruido ${label} en ${name}: ${v} dB (umbral: ${threshold} dB)`
  });
  return [
    def('WARNING', t.snrDb.warning, 'baja'),
    def('CRITICAL', t.snrDb.critical, 'crítica')
  ];
}

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

    for (const def of thresholdDefs(context.thresholds)) {
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
