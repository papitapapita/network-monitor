import { Result } from '../core';

// ADR 0002, R17, escalated in stages. GRACE is full service; READ_ONLY keeps
// the dashboard readable but stops everything that measures, alerts or
// changes; LOCKED shuts the dashboard too. Nothing is ever deleted.
export type SubscriptionState =
  | 'ACTIVE'
  | 'GRACE'
  | 'READ_ONLY'
  | 'LOCKED';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_STAGE_DAYS = 90;

// What the install has paid for. `paidThrough` is the first instant no longer
// covered; grace and then read-only run on from there. Only the vendor sets
// these, so there is no in-app way to change them.
export class SubscriptionTerms {
  private constructor(
    readonly paidThrough: Date,
    readonly graceDays: number,
    readonly readOnlyDays: number
  ) {}

  static create(
    paidThrough: Date,
    graceDays: number,
    readOnlyDays: number
  ): Result<SubscriptionTerms> {
    if (
      !(paidThrough instanceof Date) ||
      isNaN(paidThrough.getTime())
    ) {
      return Result.fail('Paid-through date must be a valid date');
    }
    for (const [label, days] of [
      ['Grace days', graceDays],
      ['Read-only days', readOnlyDays]
    ] as const) {
      if (
        !Number.isInteger(days) ||
        days < 0 ||
        days > MAX_STAGE_DAYS
      ) {
        return Result.fail(
          `${label} must be a whole number from 0 to ${MAX_STAGE_DAYS}`
        );
      }
    }
    return Result.ok(
      new SubscriptionTerms(paidThrough, graceDays, readOnlyDays)
    );
  }

  get graceEndsAt(): Date {
    return new Date(
      this.paidThrough.getTime() + this.graceDays * DAY_MS
    );
  }

  get lockedAt(): Date {
    return new Date(
      this.graceEndsAt.getTime() + this.readOnlyDays * DAY_MS
    );
  }

  stateAt(now: Date): SubscriptionState {
    const t = now.getTime();
    if (t < this.paidThrough.getTime()) return 'ACTIVE';
    if (t < this.graceEndsAt.getTime()) return 'GRACE';
    if (t < this.lockedAt.getTime()) return 'READ_ONLY';
    return 'LOCKED';
  }
}
