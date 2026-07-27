import { WirelessMetrics } from '../../value-objects';
import { WirelessAlertRecord } from '../../aggregates';
import {
  AlertDecision,
  EvaluationContext
} from '../IWirelessAlertEvaluator';
import { IAlertRule } from './IAlertRule';

const MAX_CLOCK_DRIFT_S = 300;

export class ClockSyncRule implements IAlertRule {
  evaluate(
    metrics: WirelessMetrics,
    context: EvaluationContext,
    activeAlerts: Map<string, WirelessAlertRecord>
  ): AlertDecision[] {
    const deviceTimeEpoch = metrics.deviceTimeEpoch;

    if (deviceTimeEpoch === null) return [];

    const drift = Math.round(
      Math.abs(context.collectedAt.getTime() / 1000 - deviceTimeEpoch)
    );
    const key = 'clock_drift_s:WARNING';
    const active = activeAlerts.get(key);

    if (!active && drift > MAX_CLOCK_DRIFT_S) {
      return [
        {
          metric: 'clock_drift_s',
          action: 'OPEN',
          severity: 'WARNING',
          currentValue: drift,
          threshold: MAX_CLOCK_DRIFT_S,
          message: `Desfase de reloj detectado en ${context.deviceName}: ${drift} s de diferencia (máximo permitido: ${MAX_CLOCK_DRIFT_S} s). Posible falla de NTP.`
        }
      ];
    }

    if (active && drift <= MAX_CLOCK_DRIFT_S) {
      return [
        {
          metric: 'clock_drift_s',
          action: 'CLEAR',
          severity: 'WARNING',
          currentValue: drift,
          threshold: MAX_CLOCK_DRIFT_S,
          message: `Reloj sincronizado en ${context.deviceName}: desfase reducido a ${drift} s`
        }
      ];
    }

    return [];
  }
}
