import { WirelessMetrics } from '../../value-objects';
import { WirelessAlertRecord } from '../../aggregates';
import { AlertDecision, EvaluationContext } from '../IWirelessAlertEvaluator';
import { IAlertRule } from './IAlertRule';

interface ThresholdDef {
  metric: string;
  getValue: (m: WirelessMetrics) => number | null;
  breach: (v: number) => boolean;
  clear: (v: number) => boolean;
  threshold: number;
  formatMessage: (name: string, v: number) => string;
}

const THRESHOLDS: ThresholdDef[] = [
  {
    metric: 'cpu_load_percent',
    getValue: (m) => m.cpuLoadPercent,
    breach: (v) => v > 80,
    clear: (v) => v < 75,
    threshold: 80,
    formatMessage: (name, v) =>
      `Uso de CPU elevado en ${name}: ${v}% (umbral: 80%)`
  },
  {
    metric: 'memory_used_percent',
    getValue: (m) => m.memoryUsedPercent,
    breach: (v) => v > 85,
    clear: (v) => v < 80,
    threshold: 85,
    formatMessage: (name, v) =>
      `Uso de memoria elevado en ${name}: ${v}% (umbral: 85%)`
  }
];

export class CpuMemoryRule implements IAlertRule {
  evaluate(
    metrics: WirelessMetrics,
    context: EvaluationContext,
    activeAlerts: Map<string, WirelessAlertRecord>
  ): AlertDecision[] {
    const decisions: AlertDecision[] = [];

    for (const def of THRESHOLDS) {
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
