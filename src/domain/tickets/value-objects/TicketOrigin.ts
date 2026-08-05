import { ValueObject, Result, Guard } from 'domain/shared/core';
import { TicketOriginProps } from '../props';

export class TicketOrigin extends ValueObject<TicketOriginProps> {
  static readonly MANUAL = 'MANUAL';
  static readonly DEVICE_ALERT = 'DEVICE_ALERT';
  static readonly WIRELESS_ALERT = 'WIRELESS_ALERT';

  private static readonly VALID_ORIGINS = [
    TicketOrigin.MANUAL,
    TicketOrigin.DEVICE_ALERT,
    TicketOrigin.WIRELESS_ALERT
  ] as const;

  get value(): string {
    return this._props.value;
  }

  private constructor(props: TicketOriginProps) {
    super(props);
  }

  public static create(origin: string): Result<TicketOrigin> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(origin, 'origin'),
      Guard.isString(origin, 'origin')
    ]);
    if (!guardResult.succeeded) {
      return Result.fail<TicketOrigin>(guardResult.message!);
    }

    const normalized = origin.trim().toUpperCase();

    if (!TicketOrigin.isValid(normalized)) {
      return Result.fail<TicketOrigin>(
        `Invalid ticket origin: ${origin}. Must be one of: ${TicketOrigin.VALID_ORIGINS.join(', ')}`
      );
    }

    return Result.ok<TicketOrigin>(
      new TicketOrigin({ value: normalized })
    );
  }

  public static reconstitute(origin: string): TicketOrigin {
    return new TicketOrigin({ value: origin });
  }

  private static isValid(value: string): boolean {
    return TicketOrigin.VALID_ORIGINS.includes(
      value as (typeof TicketOrigin.VALID_ORIGINS)[number]
    );
  }

  public isManual(): boolean {
    return this._props.value === TicketOrigin.MANUAL;
  }

  public isFromAlert(): boolean {
    return !this.isManual();
  }

  public toString(): string {
    return this._props.value;
  }
}
