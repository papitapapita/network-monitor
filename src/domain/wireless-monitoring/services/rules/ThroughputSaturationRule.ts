import { WirelessMetrics } from '../../value-objects';
import { WirelessAlertRecord } from '../../aggregates';
import {
  AlertDecision,
  EvaluationContext
} from '../IWirelessAlertEvaluator';
import { IAlertRule } from './IAlertRule';

const SATURATION_RATIO = 0.8;

export class ThroughputSaturationRule implements IAlertRule {
  evaluate(
    metrics: WirelessMetrics,
    context: EvaluationContext,
    activeAlerts: Map<string, WirelessAlertRecord>
  ): AlertDecision[] {
    if (context.linkCapacityKbps === null) return [];

    const txBps = metrics.throughputTxBps;
    const rxBps = metrics.throughputRxBps;
    if (txBps === null || rxBps === null) return [];

    const totalKbps = (txBps + rxBps) / 1000;
    const threshold = context.linkCapacityKbps * SATURATION_RATIO;
    const key = 'throughput_saturation:WARNING';
    const active = activeAlerts.get(key);

    if (!active && totalKbps >= threshold) {
      return [
        {
          metric: 'throughput_saturation',
          action: 'OPEN',
          severity: 'WARNING',
          currentValue: Math.round(totalKbps),
          threshold: Math.round(threshold),
          message: `Saturación de enlace en ${context.deviceName}: ${Math.round(totalKbps / 1000)} Mbps de ${context.linkCapacityKbps / 1000} Mbps (${Math.round((totalKbps / context.linkCapacityKbps) * 100)}%)`
        }
      ];
    }

    if (active && totalKbps < threshold) {
      return [
        {
          metric: 'throughput_saturation',
          action: 'CLEAR',
          severity: 'WARNING',
          currentValue: Math.round(totalKbps),
          threshold: Math.round(threshold),
          message: `Saturación de enlace resuelta en ${context.deviceName}: ${Math.round(totalKbps / 1000)} Mbps de ${context.linkCapacityKbps / 1000} Mbps`
        }
      ];
    }

    return [];
  }
}
