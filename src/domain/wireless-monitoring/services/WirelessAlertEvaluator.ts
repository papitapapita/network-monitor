import { WirelessMetrics } from '../value-objects';
import { WirelessAlertRecord } from '../aggregates';
import {
  AlertDecision,
  EvaluationContext,
  IWirelessAlertEvaluator
} from './IWirelessAlertEvaluator';

export type { AlertDecision, EvaluationContext };

interface ThresholdDef {
  metric: string;
  severity: 'WARNING' | 'CRITICAL';
  breach: (value: number, ctx: EvaluationContext) => boolean;
  clear: (value: number, ctx: EvaluationContext) => boolean;
  getValue: (
    metrics: WirelessMetrics,
    ctx: EvaluationContext
  ) => number | null;
  formatMessage: (
    deviceName: string,
    value: number,
    threshold: number
  ) => string;
  threshold: (ctx: EvaluationContext) => number;
}

export const WIRELESS_THRESHOLDS: ThresholdDef[] = [
  {
    metric: 'signal_rx_dbm',
    severity: 'WARNING',
    getValue: (m) => m.signalRxDbm,
    breach: (v) => v < -70,
    clear: (v) => v > -68,
    threshold: () => -70,
    formatMessage: (name, v) =>
      `Señal débil en equipo ${name}: ${v} dBm (umbral: -70 dBm)`
  },
  {
    metric: 'signal_rx_dbm',
    severity: 'CRITICAL',
    getValue: (m) => m.signalRxDbm,
    breach: (v) => v < -80,
    clear: (v) => v > -78,
    threshold: () => -80,
    formatMessage: (name, v) =>
      `Señal crítica en equipo ${name}: ${v} dBm (umbral: -80 dBm)`
  },
  {
    metric: 'snr_db',
    severity: 'WARNING',
    getValue: (m) => m.snrDb,
    breach: (v) => v < 15,
    clear: (v) => v > 17,
    threshold: () => 15,
    formatMessage: (name, v) =>
      `Relación señal/ruido baja en ${name}: ${v} dB (umbral: 15 dB)`
  },
  {
    metric: 'snr_db',
    severity: 'CRITICAL',
    getValue: (m) => m.snrDb,
    breach: (v) => v < 10,
    clear: (v) => v > 12,
    threshold: () => 10,
    formatMessage: (name, v) =>
      `Relación señal/ruido crítica en ${name}: ${v} dB (umbral: 10 dB)`
  },
  {
    metric: 'ccq_percent',
    severity: 'WARNING',
    getValue: (m) => m.ccqPercent,
    breach: (v) => v < 75,
    clear: (v) => v > 78,
    threshold: () => 75,
    formatMessage: (name, v) =>
      `Calidad de conexión degradada en ${name}: ${v}% (umbral: 75%)`
  },
  {
    metric: 'ccq_percent',
    severity: 'CRITICAL',
    getValue: (m) => m.ccqPercent,
    breach: (v) => v < 50,
    clear: (v) => v > 55,
    threshold: () => 50,
    formatMessage: (name, v) =>
      `Calidad de conexión crítica en ${name}: ${v}% (umbral: 50%)`
  },
  {
    metric: 'cpu_load_percent',
    severity: 'WARNING',
    getValue: (m) => m.cpuLoadPercent,
    breach: (v) => v > 80,
    clear: (v) => v < 75,
    threshold: () => 80,
    formatMessage: (name, v) =>
      `Uso de CPU elevado en ${name}: ${v}% (umbral: 80%)`
  },
  {
    metric: 'memory_used_percent',
    severity: 'WARNING',
    getValue: (m) => m.memoryUsedPercent,
    breach: (v) => v > 85,
    clear: (v) => v < 80,
    threshold: () => 85,
    formatMessage: (name, v) =>
      `Uso de memoria elevado en ${name}: ${v}% (umbral: 85%)`
  },
  {
    metric: 'throughput_tx_bps',
    severity: 'WARNING',
    getValue: (m, ctx) =>
      ctx.linkCapacityBps
        ? m.throughputTxBps !== null
          ? (m.throughputTxBps / ctx.linkCapacityBps) * 100
          : null
        : null,
    breach: (v) => v > 95,
    clear: (v) => v < 90,
    threshold: () => 95,
    formatMessage: (name, v) =>
      `Capacidad de enlace casi saturada en ${name}: ${v.toFixed(1)}% (umbral: 95%)`
  },
  {
    metric: 'clients_connected',
    severity: 'WARNING',
    getValue: (m, ctx) =>
      ctx.clientsProvisionedLimit !== null &&
      m.clientsConnected !== null
        ? m.clientsConnected
        : null,
    breach: (v, ctx) =>
      ctx.clientsProvisionedLimit !== null &&
      v > ctx.clientsProvisionedLimit,
    clear: (v, ctx) =>
      ctx.clientsProvisionedLimit !== null &&
      v <= ctx.clientsProvisionedLimit,
    threshold: (ctx) => ctx.clientsProvisionedLimit ?? 0,
    formatMessage: (name, v, t) =>
      `Clientes conectados superan el límite en ${name}: ${v} (límite: ${t})`
  }
];

export class WirelessAlertEvaluator
  implements IWirelessAlertEvaluator
{
  evaluate(
    metrics: WirelessMetrics,
    activeAlerts: Map<string, WirelessAlertRecord>,
    context: EvaluationContext
  ): AlertDecision[] {
    const decisions: AlertDecision[] = [];

    for (const def of WIRELESS_THRESHOLDS) {
      const value = def.getValue(metrics, context);
      if (value === null) continue;

      const key = `${def.metric}:${def.severity}`;
      const activeAlert = activeAlerts.get(key);
      const threshold = def.threshold(context);

      if (activeAlert) {
        if (def.clear(value, context)) {
          decisions.push({
            metric: def.metric,
            action: 'CLEAR',
            severity: def.severity,
            currentValue: value,
            threshold,
            message: def.formatMessage(
              context.deviceName,
              value,
              threshold
            )
          });
        }
      } else {
        if (def.breach(value, context)) {
          decisions.push({
            metric: def.metric,
            action: 'OPEN',
            severity: def.severity,
            currentValue: value,
            threshold,
            message: def.formatMessage(
              context.deviceName,
              value,
              threshold
            )
          });
        }
      }
    }

    const lanStatus = metrics.lanStatus;
    const lanKey = 'lan_status:CRITICAL';
    const activeLanAlert = activeAlerts.get(lanKey);

    if (lanStatus !== null) {
      if (lanStatus === 'DOWN' && !activeLanAlert) {
        decisions.push({
          metric: 'lan_status',
          action: 'OPEN',
          severity: 'CRITICAL',
          currentValue: 0,
          threshold: 0,
          message: `Puerto LAN caído en equipo ${context.deviceName}`
        });
      } else if (lanStatus === 'UP' && activeLanAlert) {
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

    return decisions;
  }
}
