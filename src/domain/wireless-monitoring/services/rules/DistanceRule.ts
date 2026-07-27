import { WirelessMetrics } from '../../value-objects';
import { WirelessAlertRecord } from '../../aggregates';
import {
  AlertDecision,
  EvaluationContext
} from '../IWirelessAlertEvaluator';
import { IAlertRule } from './IAlertRule';

const CHANNEL_WIDTH_MAX_DISTANCE_M: Record<number, number> = {
  20: 15_000,
  40: 10_000,
  80: 5_000
};

export class DistanceRule implements IAlertRule {
  evaluate(
    metrics: WirelessMetrics,
    context: EvaluationContext,
    activeAlerts: Map<string, WirelessAlertRecord>
  ): AlertDecision[] {
    const distanceM = metrics.distanceM;
    const channelWidthMhz = metrics.channelWidthMhz;

    if (distanceM === null || channelWidthMhz === null) return [];

    const maxDistanceM =
      CHANNEL_WIDTH_MAX_DISTANCE_M[channelWidthMhz];
    if (maxDistanceM === undefined) return [];

    const key = 'distance_m:WARNING';
    const active = activeAlerts.get(key);

    if (!active && distanceM > maxDistanceM) {
      return [
        {
          metric: 'distance_m',
          action: 'OPEN',
          severity: 'WARNING',
          currentValue: distanceM,
          threshold: maxDistanceM,
          message: `Distancia de enlace excesiva en ${context.deviceName}: ${distanceM} m (máximo recomendado para ${channelWidthMhz} MHz: ${maxDistanceM / 1000} km)`
        }
      ];
    }

    if (active && distanceM <= maxDistanceM) {
      return [
        {
          metric: 'distance_m',
          action: 'CLEAR',
          severity: 'WARNING',
          currentValue: distanceM,
          threshold: maxDistanceM,
          message: `Distancia de enlace normalizada en ${context.deviceName}: ${distanceM} m`
        }
      ];
    }

    return [];
  }
}
