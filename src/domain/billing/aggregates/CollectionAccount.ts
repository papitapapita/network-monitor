import { AggregateRoot, Result, Guard } from 'domain/shared/core';
import {
  CollectionAccountId,
  CustomerId,
  UserId
} from 'domain/shared/ids';
import { Money } from 'domain/shared/value-objects';
import { CollectionAccountStatus } from '../enums';
import { CollectionAccountProps } from '../props';
import {
  BankAccountDetails,
  CollectionAccountLineItem
} from '../value-objects';
import {
  CollectionAccountIssuedEvent,
  CollectionAccountPaidEvent,
  CollectionAccountCancelledEvent
} from '../events';

const MAX_CUSTOMER_NAME_LENGTH = 150;
const MAX_CUSTOMER_DOCUMENT_LENGTH = 20;
const MAX_CUSTOMER_PHONE_LENGTH = 20;
const MAX_CUSTOMER_EMAIL_LENGTH = 255;
const MAX_CUSTOMER_ADDRESS_LENGTH = 255;
const MAX_PAYMENT_ACCOUNTS = 5;

export class CollectionAccount extends AggregateRoot<
  CollectionAccountProps,
  CollectionAccountId
> {
  private constructor(
    props: CollectionAccountProps,
    id: CollectionAccountId
  ) {
    super(props, id);
  }

  get code(): number | null {
    return this.props.code;
  }

  get status(): CollectionAccountStatus {
    return this.props.status;
  }

  get customerId(): CustomerId | null {
    return this.props.customerId;
  }

  get customerName(): string {
    return this.props.customerName;
  }

  get customerDocument(): string | null {
    return this.props.customerDocument;
  }

  get customerPhone(): string | null {
    return this.props.customerPhone;
  }

  get customerEmail(): string | null {
    return this.props.customerEmail;
  }

  get customerAddress(): string | null {
    return this.props.customerAddress;
  }

  get lineItems(): readonly CollectionAccountLineItem[] {
    return [...this.props.lineItems];
  }

  get paymentAccounts(): readonly BankAccountDetails[] {
    return [...this.props.paymentAccounts];
  }

  get issueDate(): Date {
    return this.props.issueDate;
  }

  get dueDate(): Date | null {
    return this.props.dueDate;
  }

  get notes(): string | null {
    return this.props.notes;
  }

  get paidAt(): Date | null {
    return this.props.paidAt;
  }

  get cancelledAt(): Date | null {
    return this.props.cancelledAt;
  }

  get createdBy(): UserId | null {
    return this.props.createdBy;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get total(): Money {
    return this.props.lineItems.reduce(
      (sum, item) => sum.add(item.lineTotal),
      Money.zero()
    );
  }

  public static create(
    props: Omit<
      CollectionAccountProps,
      | 'code'
      | 'status'
      | 'paidAt'
      | 'cancelledAt'
      | 'createdAt'
      | 'updatedAt'
    >
  ): Result<CollectionAccount> {
    const now = new Date();
    const state: CollectionAccountProps = {
      ...props,
      code: null,
      status: CollectionAccountStatus.PENDING,
      paidAt: null,
      cancelledAt: null,
      createdAt: now,
      updatedAt: now
    };

    const validationResult = CollectionAccount.validate(state);
    if (validationResult.isFailure) {
      return Result.fail<CollectionAccount>(validationResult.error);
    }

    const id = CollectionAccountId.create();
    const collectionAccount = new CollectionAccount(state, id);

    collectionAccount.addDomainEvent(
      new CollectionAccountIssuedEvent({
        aggregateId: collectionAccount.id,
        customerName: collectionAccount.customerName,
        total: collectionAccount.total,
        dateTimeOccurred: now
      })
    );

    return Result.ok<CollectionAccount>(collectionAccount);
  }

  // bypasses validation — for repository use only
  public static reconstitute(
    id: CollectionAccountId,
    props: CollectionAccountProps
  ): CollectionAccount {
    return new CollectionAccount(props, id);
  }

  public markPaid(now: Date = new Date()): Result<void> {
    if (this.props.status !== CollectionAccountStatus.PENDING) {
      return Result.fail<void>(
        `Cannot mark a ${this.props.status} collection account as paid`
      );
    }

    const candidate: CollectionAccountProps = {
      ...this.props,
      status: CollectionAccountStatus.PAID,
      paidAt: now,
      updatedAt: now
    };

    const validationResult = CollectionAccount.validate(candidate);
    if (validationResult.isFailure) {
      return Result.fail<void>(validationResult.error);
    }

    this.props = candidate;

    this.addDomainEvent(
      new CollectionAccountPaidEvent({
        aggregateId: this.id,
        paidAt: now,
        dateTimeOccurred: now
      })
    );

    return Result.ok<void>();
  }

  public cancel(now: Date = new Date()): Result<void> {
    if (this.props.status !== CollectionAccountStatus.PENDING) {
      return Result.fail<void>(
        `Cannot cancel a ${this.props.status} collection account`
      );
    }

    const candidate: CollectionAccountProps = {
      ...this.props,
      status: CollectionAccountStatus.CANCELLED,
      cancelledAt: now,
      updatedAt: now
    };

    const validationResult = CollectionAccount.validate(candidate);
    if (validationResult.isFailure) {
      return Result.fail<void>(validationResult.error);
    }

    this.props = candidate;

    this.addDomainEvent(
      new CollectionAccountCancelledEvent({
        aggregateId: this.id,
        cancelledAt: now,
        dateTimeOccurred: now
      })
    );

    return Result.ok<void>();
  }

  private static validate(
    state: CollectionAccountProps
  ): Result<void> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(
        state.customerName,
        'customerName'
      ),
      Guard.isString(state.customerName, 'customerName'),
      Guard.againstNullOrUndefined(state.lineItems, 'lineItems'),
      Guard.againstNullOrUndefined(
        state.paymentAccounts,
        'paymentAccounts'
      ),
      Guard.againstNullOrUndefined(state.issueDate, 'issueDate'),
      Guard.isDate(state.issueDate, 'issueDate'),
      Guard.againstNullOrUndefined(state.status, 'status')
    ]);
    if (!guardResult.succeeded) {
      return Result.fail<void>(guardResult.message!);
    }

    const customerName = state.customerName.trim();
    if (customerName.length === 0) {
      return Result.fail<void>('Customer name cannot be empty');
    }
    if (customerName.length > MAX_CUSTOMER_NAME_LENGTH) {
      return Result.fail<void>(
        `Customer name cannot exceed ${MAX_CUSTOMER_NAME_LENGTH} characters`
      );
    }

    const lengthLimits: [string | null, number, string][] = [
      [
        state.customerDocument,
        MAX_CUSTOMER_DOCUMENT_LENGTH,
        'Customer document'
      ],
      [
        state.customerPhone,
        MAX_CUSTOMER_PHONE_LENGTH,
        'Customer phone'
      ],
      [
        state.customerEmail,
        MAX_CUSTOMER_EMAIL_LENGTH,
        'Customer email'
      ],
      [
        state.customerAddress,
        MAX_CUSTOMER_ADDRESS_LENGTH,
        'Customer address'
      ]
    ];
    for (const [value, max, label] of lengthLimits) {
      if (value !== null && value.length > max) {
        return Result.fail<void>(
          `${label} cannot exceed ${max} characters`
        );
      }
    }

    if (state.lineItems.length === 0) {
      return Result.fail<void>(
        'A collection account must have at least one line item'
      );
    }

    if (state.paymentAccounts.length > MAX_PAYMENT_ACCOUNTS) {
      return Result.fail<void>(
        `Payment accounts cannot exceed ${MAX_PAYMENT_ACCOUNTS}`
      );
    }

    if (state.dueDate !== null && state.dueDate < state.issueDate) {
      return Result.fail<void>('dueDate cannot be before issueDate');
    }

    const isPaid = state.status === CollectionAccountStatus.PAID;
    if (isPaid !== (state.paidAt !== null)) {
      return Result.fail<void>(
        'Only a PAID collection account has a paidAt date, and it must have one'
      );
    }

    const isCancelled =
      state.status === CollectionAccountStatus.CANCELLED;
    if (isCancelled !== (state.cancelledAt !== null)) {
      return Result.fail<void>(
        'Only a CANCELLED collection account has a cancelledAt date, and it must have one'
      );
    }

    return Result.ok<void>();
  }
}
