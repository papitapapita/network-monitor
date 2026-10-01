// Source: src/infrastructure/retention/DataRetentionOrchestrator.ts

import { DataRetentionOrchestrator } from '../../../src/infrastructure/retention/DataRetentionOrchestrator';
import { PurgeOldPingResultsUseCase } from '../../../src/application/device-monitoring/use-cases/PurgeOldPingResultsUseCase';
import { PurgeOldAlertsUseCase } from '../../../src/application/notifications/use-cases/PurgeOldAlertsUseCase';
import { PurgeOldWirelessSnapshotsUseCase } from '../../../src/application/wireless-monitoring/use-cases/PurgeOldWirelessSnapshotsUseCase';
import { PurgeOldWirelessAlertRecordsUseCase } from '../../../src/application/wireless-monitoring/use-cases/PurgeOldWirelessAlertRecordsUseCase';
import { PurgeDeletedDevicesUseCase } from '../../../src/application/device-inventory/use-cases/PurgeDeletedDevicesUseCase';
import { ILogger } from '../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../src/domain/shared/core/Result';
import {
  makeVendorSettingsProps,
  vendorSettingsRepo
} from '../../fixtures/vendorSettings';
import { VendorSettings } from '../../../src/domain/shared/value-objects/VendorSettings';
import { IVendorSettingsRepository } from '../../../src/domain/shared/interfaces/IVendorSettingsRepository';

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makePurgePing(): jest.Mocked<PurgeOldPingResultsUseCase> {
  return {
    execute: jest.fn()
  } as unknown as jest.Mocked<PurgeOldPingResultsUseCase>;
}

function makePurgeAlerts(): jest.Mocked<PurgeOldAlertsUseCase> {
  return {
    execute: jest.fn()
  } as unknown as jest.Mocked<PurgeOldAlertsUseCase>;
}

function makePurgeSnapshots(): jest.Mocked<PurgeOldWirelessSnapshotsUseCase> {
  return {
    execute: jest.fn()
  } as unknown as jest.Mocked<PurgeOldWirelessSnapshotsUseCase>;
}

function makePurgeAlertRecords(): jest.Mocked<PurgeOldWirelessAlertRecordsUseCase> {
  return {
    execute: jest.fn()
  } as unknown as jest.Mocked<PurgeOldWirelessAlertRecordsUseCase>;
}

function makePurgeDeletedDevices(): jest.Mocked<PurgeDeletedDevicesUseCase> {
  return {
    execute: jest.fn()
  } as unknown as jest.Mocked<PurgeDeletedDevicesUseCase>;
}

function makeLogger(): jest.Mocked<ILogger> {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    child: jest.fn().mockReturnThis(),
    setLevel: jest.fn()
  };
}

interface OrchestratorFixture {
  purgePing: jest.Mocked<PurgeOldPingResultsUseCase>;
  purgeAlerts: jest.Mocked<PurgeOldAlertsUseCase>;
  purgeSnapshots: jest.Mocked<PurgeOldWirelessSnapshotsUseCase>;
  purgeAlertRecords: jest.Mocked<PurgeOldWirelessAlertRecordsUseCase>;
  purgeDeletedDevices: jest.Mocked<PurgeDeletedDevicesUseCase>;
  logger: jest.Mocked<ILogger>;
  vendorSettings: jest.Mocked<IVendorSettingsRepository>;
  orchestrator: DataRetentionOrchestrator;
}

