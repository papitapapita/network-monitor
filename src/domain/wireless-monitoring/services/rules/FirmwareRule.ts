import { WirelessMetrics } from '../../value-objects';
import { WirelessAlertRecord } from '../../aggregates';
import {
  AlertDecision,
  EvaluationContext
} from '../IWirelessAlertEvaluator';
import { IAlertRule } from './IAlertRule';

export class FirmwareRule implements IAlertRule {
  evaluate(
    metrics: WirelessMetrics,
    context: EvaluationContext,
    activeAlerts: Map<string, WirelessAlertRecord>
  ): AlertDecision[] {
    const currentFirmware = metrics.firmwareVersion;

    if (context.previousMetrics === null || currentFirmware === null)
      return [];

    const previousFirmware = context.previousMetrics.firmwareVersion;
    if (previousFirmware === null) return [];

    const key = 'firmware_version_changed:WARNING';
    const active = activeAlerts.get(key);

    if (!active && currentFirmware !== previousFirmware) {
      return [
        {
          metric: 'firmware_version_changed',
          action: 'OPEN',
          severity: 'WARNING',
          currentValue: 1,
          threshold: 0,
          message: `Versión de firmware cambió en ${context.deviceName}: "${previousFirmware}" → "${currentFirmware}"`
        }
      ];
    }

    if (active && currentFirmware === previousFirmware) {
      return [
        {
          metric: 'firmware_version_changed',
          action: 'CLEAR',
          severity: 'WARNING',
          currentValue: 0,
          threshold: 0,
          message: `Versión de firmware estabilizada en ${context.deviceName}: "${currentFirmware}"`
        }
      ];
    }

    return [];
  }
}
