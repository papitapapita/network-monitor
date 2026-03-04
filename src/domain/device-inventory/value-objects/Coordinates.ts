import { ValueObject, Result, Guard } from '../../shared/core';
import { CoordinatesProps } from '../props';

/**
 * Coordinates Value Object
 *
 * Represents a geographic position expressed in WGS-84 decimal degrees.
 * Latitude and longitude must always be provided together — providing one
 * without the other is a domain invariant violation.
 * Altitude (elevation above sea level in metres) is optional.
 *
 * Business Rules:
 * - Latitude must be in the range -90 to 90 (inclusive)
 * - Longitude must be in the range -180 to 180 (inclusive)
 * - Latitude and longitude are required together; neither can appear without the other
 * - Altitude has no enforced range (negative values are valid, e.g. below sea level)
 * - All values must be finite numbers (NaN and Infinity are rejected)
 */
export class Coordinates extends ValueObject<CoordinatesProps> {
  get latitude(): number {
    return this._props.latitude;
  }

  get longitude(): number {
    return this._props.longitude;
  }

  get altitude(): number | undefined {
    return this._props.altitude;
  }

  private constructor(_props: CoordinatesProps) {
    super(_props);
  }

  public static create(props: CoordinatesProps): Result<Coordinates> {
    const propsGuard = Guard.againstNullOrUndefined(
      props,
      'coordinates'
    );
    if (!propsGuard.succeeded) {
      return Result.fail(propsGuard.message!);
    }

    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(props.latitude, 'latitude'),
      Guard.againstNullOrUndefined(props.longitude, 'longitude'),
      Guard.isNumber(props.latitude, 'latitude'),
      Guard.isNumber(props.longitude, 'longitude')
    ]);

    if (!guardResult.succeeded) {
      return Result.fail<Coordinates>(guardResult.message!);
    }

    if (!isFinite(props.latitude)) {
      return Result.fail<Coordinates>(
        'latitude must be a finite number'
      );
    }

    if (!isFinite(props.longitude)) {
      return Result.fail<Coordinates>(
        'longitude must be a finite number'
      );
    }

    const latitudeCheck = Guard.inRange(
      props.latitude,
      -90,
      90,
      'latitude'
    );
    if (!latitudeCheck.succeeded) {
      return Result.fail<Coordinates>(latitudeCheck.message!);
    }

    const longitudeCheck = Guard.inRange(
      props.longitude,
      -180,
      180,
      'longitude'
    );
    if (!longitudeCheck.succeeded) {
      return Result.fail<Coordinates>(longitudeCheck.message!);
    }

    if (props.altitude !== undefined && props.altitude !== null) {
      const altitudeGuard = Guard.isNumber(
        props.altitude,
        'altitude'
      );
      if (!altitudeGuard.succeeded) {
        return Result.fail<Coordinates>(altitudeGuard.message!);
      }
      if (!isFinite(props.altitude)) {
        return Result.fail<Coordinates>(
          'altitude must be a finite number'
        );
      }
    }

    return Result.ok<Coordinates>(
      new Coordinates({
        latitude: props.latitude,
        longitude: props.longitude,
        altitude: props.altitude
      })
    );
  }

  public static reconstitute(props: CoordinatesProps): Coordinates {
    return new Coordinates(props);
  }

  public hasAltitude(): boolean {
    return (
      this._props.altitude !== undefined &&
      this._props.altitude !== null
    );
  }

  public toString(): string {
    if (this.hasAltitude()) {
      return `${this._props.latitude}, ${this._props.longitude}, ${this._props.altitude}m`;
    }
    return `${this._props.latitude}, ${this._props.longitude}`;
  }
}
