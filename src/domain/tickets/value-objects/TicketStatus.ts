import { ValueObject, Result, Guard } from 'domain/shared/core';
import { TicketStatusProps } from '../props';

export class TicketStatus extends ValueObject<TicketStatusProps> {
  static readonly OPEN = 'OPEN';
  static readonly ASSIGNED = 'ASSIGNED';
  static readonly IN_PROGRESS = 'IN_PROGRESS';
  static readonly RESOLVED = 'RESOLVED';
  static readonly CANCELLED = 'CANCELLED';

  private static readonly VALID_STATUSES = [
    TicketStatus.OPEN,
    TicketStatus.ASSIGNED,
    TicketStatus.IN_PROGRESS,
    TicketStatus.RESOLVED,
    TicketStatus.CANCELLED
  ] as const;

  get value(): string {
    return this._props.value;
  }

  private constructor(props: TicketStatusProps) {
    super(props);
  }

  public static create(status: string): Result<TicketStatus> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(status, 'status'),
      Guard.isString(status, 'status')
    ]);
    if (!guardResult.succeeded) {
      return Result.fail<TicketStatus>(guardResult.message!);
    }

    const normalized = status.trim().toUpperCase();

    if (!TicketStatus.isValid(normalized)) {
      return Result.fail<TicketStatus>(
        `Invalid ticket status: ${status}. Must be one of: ${TicketStatus.VALID_STATUSES.join(', ')}`
      );
    }

    return Result.ok<TicketStatus>(
      new TicketStatus({ value: normalized })
    );
  }

  public static reconstitute(status: string): TicketStatus {
    return new TicketStatus({ value: status });
  }

  private static isValid(value: string): boolean {
    return TicketStatus.VALID_STATUSES.includes(
      value as (typeof TicketStatus.VALID_STATUSES)[number]
    );
  }

  public isOpen(): boolean {
    return this._props.value === TicketStatus.OPEN;
  }

  public isAssigned(): boolean {
    return this._props.value === TicketStatus.ASSIGNED;
  }

  public isInProgress(): boolean {
    return this._props.value === TicketStatus.IN_PROGRESS;
  }

  public isResolved(): boolean {
    return this._props.value === TicketStatus.RESOLVED;
  }

  public isCancelled(): boolean {
    return this._props.value === TicketStatus.CANCELLED;
  }

  // RESOLVED and CANCELLED are terminal: the work is over and the record is
  // history. Nothing may edit a ticket past this point.
  public isTerminal(): boolean {
    return this.isResolved() || this.isCancelled();
  }

  public toString(): string {
    return this._props.value;
  }
}
