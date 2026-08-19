import { Result } from 'domain/shared/core';
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

export interface DataRetentionConfig {
  pingResultRetentionDays: number;
  alertRetentionDays: number;
  wirelessSnapshotRetentionDays: number;
  wirelessAlertRecordRetentionDays: number;
}

export class TriggerDataRetentionUseCase {
  constructor(
    private readonly purgeOldPingResults: PurgeOldPingResultsUseCase,
    private readonly purgeOldAlerts: PurgeOldAlertsUseCase,
    private readonly purgeOldWirelessSnapshots: PurgeOldWirelessSnapshotsUseCase,
    private readonly purgeOldWirelessAlertRecords: PurgeOldWirelessAlertRecordsUseCase,
    private readonly config: DataRetentionConfig
  ) {}

  async execute(): Promise<Result<DataRetentionSummary>> {
    const [
      pingResult,
      alertResult,
      snapshotResult,
      wirelessAlertResult
    ] = await Promise.all([
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
