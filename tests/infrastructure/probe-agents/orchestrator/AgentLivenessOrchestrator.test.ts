import { AgentLivenessOrchestrator } from '../../../../src/infrastructure/probe-agents/orchestrator';
import { MarkSilentAgentsOfflineUseCase } from '../../../../src/application/probe-agents/use-cases';
import { Result } from '../../../../src/domain/shared/core/Result';
import { makeLogger } from '../../../application/probe-agents/fixtures';

function makeOrchestrator() {
  const useCase = {
    execute: jest
      .fn()
      .mockResolvedValue(Result.ok({ markedOffline: [] }))
  };
  const logger = makeLogger();
  const orchestrator = new AgentLivenessOrchestrator(
    useCase as unknown as MarkSilentAgentsOfflineUseCase,
    { checkIntervalMs: 60_000 },
    logger
  );
  return { useCase, logger, orchestrator };
}

describe('AgentLivenessOrchestrator', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('[AGT-021] scans on start and then every interval', async () => {
    const { useCase, orchestrator } = makeOrchestrator();

    orchestrator.start();
    expect(useCase.execute).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(120_000);
    expect(useCase.execute).toHaveBeenCalledTimes(3);
    orchestrator.stop();
  });

  it('stops scanning once stopped, and start is idempotent', async () => {
    const { useCase, orchestrator } = makeOrchestrator();

    orchestrator.start();
    orchestrator.start();
    orchestrator.stop();
    await jest.advanceTimersByTimeAsync(120_000);

    expect(useCase.execute).toHaveBeenCalledTimes(1);
    expect(orchestrator.isActive()).toBe(false);
  });

  it('logs a failed scan and a thrown error without stopping', async () => {
    const { useCase, logger, orchestrator } = makeOrchestrator();
    useCase.execute
      .mockResolvedValueOnce(Result.fail('db down'))
      .mockRejectedValueOnce(new Error('boom'));

    orchestrator.start();
    await jest.advanceTimersByTimeAsync(60_000);

    expect(logger.error).toHaveBeenCalledTimes(2);
    expect(orchestrator.isActive()).toBe(true);
    orchestrator.stop();
  });
});
