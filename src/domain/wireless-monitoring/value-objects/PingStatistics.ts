import { ValueObject } from 'domain/shared/core';

interface PingStatisticsProps {
  readonly sent: number;
  readonly received: number;
  readonly lossPercent: number;
  readonly minMs: number | null;
  readonly avgMs: number | null;
  readonly maxMs: number | null;
  readonly jitterMs: number | null;
  readonly spikeCount: number;
}

export const LATENCY_SPIKE_MS = 150;

export class PingStatistics extends ValueObject<PingStatisticsProps> {
  private constructor(props: PingStatisticsProps) {
    super(props);
  }

  get sent(): number {
    return this._props.sent;
  }

  get received(): number {
    return this._props.received;
  }

  get lossPercent(): number {
    return this._props.lossPercent;
  }

  get minMs(): number | null {
    return this._props.minMs;
  }

  get avgMs(): number | null {
    return this._props.avgMs;
  }

  get maxMs(): number | null {
    return this._props.maxMs;
  }

  get jitterMs(): number | null {
    return this._props.jitterMs;
  }

  get spikeCount(): number {
    return this._props.spikeCount;
  }

  // one entry per probe in send order: the RTT in ms, or null for no reply
  static fromReplies(
    replies: ReadonlyArray<number | null>
  ): PingStatistics {
    const rtts = replies.filter((r): r is number => r !== null);
    const sent = replies.length;
    const received = rtts.length;

    if (received === 0) {
      return new PingStatistics({
        sent,
        received,
        lossPercent: sent === 0 ? 0 : 100,
        minMs: null,
        avgMs: null,
        maxMs: null,
        jitterMs: null,
        spikeCount: 0
      });
    }

    // mean delta between consecutive replies — how unsteady the link is,
    // independent of how far away the device sits
    let jitterMs: number | null = null;
    if (rtts.length >= 2) {
      let deltaSum = 0;
      for (let i = 1; i < rtts.length; i++) {
        deltaSum += Math.abs(rtts[i]! - rtts[i - 1]!);
      }
      jitterMs = round(deltaSum / (rtts.length - 1));
    }

    return new PingStatistics({
      sent,
      received,
      lossPercent: round(((sent - received) / sent) * 100),
      minMs: round(Math.min(...rtts)),
      avgMs: round(rtts.reduce((a, b) => a + b, 0) / received),
      maxMs: round(Math.max(...rtts)),
      jitterMs,
      spikeCount: rtts.filter((r) => r >= LATENCY_SPIKE_MS).length
    });
  }
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
