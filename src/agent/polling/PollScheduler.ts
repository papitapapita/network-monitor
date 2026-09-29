import { randomUUID } from 'crypto';
import type { ILogger } from 'application/shared/interfaces';
import type { PingCycleOutcome } from 'application/device-monitoring/services/PingCycleProbe';
import { ConfigDeviceWire, PingResultWire } from 'agent/protocol';

export interface ICycleProbe {
  run(
    ipAddress: string,
    maxAttempts: number
  ): Promise<PingCycleOutcome>;
}

export interface PollSchedulerOptions {
  tickMs: number;
  // Enough to poll a few hundred devices on a one-minute interval while a
  // share of them sit through their full retry budget, without flooding the
  // PC with ping processes.
  maxConcurrent: number;
  now: () => number;
  newId: () => string;
}

const DEFAULTS: PollSchedulerOptions = {
  tickMs: 1_000,
  maxConcurrent: 32,
  now: () => Date.now(),
  newId: () => randomUUID()
};

interface ScheduledDevice {
  target: ConfigDeviceWire;
  nextDueAt: number;
  running: boolean;
}

// Polls each configured device on its own interval, one cycle at a time per
// device, and hands every finished cycle to `onResult`. It measures and never
// judges: whether a result changes the device is the backend's call.
export class PollScheduler {
  private readonly devices = new Map<number, ScheduledDevice>();
  private readonly options: PollSchedulerOptions;
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = 0;
  private readonly inFlight = new Set<Promise<void>>();

  constructor(
    private readonly probe: ICycleProbe,
    private readonly onResult: (result: PingResultWire) => void,
    private readonly logger: ILogger,
    options: Partial<PollSchedulerOptions> = {}
  ) {
    this.options = { ...DEFAULTS, ...options };
  }

  get deviceCount(): number {
    return this.devices.size;
  }

  get isRunning(): boolean {
    return this.timer !== null;
  }

  // A new device is polled right away. A known one keeps its rhythm, pulled
  // forward if its interval got shorter. A device no longer listed is
  // dropped; a cycle already running for it still reports, and the backend
  // discards that result if the device has moved (AGT-043).
  applyConfig(targets: ConfigDeviceWire[]): void {
    const now = this.options.now();
    const listed = new Set<number>();
    for (const target of targets) {
      listed.add(target.d);
      const known = this.devices.get(target.d);
      if (!known) {
        this.devices.set(target.d, {
          target,
          nextDueAt: now,
          running: false
        });
        continue;
      }
      if (target.intervalSeconds !== known.target.intervalSeconds) {
        known.nextDueAt = Math.min(
          known.nextDueAt,
          now + target.intervalSeconds * 1000
        );
      }
      known.target = target;
    }
    for (const d of this.devices.keys()) {
      if (!listed.has(d)) this.devices.delete(d);
    }
  }

  // R11: after a reconnect every device is measured at once, so the backend
  // is current within seconds even for devices on a long interval.
  pollAllNow(): void {
    const now = this.options.now();
    for (const device of this.devices.values()) {
      device.nextDueAt = Math.min(device.nextDueAt, now);
    }
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), this.options.tickMs);
    this.tick();
  }

  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  clear(): void {
    this.devices.clear();
  }

  // Waits for the cycles already running, so their results are handed over
  // before the caller persists anything.
  async drain(): Promise<void> {
    await Promise.all([...this.inFlight]);
  }

  // Starts every due cycle the concurrency limit allows, most overdue first.
  tick(): void {
    const now = this.options.now();
    const due = [...this.devices.values()]
      .filter((device) => !device.running && device.nextDueAt <= now)
      .sort((a, b) => a.nextDueAt - b.nextDueAt);

    for (const device of due) {
      if (this.running >= this.options.maxConcurrent) return;
      const cycle = this.runCycle(device);
      this.inFlight.add(cycle);
      void cycle.finally(() => this.inFlight.delete(cycle));
    }
  }

  private async runCycle(device: ScheduledDevice): Promise<void> {
    const { d, ip, intervalSeconds, failuresBeforeDown } =
      device.target;
    const startedAt = this.options.now();
    device.running = true;
    device.nextDueAt = startedAt + intervalSeconds * 1000;
    this.running++;

    let outcome: PingCycleOutcome;
    try {
      outcome = await this.probe.run(
        ip,
        Math.max(1, failuresBeforeDown)
      );
    } catch (error) {
      outcome = {
        kind: 'probe-unavailable',
        error: error instanceof Error ? error.message : String(error),
        attempts: 1
      };
    } finally {
      device.running = false;
      this.running--;
    }

    try {
      this.onResult(
        toWire(this.options.newId(), d, startedAt, outcome)
      );
    } catch (error) {
      this.logger.error(
        'Could not keep a poll result',
        error instanceof Error ? error : new Error(String(error)),
        { deviceIndex: d }
      );
    }
  }
}

function toWire(
  id: string,
  d: number,
  at: number,
  outcome: PingCycleOutcome
): PingResultWire {
  if (outcome.kind === 'probe-unavailable') {
    return {
      id,
      d,
      at,
      probeError: outcome.error.slice(0, 500),
      attempts: outcome.attempts
    };
  }
  return {
    id,
    d,
    at,
    reachable: outcome.isReachable,
    latencyMs: outcome.isReachable ? outcome.latencyMs : null,
    attempts: outcome.attempts
  };
}
