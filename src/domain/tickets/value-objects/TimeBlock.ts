import { ValueObject, Result, Guard } from 'domain/shared/core';
import { TimeOfDay } from 'domain/shared/value-objects';
import { TimeBlockProps } from '../props';

// A window of wall-clock time on the ticket's scheduled day. Stored as times of
// day rather than instants so the block cannot drift onto a neighbouring date.
export class TimeBlock extends ValueObject<TimeBlockProps> {
  get start(): TimeOfDay {
    return this._props.start;
  }

  get end(): TimeOfDay {
    return this._props.end;
  }

  private constructor(props: TimeBlockProps) {
    super(props);
  }

  public static create(props: TimeBlockProps): Result<TimeBlock> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(props.start, 'start time'),
      Guard.againstNullOrUndefined(props.end, 'end time')
    ]);
    if (!guardResult.succeeded) {
      return Result.fail<TimeBlock>(guardResult.message!);
    }

    // No overnight blocks: a block belongs to exactly one scheduled day.
    if (props.end.toMinutes() <= props.start.toMinutes()) {
      return Result.fail<TimeBlock>(
        'Time block end must be later than its start'
      );
    }

    return Result.ok<TimeBlock>(new TimeBlock(props));
  }

  public static fromStrings(
    start: string,
    end: string
  ): Result<TimeBlock> {
    const startResult = TimeOfDay.create(start);
    if (startResult.isFailure) {
      return Result.fail<TimeBlock>(
        `Invalid start time: ${startResult.error}`
      );
    }

    const endResult = TimeOfDay.create(end);
    if (endResult.isFailure) {
      return Result.fail<TimeBlock>(
        `Invalid end time: ${endResult.error}`
      );
    }

    return TimeBlock.create({
      start: startResult.value,
      end: endResult.value
    });
  }

  public static reconstitute(props: TimeBlockProps): TimeBlock {
    return new TimeBlock(props);
  }

  public toString(): string {
    return `${this.start.toString()}-${this.end.toString()}`;
  }
}
