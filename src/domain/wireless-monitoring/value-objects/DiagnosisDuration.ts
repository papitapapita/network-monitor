import { ValueObject, Result, Guard } from 'domain/shared/core';

interface DiagnosisDurationProps {
  readonly seconds: number;
}

// A diagnosis scrapes the radio every couple of seconds — far faster than
// PollingInterval allows — so it is bounded to a short window instead.
const MIN_SECONDS = 10;
const MAX_SECONDS = 300;
export const DEFAULT_DIAGNOSIS_SECONDS = 60;

export class DiagnosisDuration extends ValueObject<DiagnosisDurationProps> {
  private constructor(props: DiagnosisDurationProps) {
    super(props);
  }

  get seconds(): number {
    return this._props.seconds;
  }

  static create(seconds: number): Result<DiagnosisDuration> {
    const guardResult = Guard.againstNullOrUndefined(
      seconds,
      'seconds'
    );
    if (!guardResult.succeeded)
      return Result.fail(guardResult.message!);

    if (!Number.isInteger(seconds) || seconds < MIN_SECONDS) {
      return Result.fail(
        `Diagnosis duration must be at least ${MIN_SECONDS} seconds`
      );
    }
    if (seconds > MAX_SECONDS) {
      return Result.fail(
        `Diagnosis duration must not exceed ${MAX_SECONDS} seconds`
      );
    }

    return Result.ok(new DiagnosisDuration({ seconds }));
  }

  static reconstitute(seconds: number): DiagnosisDuration {
    return new DiagnosisDuration({ seconds });
  }
}
