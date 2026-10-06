// Source: src/domain/billing/value-objects/ServicePeriod.ts

import { describe, it, expect } from '@jest/globals';
import {
  BillingMode,
  BillingPeriod,
  ServicePeriod
} from '../../../../src/domain/billing';
import { Money } from '../../../../src/domain/shared/value-objects';

const OCTOBER = BillingPeriod.create(2026, 10).value;
const SEP_10 = day('2026-09-10');

function day(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

// Local Colombian time (UTC-5) written as an instant.
function bogota(isoLocal: string): Date {
  return new Date(`${isoLocal}-05:00`);
}

function coverage(
  serviceStart: Date,
  overrides: Partial<{
    billingMode: BillingMode;
    billedLastPeriod: boolean;
  }> = {}
): string | undefined {
  return ServicePeriod.forAutomaticBill({
    period: OCTOBER,
    billingMode: overrides.billingMode ?? BillingMode.ADVANCE,
    serviceStart,
    previousIssueDay: SEP_10,
    billedLastPeriod: overrides.billedLastPeriod ?? false
  })?.toString();
}

describe('ServicePeriod', () => {
  describe('create', () => {
    it('accepts a one-day period', () => {
      const result = ServicePeriod.create(
        day('2026-10-05'),
        day('2026-10-05')
      );

      expect(result.value.toString()).toBe('2026-10-05..2026-10-05');
    });

    it('rejects an end before the start', () => {
      expect(
        ServicePeriod.create(day('2026-10-05'), day('2026-10-04'))
          .error
      ).toBe('Service period cannot end before it starts');
    });

    it('rejects a time of day', () => {
      expect(
        ServicePeriod.create(
          new Date('2026-10-05T12:00:00Z'),
          day('2026-10-06')
        ).error
      ).toBe('Service period days must be whole calendar dates');
    });
  });

  it('ofPeriod spans the whole month', () => {
    expect(
      ServicePeriod.ofPeriod(
        BillingPeriod.create(2028, 2).value
      ).toString()
    ).toBe('2028-02-01..2028-02-29');
  });

  describe('forAutomaticBill', () => {
    it('[BIL-288] a service from before the month is charged the whole month', () => {
      expect(coverage(bogota('2026-03-01T08:00:00'))).toBe(
        '2026-10-01..2026-10-31'
      );
    });

    it('[BIL-288] a service that started inside the month runs from its local start day', () => {
      // 23:30 on 11 Oct in Bogotá is already 12 Oct in UTC.
      expect(coverage(bogota('2026-10-11T23:30:00'))).toBe(
        '2026-10-11..2026-10-31'
      );
    });

    it('[BIL-287] a service that starts after the month is not charged', () => {
      expect(coverage(bogota('2026-11-01T00:00:00'))).toBeUndefined();
    });

    it("[BIL-289] in advance, a service started on last month's issue day and never billed adds last month's days", () => {
      expect(coverage(bogota('2026-09-10T09:00:00'))).toBe(
        '2026-09-10..2026-10-31'
      );
    });

    it("[BIL-289] in advance, a service started the day before last month's issue day does not", () => {
      expect(coverage(bogota('2026-09-09T09:00:00'))).toBe(
        '2026-10-01..2026-10-31'
      );
    });

    it("[BIL-289] in advance, last month's days are not added when last month's bill holds the service", () => {
      expect(
        coverage(bogota('2026-09-20T09:00:00'), {
          billedLastPeriod: true
        })
      ).toBe('2026-10-01..2026-10-31');
    });

    it("[BIL-289] paid after use, last month's days are never added", () => {
      expect(
        coverage(bogota('2026-09-20T09:00:00'), {
          billingMode: BillingMode.ARREARS
        })
      ).toBe('2026-10-01..2026-10-31');
    });
  });

  describe('[BIL-290] chargeFor', () => {
    const PRICE = Money.create(80000).value;

    function charge(from: string, to: string, price = PRICE): number {
      return ServicePeriod.create(day(from), day(to))
        .value.chargeFor(price)
        .toNumber();
    }

    it('charges a whole month at the monthly price, cents included', () => {
      expect(
        charge('2026-10-01', '2026-10-31', Money.create(19.99).value)
      ).toBe(19.99);
    });

    it('charges part of a month by the days used, in whole pesos', () => {
      // 21 / 31 × 80 000 = 54 193.55
      expect(charge('2026-10-11', '2026-10-31')).toBe(54194);
    });

    it("prices each month's days against that month's length", () => {
      // 11 / 30 of September + all of October
      expect(charge('2026-09-20', '2026-10-31')).toBe(80000 + 29333);
    });

    it('crosses the year', () => {
      // 1 / 31 of December + all of January
      expect(charge('2026-12-31', '2027-01-31')).toBe(80000 + 2581);
    });

    it('charges a single day', () => {
      expect(charge('2026-02-28', '2026-02-28')).toBe(2857);
    });
  });
});
