import {
  AggregateRoot,
  Result,
  Guard,
  UniqueEntityID
} from 'domain/shared/core';
import {
  CustomerId,
  DeviceId,
  TechnicianId,
  TicketId,
  UserId
} from 'domain/shared/ids';
import {
  ServiceAddress,
  TicketCategory,
  TicketOrigin,
  TicketPriority,
  TicketStatus
} from '../value-objects';
import { TicketProps } from '../props';
import {
  TicketOpenedEvent,
  TicketAssignedEvent,
  TicketStatusChangedEvent,
  TicketResolvedEvent,
  TicketCancelledEvent
} from '../events';

const MAX_TITLE_LENGTH = 150;
const MAX_CANCEL_REASON_LENGTH = 255;

export class Ticket extends AggregateRoot<TicketProps, TicketId> {
  private constructor(props: TicketProps, id: TicketId) {
    super(props, id);
  }

  get code(): number | null {
    return this.props.code;
  }

  get status(): TicketStatus {
    return this.props.status;
  }

  get priority(): TicketPriority {
    return this.props.priority;
  }

  get category(): TicketCategory {
    return this.props.category;
  }

  get title(): string {
    return this.props.title;
  }

  get description(): string {
    return this.props.description;
  }

  get customerId(): CustomerId | null {
    return this.props.customerId;
  }

  get deviceId(): DeviceId | null {
    return this.props.deviceId;
  }

  get technicianId(): TechnicianId | null {
    return this.props.technicianId;
  }

  get address(): ServiceAddress | null {
    return this.props.address;
  }

  get scheduledFor(): Date | null {
    return this.props.scheduledFor;
  }

  get origin(): TicketOrigin {
    return this.props.origin;
  }

  get originAlertId(): string | null {
    return this.props.originAlertId;
  }

  get resolutionNotes(): string | null {
    return this.props.resolutionNotes;
  }

  get cancelReason(): string | null {
    return this.props.cancelReason;
  }

  get createdBy(): UserId | null {
    return this.props.createdBy;
  }

  get assignedAt(): Date | null {
    return this.props.assignedAt;
  }

  get startedAt(): Date | null {
    return this.props.startedAt;
  }

  get resolvedAt(): Date | null {
    return this.props.resolvedAt;
  }

  get cancelledAt(): Date | null {
    return this.props.cancelledAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  public static create(
    props: Omit<
      TicketProps,
      | 'code'
      | 'status'
      | 'createdAt'
      | 'updatedAt'
      | 'assignedAt'
      | 'startedAt'
      | 'resolvedAt'
      | 'cancelledAt'
      | 'resolutionNotes'
      | 'cancelReason'
      | 'technicianId'
    >
  ): Result<Ticket> {
    const validationResult = Ticket.validate({
      title: props.title,
      description: props.description,
      customerId: props.customerId,
      deviceId: props.deviceId,
      origin: props.origin,
      originAlertId: props.originAlertId
    });
    if (validationResult.isFailure) {
      return Result.fail<Ticket>(validationResult.error);
    }

    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(props.priority, 'priority'),
      Guard.againstNullOrUndefined(props.category, 'category'),
      Guard.againstNullOrUndefined(props.origin, 'origin')
    ]);
    if (!guardResult.succeeded) {
      return Result.fail<Ticket>(guardResult.message!);
    }

    const id = TicketId.create();
    const now = new Date();

    const ticket = new Ticket(
      {
        code: null,
        status: TicketStatus.reconstitute(TicketStatus.OPEN),
        priority: props.priority,
        category: props.category,
        title: props.title.trim(),
        description: props.description.trim(),
        customerId: props.customerId ?? null,
        deviceId: props.deviceId ?? null,
        technicianId: null,
        address: props.address ?? null,
        scheduledFor: props.scheduledFor ?? null,
        origin: props.origin,
        originAlertId: props.originAlertId ?? null,
        resolutionNotes: null,
        cancelReason: null,
        createdBy: props.createdBy ?? null,
        assignedAt: null,
        startedAt: null,
        resolvedAt: null,
        cancelledAt: null,
        createdAt: now,
        updatedAt: now
      },
      id
    );

