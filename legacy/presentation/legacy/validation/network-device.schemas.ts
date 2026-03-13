import { z } from 'zod';

/**
 * Zod validation schemas for Network Device HTTP endpoints.
 *
 * These schemas validate incoming HTTP requests before they reach
 * the use cases, ensuring data integrity at the presentation layer.
 *
 * REQ-002: Enhanced with lifecycle management schemas:
 * - Activate: DRAFT → ACTIVE transition
 * - Soft Delete: 7-day grace period
 * - Restore: Restore from soft delete
 *
 * Validation happens in this order:
 * 1. Zod schema validation (HTTP request structure)
 * 2. Value object validation (Domain rules - IP format, MAC format)
 * 3. Business rule validation (Uniqueness, existence checks)
 */

// =====================================
// SHARED CONSTANTS
// =====================================

/**
 * IP address regex pattern (IPv4).
 * Matches: 0.0.0.0 to 255.255.255.255
 */
const IP_ADDRESS_REGEX =
  /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

/**
 * MAC address regex pattern.
 * Matches: AA:BB:CC:DD:EE:FF or AA-BB-CC-DD-EE-FF
 */
const MAC_ADDRESS_REGEX = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;

/**
 * UUID v4 regex pattern.
 */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Valid device types.
 */
const DEVICE_TYPES = [
  'ROUTER',
  'SWITCH',
  'ACCESS_POINT',
  'STATION',
  'PTP_RADIO',
  'PTMP_RADIO',
  'FIREWALL',
  'SERVER',
  'UNKNOWN'
] as const;

/**
 * Valid network device statuses.
 */
const DEVICE_STATUSES = [
  'ONLINE',
  'OFFLINE',
  'UNREACHABLE',
  'UNKNOWN'
] as const;

/**
 * Valid connectivity types.
 */
const CONNECTIVITY_TYPES = [
  'ETHERNET',
  'FIBER_OPTIC',
  'WIRELESS',
  'DSL',
  'SATELLITE',
  'OTHER'
] as const;

/**
 * Valid management protocols.
 */
const MANAGEMENT_PROTOCOLS = [
  'SNMP',
  'SSH',
  'ICMP',
  'TELNET',
  'HTTP',
  'HTTPS',
  'OTHER'
] as const;

/**
 * Valid activation statuses (REQ-002).
 */
const ACTIVATION_STATUSES = ['DRAFT', 'ACTIVE'] as const;

// =====================================
// CREATE SCHEMA
// =====================================

/**
 * Schema for creating a new network device.
 *
 * POST /api/devices
 *
 * REQ-002: Supports both DRAFT and ACTIVE creation modes:
 * - DRAFT mode (activateImmediately = false): Only IP, MAC, deviceId required
 * - ACTIVE mode (activateImmediately = true): Name and deviceType also required
 *
 * Validates:
 * - Required fields: ipAddress, macAddress, deviceId
 * - Conditional fields: name, deviceType (required if activateImmediately = true)
 * - Optional fields: description, location, connectivityType, managementProtocol, etc.
 * - Field formats: IP regex, MAC regex, UUID regex
 * - Field lengths: name max 255, description max 1000, location max 500
 */
