import {
  DEFAULT_GRACE_DAYS,
  DEFAULT_READ_ONLY_DAYS,
  loadSubscriptionTerms
} from '../../../src/infrastructure/di/subscriptionTerms';

const PAID = { SUBSCRIPTION_PAID_UNTIL: '2026-10-31' };

describe('loadSubscriptionTerms', () => {
  it('[INS-021] returns null when the paid-until date is unset or blank', () => {
    expect(loadSubscriptionTerms({})).toBeNull();
    expect(
      loadSubscriptionTerms({ SUBSCRIPTION_PAID_UNTIL: '  ' })
    ).toBeNull();
  });

  it('[INS-021] covers the whole last day in Colombian time', () => {
    const terms = loadSubscriptionTerms({
      ...PAID,
      SUBSCRIPTION_GRACE_DAYS: '2',
      SUBSCRIPTION_READ_ONLY_DAYS: '4'
    })!;

    expect(terms.paidThrough.toISOString()).toBe(
      '2026-11-01T05:00:00.000Z'
    );
    expect(terms.graceDays).toBe(2);
    expect(terms.readOnlyDays).toBe(4);
  });

  it('[INS-021] defaults to 3 grace days and 7 read-only days', () => {
    const terms = loadSubscriptionTerms(PAID)!;

    expect(DEFAULT_GRACE_DAYS).toBe(3);
    expect(DEFAULT_READ_ONLY_DAYS).toBe(7);
    expect(terms.graceDays).toBe(DEFAULT_GRACE_DAYS);
    expect(terms.readOnlyDays).toBe(DEFAULT_READ_ONLY_DAYS);
  });

  it('[INS-021] accepts zero for either stage', () => {
    const terms = loadSubscriptionTerms({
      ...PAID,
      SUBSCRIPTION_GRACE_DAYS: '0',
      SUBSCRIPTION_READ_ONLY_DAYS: '0'
    })!;

    expect(terms.graceDays).toBe(0);
    expect(terms.readOnlyDays).toBe(0);
  });

  it.each([
    '31/10/2026',
    '2026-02-30',
    '2026-13-01',
    '2026-10-31T00:00'
  ])('[INS-021] stops the boot on a malformed date %s', (raw) => {
    expect(() =>
      loadSubscriptionTerms({ SUBSCRIPTION_PAID_UNTIL: raw })
    ).toThrow('SUBSCRIPTION_PAID_UNTIL');
  });

  it.each([
    ['SUBSCRIPTION_GRACE_DAYS', '-1'],
    ['SUBSCRIPTION_GRACE_DAYS', 'seven'],
    ['SUBSCRIPTION_GRACE_DAYS', '91'],
    ['SUBSCRIPTION_READ_ONLY_DAYS', '1.5'],
    ['SUBSCRIPTION_READ_ONLY_DAYS', '91']
  ])('[INS-021] stops the boot on %s=%s', (name, raw) => {
    expect(() =>
      loadSubscriptionTerms({ ...PAID, [name]: raw })
    ).toThrow(/SUBSCRIPTION_(GRACE|READ_ONLY)_DAYS/);
  });
});
