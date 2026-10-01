import { PurgeOldPingResultsUseCase } from 'application/device-monitoring/use-cases';
import { PurgeOldAlertsUseCase } from 'application/notifications/use-cases';
import {
  PurgeOldWirelessSnapshotsUseCase,
  PurgeOldWirelessAlertRecordsUseCase
} from 'application/wireless-monitoring/use-cases';
import { PurgeDeletedDevicesUseCase } from 'application/device-inventory/use-cases';
import { ILogger } from 'application/shared/interfaces';
import { IVendorSettingsRepository } from 'domain/shared/interfaces';

// The retention windows themselves are the vendor's settings (INS-028), read
// at every run so a change applies from the next one.
interface RetentionConfig {
  // Grace period, not a retention window: how long a soft-deleted device stays
  // restorable before it is removed for good.
  deletedDeviceGraceDays: number;
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
    private readonly purgeDeletedDevices: PurgeDeletedDevicesUseCase,
    private readonly config: RetentionConfig,
    private readonly vendorSettings: IVendorSettingsRepository,
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
      deletedDeviceGraceDays: this.config.deletedDeviceGraceDays
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

    // Unknown windows delete nothing: the next run tries again.
    const settings = await this.vendorSettings.get();
    if (settings.isFailure) {
      this.logger.error(
        '[DataRetentionOrchestrator] Failed to read the retention windows; purge skipped',
        new Error(settings.error)
      );
      return;
    }
    const windows = settings.value;

    this.logger.info('[DataRetentionOrchestrator] Running purge', {
      pingResultRetentionDays: windows.pingResultRetentionDays,
      alertRetentionDays: windows.alertRetentionDays,
      wirelessSnapshotRetentionDays:
        windows.wirelessSnapshotRetentionDays,
      wirelessAlertRecordRetentionDays:
        windows.wirelessAlertRecordRetentionDays
    });

    const results = await Promise.all([
      this.purgeOldPingResults.execute(
        windows.pingResultRetentionDays
      ),
      this.purgeOldAlerts.execute(windows.alertRetentionDays),
      this.purgeOldWirelessSnapshots.execute(
        windows.wirelessSnapshotRetentionDays
      ),
      this.purgeOldWirelessAlertRecords.execute(
        windows.wirelessAlertRecordRetentionDays
      ),
      this.purgeDeletedDevices.execute(
        this.config.deletedDeviceGraceDays
      )
    ]);

    const [
      pingResult,
      alertResult,
      snapshotResult,
      wirelessAlertResult,
      deletedDeviceResult
    ] = results;

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
    if (deletedDeviceResult.isFailure) {
      this.logger.error(
        '[DataRetentionOrchestrator] Failed to purge deleted devices',
        new Error(deletedDeviceResult.error)
      );
    }

    this.logger.info('[DataRetentionOrchestrator] Purge complete', {
      pingResultsDeleted: pingResult.isSuccess ? pingResult.value : 0,
      alertsDeleted: alertResult.isSuccess ? alertResult.value : 0,
      wirelessSnapshotsDeleted: snapshotResult.isSuccess
        ? snapshotResult.value
        : 0,
      wirelessAlertRecordsDeleted: wirelessAlertResult.isSuccess
        ? wirelessAlertResult.value
        : 0,
      deletedDevicesPurged: deletedDeviceResult.isSuccess
        ? deletedDeviceResult.value
        : 0
    });
  }
}
