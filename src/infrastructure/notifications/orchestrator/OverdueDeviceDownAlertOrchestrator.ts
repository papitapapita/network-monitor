import {
  RaiseOverdueDeviceDownAlertsUseCase,
  ResolveStrandedDeviceDownAlertsUseCase
} from 'application/notifications/use-cases';
import { ILogger } from 'application/shared/interfaces';

interface OrchestratorConfig {
  checkIntervalMs?: number;
}

export class OverdueDeviceDownAlertOrchestrator {
  private readonly checkIntervalMs: number;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;
  private isScanning = false;

  constructor(
    private readonly raiseOverdueDeviceDownAlertsUseCase: RaiseOverdueDeviceDownAlertsUseCase,
    private readonly resolveStrandedDeviceDownAlertsUseCase: ResolveStrandedDeviceDownAlertsUseCase,
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

  // A scan publishes one alert at a time, so on a night when many devices go
  // down it can outlast the interval. Two scans walking the same down list
  // would both find no open alert and both open one — and the recovery only
  // ever closes one of them (NOT-229). A tick that finds a scan still running
  // is skipped; the next one picks up whatever it missed.
  private async raiseOverdueAlerts(): Promise<void> {
    if (!this.isRunning || this.isScanning) return;

    this.isScanning = true;
    try {
      const result =
        await this.raiseOverdueDeviceDownAlertsUseCase.execute();
      if (result.isFailure) {
        this.logger.error(
          '[OverdueDeviceDownAlertOrchestrator] Scan failed',
          new Error(result.error)
        );
      }

      const strandedResult =
        await this.resolveStrandedDeviceDownAlertsUseCase.execute();
      if (strandedResult.isFailure) {
        this.logger.error(
          '[OverdueDeviceDownAlertOrchestrator] Stranded-alert sweep failed',
          new Error(strandedResult.error)
        );
      }
    } catch (error) {
      this.logger.error(
        '[OverdueDeviceDownAlertOrchestrator] Unexpected error',
        error as Error
      );
    } finally {
      this.isScanning = false;
    }
  }
}
