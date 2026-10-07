// Source: src/domain/billing/value-objects/BillingCycle.ts

import { describe, it, expect } from '@jest/globals';
import {
  BillingCycle,
  BillingMode,
  BillingSettings
} from '../../../../src/domain/billing';

function settings(
  overrides: Partial<{
    billingMode: BillingMode;
    issueLeadDays: number;
  }> = {}
): BillingSettings {
  return BillingSettings.reconstitute({
    automaticBillingEnabled: true,
    billingMode: overrides.billingMode ?? BillingMode.ADVANCE,
    issueLeadDays: overrides.issueLeadDays ?? 5,
    graceDays: 3,
    automaticCutEnabled: false,
    reminderWhatsAppTemplate: null,
    billWhatsAppTemplate: null
  });
}

// Local Colombian time (UTC-5) written as an instant.
function bogota(isoLocal: string): Date {
  return new Date(`${isoLocal}-05:00`);
}

describe('BillingCycle.openAt', () => {
  it('[BIL-283] opens on the issue day, lead days before the due date', () => {
    const cycle = BillingCycle.openAt(
      bogota('2026-10-10T00:00:00'),
      15,
      settings()
    );

    expect(cycle).not.toBeNull();
    expect(cycle!.period.toString()).toBe('2026-10');
  });

  it('[BIL-283] is closed the day before the issue day', () => {
    expect(
      BillingCycle.openAt(
        bogota('2026-10-09T23:59:59'),
        15,
        settings()
      )
    ).toBeNull();
  });

  it('[BIL-283] stays open through the due day and closes after it', () => {
    expect(
      BillingCycle.openAt(
        bogota('2026-10-15T23:59:59'),
        15,
        settings()
      )
    ).not.toBeNull();
    expect(
      BillingCycle.openAt(
        bogota('2026-10-16T00:00:00'),
        15,
        settings()
      )
    ).toBeNull();
  });

  it('[BIL-283] is due at the end of the payment day, Colombian time', () => {
    const cycle = BillingCycle.openAt(
      bogota('2026-10-12T08:00:00'),
      15,
      settings()
    );

    expect(cycle!.dueDate.toISOString()).toBe(
      '2026-10-16T04:59:59.999Z'
    );
  });

  it('[BIL-283] reads the day in Colombian time, not UTC', () => {
    // 03:00 UTC on the 10th is still the 9th in Bogotá.
    expect(
      BillingCycle.openAt(
        new Date('2026-10-10T03:00:00.000Z'),
        15,
        settings()
      )
    ).toBeNull();
  });

  it('[BIL-283] the 30th falls on the last day of February', () => {
    expect(
      BillingCycle.openAt(
        bogota('2027-02-22T12:00:00'),
        30,
        settings()
      )
    ).toBeNull();
    const cycle = BillingCycle.openAt(
      bogota('2027-02-23T12:00:00'),
      30,
      settings()
    );

    expect(cycle!.dueDate.toISOString()).toBe(
      '2027-03-01T04:59:59.999Z'
    );
  });

  it('[BIL-283] the 30th group is due on the 30th in a 31-day month', () => {
    const cycle = BillingCycle.openAt(
      bogota('2026-10-27T12:00:00'),
      30,
      settings()
    );

    expect(cycle!.dueDate.toISOString()).toBe(
      '2026-10-31T04:59:59.999Z'
    );
    expect(
      BillingCycle.openAt(
        bogota('2026-10-31T12:00:00'),
        30,
        settings()
      )
    ).toBeNull();
  });

  it('[BIL-283] a 14-day lead opens the 15th group on the 1st', () => {
    const lead14 = settings({ issueLeadDays: 14 });

    expect(
      BillingCycle.openAt(bogota('2026-10-01T00:00:00'), 15, lead14)
    ).not.toBeNull();
    expect(
      BillingCycle.openAt(bogota('2026-09-30T23:59:59'), 15, lead14)
    ).toBeNull();
  });

  it("[BIL-282] paid in advance: covers the due date's month", () => {
    const cycle = BillingCycle.openAt(
      bogota('2026-10-26T12:00:00'),
      30,
      settings({ billingMode: BillingMode.ADVANCE })
    );

    expect(cycle!.period.toString()).toBe('2026-10');
  });

  it('[BIL-282] paid after use: covers the month before', () => {
    const cycle = BillingCycle.openAt(
      bogota('2026-10-26T12:00:00'),
      30,
      settings({ billingMode: BillingMode.ARREARS })
    );

    expect(cycle!.period.toString()).toBe('2026-09');
  });

  it('[BIL-282] paid after use in January covers December of last year', () => {
    const cycle = BillingCycle.openAt(
      bogota('2027-01-12T12:00:00'),
      15,
      settings({ billingMode: BillingMode.ARREARS })
    );

    expect(cycle!.period.toString()).toBe('2026-12');
  });

  it("[BIL-289] knows last month's issue day for the same customer", () => {
    const cycle = BillingCycle.openAt(
      bogota('2026-10-12T06:00:00'),
      15,
      settings()
    );

    expect(cycle!.previousIssueDay.toISOString()).toBe(
      '2026-09-10T00:00:00.000Z'
    );
  });

  it("[BIL-289] last month's issue day follows a short month's last day", () => {
    const cycle = BillingCycle.openAt(
      bogota('2027-03-26T06:00:00'),
      30,
      settings()
    );

    // February 2027 has 28 days: due the 28th, issued the 23rd.
    expect(cycle!.previousIssueDay.toISOString()).toBe(
      '2027-02-23T00:00:00.000Z'
    );
  });

  it("[BIL-289] January's cycle looks back to December", () => {
    const cycle = BillingCycle.openAt(
      bogota('2027-01-12T06:00:00'),
      15,
      settings()
    );

    expect(cycle!.previousIssueDay.toISOString()).toBe(
      '2026-12-10T00:00:00.000Z'
    );
  });

  it('[BIL-287] covers a service that starts by the last local day of the billed month', () => {
    const cycle = BillingCycle.openAt(
      bogota('2026-10-12T06:00:00'),
      15,
      settings({ billingMode: BillingMode.ARREARS })
    )!;

    expect(cycle.covers(bogota('2026-09-30T23:59:59'))).toBe(true);
    expect(cycle.covers(bogota('2026-10-01T00:00:00'))).toBe(false);
  });
});
