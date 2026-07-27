import { WirelessMetrics } from '../../value-objects';
import { WirelessAlertRecord } from '../../aggregates';
import {
  AlertDecision,
  EvaluationContext
} from '../IWirelessAlertEvaluator';
import { IAlertRule } from './IAlertRule';

const LATENCY_WARNING_MS = 50;
const LATENCY_CRITICAL_MS = 150;

export class LatencyRule implements IAlertRule {
  evaluate(
    metrics: WirelessMetrics,
    context: EvaluationContext,
    activeAlerts: Map<string, WirelessAlertRecord>
  ): AlertDecision[] {
    const latencyMs = metrics.latencyMs;
    if (latencyMs === null) return [];

    const decisions: AlertDecision[] = [];

    const warningKey = 'latency_ms:WARNING';
    const warningActive = activeAlerts.get(warningKey);

    if (!warningActive && latencyMs > LATENCY_WARNING_MS) {
      decisions.push({
        metric: 'latency_ms',
        action: 'OPEN',
        severity: 'WARNING',
        currentValue: latencyMs,
        threshold: LATENCY_WARNING_MS,
        message: `Latencia elevada en ${context.deviceName}: ${latencyMs} ms (umbral: ${LATENCY_WARNING_MS} ms)`
      });
    } else if (warningActive && latencyMs <= LATENCY_WARNING_MS) {
      decisions.push({
        metric: 'latency_ms',
        action: 'CLEAR',
        severity: 'WARNING',
        currentValue: latencyMs,
        threshold: LATENCY_WARNING_MS,
        message: `Latencia normalizada en ${context.deviceName}: ${latencyMs} ms`
      });
    }

    const criticalKey = 'latency_ms:CRITICAL';
    const criticalActive = activeAlerts.get(criticalKey);

    if (!criticalActive && latencyMs > LATENCY_CRITICAL_MS) {
      decisions.push({
        metric: 'latency_ms',
        action: 'OPEN',
        severity: 'CRITICAL',
        currentValue: latencyMs,
        threshold: LATENCY_CRITICAL_MS,
        message: `Latencia crítica en ${context.deviceName}: ${latencyMs} ms (umbral: ${LATENCY_CRITICAL_MS} ms)`
      });
    } else if (criticalActive && latencyMs <= LATENCY_CRITICAL_MS) {
      decisions.push({
        metric: 'latency_ms',
        action: 'CLEAR',
        severity: 'CRITICAL',
        currentValue: latencyMs,
        threshold: LATENCY_CRITICAL_MS,
        message: `Latencia crítica normalizada en ${context.deviceName}: ${latencyMs} ms`
      });
    }

    return decisions;
  }
}
