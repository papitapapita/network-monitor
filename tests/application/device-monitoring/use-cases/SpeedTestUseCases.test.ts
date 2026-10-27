// Source: src/application/device-monitoring/use-cases/RunSpeedTestUseCase.ts,
// ListSpeedTestsUseCase.ts

import {
  RunSpeedTestUseCase,
  SPEED_TEST_NEEDS_SERVER_ON_SITE,
  SPEED_TEST_RUNNING
} from '../../../../src/application/device-monitoring/use-cases/RunSpeedTestUseCase';
import { ListSpeedTestsUseCase } from '../../../../src/application/device-monitoring/use-cases/ListSpeedTestsUseCase';
import {
  IInternetSpeedTester,
  SpeedTestMeasurement
} from '../../../../src/application/device-monitoring/interfaces/IInternetSpeedTester';
import {
  RunSpeedTestDTO,
  SpeedTestProgressDTO
} from '../../../../src/application/device-monitoring/dtos/SpeedTestDTO';
import { ISpeedTestResultRepository } from '../../../../src/domain/device-monitoring/repository/ISpeedTestResultRepository';
import { SpeedTestResult } from '../../../../src/domain/device-monitoring/entities/SpeedTestResult';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';

const USER_ID = '6f1c2b1e-3c1a-4d8a-9a3e-1b2c3d4e5f60';
const PLAN = {
  latencySamples: 10,
  downloadSeconds: 10,
  uploadSeconds: 10
};

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

function makeMeasurement(
  overrides: Partial<SpeedTestMeasurement> = {}
): SpeedTestMeasurement {
  return {
    downloadMbps: 95.4,
    uploadMbps: 42.1,
    latencyMs: 8.2,
    jitterMs: 1.3,
    serverLocation: 'BOG',
    error: null,
    ...overrides
  };
}

class FakeTester implements IInternetSpeedTester {
  readonly plan = PLAN;
  measurement = makeMeasurement();
  progress: SpeedTestProgressDTO[] = [];
  gate: Promise<void> | null = null;
  calls = 0;
  failWith: Error | null = null;

  async measure(
    onProgress: (progress: SpeedTestProgressDTO) => void
  ): Promise<SpeedTestMeasurement> {
    this.calls++;
    if (this.gate) await this.gate;
    if (this.failWith) throw this.failWith;
    this.progress.forEach((frame) => onProgress(frame));
    return this.measurement;
  }
}

function makeRepository(): jest.Mocked<ISpeedTestResultRepository> {
  return {
    save: jest.fn(async (result: SpeedTestResult) =>
      Result.ok(result)
    ),
    list: jest.fn()
  };
}

function makeRequest(
  overrides: Partial<RunSpeedTestDTO> = {}
): RunSpeedTestDTO {
  return {
    startedBy: { userId: USER_ID, email: 'operator@example.local' },
    onStart: jest.fn(),
    onProgress: jest.fn(),
    ...overrides
  };
}

function makeStored(downloadMbps: number): SpeedTestResult {
  return SpeedTestResult.create({
    ...makeMeasurement({ downloadMbps }),
    startedById: USER_ID,
    startedByEmail: 'operator@example.local',
    startedAt: new Date('2026-10-27T14:00:00Z'),
    finishedAt: new Date('2026-10-27T14:00:25Z')
  }).value;
}