export const createNetworkDeviceSchema = z.object({
  body: z.object({
    // ===================================
    // REQUIRED FIELDS (Always)
    // ===================================

    ipAddress: z
      .string()
      .regex(IP_ADDRESS_REGEX, 'Invalid IP address format')
      .describe('IP address in IPv4 format (e.g., 192.168.1.100)'),

    macAddress: z
      .string()
      .regex(MAC_ADDRESS_REGEX, 'Invalid MAC address format')
      .describe('MAC address (e.g., AA:BB:CC:DD:EE:FF)'),

    deviceId: z
      .string()
      .min(1, 'Device ID cannot be empty')
      .max(255, 'Device ID cannot exceed 255 characters')
      .describe('Device identifier (external reference)'),

    // ===================================
    // CONDITIONAL FIELDS (Required for ACTIVE)
    // ===================================

    name: z
      .string()
      .min(1, 'Device name cannot be empty')
      .max(255, 'Device name cannot exceed 255 characters')
      .trim()
      .optional()
      .describe(
        'Human-readable device name (required if activateImmediately = true)'
      ),

    deviceType: z
      .enum(DEVICE_TYPES, {
        error: () => ({
          message: `Device type must be one of: ${DEVICE_TYPES.join(', ')}`
        })
      })
      .optional()
      .describe(
        'Type of network device (required if activateImmediately = true)'
      ),

    // ===================================
    // OPTIONAL FIELDS
    // ===================================

    description: z
      .string()
      .max(1000, 'Description cannot exceed 1000 characters')
      .nullable()
      .optional()
      .describe('Optional device description'),

    location: z
      .string()
      .max(500, 'Location cannot exceed 500 characters')
      .nullable()
      .optional()
      .describe('Physical location of the device (REQ-002)'),

    connectivityType: z
      .enum(CONNECTIVITY_TYPES, {
        error: () => ({
          message: `Connectivity type must be one of: ${CONNECTIVITY_TYPES.join(', ')}`
        })
      })
      .optional()
      .describe('Type of network connectivity'),

    managementProtocol: z
      .enum(MANAGEMENT_PROTOCOLS, {
        error: () => ({
          message: `Management protocol must be one of: ${MANAGEMENT_PROTOCOLS.join(', ')}`
        })
      })
      .optional()
      .describe('Protocol used for device management'),

    managementPort: z
      .number()
      .int('Management port must be an integer')
      .min(1, 'Port must be between 1 and 65535')
      .max(65535, 'Port must be between 1 and 65535')
      .optional()
      .describe('Port number for device management'),

    enabledRemoteAccess: z
      .boolean()
      .optional()
      .describe('Whether remote access is enabled'),

    performPingTest: z
      .boolean()
      .optional()
      .describe('Whether to perform ping test on creation'),

    // ===================================
    // REQ-002: ACTIVATION CONTROL
    // ===================================

    activateImmediately: z
      .boolean()
      .optional()
      .default(false)
      .describe(
        'Whether to activate device immediately (false = DRAFT, true = ACTIVE)'
      )
  })
});

// =====================================
// UPDATE SCHEMA
// =====================================

/**
 * Schema for updating an existing network device.
 *
 * PUT /api/devices/:id
 *
 * Validates:
 * - ID parameter must be valid UUID
 * - At least one field must be provided
 * - All fields are optional (partial update)
 * - Cannot update soft-deleted devices
 *
 * Immutable fields (cannot be updated):
 * - IP address, MAC address
 * - Device type, connectivity type
 * - Activation status (use ActivateNetworkDeviceUseCase)
 */
export const updateNetworkDeviceSchema = z.object({
  params: z.object({
    id: z
      .string()
      .regex(UUID_REGEX, 'Invalid device ID (must be UUID)')
      .describe('Network device UUID')
  }),
  body: z
    .object({
      name: z
        .string()
        .min(1, 'Device name cannot be empty')
        .max(255, 'Device name cannot exceed 255 characters')
        .trim()
        .optional()
        .describe('New device name'),

      description: z
        .string()
        .max(1000, 'Description cannot exceed 1000 characters')
        .nullable()
        .optional()
        .describe('New device description'),

      location: z
        .string()
        .max(500, 'Location cannot exceed 500 characters')
        .nullable()
        .optional()
        .describe('New device location (REQ-002)'),

      managementProtocol: z
        .enum(MANAGEMENT_PROTOCOLS, {
          error: () => ({
            message: `Management protocol must be one of: ${MANAGEMENT_PROTOCOLS.join(', ')}`
          })
        })
        .optional()
        .describe('New management protocol'),

      managementPort: z
        .number()
        .int('Management port must be an integer')
        .min(1, 'Port must be between 1 and 65535')
        .max(65535, 'Port must be between 1 and 65535')
        .optional()
        .describe('New management port'),

      enabledRemoteAccess: z
        .boolean()
        .optional()
        .describe('New remote access setting')
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be provided for update'
    })
});

