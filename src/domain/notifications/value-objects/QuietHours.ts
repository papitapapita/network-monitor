import { ValueObject, Result, Guard } from 'domain/shared/core';
import { QuietHoursProps } from '../props';
import { TimeOfDay } from './TimeOfDay';

export class QuietHours extends ValueObject<QuietHoursProps> {
  get start(): TimeOfDay {
    return this._props.start;
  }

  get end(): TimeOfDay {
    return this._props.end;
  }

  private constructor(props: QuietHoursProps) {
    super(props);
  }

  public static create(
    start: TimeOfDay,
    end: TimeOfDay
  ): Result<QuietHours> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(start, 'quiet hours start'),
      Guard.againstNullOrUndefined(end, 'quiet hours end')
    ]);
    if (!guardResult.succeeded) {
      return Result.fail<QuietHours>(guardResult.message!);
    }

    if (start.toMinutes() === end.toMinutes()) {
      return Result.fail<QuietHours>(
        'quiet hours start and end cannot be the same time'
      );
    }

    return Result.ok<QuietHours>(new QuietHours({ start, end }));
  }

  public static reconstitute(props: QuietHoursProps): QuietHours {
    return new QuietHours(props);
  }

  // Overnight windows (e.g. 22:00-07:00) cross midnight: start > end means
  // "now" is inside the window when it's after start OR before end, not
  // strictly between the two.
  public contains(now: TimeOfDay): boolean {
    const start = this._props.start.toMinutes();
    const end = this._props.end.toMinutes();
    const n = now.toMinutes();

    if (start < end) {
      return n >= start && n < end;
    }
    return n >= start || n < end;
  }
}
