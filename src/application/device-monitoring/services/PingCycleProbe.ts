import { IPingService } from '../interfaces';

export type PingCycleOutcome =
  | {
      kind: 'measured';
      isReachable: boolean;
      latencyMs: number | null;
      attempts: number;
    }
  | { kind: 'probe-unavailable'; error: string; attempts: number };

// The "measure" half of a poll cycle: no repositories, no domain state, so
// the on-site agent runs the exact same attempt loop the backend does.
export class PingCycleProbe {
  constructor(
    private readonly pingService: IPingService,
    private readonly retryDelayMs: number = 1_000,
    // Unset: the ping service's own default reply wait.
    private readonly timeoutMs?: number
  ) {}

  // failuresBeforeDown doubles as the intra-cycle attempt budget: the device
  // is only considered unreachable after all attempts fail within one cycle.
  async run(
    ipAddress: string,
    maxAttempts: number
  ): Promise<PingCycleOutcome> {
    // A failure to *run* the probe is a local fault, not an unreachable device.
    // Retry through it — spawn errors are often transient under load — and only
    // give up if no attempt ever produced a real answer.
    let probeRan = false;
    let lastProbeError: string | null = null;
    let attempts = 0;

    while (attempts < maxAttempts) {
      if (attempts > 0) {
        await new Promise((resolve) =>
          setTimeout(resolve, this.retryDelayMs)
        );
      }
      attempts++;
      const pingResult =
        this.timeoutMs === undefined
          ? await this.pingService.ping(ipAddress)
          : await this.pingService.ping(ipAddress, this.timeoutMs);
      if (pingResult.isFailure) {
        lastProbeError = pingResult.error;
        continue;
      }
      probeRan = true;
      if (pingResult.value.isReachable) {
        return {
          kind: 'measured',
          isReachable: true,
          latencyMs: pingResult.value.latencyMs,
          attempts
        };
      }
    }

    if (!probeRan) {
      return {
        kind: 'probe-unavailable',
        error: lastProbeError ?? 'unknown error',
        attempts
      };
    }
    return {
      kind: 'measured',
      isReachable: false,
      latencyMs: null,
      attempts
    };
  }
}
