import { AggregateRoot, Result, Guard } from 'domain/shared/core';
import { LocationId } from 'domain/shared/ids';
import { LocationType } from '../enums';
import { Coordinates } from '../value-objects';
import { LocationProps } from '../props';

export class Location extends AggregateRoot<
  LocationProps,
  LocationId
> {
  private constructor(props: LocationProps, id: LocationId) {
    super(props, id);
  }

  get name(): string {
    return this.props.name;
  }

  get type(): LocationType {
    return this.props.type;
  }

  get municipality(): string | null | undefined {
    return this.props.municipality;
  }

  get neighborhood(): string | null | undefined {
    return this.props.neighborhood;
  }

  get address(): string | null | undefined {
    return this.props.address;
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
        municipality: props.municipality ?? null,
        neighborhood: props.neighborhood ?? null,
        address: props.address ?? null,
        coordinates: props.coordinates ?? null,
        createdAt: props.createdAt || now,
        updatedAt: props.updatedAt || now
      },
      id
    );

    return Result.ok<Location>(location);
  }

  public static reconstitute(
    id: LocationId,
    props: LocationProps
  ): Location {
    return new Location(props, id);
  }

  public updateName(newName: string): Result<void> {
    const nameResult = Location.validateName(newName);
    if (nameResult.isFailure) {
      return Result.fail<void>(nameResult.error);
    }

    const oldName = this.props.name;
    if (oldName === newName) return Result.ok<void>();

    this.props.name = newName;
    this.touch();

    return Result.ok<void>();
  }

  public updateType(newType: LocationType): Result<void> {
    const guardResult = Guard.againstNullOrUndefined(newType, 'type');
    if (!guardResult.succeeded) {
      return Result.fail<void>(guardResult.message!);
    }

    const oldType = this.props.type;
    if (oldType === newType) return Result.ok<void>();

    if (newType === LocationType.CUSTOMER_PREMISES) {
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
    const lengthResult = Location.validateAddressLengths(fields);
    if (lengthResult.isFailure) {
      return Result.fail<void>(lengthResult.error);
    }

    const changedFields: string[] = [];
    const previousValues: Record<string, unknown> = {};
    const newValues: Record<string, unknown> = {};

    if (
      fields.municipality !== undefined &&
      fields.municipality !== this.props.municipality
    ) {
      changedFields.push('municipality');
      previousValues.municipality = this.props.municipality;
      newValues.municipality = fields.municipality;
      this.props.municipality = fields.municipality;
    }

    if (
      fields.neighborhood !== undefined &&
      fields.neighborhood !== this.props.neighborhood
    ) {
      changedFields.push('neighborhood');
      previousValues.neighborhood = this.props.neighborhood;
      newValues.neighborhood = fields.neighborhood;
      this.props.neighborhood = fields.neighborhood;
    }

    if (
      fields.address !== undefined &&
      fields.address !== this.props.address
    ) {
      changedFields.push('address');
      previousValues.address = this.props.address;
      newValues.address = fields.address;
      this.props.address = fields.address;
    }

    if (changedFields.length === 0) return Result.ok<void>();

    this.touch();

    return Result.ok<void>();
  }

  public updateCoordinates(
    coordinates: Coordinates | null
  ): Result<void> {
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
    return this.props.address != null && this.props.address.trim().length > 0;
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
      return Result.fail<void>(
        'Location name cannot exceed 150 characters'
      );
    }

    return Result.ok<void>();
  }

  private static validateAddressLengths(fields: {
    municipality?: string | null;
    neighborhood?: string | null;
    address?: string | null;
  }): Result<void> {
    if (
      fields.municipality != null &&
      fields.municipality.length > 100
    ) {
      return Result.fail<void>(
        'Municipality cannot exceed 100 characters'
      );
    }
    if (
      fields.neighborhood != null &&
      fields.neighborhood.length > 150
    ) {
      return Result.fail<void>(
        'Neighborhood cannot exceed 150 characters'
      );
    }
    if (fields.address != null && fields.address.length > 255) {
      return Result.fail<void>(
        'Address cannot exceed 255 characters'
      );
    }

    return Result.ok<void>();
  }

  private static validateCustomerPremisesNavigability(
    props: Pick<LocationProps, 'address' | 'coordinates'>
  ): Result<void> {
    const hasAddress =
      props.address != null && props.address.trim().length > 0;
    const hasCoordinates = props.coordinates != null;

    if (!hasAddress && !hasCoordinates) {
      return Result.fail<void>(
        'A CUSTOMER_PREMISES location must have an address or coordinates so technicians can navigate to it'
      );
    }

    return Result.ok<void>();
  }

  private static validate(props: LocationProps): Result<void> {
    const guardResult = Guard.againstNullOrUndefined(
      props.type,
      'type'
    );

    if (!guardResult.succeeded) {
      return Result.fail<void>(guardResult.message!);
    }

    const nameResult = Location.validateName(props.name);
    if (nameResult.isFailure) {
      return nameResult;
    }

    const lengthResult = Location.validateAddressLengths(props);
    if (lengthResult.isFailure) {
      return lengthResult;
    }

    if (props.type === LocationType.CUSTOMER_PREMISES) {
      return Location.validateCustomerPremisesNavigability(props);
    }

    return Result.ok<void>();
  }
}
