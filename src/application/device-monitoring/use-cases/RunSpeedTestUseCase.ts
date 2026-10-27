import { Result } from 'domain/shared/core';
import { SpeedTestResult } from 'domain/device-monitoring/entities';
import { ISpeedTestResultRepository } from 'domain/device-monitoring/repository';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  IInternetSpeedTester,
  SpeedTestMeasurement
} from '../interfaces';
import { SpeedTestMapper } from '../mappers';
import { RunSpeedTestDTO, SpeedTestRunDTO } from '../dtos';

// Shared with the controller, which answers 409 when a failure carries one.
export const SPEED_TEST_RUNNING = 'A speed test is already running';
export const SPEED_TEST_NEEDS_SERVER_ON_SITE =
  "This server is not on the ISP's network, so its speed test would not measure it";

// MON-100: measures this server's internet connection, now, and keeps the
// result.
export class RunSpeedTestUseCase extends UseCase<
  RunSpeedTestDTO,
  SpeedTestRunDTO
> {
  private running = false;

  constructor(
    private readonly tester: IInternetSpeedTester,
    private readonly repository: ISpeedTestResultRepository,
    logger: ILogger,
    private readonly serverOnSite = true
  ) {
    super(logger, 'RunSpeedTestUseCase');
  }

  protected async executeImpl(
    request: RunSpeedTestDTO
  ): Promise<Result<SpeedTestRunDTO>> {
    // MON-104
    if (!this.serverOnSite) {
      return this.fail(SPEED_TEST_NEEDS_SERVER_ON_SITE);
    }
    // MON-101: checked and set before the first await, so two clicks cannot
    // both get through.
    if (this.running) return this.fail(SPEED_TEST_RUNNING);
    this.running = true;
    try {
      return await this.run(request);
    } finally {
      this.running = false;
    }
  }

  private async run(
    request: RunSpeedTestDTO
  ): Promise<Result<SpeedTestRunDTO>> {
    const { startedBy, onStart, onProgress } = request;
    const signal = request.signal ?? new AbortController().signal;

    const startedAt = new Date();
    onStart({
      startedAt: startedAt.toISOString(),
      ...this.tester.plan
    });
    const measurement = await this.measure(onProgress, signal);
    // MON-101: a stopped test is not kept.
    if (signal.aborted)
      return this.ok({ cancelled: true, result: null });

    const created = SpeedTestResult.create({
      ...measurement,
      startedById: startedBy.userId,
      startedByEmail: startedBy.email,
      startedAt,
      finishedAt: new Date()
    });
    if (created.isFailure) {
      return this.fail(`Invalid speed test result: ${created.error}`);
    }

    // The result is still shown when it cannot be stored: the test already
    // ran, and a failure here would only hide it.
    const saved = await this.repository.save(created.value);
    if (saved.isFailure) {
      this.logger.error(
        'Failed to save a speed test result',
        undefined,
        {
          error: saved.error
        }
      );
    }
    return this.ok({
      cancelled: false,
      result: SpeedTestMapper.toDTO(created.value)
    });
  }

  private async measure(
    onProgress: RunSpeedTestDTO['onProgress'],
    signal: AbortSignal
  ): Promise<SpeedTestMeasurement> {
    try {
      return await this.tester.measure(onProgress, signal);
    } catch (error) {
      return {
        downloadMbps: null,
        uploadMbps: null,
        latencyMs: null,
        jitterMs: null,
        serverLocation: null,
        error: `The speed test could not run: ${
          error instanceof Error ? error.message : String(error)
        }`
      };
    }
  }

  protected sanitizeForLogging(data: unknown): unknown {
    if (data && typeof data === 'object' && 'startedBy' in data) {
      return {
        startedBy: (data as RunSpeedTestDTO).startedBy.userId
      };
    }
    return data;
  }
}
