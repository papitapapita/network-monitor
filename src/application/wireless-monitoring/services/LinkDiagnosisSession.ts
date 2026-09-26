import {
  IWirelessAlertEvaluator,
  ILinkDiagnosisAnalyzer,
  PingStatistics,
  RadioDecisionTally
} from 'domain/wireless-monitoring';
import {
  LinkDiagnosisTarget,
  WirelessCollectionResult
} from '../interfaces';
import {
  LinkDiagnosisDTO,
  LinkDiagnosisReportDTO,
  LinkDiagnosisStatus,
  PingHop,
  PingSampleDTO,
  PingStatisticsDTO,
  RadioSampleDTO,
  ThroughputSummaryDTO
} from '../dtos';
import { CollectedMetricsMapper } from '../mappers';

interface CounterReading {
  at: Date;
  tx: bigint;
  rx: bigint;
}

// Accumulates the samples of one live diagnosis and turns them into a
// report. Holds no timers — the runner decides when to sample — so it stays
// deterministic under test.
export class LinkDiagnosisSession {
  readonly endsAt: Date;
  private status: LinkDiagnosisStatus = 'RUNNING';
  private endedAt: Date | null = null;

  private readonly pingSamples: PingSampleDTO[] = [];
  private readonly targetReplies: (number | null)[] = [];
  private readonly parentReplies: (number | null)[] = [];

  private readonly radioSamples: RadioSampleDTO[] = [];
  private radioOk = 0;
  private radioFailures = 0;
  private readonly tally = new Map<string, RadioDecisionTally>();
  private previousCounters: CounterReading | null = null;

  private deviceName: string | null = null;
  private parentName: string | null = null;

  constructor(
    private readonly target: LinkDiagnosisTarget,
    readonly startedAt: Date,
    private readonly evaluator: IWirelessAlertEvaluator,
    private readonly analyzer: ILinkDiagnosisAnalyzer
  ) {
    this.endsAt = new Date(
      startedAt.getTime() + target.durationSeconds * 1000
    );
  }

  get deviceId(): string {
    return this.target.deviceId;
  }

  get isRunning(): boolean {
    return this.status === 'RUNNING';
  }

  get endTime(): Date | null {
    return this.endedAt;
  }

  // a probe still in flight when the session ends is dropped, not counted
  recordPing(
    hop: PingHop,
    latencyMs: number | null,
    at: Date
  ): PingSampleDTO | null {
    if (!this.isRunning) return null;

    (hop === 'TARGET' ? this.targetReplies : this.parentReplies).push(
      latencyMs
    );
    const sample: PingSampleDTO = {
      hop,
      at: at.toISOString(),
      latencyMs
    };
    this.pingSamples.push(sample);
    return sample;
  }

  recordRadio(
    collected: WirelessCollectionResult,
    at: Date
  ): RadioSampleDTO | null {
    if (!this.isRunning) return null;

    const throughput = this.liveThroughput(collected, at);
    const metricsResult = CollectedMetricsMapper.toMetrics(
      collected,
      throughput
    );
    if (metricsResult.isFailure) {
      return this.recordRadioFailure(
        `Invalid metrics from radio: ${metricsResult.error}`,
        at
      );
    }
    const metrics = metricsResult.value;

    this.deviceName = collected.deviceName ?? this.deviceName;
    if (this.target.deviceType === 'STATION') {
      this.parentName = collected.remoteApName ?? this.parentName;
    }

    // an empty active set makes every rule report what it sees right now,
    // with no hysteresis carried over from the scheduled poller
    const decisions = this.evaluator
      .evaluate(metrics, new Map(), {
        deviceName: this.displayName(),
        deviceModel: collected.deviceModel,
        linkCapacityKbps: this.target.linkCapacityKbps,
        clientsProvisionedLimit: this.target.clientsProvisionedLimit,
        provisionedLanSpeedMbps: this.target.provisionedLanSpeedMbps,
        previousMetrics: null,
        collectedAt: at
      })
      .filter((d) => d.action === 'OPEN');

    for (const decision of decisions) {
      const key = `${decision.metric}:${decision.severity}`;
      const existing = this.tally.get(key);
      this.tally.set(key, {
        decision,
        occurrences: (existing?.occurrences ?? 0) + 1
      });
    }

    this.radioOk++;
    const sample: RadioSampleDTO = {
      at: at.toISOString(),
      ok: true,
      error: null,
      throughputTxBps: metrics.throughputTxBps,
      throughputRxBps: metrics.throughputRxBps,
      capacityTxKbps: metrics.capacityTxKbps,
      capacityRxKbps: metrics.capacityRxKbps,
      signalRxDbm: metrics.signalRxDbm,
      signalTxDbm: metrics.signalTxDbm,
      noiseFloorDbm: metrics.noiseFloorDbm,
      snrDb: metrics.snrDb,
      ccqPercent: metrics.ccqPercent,
      radioLatencyMs: metrics.latencyMs,
      cpuLoadPercent: metrics.cpuLoadPercent,
      lanStatus: metrics.lanStatus,
      lanSpeedMbps: metrics.lanSpeedMbps
    };
    this.radioSamples.push(sample);
    return sample;
  }

