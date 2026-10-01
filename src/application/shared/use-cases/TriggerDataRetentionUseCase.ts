import { Result } from 'domain/shared/core';
import { IVendorSettingsRepository } from 'domain/shared/interfaces';
import { PurgeOldPingResultsUseCase } from 'application/device-monitoring/use-cases';
import { PurgeOldAlertsUseCase } from 'application/notifications/use-cases';
import {
  PurgeOldWirelessSnapshotsUseCase,
  PurgeOldWirelessAlertRecordsUseCase
} from 'application/wireless-monitoring/use-cases';

export interface DataRetentionSummary {
  pingResultsDeleted: number;
  alertsDeleted: number;
  wirelessSnapshotsDeleted: number;
  wirelessAlertRecordsDeleted: number;
}

export class TriggerDataRetentionUseCase {
  constructor(
    private readonly purgeOldPingResults: PurgeOldPingResultsUseCase,
    private readonly purgeOldAlerts: PurgeOldAlertsUseCase,
    private readonly purgeOldWirelessSnapshots: PurgeOldWirelessSnapshotsUseCase,
    private readonly purgeOldWirelessAlertRecords: PurgeOldWirelessAlertRecordsUseCase,
    private readonly vendorSettings: IVendorSettingsRepository
  ) {}

  // The windows are the vendor's settings (INS-028), read on each run.
  async execute(): Promise<Result<DataRetentionSummary>> {
    const settings = await this.vendorSettings.get();
    if (settings.isFailure) {
      return Result.fail(
        `Failed to read the retention windows: ${settings.error}`
      );
    }
    const windows = settings.value;

    const [
      pingResult,
      alertResult,
      snapshotResult,
      wirelessAlertResult
    ] = await Promise.all([
      this.purgeOldPingResults.execute(
        windows.pingResultRetentionDays
      ),
      this.purgeOldAlerts.execute(windows.alertRetentionDays),
      this.purgeOldWirelessSnapshots.execute(
        windows.wirelessSnapshotRetentionDays
      ),
      this.purgeOldWirelessAlertRecords.execute(
        windows.wirelessAlertRecordRetentionDays
      )
    ]);

    if (pingResult.isFailure) {
      return Result.fail(
        `Ping results purge failed: ${pingResult.error}`
      );
    }
    if (alertResult.isFailure) {
      return Result.fail(`Alerts purge failed: ${alertResult.error}`);
    }
    if (snapshotResult.isFailure) {
      return Result.fail(
        `Wireless snapshots purge failed: ${snapshotResult.error}`
      );
    }
    if (wirelessAlertResult.isFailure) {
      return Result.fail(
        `Wireless alert records purge failed: ${wirelessAlertResult.error}`
      );
    }

    return Result.ok({
      pingResultsDeleted: pingResult.value,
      alertsDeleted: alertResult.value,
      wirelessSnapshotsDeleted: snapshotResult.value,
      wirelessAlertRecordsDeleted: wirelessAlertResult.value
    });
  }
}
