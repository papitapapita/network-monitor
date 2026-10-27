import { PrismaClient } from '../../../src/generated/prisma/client';
import { ILogger } from '../../../src/application/shared/interfaces';
import {
  IInternetSpeedTester,
  SpeedTestMeasurement
} from '../../../src/application/device-monitoring/interfaces';
import { SpeedTestProgressDTO } from '../../../src/application/device-monitoring/dtos';
import {
  ListSpeedTestsUseCase,
  RunSpeedTestUseCase
} from '../../../src/application/device-monitoring/use-cases';
import { PrismaSpeedTestResultRepository } from '../../../src/infrastructure/persistence';

// Stands in for Cloudflare: never touches the network. Set `gated` to hold
// the test mid-run until release().
export class FakeSpeedTester implements IInternetSpeedTester {
  readonly plan = {
    latencySamples: 10,
    downloadSeconds: 10,
    uploadSeconds: 10
  };
  measurement: SpeedTestMeasurement = {
    downloadMbps: 95.4,
    uploadMbps: 42.1,
    latencyMs: 8.2,
    jitterMs: 1.3,
    serverLocation: 'BOG',
    error: null
  };
  progress: SpeedTestProgressDTO[] = [
    { phase: 'LATENCY', elapsedMs: 90, mbps: null, latencyMs: 8.2 },
    {
      phase: 'DOWNLOAD',
      elapsedMs: 1000,
      mbps: 93.1,
      latencyMs: null
    },
    { phase: 'UPLOAD', elapsedMs: 1000, mbps: 41.7, latencyMs: null }
  ];
  gated = false;
  calls = 0;
  // settles once a measure call has returned, stopped or not
  finished: Promise<void> = Promise.resolve();
  private waiting: (() => void)[] = [];

  release(): void {
    this.gated = false;
    this.waiting.splice(0).forEach((resume) => resume());
  }

  measure(
    onProgress: (progress: SpeedTestProgressDTO) => void,
    signal: AbortSignal
  ): Promise<SpeedTestMeasurement> {
    this.calls++;
    const run = this.run(onProgress, signal);
    this.finished = run.then(() => undefined);
    return run;
  }

  private async run(
    onProgress: (progress: SpeedTestProgressDTO) => void,
    signal: AbortSignal
  ): Promise<SpeedTestMeasurement> {
    if (this.gated && !signal.aborted) {
      await new Promise<void>((resume) => {
        this.waiting.push(resume);
        signal.addEventListener('abort', () => resume(), {
          once: true
        });
      });
    }
    this.progress.forEach((frame) => onProgress(frame));
    return this.measurement;
  }
}

export function buildSpeedTestUseCases(
  prisma: PrismaClient,
  tester: IInternetSpeedTester,
  logger: ILogger,
  serverOnSite = true
): { run: RunSpeedTestUseCase; list: ListSpeedTestsUseCase } {
  const repository = new PrismaSpeedTestResultRepository(prisma);
  return {
    run: new RunSpeedTestUseCase(
      tester,
      repository,
      logger,
      serverOnSite
    ),
    list: new ListSpeedTestsUseCase(repository, logger)
  };
}

// A kept result, completed unless told otherwise. Returns its id.
export async function seedSpeedTest(
  prisma: PrismaClient,
  opts: {
    startedAt: Date;
    downloadMbps?: number | null;
    error?: string | null;
    startedById?: string | null;
  }
): Promise<string> {
  const record = await prisma.speedTestResult.create({
    data: {
      status: opts.error ? 'FAILED' : 'COMPLETED',
      downloadMbps:
        opts.downloadMbps === undefined ? 90 : opts.downloadMbps,
      uploadMbps: opts.error ? null : 40,
      latencyMs: 8,
      jitterMs: 1,
      serverLocation: 'BOG',
      error: opts.error ?? null,
      startedById: opts.startedById ?? null,
      startedByEmail: 'operator@example.local',
      startedAt: opts.startedAt,
      finishedAt: new Date(opts.startedAt.getTime() + 25_000)
    }
  });
  return record.id;
}
