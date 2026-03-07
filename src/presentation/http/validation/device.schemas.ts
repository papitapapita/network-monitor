import { z } from 'zod';

/**
 * Zod validation schemas for Device HTTP endpoints.
 *
 * Covered endpoints:
 * - POST /api/devices          (createDeviceSchema)
 * - GET  /api/devices          (listDevicesSchema)
 * - GET  /api/devices/:id      (getDeviceByIdSchema)
 */

// =====================================
// SHARED CONSTANTS
// =====================================

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DEVICE_STATUSES = [
  'INVENTORY',
  'ACTIVE',
  'MAINTENANCE',
  'DAMAGED',
  'DECOMMISSIONED'
] as const;

const DEVICE_CATEGORIES = [
  'CORE',
  'DISTRIBUTION',
  'POE',
  'ACCESS_POINT',
  'CLIENT_CPE'
] as const;

const DEVICE_OWNER_TYPES = ['COMPANY', 'CLIENT'] as const;

const SORT_BY_VALUES = [
  'createdAt',
  'updatedAt',
  'name',
  'status'
] as const;

// =====================================
// CREATE SCHEMA
// =====================================

/**
 * Schema for POST /api/devices
 *
 * Validates required fields (deviceModelId, name, ownerType) and
 * all optional fields according to CreateDeviceRequestDTO rules.
 */
export const createDeviceSchema = z.object({
  body: z.object({
    // ===================================
    // REQUIRED FIELDS
    // ===================================

    deviceModelId: z
      .string()
      .regex(UUID_REGEX, 'deviceModelId must be a valid UUID v4'),

    name: z
      .string()
      .min(1, 'Device name cannot be empty')
      .max(150, 'Device name cannot exceed 150 characters')
      .trim(),

    ownerType: z.enum(DEVICE_OWNER_TYPES, {
      error: () => ({
        message: `ownerType must be one of: ${DEVICE_OWNER_TYPES.join(', ')}`
      })
    }),

    // ===================================
    // OPTIONAL CLASSIFICATION
    // ===================================

    status: z
      .enum(DEVICE_STATUSES, {
        error: () => ({
          message: `status must be one of: ${DEVICE_STATUSES.join(', ')}`
        })
      })
      .optional(),

    category: z
      .enum(DEVICE_CATEGORIES, {
        error: () => ({
          message: `category must be one of: ${DEVICE_CATEGORIES.join(', ')}`
        })
      })
      .nullable()
      .optional(),

    // ===================================
    // OPTIONAL ASSIGNMENT
    // ===================================

    locationId: z
      .string()
      .regex(UUID_REGEX, 'locationId must be a valid UUID v4')
      .nullable()
      .optional(),

    // ===================================
    // OPTIONAL IDENTITY
    // ===================================

    serialNumber: z
      .string()
      .max(100, 'Serial number cannot exceed 100 characters')
      .trim()
      .nullable()
      .optional(),

    macAddress: z
      .string()
      .regex(
        /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$|^([0-9A-Fa-f]{2}-){5}[0-9A-Fa-f]{2}$/,
        'macAddress must be in format AA:BB:CC:DD:EE:FF or AA-BB-CC-DD-EE-FF'
      )
      .nullable()
      .optional(),

    ipAddress: z
      .union([z.ipv4(), z.ipv6()])
      .nullable()
      .optional(),

    description: z.string().trim().nullable().optional(),

    // ===================================
    // OPTIONAL LIFECYCLE
    // ===================================

    installedDate: z
      .string()
      .datetime({ message: 'installedDate must be a valid ISO 8601 date string' })
      .nullable()
      .optional(),

    monitoringEnabled: z.boolean().optional()
  })
});

// =====================================
// LIST SCHEMA
// =====================================

/**
 * Schema for GET /api/devices
 *
 * Validates pagination, filter, and sort query parameters.
 */
