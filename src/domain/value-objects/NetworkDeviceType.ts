/**
 * NetworkDeviceType Enum
 *
 * Represents a simplified classification of network devices for polling purposes.
 * This is a domain-specific abstraction that combines RadioType and common device types
 * from the database schema for easier polling configuration.
 *
 * Database Mapping:
 * - Maps to NetworkDevice.type (NetworkDeviceRole) in database
 * - Combines RadioType for wireless devices with general device categories
 * - Used to determine default polling intervals and device-specific behavior
 *
 * @example
 * const deviceType = NetworkDeviceType.ACCESS_POINT;
 */

export enum NetworkDeviceType {
  /**
   * Wireless Access Point (from RadioType.ACCESS_POINT)
   * Database Role: WIRELESS_ACCESS
   * Default polling interval: 30 seconds
   */
  ACCESS_POINT = 'ACCESS_POINT',

  /**
   * Client device/station connecting to network (from RadioType.STATION)
   * Database Role: WIRELESS_ACCESS (as client)
   * Default polling interval: 300 seconds (5 minutes)
   */
  STATION = 'STATION',

  /**
   * Point-to-Point radio link (from RadioType.PTP_RADIO)
   * Database Role: WIRELESS_BRIDGE or RADIO_LINK
   * Default polling interval: 60 seconds
   */
  PTP_RADIO = 'PTP_RADIO',

  /**
   * Point-to-Multipoint radio - base station (from RadioType.PTMP_RADIO)
   * Database Role: WIRELESS_CONTROLLER or BACKHAUL
   * Default polling interval: 60 seconds
   */
  PTMP_RADIO = 'PTMP_RADIO',

  /**
   * Network switch (from DeviceType.SWITCH)
   * Database Role: SWITCHING
   * Default polling interval: 60 seconds
   */
  SWITCH = 'SWITCH',

  /**
   * Network router (from DeviceType.ROUTER)
   * Database Role: ROUTING
   * Default polling interval: 60 seconds
   */
  ROUTER = 'ROUTER',

  /**
   * Firewall device (from DeviceType.FIREWALL)
   * Database Role: FIREWALL, IDS, IPS, or UTM
   * Default polling interval: 60 seconds
   */
  FIREWALL = 'FIREWALL',

  /**
   * Server device (from DeviceType.SERVER)
   * Database Role: APPLICATION_HOSTING, DATABASE_HOSTING, DHCP, DNS, etc.
   * Default polling interval: 120 seconds
   */
  SERVER = 'SERVER',

  /**
   * Unknown or unclassified device type
   * Database Role: Any
   * Default polling interval: 60 seconds
   */
  UNKNOWN = 'UNKNOWN'
}

/**
 * Helper function to get the default polling interval in seconds for a device type.
 *
 * @param deviceType - The type of network device
 * @returns Default polling interval in seconds
 */
export function getDefaultPollingInterval(
  deviceType: NetworkDeviceType
): number {
  switch (deviceType) {
    case NetworkDeviceType.ACCESS_POINT:
      return 30; // 30 seconds - APs are critical infrastructure
    case NetworkDeviceType.STATION:
      return 300; // 5 minutes - client devices polled less frequently
    case NetworkDeviceType.PTP_RADIO:
    case NetworkDeviceType.PTMP_RADIO:
      return 60; // 1 minute - radio links need regular monitoring
    case NetworkDeviceType.SWITCH:
    case NetworkDeviceType.ROUTER:
    case NetworkDeviceType.FIREWALL:
      return 60; // 1 minute - standard infrastructure
    case NetworkDeviceType.SERVER:
      return 120; // 2 minutes - servers polled less frequently
    case NetworkDeviceType.UNKNOWN:
    default:
      return 60; // 1 minute - default for unknown devices
  }
}

/**
 * Maps RadioType from database to domain NetworkDeviceType.
 *
 * @param radioType - RadioType enum value from database
 * @returns Corresponding NetworkDeviceType
 */
export function fromRadioType(radioType: string): NetworkDeviceType {
  switch (radioType) {
    case 'ACCESS_POINT':
      return NetworkDeviceType.ACCESS_POINT;
    case 'STATION':
      return NetworkDeviceType.STATION;
    case 'PTP_RADIO':
      return NetworkDeviceType.PTP_RADIO;
    case 'PTMP_RADIO':
      return NetworkDeviceType.PTMP_RADIO;
    case 'SECTOR_ANTENNA':
    case 'BACKHAUL_RADIO':
    case 'MIMO_RADIO':
      return NetworkDeviceType.PTP_RADIO; // Treat as PTP for polling
    default:
      return NetworkDeviceType.UNKNOWN;
  }
}

/**
 * Maps NetworkDeviceRole from database to domain NetworkDeviceType.
 *
 * @param role - NetworkDeviceRole enum value from database
 * @returns Corresponding NetworkDeviceType
 */
export function fromNetworkDeviceRole(role: string): NetworkDeviceType {
  switch (role) {
    case 'ROUTING':
      return NetworkDeviceType.ROUTER;
    case 'SWITCHING':
      return NetworkDeviceType.SWITCH;
    case 'WIRELESS_ACCESS':
      return NetworkDeviceType.ACCESS_POINT;
    case 'WIRELESS_CONTROLLER':
    case 'WIRELESS_BRIDGE':
    case 'RADIO_LINK':
    case 'BACKHAUL':
      return NetworkDeviceType.PTP_RADIO;
    case 'FIREWALL':
    case 'IDS':
    case 'IPS':
    case 'UTM':
      return NetworkDeviceType.FIREWALL;
    case 'APPLICATION_HOSTING':
    case 'DATABASE_HOSTING':
    case 'PROXY':
    case 'DHCP':
    case 'DNS':
    case 'LOAD_BALANCING':
      return NetworkDeviceType.SERVER;
    default:
      return NetworkDeviceType.UNKNOWN;
  }
}

/**
 * Validates if a string is a valid NetworkDeviceType.
 *
 * @param value - String value to validate
 * @returns True if valid, false otherwise
 */
export function isValidNetworkDeviceType(value: string): boolean {
  return Object.values(NetworkDeviceType).includes(value as NetworkDeviceType);
}

/**
 * Gets a user-friendly display name for a device type.
 *
 * @param deviceType - The device type enum value
 * @returns Human-readable name
 */
export function getDeviceTypeDisplayName(
  deviceType: NetworkDeviceType
): string {
  switch (deviceType) {
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
