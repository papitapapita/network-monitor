/**
 * Response DTO for a single physical device.
 *
 * Returned By:
 * - CreateDeviceUseCase
 * - ListDevicesUseCase (as array element inside DeviceListResponseDTO)
 *
 * API Endpoints:
 * - POST /api/devices
 * - GET /api/devices
 *
 * All domain value objects are flattened to primitives.
 * Dates are represented as ISO 8601 strings.
 * Nullable optional fields use `string | null`.
 *
 * @example
 * ```json
 * {
 *   "id": "550e8400-e29b-41d4-a716-446655440000",
 *   "deviceModelId": "550e8400-e29b-41d4-a716-446655440001",
 *   "locationId": "550e8400-e29b-41d4-a716-446655440002",
 *   "status": "ACTIVE",
 *   "category": "CORE",
 *   "ownerType": "COMPANY",
 *   "name": "Core-Router-01",
 *   "serialNumber": "SN-2024-XYZ-001",
 *   "macAddress": "AA:BB:CC:DD:EE:FF",
 *   "ipAddress": "192.168.1.1",
 *   "description": "Primary core router",
 *   "installedDate": "2024-01-15T00:00:00.000Z",
 *   "monitoringEnabled": true,
 *   "createdAt": "2024-01-15T10:30:00.000Z",
 *   "updatedAt": "2024-01-15T10:30:00.000Z"
 * }
 * ```
 */
export interface DeviceResponseDTO {
  // ===================================
  // CORE IDENTIFICATION
  // ===================================

  /** Unique identifier (UUID string). */
  id: string;

  /** UUID of the associated device model / catalogue entry. */
  deviceModelId: string;

  // ===================================
  // CLASSIFICATION
  // ===================================

  /**
   * Operational lifecycle status.
   * Values: INVENTORY, ACTIVE, MAINTENANCE, DAMAGED, DECOMMISSIONED
   */
  status: string;

  /**
   * Network role / hardware category.
   * Values: CORE, DISTRIBUTION, POE, ACCESS_POINT, CLIENT_CPE.
   * Null when not set.
   */
  category: string | null;

  /**
   * Device ownership.
   * Values: COMPANY, CLIENT
   */
  ownerType: string;

  // ===================================
  // ASSIGNMENT
  // ===================================

  /**
   * UUID of the location where the device is installed.
   * Null when not assigned to any location.
   */
  locationId: string | null;

  // ===================================
  // IDENTITY
  // ===================================

  /** Human-readable name for this device instance. */
  name: string;

  /**
   * Manufacturer-assigned serial number.
   * Null when not recorded.
   */
  serialNumber: string | null;

  /**
   * Normalized MAC address (AA:BB:CC:DD:EE:FF format).
   * Null when not recorded.
   */
  macAddress: string | null;

  /**
   * IP address (IPv4 or IPv6).
   * Null when not assigned.
   */
  ipAddress: string | null;

  /**
   * Free-text description.
   * Null when not provided.
   */
  description: string | null;

  // ===================================
  // LIFECYCLE
  // ===================================

  /**
   * Date when the device was installed (ISO 8601).
   * Null when not recorded.
   */
  installedDate: string | null;

  /** Whether ICMP/SNMP monitoring is active for this device. */
  monitoringEnabled: boolean;

  // ===================================
  // TIMESTAMPS
  // ===================================

  /** When the device record was created (ISO 8601). */
  createdAt: string;

  /** When the device record was last updated (ISO 8601). */
  updatedAt: string;
}
