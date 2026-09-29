import {
  SubscriptionJobSupervisor,
  SupervisedJob
} from '../../../src/infrastructure/installation';
import { GetSubscriptionStatusUseCase } from '../../../src/application/shared/use-cases/GetSubscriptionStatusUseCase';
import { Result } from '../../../src/domain/shared/core/Result';
import { makeLogger } from '../../application/probe-agents/fixtures';

function makeJob(name: string): jest.Mocked<SupervisedJob> {
  return {
    name,
    start: jest.fn(),
    stop: jest.fn().mockResolvedValue(undefined)
  };
}

function makeStatus() {
  let readOnly = false;
  let failing = false;
  const useCase = {
    execute: jest.fn(async () =>
      failing
        ? Result.fail('boom')
        : Result.ok({
            state: readOnly ? 'READ_ONLY' : 'ACTIVE',
            paidThrough: null,
            graceEndsAt: null,
            lockedAt: null,
            readOnly,
            locked: false
          })
    )
  } as unknown as GetSubscriptionStatusUseCase;
  return {
    useCase,
    setReadOnly: (value: boolean) => (readOnly = value),
    setFailing: (value: boolean) => (failing = value)
  };
}

describe('SubscriptionJobSupervisor', () => {
  let jobs: jest.Mocked<SupervisedJob>[];
  let status: ReturnType<typeof makeStatus>;
  let supervisor: SubscriptionJobSupervisor;

  beforeEach(() => {
    jest.useFakeTimers();
    jobs = [makeJob('polling'), makeJob('retention')];
    status = makeStatus();
    supervisor = new SubscriptionJobSupervisor(
      jobs,
      status.useCase,
      makeLogger(),
      { checkIntervalMs: 60_000 }
    );
  });

  afterEach(async () => {
    await supervisor.stop();
    jest.useRealTimers();
  });

  it('[INS-026] starts every job while the subscription allows it', async () => {
    await supervisor.start();

    for (const job of jobs)
      expect(job.start).toHaveBeenCalledTimes(1);
    expect(supervisor.areJobsRunning()).toBe(true);
  });

  it('[INS-026] starts nothing when the install boots read-only', async () => {
    status.setReadOnly(true);

    await supervisor.start();

    for (const job of jobs) expect(job.start).not.toHaveBeenCalled();
  });

  it('[INS-026] stops every job within a check once the grace ends', async () => {
    await supervisor.start();

    status.setReadOnly(true);
    await jest.advanceTimersByTimeAsync(60_000);

    for (const job of jobs) expect(job.stop).toHaveBeenCalledTimes(1);
    expect(supervisor.areJobsRunning()).toBe(false);
  });

  it('[INS-026] restarts the jobs if the subscription allows them again', async () => {
    status.setReadOnly(true);
    await supervisor.start();

    status.setReadOnly(false);
    await jest.advanceTimersByTimeAsync(60_000);

    for (const job of jobs)
      expect(job.start).toHaveBeenCalledTimes(1);
  });

  it('[INS-026] starts the jobs at boot when the status cannot be read', async () => {
    status.setFailing(true);

    await supervisor.start();

    for (const job of jobs)
      expect(job.start).toHaveBeenCalledTimes(1);
  });

  it('[INS-026] leaves running jobs alone when a later check fails', async () => {
    await supervisor.start();

    status.setFailing(true);
    await jest.advanceTimersByTimeAsync(60_000);

    for (const job of jobs) expect(job.stop).not.toHaveBeenCalled();
  });

  it('stops the jobs on shutdown', async () => {
    await supervisor.start();

    await supervisor.stop();

    for (const job of jobs) expect(job.stop).toHaveBeenCalledTimes(1);
  });
});
