/**
 * Request DTO for activating a DRAFT network device.
 *
 * Used By:
 * - ActivateNetworkDeviceUseCase
 *
 * API Endpoint:
 * - POST /api/devices/:id/activate
 *
 * Business Context:
 * - REQ-002: Activation Workflow
 * - Transitions device from DRAFT to ACTIVE status
 * - Validates all required fields before activation
 * - Sets activatedAt timestamp and activatedBy user
 * - Triggers NetworkDeviceActivatedEvent
 *
 * Validation Rules:
 * - id: Required, valid UUID format
 * - name: Required, 1-100 characters
 * - deviceType: Required, valid device type enum value
 * - description: Optional, max 500 characters
 * - location: Optional, max 500 characters
 * - connectivityType: Optional, default "ETHERNET"
 * - managementProtocol: Optional, default "ICMP"
 * - managementPort: Optional, 1-65535, default 161
 * - enabledRemoteAccess: Optional, boolean, default false
 *
 * Business Rules (enforced by Use Case):
 * - Device must exist and not be soft-deleted
 * - Device must be in DRAFT status (cannot re-activate ACTIVE device)
 * - All required fields must be populated before activation
 * - IP and MAC addresses must be unique (excluding soft-deleted)
 * - activatedBy provided in request context (not in DTO)
 *
 * @example
 * ```json
 * {
 *   "id": "550e8400-e29b-41d4-a716-446655440000",
 *   "name": "Router-Core-01",
 *   "deviceType": "ROUTER",
 *   "description": "Main core router for building A",
 *   "location": "Data Center A, Rack 3, Unit 12",
 *   "connectivityType": "FIBER_OPTIC",
 *   "managementProtocol": "SNMP",
 *   "managementPort": 161,
 *   "enabledRemoteAccess": true
 * }
 * ```
 */
export interface ActivateNetworkDeviceRequestDTO {
  /**
   * Network device unique identifier
   * Required, valid UUID format
   * Device must exist and be in DRAFT status
   */
  id: string;

  /**
   * Device name (required for activation)
   * 1-100 characters
   * Will be validated before activation completes
   */
  name: string;

  /**
   * Device type (required for activation)
   * Valid values: ROUTER, SWITCH, ACCESS_POINT, FIREWALL, SERVER, etc.
   * Used for polling classification and monitoring
   */
  deviceType: string;

  /**
   * Device description (optional)
   * Max 500 characters
   * Can be null
   */
  description?: string | null;

  /**
   * Physical location (optional but recommended)
   * Max 500 characters
   * Example: "Building A, Floor 2, Rack 10, Unit 3"
   */
  location?: string | null;

  /**
   * Connectivity type (optional, has default)
   * Default: "ETHERNET"
   * Valid values: ETHERNET, FIBER_OPTIC, WIRELESS, DSL, SATELLITE, OTHER
   */
  connectivityType?: string;

  /**
   * Management protocol (optional, has default)
   * Default: "ICMP"
   * Valid values: SNMP, SSH, TELNET, HTTP, HTTPS, ICMP, OTHER
   */
  managementProtocol?: string;

  /**
   * Management port (optional, has default)
   * Default: 161 (SNMP)
   * Range: 1-65535
   */
  managementPort?: number;

  /**
   * Enable remote access (optional, has default)
   * Default: false
   */
  enabledRemoteAccess?: boolean;
}
