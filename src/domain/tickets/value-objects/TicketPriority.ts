import { ValueObject, Result, Guard } from 'domain/shared/core';
import { TicketPriorityProps } from '../props';

// Lower rank sorts first — the day sheet shows the most urgent job at the top.
const PRIORITY_RANKS: Record<string, number> = {
  URGENT: 0,
  HIGH: 1,
  NORMAL: 2,
  LOW: 3
};

export class TicketPriority extends ValueObject<TicketPriorityProps> {
  static readonly LOW = 'LOW';
  static readonly NORMAL = 'NORMAL';
  static readonly HIGH = 'HIGH';
  static readonly URGENT = 'URGENT';

  private static readonly VALID_PRIORITIES = [
    TicketPriority.LOW,
    TicketPriority.NORMAL,
    TicketPriority.HIGH,
    TicketPriority.URGENT
  ] as const;

  get value(): string {
    return this._props.value;
  }

  get rank(): number {
    return PRIORITY_RANKS[this._props.value];
  }

  private constructor(props: TicketPriorityProps) {
    super(props);
  }

  public static create(priority: string): Result<TicketPriority> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(priority, 'priority'),
      Guard.isString(priority, 'priority')
    ]);
    if (!guardResult.succeeded) {
      return Result.fail<TicketPriority>(guardResult.message!);
    }

    const normalized = priority.trim().toUpperCase();

    if (!TicketPriority.isValid(normalized)) {
      return Result.fail<TicketPriority>(
        `Invalid ticket priority: ${priority}. Must be one of: ${TicketPriority.VALID_PRIORITIES.join(', ')}`
      );
    }

    return Result.ok<TicketPriority>(
      new TicketPriority({ value: normalized })
    );
  }

  public static reconstitute(priority: string): TicketPriority {
    return new TicketPriority({ value: priority });
  }

  private static isValid(value: string): boolean {
    return TicketPriority.VALID_PRIORITIES.includes(
      value as (typeof TicketPriority.VALID_PRIORITIES)[number]
    );
  }

  public toString(): string {
    return this._props.value;
  }
}
