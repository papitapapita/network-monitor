// Source: src/application/shared/use-cases/TriggerDataRetentionUseCase.ts

import {
  TriggerDataRetentionUseCase,
  DataRetentionConfig,
  DataRetentionSummary
} from '../../../../src/application/shared/use-cases/TriggerDataRetentionUseCase';
import { PurgeOldPingResultsUseCase } from '../../../../src/application/device-monitoring/use-cases/PurgeOldPingResultsUseCase';
import { PurgeOldAlertsUseCase } from '../../../../src/application/notifications/use-cases/PurgeOldAlertsUseCase';
import { PurgeOldWirelessSnapshotsUseCase } from '../../../../src/application/wireless-monitoring/use-cases/PurgeOldWirelessSnapshotsUseCase';
import { PurgeOldWirelessAlertRecordsUseCase } from '../../../../src/application/wireless-monitoring/use-cases/PurgeOldWirelessAlertRecordsUseCase';
import { Result } from '../../../../src/domain/shared/core/Result';

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makePurgePingResults(): jest.Mocked<PurgeOldPingResultsUseCase> {
  return { execute: jest.fn() } as unknown as jest.Mocked<PurgeOldPingResultsUseCase>;
}

function makePurgeAlerts(): jest.Mocked<PurgeOldAlertsUseCase> {
  return { execute: jest.fn() } as unknown as jest.Mocked<PurgeOldAlertsUseCase>;
}

function makePurgeSnapshots(): jest.Mocked<PurgeOldWirelessSnapshotsUseCase> {
  return { execute: jest.fn() } as unknown as jest.Mocked<PurgeOldWirelessSnapshotsUseCase>;
}

function makePurgeAlertRecords(): jest.Mocked<PurgeOldWirelessAlertRecordsUseCase> {
  return { execute: jest.fn() } as unknown as jest.Mocked<PurgeOldWirelessAlertRecordsUseCase>;
}

function makeConfig(
  overrides: Partial<DataRetentionConfig> = {}
): DataRetentionConfig {
  return {
    pingResultRetentionDays: 30,
    alertRetentionDays: 90,
    wirelessSnapshotRetentionDays: 7,
    wirelessAlertRecordRetentionDays: 60,
    ...overrides
  };
}

// ---------------------------------------------------------------------------

