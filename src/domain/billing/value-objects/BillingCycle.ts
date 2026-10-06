import { ValueObject } from 'domain/shared/core';
import { BillingMode } from '../enums';
import { BillingPeriod } from './BillingPeriod';
import { BillingSettings } from './BillingSettings';

// Colombia is UTC-5 with no daylight saving; billing days are local days.
const LOCAL_OFFSET_MS = -5 * 60 * 60 * 1000;

interface BillingCycleProps {
  readonly period: BillingPeriod;
  readonly dueDate: Date;
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

    const lastDayOfMonth = new Date(
      Date.UTC(year, month, 0)
    ).getUTCDate();
    const dueDay = Math.min(paymentDay, lastDayOfMonth);
    const issueDay = dueDay - settings.issueLeadDays;
    if (today < issueDay || today > dueDay) return null;

    const dueDate = new Date(
      Date.UTC(year, month - 1, dueDay, 23, 59, 59, 999) -
        LOCAL_OFFSET_MS
    );
    const period =
      settings.billingMode === BillingMode.ADVANCE
        ? BillingPeriod.create(year, month).value
        : month === 1
          ? BillingPeriod.create(year - 1, 12).value
          : BillingPeriod.create(year, month - 1).value;

    return new BillingCycle({ period, dueDate });
  }
}
