import { IPollingConfigurationRepository } from 'domain/device-monitoring/repository';
import { ExecutePollingCycleUseCase } from 'application/device-monitoring/use-cases';
import { ILogger } from 'application/shared/interfaces';

interface OrchestratorConfig {
  checkIntervalMs?: number;
  maxConcurrentPolls?: number;
}

export class PollingOrchestrator {
  private readonly checkIntervalMs: number;
  private readonly maxConcurrentPolls: number;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;
  private activePolls = new Set<string>();

  constructor(
    private readonly pollingConfigRepo: IPollingConfigurationRepository,
    private readonly executePollingCycleUseCase: ExecutePollingCycleUseCase,
    config: OrchestratorConfig = {},
    private readonly logger: ILogger
  ) {
    this.checkIntervalMs = config.checkIntervalMs ?? 10_000;
    this.maxConcurrentPolls = config.maxConcurrentPolls ?? 10;
  }

  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.logger.info('[PollingOrchestrator] Started', {
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

    // Wait for active polls to complete (max 30s)
    const maxWaitMs = 30_000;
    const startWait = Date.now();
    while (
      this.activePolls.size > 0 &&
      Date.now() - startWait < maxWaitMs
    ) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    this.logger.info('[PollingOrchestrator] Stopped');
  }

  isActive(): boolean {
    return this.isRunning;
  }

  private async pollDevices(): Promise<void> {
    if (!this.isRunning) return;

    try {
      const dueResult = await this.pollingConfigRepo.findAllDue(
        new Date()
      );
      if (dueResult.isFailure) {
        this.logger.error(
          '[PollingOrchestrator] Failed to get due devices',
          new Error(dueResult.error)
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
      this.logger.error(
        '[PollingOrchestrator] Unexpected error in pollDevices',
        error as Error
      );
    }
  }

  private async pollDevice(deviceId: string): Promise<void> {
    this.activePolls.add(deviceId);
    try {
      await this.executePollingCycleUseCase.execute({
        deviceId,
        forceExecution: false
      });
    } catch (error) {
      this.logger.error(
        '[PollingOrchestrator] Poll failed for device',
        error as Error,
        { deviceId }
      );
    } finally {
      this.activePolls.delete(deviceId);
    }
  }
}