function makeOrchestrator(
  checkIntervalMs = 1_000
): OrchestratorFixture {
  const purgePing = makePurgePing();
  const purgeAlerts = makePurgeAlerts();
  const purgeSnapshots = makePurgeSnapshots();
  const purgeAlertRecords = makePurgeAlertRecords();
  const purgeDeletedDevices = makePurgeDeletedDevices();
  const logger = makeLogger();
  const vendorSettings = vendorSettingsRepo({
    pingResultRetentionDays: 30,
    alertRetentionDays: 90,
    wirelessSnapshotRetentionDays: 7,
    wirelessAlertRecordRetentionDays: 60
  });

  purgePing.execute.mockResolvedValue(Result.ok(0));
  purgeAlerts.execute.mockResolvedValue(Result.ok(0));
  purgeSnapshots.execute.mockResolvedValue(Result.ok(0));
  purgeAlertRecords.execute.mockResolvedValue(Result.ok(0));
  purgeDeletedDevices.execute.mockResolvedValue(Result.ok(0));

  const orchestrator = new DataRetentionOrchestrator(
    purgePing,
    purgeAlerts,
    purgeSnapshots,
    purgeAlertRecords,
    purgeDeletedDevices,
    { deletedDeviceGraceDays: 7, checkIntervalMs },
    vendorSettings,
    logger
  );

  return {
    purgePing,
    purgeAlerts,
    purgeSnapshots,
    purgeAlertRecords,
    purgeDeletedDevices,
    logger,
    vendorSettings,
    orchestrator
  };
}