describe('RunSpeedTestUseCase', () => {
  let tester: FakeTester;
  let repository: jest.Mocked<ISpeedTestResultRepository>;
  let logger: jest.Mocked<ILogger>;
  let useCase: RunSpeedTestUseCase;

  beforeEach(() => {
    tester = new FakeTester();
    repository = makeRepository();
    logger = makeLogger();
    useCase = new RunSpeedTestUseCase(tester, repository, logger);
  });

  it('announces the plan, relays progress, then keeps and returns the result', async () => {
    const frame: SpeedTestProgressDTO = {
      phase: 'DOWNLOAD',
      elapsedMs: 1000,
      mbps: 90,
      latencyMs: null
    };
    tester.progress = [frame];
    const request = makeRequest();

    const result = await useCase.execute(request);

    expect(result.isSuccess).toBe(true);
    expect(request.onStart).toHaveBeenCalledWith(
      expect.objectContaining({
        ...PLAN,
        startedAt: expect.any(String)
      })
    );
    expect(request.onProgress).toHaveBeenCalledWith(frame);
    expect(result.value.cancelled).toBe(false);
    expect(result.value.result).toMatchObject({
      status: 'COMPLETED',
      downloadMbps: 95.4,
      uploadMbps: 42.1,
      latencyMs: 8.2,
      jitterMs: 1.3,
      serverLocation: 'BOG',
      error: null,
      startedByEmail: 'operator@example.local'
    });
    expect(repository.save).toHaveBeenCalledTimes(1);
    const saved = repository.save.mock.calls[0][0];
    expect(saved.startedById).toBe(USER_ID);
    expect(saved.id.toString()).toBe(result.value.result!.id);
  });

  it('keeps a failed test with what it measured', async () => {
    tester.measurement = makeMeasurement({
      uploadMbps: null,
      error: 'Upload failed: reset'
    });

    const result = await useCase.execute(makeRequest());

    expect(result.value.result).toMatchObject({
      status: 'FAILED',
      downloadMbps: 95.4,
      uploadMbps: null,
      error: 'Upload failed: reset'
    });
    expect(repository.save).toHaveBeenCalledTimes(1);
  });

  it('turns a tester that throws into a kept failure', async () => {
    tester.failWith = new Error('boom');

    const result = await useCase.execute(makeRequest());

    expect(result.value.result).toMatchObject({
      status: 'FAILED',
      downloadMbps: null,
      error: 'The speed test could not run: boom'
    });
    expect(repository.save).toHaveBeenCalledTimes(1);
  });

  it('keeps nothing when the caller stops the test', async () => {
    const abort = new AbortController();
    let release!: () => void;
    tester.gate = new Promise((resolve) => (release = resolve));

    const running = useCase.execute(
      makeRequest({ signal: abort.signal })
    );
    abort.abort();
    release();
    const result = await running;

    expect(result.value).toEqual({ cancelled: true, result: null });
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('refuses a second test while one is running, then allows the next', async () => {
    let release!: () => void;
    tester.gate = new Promise((resolve) => (release = resolve));

    const first = useCase.execute(makeRequest());
    const second = await useCase.execute(makeRequest());
    release();
    await first;
    tester.gate = null;
    const third = await useCase.execute(makeRequest());

    expect(second.isFailure).toBe(true);
    expect(second.error).toBe(SPEED_TEST_RUNNING);
    expect(third.isSuccess).toBe(true);
    expect(tester.calls).toBe(2);
  });

  it('allows the next test after one that failed', async () => {
    tester.failWith = new Error('boom');
    await useCase.execute(makeRequest());
    tester.failWith = null;

    const next = await useCase.execute(makeRequest());

    expect(next.isSuccess).toBe(true);
  });

  it('refuses on a server hosted off site, without measuring', async () => {
    useCase = new RunSpeedTestUseCase(
      tester,
      repository,
      logger,
      false
    );
    const request = makeRequest();

    const result = await useCase.execute(request);

    expect(result.error).toBe(SPEED_TEST_NEEDS_SERVER_ON_SITE);
    expect(tester.calls).toBe(0);
    expect(request.onStart).not.toHaveBeenCalled();
  });

  it('still returns the result when it cannot be stored', async () => {
    repository.save.mockResolvedValue(Result.fail('db down'));

    const result = await useCase.execute(makeRequest());

    expect(result.isSuccess).toBe(true);
    expect(result.value.result!.status).toBe('COMPLETED');
    expect(logger.error).toHaveBeenCalled();
  });

  it('fails when the tester reports an impossible measure', async () => {
    tester.measurement = makeMeasurement({ downloadMbps: -1 });

    const result = await useCase.execute(makeRequest());

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('downloadMbps must be a number');
    expect(repository.save).not.toHaveBeenCalled();
  });
});

describe('ListSpeedTestsUseCase', () => {
  let repository: jest.Mocked<ISpeedTestResultRepository>;
  let useCase: ListSpeedTestsUseCase;

  beforeEach(() => {
    repository = makeRepository();
    useCase = new ListSpeedTestsUseCase(repository, makeLogger());
  });

  it('pages the kept results with 20 by default', async () => {
    repository.list.mockResolvedValue(
      Result.ok({
        results: [makeStored(90), makeStored(80)],
        total: 5
      })
    );

    const result = await useCase.execute({});

    expect(repository.list).toHaveBeenCalledWith({
      limit: 20,
      offset: 0
    });
    expect(result.value).toMatchObject({
      total: 5,
      hasMore: true,
      limit: 20,
      offset: 0
    });
    expect(result.value.results.map((r) => r.downloadMbps)).toEqual([
      90, 80
    ]);
  });

  it('says there is no more on the last page', async () => {
    repository.list.mockResolvedValue(
      Result.ok({ results: [makeStored(90)], total: 3 })
    );

    const result = await useCase.execute({ limit: 2, offset: 2 });

    expect(result.value.hasMore).toBe(false);
  });

  it.each([
    [{ limit: 0 }, 'limit must be between 1 and 100'],
    [{ limit: 101 }, 'limit must be between 1 and 100'],
    [{ offset: -1 }, 'offset must be 0 or more']
  ])('rejects %p', async (request, message) => {
    const result = await useCase.execute(request);

    expect(result.error).toBe(message);
    expect(repository.list).not.toHaveBeenCalled();
  });

  it('fails when the history cannot be read', async () => {
    repository.list.mockResolvedValue(Result.fail('db down'));

    const result = await useCase.execute({});

    expect(result.error).toBe('Failed to list speed tests: db down');
  });
});
