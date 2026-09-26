import { PingStatistics, LATENCY_SPIKE_MS } from '../value-objects';
import {
  DiagnosisFinding,
  DiagnosisHop,
  FaultLocation,
  ILinkDiagnosisAnalyzer,
  LinkDiagnosisInput,
  LinkDiagnosisResult,
  RadioDecisionTally
} from './ILinkDiagnosisAnalyzer';

// fewer probes than this and one lost packet reads as 50% loss
export const MIN_PROBES_FOR_VERDICT = 3;

const LOSS_WARNING_PERCENT = 2;
const LOSS_CRITICAL_PERCENT = 10;
// aligned with LatencyRule so a diagnosis and a standing alert agree
const AVG_LATENCY_WARNING_MS = 50;
const AVG_LATENCY_CRITICAL_MS = 150;
const JITTER_WARNING_MS = 30;
const SPIKE_RATIO_WARNING = 0.05;

const RADIO_UNREADABLE = 'radio_unreadable';

export class LinkDiagnosisAnalyzer implements ILinkDiagnosisAnalyzer {
  analyze(input: LinkDiagnosisInput): LinkDiagnosisResult {
    const enoughTarget = input.target.sent >= MIN_PROBES_FOR_VERDICT;
    if (!enoughTarget && input.radioSamples === 0) {
      return {
        verdict: 'INCONCLUSIVE',
        faultLocation: 'UNDETERMINED',
        summary:
          'Datos insuficientes: la prueba acaba de iniciar o no ha recibido muestras.',
        findings: []
      };
    }

    const parentLabel = input.parentName ?? 'el AP';
    const targetFindings = enoughTarget
      ? pingFindings('TARGET', input.target, input.deviceName)
      : [];
    const parentFindings = hasEnoughProbes(input.parent)
      ? pingFindings('PARENT', input.parent!, parentLabel)
      : [];
    const radioFindings = this.radioFindings(input, targetFindings);

    const findings = [
      ...targetFindings,
      ...parentFindings,
      ...radioFindings
    ];

    const faultLocation = this.locate(
      input,
      targetFindings,
      parentFindings,
      radioFindings
    );

    const verdict = findings.some((f) => f.severity === 'CRITICAL')
      ? 'FAILING'
      : findings.length > 0
        ? 'DEGRADED'
        : 'HEALTHY';

    return {
      verdict,
      faultLocation,
      summary: summarize(
        faultLocation,
        input.deviceName,
        hasEnoughProbes(input.parent) ? parentLabel : null
      ),
      findings
    };
  }

  private radioFindings(
    input: LinkDiagnosisInput,
    targetFindings: DiagnosisFinding[]
  ): DiagnosisFinding[] {
    if (input.radioSamples === 0) {
      // an unreachable device cannot answer HTTP either — saying so twice
      // adds nothing
      const unreachable = targetFindings.some(
        (f) => f.code === 'unreachable'
      );
      if (input.radioFailures > 0 && !unreachable) {
        return [
          {
            code: RADIO_UNREADABLE,
            hop: 'RADIO',
            severity: 'WARNING',
            value: input.radioFailures,
            threshold: null,
            message: `No se pudo leer el estado del radio de ${input.deviceName} (${input.radioFailures} intentos fallidos): revisar credenciales o acceso HTTP`
          }
        ];
      }
      return [];
    }

    // a rule has to hold for at least half the samples, so one noisy read
    // does not become a finding
    const persistent = input.radioDecisions.filter(
      (t) => t.occurrences * 2 >= input.radioSamples
    );

    const byMetric = new Map<string, RadioDecisionTally>();
    for (const tally of persistent) {
      const existing = byMetric.get(tally.decision.metric);
      if (
        !existing ||
        (tally.decision.severity === 'CRITICAL' &&
          existing.decision.severity === 'WARNING')
      ) {
        byMetric.set(tally.decision.metric, tally);
      }
    }

    return [...byMetric.values()].map(({ decision }) => ({
      code: decision.metric,
      hop: 'RADIO' as const,
      severity: decision.severity,
      value: decision.currentValue,
      threshold: decision.threshold,
      message: decision.message
    }));
  }

