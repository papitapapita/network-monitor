import { SubscriptionReminderOrchestrator } from '../../../../src/infrastructure/notifications/orchestrator';
import { SendSubscriptionReminderUseCase } from '../../../../src/application/notifications/use-cases';
import { Result } from '../../../../src/domain/shared/core/Result';
import { makeLogger } from '../../../application/probe-agents/fixtures';

describe('SubscriptionReminderOrchestrator', () => {
  let now: Date;
  let useCase: { execute: jest.Mock };
  let orchestrator: SubscriptionReminderOrchestrator;

  beforeEach(() => {
    useCase = {
      execute: jest.fn().mockResolvedValue(Result.ok('SENT'))
    };
    orchestrator = new SubscriptionReminderOrchestrator(
      useCase as unknown as SendSubscriptionReminderUseCase,
      {},
      makeLogger(),
      () => now
    );
  });

  it('[INS-027] waits until 9:00 Colombian time', async () => {
    now = new Date('2026-10-30T13:59:00.000Z'); // 08:59 in Bogotá

    await orchestrator.tick();

    expect(useCase.execute).not.toHaveBeenCalled();
  });

  it('[INS-027] handles each local day once', async () => {
    now = new Date('2026-10-30T14:00:00.000Z'); // 09:00 in Bogotá
    await orchestrator.tick();
    now = new Date('2026-10-31T04:59:00.000Z'); // 23:59 the same day
    await orchestrator.tick();

    expect(useCase.execute).toHaveBeenCalledTimes(1);

    now = new Date('2026-10-31T14:00:00.000Z');
    await orchestrator.tick();
    expect(useCase.execute).toHaveBeenCalledTimes(2);
  });

  it('[INS-027] retries a failed send on the next check', async () => {
    useCase.execute.mockResolvedValueOnce(
      Result.fail('telegram down')
    );
    now = new Date('2026-10-30T14:00:00.000Z');

    await orchestrator.tick();
    await orchestrator.tick();

    expect(useCase.execute).toHaveBeenCalledTimes(2);
  });
});
