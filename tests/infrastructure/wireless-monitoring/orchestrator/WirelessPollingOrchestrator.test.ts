// Source: src/infrastructure/wireless-monitoring/orchestrator/WirelessPollingOrchestrator.ts

import { WirelessPollingOrchestrator } from '../../../../src/infrastructure/wireless-monitoring/orchestrator/WirelessPollingOrchestrator';
import { IWirelessDeviceConfigRepository } from '../../../../src/domain/wireless-monitoring/repository/IWirelessDeviceConfigRepository';
import { PollWirelessDeviceUseCase } from '../../../../src/application/wireless-monitoring/use-cases/PollWirelessDeviceUseCase';
import { WirelessDeviceConfig } from '../../../../src/domain/wireless-monitoring/aggregates/WirelessDeviceConfig';
import { WirelessDeviceConfigId } from '../../../../src/domain/shared/ids/WirelessDeviceConfigId';
import { DeviceId } from '../../../../src/domain/shared/ids/DeviceId';
import { IPAddress } from '../../../../src/domain/shared/value-objects/IPAddress';
import { PollingInterval } from '../../../../src/domain/wireless-monitoring/value-objects/PollingInterval';
import { Result } from '../../../../src/domain/shared/core/Result';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLogger(): jest.Mocked<ILogger> {
  const child: jest.Mocked<ILogger> = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    setLevel: jest.fn(),
    child: jest.fn()
  };
  child.child.mockReturnValue(child);
  return child;
}

function makeConfig(uuid: string): WirelessDeviceConfig {
  return WirelessDeviceConfig.reconstitute(
    WirelessDeviceConfigId.create(),
    {
      deviceId: DeviceId.parse(uuid).value,
      ipAddress: IPAddress.create('192.168.1.10').value,
      enabled: true,
      pollingInterval: PollingInterval.reconstitute(60),
      deviceType: 'STATION',
      linkCapacityKbps: null,
      clientsProvisionedLimit: null,
      provisionedLanSpeedMbps: null,
      parentApDeviceId: null,
      lastPolledAt: null
    }
  );
}

function uuidAt(n: number): string {
  return `550e8400-e29b-41d4-a716-4466554400${n.toString(16).padStart(2, '0')}`;
}

function makeConfigs(count: number): WirelessDeviceConfig[] {
  return Array.from({ length: count }, (_, i) =>
    makeConfig(uuidAt(i))
  );
}

function makeMocks() {
  const repo: jest.Mocked<IWirelessDeviceConfigRepository> = {
    findByDeviceId: jest.fn(),
    save: jest.fn(),
    findAllDue: jest.fn().mockResolvedValue(Result.ok([])),
    findByParentApDeviceId: jest.fn(),
    findAll: jest.fn(),
    delete: jest.fn(),
    findById: jest.fn(),
    exists: jest.fn()
  };

  const pollUseCase = {
    execute: jest.fn().mockResolvedValue(Result.ok({}))
  } as unknown as jest.Mocked<PollWirelessDeviceUseCase>;

  return { repo, pollUseCase, logger: makeLogger() };
}

// Lets the orchestrator's async pollDevices() run to completion between ticks.
async function drain(): Promise<void> {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
  }
}

// ---------------------------------------------------------------------------

