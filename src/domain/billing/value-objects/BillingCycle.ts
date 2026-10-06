import { ValueObject } from 'domain/shared/core';
import { BillingMode } from '../enums';
import { BillingPeriod } from './BillingPeriod';
import { BillingSettings } from './BillingSettings';
import { ServicePeriod } from './ServicePeriod';
import { LOCAL_OFFSET_MS, localDayOf, daysInMonth } from './LocalDay';

interface BillingCycleProps {
  readonly period: BillingPeriod;
  readonly dueDate: Date;
  readonly previousIssueDay: Date;
}

// One customer's bill for one month: due on their payment day (the 30th is
// the month's last day when shorter), issued from issueLeadDays before it
// (BIL-283), covering the month their settings' billing mode names (BIL-282).
export class BillingCycle extends ValueObject<BillingCycleProps> {
  get period(): BillingPeriod {
    return this._props.period;
  }

  // The end of the due day, Colombian time.
  get dueDate(): Date {
    return this._props.dueDate;
  }

  // Last month's issue day for the same customer, as a calendar date.
  get previousIssueDay(): Date {
    return this._props.previousIssueDay;
  }

  // False when the service starts after the billed month (BIL-287).
  public covers(serviceStart: Date): boolean {
    return (
      localDayOf(serviceStart) <=
      ServicePeriod.ofPeriod(this.period).to
    );
  }

  private constructor(props: BillingCycleProps) {
    super(props);
  }

  // The cycle whose issue window — issue day through due day — holds `now`;
  // null outside it.
  public static openAt(
    now: Date,
    paymentDay: number,
    settings: BillingSettings
  ): BillingCycle | null {
    const local = new Date(now.getTime() + LOCAL_OFFSET_MS);
    const year = local.getUTCFullYear();
    const month = local.getUTCMonth() + 1;
    const today = local.getUTCDate();

    const dueDay = Math.min(paymentDay, daysInMonth(year, month));
    const issueDay = dueDay - settings.issueLeadDays;
    if (today < issueDay || today > dueDay) return null;

    const dueDate = new Date(
      Date.UTC(year, month - 1, dueDay, 23, 59, 59, 999) -
        LOCAL_OFFSET_MS
    );
    const [prevYear, prevMonth] =
      month === 1 ? [year - 1, 12] : [year, month - 1];
    const period =
      settings.billingMode === BillingMode.ADVANCE
        ? BillingPeriod.create(year, month).value
        : BillingPeriod.create(prevYear, prevMonth).value;
    const previousIssueDay = new Date(
      Date.UTC(
        prevYear,
        prevMonth - 1,
        Math.min(paymentDay, daysInMonth(prevYear, prevMonth)) -
          settings.issueLeadDays
      )
    );

    return new BillingCycle({ period, dueDate, previousIssueDay });
  }
}