export const listDevicesSchema = z.object({
  query: z.object({
    limit: z
      .string()
      .regex(/^\d+$/, 'limit must be a positive integer')
      .transform(Number)
      .refine((n) => n > 0 && n <= 100, {
        message: 'limit must be between 1 and 100'
      })
      .optional(),

    offset: z
      .string()
      .regex(/^\d+$/, 'offset must be a non-negative integer')
      .transform(Number)
      .refine((n) => n >= 0, { message: 'offset must be non-negative' })
      .optional(),

    status: z
      .enum(DEVICE_STATUSES, {
        error: () => ({
          message: `status must be one of: ${DEVICE_STATUSES.join(', ')}`
        })
      })
      .optional(),

    category: z
      .enum(DEVICE_CATEGORIES, {
        error: () => ({
          message: `category must be one of: ${DEVICE_CATEGORIES.join(', ')}`
        })
      })
      .optional(),

    owner: z
      .enum(DEVICE_OWNER_TYPES, {
        error: () => ({
          message: `owner must be one of: ${DEVICE_OWNER_TYPES.join(', ')}`
        })
      })
      .optional(),

    locationId: z
      .string()
      .regex(UUID_REGEX, 'locationId must be a valid UUID v4')
      .optional(),

    deviceModelId: z
      .string()
      .regex(UUID_REGEX, 'deviceModelId must be a valid UUID v4')
      .optional(),

    monitoringEnabled: z
      .enum(['true', 'false'], {
        error: () => ({ message: 'monitoringEnabled must be true or false' })
      })
      .transform((v) => v === 'true')
      .optional(),

    search: z.string().trim().optional(),

    sortBy: z.enum(SORT_BY_VALUES).optional(),

    sortOrder: z.enum(['ASC', 'DESC']).optional()
  })
});

// =====================================
// GET BY ID SCHEMA
// =====================================

/**
 * Schema for GET /api/devices/:id
 *
 * Validates that :id is a UUID v4.
 */
export const getDeviceByIdSchema = z.object({
  params: z.object({
    id: z
      .string()
      .regex(UUID_REGEX, 'Invalid device ID (must be a UUID v4)')
  })
});

// =====================================
// UPDATE SCHEMA
// =====================================

/**
 * Schema for PATCH /api/devices/:id
 *
 * Validates the :id param (UUID v4) and an optional body containing any
 * subset of updatable device fields. All body fields are optional — omitted
 * fields are left unchanged (PATCH semantics).
 */
export const updateDeviceSchema = z.object({
  params: z.object({
    id: z
      .string()
      .regex(UUID_REGEX, 'Invalid device ID (must be a UUID v4)')
  }),

  body: z.object({
    name: z
      .string()
      .min(1, 'Device name cannot be empty')
      .max(150, 'Device name cannot exceed 150 characters')
      .trim()
      .optional(),

    status: z
      .enum(DEVICE_STATUSES, {
        error: () => ({
          message: `status must be one of: ${DEVICE_STATUSES.join(', ')}`
        })
      })
      .optional(),

    category: z
      .enum(DEVICE_CATEGORIES, {
        error: () => ({
          message: `category must be one of: ${DEVICE_CATEGORIES.join(', ')}`
        })
      })
      .nullable()
      .optional(),

    ownerType: z
      .enum(DEVICE_OWNER_TYPES, {
        error: () => ({
          message: `ownerType must be one of: ${DEVICE_OWNER_TYPES.join(', ')}`
        })
      })
      .optional(),

    locationId: z
      .string()
      .regex(UUID_REGEX, 'locationId must be a valid UUID v4')
      .nullable()
      .optional(),

    serialNumber: z
      .string()
      .max(100, 'Serial number cannot exceed 100 characters')
      .trim()
      .nullable()
      .optional(),

    macAddress: z
      .string()
      .regex(
        /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$|^([0-9A-Fa-f]{2}-){5}[0-9A-Fa-f]{2}$/,
        'macAddress must be in format AA:BB:CC:DD:EE:FF or AA-BB-CC-DD-EE-FF'
      )
      .nullable()
      .optional(),

    ipAddress: z.union([z.ipv4(), z.ipv6()]).nullable().optional(),

    description: z.string().trim().nullable().optional(),

    installedDate: z
      .string()
      .datetime({ message: 'installedDate must be a valid ISO 8601 date string' })
      .nullable()
      .optional(),

    monitoringEnabled: z.boolean().optional()
  })
});

// =====================================
// TYPE EXPORTS
// =====================================

export type CreateDeviceInput = z.infer<typeof createDeviceSchema>['body'];
export type ListDevicesQuery = z.infer<typeof listDevicesSchema>['query'];
export type GetDeviceByIdParams = z.infer<typeof getDeviceByIdSchema>['params'];
export type UpdateDeviceInput = z.infer<typeof updateDeviceSchema>['body'];
export type UpdateDeviceParams = z.infer<typeof updateDeviceSchema>['params'];
