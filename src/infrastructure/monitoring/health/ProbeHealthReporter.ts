import { IProbeHealthReporter } from 'application/device-monitoring/interfaces';
import { ILogger } from 'application/shared/interfaces';

interface ProbeHealthConfig {
  degradedDeviceThreshold?: number;
  windowMs?: number;
}

// A missing or unusable ping program hits every device at once, so the useful
// signal is "N devices could not be probed", not N separate device problems.
// One alert on the way into that state, one on the way out.
export class ProbeHealthReporter implements IProbeHealthReporter {
  private readonly degradedDeviceThreshold: number;
  private readonly windowMs: number;
  private readonly failingDevices = new Map<string, number>();
  private isDegraded = false;

  constructor(
    private readonly logger: ILogger,
    config: ProbeHealthConfig = {}
  ) {
    this.degradedDeviceThreshold =
      config.degradedDeviceThreshold ?? 3;
    this.windowMs = config.windowMs ?? 120_000;
  }

  recordProbeExecutionFailure(deviceId: string, error: string): void {
    const now = Date.now();
    this.failingDevices.set(deviceId, now);
    this.prune(now);

    if (
      !this.isDegraded &&
      this.failingDevices.size >= this.degradedDeviceThreshold
    ) {
      this.isDegraded = true;
      this.logger.error(
        'Device monitoring degraded: the ping program could not be executed. ' +
          'Device statuses are stale, not confirmed.',
        undefined,
        {
          affectedDevices: this.failingDevices.size,
          lastError: error
        }
      );
    }
  }

  recordProbeExecuted(deviceId: string): void {
    this.failingDevices.delete(deviceId);
    this.prune(Date.now());

    if (this.isDegraded && this.failingDevices.size === 0) {
      this.isDegraded = false;
      this.logger.info(
        'Device monitoring recovered: the ping program is executing again.'
      );
    }
  }

  private prune(now: number): void {
    for (const [deviceId, at] of this.failingDevices) {
      if (now - at > this.windowMs) {
        this.failingDevices.delete(deviceId);
      }
    }
  }
}
