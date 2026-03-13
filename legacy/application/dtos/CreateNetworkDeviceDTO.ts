/**
 * Request DTO for creating a new network device.
 *
 * Used By: CreateNetworkDeviceUseCase
 * API Endpoint: POST /api/devices
 *
 * REQ-002: Supports two creation modes:
 * 1. DRAFT Mode (Discovery/Enrichment):
 *    - Required: ipAddress, macAddress, deviceId only
 *    - Optional: All other fields
 *    - Device created with activationStatus = DRAFT
 *    - Can be enriched and activated later
 *
 * 2. ACTIVE Mode (Full Creation):
 *    - Required: ipAddress, macAddress, deviceId, name, deviceType
 *    - Optional: All other fields
 *    - Device validated and created with activationStatus = ACTIVE
 *    - activatedBy set automatically from request context
 *
 * Validation Rules:
 * - ipAddress: Required, valid IPv4 format, unique (excluding soft-deleted)
 * - macAddress: Required, valid MAC format, unique (excluding soft-deleted)
 * - deviceId: Required, valid UUID, references Device entity
 * - name: Optional for DRAFT, required for ACTIVE, 1-100 characters
 * - deviceType: Optional for DRAFT, required for ACTIVE
 * - description: Optional, max 500 characters
 * - location: Optional, max 500 characters
 * - activateImmediately: Optional boolean, default false (creates DRAFT)
 *
 * @example DRAFT mode
 * ```json
 * {
 *   "ipAddress": "192.168.1.100",
 *   "macAddress": "00:11:22:33:44:55",
 *   "deviceId": "device-uuid-here"
 * }
 * ```
 *
 * @example ACTIVE mode
 * ```json
 * {
 *   "ipAddress": "192.168.1.1",
 *   "macAddress": "AA:BB:CC:DD:EE:FF",
 *   "deviceId": "device-uuid-here",
 *   "name": "Router-Core-01",
 *   "deviceType": "ROUTER",
 *   "description": "Main core router",
 *   "location": "Data Center Rack 3",
 *   "activateImmediately": true
 * }
 * ```
 */
export interface CreateNetworkDeviceDTO {
  // ===================================
  // REQUIRED FIELDS (Always)
  // ===================================

  /**
   * IP address in dotted decimal notation
   * Required, unique (excluding soft-deleted devices)
   * Example: "192.168.1.1"
   */
  ipAddress: string;

  /**
   * MAC address in colon or hyphen format
   * Required, unique (excluding soft-deleted devices)
   * Example: "AA:BB:CC:DD:EE:FF" or "AA-BB-CC-DD-EE-FF"
   */
  macAddress: string;

  /**
   * UUID reference to the Device entity in the database
   * Required, must exist in Device table
   */
  deviceId: string;

  // ===================================
  // CONDITIONAL FIELDS (Required for ACTIVE)
  // ===================================

  /**
   * Human-readable device name
   * Optional for DRAFT mode
   * Required for ACTIVE mode
   * 1-100 characters
   * Example: "Router-Core-01"
   */
  name?: string;

  /**
   * Device type for polling classification
   * Optional for DRAFT mode
   * Required for ACTIVE mode
   * Valid values: ROUTER, SWITCH, ACCESS_POINT, FIREWALL, SERVER, etc.
   */
  deviceType?: string;

  // ===================================
  // OPTIONAL FIELDS
  // ===================================

  /**
   * Description of the device
   * Optional
   * Max 500 characters
   */
  description?: string | null;

  /**
   * Connectivity type
   * Optional
   * Default: "ETHERNET"
   * Valid values: ETHERNET, FIBER_OPTIC, WIRELESS, DSL, SATELLITE, OTHER
   */
  connectivityType?: string;

  /**
   * Management protocol
   * Optional
   * Default: "ICMP"
   * Valid values: SNMP, SSH, TELNET, HTTP, HTTPS, OTHER
   */
  managementProtocol?: string;

  /**
   * Management port number
   * Optional
   * Default: 161 (SNMP)
   * Range: 1-65535
   */
  managementPort?: number;

  /**
   * Whether remote access is enabled
   * Optional
   * Default: false
   */
  enabledRemoteAccess?: boolean;

  // ===================================
  // REQ-002: ACTIVATION CONTROL
  // ===================================

  /**
   * REQ-002: Whether to activate the device immediately
   * Optional
   * Default: false (creates device in DRAFT status)
   *
   * - false: Device created with DRAFT status (minimal validation)
   * - true: Device validated fully and created with ACTIVE status
   *
   * Note: If true, name and deviceType become required
   */
  activateImmediately?: boolean;

  // ===================================
  // OPTIONAL OPERATIONAL FIELDS
  // ===================================

  /**
   * Whether to perform ping test during creation
   * Optional
   * Default: false
   * Non-blocking operation
   */
  performPingTest?: boolean;

  /**
   * Installation date of the device
   * Optional
   * Default: current date
   */
  installDate?: string;
}
