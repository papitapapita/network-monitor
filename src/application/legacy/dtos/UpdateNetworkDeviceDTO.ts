/**
 * Request DTO for updating an existing network device.
 *
 * Used By: UpdateNetworkDeviceUseCase
 * API Endpoint: PATCH /api/devices/:id
 *
 * All fields are optional for partial updates.
 *
 * REQ-002: Immutable Fields
 * - ipAddress: Cannot be changed (unique identifier)
 * - macAddress: Cannot be changed (unique identifier)
 * - deviceId: Cannot be changed (hardware reference)
 * - activationStatus: Use ActivateNetworkDeviceUseCase instead
 * - deletedAt/deletedBy: Use SoftDeleteNetworkDeviceUseCase instead
 * - replacedByDeviceId: Managed by device replacement workflow
 *
 * Validation Rules:
 * - name: 1-100 characters if provided
 * - description: max 500 characters if provided
 * - location: max 500 characters if provided
 * - deviceType: valid enum value if provided
 * - Device must be in ACTIVE status to be updated
 * - Device must not be soft-deleted
 *
 * @example
 * ```json
 * {
 *   "name": "Router-Core-02-Updated",
 *   "description": "Updated description",
 *   "location": "New Data Center, Rack 5"
 * }
 * ```
 */
export interface UpdateNetworkDeviceDTO {
  /**
   * New device name
   * Optional
   * 1-100 characters
   */
  name?: string;

  /**
   * New description
   * Optional
   * Max 500 characters
   * Can be null to clear existing description
   */
  description?: string | null;

  /**
   * New device type
   * Optional
   * Valid values: ROUTER, SWITCH, ACCESS_POINT, FIREWALL, SERVER, etc.
   */
  deviceType?: string;

  /**
   * REQ-002: New physical location
   * Optional
   * Max 500 characters
   * Can be null to clear existing location
   * Example: "Building A, Floor 2, Rack 10"
   */
  location?: string | null;

  /**
   * New connectivity type
   * Optional
   * Valid values: ETHERNET, FIBER_OPTIC, WIRELESS, DSL, SATELLITE, OTHER
   */
  connectivityType?: string;

  /**
   * New management protocol
   * Optional
   * Valid values: SNMP, SSH, TELNET, HTTP, HTTPS, OTHER
   */
  managementProtocol?: string;

  /**
   * New management port
   * Optional
   * Range: 1-65535
   */
  managementPort?: number;

  /**
   * Enable/disable remote access
   * Optional
   */
  enabledRemoteAccess?: boolean;
}
