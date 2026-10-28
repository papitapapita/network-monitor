// Source: src/infrastructure/monitoring/orchestrator/DiscoveryScanOrchestrator.ts

import { DiscoveryScanOrchestrator } from '../../../../src/infrastructure/monitoring/orchestrator';
import { RunScheduledDiscoveryUseCase } from '../../../../src/application/device-inventory/use-cases';
import { Result } from '../../../../src/domain/shared/core';
import { makeLogger } from '../../../application/probe-agents/fixtures';

const NOW = new Date('2026-11-03T12:00:00Z');

describe('DiscoveryScanOrchestrator', () => {
  let useCase: { execute: jest.Mock };
  let logger: ReturnType<typeof makeLogger>;
  let orchestrator: DiscoveryScanOrchestrator;

  beforeEach(() => {
    useCase = {
      execute: jest
        .fn()
        .mockResolvedValue(Result.ok({ ran: false, segments: [] }))
    };
    logger = makeLogger();
    orchestrator = new DiscoveryScanOrchestrator(
      useCase as unknown as RunScheduledDiscoveryUseCase,
      {},
      logger,
      () => NOW
    );
  });

  it('[DEV-211] asks the use case at every check, passing the time', async () => {
    await orchestrator.tick();
    await orchestrator.tick();

    expect(useCase.execute).toHaveBeenCalledTimes(2);
    expect(useCase.execute).toHaveBeenCalledWith({ now: NOW });
  });

  it('[DEV-211] does not start a check while a run is still going', async () => {
    let finish: () => void = () => undefined;
    useCase.execute.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = () =>
            resolve(Result.ok({ ran: true, segments: [] }));
        })
    );

    const first = orchestrator.tick();
    await orchestrator.tick();
    finish();
    await first;

    expect(useCase.execute).toHaveBeenCalledTimes(1);
  });

  it('logs a segment that could not be scanned', async () => {
    useCase.execute.mockResolvedValue(
      Result.ok({
        ran: true,
        segments: [
          {
            cidr: '10.0.0.0/24',
            agentId: null,
            responsiveCount: null,
            newCount: null,
            error: 'Scan failed: boom'
          }
        ]
      })
    );

    await orchestrator.tick();

    expect(logger.warn).toHaveBeenCalledWith(
      '[DiscoveryScanOrchestrator] Segment not scanned',
      expect.objectContaining({ error: 'Scan failed: boom' })
    );
  });

  it('survives a failed run', async () => {
    useCase.execute.mockResolvedValue(Result.fail('db down'));

    await expect(orchestrator.tick()).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalled();
  });
});
