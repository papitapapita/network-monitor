import {
  ValueObject,
  Result,
  Guard,
  NetworkDeviceTypeProps
} from '../';

/**
 * NetworkDeviceType Value Object
 *
 * Represents a simplified classification of network devices for polling purposes.
 * This is a domain-specific abstraction that combines RadioType and common device types
 * from the database schema for easier polling configuration.
 *
 * Database Mapping:
 * - Maps to NetworkDevice.deviceGroup (DeviceType) in database for high-level categorization
 * - Maps to NetworkDevice.deviceTypes (NetworkDeviceRole[]) for specific capabilities
 * - Combines RadioType for wireless devices with general device categories
 * - Used to determine default polling intervals and device-specific behavior
 *
 * Business Rules:
 * - Device type must be one of the predefined valid types
 * - Device type cannot be null or empty
 * - Each device type has a specific default polling interval
 * - A single network device can have multiple roles/capabilities (deviceTypes array),
 *   but belongs to one primary deviceGroup
 *
 * @example
 * const deviceTypeResult = NetworkDeviceType.createAccessPoint();
 * if (deviceTypeResult.isSuccess) {
 *   const deviceType = deviceTypeResult.value;
 *   console.log(deviceType.getDisplayName()); // 'Access Point'
 *   console.log(deviceType.getDefaultPollingInterval()); // 30
 * }
 */
export class NetworkDeviceType extends ValueObject<NetworkDeviceTypeProps> {
  /**
   * Device type constants for type-safe values
   */
  public static readonly ACCESS_POINT = 'ACCESS_POINT';
  public static readonly STATION = 'STATION';
  public static readonly PTP_RADIO = 'PTP_RADIO';
  public static readonly PTMP_RADIO = 'PTMP_RADIO';
  public static readonly SWITCH = 'SWITCH';
  public static readonly ROUTER = 'ROUTER';
  public static readonly FIREWALL = 'FIREWALL';
  public static readonly SERVER = 'SERVER';
  public static readonly UNKNOWN = 'UNKNOWN';

  /**
   * Valid device type values
   */
  private static readonly VALID_TYPES = [
    NetworkDeviceType.ACCESS_POINT,
    NetworkDeviceType.STATION,
    NetworkDeviceType.PTP_RADIO,
    NetworkDeviceType.PTMP_RADIO,
    NetworkDeviceType.SWITCH,
    NetworkDeviceType.ROUTER,
    NetworkDeviceType.FIREWALL,
    NetworkDeviceType.SERVER,
    NetworkDeviceType.UNKNOWN
  ] as const;

  get value(): string {
    return this._props.value;
  }

  private constructor(_props: NetworkDeviceTypeProps) {
    super(_props);
  }

