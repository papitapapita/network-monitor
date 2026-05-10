/**
 * Request DTO for registering a new physical device in the inventory.
 *
 * Used By: CreateDeviceUseCase
 * API Endpoint: POST /api/devices
 *
 * Validation Rules:
 * - deviceModelId: Required, valid UUID — references the device model/catalogue entry.
 * - name: Required, 1–150 characters.
 * - ownerType: Optional, one of: COMPANY, CLIENT.
 * - status: Optional, one of: INVENTORY, ACTIVE, MAINTENANCE, DAMAGED, DECOMMISSIONED.
 *           Defaults to INVENTORY when omitted.
 * - category: Optional, one of: CORE, DISTRIBUTION, POE, ACCESS_POINT, CLIENT_CPE.
 * - locationId: Optional, valid UUID — assigns the device to a location.
 * - serialNumber: Optional, max 100 characters.
 * - macAddress: Optional, format AA:BB:CC:DD:EE:FF or AA-BB-CC-DD-EE-FF. Must be unique.
 * - ipAddress: Optional, valid IPv4 or IPv6 address. Must be unique.
 * - description: Optional, free-text.
 * - installedDate: Optional, ISO 8601 date string.
 * - monitoringEnabled: Optional, defaults to false.
 *
 * @example Minimal
 * ```json
 * {
 *   "deviceModelId": "550e8400-e29b-41d4-a716-446655440000",
 *   "name": "Core-Router-01",
 *   "ownerType": "COMPANY"
 * }
 * ```
 *
 * @example Full
 * ```json
 * {
 *   "deviceModelId": "550e8400-e29b-41d4-a716-446655440000",
 *   "name": "Core-Router-01",
 *   "ownerType": "COMPANY",
 *   "status": "ACTIVE",
 *   "category": "CORE",
 *   "locationId": "550e8400-e29b-41d4-a716-446655440001",
 *   "serialNumber": "SN-2024-XYZ-001",
 *   "macAddress": "AA:BB:CC:DD:EE:FF",
 *   "ipAddress": "192.168.1.1",
 *   "description": "Primary core router for the main datacenter",
 *   "installedDate": "2024-01-15T00:00:00.000Z",
 *   "monitoringEnabled": true
 * }
 * ```
 */
export interface CreateDeviceRequestDTO {
  // ===================================
  // REQUIRED FIELDS
  // ===================================

  /**
   * UUID of the device model / catalogue entry this device is based on.
   * Required, must be a valid UUID.
   */
  deviceModelId: string;

  /**
   * Human-readable name for this device instance.
   * Required, 1–150 characters.
   */
  name: string;

  /**
   * Indicates who owns this device.
   * Optional. Valid values: COMPANY, CLIENT.
   */
  ownerType?: string;

  // ===================================
  // OPTIONAL CLASSIFICATION
  // ===================================

  /**
   * Operational lifecycle status.
   * Optional. Valid values: INVENTORY, ACTIVE, MAINTENANCE, DAMAGED, DECOMMISSIONED.
   * Defaults to INVENTORY when omitted.
   */
  status?: string;

  /**
   * Network role / hardware category of the device.
   * Optional. Valid values: CORE, DISTRIBUTION, POE, ACCESS_POINT, CLIENT_CPE.
   */
  category?: string | null;

  // ===================================
  // OPTIONAL ASSIGNMENT
  // ===================================

  /**
   * UUID of the location where the device is physically installed.
   * Optional. Must be a valid UUID when provided.
   */
  locationId?: string | null;

  // ===================================
  // OPTIONAL IDENTITY
  // ===================================

  /**
   * Manufacturer-assigned serial number.
   * Optional, max 100 characters.
   */
  serialNumber?: string | null;

  /**
   * MAC address of the device's primary network interface.
   * Optional. Format: AA:BB:CC:DD:EE:FF or AA-BB-CC-DD-EE-FF.
   * Must be unique across all devices.
   */
  macAddress?: string | null;

  /**
   * IP address assigned to the device.
   * Optional. Valid IPv4 or IPv6 address.
   * Must be unique across all devices.
   */
  ipAddress?: string | null;

  /**
   * Free-text description of the device.
   * Optional.
   */
  description?: string | null;

  // ===================================
  // OPTIONAL LIFECYCLE
  // ===================================

  /**
   * Date when the device was physically installed at its location.
   * Optional. ISO 8601 date string (e.g. "2024-01-15T00:00:00.000Z").
   */
  installedDate?: string | null;

  /**
   * Whether ICMP/SNMP monitoring is active for this device.
   * Optional. Defaults to false.
   */
  monitoringEnabled?: boolean;
}
