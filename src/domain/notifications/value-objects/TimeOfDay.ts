import { ValueObject, Result, Guard } from 'domain/shared/core';
import { TimeOfDayProps } from '../props';

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export class TimeOfDay extends ValueObject<TimeOfDayProps> {
  get hours(): number {
    return this._props.hours;
  }

  get minutes(): number {
    return this._props.minutes;
  }

  private constructor(props: TimeOfDayProps) {
    super(props);
  }

  public static create(value: string): Result<TimeOfDay> {
    const guardResult = Guard.againstNullOrUndefined(
      value,
      'time of day'
    );
    if (!guardResult.succeeded) {
      return Result.fail<TimeOfDay>(guardResult.message!);
    }

    const match = TIME_REGEX.exec(value.trim());
    if (!match) {
      return Result.fail<TimeOfDay>(
        `time of day must be in HH:mm 24-hour format, got "${value}"`
      );
    }

    return Result.ok<TimeOfDay>(
      new TimeOfDay({
        hours: Number(match[1]),
        minutes: Number(match[2])
      })
    );
  }

  // Server-local wall clock — quiet hours are evaluated against the
  // operator's own clock, not a stored timezone.
  public static fromDate(date: Date): TimeOfDay {
    return new TimeOfDay({
      hours: date.getHours(),
      minutes: date.getMinutes()
    });
  }

  public static reconstitute(props: TimeOfDayProps): TimeOfDay {
    return new TimeOfDay(props);
  }

  public toMinutes(): number {
    return this._props.hours * 60 + this._props.minutes;
  }

  public toString(): string {
    const hh = String(this._props.hours).padStart(2, '0');
    const mm = String(this._props.minutes).padStart(2, '0');
    return `${hh}:${mm}`;
  }
}
