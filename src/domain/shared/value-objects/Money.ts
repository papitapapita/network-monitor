import { ValueObject, Result, Guard } from '../core';

interface MoneyProps {
  readonly cents: number;
}

export class Money extends ValueObject<MoneyProps> {
  private constructor(props: MoneyProps) {
    super(props);
  }

  get cents(): number {
    return this._props.cents;
  }

  public static zero(): Money {
    return new Money({ cents: 0 });
  }

  public static create(amount: number): Result<Money> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(amount, 'amount'),
      Guard.isNumber(amount, 'amount')
    ]);
    if (!guardResult.succeeded) {
      return Result.fail<Money>(guardResult.message!);
    }

    if (!Number.isFinite(amount)) {
      return Result.fail<Money>(
        'Money amount must be a finite number'
      );
    }
    if (amount < 0) {
      return Result.fail<Money>('Money amount cannot be negative');
    }

    return Result.ok<Money>(
      new Money({ cents: Math.round(amount * 100) })
    );
  }

  public static fromCents(cents: number): Result<Money> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(cents, 'cents'),
      Guard.isNumber(cents, 'cents')
    ]);
    if (!guardResult.succeeded) {
      return Result.fail<Money>(guardResult.message!);
    }

    if (!Number.isInteger(cents)) {
      return Result.fail<Money>('Money cents must be an integer');
    }
    if (cents < 0) {
      return Result.fail<Money>('Money cents cannot be negative');
    }

    return Result.ok<Money>(new Money({ cents }));
  }

  public add(other: Money): Money {
    return new Money({ cents: this._props.cents + other.cents });
  }

  public multiply(factor: number): Money {
    return new Money({
      cents: Math.round(this._props.cents * factor)
    });
  }

  public toNumber(): number {
    return this._props.cents / 100;
  }

  public format(): string {
    return this.toNumber().toFixed(2);
  }

  public toString(): string {
    return this.format();
  }
}
