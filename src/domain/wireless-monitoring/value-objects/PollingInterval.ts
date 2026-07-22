import { ValueObject, Result, Guard } from 'domain/shared/core';

interface PollingIntervalProps {
  readonly seconds: number;
}

// AirOS status pages are scraped over authenticated HTTP; polling faster than
// this overloads the embedded web server on the radio.
const MIN_SECONDS = 60;
const MAX_SECONDS = 86400;

export class PollingInterval extends ValueObject<PollingIntervalProps> {
  private constructor(props: PollingIntervalProps) {
    super(props);
  }

  get seconds(): number {
    return this._props.seconds;
  }

  static create(seconds: number): Result<PollingInterval> {
    const guardResult = Guard.againstNullOrUndefined(
      seconds,
      'seconds'
    );
    if (!guardResult.succeeded)
      return Result.fail(guardResult.message!);

    if (!Number.isInteger(seconds) || seconds < MIN_SECONDS) {
      return Result.fail(
        `Wireless polling interval must be at least ${MIN_SECONDS} seconds`
      );
    }
    if (seconds > MAX_SECONDS) {
      return Result.fail(
        `Wireless polling interval must not exceed ${MAX_SECONDS} seconds`
      );
    }

    return Result.ok(new PollingInterval({ seconds }));
  }

  static reconstitute(seconds: number): PollingInterval {
    return new PollingInterval({ seconds });
  }
}
