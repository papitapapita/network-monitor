import { ValueObject, Result, Guard } from '../../shared/core';
import { CoordinatesProps } from '../props';

// WGS-84 decimal degrees. Lat and lon are always paired — one without the
// other is an invariant violation enforced by CoordinatesProps structure.
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
