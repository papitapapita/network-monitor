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
  getValue: (m: WirelessMetrics) => number | null;
  breach: (v: number) => boolean;
  clear: (v: number) => boolean;
  threshold: number;
  formatMessage: (name: string, v: number) => string;
}

const CLEAR_MARGIN_PERCENT = 5;

function thresholdDefs(t: AlertThresholds): ThresholdDef[] {
  const def = (
    metric: string,
    getValue: (m: WirelessMetrics) => number | null,
    threshold: number,
    label: string
  ): ThresholdDef => ({
    metric,
    getValue,
    breach: (v) => v > threshold,
    clear: (v) => v < threshold - CLEAR_MARGIN_PERCENT,
    threshold,
    formatMessage: (name, v) =>
      `Uso de ${label} elevado en ${name}: ${v}% (umbral: ${threshold}%)`
  });
  return [
    def(
      'cpu_load_percent',
      (m) => m.cpuLoadPercent,
      t.cpuPercent,
      'CPU'
    ),
    def(
      'memory_used_percent',
      (m) => m.memoryUsedPercent,
      t.memoryPercent,
      'memoria'
    )
  ];
}

export class CpuMemoryRule implements IAlertRule {
  evaluate(
    metrics: WirelessMetrics,
    context: EvaluationContext,
    activeAlerts: Map<string, WirelessAlertRecord>
  ): AlertDecision[] {
    const decisions: AlertDecision[] = [];

    for (const def of thresholdDefs(context.thresholds)) {
      const value = def.getValue(metrics);
      if (value === null) continue;

      const key = `${def.metric}:WARNING`;
      const active = activeAlerts.get(key);

      if (active) {
        if (def.clear(value)) {
          decisions.push({
            metric: def.metric,
            action: 'CLEAR',
            severity: 'WARNING',
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
            severity: 'WARNING',
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
