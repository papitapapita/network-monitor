// Source: src/infrastructure/notifications/orchestrator/OverdueDeviceDownAlertOrchestrator.ts

import { OverdueDeviceDownAlertOrchestrator } from '../../../../src/infrastructure/notifications/orchestrator/OverdueDeviceDownAlertOrchestrator';
import { RaiseOverdueDeviceDownAlertsUseCase } from '../../../../src/application/notifications/use-cases/RaiseOverdueDeviceDownAlertsUseCase';
import { ResolveStrandedDeviceDownAlertsUseCase } from '../../../../src/application/notifications/use-cases/ResolveStrandedDeviceDownAlertsUseCase';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeUseCase(): jest.Mocked<
  Pick<RaiseOverdueDeviceDownAlertsUseCase, 'execute'>
> {
  return { execute: jest.fn() };
}

function makeSweep(): jest.Mocked<
  Pick<ResolveStrandedDeviceDownAlertsUseCase, 'execute'>
> {
  return { execute: jest.fn() };
}

// A tick awaits the scan and then the sweep; give both chains time to settle.
async function flush(): Promise<void> {
  for (let i = 0; i < 10; i++) await Promise.resolve();
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
  useCase: jest.Mocked<
    Pick<RaiseOverdueDeviceDownAlertsUseCase, 'execute'>
  >;
  sweep: jest.Mocked<
    Pick<ResolveStrandedDeviceDownAlertsUseCase, 'execute'>
  >;
  logger: jest.Mocked<ILogger>;
  orchestrator: OverdueDeviceDownAlertOrchestrator;
}

function makeOrchestrator(
  checkIntervalMs = 1_000
): OrchestratorFixture {
  const useCase = makeUseCase();
  const sweep = makeSweep();
  const logger = makeLogger();
  useCase.execute.mockResolvedValue(Result.ok(0));
  sweep.execute.mockResolvedValue(Result.ok(0));

  const orchestrator = new OverdueDeviceDownAlertOrchestrator(
    useCase as unknown as RaiseOverdueDeviceDownAlertsUseCase,
    sweep as unknown as ResolveStrandedDeviceDownAlertsUseCase,
    { checkIntervalMs },
    logger
  );

  return { useCase, sweep, logger, orchestrator };
}

// ---------------------------------------------------------------------------

