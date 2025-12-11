/**
 * DTO for updating an existing network device.
 *
 * All fields are optional for partial updates.
 * Note: IP and MAC addresses cannot be changed (immutable).
 */
export interface UpdateNetworkDeviceDTO {
  /** New device name */
  name?: string;

  /** New description (can be null to clear) */
  description?: string | null;

  /** New device type */
  deviceType?: string;

  /** New connectivity type */
  connectivityType?: string;

  /** New management protocol */
  managementProtocol?: string;

  /** New management port */
  managementPort?: number;

  /** Enable/disable remote access */
  enabledRemoteAccess?: boolean;
}
