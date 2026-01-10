import { PollingConfigurationResponseDTO } from '../polling/PollingConfigurationResponseDTO';

/**
 * Response DTO for network device.
 *
 * Returned By:
 * - GetNetworkDeviceUseCase
 * - CreateNetworkDeviceUseCase
 * - UpdateNetworkDeviceUseCase
 * - ActivateNetworkDeviceUseCase
 * - RestoreNetworkDeviceUseCase
 * - ListNetworkDevicesUseCase
 *
 * API Endpoints:
 * - GET /api/devices/:id
 * - POST /api/devices
 * - PATCH /api/devices/:id
 * - POST /api/devices/:id/activate
 * - POST /api/devices/:id/restore
 * - GET /api/devices
 *
 * Complete device information including REQ-002 lifecycle fields.
 *
 * @example
 * ```json
 * {
 *   "id": "device-uuid-123",
 *   "name": "Router-Core-01",
 *   "deviceType": "ROUTER",
 *   "status": "ONLINE",
 *   "ipAddress": "192.168.1.1",
 *   "macAddress": "AA:BB:CC:DD:EE:FF",
 *   "activationStatus": "ACTIVE",
 *   "activatedAt": "2024-01-15T10:30:00Z",
 *   "activatedBy": "admin@example.com",
 *   "location": "Data Center A, Rack 3",
 *   "version": 5,
 *   "createdAt": "2024-01-01T08:00:00Z",
 *   "updatedAt": "2024-01-15T14:25:00Z",
 *   "pollingConfiguration": {
 *     "id": "polling-config-uuid-xyz",
 *     "networkDeviceId": "device-uuid-123",
 *     "enabled": true,
 *     "intervalSeconds": 60,
 *     "pingCount": 4,
 *     "retryPolicy": {
 *       "maxAttempts": 3,
 *       "baseDelayMs": 1000
 *     },
 *     "lastScheduledAt": "2024-01-15T14:20:00Z",
 *     "nextScheduledAt": "2024-01-15T14:21:00Z"
 *   }
 * }
 * ```
 */
export interface NetworkDeviceResponseDTO {
  // ===================================
  // CORE IDENTIFICATION
  // ===================================

  /**
   * Device unique identifier (UUID)
   */
  id: string;

  /**
   * Human-readable device name
   */
  name: string;

  /**
   * Device type classification
   * Values: ROUTER, SWITCH, ACCESS_POINT, FIREWALL, SERVER, etc.
   */
  deviceType: string;

  /**
   * Current operational status
   * Values: ONLINE, OFFLINE, MAINTENANCE
   */
  status: string;

  /**
   * IP address in dotted decimal notation
   */
  ipAddress: string;

  /**
   * MAC address
   */
  macAddress: string;

  /**
   * Device description (may be null)
   */
  description: string | null;

  /**
   * Device reference ID (physical device)
   */
  deviceId: string;

  // ===================================
  // REQ-002: LIFECYCLE MANAGEMENT
  // ===================================

  /**
   * REQ-002: Activation workflow status
   * Values: DRAFT, ACTIVE
   *
   * - DRAFT: Device with minimal info (discovery/enrichment phase)
   * - ACTIVE: Fully configured and operational device
   */
  activationStatus: string;

  /**
   * REQ-002: When device was activated (ISO 8601)
   * Null if device is still in DRAFT status
   */
  activatedAt: string | null;

  /**
   * REQ-002: User/system who activated the device
   * Null if device is still in DRAFT status
   * Example: "admin@example.com" or "system:auto-discovery"
   */
  activatedBy: string | null;

  /**
   * REQ-002: Soft delete timestamp (ISO 8601)
   * Null if device is not deleted
   * Used for 7-day grace period before permanent deletion
   */
  deletedAt: string | null;

  /**
   * REQ-002: User/system who soft-deleted the device
   * Null if device is not deleted
   */
  deletedBy: string | null;

  /**
   * REQ-002: ID of device that replaced this one
   * Null if device was not replaced
   * Used for device replacement tracking
   */
  replacedByDeviceId: string | null;

  /**
   * REQ-002: When device was replaced (ISO 8601)
   * Null if device was not replaced
   */
  replacedAt: string | null;
  // ===================================
  // NETWORK CONFIGURATION
  // ===================================

  /**
   * Installation date (ISO 8601)
   */
  installDate: string;

  /**
   * Connectivity type
   * Values: ETHERNET, FIBER_OPTIC, WIRELESS, DSL, SATELLITE, OTHER
   */
  connectivityType: string;

  /**
   * Management protocol
   * Values: SNMP, SSH, TELNET, HTTP, HTTPS, OTHER
   */
  managementProtocol: string;

  /**
   * Management port number
   */
  managementPort: number;

  /**
   * Whether remote access is enabled
   */
  enabledRemoteAccess: boolean;

  // ===================================
  // NESTED CONFIGURATION
  // ===================================

  /**
   * Polling configuration details
   * Includes interval, ping count, retry policy, and scheduling information
   * See PollingConfigurationResponseDTO for complete field documentation
   */
  pollingConfiguration: PollingConfigurationResponseDTO;

  // ===================================
  // TIMESTAMPS
  // ===================================

  /**
   * When entity was created (ISO 8601)
   */
  createdAt: string;

  /**
   * When entity was last updated (ISO 8601)
   */
  updatedAt: string;
}