  /**
   * Creates a NetworkDeviceType from a string value.
   *
   * @param type - Device type string
   * @returns Result containing NetworkDeviceType or error message
   */
  public static create(type: string): Result<NetworkDeviceType> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(type, 'device type'),
      Guard.isString(type, 'device type')
    ]);

    if (!guardResult.succeeded) {
      return Result.fail<NetworkDeviceType>(guardResult.message!);
    }

    const trimmedType = type.trim().toUpperCase();

    if (trimmedType.length === 0) {
      return Result.fail<NetworkDeviceType>(
        'Device type cannot be empty'
      );
    }

    if (!this.isValid(trimmedType)) {
      return Result.fail<NetworkDeviceType>(
        `Invalid device type: ${type}. Must be one of: ${this.VALID_TYPES.join(', ')}`
      );
    }

    return Result.ok<NetworkDeviceType>(
      new NetworkDeviceType({ value: trimmedType })
    );
  }

  /**
   * Creates a NetworkDeviceType from a RadioType string from the database.
   *
   * @param radioType - RadioType enum value from database
   * @returns Result containing NetworkDeviceType or UNKNOWN if not mappable
   */
  public static fromRadioType(
    radioType: string
  ): Result<NetworkDeviceType> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(radioType, 'radio type'),
      Guard.isString(radioType, 'radio type')
    ]);

    if (!guardResult.succeeded) {
      return Result.fail<NetworkDeviceType>(guardResult.message!);
    }

    const upperRadioType = radioType.trim().toUpperCase();
    let deviceType: NetworkDeviceType;
    switch (upperRadioType) {
      case 'ACCESS_POINT':
        deviceType = NetworkDeviceType.createAccessPoint();
        break;
      case 'STATION':
        deviceType = NetworkDeviceType.createStation();
        break;
      case 'PTMP_RADIO':
      case 'SECTOR_ANTENNA':
        deviceType = NetworkDeviceType.createPtmpRadio(); // Treat as PTMP for polling
        break;
      case 'PTP_RADIO':
      case 'BACKHAUL_RADIO':
      case 'MIMO_RADIO':
        deviceType = NetworkDeviceType.createPtpRadio(); // Treat as PTP for polling
        break;
      default:
        deviceType = NetworkDeviceType.createUnknown();
    }
    return Result.ok<NetworkDeviceType>(deviceType);
  }

  /**
   * Creates a NetworkDeviceType from a NetworkDeviceRole string from the database.
   *
   * Note: Since a NetworkDevice can have multiple deviceTypes (roles), this function
   * maps a single role to its corresponding polling type. For devices with multiple roles,
   * the primary role should be used to determine the polling configuration.
   *
   * @param role - NetworkDeviceRole enum value from database (from deviceTypes array)
   * @returns Result containing NetworkDeviceType for polling purposes
   */
  public static fromNetworkDeviceRole(
    role: string
  ): Result<NetworkDeviceType> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(role, 'network device role'),
      Guard.isString(role, 'network device role')
    ]);

    if (!guardResult.succeeded) {
      return Result.fail<NetworkDeviceType>(guardResult.message!);
    }

    const upperRole = role.trim().toUpperCase();

    let deviceType: NetworkDeviceType;
    switch (upperRole) {
      case 'ROUTING':
        deviceType = NetworkDeviceType.createRouter();
        break;
      case 'SWITCHING':
        deviceType = NetworkDeviceType.createSwitch();
        break;
      case 'WIRELESS_ACCESS':
        deviceType = NetworkDeviceType.createAccessPoint();
        break;
      case 'WIRELESS_CONTROLLER':
      case 'WIRELESS_BRIDGE':
      case 'RADIO_LINK':
      case 'BACKHAUL':
        deviceType = NetworkDeviceType.createPtpRadio();
        break;
      case 'FIREWALL':
      case 'IDS':
      case 'IPS':
      case 'UTM':
        deviceType = NetworkDeviceType.createFirewall();
        break;
      case 'APPLICATION_HOSTING':
      case 'DATABASE_HOSTING':
      case 'PROXY':
      case 'DHCP':
      case 'DNS':
      case 'LOAD_BALANCING':
        deviceType = NetworkDeviceType.createServer();
        break;
      default:
        deviceType = NetworkDeviceType.createUnknown();
        break;
    }
    return Result.ok<NetworkDeviceType>(deviceType);
  }

  /**
   * Factory method to create an ACCESS_POINT device type.
   */
  public static createAccessPoint(): NetworkDeviceType {
    return new NetworkDeviceType({ value: this.ACCESS_POINT });
  }

  /**
   * Factory method to create a STATION device type.
   */
  public static createStation(): NetworkDeviceType {
    return new NetworkDeviceType({ value: this.STATION });
  }

  /**
   * Factory method to create a PTP_RADIO device type.
   */
  public static createPtpRadio(): NetworkDeviceType {
    return new NetworkDeviceType({ value: this.PTP_RADIO });
  }

  /**
   * Factory method to create a PTMP_RADIO device type.
   */
  public static createPtmpRadio(): NetworkDeviceType {
    return new NetworkDeviceType({ value: this.PTMP_RADIO });
  }

  /**
   * Factory method to create a SWITCH device type.
   */
  public static createSwitch(): NetworkDeviceType {
    return new NetworkDeviceType({ value: this.SWITCH });
  }

  /**
   * Factory method to create a ROUTER device type.
   */
  public static createRouter(): NetworkDeviceType {
    return new NetworkDeviceType({ value: this.ROUTER });
  }

  /**
   * Factory method to create a FIREWALL device type.
   */
  public static createFirewall(): NetworkDeviceType {
    return new NetworkDeviceType({ value: this.FIREWALL });
  }

  /**
   * Factory method to create a SERVER device type.
   */
  public static createServer(): NetworkDeviceType {
    return new NetworkDeviceType({ value: this.SERVER });
  }

  /**
   * Factory method to create an UNKNOWN device type.
   */
  public static createUnknown(): NetworkDeviceType {
    return new NetworkDeviceType({ value: this.UNKNOWN });
  }

  /**
   * Validates if a string is a valid NetworkDeviceType.
   */
  public static isValid(value: string): boolean {
    return this.VALID_TYPES.includes(
      value as (typeof this.VALID_TYPES)[number]
    );
  }

  /**
   * Checks if this device type is an ACCESS_POINT.
   */
  public isAccessPoint(): boolean {
    return this._props.value === NetworkDeviceType.ACCESS_POINT;
  }

  /**
   * Checks if this device type is a STATION.
   */
  public isStation(): boolean {
    return this._props.value === NetworkDeviceType.STATION;
  }

  /**
   * Checks if this device type is a PTP_RADIO.
   */
  public isPtpRadio(): boolean {
    return this._props.value === NetworkDeviceType.PTP_RADIO;
  }

  /**
   * Checks if this device type is a PTMP_RADIO.
   */
  public isPtmpRadio(): boolean {
    return this._props.value === NetworkDeviceType.PTMP_RADIO;
  }

  /**
   * Checks if this device type is a SWITCH.
   */
  public isSwitch(): boolean {
    return this._props.value === NetworkDeviceType.SWITCH;
  }

  /**
   * Checks if this device type is a ROUTER.
   */
  public isRouter(): boolean {
    return this._props.value === NetworkDeviceType.ROUTER;
  }

  /**
   * Checks if this device type is a FIREWALL.
   */
  public isFirewall(): boolean {
    return this._props.value === NetworkDeviceType.FIREWALL;
  }

  /**
   * Checks if this device type is a SERVER.
   */
  public isServer(): boolean {
    return this._props.value === NetworkDeviceType.SERVER;
  }

  /**
   * Checks if this device type is UNKNOWN.
   */
  public isUnknown(): boolean {
    return this._props.value === NetworkDeviceType.UNKNOWN;
  }

  /**
   * Gets the default polling interval in seconds for this device type.
   *
   * Default intervals by device type:
   * - ACCESS_POINT: 30 seconds - APs are critical infrastructure
   * - STATION: 300 seconds (5 minutes) - client devices polled less frequently
   * - PTP_RADIO/PTMP_RADIO: 60 seconds - radio links need regular monitoring
   * - SWITCH/ROUTER/FIREWALL: 60 seconds - standard infrastructure
   * - SERVER: 120 seconds - servers polled less frequently
   * - UNKNOWN: 60 seconds - default for unknown devices
   *
   * @returns Default polling interval in seconds
   */
  public getDefaultPollingInterval(): number {
    switch (this._props.value) {
      case NetworkDeviceType.ACCESS_POINT:
        return 30;
      case NetworkDeviceType.STATION:
        return 300;
      case NetworkDeviceType.PTP_RADIO:
      case NetworkDeviceType.PTMP_RADIO:
        return 60;
      case NetworkDeviceType.SWITCH:
      case NetworkDeviceType.ROUTER:
      case NetworkDeviceType.FIREWALL:
        return 60;
      case NetworkDeviceType.SERVER:
        return 120;
      case NetworkDeviceType.UNKNOWN:
      default:
        return 60;
    }
  }

  public static validTypes(): string[] {
    return [...NetworkDeviceType.VALID_TYPES];
  }

  /**
   * Gets a user-friendly display name for this device type.
   *
   * @returns Human-readable name
   */
  public getDisplayName(): string {
    switch (this._props.value) {
      case NetworkDeviceType.ACCESS_POINT:
        return 'Access Point';
      case NetworkDeviceType.STATION:
        return 'Station';
      case NetworkDeviceType.PTP_RADIO:
        return 'PTP Radio';
      case NetworkDeviceType.PTMP_RADIO:
        return 'PTMP Radio';
      case NetworkDeviceType.SWITCH:
        return 'Switch';
      case NetworkDeviceType.ROUTER:
        return 'Router';
      case NetworkDeviceType.FIREWALL:
        return 'Firewall';
      case NetworkDeviceType.SERVER:
        return 'Server';
      case NetworkDeviceType.UNKNOWN:
      default:
        return 'Unknown';
    }
  }

  /**
   * Returns the string representation of the device type.
   */
  public toString(): string {
    return this._props.value;
  }

  // equals() inherited from ValueObject base class
}
