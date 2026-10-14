import { WirelessMetrics } from '../value-objects';
import { AlertDecision } from './IWirelessAlertEvaluator';

// Metrics a single reading misjudges: a burst of retries, one slow frame or
// a momentary fade trips them while the link is fine (WLS-203).
export const CONFIRMED_ALERT_METRICS: ReadonlySet<string> = new Set([
  'ccq_percent',
  'latency_ms',
  'signal_rx_dbm',
  'signal_tx_dbm',
  'snr_db',
  'capacity_kbps'
]);

// Below this the radio sends too few frames for CCQ to mean anything: a
// handful of retries on an idle link reads as poor quality (WLS-204).
export const CCQ_IDLE_TRAFFIC_BPS = 500_000;

export interface ConfirmationSample {
  metrics: WirelessMetrics;
  decisions: AlertDecision[];
}

export interface AlertConfirmationOutcome {
  confirmed: AlertDecision[];
  rejected: AlertDecision[];
}

export function needsConfirmation(decision: AlertDecision): boolean {
  return (
    decision.action === 'OPEN' &&
    CONFIRMED_ALERT_METRICS.has(decision.metric)
  );
}

function isIdle(metrics: WirelessMetrics): boolean {
  const tx = metrics.throughputTxBps;
  const rx = metrics.throughputRxBps;
  if (tx === null || rx === null) return false;
  return tx + rx < CCQ_IDLE_TRAFFIC_BPS;
}

function breachesIn(
  candidate: AlertDecision,
  sample: ConfirmationSample
): boolean {
  if (candidate.metric === 'ccq_percent' && isIdle(sample.metrics)) {
    return false;
  }
  return sample.decisions.some(
    (d) =>
      d.action === 'OPEN' &&
      d.metric === candidate.metric &&
      d.severity === candidate.severity
  );
}

// With no reading to judge by, the alert opens as it would have: a radio
// that stops answering is more likely broken than fine.
export function confirmAlertDecisions(
  candidates: AlertDecision[],
  samples: ConfirmationSample[]
): AlertConfirmationOutcome {
  if (samples.length === 0) {
    return { confirmed: [...candidates], rejected: [] };
  }
  const confirmed: AlertDecision[] = [];
  const rejected: AlertDecision[] = [];
  for (const candidate of candidates) {
    const breaches = samples.filter((s) =>
      breachesIn(candidate, s)
    ).length;
    if (breaches * 2 > samples.length) {
      confirmed.push(candidate);
    } else {
      rejected.push(candidate);
    }
  }
  return { confirmed, rejected };
}
