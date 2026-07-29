import { AggregateRoot, Result, Guard } from 'domain/shared/core';
import { LocationId } from 'domain/shared/ids';
import { Address, Coordinates, LocationType } from '../value-objects';
import { LocationProps } from '../props';

export class Location extends AggregateRoot<LocationProps, LocationId> {
  private constructor(props: LocationProps, id: LocationId) {
    super(props, id);
  }

  get name(): string {
    return this.props.name;
  }

  get type(): LocationType {
    return this.props.type;
  }

  get municipality(): string | null {
    return this.props.address?.municipality ?? null;
  }

  get neighborhood(): string | null {
    return this.props.address?.neighborhood ?? null;
  }

  get address(): string | null {
    return this.props.address?.street ?? null;
  }

  // used by the client map feature to plot device locations on a geographic view
  get coordinates(): Coordinates | null | undefined {
    return this.props.coordinates;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  public static create(props: LocationProps): Result<Location> {
    const validationResult = Location.validate(props);
    if (validationResult.isFailure) {
      return Result.fail<Location>(validationResult.error);
    }

    const id = LocationId.create();
    const now = new Date();

    const location = new Location(
      {
        ...props,
        address: props.address ?? null,
        coordinates: props.coordinates ?? null,
        createdAt: props.createdAt || now,
        updatedAt: props.updatedAt || now
      },
      id
    );

    return Result.ok<Location>(location);
  }

  public static reconstitute(id: LocationId, props: LocationProps): Location {
    return new Location(props, id);
  }

  public updateName(newName: string): Result<void> {
    const nameResult = Location.validateName(newName);
    if (nameResult.isFailure) {
      return Result.fail<void>(nameResult.error);
    }

    if (this.props.name === newName) return Result.ok<void>();

    this.props.name = newName;
    this.touch();

    return Result.ok<void>();
  }

  public updateType(newType: LocationType): Result<void> {
    const guardResult = Guard.againstNullOrUndefined(newType, 'type');
    if (!guardResult.succeeded) {
      return Result.fail<void>(guardResult.message!);
    }

    if (this.props.type.equals(newType)) return Result.ok<void>();

    if (newType.isCustomerPremises()) {
      const cpResult = Location.validateCustomerPremisesNavigability(
        this.props
      );
      if (cpResult.isFailure) {
        return Result.fail<void>(cpResult.error);
      }
    }

    this.props.type = newType;
    this.touch();

    return Result.ok<void>();
  }

  public updateAddressFields(fields: {
    municipality?: string | null;
    neighborhood?: string | null;
    address?: string | null;
  }): Result<void> {
    const street =
      fields.address !== undefined
        ? fields.address
        : (this.props.address?.street ?? null);
    const municipality =
      fields.municipality !== undefined
        ? fields.municipality
        : (this.props.address?.municipality ?? null);
    const neighborhood =
      fields.neighborhood !== undefined
        ? fields.neighborhood
        : (this.props.address?.neighborhood ?? null);

    const addressResult = Address.createOptional({
      street,
      municipality,
      neighborhood
    });
    if (addressResult.isFailure) return Result.fail<void>(addressResult.error);

    const newAddressVO = addressResult.value;

    if (this.props.type.isCustomerPremises()) {
      const cpResult = Location.validateCustomerPremisesNavigability({
        address: newAddressVO,
        coordinates: this.props.coordinates ?? null
      });
      if (cpResult.isFailure) return Result.fail<void>(cpResult.error);
    }

    const current = this.props.address;
    const unchanged =
      (current === null && newAddressVO === null) ||
      (current !== null && newAddressVO !== null && current.equals(newAddressVO));

    if (unchanged) return Result.ok<void>();

    this.props.address = newAddressVO;
    this.touch();

    return Result.ok<void>();
  }

  public updateCoordinates(coordinates: Coordinates | null): Result<void> {
    const previousCoordinates = this.props.coordinates;
    const previousStr = previousCoordinates
      ? previousCoordinates.toString()
      : null;
    const newStr = coordinates ? coordinates.toString() : null;

    if (previousStr === newStr) return Result.ok<void>();

    this.props.coordinates = coordinates;
    this.touch();

    return Result.ok<void>();
  }

  public hasCoordinates(): boolean {
    return this.props.coordinates != null;
  }

  public hasAddress(): boolean {
    return this.props.address !== null;
  }

  private touch(): void {
    this.props.updatedAt = new Date();
  }

  private static validateName(name: string): Result<void> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(name, 'name'),
      Guard.isString(name, 'name')
    ]);

    if (!guardResult.succeeded) {
      return Result.fail<void>(guardResult.message!);
    }

    if (name.trim().length === 0) {
      return Result.fail<void>('Location name cannot be empty');
    }

    if (name.length > 150) {
      return Result.fail<void>('Location name cannot exceed 150 characters');
    }

    return Result.ok<void>();
  }

  private static validateCustomerPremisesNavigability(
    props: Pick<LocationProps, 'address' | 'coordinates'>
  ): Result<void> {
    if (props.coordinates != null) return Result.ok<void>();
    if (props.address != null) return Result.ok<void>();

    return Result.fail<void>(
      'A CUSTOMER_PREMISES location must have coordinates or a complete address ' +
        '(street, municipality, and neighborhood) so technicians can navigate to it'
    );
  }

  private static validate(props: LocationProps): Result<void> {
    const guardResult = Guard.againstNullOrUndefined(props.type, 'type');
    if (!guardResult.succeeded) {
      return Result.fail<void>(guardResult.message!);
    }

    const nameResult = Location.validateName(props.name);
    if (nameResult.isFailure) return nameResult;

    if (props.type.isCustomerPremises()) {
      return Location.validateCustomerPremisesNavigability(props);
    }

    return Result.ok<void>();
  }
}
