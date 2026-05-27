import { IWirelessPollingConfigRepository } from 'domain/wireless-monitoring/repository';
import { PollWirelessDeviceUseCase } from 'application/wireless-monitoring/use-cases';
import { ILogger } from 'application/shared/interfaces';

interface OrchestratorConfig {
  checkIntervalMs?: number;
  maxConcurrentPolls?: number;
}

export class WirelessPollingOrchestrator {
  private readonly checkIntervalMs: number;
  private readonly maxConcurrentPolls: number;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;
  private activePolls = new Set<string>();

  constructor(
    private readonly wirelessPollingConfigRepo: IWirelessPollingConfigRepository,
    private readonly pollWirelessDeviceUseCase: PollWirelessDeviceUseCase,
    config: OrchestratorConfig = {},
    private readonly logger: ILogger
  ) {
    this.checkIntervalMs = config.checkIntervalMs ?? 10_000;
    this.maxConcurrentPolls = config.maxConcurrentPolls ?? 10;
  }

  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.logger.info('[WirelessPollingOrchestrator] Started', {
      checkIntervalMs: this.checkIntervalMs,
      maxConcurrentPolls: this.maxConcurrentPolls
    });

    void this.pollDevices();
    this.intervalId = setInterval(
      () => void this.pollDevices(),
      this.checkIntervalMs
    );
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    const maxWaitMs = 30_000;
    const startWait = Date.now();
    while (
      this.activePolls.size > 0 &&
      Date.now() - startWait < maxWaitMs
    ) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    this.logger.info('[WirelessPollingOrchestrator] Stopped');
  }

  isActive(): boolean {
    return this.isRunning;
  }

  private async pollDevices(): Promise<void> {
    if (!this.isRunning) return;

    try {
      const dueResult =
        await this.wirelessPollingConfigRepo.findAllDue(new Date());
      if (dueResult.isFailure) {
        this.logger.warn(
          '[WirelessPollingOrchestrator] Failed to get due devices',
          {
            error: dueResult.error
          }
        );
        return;
      }

      const dueDevices = dueResult.value.filter(
        (d) => !this.activePolls.has(d.deviceId.toValue())
      );

      const available =
        this.maxConcurrentPolls - this.activePolls.size;
      const batch = dueDevices.slice(0, Math.max(0, available));

      await Promise.all(
        batch.map((device) =>
          this.pollDevice(device.deviceId.toValue())
        )
      );
    } catch (error) {
      this.logger.warn(
        '[WirelessPollingOrchestrator] Unexpected error in pollDevices',
        {
          error:
            error instanceof Error ? error.message : String(error)
        }
      );
    }
  }

  private async pollDevice(deviceId: string): Promise<void> {
    this.activePolls.add(deviceId);
    const startMs = Date.now();
    try {
      await this.pollWirelessDeviceUseCase.execute({
        deviceId,
        forceExecution: false
      });
      const durationMs = Date.now() - startMs;
      if (durationMs > 30_000) {
        this.logger.warn(
          '[WirelessPollingOrchestrator] Poll duration exceeded 30s',
          {
            deviceId,
            durationMs
          }
        );
      }
    } catch (error) {
      this.logger.warn(
        '[WirelessPollingOrchestrator] Poll failed for device',
        {
          deviceId,
          error:
            error instanceof Error ? error.message : String(error)
        }
      );
    } finally {
      this.activePolls.delete(deviceId);
    }
  }
}
