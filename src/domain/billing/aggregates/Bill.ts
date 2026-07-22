import { AggregateRoot, Result, Guard } from 'domain/shared/core';
import { BillId, CustomerId } from 'domain/shared/ids';
import { Money } from 'domain/shared/value-objects';
import { BillStatus } from '../enums';
import { BillProps } from '../props';
import { BillingPeriod, BillLineItem } from '../value-objects';
import {
  BillGeneratedEvent,
  BillPaidEvent,
  BillOverdueEvent,
  BillCancelledEvent
} from '../events';

export class Bill extends AggregateRoot<BillProps, BillId> {
  private constructor(props: BillProps, id: BillId) {
    super(props, id);
  }

  get customerId(): CustomerId {
    return this.props.customerId;
  }

  get period(): BillingPeriod {
    return this.props.period;
  }

  get status(): BillStatus {
    return this.props.status;
  }

  get lineItems(): readonly BillLineItem[] {
    return [...this.props.lineItems];
  }

  get issueDate(): Date {
    return this.props.issueDate;
  }

  get dueDate(): Date {
    return this.props.dueDate;
  }

  get paidAt(): Date | null {
    return this.props.paidAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get total(): Money {
    return this.props.lineItems.reduce(
      (sum, item) => sum.add(item.monthlyPrice),
      Money.zero()
    );
  }

  public static create(
    props: Omit<
      BillProps,
      'status' | 'paidAt' | 'createdAt' | 'updatedAt'
    >
  ): Result<Bill> {
    const now = new Date();
    const state: BillProps = {
      ...props,
      status: BillStatus.PENDING,
      paidAt: null,
      createdAt: now,
      updatedAt: now
    };

    const validationResult = Bill.validate(state);
    if (validationResult.isFailure) {
      return Result.fail<Bill>(validationResult.error);
    }

    const id = BillId.create();
    const bill = new Bill(state, id);

    bill.addDomainEvent(
      new BillGeneratedEvent({
        aggregateId: bill.id,
        customerId: bill.customerId,
        period: bill.period,
        total: bill.total,
        dateTimeOccurred: now
      })
    );

    return Result.ok<Bill>(bill);
  }

  // bypasses validation — for repository use only
  public static reconstitute(id: BillId, props: BillProps): Bill {
    return new Bill(props, id);
  }

  public markPaid(): Result<void> {
    if (
      this.props.status !== BillStatus.PENDING &&
      this.props.status !== BillStatus.OVERDUE
    ) {
      return Result.fail<void>(
        `Cannot mark a ${this.props.status} bill as paid`
      );
    }

    const now = new Date();
    const candidate: BillProps = {
      ...this.props,
      status: BillStatus.PAID,
      paidAt: now,
      updatedAt: now
    };

    const validationResult = Bill.validate(candidate);
    if (validationResult.isFailure) {
      return Result.fail<void>(validationResult.error);
    }

    this.props = candidate;

    this.addDomainEvent(
      new BillPaidEvent({
        aggregateId: this.id,
        paidAt: now,
        dateTimeOccurred: now
      })
    );

    return Result.ok<void>();
  }

  public markOverdue(now: Date = new Date()): Result<void> {
    if (this.props.status !== BillStatus.PENDING) {
      return Result.fail<void>(
        `Cannot mark a ${this.props.status} bill as overdue`
      );
    }

    if (!(now > this.props.dueDate)) {
      return Result.fail<void>(
        'Cannot mark bill overdue: it is not past its due date'
      );
    }

    const candidate: BillProps = {
      ...this.props,
      status: BillStatus.OVERDUE,
      updatedAt: now
    };

    const validationResult = Bill.validate(candidate);
    if (validationResult.isFailure) {
      return Result.fail<void>(validationResult.error);
    }

    this.props = candidate;

    this.addDomainEvent(
      new BillOverdueEvent({
        aggregateId: this.id,
        dateTimeOccurred: now
      })
    );

    return Result.ok<void>();
  }

  public cancel(): Result<void> {
    if (this.props.status === BillStatus.PAID) {
      return Result.fail<void>('Cannot cancel a paid bill');
    }
    if (this.props.status === BillStatus.CANCELLED) {
      return Result.fail<void>(
        'Cannot cancel an already cancelled bill'
      );
    }

    const now = new Date();
    const candidate: BillProps = {
      ...this.props,
      status: BillStatus.CANCELLED,
      updatedAt: now
    };

    const validationResult = Bill.validate(candidate);
    if (validationResult.isFailure) {
      return Result.fail<void>(validationResult.error);
    }

    this.props = candidate;

    this.addDomainEvent(
      new BillCancelledEvent({
        aggregateId: this.id,
        dateTimeOccurred: now
      })
    );

    return Result.ok<void>();
  }

  private static validate(state: BillProps): Result<void> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(state.customerId, 'customerId'),
      Guard.againstNullOrUndefined(state.period, 'period'),
      Guard.againstNullOrUndefined(state.status, 'status'),
      Guard.againstNullOrUndefined(state.issueDate, 'issueDate'),
      Guard.isDate(state.issueDate, 'issueDate'),
      Guard.againstNullOrUndefined(state.dueDate, 'dueDate'),
      Guard.isDate(state.dueDate, 'dueDate')
    ]);
    if (!guardResult.succeeded) {
      return Result.fail<void>(guardResult.message!);
    }

    if (state.lineItems.length === 0) {
      return Result.fail<void>(
        'A bill must have at least one line item'
      );
    }

    if (state.dueDate < state.issueDate) {
      return Result.fail<void>('dueDate cannot be before issueDate');
    }

    const isPaid = state.status === BillStatus.PAID;
    if (isPaid && state.paidAt === null) {
      return Result.fail<void>('A PAID bill must have a paidAt date');
    }
    if (!isPaid && state.paidAt !== null) {
      return Result.fail<void>(
        'Only a PAID bill can have a paidAt date'
      );
    }

    return Result.ok<void>();
  }
}
