import { AggregateRoot, Result, Guard } from '../../shared/core';
import { VendorId } from '../../shared/ids';
import { VendorProps } from '../props';
import { VendorCreatedEvent, VendorUpdatedEvent } from '../events';

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class Vendor extends AggregateRoot<VendorProps, VendorId> {
  private constructor(props: VendorProps, id: VendorId) {
    super(props, id);
  }

  get name(): string {
    return this.props.name;
  }

  get slug(): string {
    return this.props.slug;
  }

  get description(): string | null {
    return this.props.description;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  public static create(
    props: Omit<VendorProps, 'createdAt' | 'updatedAt'>
  ): Result<Vendor> {
    const validationResult = Vendor.validate(props);
    if (validationResult.isFailure) {
      return Result.fail<Vendor>(validationResult.error);
    }

    const id = VendorId.create();
    const now = new Date();

    const vendor = new Vendor(
      {
        ...props,
        description: props.description ?? null,
        createdAt: now,
        updatedAt: now
      },
      id
    );

    vendor.addDomainEvent(
      new VendorCreatedEvent({
        aggregateId: vendor.id,
        vendorName: vendor.name,
        vendorSlug: vendor.slug,
        dateTimeOccurred: now
      })
    );

    return Result.ok<Vendor>(vendor);
  }

  public static reconstitute(
    id: VendorId,
    props: VendorProps
  ): Vendor {
    return new Vendor(props, id);
  }

  public updateName(newName: string): Result<void> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(newName, 'name'),
      Guard.isString(newName, 'name')
    ]);
    if (!guardResult.succeeded) {
      return Result.fail<void>(guardResult.message!);
    }

    const trimmed = newName.trim();
    if (trimmed.length === 0) {
      return Result.fail<void>('Vendor name cannot be empty');
    }
    if (trimmed.length > 100) {
      return Result.fail<void>(
        'Vendor name cannot exceed 100 characters'
      );
    }

    if (this.props.name === trimmed) return Result.ok<void>();

    this.props.name = trimmed;
    this.props.updatedAt = new Date();

    this.addDomainEvent(
      new VendorUpdatedEvent({
        aggregateId: this.id,
        vendorName: trimmed,
        changedFields: ['name'],
        dateTimeOccurred: new Date()
      })
    );

    return Result.ok<void>();
  }

  public updateSlug(newSlug: string): Result<void> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(newSlug, 'slug'),
      Guard.isString(newSlug, 'slug')
    ]);
    if (!guardResult.succeeded) {
      return Result.fail<void>(guardResult.message!);
    }

    const trimmed = newSlug.trim();
    if (trimmed.length === 0) {
      return Result.fail<void>('Vendor slug cannot be empty');
    }
    if (trimmed.length > 100) {
      return Result.fail<void>(
        'Vendor slug cannot exceed 100 characters'
      );
    }
    if (!SLUG_REGEX.test(trimmed)) {
      return Result.fail<void>(
        'Vendor slug must contain only lowercase letters, digits, and hyphens (e.g. "tp-link")'
      );
    }

    if (this.props.slug === trimmed) return Result.ok<void>();

    this.props.slug = trimmed;
    this.props.updatedAt = new Date();

    this.addDomainEvent(
      new VendorUpdatedEvent({
        aggregateId: this.id,
        vendorName: this.props.name,
        changedFields: ['slug'],
        dateTimeOccurred: new Date()
      })
    );

    return Result.ok<void>();
  }

  public updateDescription(
    newDescription: string | null
  ): Result<void> {
    if (newDescription !== null && newDescription.length > 500) {
      return Result.fail<void>(
        'Vendor description cannot exceed 500 characters'
      );
    }

    if (this.props.description === newDescription)
      return Result.ok<void>();

    this.props.description = newDescription;
    this.props.updatedAt = new Date();

    this.addDomainEvent(
      new VendorUpdatedEvent({
        aggregateId: this.id,
        vendorName: this.props.name,
        changedFields: ['description'],
        dateTimeOccurred: new Date()
      })
    );

    return Result.ok<void>();
  }

  private static validate(
    props: Omit<VendorProps, 'createdAt' | 'updatedAt'>
  ): Result<void> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(props.name, 'name'),
      Guard.againstNullOrUndefined(props.slug, 'slug'),
      Guard.isString(props.name, 'name'),
      Guard.isString(props.slug, 'slug')
    ]);

    if (!guardResult.succeeded) {
      return Result.fail<void>(guardResult.message!);
    }

    const name = props.name.trim();
    if (name.length === 0) {
      return Result.fail<void>('Vendor name cannot be empty');
    }
    if (name.length > 100) {
      return Result.fail<void>(
        'Vendor name cannot exceed 100 characters'
      );
    }

    const slug = props.slug.trim();
    if (slug.length === 0) {
      return Result.fail<void>('Vendor slug cannot be empty');
    }
    if (slug.length > 100) {
      return Result.fail<void>(
        'Vendor slug cannot exceed 100 characters'
      );
    }
    if (!SLUG_REGEX.test(slug)) {
      return Result.fail<void>(
        'Vendor slug must contain only lowercase letters, digits, and hyphens (e.g. "tp-link")'
      );
    }

    if (props.description != null && props.description.length > 500) {
      return Result.fail<void>(
        'Vendor description cannot exceed 500 characters'
      );
    }

    return Result.ok<void>();
  }
}