describe('TriggerDataRetentionUseCase', () => {
  let purgePing: jest.Mocked<PurgeOldPingResultsUseCase>;
  let purgeAlerts: jest.Mocked<PurgeOldAlertsUseCase>;
  let purgeSnapshots: jest.Mocked<PurgeOldWirelessSnapshotsUseCase>;
  let purgeAlertRecords: jest.Mocked<PurgeOldWirelessAlertRecordsUseCase>;
  let config: DataRetentionConfig;
  let useCase: TriggerDataRetentionUseCase;

  beforeEach(() => {
    purgePing = makePurgePingResults();
    purgeAlerts = makePurgeAlerts();
    purgeSnapshots = makePurgeSnapshots();
    purgeAlertRecords = makePurgeAlertRecords();
    config = makeConfig();

    useCase = new TriggerDataRetentionUseCase(
      purgePing,
      purgeAlerts,
      purgeSnapshots,
      purgeAlertRecords,
      config
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  describe('execute()', () => {
    // -----------------------------------------------------------------------
    describe('happy path', () => {
      beforeEach(() => {
        purgePing.execute.mockResolvedValue(Result.ok(10));
        purgeAlerts.execute.mockResolvedValue(Result.ok(5));
        purgeSnapshots.execute.mockResolvedValue(Result.ok(20));
        purgeAlertRecords.execute.mockResolvedValue(Result.ok(3));
      });

      it('should call purgePing.execute with pingResultRetentionDays from config', async () => {
        await useCase.execute();

        expect(purgePing.execute).toHaveBeenCalledWith(
          config.pingResultRetentionDays
        );
      });

      it('should call purgeAlerts.execute with alertRetentionDays from config', async () => {
        await useCase.execute();

        expect(purgeAlerts.execute).toHaveBeenCalledWith(
          config.alertRetentionDays
        );
      });

      it('should call purgeSnapshots.execute with wirelessSnapshotRetentionDays from config', async () => {
        await useCase.execute();

        expect(purgeSnapshots.execute).toHaveBeenCalledWith(
          config.wirelessSnapshotRetentionDays
        );
      });

      it('should call purgeAlertRecords.execute with wirelessAlertRecordRetentionDays from config', async () => {
        await useCase.execute();

        expect(purgeAlertRecords.execute).toHaveBeenCalledWith(
          config.wirelessAlertRecordRetentionDays
        );
      });

      it('should call all four purge use cases', async () => {
        await useCase.execute();

        expect(purgePing.execute).toHaveBeenCalledTimes(1);
        expect(purgeAlerts.execute).toHaveBeenCalledTimes(1);
        expect(purgeSnapshots.execute).toHaveBeenCalledTimes(1);
        expect(purgeAlertRecords.execute).toHaveBeenCalledTimes(1);
      });

      it('should return Result.ok with all four deleted counts in the summary', async () => {
        const result = await useCase.execute();

        expect(result.isSuccess).toBe(true);
        const summary = result.value as DataRetentionSummary;
        expect(summary.pingResultsDeleted).toBe(10);
        expect(summary.alertsDeleted).toBe(5);
        expect(summary.wirelessSnapshotsDeleted).toBe(20);
        expect(summary.wirelessAlertRecordsDeleted).toBe(3);
      });

      it('should include zero counts in the summary when nothing was deleted', async () => {
        purgePing.execute.mockResolvedValue(Result.ok(0));
        purgeAlerts.execute.mockResolvedValue(Result.ok(0));
        purgeSnapshots.execute.mockResolvedValue(Result.ok(0));
        purgeAlertRecords.execute.mockResolvedValue(Result.ok(0));

        const result = await useCase.execute();

        expect(result.isSuccess).toBe(true);
        const summary = result.value as DataRetentionSummary;
        expect(summary.pingResultsDeleted).toBe(0);
        expect(summary.alertsDeleted).toBe(0);
        expect(summary.wirelessSnapshotsDeleted).toBe(0);
        expect(summary.wirelessAlertRecordsDeleted).toBe(0);
      });
    });

    // -----------------------------------------------------------------------
    describe('failure path — ping results purge fails', () => {
      it('should return Result.fail when purgePing returns a failure', async () => {
        purgePing.execute.mockResolvedValue(
          Result.fail('ping DB timeout')
        );
        purgeAlerts.execute.mockResolvedValue(Result.ok(0));
        purgeSnapshots.execute.mockResolvedValue(Result.ok(0));
        purgeAlertRecords.execute.mockResolvedValue(Result.ok(0));

        const result = await useCase.execute();

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Ping results purge failed');
        expect(result.error).toContain('ping DB timeout');
      });
    });

    // -----------------------------------------------------------------------
    describe('failure path — alerts purge fails', () => {
      it('should return Result.fail when purgeAlerts returns a failure', async () => {
        purgePing.execute.mockResolvedValue(Result.ok(0));
        purgeAlerts.execute.mockResolvedValue(
          Result.fail('alert write error')
        );
        purgeSnapshots.execute.mockResolvedValue(Result.ok(0));
        purgeAlertRecords.execute.mockResolvedValue(Result.ok(0));

        const result = await useCase.execute();

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Alerts purge failed');
        expect(result.error).toContain('alert write error');
      });
    });

    // -----------------------------------------------------------------------
    describe('failure path — wireless snapshots purge fails', () => {
      it('should return Result.fail when purgeSnapshots returns a failure', async () => {
        purgePing.execute.mockResolvedValue(Result.ok(0));
        purgeAlerts.execute.mockResolvedValue(Result.ok(0));
        purgeSnapshots.execute.mockResolvedValue(
          Result.fail('snapshot table locked')
        );
        purgeAlertRecords.execute.mockResolvedValue(Result.ok(0));

        const result = await useCase.execute();

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Wireless snapshots purge failed');
        expect(result.error).toContain('snapshot table locked');
      });
    });

    // -----------------------------------------------------------------------
    describe('failure path — wireless alert records purge fails', () => {
      it('should return Result.fail when purgeAlertRecords returns a failure', async () => {
        purgePing.execute.mockResolvedValue(Result.ok(0));
        purgeAlerts.execute.mockResolvedValue(Result.ok(0));
        purgeSnapshots.execute.mockResolvedValue(Result.ok(0));
        purgeAlertRecords.execute.mockResolvedValue(
          Result.fail('alert record I/O error')
        );

        const result = await useCase.execute();

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Wireless alert records purge failed');
        expect(result.error).toContain('alert record I/O error');
      });
    });

    // -----------------------------------------------------------------------
    describe('config propagation', () => {
      it('should forward a custom pingResultRetentionDays to purgePing', async () => {
        const customConfig = makeConfig({ pingResultRetentionDays: 14 });
        const customUseCase = new TriggerDataRetentionUseCase(
          purgePing,
          purgeAlerts,
          purgeSnapshots,
          purgeAlertRecords,
          customConfig
        );
        purgePing.execute.mockResolvedValue(Result.ok(0));
        purgeAlerts.execute.mockResolvedValue(Result.ok(0));
        purgeSnapshots.execute.mockResolvedValue(Result.ok(0));
        purgeAlertRecords.execute.mockResolvedValue(Result.ok(0));

        await customUseCase.execute();

        expect(purgePing.execute).toHaveBeenCalledWith(14);
      });

      it('should forward a custom alertRetentionDays to purgeAlerts', async () => {
        const customConfig = makeConfig({ alertRetentionDays: 180 });
        const customUseCase = new TriggerDataRetentionUseCase(
          purgePing,
          purgeAlerts,
          purgeSnapshots,
          purgeAlertRecords,
          customConfig
        );
        purgePing.execute.mockResolvedValue(Result.ok(0));
        purgeAlerts.execute.mockResolvedValue(Result.ok(0));
        purgeSnapshots.execute.mockResolvedValue(Result.ok(0));
        purgeAlertRecords.execute.mockResolvedValue(Result.ok(0));

        await customUseCase.execute();

        expect(purgeAlerts.execute).toHaveBeenCalledWith(180);
      });
    });
  });
});
