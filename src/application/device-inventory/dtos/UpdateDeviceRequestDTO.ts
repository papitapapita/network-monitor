/**
 * Request DTO for updating an existing physical device in the inventory.
 *
 * Used By: UpdateDeviceUseCase
 * API Endpoint: PATCH /api/devices/:id
 *
 * Validation Rules:
 * - id: Required, valid UUID — the device to update.
 * - name: Optional, 1–150 characters.
 * - status: Optional, one of: INVENTORY, ACTIVE, MAINTENANCE, DAMAGED, DECOMMISSIONED.
 *           Decommissioned devices cannot change status (terminal state).
 * - category: Optional, one of: CORE, DISTRIBUTION, POE, ACCESS_POINT, CLIENT_CPE.
 *             Pass null to clear the current category.
 * - ownerType: Optional, one of: COMPANY, CLIENT.
 * - locationId: Optional, valid UUID to assign the device to a location.
 *               Pass null to unassign the device from its current location.
 * - serialNumber: Optional, max 100 characters. Pass null to clear.
 * - macAddress: Optional, format AA:BB:CC:DD:EE:FF or AA-BB-CC-DD-EE-FF.
 *               Must be unique across all devices. Pass null to clear.
 * - ipAddress: Optional, valid IPv4 or IPv6 address. Must be unique across all devices.
 *              Pass null to clear.
 * - description: Optional, free-text. Pass null to clear.
 * - installedDate: Optional, ISO 8601 date string. Pass null to clear.
 * - monitoringEnabled: Optional. true enables monitoring, false disables it.
 *
 * Only the fields present in the request are applied; omitted fields are left unchanged
 * (PATCH semantics).
 *
 * @example Minimal (only required field)
 * ```json
 * {
 *   "id": "550e8400-e29b-41d4-a716-446655440000"
 * }
 * ```
 *
 * @example Partial update — change status and assign a location
 * ```json
 * {
 *   "id": "550e8400-e29b-41d4-a716-446655440000",
 *   "status": "ACTIVE",
 *   "locationId": "550e8400-e29b-41d4-a716-446655440001"
 * }
 * ```
 *
 * @example Full update
 * ```json
 * {
 *   "id": "550e8400-e29b-41d4-a716-446655440000",
 *   "name": "Core-Router-01-Updated",
 *   "status": "MAINTENANCE",
 *   "category": "CORE",
 *   "ownerType": "COMPANY",
 *   "locationId": "550e8400-e29b-41d4-a716-446655440001",
 *   "serialNumber": "SN-2024-XYZ-001",
 *   "macAddress": "AA:BB:CC:DD:EE:FF",
 *   "ipAddress": "192.168.1.1",
 *   "description": "Updated description for core router",
 *   "installedDate": "2024-01-15T00:00:00.000Z",
 *   "monitoringEnabled": true
 * }
 * ```
 *
 * @example Unassign location and clear MAC/IP
 * ```json
 * {
 *   "id": "550e8400-e29b-41d4-a716-446655440000",
 *   "locationId": null,
 *   "macAddress": null,
 *   "ipAddress": null
 * }
 * ```
 */
export interface UpdateDeviceRequestDTO {
  // ===================================
  // REQUIRED FIELDS
  // ===================================

  /**
   * UUID of the device to update.
   * Required, must be a valid UUID.
   */
  id: string;

  // ===================================
  // OPTIONAL CLASSIFICATION
  // ===================================

  /**
   * Human-readable name for this device instance.
   * Optional, 1–150 characters.
   */
  name?: string;

  /**
   * Operational lifecycle status.
   * Optional. Valid values: INVENTORY, ACTIVE, MAINTENANCE, DAMAGED, DECOMMISSIONED.
   * Note: A decommissioned device cannot transition to any other status.
   */
  status?: string;

  /**
   * Network role / hardware category of the device.
   * Optional. Valid values: CORE, DISTRIBUTION, POE, ACCESS_POINT, CLIENT_CPE.
   * Pass null to clear the current category.
   */
  category?: string | null;

  /**
   * Indicates who owns this device.
   * Optional. Valid values: COMPANY, CLIENT.
   */
  ownerType?: string;

  // ===================================
  // OPTIONAL ASSIGNMENT
  // ===================================

  /**
   * UUID of the location where the device is physically installed.
   * Optional. Must be a valid UUID when provided as a string.
   * Pass null to unassign the device from its current location.
   */
  locationId?: string | null;

  // ===================================
  // OPTIONAL IDENTITY
  // ===================================

  /**
   * Manufacturer-assigned serial number.
   * Optional, max 100 characters.
   * Pass null to clear the current serial number.
   */
  serialNumber?: string | null;

  /**
   * MAC address of the device's primary network interface.
   * Optional. Format: AA:BB:CC:DD:EE:FF or AA-BB-CC-DD-EE-FF.
   * Must be unique across all devices.
   * Pass null to clear the current MAC address.
   */
  macAddress?: string | null;

  /**
   * IP address assigned to the device.
   * Optional. Valid IPv4 or IPv6 address.
   * Must be unique across all devices.
   * Pass null to clear the current IP address.
   */
  ipAddress?: string | null;

  /**
   * Free-text description of the device.
   * Optional. Pass null to clear.
   */
  description?: string | null;

  // ===================================
  // OPTIONAL LIFECYCLE
  // ===================================

  /**
   * Date when the device was physically installed at its location.
   * Optional. ISO 8601 date string (e.g. "2024-01-15T00:00:00.000Z").
   * Pass null to clear the current installed date.
   */
  installedDate?: string | null;

  /**
   * Whether ICMP/SNMP monitoring is active for this device.
   * Optional. true enables monitoring; false disables it.
   */
  monitoringEnabled?: boolean;
}
