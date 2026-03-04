import { AggregateRoot, Result, Guard } from '../../shared/core';
import { LocationId } from '../../shared/ids';
import { LocationType } from '../enums';
import { Coordinates } from '../value-objects';
import { LocationProps } from '../props';
import {
  LocationCreatedEvent,
  LocationUpdatedEvent
} from '../events';

export class Location extends AggregateRoot<
  LocationProps,
  LocationId
> {
  private constructor(props: LocationProps, id: LocationId) {
    super(props, id);
  }

  // ============================================================================
  // Getters
  // ============================================================================

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

  get coordinates(): Coordinates | null | undefined {
    return this.props.coordinates;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  // ============================================================================
  // Factory Methods
  // ============================================================================

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

    location.addDomainEvent(
      new LocationCreatedEvent({
        aggregateId: location.id,
        locationName: location.name,
        locationType: location.type,
        dateTimeOccurred: now
      })
    );

    return Result.ok<Location>(location);
  }

  public static reconstitute(
    id: LocationId,
    props: LocationProps
  ): Location {
    return new Location(props, id);
  }

  // ============================================================================
  // Command Methods
  // ============================================================================

  public updateName(newName: string): Result<void> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(newName, 'name'),
      Guard.isString(newName, 'name')
    ]);

    if (!guardResult.succeeded) {
      return Result.fail<void>(guardResult.message!);
    }

    if (newName.trim().length === 0) {
      return Result.fail<void>('Location name cannot be empty');
    }

    if (newName.length > 150) {
      return Result.fail<void>(
        'Location name cannot exceed 150 characters'
      );
    }

    const oldName = this.props.name;
    if (oldName === newName) return Result.ok<void>();

    this.props.name = newName;
    this.props.updatedAt = new Date();

    this.addDomainEvent(
      new LocationUpdatedEvent({
        aggregateId: this.id,
        locationName: newName,
        changedFields: ['name'],
        previousValues: { name: oldName },
        newValues: { name: newName },
        dateTimeOccurred: new Date()
      })
    );

    return Result.ok<void>();
  }

  public updateType(newType: LocationType): Result<void> {
    const guardResult = Guard.againstNullOrUndefined(newType, 'type');
    if (!guardResult.succeeded) {
      return Result.fail<void>(guardResult.message!);
    }

    const oldType = this.props.type;
    if (oldType === newType) return Result.ok<void>();

    this.props.type = newType;
    this.props.updatedAt = new Date();

    this.addDomainEvent(
      new LocationUpdatedEvent({
        aggregateId: this.id,
        locationName: this.props.name,
        changedFields: ['type'],
        previousValues: { type: oldType },
        newValues: { type: newType },
        dateTimeOccurred: new Date()
      })
    );

    return Result.ok<void>();
  }

  public updateAddressFields(fields: {
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

    this.props.updatedAt = new Date();

    this.addDomainEvent(
      new LocationUpdatedEvent({
        aggregateId: this.id,
        locationName: this.props.name,
        changedFields,
        previousValues,
        newValues,
        dateTimeOccurred: new Date()
      })
    );

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
    this.props.updatedAt = new Date();

    this.addDomainEvent(
      new LocationUpdatedEvent({
        aggregateId: this.id,
        locationName: this.props.name,
        changedFields: ['coordinates'],
        previousValues: { coordinates: previousStr },
        newValues: { coordinates: newStr },
        dateTimeOccurred: new Date()
      })
    );

    return Result.ok<void>();
  }

  public hasCoordinates(): boolean {
    return (
      this.props.coordinates !== null &&
      this.props.coordinates !== undefined
    );
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private static validate(props: LocationProps): Result<void> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(props.name, 'name'),
      Guard.againstNullOrUndefined(props.type, 'type'),
      Guard.isString(props.name, 'name')
    ]);

    if (!guardResult.succeeded) {
      return Result.fail<void>(guardResult.message!);
    }

    if (props.name.trim().length === 0) {
      return Result.fail<void>('Location name cannot be empty');
    }

    if (props.name.length > 150) {
      return Result.fail<void>(
        'Location name cannot exceed 150 characters'
      );
    }

    if (
      props.municipality != null &&
      props.municipality.length > 100
    ) {
      return Result.fail<void>(
        'Municipality cannot exceed 100 characters'
      );
    }

    if (
      props.neighborhood != null &&
      props.neighborhood.length > 150
    ) {
      return Result.fail<void>(
        'Neighborhood cannot exceed 150 characters'
      );
    }

    if (props.address != null && props.address.length > 255) {
      return Result.fail<void>(
        'Address cannot exceed 255 characters'
      );
    }

    return Result.ok<void>();
  }
}
