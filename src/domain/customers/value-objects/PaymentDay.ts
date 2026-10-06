import { ValueObject, Result, Guard } from 'domain/shared/core';

interface PaymentDayProps {
  value: number;
}

// The day of the month a customer's bill must be paid by. ISPs run two
// collection groups, the 15th and the 30th; the 30th means the month's last
// day in February (CUS-024).
export class PaymentDay extends ValueObject<PaymentDayProps> {
  static readonly ALLOWED: readonly number[] = [15, 30];
  static readonly DEFAULT = 30;

  get value(): number {
    return this._props.value;
  }

  private constructor(props: PaymentDayProps) {
    super(props);
  }

  public static create(day: number): Result<PaymentDay> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(day, 'paymentDay'),
      Guard.isNumber(day, 'paymentDay')
    ]);
    if (!guardResult.succeeded) {
      return Result.fail<PaymentDay>(guardResult.message!);
    }

    if (!PaymentDay.ALLOWED.includes(day)) {
      return Result.fail<PaymentDay>(
        `Payment day must be one of ${PaymentDay.ALLOWED.join(', ')}`
      );
    }

    return Result.ok<PaymentDay>(new PaymentDay({ value: day }));
  }

  public static default(): PaymentDay {
    return new PaymentDay({ value: PaymentDay.DEFAULT });
  }

  public static reconstitute(day: number): PaymentDay {
    return new PaymentDay({ value: day });
  }

  public toString(): string {
    return String(this._props.value);
  }
}
