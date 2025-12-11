/**
 * DTO for creating a new network device.
 *
 * Required fields: ipAddress, name, deviceType, macAddress, deviceId
 * Optional fields: description, location, connectivity, management settings, ping test
 */
export interface CreateNetworkDeviceDTO {
  /** IP address in dotted decimal notation (e.g., "192.168.1.1") */
  ipAddress: string;

  /** Human-readable device name (e.g., "Router-Core-01") */
  name: string;

  /** Device type for polling classification (e.g., "ROUTER", "SWITCH", "ACCESS_POINT") */
  deviceType: string;

  /** MAC address in colon or hyphen format (e.g., "AA:BB:CC:DD:EE:FF") */
  macAddress: string;

  /** UUID reference to the Device entity in the database */
  deviceId: string;

  /** Optional description of the device */
  description?: string | null;

  /** Optional physical location */
  location?: string | null;

  /** Connectivity type (default: "ETHERNET") */
  connectivityType?: string;

  /** Management protocol (default: "ICMP") */
  managementProtocol?: string;

  /** Management port number (default: 161 for SNMP) */
  managementPort?: number;

  /** Whether remote access is enabled (default: false) */
  enabledRemoteAccess?: boolean;

  /** Whether to perform ping test during creation (default: false, non-blocking) */
  performPingTest?: boolean;
}