// A purge run awaits the settings and then the purges; drain every promise it
// queued without advancing the fake clock.
async function flushPurge(): Promise<void> {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

// ---------------------------------------------------------------------------

describe('DataRetentionOrchestrator', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  // =========================================================================
  describe('start()', () => {
    // -----------------------------------------------------------------------
    describe('immediate purge on start', () => {
      it('should run all four purge use cases immediately when start() is called', async () => {
        const {
          purgePing,
          purgeAlerts,
          purgeSnapshots,
          purgeAlertRecords,
          orchestrator
        } = makeOrchestrator(60_000);

        orchestrator.start();
        // Flush only the microtasks queued by the immediate void runPurge()
        await flushPurge();

        expect(purgePing.execute).toHaveBeenCalledTimes(1);
        expect(purgeAlerts.execute).toHaveBeenCalledTimes(1);
        expect(purgeSnapshots.execute).toHaveBeenCalledTimes(1);
        expect(purgeAlertRecords.execute).toHaveBeenCalledTimes(1);
      });

      it('should log that it has started', () => {
        const { logger, orchestrator } = makeOrchestrator(60_000);

        orchestrator.start();

        expect(logger.info).toHaveBeenCalledWith(
          '[DataRetentionOrchestrator] Started',
          expect.any(Object)
        );
      });
    });

    // -----------------------------------------------------------------------
    describe('periodic purge', () => {
      it('should run the purge again after the interval elapses', async () => {
        const INTERVAL_MS = 5_000;
        const { purgePing, orchestrator } =
          makeOrchestrator(INTERVAL_MS);

        orchestrator.start();
        await Promise.resolve();
        await Promise.resolve(); // flush immediate runPurge → 1 call

        // Advance one full interval to trigger the setInterval callback
        jest.advanceTimersByTime(INTERVAL_MS);
        await flushPurge();

        expect(purgePing.execute).toHaveBeenCalledTimes(2);
      });

      it('should run the purge a third time after two intervals', async () => {
        const INTERVAL_MS = 5_000;
        const { purgePing, orchestrator } =
          makeOrchestrator(INTERVAL_MS);

        orchestrator.start();
        await Promise.resolve();
        await Promise.resolve(); // flush immediate → 1

        jest.advanceTimersByTime(INTERVAL_MS);
        await Promise.resolve();
        await Promise.resolve(); // 2nd call

        jest.advanceTimersByTime(INTERVAL_MS);
        await Promise.resolve();
        await Promise.resolve(); // 3rd call

        expect(purgePing.execute).toHaveBeenCalledTimes(3);
      });
    });

    // -----------------------------------------------------------------------
    describe('idempotency', () => {
      it('should not set up a second interval when start() is called twice', async () => {
        const INTERVAL_MS = 5_000;
        const { purgePing, orchestrator } =
          makeOrchestrator(INTERVAL_MS);

        orchestrator.start();
        orchestrator.start(); // second call should be a no-op
        await Promise.resolve();
        await Promise.resolve(); // flush immediate

        jest.advanceTimersByTime(INTERVAL_MS);
        await Promise.resolve();
        await Promise.resolve(); // flush interval tick

        // If a second interval were registered, execute would be called 4 times (2+2)
        expect(purgePing.execute).toHaveBeenCalledTimes(2);
      });

      it('should not log the start message more than once when start() is called twice', () => {
        const { logger, orchestrator } = makeOrchestrator(60_000);

        orchestrator.start();
        orchestrator.start();

        const startedCalls = (
          logger.info as jest.Mock
        ).mock.calls.filter(
          ([msg]: [string]) =>
            msg === '[DataRetentionOrchestrator] Started'
        );
        expect(startedCalls).toHaveLength(1);
      });
    });
  });

  // =========================================================================
  describe('stop()', () => {
    it('should prevent the interval from firing after stop() is called', async () => {
      const INTERVAL_MS = 5_000;
      const { purgePing, orchestrator } =
        makeOrchestrator(INTERVAL_MS);

      orchestrator.start();
      await Promise.resolve();
      await Promise.resolve(); // flush immediate call → 1 call

      orchestrator.stop();
      jest.advanceTimersByTime(INTERVAL_MS * 3);
      await flushPurge();

      // Only the single immediate call should have happened
      expect(purgePing.execute).toHaveBeenCalledTimes(1);
    });

    it('should log that it has stopped', () => {
      const { logger, orchestrator } = makeOrchestrator(60_000);

      orchestrator.start();
      orchestrator.stop();

      expect(logger.info).toHaveBeenCalledWith(
        '[DataRetentionOrchestrator] Stopped'
      );
    });

    // -----------------------------------------------------------------------
    describe('idempotency', () => {
      it('should not throw or log stop twice when stop() is called on an already-stopped orchestrator', () => {
        const { logger, orchestrator } = makeOrchestrator(60_000);

        orchestrator.start();
        orchestrator.stop();
        orchestrator.stop(); // second call should be a no-op

        const stoppedCalls = (
          logger.info as jest.Mock
        ).mock.calls.filter(
          ([msg]: [string]) =>
            msg === '[DataRetentionOrchestrator] Stopped'
        );
        expect(stoppedCalls).toHaveLength(1);
      });

      it('should not throw when stop() is called before start()', () => {
        const { orchestrator } = makeOrchestrator(60_000);

        expect(() => orchestrator.stop()).not.toThrow();
      });
    });
  });

  // =========================================================================
  describe('error handling during runPurge()', () => {
    it('should log an error when the ping results purge fails', async () => {
      const { purgePing, logger, orchestrator } =
        makeOrchestrator(60_000);
      purgePing.execute.mockResolvedValue(
        Result.fail('ping DB error')
      );

      orchestrator.start();
      await flushPurge();

      expect(logger.error).toHaveBeenCalledWith(
        '[DataRetentionOrchestrator] Failed to purge ping results',
        expect.any(Error)
      );
    });

    it('should log an error when the alerts purge fails', async () => {
      const { purgeAlerts, logger, orchestrator } =
        makeOrchestrator(60_000);
      purgeAlerts.execute.mockResolvedValue(
        Result.fail('alert write error')
      );

      orchestrator.start();
      await flushPurge();

      expect(logger.error).toHaveBeenCalledWith(
        '[DataRetentionOrchestrator] Failed to purge alerts',
        expect.any(Error)
      );
    });

    it('should log an error when the wireless snapshots purge fails', async () => {
      const { purgeSnapshots, logger, orchestrator } =
        makeOrchestrator(60_000);
      purgeSnapshots.execute.mockResolvedValue(
        Result.fail('snapshot I/O error')
      );

      orchestrator.start();
      await flushPurge();

      expect(logger.error).toHaveBeenCalledWith(
        '[DataRetentionOrchestrator] Failed to purge wireless snapshots',
        expect.any(Error)
      );
    });

    it('should log an error when the wireless alert records purge fails', async () => {
      const { purgeAlertRecords, logger, orchestrator } =
        makeOrchestrator(60_000);
      purgeAlertRecords.execute.mockResolvedValue(
        Result.fail('alert record table locked')
      );

      orchestrator.start();
      await flushPurge();

      expect(logger.error).toHaveBeenCalledWith(
        '[DataRetentionOrchestrator] Failed to purge wireless alert records',
        expect.any(Error)
      );
    });

    it('should continue to execute the remaining purges even when one fails', async () => {
      const {
        purgePing,
        purgeAlerts,
        purgeSnapshots,
        purgeAlertRecords,
        orchestrator
      } = makeOrchestrator(60_000);
      purgePing.execute.mockResolvedValue(Result.fail('ping error'));

      orchestrator.start();
      await flushPurge();

      expect(purgeAlerts.execute).toHaveBeenCalledTimes(1);
      expect(purgeSnapshots.execute).toHaveBeenCalledTimes(1);
      expect(purgeAlertRecords.execute).toHaveBeenCalledTimes(1);
    });

    it('should log multiple errors when multiple purges fail in the same run', async () => {
      const { purgePing, purgeAlerts, logger, orchestrator } =
        makeOrchestrator(60_000);
      purgePing.execute.mockResolvedValue(Result.fail('ping error'));
      purgeAlerts.execute.mockResolvedValue(
        Result.fail('alert error')
      );

      orchestrator.start();
      await flushPurge();

      expect(logger.error).toHaveBeenCalledTimes(2);
    });
  });

  // =========================================================================
  describe('[INS-028] retention windows from the vendor settings', () => {
    it('reads the windows on every run, so a change applies to the next one', async () => {
      const { orchestrator, vendorSettings, purgePing } =
        makeOrchestrator(1_000);
      orchestrator.start();
      await flushPurge();

      vendorSettings.get.mockResolvedValue(
        Result.ok(
          VendorSettings.reconstitute(
            makeVendorSettingsProps({ pingResultRetentionDays: 5 })
          )
        )
      );
      await jest.advanceTimersByTimeAsync(1_000);
      orchestrator.stop();

      expect(purgePing.execute).toHaveBeenNthCalledWith(1, 30);
      expect(purgePing.execute).toHaveBeenLastCalledWith(5);
    });

    it('purges nothing when the windows cannot be read', async () => {
      const {
        orchestrator,
        vendorSettings,
        purgePing,
        purgeDeletedDevices,
        logger
      } = makeOrchestrator();
      vendorSettings.get.mockResolvedValue(Result.fail('DB down'));

      orchestrator.start();
      await jest.advanceTimersByTimeAsync(0);
      orchestrator.stop();

      expect(purgePing.execute).not.toHaveBeenCalled();
      expect(purgeDeletedDevices.execute).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('success logging', () => {
    it('should log purge complete with the deleted counts after a successful run', async () => {
      const {
        purgePing,
        purgeAlerts,
        purgeSnapshots,
        purgeAlertRecords,
        purgeDeletedDevices,
        logger,
        orchestrator
      } = makeOrchestrator(60_000);
      purgePing.execute.mockResolvedValue(Result.ok(10));
      purgeAlerts.execute.mockResolvedValue(Result.ok(5));
      purgeSnapshots.execute.mockResolvedValue(Result.ok(20));
      purgeAlertRecords.execute.mockResolvedValue(Result.ok(3));
      purgeDeletedDevices.execute.mockResolvedValue(Result.ok(2));

      orchestrator.start();
      await flushPurge();

      expect(logger.info).toHaveBeenCalledWith(
        '[DataRetentionOrchestrator] Purge complete',
        {
          pingResultsDeleted: 10,
          alertsDeleted: 5,
          wirelessSnapshotsDeleted: 20,
          wirelessAlertRecordsDeleted: 3,
          deletedDevicesPurged: 2
        }
      );
    });

    it('should log zero counts for any purge that failed', async () => {
      const { purgePing, logger, orchestrator } =
        makeOrchestrator(60_000);
      purgePing.execute.mockResolvedValue(Result.fail('ping error'));

      orchestrator.start();
      await flushPurge();

      const completeCalls = (
        logger.info as jest.Mock
      ).mock.calls.filter(
        ([msg]: [string]) =>
          msg === '[DataRetentionOrchestrator] Purge complete'
      );
      expect(completeCalls).toHaveLength(1);
      const summary = completeCalls[0][1] as Record<string, number>;
      expect(summary.pingResultsDeleted).toBe(0);
    });
  });
});
