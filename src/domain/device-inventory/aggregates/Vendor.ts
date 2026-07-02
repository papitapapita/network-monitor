import { AggregateRoot, Result, Guard } from 'domain/shared/core';
import { VendorId } from 'domain/shared/ids';
import { VendorProps } from '../props';
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

    return Result.ok<Vendor>(vendor);
  }

  public static reconstitute(
    id: VendorId,
    props: VendorProps
  ): Vendor {
    return new Vendor(props, id);
  }

  public updateName(newName: string): Result<void> {
    const nameResult = Vendor.validateName(newName);
    if (nameResult.isFailure) return Result.fail<void>(nameResult.error);

    const trimmed = newName.trim();
    if (this.props.name === trimmed) return Result.ok<void>();

    this.props.name = trimmed;
    this.props.updatedAt = new Date();
    return Result.ok<void>();
  }

  public updateSlug(newSlug: string): Result<void> {
    const slugResult = Vendor.validateSlug(newSlug);
    if (slugResult.isFailure) return Result.fail<void>(slugResult.error);

    const trimmed = newSlug.trim();
    if (this.props.slug === trimmed) return Result.ok<void>();

    this.props.slug = trimmed;
    this.props.updatedAt = new Date();
    return Result.ok<void>();
  }

  public updateDescription(newDescription: string | null): Result<void> {
    const descResult = Vendor.validateDescription(newDescription);
    if (descResult.isFailure) return Result.fail<void>(descResult.error);

    if (this.props.description === newDescription) return Result.ok<void>();

    this.props.description = newDescription;
    this.props.updatedAt = new Date();
    return Result.ok<void>();
  }

  private static validateName(name: string): Result<void> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(name, 'name'),
      Guard.isString(name, 'name')
    ]);
    if (!guardResult.succeeded) {
      return Result.fail<void>(guardResult.message!);
    }
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      return Result.fail<void>('Vendor name cannot be empty');
    }
    if (trimmed.length > 100) {
      return Result.fail<void>('Vendor name cannot exceed 100 characters');
    }
    return Result.ok<void>();
  }

  private static validateSlug(slug: string): Result<void> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(slug, 'slug'),
      Guard.isString(slug, 'slug')
    ]);
    if (!guardResult.succeeded) {
      return Result.fail<void>(guardResult.message!);
    }
    const trimmed = slug.trim();
    if (trimmed.length === 0) {
      return Result.fail<void>('Vendor slug cannot be empty');
    }
    if (trimmed.length > 100) {
      return Result.fail<void>('Vendor slug cannot exceed 100 characters');
    }
    if (!SLUG_REGEX.test(trimmed)) {
      return Result.fail<void>(
        'Vendor slug must contain only lowercase letters, digits, and hyphens (e.g. "tp-link")'
      );
    }
    return Result.ok<void>();
  }

  private static validateDescription(
    description: string | null
  ): Result<void> {
    if (description !== null && description.length > 500) {
      return Result.fail<void>(
        'Vendor description cannot exceed 500 characters'
      );
    }
    return Result.ok<void>();
  }

  private static validate(
    props: Omit<VendorProps, 'createdAt' | 'updatedAt'>
  ): Result<void> {
    const nameResult = Vendor.validateName(props.name);
    if (nameResult.isFailure) return nameResult;

    const slugResult = Vendor.validateSlug(props.slug);
    if (slugResult.isFailure) return slugResult;

    const descResult = Vendor.validateDescription(props.description ?? null);
    if (descResult.isFailure) return descResult;

    return Result.ok<void>();
  }
}
