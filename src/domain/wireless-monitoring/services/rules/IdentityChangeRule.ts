import { WirelessMetrics } from '../../value-objects';
import { WirelessAlertRecord } from '../../aggregates';
import { AlertDecision, EvaluationContext } from '../IWirelessAlertEvaluator';
import { IAlertRule } from './IAlertRule';

interface ChangeField {
  metricKey: string;
  getValue: (m: WirelessMetrics) => string | null;
  label: string;
}

const FIELDS: ChangeField[] = [
  {
    metricKey: 'ssid_changed',
    getValue: (m) => m.ssid,
    label: 'SSID'
  },
  {
    metricKey: 'mac_address_changed',
    getValue: (m) => m.macAddress,
    label: 'Dirección MAC'
  },
  {
    metricKey: 'device_model_changed',
    getValue: (m) => m.deviceModel,
    label: 'Modelo de equipo'
  }
];

export class IdentityChangeRule implements IAlertRule {
  evaluate(
    metrics: WirelessMetrics,
    context: EvaluationContext,
    activeAlerts: Map<string, WirelessAlertRecord>
  ): AlertDecision[] {
    if (context.previousMetrics === null) return [];

    const decisions: AlertDecision[] = [];

    for (const field of FIELDS) {
      const current = field.getValue(metrics);
      const previous = field.getValue(context.previousMetrics);

      if (current === null || previous === null) continue;

      const key = `${field.metricKey}:WARNING`;
      const active = activeAlerts.get(key);

      if (!active && current !== previous) {
        decisions.push({
          metric: field.metricKey,
          action: 'OPEN',
          severity: 'WARNING',
          currentValue: 1,
          threshold: 0,
          message: `${field.label} cambió en ${context.deviceName}: "${previous}" → "${current}"`
        });
      } else if (active && current === previous) {
        decisions.push({
          metric: field.metricKey,
          action: 'CLEAR',
          severity: 'WARNING',
          currentValue: 0,
          threshold: 0,
          message: `${field.label} estabilizado en ${context.deviceName}: "${current}"`
        });
      }
    }

    return decisions;
  }
}
