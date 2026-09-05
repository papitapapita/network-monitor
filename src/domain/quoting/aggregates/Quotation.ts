import { AggregateRoot, Result, Guard } from 'domain/shared/core';
import { CustomerId, QuotationId, UserId } from 'domain/shared/ids';
import { Money } from 'domain/shared/value-objects';
import { QuotationStatus } from '../enums';
import { QuotationProps } from '../props';
import { QuotationLineItem } from '../value-objects';
import {
  QuotationCreatedEvent,
  QuotationSentEvent,
  QuotationAcceptedEvent,
  QuotationRejectedEvent,
  QuotationExpiredEvent
} from '../events';

const MAX_CUSTOMER_NAME_LENGTH = 150;
const MAX_REJECTION_REASON_LENGTH = 255;

export class Quotation extends AggregateRoot<
  QuotationProps,
  QuotationId
> {
  private constructor(props: QuotationProps, id: QuotationId) {
    super(props, id);
  }

  get code(): number | null {
    return this.props.code;
  }

  get status(): QuotationStatus {
    return this.props.status;
  }

  get customerId(): CustomerId | null {
    return this.props.customerId;
  }

  get customerName(): string {
    return this.props.customerName;
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

  get lineItems(): readonly QuotationLineItem[] {
    return [...this.props.lineItems];
  }

  get validUntil(): Date {
    return this.props.validUntil;
  }

  get notes(): string | null {
    return this.props.notes;
  }

  get sentAt(): Date | null {
    return this.props.sentAt;
  }

  get acceptedAt(): Date | null {
    return this.props.acceptedAt;
  }

  get rejectedAt(): Date | null {
    return this.props.rejectedAt;
  }

  get rejectionReason(): string | null {
    return this.props.rejectionReason;
  }

  get expiredAt(): Date | null {
    return this.props.expiredAt;
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

  // No tax logic exists yet — subtotal and total are deliberately separate
  // getters so a future tax line can be introduced without a schema change
  // or a renderer rewrite.
  get subtotal(): Money {
    return this.props.lineItems.reduce(
      (sum, item) => sum.add(item.lineTotal),
      Money.zero()
    );
  }

  get total(): Money {
    return this.subtotal;
  }

  public static create(
    props: Omit<
      QuotationProps,
      | 'code'
      | 'status'
      | 'sentAt'
      | 'acceptedAt'
      | 'rejectedAt'
      | 'rejectionReason'
      | 'expiredAt'
      | 'createdAt'
      | 'updatedAt'
    >
  ): Result<Quotation> {
    const now = new Date();
    const state: QuotationProps = {
      ...props,
      code: null,
      status: QuotationStatus.DRAFT,
      sentAt: null,
      acceptedAt: null,
      rejectedAt: null,
      rejectionReason: null,
      expiredAt: null,
      createdAt: now,
      updatedAt: now
    };

    const validationResult = Quotation.validate(state);
    if (validationResult.isFailure) {
      return Result.fail<Quotation>(validationResult.error);
    }

    const id = QuotationId.create();
    const quotation = new Quotation(state, id);

    quotation.addDomainEvent(
      new QuotationCreatedEvent({
        aggregateId: quotation.id,
        customerName: quotation.customerName,
        total: quotation.total,
        dateTimeOccurred: now
      })
    );

    return Result.ok<Quotation>(quotation);
  }

  // bypasses validation — for repository use only
  public static reconstitute(
    id: QuotationId,
    props: QuotationProps
  ): Quotation {
    return new Quotation(props, id);
  }

  public replaceLineItems(items: QuotationLineItem[]): Result<void> {
    const draftGuard = this.ensureDraft(
      'Cannot modify line items of a sent quotation'
    );
    if (draftGuard.isFailure) return draftGuard;

    const candidate: QuotationProps = {
      ...this.props,
      lineItems: items,
      updatedAt: new Date()
    };

    const validationResult = Quotation.validate(candidate);
    if (validationResult.isFailure) {
      return Result.fail<void>(validationResult.error);
    }

    this.props = candidate;
    return Result.ok<void>();
  }

  public updateDetails(changes: {
    validUntil?: Date;
    notes?: string | null;
    customerName?: string;
    customerPhone?: string | null;
    customerEmail?: string | null;
    customerAddress?: string | null;
  }): Result<void> {
    const draftGuard = this.ensureDraft(
      'Cannot update details of a sent quotation'
    );
    if (draftGuard.isFailure) return draftGuard;

    const candidate: QuotationProps = {
      ...this.props,
      validUntil: changes.validUntil ?? this.props.validUntil,
      notes:
        changes.notes !== undefined
          ? changes.notes
          : this.props.notes,
      customerName: changes.customerName ?? this.props.customerName,
      customerPhone:
        changes.customerPhone !== undefined
          ? changes.customerPhone
          : this.props.customerPhone,
      customerEmail:
        changes.customerEmail !== undefined
          ? changes.customerEmail
          : this.props.customerEmail,
      customerAddress:
        changes.customerAddress !== undefined
          ? changes.customerAddress
          : this.props.customerAddress,
      updatedAt: new Date()
    };

    const validationResult = Quotation.validate(candidate);
    if (validationResult.isFailure) {
      return Result.fail<void>(validationResult.error);
    }

    this.props = candidate;
    return Result.ok<void>();
  }

  public send(now: Date = new Date()): Result<void> {
    if (this.props.status !== QuotationStatus.DRAFT) {
      return Result.fail<void>(
        `Cannot send a ${this.props.status} quotation`
      );
    }

    const candidate: QuotationProps = {
      ...this.props,
      status: QuotationStatus.SENT,
      sentAt: now,
      updatedAt: now
    };

    const validationResult = Quotation.validate(candidate);
    if (validationResult.isFailure) {
      return Result.fail<void>(validationResult.error);
    }

    this.props = candidate;

    this.addDomainEvent(
      new QuotationSentEvent({
        aggregateId: this.id,
        sentAt: now,
        dateTimeOccurred: now
      })
    );

    return Result.ok<void>();
  }

  public accept(now: Date = new Date()): Result<void> {
    if (this.props.status !== QuotationStatus.SENT) {
      return Result.fail<void>(
        `Cannot accept a ${this.props.status} quotation`
      );
    }

    const candidate: QuotationProps = {
      ...this.props,
      status: QuotationStatus.ACCEPTED,
      acceptedAt: now,
      updatedAt: now
    };

    const validationResult = Quotation.validate(candidate);
    if (validationResult.isFailure) {
      return Result.fail<void>(validationResult.error);
    }

    this.props = candidate;

    this.addDomainEvent(
      new QuotationAcceptedEvent({
        aggregateId: this.id,
        acceptedAt: now,
        dateTimeOccurred: now
      })
    );

    return Result.ok<void>();
  }

  public reject(
    reason: string,
    now: Date = new Date()
  ): Result<void> {
    if (this.props.status !== QuotationStatus.SENT) {
      return Result.fail<void>(
        `Cannot reject a ${this.props.status} quotation`
      );
    }

    const reasonGuard = Guard.combine([
      Guard.againstNullOrUndefined(reason, 'reason'),
      Guard.isString(reason, 'reason')
    ]);
    if (!reasonGuard.succeeded) {
      return Result.fail<void>(reasonGuard.message!);
    }

    const trimmed = reason.trim();
    if (trimmed.length === 0) {
      return Result.fail<void>(
        'A reason is required to reject a quotation'
      );
    }
    if (trimmed.length > MAX_REJECTION_REASON_LENGTH) {
      return Result.fail<void>(
        `Rejection reason cannot exceed ${MAX_REJECTION_REASON_LENGTH} characters`
      );
    }

    const candidate: QuotationProps = {
      ...this.props,
      status: QuotationStatus.REJECTED,
      rejectedAt: now,
      rejectionReason: trimmed,
      updatedAt: now
    };

    const validationResult = Quotation.validate(candidate);
    if (validationResult.isFailure) {
      return Result.fail<void>(validationResult.error);
    }

    this.props = candidate;

    this.addDomainEvent(
      new QuotationRejectedEvent({
        aggregateId: this.id,
        reason: trimmed,
        rejectedAt: now,
        dateTimeOccurred: now
      })
    );

    return Result.ok<void>();
  }

  public markExpired(now: Date = new Date()): Result<void> {
    if (this.props.status !== QuotationStatus.SENT) {
      return Result.fail<void>(
        `Cannot expire a ${this.props.status} quotation`
      );
    }

    if (!(now > this.props.validUntil)) {
      return Result.fail<void>(
        'Cannot mark quotation expired: it is not past its validity date'
      );
    }

    const candidate: QuotationProps = {
      ...this.props,
      status: QuotationStatus.EXPIRED,
      expiredAt: now,
      updatedAt: now
    };

    const validationResult = Quotation.validate(candidate);
    if (validationResult.isFailure) {
      return Result.fail<void>(validationResult.error);
    }

    this.props = candidate;

    this.addDomainEvent(
      new QuotationExpiredEvent({
        aggregateId: this.id,
        expiredAt: now,
        dateTimeOccurred: now
      })
    );

    return Result.ok<void>();
  }

  public isTerminal(): boolean {
    return (
      this.props.status === QuotationStatus.ACCEPTED ||
      this.props.status === QuotationStatus.REJECTED ||
      this.props.status === QuotationStatus.EXPIRED
    );
  }

  private ensureDraft(message: string): Result<void> {
    if (this.props.status !== QuotationStatus.DRAFT) {
      return Result.fail<void>(message);
    }
    return Result.ok<void>();
  }

  private static validate(state: QuotationProps): Result<void> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(
        state.customerName,
        'customerName'
      ),
      Guard.isString(state.customerName, 'customerName'),
      Guard.againstNullOrUndefined(state.lineItems, 'lineItems'),
      Guard.againstNullOrUndefined(state.validUntil, 'validUntil'),
      Guard.isDate(state.validUntil, 'validUntil'),
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

    if (state.lineItems.length === 0) {
      return Result.fail<void>(
        'A quotation must have at least one line item'
      );
    }

    switch (state.status) {
      case QuotationStatus.DRAFT:
        if (
          state.sentAt !== null ||
          state.acceptedAt !== null ||
          state.rejectedAt !== null ||
          state.expiredAt !== null ||
          state.rejectionReason !== null
        ) {
          return Result.fail<void>(
            'A DRAFT quotation cannot have status transition dates set'
          );
        }
        break;

      case QuotationStatus.SENT:
        if (state.sentAt === null) {
          return Result.fail<void>(
            'A SENT quotation must have a sentAt date'
          );
        }
        if (
          state.acceptedAt !== null ||
          state.rejectedAt !== null ||
          state.expiredAt !== null ||
          state.rejectionReason !== null
        ) {
          return Result.fail<void>(
            'A SENT quotation cannot have acceptance, rejection, or expiry data set'
          );
        }
        break;

      case QuotationStatus.ACCEPTED:
        if (state.sentAt === null) {
          return Result.fail<void>(
            'An ACCEPTED quotation must have been sent first'
          );
        }
        if (state.acceptedAt === null) {
          return Result.fail<void>(
            'An ACCEPTED quotation must have an acceptedAt date'
          );
        }
        if (
          state.rejectedAt !== null ||
          state.expiredAt !== null ||
          state.rejectionReason !== null
        ) {
          return Result.fail<void>(
            'An ACCEPTED quotation cannot have rejection or expiry data set'
          );
        }
        break;

      case QuotationStatus.REJECTED:
        if (state.sentAt === null) {
          return Result.fail<void>(
            'A REJECTED quotation must have been sent first'
          );
        }
        if (
          state.rejectedAt === null ||
          state.rejectionReason === null
        ) {
          return Result.fail<void>(
            'A REJECTED quotation must have a rejectedAt date and a rejectionReason'
          );
        }
        if (state.acceptedAt !== null || state.expiredAt !== null) {
          return Result.fail<void>(
            'A REJECTED quotation cannot have acceptance or expiry data set'
          );
        }
        break;

      case QuotationStatus.EXPIRED:
        if (state.sentAt === null) {
          return Result.fail<void>(
            'An EXPIRED quotation must have been sent first'
          );
        }
        if (state.expiredAt === null) {
          return Result.fail<void>(
            'An EXPIRED quotation must have an expiredAt date'
          );
        }
        if (
          state.acceptedAt !== null ||
          state.rejectedAt !== null ||
          state.rejectionReason !== null
        ) {
          return Result.fail<void>(
            'An EXPIRED quotation cannot have acceptance or rejection data set'
          );
        }
        break;
    }

    return Result.ok<void>();
  }
}