// =====================================
// REQ-002: ACTIVATE SCHEMA
// =====================================

/**
 * Schema for activating a DRAFT device to ACTIVE status.
 *
 * POST /api/devices/:id/activate
 *
 * REQ-002: Transitions device from DRAFT → ACTIVE
 *
 * Validates:
 * - ID parameter must be valid UUID
 * - Name and deviceType are required
 * - Optional enrichment fields
 */
export const activateNetworkDeviceSchema = z.object({
  params: z.object({
    id: z
      .string()
      .regex(UUID_REGEX, 'Invalid device ID (must be UUID)')
      .describe('Network device UUID to activate')
  }),
  body: z.object({
    // Required for activation
    name: z
      .string()
      .min(1, 'Device name cannot be empty')
      .max(255, 'Device name cannot exceed 255 characters')
      .trim()
      .describe('Device name (required for activation)'),

    deviceType: z
      .enum(DEVICE_TYPES, {
        error: () => ({
          message: `Device type must be one of: ${DEVICE_TYPES.join(', ')}`
        })
      })
      .describe('Device type (required for activation)'),

    // Optional enrichment fields
    description: z
      .string()
      .max(1000, 'Description cannot exceed 1000 characters')
      .nullable()
      .optional()
      .describe('Optional device description'),

    location: z
      .string()
      .max(500, 'Location cannot exceed 500 characters')
      .nullable()
      .optional()
      .describe('Optional device location'),

    connectivityType: z
      .enum(CONNECTIVITY_TYPES, {
        error: () => ({
          message: `Connectivity type must be one of: ${CONNECTIVITY_TYPES.join(', ')}`
        })
      })
      .optional()
      .describe('Optional connectivity type'),

    managementProtocol: z
      .enum(MANAGEMENT_PROTOCOLS, {
        error: () => ({
          message: `Management protocol must be one of: ${MANAGEMENT_PROTOCOLS.join(', ')}`
        })
      })
      .optional()
      .describe('Optional management protocol'),

    managementPort: z
      .number()
      .int('Management port must be an integer')
      .min(1, 'Port must be between 1 and 65535')
      .max(65535, 'Port must be between 1 and 65535')
      .optional()
      .describe('Optional management port'),

    enabledRemoteAccess: z
      .boolean()
      .optional()
      .describe('Optional remote access setting')
  })
});

// =====================================
// REQ-002: SOFT DELETE SCHEMA
// =====================================

/**
 * Schema for soft-deleting a network device.
 *
 * DELETE /api/devices/:id
 *
 * REQ-002: Marks device as deleted with 7-day grace period
 *
 * Validates:
 * - ID parameter must be valid UUID
 * - Optional deletion reason (max 500 characters)
 */
export const softDeleteNetworkDeviceSchema = z.object({
  params: z.object({
    id: z
      .string()
      .regex(UUID_REGEX, 'Invalid device ID (must be UUID)')
      .describe('Network device UUID to soft-delete')
  }),
  body: z
    .object({
      reason: z
        .string()
        .max(500, 'Deletion reason cannot exceed 500 characters')
        .optional()
        .describe('Optional reason for deletion (audit trail)')
    })
    .optional()
});

// =====================================
// REQ-002: RESTORE SCHEMA
// =====================================

/**
 * Schema for restoring a soft-deleted network device.
 *
 * POST /api/devices/:id/restore
 *
 * REQ-002: Restores device from soft-deleted state (within 7-day grace period)
 *
 * Validates:
 * - ID parameter must be valid UUID
 * - No body parameters required
 */
export const restoreNetworkDeviceSchema = z.object({
  params: z.object({
    id: z
      .string()
      .regex(UUID_REGEX, 'Invalid device ID (must be UUID)')
      .describe('Network device UUID to restore')
  }),
  body: z.object({}).optional()
});

