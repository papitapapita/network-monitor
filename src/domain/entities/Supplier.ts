import { Entity, UniqueEntityID, Result } from '../shared/kernel';
import { SupplierProps } from '../shared/props';
//import { Guard } from '../shared/kernel/Guard';

export class Supplier extends Entity<SupplierProps> {
  private constructor(props: SupplierProps, id?: UniqueEntityID) {
    super(props, id);
  }

  get name(): string {
    return this.props.name;
  }

  get contactEmail(): string {
    return this.props.contactEmail;
  }

  get contactPhone(): string | undefined {
    return this.props.contactPhone;
  }

  get address(): string | undefined {
    return this.props.address;
  }

  get website(): string | undefined {
    return this.props.website;
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

  public deactivate(): void {
    this.props.isActive = false;
    this.props.updatedAt = new Date();
  }

  public activate(): void {
    this.props.isActive = true;
    this.props.updatedAt = new Date();
  }

  public updateContactInfo(
    email: string,
    phone?: string,
    address?: string,
    website?: string
  ): Result<void> {
    const emailValidation = Guard.againstInvalidEmail(
      email,
      'contactEmail'
    );
    if (!emailValidation.succeeded) {
      return Result.fail<void>(emailValidation.message);
    }

    this.props.contactEmail = email;
    this.props.contactPhone = phone;
    this.props.address = address;
    this.props.website = website;
    this.props.updatedAt = new Date();

    return Result.ok<void>();
  }

  public static create(
    props: SupplierProps,
    id?: UniqueEntityID
  ): Result<Supplier> {
    const guardResult = Guard.againstNullOrUndefinedBulk([
      { argument: props.name, argumentName: 'name' },
      { argument: props.contactEmail, argumentName: 'contactEmail' }
    ]);

    if (!guardResult.succeeded) {
      return Result.fail<Supplier>(guardResult.message);
    }

    const emailValidation = Guard.againstInvalidEmail(
      props.contactEmail,
      'contactEmail'
    );
    if (!emailValidation.succeeded) {
      return Result.fail<Supplier>(emailValidation.message);
    }

    const nameLength = Guard.inRange(
      props.name.length,
      2,
      200,
      'name'
    );
    if (!nameLength.succeeded) {
      return Result.fail<Supplier>(nameLength.message);
    }

    const supplier = new Supplier(
      {
        ...props,
        isActive: props.isActive ?? true,
        createdAt: props.createdAt ?? new Date(),
        updatedAt: props.updatedAt ?? new Date()
      },
      id
    );

    return Result.ok<Supplier>(supplier);
  }
}
