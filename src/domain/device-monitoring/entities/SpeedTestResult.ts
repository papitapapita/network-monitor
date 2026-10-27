import { Entity, Guard, Result } from 'domain/shared/core';
import { SpeedTestResultId } from 'domain/shared/ids';
import { SpeedTestResultProps, SpeedTestStatus } from '../props';

const MAX_ERROR_LENGTH = 500;
const MAX_SERVER_LOCATION_LENGTH = 50;

export interface SpeedTestResultInput {
  downloadMbps: number | null;
  uploadMbps: number | null;
  latencyMs: number | null;
  jitterMs: number | null;
  serverLocation?: string | null;
  // set when the test could not finish (MON-103)
  error?: string | null;
  startedById: string | null;
  startedByEmail: string;
  startedAt: Date;
  finishedAt: Date;
}

// One finished run of the internet speed test (MON-100). A failed run keeps
// whatever it measured before it failed (MON-103).
export class SpeedTestResult extends Entity<
  SpeedTestResultProps,
  SpeedTestResultId
> {
  private constructor(
    props: SpeedTestResultProps,
    id: SpeedTestResultId
  ) {
    super(props, id);
  }

  get status(): SpeedTestStatus {
    return this.props.status;
  }

  get downloadMbps(): number | null {
    return this.props.downloadMbps;
  }

  get uploadMbps(): number | null {
    return this.props.uploadMbps;
  }

  get latencyMs(): number | null {
    return this.props.latencyMs;
  }

  get jitterMs(): number | null {
    return this.props.jitterMs;
  }

  get serverLocation(): string | null {
    return this.props.serverLocation;
  }

  get error(): string | null {
    return this.props.error;
  }

  get startedById(): string | null {
    return this.props.startedById;
  }

  get startedByEmail(): string {
    return this.props.startedByEmail;
  }

  get startedAt(): Date {
    return this.props.startedAt;
  }

  get finishedAt(): Date {
    return this.props.finishedAt;
  }

  public static create(
    input: SpeedTestResultInput,
    id: SpeedTestResultId = SpeedTestResultId.create()
  ): Result<SpeedTestResult> {
    const guard = Guard.againstNullOrUndefinedBulk([
      {
        argument: input?.startedByEmail,
        argumentName: 'startedByEmail'
      },
      { argument: input?.startedAt, argumentName: 'startedAt' },
      { argument: input?.finishedAt, argumentName: 'finishedAt' }
    ]);
    if (!guard.succeeded) {
      return Result.fail<SpeedTestResult>(guard.message!);
    }

    const startedByEmail = input.startedByEmail.trim();
    const error = input.error?.trim() || null;
    const serverLocation = input.serverLocation?.trim() || null;
    const measures = {
      downloadMbps: input.downloadMbps,
      uploadMbps: input.uploadMbps,
      latencyMs: input.latencyMs,
      jitterMs: input.jitterMs
    };
    const allMeasured = Object.values(measures).every(
      (value) => value !== null
    );

    const problem =
      (startedByEmail ? null : 'startedByEmail is required') ??
      SpeedTestResult.invalidDates(
        input.startedAt,
        input.finishedAt
      ) ??
      SpeedTestResult.invalidMeasure(measures) ??
      (error === null || error.length <= MAX_ERROR_LENGTH
        ? null
        : `error must be at most ${MAX_ERROR_LENGTH} characters`) ??
      (serverLocation === null ||
      serverLocation.length <= MAX_SERVER_LOCATION_LENGTH
        ? null
        : `serverLocation must be at most ${MAX_SERVER_LOCATION_LENGTH} characters`) ??
      (error !== null || allMeasured
        ? null
        : 'a speed test without an error must have every measure');
    if (problem) return Result.fail<SpeedTestResult>(problem);

    return Result.ok(
      new SpeedTestResult(
        {
          status: error === null ? 'COMPLETED' : 'FAILED',
          ...measures,
          serverLocation,
          error,
          startedById: input.startedById ?? null,
          startedByEmail,
          startedAt: input.startedAt,
          finishedAt: input.finishedAt
        },
        id
      )
    );
  }

  // bypasses validation — for repository use only
  public static reconstitute(
    id: SpeedTestResultId,
    props: SpeedTestResultProps
  ): SpeedTestResult {
    return new SpeedTestResult(props, id);
  }

  private static invalidDates(
    startedAt: Date,
    finishedAt: Date
  ): string | null {
    if (Number.isNaN(startedAt.getTime())) {
      return 'startedAt must be a valid date';
    }
    if (Number.isNaN(finishedAt.getTime())) {
      return 'finishedAt must be a valid date';
    }
    if (finishedAt < startedAt) {
      return 'finishedAt must not be before startedAt';
    }
    return null;
  }

  private static invalidMeasure(
    measures: Record<string, number | null>
  ): string | null {
    for (const [name, value] of Object.entries(measures)) {
      if (value === null) continue;
      if (!Number.isFinite(value) || value < 0) {
        return `${name} must be a number of 0 or more`;
      }
    }
    return null;
  }
}
