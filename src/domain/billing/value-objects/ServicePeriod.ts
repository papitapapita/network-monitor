import { ValueObject, Result, Guard } from 'domain/shared/core';
import { Money } from 'domain/shared/value-objects';
import { BillingMode } from '../enums';
import { BillingPeriod } from './BillingPeriod';
import { localDayOf, daysInMonth } from './LocalDay';

interface ServicePeriodProps {
  readonly from: Date;
  readonly to: Date;
}

export interface AutomaticBillCoverage {
  period: BillingPeriod;
  billingMode: BillingMode;
  serviceStart: Date;
  previousIssueDay: Date;
  billedLastPeriod: boolean;
}

// The calendar days, first and last included, one bill line charges for.
// Days are Colombian calendar dates held as UTC midnight.
export class ServicePeriod extends ValueObject<ServicePeriodProps> {
  private constructor(props: ServicePeriodProps) {
    super(props);
  }

  get from(): Date {
    return this._props.from;
  }

  get to(): Date {
    return this._props.to;
  }

  public static create(from: Date, to: Date): Result<ServicePeriod> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(from, 'from'),
      Guard.isDate(from, 'from'),
      Guard.againstNullOrUndefined(to, 'to'),
      Guard.isDate(to, 'to')
    ]);
    if (!guardResult.succeeded) {
      return Result.fail<ServicePeriod>(guardResult.message!);
    }
    if (!isMidnightUtc(from) || !isMidnightUtc(to)) {
      return Result.fail<ServicePeriod>(
        'Service period days must be whole calendar dates'
      );
    }
    if (to < from) {
      return Result.fail<ServicePeriod>(
        'Service period cannot end before it starts'
      );
    }
    return Result.ok(new ServicePeriod({ from, to }));
  }

  public static ofPeriod(period: BillingPeriod): ServicePeriod {
    return new ServicePeriod({
      from: firstDay(period.year, period.month),
      to: lastDay(period.year, period.month)
    });
  }

  // BIL-287..289: what the automatic run charges a service for. Null when
  // the service starts after the billed month. A service that started inside
  // the month is charged from its start day. In advance mode, a service that
  // started on or after last month's issue day and is on no bill for last
  // month is also charged last month's remaining days.
  public static forAutomaticBill(
    input: AutomaticBillCoverage
  ): ServicePeriod | null {
    const whole = ServicePeriod.ofPeriod(input.period);
    const start = localDayOf(input.serviceStart);
    if (start > whole.to) return null;
    if (start >= whole.from) {
      return new ServicePeriod({ from: start, to: whole.to });
    }

    const missedLastMonth =
      input.billingMode === BillingMode.ADVANCE &&
      start >= input.previousIssueDay &&
      !input.billedLastPeriod;
    return missedLastMonth
      ? new ServicePeriod({ from: start, to: whole.to })
      : whole;
  }

  // Each whole month at the monthly price; each partial month at
  // price × days used ÷ days in that month, rounded to whole pesos (BIL-290).
  public chargeFor(monthlyPrice: Money): Money {
    let fullMonths = 0;
    let partialShare = 0;

    let year = this.from.getUTCFullYear();
    let month = this.from.getUTCMonth() + 1;
    while (firstDay(year, month) <= this.to) {
      const monthFrom = maxDate(firstDay(year, month), this.from);
      const monthTo = minDate(lastDay(year, month), this.to);
      const days = dayCount(monthFrom, monthTo);
      const length = daysInMonth(year, month);
      if (days === length) fullMonths++;
      else partialShare += days / length;

      month++;
      if (month > 12) {
        month = 1;
        year++;
      }
    }

    const partialPesos = Math.round(
      (monthlyPrice.cents * partialShare) / 100
    );
    return Money.fromCents(
      monthlyPrice.cents * fullMonths + partialPesos * 100
    ).value;
  }

  public toString(): string {
    return `${isoDay(this.from)}..${isoDay(this.to)}`;
  }
}

export function isoDay(day: Date): string {
  return day.toISOString().slice(0, 10);
}

function firstDay(year: number, month: number): Date {
  return new Date(Date.UTC(year, month - 1, 1));
}

function lastDay(year: number, month: number): Date {
  return new Date(
    Date.UTC(year, month - 1, daysInMonth(year, month))
  );
}

function dayCount(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
}

function maxDate(a: Date, b: Date): Date {
  return a > b ? a : b;
}

function minDate(a: Date, b: Date): Date {
  return a < b ? a : b;
}

function isMidnightUtc(day: Date): boolean {
  return day.getTime() % 86_400_000 === 0;
}
