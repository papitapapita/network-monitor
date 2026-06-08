import { WirelessMetrics } from '../../value-objects';
import { WirelessAlertRecord } from '../../aggregates';
import { AlertDecision, EvaluationContext } from '../IWirelessAlertEvaluator';
import { IAlertRule } from './IAlertRule';

export class FirmwareRule implements IAlertRule {
  evaluate(
    metrics: WirelessMetrics,
    context: EvaluationContext,
    activeAlerts: Map<string, WirelessAlertRecord>
  ): AlertDecision[] {
    const decisions: AlertDecision[] = [];
    const currentFirmware = metrics.firmwareVersion;

    // firmware_version_mismatch — stays open until firmware matches target
    if (context.targetFirmwareVersion !== null && currentFirmware !== null) {
      const key = 'firmware_version_mismatch:WARNING';
      const active = activeAlerts.get(key);
      const target = context.targetFirmwareVersion;

      if (!active && currentFirmware !== target) {
        decisions.push({
          metric: 'firmware_version_mismatch',
          action: 'OPEN',
          severity: 'WARNING',
          currentValue: 1,
          threshold: 0,
          message: `Versión de firmware incorrecta en ${context.deviceName}: "${currentFirmware}" (esperada: "${target}")`
        });
      } else if (active && currentFirmware === target) {
        decisions.push({
          metric: 'firmware_version_mismatch',
          action: 'CLEAR',
          severity: 'WARNING',
          currentValue: 0,
          threshold: 0,
          message: `Firmware actualizado correctamente en ${context.deviceName}: "${currentFirmware}"`
        });
      }
    }

    // firmware_version_changed — change-based, auto-clears when value is stable
    if (context.previousMetrics !== null && currentFirmware !== null) {
      const previousFirmware = context.previousMetrics.firmwareVersion;
      if (previousFirmware !== null) {
        const key = 'firmware_version_changed:WARNING';
        const active = activeAlerts.get(key);

        if (!active && currentFirmware !== previousFirmware) {
          decisions.push({
            metric: 'firmware_version_changed',
            action: 'OPEN',
            severity: 'WARNING',
            currentValue: 1,
            threshold: 0,
            message: `Versión de firmware cambió en ${context.deviceName}: "${previousFirmware}" → "${currentFirmware}"`
          });
        } else if (active && currentFirmware === previousFirmware) {
          decisions.push({
            metric: 'firmware_version_changed',
            action: 'CLEAR',
            severity: 'WARNING',
            currentValue: 0,
            threshold: 0,
            message: `Versión de firmware estabilizada en ${context.deviceName}: "${currentFirmware}"`
          });
        }
      }
    }

    return decisions;
  }
}
