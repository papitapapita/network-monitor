// Source: src/infrastructure/device-backups/orchestrator/ConfigBackupOrchestrator.ts

import { ConfigBackupOrchestrator } from '../../../../src/infrastructure/device-backups/orchestrator';
import { RunScheduledBackupsUseCase } from '../../../../src/application/device-backups/use-cases';
import { Result } from '../../../../src/domain/shared/core/Result';
import { makeLogger } from '../../../application/probe-agents/fixtures';

const RUN = { saved: 2, unchanged: 5, skipped: 0, failed: [] };

describe('ConfigBackupOrchestrator', () => {
  let now: Date;
  let useCase: { execute: jest.Mock };
  let orchestrator: ConfigBackupOrchestrator;

  beforeEach(() => {
    useCase = {
      execute: jest.fn().mockResolvedValue(Result.ok(RUN))
    };
    orchestrator = new ConfigBackupOrchestrator(
      useCase as unknown as RunScheduledBackupsUseCase,
      {},
      makeLogger(),
      () => now
    );
  });

  it('[BKP-011] waits until 3:00 Colombian time', async () => {
    now = new Date('2026-10-12T07:59:00.000Z'); // 02:59 in Bogotá

    await orchestrator.tick();

    expect(useCase.execute).not.toHaveBeenCalled();
  });

  it('[BKP-011] runs once per local day, passing the current time', async () => {
    now = new Date('2026-10-12T08:00:00.000Z'); // 03:00 in Bogotá
    await orchestrator.tick();
    expect(useCase.execute).toHaveBeenCalledWith({ now });

    now = new Date('2026-10-13T04:59:00.000Z'); // 23:59 the same day
    await orchestrator.tick();
    expect(useCase.execute).toHaveBeenCalledTimes(1);

    now = new Date('2026-10-13T08:00:00.000Z');
    await orchestrator.tick();
    expect(useCase.execute).toHaveBeenCalledTimes(2);
  });

  it('[BKP-011] retries a run that could not start on the next check', async () => {
    useCase.execute.mockResolvedValueOnce(Result.fail('DB down'));
    now = new Date('2026-10-12T08:00:00.000Z');

    await orchestrator.tick();
    await orchestrator.tick();

    expect(useCase.execute).toHaveBeenCalledTimes(2);
  });

  it('[BKP-011] does not start a second run while one is going', async () => {
    let finish: (v: unknown) => void = () => undefined;
    useCase.execute.mockReturnValueOnce(
      new Promise((resolve) => (finish = resolve))
    );
    now = new Date('2026-10-12T08:00:00.000Z');

    const first = orchestrator.tick();
    await orchestrator.tick();
    finish(Result.ok(RUN));
    await first;

    expect(useCase.execute).toHaveBeenCalledTimes(1);
  });

  it('counts the day as done even when some devices failed', async () => {
    useCase.execute.mockResolvedValue(
      Result.ok({
        ...RUN,
        failed: [
          { deviceId: 'x', deviceName: 'AP', error: 'timeout' }
        ]
      })
    );
    now = new Date('2026-10-12T08:00:00.000Z');

    await orchestrator.tick();
    await orchestrator.tick();

    expect(useCase.execute).toHaveBeenCalledTimes(1);
  });
});