describe('[WLS-023] [WLS-026] [WLS-027] WirelessPollingOrchestrator', () => {
  let mocks: ReturnType<typeof makeMocks>;

  beforeEach(() => {
    jest.useFakeTimers();
    mocks = makeMocks();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  function makeOrchestrator(
    config: {
      checkIntervalMs?: number;
      maxConcurrentPolls?: number;
    } = {}
  ): WirelessPollingOrchestrator {
    return new WirelessPollingOrchestrator(
      mocks.repo,
      mocks.pollUseCase,
      config,
      mocks.logger
    );
  }

  describe('start and stop', () => {
    it('should poll immediately on start rather than waiting a full interval', async () => {
      const orchestrator = makeOrchestrator();

      orchestrator.start();
      await drain();

      expect(mocks.repo.findAllDue).toHaveBeenCalledTimes(1);
      expect(orchestrator.isActive()).toBe(true);
    });

    it('should ignore a second start while already running', async () => {
      const orchestrator = makeOrchestrator();

      orchestrator.start();
      orchestrator.start();
      await drain();

      expect(mocks.repo.findAllDue).toHaveBeenCalledTimes(1);
    });

    it('should keep ticking on the configured interval', async () => {
      const orchestrator = makeOrchestrator({
        checkIntervalMs: 10_000
      });

      orchestrator.start();
      await drain();
      jest.advanceTimersByTime(10_000);
      await drain();
      jest.advanceTimersByTime(10_000);
      await drain();

      expect(mocks.repo.findAllDue).toHaveBeenCalledTimes(3);
    });

    it('should stop ticking after stop', async () => {
      const orchestrator = makeOrchestrator({
        checkIntervalMs: 10_000
      });

      orchestrator.start();
      await drain();
      await orchestrator.stop();
      const callsAtStop = mocks.repo.findAllDue.mock.calls.length;

      jest.advanceTimersByTime(30_000);
      await drain();

      expect(mocks.repo.findAllDue).toHaveBeenCalledTimes(
        callsAtStop
      );
      expect(orchestrator.isActive()).toBe(false);
    });
  });

  describe('[WLS-023] concurrency ceiling', () => {
    it('should dispatch no more than maxConcurrentPolls in one tick', async () => {
      mocks.repo.findAllDue.mockResolvedValue(
        Result.ok(makeConfigs(25))
      );
      // never resolves, so every dispatched poll stays in flight
      mocks.pollUseCase.execute.mockImplementation(
        () => new Promise(() => {})
      );
      const orchestrator = makeOrchestrator({
        maxConcurrentPolls: 10
      });

      orchestrator.start();
      await drain();

      expect(mocks.pollUseCase.execute).toHaveBeenCalledTimes(10);
    });

    it('should honour a custom ceiling', async () => {
      mocks.repo.findAllDue.mockResolvedValue(
        Result.ok(makeConfigs(25))
      );
      mocks.pollUseCase.execute.mockImplementation(
        () => new Promise(() => {})
      );
      const orchestrator = makeOrchestrator({
        maxConcurrentPolls: 3
      });

      orchestrator.start();
      await drain();

      expect(mocks.pollUseCase.execute).toHaveBeenCalledTimes(3);
    });

    it('should not dispatch a device that is already being polled', async () => {
      mocks.repo.findAllDue.mockResolvedValue(
        Result.ok(makeConfigs(2))
      );
      mocks.pollUseCase.execute.mockImplementation(
        () => new Promise(() => {})
      );
      const orchestrator = makeOrchestrator({
        checkIntervalMs: 10_000,
        maxConcurrentPolls: 10
      });

      orchestrator.start();
      await drain();
      expect(mocks.pollUseCase.execute).toHaveBeenCalledTimes(2);

      jest.advanceTimersByTime(10_000);
      await drain();

      // the same two devices are still in flight, so no new dispatch
      expect(mocks.pollUseCase.execute).toHaveBeenCalledTimes(2);
    });

    it('should dispatch the overflow on a later tick once slots free up', async () => {
      mocks.repo.findAllDue.mockResolvedValue(
        Result.ok(makeConfigs(15))
      );
      const orchestrator = makeOrchestrator({
        checkIntervalMs: 10_000,
        maxConcurrentPolls: 10
      });

      orchestrator.start();
      await drain();
      expect(mocks.pollUseCase.execute).toHaveBeenCalledTimes(10);

      jest.advanceTimersByTime(10_000);
      await drain();

      expect(
        mocks.pollUseCase.execute.mock.calls.length
      ).toBeGreaterThan(10);
    });

    it('should release a device slot after its poll throws', async () => {
      mocks.repo.findAllDue.mockResolvedValue(
        Result.ok(makeConfigs(1))
      );
      mocks.pollUseCase.execute.mockRejectedValue(new Error('boom'));
      const orchestrator = makeOrchestrator({
        checkIntervalMs: 10_000
      });

      orchestrator.start();
      await drain();
      jest.advanceTimersByTime(10_000);
      await drain();

      expect(mocks.pollUseCase.execute).toHaveBeenCalledTimes(2);
      expect(mocks.logger.warn).toHaveBeenCalled();
    });
  });

  describe('[WLS-026] database in recovery', () => {
    it('should stay silent when findAllDue fails with 57P03', async () => {
      mocks.repo.findAllDue.mockResolvedValue(
        Result.fail(
          'db error 57P03: the database system is starting up'
        )
      );
      const orchestrator = makeOrchestrator();

      orchestrator.start();
      await drain();

      expect(mocks.logger.warn).not.toHaveBeenCalled();
    });

    it('should warn on any other findAllDue failure', async () => {
      mocks.repo.findAllDue.mockResolvedValue(
        Result.fail('relation does not exist')
      );
      const orchestrator = makeOrchestrator();

      orchestrator.start();
      await drain();

      expect(mocks.logger.warn).toHaveBeenCalledTimes(1);
    });

    it('should keep ticking after a 57P03 failure', async () => {
      mocks.repo.findAllDue.mockResolvedValue(Result.fail('57P03'));
      const orchestrator = makeOrchestrator({
        checkIntervalMs: 10_000
      });

      orchestrator.start();
      await drain();
      jest.advanceTimersByTime(10_000);
      await drain();

      expect(mocks.repo.findAllDue).toHaveBeenCalledTimes(2);
      expect(orchestrator.isActive()).toBe(true);
    });

    it('should recover and poll once the database comes back', async () => {
      mocks.repo.findAllDue.mockResolvedValueOnce(
        Result.fail('57P03')
      );
      mocks.repo.findAllDue.mockResolvedValue(
        Result.ok(makeConfigs(1))
      );
      const orchestrator = makeOrchestrator({
        checkIntervalMs: 10_000
      });

      orchestrator.start();
      await drain();
      expect(mocks.pollUseCase.execute).not.toHaveBeenCalled();

      jest.advanceTimersByTime(10_000);
      await drain();

      expect(mocks.pollUseCase.execute).toHaveBeenCalledTimes(1);
    });

    it('should not let an unexpected throw from the repository stop the loop', async () => {
      mocks.repo.findAllDue.mockRejectedValueOnce(
        new Error('kaboom')
      );
      mocks.repo.findAllDue.mockResolvedValue(Result.ok([]));
      const orchestrator = makeOrchestrator({
        checkIntervalMs: 10_000
      });

      orchestrator.start();
      await drain();
      jest.advanceTimersByTime(10_000);
      await drain();

      expect(mocks.repo.findAllDue).toHaveBeenCalledTimes(2);
      expect(orchestrator.isActive()).toBe(true);
    });
  });

  describe('[WLS-027] draining on shutdown', () => {
    it('should return promptly when nothing is in flight', async () => {
      const orchestrator = makeOrchestrator();
      orchestrator.start();
      await drain();

      const stopped = orchestrator.stop();
      await jest.advanceTimersByTimeAsync(0);
      await stopped;

      expect(orchestrator.isActive()).toBe(false);
    });

    it('should wait for an in-flight poll before returning', async () => {
      mocks.repo.findAllDue.mockResolvedValue(
        Result.ok(makeConfigs(1))
      );
      let releasePoll: () => void = () => {};
      mocks.pollUseCase.execute.mockImplementation(
        () =>
          new Promise((resolve) => {
            releasePoll = () => resolve(Result.ok({}) as never);
          })
      );
      const orchestrator = makeOrchestrator();

      orchestrator.start();
      await drain();

      let settled = false;
      const stopped = orchestrator.stop().then(() => {
        settled = true;
      });

      await jest.advanceTimersByTimeAsync(1_000);
      expect(settled).toBe(false);

      releasePoll();
      await drain();
      await jest.advanceTimersByTimeAsync(400);
      await stopped;

      expect(settled).toBe(true);
    });

    it('should give up after 30 seconds and stop anyway', async () => {
      mocks.repo.findAllDue.mockResolvedValue(
        Result.ok(makeConfigs(1))
      );
      mocks.pollUseCase.execute.mockImplementation(
        () => new Promise(() => {})
      );
      const orchestrator = makeOrchestrator();

      orchestrator.start();
      await drain();

      const stopped = orchestrator.stop();
      await jest.advanceTimersByTimeAsync(30_200);
      await stopped;

      expect(orchestrator.isActive()).toBe(false);
    });

    it('should ignore a second stop when already stopped', async () => {
      const orchestrator = makeOrchestrator();

      await orchestrator.stop();

      expect(mocks.logger.info).not.toHaveBeenCalled();
    });
  });
});
