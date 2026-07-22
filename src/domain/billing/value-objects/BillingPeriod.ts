import { ValueObject, Result, Guard } from 'domain/shared/core';

interface BillingPeriodProps {
  readonly year: number;
  readonly month: number;
}

const MIN_YEAR = 2000;
const MAX_YEAR = 2100;

export class BillingPeriod extends ValueObject<BillingPeriodProps> {
  private constructor(props: BillingPeriodProps) {
    super(props);
  }

  get year(): number {
    return this._props.year;
  }

  get month(): number {
    return this._props.month;
  }

  public static create(
    year: number,
    month: number
  ): Result<BillingPeriod> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(year, 'year'),
      Guard.isNumber(year, 'year'),
      Guard.againstNullOrUndefined(month, 'month'),
      Guard.isNumber(month, 'month')
    ]);
    if (!guardResult.succeeded) {
      return Result.fail<BillingPeriod>(guardResult.message!);
    }

    if (
      !Number.isInteger(year) ||
      year < MIN_YEAR ||
      year > MAX_YEAR
    ) {
      return Result.fail<BillingPeriod>(
        `year must be an integer between ${MIN_YEAR} and ${MAX_YEAR}`
      );
    }
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      return Result.fail<BillingPeriod>(
        'month must be an integer between 1 and 12'
      );
    }

    return Result.ok<BillingPeriod>(
      new BillingPeriod({ year, month })
    );
  }

  public static fromString(period: string): Result<BillingPeriod> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(period, 'period'),
      Guard.isString(period, 'period')
    ]);
    if (!guardResult.succeeded) {
      return Result.fail<BillingPeriod>(guardResult.message!);
    }

    const match = /^(\d{4})-(\d{2})$/.exec(period);
    if (!match) {
      return Result.fail<BillingPeriod>(
        `Invalid billing period format: ${period}. Expected 'YYYY-MM'.`
      );
    }

    return BillingPeriod.create(Number(match[1]), Number(match[2]));
  }

  public toString(): string {
    return `${this._props.year}-${String(this._props.month).padStart(2, '0')}`;
  }
}
