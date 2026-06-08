import { WirelessMetrics } from '../../value-objects';
import { WirelessAlertRecord } from '../../aggregates';
import { AlertDecision, EvaluationContext } from '../IWirelessAlertEvaluator';
import { IAlertRule } from './IAlertRule';

export class LanHealthRule implements IAlertRule {
  evaluate(
    metrics: WirelessMetrics,
    context: EvaluationContext,
    activeAlerts: Map<string, WirelessAlertRecord>
  ): AlertDecision[] {
    const decisions: AlertDecision[] = [];

    // lan_status — CRITICAL when DOWN
    const lanStatus = metrics.lanStatus;
    if (lanStatus !== null) {
      const key = 'lan_status:CRITICAL';
      const active = activeAlerts.get(key);

      if (lanStatus === 'DOWN' && !active) {
        decisions.push({
          metric: 'lan_status',
          action: 'OPEN',
          severity: 'CRITICAL',
          currentValue: 0,
          threshold: 0,
          message: `Puerto LAN caído en equipo ${context.deviceName}`
        });
      } else if (lanStatus === 'UP' && active) {
        decisions.push({
          metric: 'lan_status',
          action: 'CLEAR',
          severity: 'CRITICAL',
          currentValue: 1,
          threshold: 0,
          message: `Puerto LAN recuperado en equipo ${context.deviceName}`
        });
      }
    }

    // lan_speed_mbps — WARNING when speed falls to ≤10 Mbps
    const lanSpeed = metrics.lanSpeedMbps;
    if (lanSpeed !== null) {
      const key = 'lan_speed_mbps:WARNING';
      const active = activeAlerts.get(key);

      if (!active && lanSpeed <= 10) {
        decisions.push({
          metric: 'lan_speed_mbps',
          action: 'OPEN',
          severity: 'WARNING',
          currentValue: lanSpeed,
          threshold: 10,
          message: `Velocidad LAN muy baja en equipo ${context.deviceName}: ${lanSpeed} Mbps (umbral: 10 Mbps)`
        });
      } else if (active && lanSpeed > 100) {
        decisions.push({
          metric: 'lan_speed_mbps',
          action: 'CLEAR',
          severity: 'WARNING',
          currentValue: lanSpeed,
          threshold: 10,
          message: `Velocidad LAN recuperada en equipo ${context.deviceName}: ${lanSpeed} Mbps`
        });
      }
    }

    // lan_duplex_changed — WARNING when duplex mode changes unexpectedly
    // NOTE: HttpCollectionResult does not yet include lanDuplex; the use case
    // hardcodes it to null. This rule activates automatically once the collector
    // is extended to extract eth0 duplex mode.
    const currentDuplex = metrics.lanDuplex;
    const previousDuplex = context.previousMetrics?.lanDuplex ?? null;

    if (currentDuplex !== null && previousDuplex !== null) {
      const key = 'lan_duplex_changed:WARNING';
      const active = activeAlerts.get(key);

      if (!active && currentDuplex !== previousDuplex) {
        decisions.push({
          metric: 'lan_duplex_changed',
          action: 'OPEN',
          severity: 'WARNING',
          currentValue: 1,
          threshold: 0,
          message: `Modo dúplex LAN cambiado en ${context.deviceName}: ${previousDuplex} → ${currentDuplex}`
        });
      } else if (active && currentDuplex === previousDuplex) {
        decisions.push({
          metric: 'lan_duplex_changed',
          action: 'CLEAR',
          severity: 'WARNING',
          currentValue: 0,
          threshold: 0,
          message: `Modo dúplex LAN estabilizado en ${context.deviceName}: ${currentDuplex}`
        });
      }
    }

    return decisions;
  }
}
