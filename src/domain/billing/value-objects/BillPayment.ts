import { ValueObject, Result, Guard } from 'domain/shared/core';
import { UserId } from 'domain/shared/ids';
import { Money } from 'domain/shared/value-objects';
import { PaymentMethod } from '../enums';

const MAX_REFERENCE_LENGTH = 100;

interface BillPaymentProps {
  readonly method: PaymentMethod;
  // The receipt or transaction number, when there is one.
  readonly reference: string | null;
  readonly amount: Money;
  // When the customer paid, which may be before it was entered.
  readonly paidAt: Date;
  // Who entered it; null for a payment no user entered.
  readonly recordedBy: UserId | null;
}

// A payment recorded against a bill (BIL-300).
export class BillPayment extends ValueObject<BillPaymentProps> {
  private constructor(props: BillPaymentProps) {
    super(props);
  }

  get method(): PaymentMethod {
    return this._props.method;
  }

  get reference(): string | null {
    return this._props.reference;
  }

  get amount(): Money {
    return this._props.amount;
  }

  get paidAt(): Date {
    return this._props.paidAt;
  }

  get recordedBy(): UserId | null {
    return this._props.recordedBy;
  }

  public static create(props: BillPaymentProps): Result<BillPayment> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(props.amount, 'amount'),
      Guard.againstNullOrUndefined(props.paidAt, 'paidAt'),
      Guard.isDate(props.paidAt, 'paidAt')
    ]);
    if (!guardResult.succeeded) {
      return Result.fail<BillPayment>(guardResult.message!);
    }

    const methods = Object.values(PaymentMethod) as string[];
    if (!methods.includes(props.method)) {
      return Result.fail<BillPayment>(
        `Invalid payment method: must be one of ${methods.join(', ')}`
      );
    }

    const reference = props.reference?.trim() || null;
    if (
      reference !== null &&
      reference.length > MAX_REFERENCE_LENGTH
    ) {
      return Result.fail<BillPayment>(
        `Invalid payment reference: cannot exceed ${MAX_REFERENCE_LENGTH} characters`
      );
    }

    return Result.ok(new BillPayment({ ...props, reference }));
  }

  // bypasses validation — for repository use only
  public static reconstitute(props: BillPaymentProps): BillPayment {
    return new BillPayment(props);
  }
}
