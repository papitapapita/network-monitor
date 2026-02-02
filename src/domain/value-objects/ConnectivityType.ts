import {
  ValueObject,
  Result,
  Guard,
  ConnectivityTypeProps
} from '../';

/**
 * ConnectivityType Value Object
 *
 * Represents the physical or logical connection type of a network device.
 * This determines how the device connects to the network infrastructure.
 *
 * Business Rules:
 * - Connectivity type must be one of the predefined valid types
 * - Connectivity type cannot be null or empty
 * - Each connectivity type has specific physical characteristics
 *
 * @example
 * const connectivityResult = ConnectivityType.create('ETHERNET');
 * if (connectivityResult.isSuccess) {
 *   const connectivity = connectivityResult.value;
 *   console.log(connectivity.getDisplayName()); // 'Ethernet'
 *   console.log(connectivity.requiresPhysicalCable()); // true
 * }
 */
export class ConnectivityType extends ValueObject<ConnectivityTypeProps> {
  /**
   * Connectivity type constants for type-safe values
   */
  public static readonly ETHERNET = 'ETHERNET';
  public static readonly FIBER_OPTIC = 'FIBER_OPTIC';
  public static readonly WIRELESS = 'WIRELESS';
  public static readonly DSL = 'DSL';
  public static readonly SATELLITE = 'SATELLITE';
  public static readonly OTHER = 'OTHER';

  /**
   * Valid connectivity type values
   */
  private static readonly VALID_TYPES = [
    ConnectivityType.ETHERNET,
    ConnectivityType.FIBER_OPTIC,
    ConnectivityType.WIRELESS,
    ConnectivityType.DSL,
    ConnectivityType.SATELLITE,
    ConnectivityType.OTHER
  ] as const;

  get value(): string {
    return this._props.value;
  }

  private constructor(_props: ConnectivityTypeProps) {
    super(_props);
  }

