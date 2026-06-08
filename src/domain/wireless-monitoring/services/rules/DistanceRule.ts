import { WirelessMetrics } from '../../value-objects';
import { WirelessAlertRecord } from '../../aggregates';
import { AlertDecision, EvaluationContext } from '../IWirelessAlertEvaluator';
import { IAlertRule } from './IAlertRule';

export class DistanceRule implements IAlertRule {
  evaluate(
    metrics: WirelessMetrics,
    context: EvaluationContext,
    activeAlerts: Map<string, WirelessAlertRecord>
  ): AlertDecision[] {
    if (context.maxLinkDistanceM === null) return [];

    const distanceM = metrics.distanceM;
    if (distanceM === null) return [];

    const key = 'distance_m:WARNING';
    const active = activeAlerts.get(key);
    const max = context.maxLinkDistanceM;

    if (!active && distanceM > max) {
      return [
        {
          metric: 'distance_m',
          action: 'OPEN',
          severity: 'WARNING',
          currentValue: distanceM,
          threshold: max,
          message: `Distancia de enlace excesiva en ${context.deviceName}: ${distanceM} m (máximo: ${max} m)`
        }
      ];
    }

    if (active && distanceM <= max) {
      return [
        {
          metric: 'distance_m',
          action: 'CLEAR',
          severity: 'WARNING',
          currentValue: distanceM,
          threshold: max,
          message: `Distancia de enlace normalizada en ${context.deviceName}: ${distanceM} m`
        }
      ];
    }

    return [];
  }
}
