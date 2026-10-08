import { WirelessMetrics } from '../../value-objects';
import { WirelessAlertRecord } from '../../aggregates';
import {
  AlertDecision,
  EvaluationContext
} from '../IWirelessAlertEvaluator';
import { IAlertRule } from './IAlertRule';

export class CapacityRule implements IAlertRule {
  evaluate(
    metrics: WirelessMetrics,
    context: EvaluationContext,
    activeAlerts: Map<string, WirelessAlertRecord>
  ): AlertDecision[] {
    const channelWidth = metrics.channelWidthMhz;
    if (channelWidth === null) return [];

    const floor = context.thresholds.minCapacityKbpsFor(channelWidth);
    if (floor === null) return [];

    const txKbps = metrics.capacityTxKbps;
    const rxKbps = metrics.capacityRxKbps;
    if (txKbps === null || rxKbps === null) return [];

    const key = 'capacity_kbps:WARNING';
    const active = activeAlerts.get(key);
    const minCapacity = Math.min(txKbps, rxKbps);

    if (!active && txKbps < floor && rxKbps < floor) {
      return [
        {
          metric: 'capacity_kbps',
          action: 'OPEN',
          severity: 'WARNING',
          currentValue: minCapacity,
          threshold: floor,
          message: `Capacidad de enlace baja en ${context.deviceName} (${channelWidth} MHz): ${Math.round(minCapacity / 1000)} Mbps (mínimo esperado: ${Math.round(floor / 1000)} Mbps)`
        }
      ];
    }

    if (active && (txKbps >= floor || rxKbps >= floor)) {
      return [
        {
          metric: 'capacity_kbps',
          action: 'CLEAR',
          severity: 'WARNING',
          currentValue: minCapacity,
          threshold: floor,
          message: `Capacidad de enlace recuperada en ${context.deviceName}: ${Math.round(minCapacity / 1000)} Mbps`
        }
      ];
    }

    return [];
  }
}
