// Source: src/infrastructure/billing/orchestrator/BillingCycleOrchestrator.ts

import { BillingCycleOrchestrator } from '../../../../src/infrastructure/billing/orchestrator';
import { RunBillingCycleUseCase } from '../../../../src/application/billing/use-cases';
import { Result } from '../../../../src/domain/shared/core/Result';
import { makeLogger } from '../../../application/probe-agents/fixtures';

const RUN = {
  automaticBillingEnabled: true,
  generated: 2,
  markedOverdue: 1,
  failed: []
};

describe('BillingCycleOrchestrator', () => {
  let now: Date;
  let useCase: { execute: jest.Mock };
  let orchestrator: BillingCycleOrchestrator;

  beforeEach(() => {
    useCase = {
      execute: jest.fn().mockResolvedValue(Result.ok(RUN))
    };
    orchestrator = new BillingCycleOrchestrator(
      useCase as unknown as RunBillingCycleUseCase,
      {},
      makeLogger(),
      () => now
    );
  });

  it('[BIL-284] waits until 6:00 Colombian time', async () => {
    now = new Date('2026-10-12T10:59:00.000Z'); // 05:59 in Bogotá

    await orchestrator.tick();

    expect(useCase.execute).not.toHaveBeenCalled();
  });

  it('[BIL-284] runs once per local day, passing the current time', async () => {
    now = new Date('2026-10-12T11:00:00.000Z'); // 06:00 in Bogotá
    await orchestrator.tick();
    expect(useCase.execute).toHaveBeenCalledWith({ now });

    now = new Date('2026-10-13T04:59:00.000Z'); // 23:59 the same day
    await orchestrator.tick();
    expect(useCase.execute).toHaveBeenCalledTimes(1);

    now = new Date('2026-10-13T11:00:00.000Z');
    await orchestrator.tick();
    expect(useCase.execute).toHaveBeenCalledTimes(2);
  });

  it('[BIL-284] retries a failed run on the next check', async () => {
    useCase.execute.mockResolvedValueOnce(Result.fail('DB down'));
    now = new Date('2026-10-12T11:00:00.000Z');

    await orchestrator.tick();
    await orchestrator.tick();

    expect(useCase.execute).toHaveBeenCalledTimes(2);
  });

  it('[BIL-284] keeps checking the same day while billing is off', async () => {
    useCase.execute.mockResolvedValueOnce(
      Result.ok({ ...RUN, automaticBillingEnabled: false })
    );
    now = new Date('2026-10-12T11:00:00.000Z');

    await orchestrator.tick();
    await orchestrator.tick();
    await orchestrator.tick();

    expect(useCase.execute).toHaveBeenCalledTimes(2);
  });
});
