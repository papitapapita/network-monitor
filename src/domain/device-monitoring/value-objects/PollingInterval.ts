import { PollingIntervalProps } from '../props';
import { ValueObject, Result, Guard } from 'domain/shared/core';

export class PollingInterval extends ValueObject<PollingIntervalProps> {
  public static readonly MIN_SECONDS = 1;
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

  public static fromMinutes(
    minutes: number
  ): Result<PollingInterval> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(
        minutes,
        'polling interval minutes'
      ),
      Guard.isNumber(minutes, 'polling interval minutes')
    ]);

    if (!guardResult.succeeded) {
      return Result.fail<PollingInterval>(guardResult.message!);
    }

    const seconds = Math.round(minutes * 60);
    return this.create(seconds);
  }

  public static reconstitute(
    props: PollingIntervalProps
  ): PollingInterval {
    return new PollingInterval(props);
  }

  public static fromHours(hours: number): Result<PollingInterval> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(hours, 'polling interval hours'),
      Guard.isNumber(hours, 'polling interval hours')
    ]);

    if (!guardResult.succeeded) {
      return Result.fail<PollingInterval>(guardResult.message!);
    }

    const seconds = Math.round(hours * 3600);
    return this.create(seconds);
  }

  public toMilliseconds(): number {
    return this._props.seconds * 1000;
  }

  public toMinutes(): number {
    return Math.round((this._props.seconds / 60) * 100) / 100;
  }

  public toHours(): number {
    return Math.round((this._props.seconds / 3600) * 100) / 100;
  }

  public toDisplayString(): string {
    const { seconds } = this._props;

    if (seconds < 60) {
      return `${seconds} second${seconds !== 1 ? 's' : ''}`;
    }

    if (seconds < 3600) {
      const minutes = Math.round(seconds / 60);
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }

    const hours = Math.round(seconds / 3600);
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
  }

  public toString(): string {
    return this._props.seconds.toString();
  }
}