  /**
   * Creates a ConnectivityType from a string value.
   *
   * @param type - Connectivity type string
   * @returns Result containing ConnectivityType or error message
   */
  public static create(type: string): Result<ConnectivityType> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(type, 'connectivity type'),
      Guard.isString(type, 'connectivity type')
    ]);

    if (!guardResult.succeeded) {
      return Result.fail<ConnectivityType>(guardResult.message!);
    }

    const trimmedType = type.trim().toUpperCase();

    if (trimmedType.length === 0) {
      return Result.fail<ConnectivityType>(
        'Connectivity type cannot be empty'
      );
    }

    if (!this.isValid(trimmedType)) {
      return Result.fail<ConnectivityType>(
        `Invalid connectivity type: ${type}. Must be one of: ${this.VALID_TYPES.join(', ')}`
      );
    }

    return Result.ok<ConnectivityType>(
      new ConnectivityType({ value: trimmedType })
    );
  }

  /**
   * Factory method to create an ETHERNET connectivity type.
   */
  public static createEthernet(): ConnectivityType {
    return new ConnectivityType({ value: this.ETHERNET });
  }

  /**
   * Factory method to create a FIBER_OPTIC connectivity type.
   */
  public static createFiberOptic(): ConnectivityType {
    return new ConnectivityType({ value: this.FIBER_OPTIC });
  }

  /**
   * Factory method to create a WIRELESS connectivity type.
   */
  public static createWireless(): ConnectivityType {
    return new ConnectivityType({ value: this.WIRELESS });
  }

  /**
   * Factory method to create a DSL connectivity type.
   */
  public static createDsl(): ConnectivityType {
    return new ConnectivityType({ value: this.DSL });
  }

  /**
   * Factory method to create a SATELLITE connectivity type.
   */
  public static createSatellite(): ConnectivityType {
    return new ConnectivityType({ value: this.SATELLITE });
  }

  /**
   * Factory method to create an OTHER connectivity type.
   */
  public static createOther(): ConnectivityType {
    return new ConnectivityType({ value: this.OTHER });
  }

  /**
   * Validates if a string is a valid ConnectivityType.
   */
  public static isValid(value: string): boolean {
    return this.VALID_TYPES.includes(
      value as (typeof this.VALID_TYPES)[number]
    );
  }

  /**
   * Checks if this connectivity type is ETHERNET.
   */
  public isEthernet(): boolean {
    return this._props.value === ConnectivityType.ETHERNET;
  }

  /**
   * Checks if this connectivity type is FIBER_OPTIC.
   */
  public isFiberOptic(): boolean {
    return this._props.value === ConnectivityType.FIBER_OPTIC;
  }

  /**
   * Checks if this connectivity type is WIRELESS.
   */
  public isWireless(): boolean {
    return this._props.value === ConnectivityType.WIRELESS;
  }

  /**
   * Checks if this connectivity type is DSL.
   */
  public isDsl(): boolean {
    return this._props.value === ConnectivityType.DSL;
  }

  /**
   * Checks if this connectivity type is SATELLITE.
   */
  public isSatellite(): boolean {
    return this._props.value === ConnectivityType.SATELLITE;
  }

  /**
   * Checks if this connectivity type is OTHER.
   */
  public isOther(): boolean {
    return this._props.value === ConnectivityType.OTHER;
  }

  /**
   * Checks if this connectivity type requires a physical cable.
   *
   * @returns True for ETHERNET, FIBER_OPTIC, DSL; false otherwise
   */
  public requiresPhysicalCable(): boolean {
    return [
      ConnectivityType.ETHERNET,
      ConnectivityType.FIBER_OPTIC,
      ConnectivityType.DSL
    ].includes(this._props.value);
  }

  /**
   * Checks if this connectivity type is wireless (no physical cable required).
   *
   * @returns True for WIRELESS and SATELLITE; false otherwise
   */
  public isWirelessConnection(): boolean {
    return [
      ConnectivityType.WIRELESS,
      ConnectivityType.SATELLITE
    ].includes(this._props.value);
  }

  /**
   * Gets the typical maximum bandwidth for this connectivity type.
   *
   * @returns Typical maximum bandwidth in Mbps
   */
  public getTypicalMaxBandwidth(): number {
    switch (this._props.value) {
      case ConnectivityType.ETHERNET:
        return 10000; // 10 Gbps
      case ConnectivityType.FIBER_OPTIC:
        return 100000; // 100 Gbps
      case ConnectivityType.WIRELESS:
        return 9600; // Wi-Fi 6E theoretical max
      case ConnectivityType.DSL:
        return 100; // VDSL2 max
      case ConnectivityType.SATELLITE:
        return 500; // Modern satellite internet
      case ConnectivityType.OTHER:
      default:
        return 0; // Unknown
    }
  }

  /**
   * Gets the typical latency range for this connectivity type.
   *
   * @returns Latency range description
   */
  public getTypicalLatency(): string {
    switch (this._props.value) {
      case ConnectivityType.ETHERNET:
        return '< 1ms';
      case ConnectivityType.FIBER_OPTIC:
        return '< 1ms';
      case ConnectivityType.WIRELESS:
        return '1-10ms';
      case ConnectivityType.DSL:
        return '10-50ms';
      case ConnectivityType.SATELLITE:
        return '500-700ms';
      case ConnectivityType.OTHER:
      default:
        return 'Unknown';
    }
  }

  public static validTypes(): string[] {
    return [...ConnectivityType.VALID_TYPES];
  }

  /**
   * Gets a user-friendly display name for this connectivity type.
   *
   * @returns Human-readable name
   */
  public getDisplayName(): string {
    switch (this._props.value) {
      case ConnectivityType.ETHERNET:
        return 'Ethernet';
      case ConnectivityType.FIBER_OPTIC:
        return 'Fiber Optic';
      case ConnectivityType.WIRELESS:
        return 'Wireless';
      case ConnectivityType.DSL:
        return 'DSL';
      case ConnectivityType.SATELLITE:
        return 'Satellite';
      case ConnectivityType.OTHER:
      default:
        return 'Other';
    }
  }

  /**
   * Returns the string representation of the connectivity type.
   */
  public toString(): string {
    return this._props.value;
  }

  // equals() inherited from ValueObject base class
}
