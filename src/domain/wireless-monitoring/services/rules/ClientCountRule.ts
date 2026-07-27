import { WirelessMetrics } from '../../value-objects';
import { WirelessAlertRecord } from '../../aggregates';
import {
  AlertDecision,
  EvaluationContext
} from '../IWirelessAlertEvaluator';
import { IAlertRule } from './IAlertRule';

const SUDDEN_DROP_RATIO = 0.5;
const SUDDEN_DROP_MIN_PREVIOUS = 3;

export class ClientCountRule implements IAlertRule {
  evaluate(
    metrics: WirelessMetrics,
    context: EvaluationContext,
    activeAlerts: Map<string, WirelessAlertRecord>
  ): AlertDecision[] {
    const decisions: AlertDecision[] = [];
    const current = metrics.clientsConnected;

    // clients_connected — WARNING when exceeds provisioned limit
    if (
      current !== null &&
      context.clientsProvisionedLimit !== null
    ) {
      const key = 'clients_connected:WARNING';
      const active = activeAlerts.get(key);
      const limit = context.clientsProvisionedLimit;

      if (!active && current > limit) {
        decisions.push({
          metric: 'clients_connected',
          action: 'OPEN',
          severity: 'WARNING',
          currentValue: current,
          threshold: limit,
          message: `Clientes conectados superan el límite en ${context.deviceName}: ${current} (límite: ${limit})`
        });
      } else if (active && current <= limit) {
        decisions.push({
          metric: 'clients_connected',
          action: 'CLEAR',
          severity: 'WARNING',
          currentValue: current,
          threshold: limit,
          message: `Clientes conectados dentro del límite en ${context.deviceName}: ${current}`
        });
      }
    }

    // clients_sudden_drop — WARNING when connected count drops ≥50% vs previous poll
    const previous =
      context.previousMetrics?.clientsConnected ?? null;
    if (
      current !== null &&
      previous !== null &&
      previous > SUDDEN_DROP_MIN_PREVIOUS
    ) {
      const key = 'clients_sudden_drop:WARNING';
      const active = activeAlerts.get(key);
      // Store the 50% floor computed at OPEN time so CLEAR doesn't need previousMetrics
      const floor = Math.round(previous * SUDDEN_DROP_RATIO);

      if (!active && current < floor) {
        decisions.push({
          metric: 'clients_sudden_drop',
          action: 'OPEN',
          severity: 'WARNING',
          currentValue: current,
          threshold: floor,
          message: `Caída repentina de clientes en ${context.deviceName}: ${previous} → ${current} (umbral: ${floor})`
        });
      } else if (active && current >= active.lastValue) {
        // Use the threshold stored at OPEN time to decide when to clear
        decisions.push({
          metric: 'clients_sudden_drop',
          action: 'CLEAR',
          severity: 'WARNING',
          currentValue: current,
          threshold: active.threshold,
          message: `Clientes recuperados en ${context.deviceName}: ${current}`
        });
      }
    }

    return decisions;
  }
}