  private locate(
    input: LinkDiagnosisInput,
    targetFindings: DiagnosisFinding[],
    parentFindings: DiagnosisFinding[],
    radioFindings: DiagnosisFinding[]
  ): FaultLocation {
    const radioFaults = radioFindings.filter(
      (f) => f.code !== RADIO_UNREADABLE
    );
    const targetBad = targetFindings.length > 0;
    const parentBad = parentFindings.length > 0;
    const parentKnown = hasEnoughProbes(input.parent);

    if (!targetBad && !parentBad && radioFindings.length === 0) {
      return 'NONE';
    }
    if (parentBad) return 'UPSTREAM';
    if (targetBad && !parentKnown && radioFaults.length === 0) {
      return 'UNDETERMINED';
    }
    if (targetBad || radioFaults.length > 0) return 'TARGET_LINK';
    return 'UNDETERMINED';
  }
}

function pingFindings(
  hop: DiagnosisHop,
  stats: PingStatistics,
  label: string
): DiagnosisFinding[] {
  if (stats.received === 0) {
    return [
      {
        code: 'unreachable',
        hop,
        severity: 'CRITICAL',
        value: 100,
        threshold: null,
        message: `${label} no responde al ping (${stats.sent} de ${stats.sent} paquetes perdidos)`
      }
    ];
  }

  const findings: DiagnosisFinding[] = [];

  if (stats.lossPercent >= LOSS_WARNING_PERCENT) {
    const critical = stats.lossPercent >= LOSS_CRITICAL_PERCENT;
    findings.push({
      code: 'packet_loss',
      hop,
      severity: critical ? 'CRITICAL' : 'WARNING',
      value: stats.lossPercent,
      threshold: critical
        ? LOSS_CRITICAL_PERCENT
        : LOSS_WARNING_PERCENT,
      message: `Pérdida de paquetes hacia ${label}: ${stats.lossPercent}% (${stats.sent - stats.received} de ${stats.sent})`
    });
  }

  const avg = stats.avgMs!;
  if (avg > AVG_LATENCY_WARNING_MS) {
    const critical = avg > AVG_LATENCY_CRITICAL_MS;
    findings.push({
      code: 'high_latency',
      hop,
      severity: critical ? 'CRITICAL' : 'WARNING',
      value: avg,
      threshold: critical
        ? AVG_LATENCY_CRITICAL_MS
        : AVG_LATENCY_WARNING_MS,
      message: `Latencia ${critical ? 'crítica' : 'elevada'} hacia ${label}: promedio ${avg} ms, máx ${stats.maxMs} ms`
    });
  } else if (
    stats.spikeCount / stats.received >=
    SPIKE_RATIO_WARNING
  ) {
    // spikes only matter as their own finding while the average still
    // looks fine — otherwise high_latency already says it
    findings.push({
      code: 'latency_spikes',
      hop,
      severity: 'WARNING',
      value: stats.spikeCount,
      threshold: LATENCY_SPIKE_MS,
      message: `Picos de latencia hacia ${label}: ${stats.spikeCount} de ${stats.received} respuestas ≥ ${LATENCY_SPIKE_MS} ms (máx ${stats.maxMs} ms)`
    });
  }

  if (stats.jitterMs !== null && stats.jitterMs > JITTER_WARNING_MS) {
    findings.push({
      code: 'jitter',
      hop,
      severity: 'WARNING',
      value: stats.jitterMs,
      threshold: JITTER_WARNING_MS,
      message: `Latencia inestable hacia ${label}: jitter ${stats.jitterMs} ms`
    });
  }

  return findings;
}

function hasEnoughProbes(stats: PingStatistics | null): boolean {
  return stats !== null && stats.sent >= MIN_PROBES_FOR_VERDICT;
}

// parentLabel is null when no parent hop was measured
function summarize(
  location: FaultLocation,
  deviceName: string,
  parentLabel: string | null
): string {
  switch (location) {
    case 'NONE':
      return `Sin anomalías: ${deviceName} responde con normalidad.`;
    case 'TARGET_LINK':
      return parentLabel
        ? `Falla localizada en ${deviceName} o en su enlace: ${parentLabel} responde con normalidad.`
        : `Falla localizada en ${deviceName} o en su enlace.`;
    case 'UPSTREAM':
      return `${capitalize(parentLabel ?? 'el AP')} también presenta fallas: el problema está aguas arriba (AP o backhaul), no solo en ${deviceName}.`;
    case 'UNDETERMINED':
      return `${deviceName} presenta fallas, pero no hay un AP de referencia para localizar el origen.`;
  }
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