describe('OverdueDeviceDownAlertOrchestrator', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  // =========================================================================
  describe('start()', () => {
    it('should run the use case immediately when start() is called', async () => {
      const { useCase, orchestrator } = makeOrchestrator(60_000);

      orchestrator.start();
      await flush();

      expect(useCase.execute).toHaveBeenCalledTimes(1);
    });

    it('should log that it has started', () => {
      const { logger, orchestrator } = makeOrchestrator(60_000);

      orchestrator.start();

      expect(logger.info).toHaveBeenCalledWith(
        '[OverdueDeviceDownAlertOrchestrator] Started',
        expect.any(Object)
      );
    });

    it('should run the use case again after the interval elapses', async () => {
      const INTERVAL_MS = 5_000;
      const { useCase, orchestrator } = makeOrchestrator(INTERVAL_MS);

      orchestrator.start();
      await flush();

      jest.advanceTimersByTime(INTERVAL_MS);
      await flush();

      expect(useCase.execute).toHaveBeenCalledTimes(2);
    });

    it('should not set up a second interval when start() is called twice', async () => {
      const INTERVAL_MS = 5_000;
      const { useCase, orchestrator } = makeOrchestrator(INTERVAL_MS);

      orchestrator.start();
      orchestrator.start();
      await flush();

      jest.advanceTimersByTime(INTERVAL_MS);
      await flush();

      expect(useCase.execute).toHaveBeenCalledTimes(2);
    });
  });

  // =========================================================================
  describe('stop()', () => {
    it('should prevent the interval from firing after stop() is called', async () => {
      const INTERVAL_MS = 5_000;
      const { useCase, orchestrator } = makeOrchestrator(INTERVAL_MS);

      orchestrator.start();
      await flush();

      orchestrator.stop();
      jest.advanceTimersByTime(INTERVAL_MS * 3);
      await flush();

      expect(useCase.execute).toHaveBeenCalledTimes(1);
    });

    it('should log that it has stopped', () => {
      const { logger, orchestrator } = makeOrchestrator(60_000);

      orchestrator.start();
      orchestrator.stop();

      expect(logger.info).toHaveBeenCalledWith(
        '[OverdueDeviceDownAlertOrchestrator] Stopped'
      );
    });

    it('should not throw when stop() is called before start()', () => {
      const { orchestrator } = makeOrchestrator(60_000);

      expect(() => orchestrator.stop()).not.toThrow();
    });
  });

  // =========================================================================
  describe('isActive()', () => {
    it('should report false before start() is called', () => {
      const { orchestrator } = makeOrchestrator(60_000);

      expect(orchestrator.isActive()).toBe(false);
    });

    it('should report true after start() is called', () => {
      const { orchestrator } = makeOrchestrator(60_000);

      orchestrator.start();

      expect(orchestrator.isActive()).toBe(true);
    });

    it('should report false after stop() is called', () => {
      const { orchestrator } = makeOrchestrator(60_000);

      orchestrator.start();
      orchestrator.stop();

      expect(orchestrator.isActive()).toBe(false);
    });
  });

  // =========================================================================
  describe('error handling', () => {
    it('should log an error when the use case returns a failure result', async () => {
      const { useCase, logger, orchestrator } =
        makeOrchestrator(60_000);
      useCase.execute.mockResolvedValue(
        Result.fail('DB unavailable')
      );

      orchestrator.start();
      await flush();

      expect(logger.error).toHaveBeenCalledWith(
        '[OverdueDeviceDownAlertOrchestrator] Scan failed',
        expect.any(Error)
      );
    });

    it('should log an error and not throw when the use case rejects unexpectedly', async () => {
      const { useCase, logger, orchestrator } =
        makeOrchestrator(60_000);
      useCase.execute.mockRejectedValue(new Error('boom'));

      orchestrator.start();
      await flush();

      expect(logger.error).toHaveBeenCalledWith(
        '[OverdueDeviceDownAlertOrchestrator] Unexpected error',
        expect.any(Error)
      );
    });

    it('should continue running on the next interval after a failed scan', async () => {
      const INTERVAL_MS = 5_000;
      const { useCase, orchestrator } = makeOrchestrator(INTERVAL_MS);
      useCase.execute.mockResolvedValueOnce(Result.fail('transient'));

      orchestrator.start();
      await flush();

      jest.advanceTimersByTime(INTERVAL_MS);
      await flush();

      expect(useCase.execute).toHaveBeenCalledTimes(2);
    });
  });

  // =========================================================================
  describe('[NOT-229] stranded alerts and overlapping scans', () => {
    it('should sweep stranded alerts after every scan', async () => {
      const INTERVAL_MS = 5_000;
      const { sweep, orchestrator } = makeOrchestrator(INTERVAL_MS);

      orchestrator.start();
      await flush();
      jest.advanceTimersByTime(INTERVAL_MS);
      await flush();

      expect(sweep.execute).toHaveBeenCalledTimes(2);
    });

    it('should still sweep when the scan fails', async () => {
      const { useCase, sweep, orchestrator } =
        makeOrchestrator(60_000);
      useCase.execute.mockResolvedValue(
        Result.fail('DB unavailable')
      );

      orchestrator.start();
      await flush();

      expect(sweep.execute).toHaveBeenCalledTimes(1);
    });

    it('should log an error when the sweep fails', async () => {
      const { sweep, logger, orchestrator } =
        makeOrchestrator(60_000);
      sweep.execute.mockResolvedValue(Result.fail('DB unavailable'));

      orchestrator.start();
      await flush();

      expect(logger.error).toHaveBeenCalledWith(
        '[OverdueDeviceDownAlertOrchestrator] Stranded-alert sweep failed',
        expect.any(Error)
      );
    });

    it('should skip a tick while the previous scan is still running', async () => {
      const INTERVAL_MS = 5_000;
      const { useCase, orchestrator } = makeOrchestrator(INTERVAL_MS);
      let finishScan: (
        value: ReturnType<typeof Result.ok<number>>
      ) => void = () => {};
      useCase.execute.mockReturnValueOnce(
        new Promise((resolve) => {
          finishScan = resolve;
        })
      );

      orchestrator.start();
      await flush();
      jest.advanceTimersByTime(INTERVAL_MS * 2);
      await flush();
      expect(useCase.execute).toHaveBeenCalledTimes(1);

      finishScan(Result.ok(0));
      await flush();
      jest.advanceTimersByTime(INTERVAL_MS);
      await flush();
      expect(useCase.execute).toHaveBeenCalledTimes(2);
    });
  });
});