// =====================================
// LIST SCHEMA
// =====================================

/**
 * Schema for listing network devices with query parameters.
 *
 * GET /api/devices
 *
 * Validates:
 * - Pagination: limit (1-100, default 20), offset (≥0, default 0)
 * - Filters: status, deviceType, activationStatus
 * - Query strings transformed to numbers
 */
export const listNetworkDevicesSchema = z.object({
  query: z.object({
    limit: z
      .string()
      .regex(/^\d+$/, 'Limit must be a positive number')
      .transform(Number)
      .refine((n) => n > 0 && n <= 100, {
        message: 'Limit must be between 1 and 100'
      })
      .optional()
      .describe('Maximum number of results (1-100)'),

    offset: z
      .string()
      .regex(/^\d+$/, 'Offset must be a non-negative number')
      .transform(Number)
      .refine((n) => n >= 0, {
        message: 'Offset must be non-negative'
      })
      .optional()
      .describe('Offset for pagination'),

    status: z
      .enum(DEVICE_STATUSES)
      .optional()
      .describe('Filter by device status'),

    deviceType: z
      .enum(DEVICE_TYPES)
      .optional()
      .describe('Filter by device type'),

    activationStatus: z
      .enum(ACTIVATION_STATUSES)
      .optional()
      .describe('Filter by activation status (REQ-002)')
  })
});

// =====================================
// GET BY ID SCHEMA
// =====================================

/**
 * Schema for getting a network device by ID.
 *
 * GET /api/devices/:id
 */
export const getNetworkDeviceByIdSchema = z.object({
  params: z.object({
    id: z
      .string()
      .regex(UUID_REGEX, 'Invalid device ID (must be UUID)')
      .describe('Network device UUID')
  })
});

// =====================================
// GET BY IP SCHEMA
// =====================================

/**
 * Schema for getting a network device by IP address.
 *
 * GET /api/devices/ip/:ipAddress
 */
export const getNetworkDeviceByIpSchema = z.object({
  params: z.object({
    ipAddress: z
      .string()
      .regex(IP_ADDRESS_REGEX, 'Invalid IP address format')
      .describe('IP address to search for')
  })
});

// =====================================
// DELETE SCHEMA (Hard Delete)
// =====================================

/**
 * Schema for permanently deleting a network device.
 *
 * DELETE /api/devices/:id/permanent
 *
 * Note: Use soft delete endpoint instead for most cases.
 * Hard delete is for administrative purposes only.
 */
export const deleteNetworkDeviceSchema = z.object({
  params: z.object({
    id: z
      .string()
      .regex(UUID_REGEX, 'Invalid device ID (must be UUID)')
      .describe('Network device UUID to permanently delete')
  })
});

// =====================================
// TYPE EXPORTS
// =====================================

/**
 * TypeScript types inferred from Zod schemas.
 * Use these types in controllers for type safety.
 */
export type CreateNetworkDeviceInput = z.infer<
  typeof createNetworkDeviceSchema
>['body'];
export type UpdateNetworkDeviceInput = z.infer<
  typeof updateNetworkDeviceSchema
>['body'];
export type ActivateNetworkDeviceInput = z.infer<
  typeof activateNetworkDeviceSchema
>['body'];
export type SoftDeleteNetworkDeviceInput = z.infer<
  typeof softDeleteNetworkDeviceSchema
>['body'];
export type RestoreNetworkDeviceInput = z.infer<
  typeof restoreNetworkDeviceSchema
>['body'];
export type ListNetworkDevicesQuery = z.infer<
  typeof listNetworkDevicesSchema
>['query'];
export type GetNetworkDeviceByIdParams = z.infer<
  typeof getNetworkDeviceByIdSchema
>['params'];
export type GetNetworkDeviceByIpParams = z.infer<
  typeof getNetworkDeviceByIpSchema
>['params'];
export type DeleteNetworkDeviceParams = z.infer<
  typeof deleteNetworkDeviceSchema
>['params'];
