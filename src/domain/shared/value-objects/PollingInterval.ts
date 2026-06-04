import { ValueObject, Result, Guard } from '../core';

interface PollingIntervalProps {
  readonly seconds: number;
}

const MIN_SECONDS = 30;
const MAX_SECONDS = 86400;

export class PollingInterval extends ValueObject<PollingIntervalProps> {
  static readonly MIN_SECONDS = MIN_SECONDS;
  static readonly MAX_SECONDS = MAX_SECONDS;

  private constructor(props: PollingIntervalProps) {
    super(props);
  }

  get seconds(): number {
    return this._props.seconds;
  }

  static create(seconds: number): Result<PollingInterval> {
    const guardResult = Guard.againstNullOrUndefined(seconds, 'seconds');
    if (!guardResult.succeeded) return Result.fail(guardResult.message!);

    if (!Number.isInteger(seconds) || seconds < MIN_SECONDS) {
      return Result.fail(
        `Polling interval must be at least ${MIN_SECONDS} seconds`
      );
    }
    if (seconds > MAX_SECONDS) {
      return Result.fail(
        `Polling interval must not exceed ${MAX_SECONDS} seconds`
      );
    }

    return Result.ok(new PollingInterval({ seconds }));
  }

  static reconstitute(seconds: number): PollingInterval {
    return new PollingInterval({ seconds });
  }
}