    ticket.addDomainEvent(
      new TicketOpenedEvent({
        aggregateId: ticket.id,
        title: ticket.title,
        priority: ticket.priority.value,
        category: ticket.category.value,
        origin: ticket.origin.value,
        customerId: ticket.customerId,
        deviceId: ticket.deviceId,
        dateTimeOccurred: now
      })
    );

    return Result.ok<Ticket>(ticket);
  }

  // bypasses validation — for repository use only
  public static reconstitute(
    id: TicketId,
    props: TicketProps
  ): Ticket {
    return new Ticket(props, id);
  }

  public assign(
    technicianId: TechnicianId,
    scheduledFor: Date | null = null,
    now: Date = new Date()
  ): Result<void> {
    const mutableGuard = this.ensureMutable();
    if (mutableGuard.isFailure) return mutableGuard;

    const guardResult = Guard.againstNullOrUndefined(
      technicianId,
      'technicianId'
    );
    if (!guardResult.succeeded) {
      return Result.fail<void>(guardResult.message!);
    }

    // Work already under way is handed over by resolving or cancelling first —
    // silently swapping the technician mid-visit would lose who did what.
    if (this.props.status.isInProgress()) {
      return Result.fail<void>(
        'Cannot reassign a ticket that is already in progress'
      );
    }

    if (scheduledFor !== null) {
      const dateGuard = Guard.isDate(scheduledFor, 'scheduledFor');
      if (!dateGuard.succeeded) {
        return Result.fail<void>(dateGuard.message!);
      }
      this.props.scheduledFor = scheduledFor;
    }

    const previousTechnicianId = this.props.technicianId;
    const previousStatus = this.props.status;

    this.props.technicianId = technicianId;
    this.props.assignedAt = now;
    this.props.status = TicketStatus.reconstitute(
      TicketStatus.ASSIGNED
    );
    this.touch(now);

    this.addDomainEvent(
      new TicketAssignedEvent({
        aggregateId: this.id,
        previousTechnicianId,
        newTechnicianId: technicianId,
        scheduledFor: this.props.scheduledFor,
        dateTimeOccurred: now
      })
    );

    if (!previousStatus.isAssigned()) {
      this.addDomainEvent(
        new TicketStatusChangedEvent({
          aggregateId: this.id,
          previousStatus: previousStatus.value,
          newStatus: TicketStatus.ASSIGNED,
          dateTimeOccurred: now
        })
      );
    }

    return Result.ok<void>();
  }

  public schedule(
    scheduledFor: Date | null,
    now: Date = new Date()
  ): Result<void> {
    const mutableGuard = this.ensureMutable();
    if (mutableGuard.isFailure) return mutableGuard;

    if (scheduledFor !== null) {
      const dateGuard = Guard.isDate(scheduledFor, 'scheduledFor');
      if (!dateGuard.succeeded) {
        return Result.fail<void>(dateGuard.message!);
      }
    }

    const isSame =
      (this.props.scheduledFor === null && scheduledFor === null) ||
      (this.props.scheduledFor !== null &&
        scheduledFor !== null &&
        this.props.scheduledFor.getTime() === scheduledFor.getTime());

    if (isSame) {
      return Result.ok<void>();
    }

    this.props.scheduledFor = scheduledFor;
    this.touch(now);
    return Result.ok<void>();
  }

  public start(now: Date = new Date()): Result<void> {
    const mutableGuard = this.ensureMutable();
    if (mutableGuard.isFailure) return mutableGuard;

    if (this.props.status.isInProgress()) {
      return Result.fail<void>('Ticket is already in progress');
    }

    if (!this.props.status.isAssigned()) {
      return Result.fail<void>(
        'Only an assigned ticket can be started'
      );
    }

    if (this.props.technicianId === null) {
      return Result.fail<void>(
        'Cannot start a ticket with no technician assigned'
      );
    }

    return this.transitionTo(TicketStatus.IN_PROGRESS, now, () => {
      this.props.startedAt = now;
    });
  }

  public resolve(
    resolutionNotes: string,
    now: Date = new Date()
  ): Result<void> {
    const mutableGuard = this.ensureMutable();
    if (mutableGuard.isFailure) return mutableGuard;

    // An OPEN ticket has nobody attached to it, so there is no one whose work
    // the resolution notes would be describing.
    if (this.props.status.isOpen()) {
      return Result.fail<void>(
        'Cannot resolve a ticket that has not been assigned'
      );
    }

    const notesGuard = Guard.combine([
      Guard.againstNullOrUndefined(
        resolutionNotes,
        'resolutionNotes'
      ),
      Guard.isString(resolutionNotes, 'resolutionNotes')
    ]);
    if (!notesGuard.succeeded) {
      return Result.fail<void>(notesGuard.message!);
    }

    const trimmed = resolutionNotes.trim();
    if (trimmed.length === 0) {
      return Result.fail<void>(
        'Resolution notes are required to resolve a ticket'
      );
    }

    const transitionResult = this.transitionTo(
      TicketStatus.RESOLVED,
      now,
      () => {
        this.props.resolutionNotes = trimmed;
        this.props.resolvedAt = now;
      }
    );
    if (transitionResult.isFailure) return transitionResult;

    this.addDomainEvent(
      new TicketResolvedEvent({
        aggregateId: this.id,
        technicianId: this.props.technicianId,
        resolutionNotes: trimmed,
        resolvedAt: now,
        dateTimeOccurred: now
      })
    );

    return Result.ok<void>();
  }

  public cancel(
    reason: string,
    now: Date = new Date()
  ): Result<void> {
    if (this.props.status.isResolved()) {
      return Result.fail<void>('Cannot cancel a resolved ticket');
    }
    if (this.props.status.isCancelled()) {
      return Result.fail<void>('Ticket is already cancelled');
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
        'A reason is required to cancel a ticket'
      );
    }
    if (trimmed.length > MAX_CANCEL_REASON_LENGTH) {
      return Result.fail<void>(
        `Cancel reason cannot exceed ${MAX_CANCEL_REASON_LENGTH} characters`
      );
    }

    const transitionResult = this.transitionTo(
      TicketStatus.CANCELLED,
      now,
      () => {
        this.props.cancelReason = trimmed;
        this.props.cancelledAt = now;
      }
    );
    if (transitionResult.isFailure) return transitionResult;

    this.addDomainEvent(
      new TicketCancelledEvent({
        aggregateId: this.id,
        reason: trimmed,
        cancelledAt: now,
        dateTimeOccurred: now
      })
    );

    return Result.ok<void>();
  }

  public updateDetails(
    changes: {
      title?: string;
      description?: string;
      priority?: TicketPriority;
      category?: TicketCategory;
    },
    now: Date = new Date()
  ): Result<void> {
    const mutableGuard = this.ensureMutable();
    if (mutableGuard.isFailure) return mutableGuard;

    const nextTitle = changes.title ?? this.props.title;
    const nextDescription =
      changes.description ?? this.props.description;

    const validationResult = Ticket.validate({
      title: nextTitle,
      description: nextDescription,
      customerId: this.props.customerId,
      deviceId: this.props.deviceId,
      origin: this.props.origin,
      originAlertId: this.props.originAlertId
    });
    if (validationResult.isFailure) {
      return Result.fail<void>(validationResult.error);
    }

    this.props.title = nextTitle.trim();
    this.props.description = nextDescription.trim();
    if (changes.priority !== undefined) {
      this.props.priority = changes.priority;
    }
    if (changes.category !== undefined) {
      this.props.category = changes.category;
    }

    this.touch(now);
    return Result.ok<void>();
  }

  public updateLinks(
    customerId: CustomerId | null,
    deviceId: DeviceId | null,
    now: Date = new Date()
  ): Result<void> {
    const mutableGuard = this.ensureMutable();
    if (mutableGuard.isFailure) return mutableGuard;

    const validationResult = Ticket.validate({
      title: this.props.title,
      description: this.props.description,
      customerId,
      deviceId,
      origin: this.props.origin,
      originAlertId: this.props.originAlertId
    });
    if (validationResult.isFailure) {
      return Result.fail<void>(validationResult.error);
    }

    this.props.customerId = customerId;
    this.props.deviceId = deviceId;
    this.touch(now);
    return Result.ok<void>();
  }

  public changeAddress(
    address: ServiceAddress | null,
    now: Date = new Date()
  ): Result<void> {
    const mutableGuard = this.ensureMutable();
    if (mutableGuard.isFailure) return mutableGuard;

    this.props.address = address;
    this.touch(now);
    return Result.ok<void>();
  }

  public isTerminal(): boolean {
    return this.props.status.isTerminal();
  }

  private transitionTo(
    newStatus: string,
    now: Date,
    applyChanges: () => void
  ): Result<void> {
    const statusResult = TicketStatus.create(newStatus);
    if (statusResult.isFailure) {
      return Result.fail<void>(statusResult.error);
    }

    const previousStatus = this.props.status;
    applyChanges();
    this.props.status = statusResult.value;
    this.touch(now);

    this.addDomainEvent(
      new TicketStatusChangedEvent({
        aggregateId: this.id,
        previousStatus: previousStatus.value,
        newStatus,
        dateTimeOccurred: now
      })
    );

    return Result.ok<void>();
  }

  private ensureMutable(): Result<void> {
    if (this.props.status.isResolved()) {
      return Result.fail<void>('Cannot modify a resolved ticket');
    }
    if (this.props.status.isCancelled()) {
      return Result.fail<void>('Cannot modify a cancelled ticket');
    }
    return Result.ok<void>();
  }

  private touch(now: Date): void {
    this.props.updatedAt = now;
  }

  private static validate(
    props: Pick<
      TicketProps,
      | 'title'
      | 'description'
      | 'customerId'
      | 'deviceId'
      | 'origin'
      | 'originAlertId'
    >
  ): Result<void> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(props.title, 'title'),
      Guard.isString(props.title, 'title'),
      Guard.againstNullOrUndefined(props.description, 'description'),
      Guard.isString(props.description, 'description')
    ]);
    if (!guardResult.succeeded) {
      return Result.fail<void>(guardResult.message!);
    }

    const title = props.title.trim();
    if (title.length === 0) {
      return Result.fail<void>('Ticket title cannot be empty');
    }
    if (title.length > MAX_TITLE_LENGTH) {
      return Result.fail<void>(
        `Ticket title cannot exceed ${MAX_TITLE_LENGTH} characters`
      );
    }

    if (props.description.trim().length === 0) {
      return Result.fail<void>('Ticket description cannot be empty');
    }

    // A work order that names neither a customer nor a device tells the
    // technician nothing about where to go or what to look at.
    if (props.customerId === null && props.deviceId === null) {
      return Result.fail<void>(
        'A ticket must reference a customer or a device'
      );
    }

    const originAlertId = props.originAlertId ?? null;

    if (props.origin.isFromAlert()) {
      if (originAlertId === null) {
        return Result.fail<void>(
          'A ticket opened from an alert must reference the originating alert'
        );
      }
      if (props.deviceId === null) {
        return Result.fail<void>(
          'A ticket opened from an alert must reference a device'
        );
      }
    } else if (originAlertId !== null) {
      return Result.fail<void>(
        'A manually created ticket cannot reference an originating alert'
      );
    }

    if (
      originAlertId !== null &&
      !UniqueEntityID.isValid(originAlertId)
    ) {
      return Result.fail<void>(
        'Invalid originating alert id: must be a valid UUID'
      );
    }

    return Result.ok<void>();
  }
}
