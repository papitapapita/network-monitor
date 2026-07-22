import { PollingIntervalProps } from '../props';
import { ValueObject, Result, Guard } from 'domain/shared/core';

export class PollingInterval extends ValueObject<PollingIntervalProps> {
  // The orchestrator sweeps for due devices on a 1s tick, so intervals below
  // this cannot be honoured with acceptable jitter.
  public static readonly MIN_SECONDS = 5;
  public static readonly MAX_SECONDS = 86400;
  public static readonly DEFAULT_SECONDS = 60;

  get seconds(): number {
    return this._props.seconds;
  }

  private constructor(props: PollingIntervalProps) {
    super(props);
  }

  public static create(seconds: number): Result<PollingInterval> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(
        seconds,
        'polling interval seconds'
      ),
      Guard.isNumber(seconds, 'polling interval seconds'),
      Guard.inRange(
        seconds,
        this.MIN_SECONDS,
        this.MAX_SECONDS,
        'polling interval'
      )
    ]);

    if (!guardResult.succeeded) {
      return Result.fail<PollingInterval>(guardResult.message!);
    }

    const roundedSeconds = Math.round(seconds);

    return Result.ok<PollingInterval>(
      new PollingInterval({ seconds: roundedSeconds })
    );
  }

  public static createDefault(): PollingInterval {
    return new PollingInterval({
      seconds: this.DEFAULT_SECONDS
    });
  }

  public static reconstitute(
    props: PollingIntervalProps
  ): PollingInterval {
    return new PollingInterval(props);
  }
}
