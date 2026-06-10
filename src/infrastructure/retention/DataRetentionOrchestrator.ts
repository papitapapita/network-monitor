import { PurgeOldPingResultsUseCase } from 'application/device-monitoring/use-cases';
import { PurgeOldAlertsUseCase } from 'application/notifications/use-cases';
import {
  PurgeOldWirelessSnapshotsUseCase,
  PurgeOldWirelessAlertRecordsUseCase
} from 'application/wireless-monitoring/use-cases';
import { ILogger } from 'application/shared/interfaces';

interface RetentionConfig {
  pingResultRetentionDays: number;
  wirelessSnapshotRetentionDays: number;
  alertRetentionDays: number;
  wirelessAlertRecordRetentionDays: number;
  checkIntervalMs?: number;
}

export class DataRetentionOrchestrator {
  private readonly checkIntervalMs: number;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;

  constructor(
    private readonly purgeOldPingResults: PurgeOldPingResultsUseCase,
    private readonly purgeOldAlerts: PurgeOldAlertsUseCase,
    private readonly purgeOldWirelessSnapshots: PurgeOldWirelessSnapshotsUseCase,
    private readonly purgeOldWirelessAlertRecords: PurgeOldWirelessAlertRecordsUseCase,
    private readonly config: RetentionConfig,
    private readonly logger: ILogger
  ) {
    this.checkIntervalMs =
      config.checkIntervalMs ?? 24 * 60 * 60 * 1000;
  }

  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.logger.info('[DataRetentionOrchestrator] Started', {
      checkIntervalMs: this.checkIntervalMs,
      pingResultRetentionDays: this.config.pingResultRetentionDays,
      wirelessSnapshotRetentionDays:
        this.config.wirelessSnapshotRetentionDays,
      alertRetentionDays: this.config.alertRetentionDays,
      wirelessAlertRecordRetentionDays:
        this.config.wirelessAlertRecordRetentionDays
    });

    void this.runPurge();
    this.intervalId = setInterval(
      () => void this.runPurge(),
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

    this.logger.info('[DataRetentionOrchestrator] Stopped');
  }

  private async runPurge(): Promise<void> {
    if (!this.isRunning) return;

    this.logger.info('[DataRetentionOrchestrator] Running purge');

    const results = await Promise.all([
      this.purgeOldPingResults.execute(
        this.config.pingResultRetentionDays
      ),
      this.purgeOldAlerts.execute(this.config.alertRetentionDays),
      this.purgeOldWirelessSnapshots.execute(
        this.config.wirelessSnapshotRetentionDays
      ),
      this.purgeOldWirelessAlertRecords.execute(
        this.config.wirelessAlertRecordRetentionDays
      )
    ]);

    const [pingResult, alertResult, snapshotResult, wirelessAlertResult] =
      results;

    if (pingResult.isFailure) {
      this.logger.error(
        '[DataRetentionOrchestrator] Failed to purge ping results',
        new Error(pingResult.error)
      );
    }
    if (alertResult.isFailure) {
      this.logger.error(
        '[DataRetentionOrchestrator] Failed to purge alerts',
        new Error(alertResult.error)
      );
    }
    if (snapshotResult.isFailure) {
      this.logger.error(
        '[DataRetentionOrchestrator] Failed to purge wireless snapshots',
        new Error(snapshotResult.error)
      );
    }
    if (wirelessAlertResult.isFailure) {
      this.logger.error(
        '[DataRetentionOrchestrator] Failed to purge wireless alert records',
        new Error(wirelessAlertResult.error)
      );
    }

    this.logger.info('[DataRetentionOrchestrator] Purge complete', {
      pingResultsDeleted: pingResult.isSuccess
        ? pingResult.value
        : 0,
      alertsDeleted: alertResult.isSuccess ? alertResult.value : 0,
      wirelessSnapshotsDeleted: snapshotResult.isSuccess
        ? snapshotResult.value
        : 0,
      wirelessAlertRecordsDeleted: wirelessAlertResult.isSuccess
        ? wirelessAlertResult.value
        : 0
    });
  }
}