  recordRadioFailure(error: string, at: Date): RadioSampleDTO | null {
    if (!this.isRunning) return null;

    this.radioFailures++;
    const sample: RadioSampleDTO = {
      at: at.toISOString(),
      ok: false,
      error,
      throughputTxBps: null,
      throughputRxBps: null,
      capacityTxKbps: null,
      capacityRxKbps: null,
      signalRxDbm: null,
      signalTxDbm: null,
      noiseFloorDbm: null,
      snrDb: null,
      ccqPercent: null,
      radioLatencyMs: null,
      cpuLoadPercent: null,
      lanStatus: null,
      lanSpeedMbps: null
    };
    this.radioSamples.push(sample);
    return sample;
  }

  finish(status: 'COMPLETED' | 'STOPPED', at: Date): void {
    if (!this.isRunning) return;
    this.status = status;
    this.endedAt = at;
  }

  report(now: Date): LinkDiagnosisReportDTO {
    const target = PingStatistics.fromReplies(this.targetReplies);
    const parent = this.target.parent
      ? PingStatistics.fromReplies(this.parentReplies)
      : null;

    const result = this.analyzer.analyze({
      deviceName: this.displayName(),
      parentName: this.parentName,
      target,
      parent,
      radioSamples: this.radioOk,
      radioFailures: this.radioFailures,
      radioDecisions: [...this.tally.values()]
    });

    return {
      verdict: result.verdict,
      faultLocation: result.faultLocation,
      summary: result.summary,
      findings: result.findings,
      target: toStatsDTO(target),
      parent: parent ? toStatsDTO(parent) : null,
      radio: {
        samples: this.radioOk,
        failures: this.radioFailures,
        throughput: this.throughputSummary()
      },
      generatedAt: now.toISOString()
    };
  }

  toDTO(now: Date, withSamples: boolean): LinkDiagnosisDTO {
    const dto: LinkDiagnosisDTO = {
      deviceId: this.target.deviceId,
      deviceType: this.target.deviceType,
      status: this.status,
      startedAt: this.startedAt.toISOString(),
      endsAt: this.endsAt.toISOString(),
      endedAt: this.endedAt?.toISOString() ?? null,
      durationSeconds: this.target.durationSeconds,
      target: {
        deviceId: this.target.deviceId,
        ipAddress: this.target.ipAddress,
        name: this.deviceName
      },
      parent: this.target.parent
        ? {
            deviceId: this.target.parent.deviceId,
            ipAddress: this.target.parent.ipAddress,
            name: this.parentName
          }
        : null,
      report: this.report(this.endedAt ?? now)
    };
    if (withSamples) {
      dto.samples = {
        ping: [...this.pingSamples],
        radio: [...this.radioSamples]
      };
    }
    return dto;
  }

  private displayName(): string {
    return this.deviceName ?? this.target.ipAddress;
  }

  // Byte-counter deltas give the rate over exactly the sampling window; the
  // firmware's own throughput figure is the fallback when counters are
  // missing, and the only option on the first sample.
  private liveThroughput(
    collected: WirelessCollectionResult,
    at: Date
  ): { txBps: number | null; rxBps: number | null } {
    const fallback = {
      txBps: collected.throughputTxBps,
      rxBps: collected.throughputRxBps
    };
    if (
      collected.wirelessTxBytes === null ||
      collected.wirelessRxBytes === null
    ) {
      this.previousCounters = null;
      return fallback;
    }

    const previous = this.previousCounters;
    this.previousCounters = {
      at,
      tx: collected.wirelessTxBytes,
      rx: collected.wirelessRxBytes
    };
    if (!previous) return fallback;

    const seconds = (at.getTime() - previous.at.getTime()) / 1000;
    const txDelta = collected.wirelessTxBytes - previous.tx;
    const rxDelta = collected.wirelessRxBytes - previous.rx;
    // a negative delta is a counter wrap or a radio reboot mid-session
    if (seconds <= 0 || txDelta < 0n || rxDelta < 0n) return fallback;

    return {
      txBps: Math.round((Number(txDelta) * 8) / seconds),
      rxBps: Math.round((Number(rxDelta) * 8) / seconds)
    };
  }

  private throughputSummary(): ThroughputSummaryDTO {
    const tx = this.radioSamples
      .map((s) => s.throughputTxBps)
      .filter((v): v is number => v !== null);
    const rx = this.radioSamples
      .map((s) => s.throughputRxBps)
      .filter((v): v is number => v !== null);

    return {
      avgTxBps: average(tx),
      avgRxBps: average(rx),
      peakTxBps: tx.length > 0 ? Math.max(...tx) : null,
      peakRxBps: rx.length > 0 ? Math.max(...rx) : null,
      linkCapacityKbps: this.target.linkCapacityKbps
    };
  }
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(
    values.reduce((a, b) => a + b, 0) / values.length
  );
}

function toStatsDTO(stats: PingStatistics): PingStatisticsDTO {
  return {
    sent: stats.sent,
    received: stats.received,
    lossPercent: stats.lossPercent,
    minMs: stats.minMs,
    avgMs: stats.avgMs,
    maxMs: stats.maxMs,
    jitterMs: stats.jitterMs,
    spikeCount: stats.spikeCount
  };
}
