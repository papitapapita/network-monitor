import { SubscriptionTerms } from '../../../../src/domain/shared/value-objects';

const PAID_THROUGH = new Date('2026-11-01T05:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;
const at = (offsetMs: number) =>
  new Date(PAID_THROUGH.getTime() + offsetMs);

describe('SubscriptionTerms', () => {
  const terms = SubscriptionTerms.create(PAID_THROUGH, 3, 7).value;

  it('[INS-020] is ACTIVE until the paid-through instant', () => {
    expect(terms.stateAt(at(-1))).toBe('ACTIVE');
  });

  it('[INS-020] is in GRACE for the grace days after that', () => {
    expect(terms.stateAt(at(0))).toBe('GRACE');
    expect(terms.stateAt(at(3 * DAY_MS - 1))).toBe('GRACE');
  });

  it('[INS-020] is READ_ONLY for the read-only days after the grace', () => {
    expect(terms.graceEndsAt).toEqual(at(3 * DAY_MS));
    expect(terms.stateAt(at(3 * DAY_MS))).toBe('READ_ONLY');
    expect(terms.stateAt(at(10 * DAY_MS - 1))).toBe('READ_ONLY');
  });

  it('[INS-020] is LOCKED from then on', () => {
    expect(terms.lockedAt).toEqual(at(10 * DAY_MS));
    expect(terms.stateAt(at(10 * DAY_MS))).toBe('LOCKED');
    expect(terms.stateAt(at(400 * DAY_MS))).toBe('LOCKED');
  });

  it('[INS-020] skips a stage whose length is zero', () => {
    const straightToLock = SubscriptionTerms.create(
      PAID_THROUGH,
      0,
      0
    ).value;

    expect(straightToLock.stateAt(at(-1))).toBe('ACTIVE');
    expect(straightToLock.stateAt(at(0))).toBe('LOCKED');
  });

  it.each([
    ['a negative grace', PAID_THROUGH, -1, 7],
    ['a fractional grace', PAID_THROUGH, 1.5, 7],
    ['a grace over 90 days', PAID_THROUGH, 91, 7],
    ['negative read-only days', PAID_THROUGH, 3, -1],
    ['read-only days over 90', PAID_THROUGH, 3, 91],
    ['an invalid date', new Date('nope'), 3, 7]
  ])('[INS-021] rejects %s', (_label, date, grace, readOnly) => {
    expect(
      SubscriptionTerms.create(date, grace, readOnly).isFailure
    ).toBe(true);
  });
});
