// Source: src/infrastructure/monitoring/orchestrator/PortSpeedCheckOrchestrator.ts

import {
  loadPortSpeedCheckIntervalMs,
  PortSpeedCheckOrchestrator
} from '../../../../src/infrastructure/monitoring/orchestrator';
import { CheckPortSpeedsUseCase } from '../../../../src/application/device-monitoring/use-cases';
import { Result } from '../../../../src/domain/shared/core';
import { makeLogger } from '../../../application/probe-agents/fixtures';

const NOW = new Date('2026-10-28T15:00:00Z');

const checked = (skipped: unknown[] = []) =>
  Result.ok({ routersChecked: 1, skipped, raised: 0, recovered: 0 });

describe('PortSpeedCheckOrchestrator', () => {
  let useCase: { execute: jest.Mock };
  let logger: ReturnType<typeof makeLogger>;
  let orchestrator: PortSpeedCheckOrchestrator;

  beforeEach(() => {
    useCase = { execute: jest.fn().mockResolvedValue(checked()) };
    logger = makeLogger();
    orchestrator = new PortSpeedCheckOrchestrator(
      useCase as unknown as CheckPortSpeedsUseCase,
      {},
      logger,
      () => NOW
    );
  });

  it('[MON-147] runs the check at every tick, passing the time', async () => {
    await orchestrator.tick();
    await orchestrator.tick();

    expect(useCase.execute).toHaveBeenCalledTimes(2);
    expect(useCase.execute).toHaveBeenCalledWith({ now: NOW });
  });

  it('[MON-147] does not start a check while one is still going', async () => {
    let finish: () => void = () => undefined;
    useCase.execute.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = () => resolve(checked());
        })
    );

    const first = orchestrator.tick();
    await orchestrator.tick();
    finish();
    await first;

    expect(useCase.execute).toHaveBeenCalledTimes(1);
  });

  it('logs a router that could not be read', async () => {
    useCase.execute.mockResolvedValue(
      checked([{ deviceId: 'd1', name: 'Core', why: 'timed out' }])
    );

    await orchestrator.tick();

    expect(logger.warn).toHaveBeenCalledWith(
      '[PortSpeedCheckOrchestrator] Router not read',
      { deviceId: 'd1', name: 'Core', why: 'timed out' }
    );
  });

  it('survives a failed or throwing check', async () => {
    useCase.execute.mockResolvedValueOnce(Result.fail('db down'));
    useCase.execute.mockRejectedValueOnce(new Error('boom'));

    await orchestrator.tick();
    await orchestrator.tick();
    await orchestrator.tick();

    expect(logger.error).toHaveBeenCalledTimes(2);
    expect(useCase.execute).toHaveBeenCalledTimes(3);
  });
});

describe('loadPortSpeedCheckIntervalMs', () => {
  it('[MON-147] defaults to 10 minutes', () => {
    expect(loadPortSpeedCheckIntervalMs({})).toBe(600_000);
    expect(
      loadPortSpeedCheckIntervalMs({
        PORT_SPEED_CHECK_INTERVAL_MINUTES: ' '
      })
    ).toBe(600_000);
  });

  it('[MON-147] reads the minutes from env', () => {
    expect(
      loadPortSpeedCheckIntervalMs({
        PORT_SPEED_CHECK_INTERVAL_MINUTES: '5'
      })
    ).toBe(300_000);
  });

  it.each(['0', '1441', '2.5', 'ten'])(
    '[MON-147] refuses %p',
    (value) => {
      expect(() =>
        loadPortSpeedCheckIntervalMs({
          PORT_SPEED_CHECK_INTERVAL_MINUTES: value
        })
      ).toThrow(
        'PORT_SPEED_CHECK_INTERVAL_MINUTES must be a whole number from 1 to 1440'
      );
    }
  );
});
