import { AggregateRoot, Result, Guard } from 'domain/shared/core';
import { TechnicianId, UserId } from 'domain/shared/ids';
import { ContactPhone } from '../value-objects';
import { TechnicianProps } from '../props';
import {
  TechnicianCreatedEvent,
  TechnicianUpdatedEvent
} from '../events';

const MAX_NAME_LENGTH = 150;
const MAX_EMAIL_LENGTH = 255;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class Technician extends AggregateRoot<
  TechnicianProps,
  TechnicianId
> {
  private constructor(props: TechnicianProps, id: TechnicianId) {
    super(props, id);
  }

  get fullName(): string {
    return this.props.fullName;
  }

  get phone(): ContactPhone {
    return this.props.phone;
  }

  get email(): string | null {
    return this.props.email;
  }

  get userId(): UserId | null {
    return this.props.userId;
  }

  get isActive(): boolean {
    return this.props.isActive;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  public static create(
    props: Omit<
      TechnicianProps,
      'createdAt' | 'updatedAt' | 'isActive'
    > & { isActive?: boolean }
  ): Result<Technician> {
    const candidate = {
      fullName: props.fullName,
      phone: props.phone,
      email: props.email ?? null,
      userId: props.userId ?? null,
      isActive: props.isActive ?? true
    };

    const validationResult = Technician.validate(candidate);
    if (validationResult.isFailure) {
      return Result.fail<Technician>(validationResult.error);
    }

    const id = TechnicianId.create();
    const now = new Date();

    const technician = new Technician(
      {
        ...candidate,
        fullName: candidate.fullName.trim(),
        createdAt: now,
        updatedAt: now
      },
      id
    );

    technician.addDomainEvent(
      new TechnicianCreatedEvent({
        aggregateId: technician.id,
        fullName: technician.fullName,
        phone: technician.phone.toString(),
        dateTimeOccurred: now
      })
    );

    return Result.ok<Technician>(technician);
  }

  // bypasses validation — for repository use only
  public static reconstitute(
    id: TechnicianId,
    props: TechnicianProps
  ): Technician {
    return new Technician(props, id);
  }

  public rename(newName: string): Result<void> {
    const validationResult = Technician.validate({
      ...this.props,
      fullName: newName
    });
    if (validationResult.isFailure) {
      return Result.fail<void>(validationResult.error);
    }

    const trimmed = newName.trim();
    if (this.props.fullName === trimmed) {
      return Result.ok<void>();
    }

    this.props.fullName = trimmed;
    this.emitUpdated(['fullName']);
    return Result.ok<void>();
  }

  public changePhone(newPhone: ContactPhone): Result<void> {
    const validationResult = Technician.validate({
      ...this.props,
      phone: newPhone
    });
    if (validationResult.isFailure) {
      return Result.fail<void>(validationResult.error);
    }

    if (this.props.phone.equals(newPhone)) {
      return Result.ok<void>();
    }

    this.props.phone = newPhone;
    this.emitUpdated(['phone']);
    return Result.ok<void>();
  }

  public changeEmail(newEmail: string | null): Result<void> {
    const validationResult = Technician.validate({
      ...this.props,
      email: newEmail
    });
    if (validationResult.isFailure) {
      return Result.fail<void>(validationResult.error);
    }

    const normalized =
      newEmail === null ? null : newEmail.trim().toLowerCase();

    if (this.props.email === normalized) {
      return Result.ok<void>();
    }

    this.props.email = normalized;
    this.emitUpdated(['email']);
    return Result.ok<void>();
  }

  public linkUser(userId: UserId | null): Result<void> {
    const isSame =
      (this.props.userId === null && userId === null) ||
      (this.props.userId !== null &&
        userId !== null &&
        this.props.userId.equals(userId));

    if (isSame) {
      return Result.ok<void>();
    }

    this.props.userId = userId;
    this.emitUpdated(['userId']);
    return Result.ok<void>();
  }

  public activate(): Result<void> {
    if (this.props.isActive) {
      return Result.ok<void>();
    }

    this.props.isActive = true;
    this.emitUpdated(['isActive']);
    return Result.ok<void>();
  }

  public deactivate(): Result<void> {
    if (!this.props.isActive) {
      return Result.ok<void>();
    }

    this.props.isActive = false;
    this.emitUpdated(['isActive']);
    return Result.ok<void>();
  }

  private emitUpdated(changedFields: string[]): void {
    this.props.updatedAt = new Date();
    this.addDomainEvent(
      new TechnicianUpdatedEvent({
        aggregateId: this.id,
        fullName: this.props.fullName,
        changedFields,
        dateTimeOccurred: this.props.updatedAt
      })
    );
  }

  private static validate(
    props: Pick<
      TechnicianProps,
      'fullName' | 'phone' | 'email' | 'userId' | 'isActive'
    >
  ): Result<void> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(props.fullName, 'fullName'),
      Guard.isString(props.fullName, 'fullName'),
      Guard.againstNullOrUndefined(props.phone, 'phone')
    ]);
    if (!guardResult.succeeded) {
      return Result.fail<void>(guardResult.message!);
    }

    const trimmedName = props.fullName.trim();
    if (trimmedName.length === 0) {
      return Result.fail<void>('Technician name cannot be empty');
    }
    if (trimmedName.length > MAX_NAME_LENGTH) {
      return Result.fail<void>(
        `Technician name cannot exceed ${MAX_NAME_LENGTH} characters`
      );
    }

    if (props.email !== null && props.email !== undefined) {
      const emailGuard = Guard.isString(props.email, 'email');
      if (!emailGuard.succeeded) {
        return Result.fail<void>(emailGuard.message!);
      }
      const trimmedEmail = props.email.trim();
      if (trimmedEmail.length > MAX_EMAIL_LENGTH) {
        return Result.fail<void>(
          `Technician email cannot exceed ${MAX_EMAIL_LENGTH} characters`
        );
      }
      if (
        trimmedEmail.length > 0 &&
        !EMAIL_REGEX.test(trimmedEmail)
      ) {
        return Result.fail<void>(
          'Technician email must be a valid email address'
        );
      }
    }

    return Result.ok<void>();
  }
}
