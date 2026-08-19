import { AggregateRoot, Result, Guard } from 'domain/shared/core';
import { CustomerId } from 'domain/shared/ids';
import { PhoneNumber, Cedula, EmailAddress } from '../value-objects';
import { CustomerProps } from '../props';
import {
  CustomerCreatedEvent,
  CustomerUpdatedEvent
} from '../events';

const MAX_NAME_LENGTH = 150;

export class Customer extends AggregateRoot<
  CustomerProps,
  CustomerId
> {
  private constructor(props: CustomerProps, id: CustomerId) {
    super(props, id);
  }

  get fullName(): string {
    return this.props.fullName;
  }

  get phone(): PhoneNumber {
    return this.props.phone;
  }

  get email(): EmailAddress | null {
    return this.props.email;
  }

  get cedula(): Cedula | null {
    return this.props.cedula;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  public static create(
    props: Omit<CustomerProps, 'createdAt' | 'updatedAt'>
  ): Result<Customer> {
    const nameResult = Customer.validateName(props.fullName);
    if (nameResult.isFailure) {
      return Result.fail<Customer>(nameResult.error);
    }

    const guardResult = Guard.againstNullOrUndefined(
      props.phone,
      'phone'
    );
    if (!guardResult.succeeded) {
      return Result.fail<Customer>(guardResult.message!);
    }

    const id = CustomerId.create();
    const now = new Date();

    const customer = new Customer(
      {
        ...props,
        fullName: nameResult.value,
        email: props.email ?? null,
        cedula: props.cedula ?? null,
        createdAt: now,
        updatedAt: now
      },
      id
    );

    customer.addDomainEvent(
      new CustomerCreatedEvent({
        aggregateId: customer.id,
        fullName: customer.fullName,
        phone: customer.phone.toString(),
        dateTimeOccurred: now
      })
    );

    return Result.ok<Customer>(customer);
  }

  // bypasses validation — for repository use only
  public static reconstitute(
    id: CustomerId,
    props: CustomerProps
  ): Customer {
    return new Customer(props, id);
  }

  public rename(newName: string): Result<void> {
    const nameResult = Customer.validateName(newName);
    if (nameResult.isFailure) {
      return Result.fail<void>(nameResult.error);
    }

    if (this.props.fullName === nameResult.value) {
      return Result.ok<void>();
    }

    this.props.fullName = nameResult.value;
    this.emitUpdated(['fullName']);
    return Result.ok<void>();
  }

  public changePhone(newPhone: PhoneNumber): Result<void> {
    const guardResult = Guard.againstNullOrUndefined(
      newPhone,
      'phone'
    );
    if (!guardResult.succeeded) {
      return Result.fail<void>(guardResult.message!);
    }

    if (this.props.phone.equals(newPhone)) {
      return Result.ok<void>();
    }

    this.props.phone = newPhone;
    this.emitUpdated(['phone']);
    return Result.ok<void>();
  }

  public changeEmail(newEmail: EmailAddress | null): Result<void> {
    const isSame =
      (this.props.email === null && newEmail === null) ||
      (this.props.email !== null &&
        newEmail !== null &&
        this.props.email.equals(newEmail));

    if (isSame) {
      return Result.ok<void>();
    }

    this.props.email = newEmail;
    this.emitUpdated(['email']);
    return Result.ok<void>();
  }

  public changeCedula(newCedula: Cedula | null): Result<void> {
    const isSame =
      (this.props.cedula === null && newCedula === null) ||
      (this.props.cedula !== null &&
        newCedula !== null &&
        this.props.cedula.equals(newCedula));

    if (isSame) {
      return Result.ok<void>();
    }

    this.props.cedula = newCedula;
    this.emitUpdated(['cedula']);
    return Result.ok<void>();
  }

  private emitUpdated(changedFields: string[]): void {
    this.props.updatedAt = new Date();
    this.addDomainEvent(
      new CustomerUpdatedEvent({
        aggregateId: this.id,
        fullName: this.props.fullName,
        changedFields,
        dateTimeOccurred: this.props.updatedAt
      })
    );
  }

  private static validateName(name: string): Result<string> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(name, 'fullName'),
      Guard.isString(name, 'fullName')
    ]);
    if (!guardResult.succeeded) {
      return Result.fail<string>(guardResult.message!);
    }

    const trimmed = name.trim();
    if (trimmed.length === 0) {
      return Result.fail<string>('Customer name cannot be empty');
    }
    if (trimmed.length > MAX_NAME_LENGTH) {
      return Result.fail<string>(
        `Customer name cannot exceed ${MAX_NAME_LENGTH} characters`
      );
    }

    return Result.ok<string>(trimmed);
  }
}
