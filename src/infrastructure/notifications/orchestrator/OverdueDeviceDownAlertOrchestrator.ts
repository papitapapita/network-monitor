import { RaiseOverdueDeviceDownAlertsUseCase } from 'application/notifications/use-cases';
import { ILogger } from 'application/shared/interfaces';

interface OrchestratorConfig {
  checkIntervalMs?: number;
}

export class OverdueDeviceDownAlertOrchestrator {
  private readonly checkIntervalMs: number;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;

  constructor(
    private readonly raiseOverdueDeviceDownAlertsUseCase: RaiseOverdueDeviceDownAlertsUseCase,
    config: OrchestratorConfig = {},
    private readonly logger: ILogger
  ) {
    this.checkIntervalMs = config.checkIntervalMs ?? 60_000;
  }

  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.logger.info('[OverdueDeviceDownAlertOrchestrator] Started', {
      checkIntervalMs: this.checkIntervalMs
    });

    void this.raiseOverdueAlerts();
    this.intervalId = setInterval(
      () => void this.raiseOverdueAlerts(),
      this.checkIntervalMs
    );
  }

  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.logger.info('[OverdueDeviceDownAlertOrchestrator] Stopped');
  }

  isActive(): boolean {
    return this.isRunning;
  }

  private async raiseOverdueAlerts(): Promise<void> {
    if (!this.isRunning) return;

    try {
      const result =
        await this.raiseOverdueDeviceDownAlertsUseCase.execute();
      if (result.isFailure) {
        this.logger.error(
          '[OverdueDeviceDownAlertOrchestrator] Scan failed',
          new Error(result.error)
        );
      }
    } catch (error) {
      this.logger.error(
        '[OverdueDeviceDownAlertOrchestrator] Unexpected error',
        error as Error
      );
    }
  }
}
