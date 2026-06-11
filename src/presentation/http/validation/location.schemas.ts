import { z } from 'zod';

/**
 * Zod validation schemas for Location HTTP endpoints.
 *
 * These schemas validate incoming HTTP requests before they reach
 * the use cases, ensuring data integrity at the presentation layer.
 *
 * Validation happens at two levels:
 * 1. Zod schema validation (HTTP request structure — this file)
 * 2. Domain validation (Coordinates value object, business rules — use cases)
 *
 * Covered endpoints:
 * - POST /api/locations          (createLocationSchema)
 * - GET  /api/locations          (listLocationsSchema)
 * - GET  /api/locations/:id      (getLocationByIdSchema)
 */

// =====================================
// SHARED CONSTANTS
// =====================================

/**
 * UUID v4 regex pattern.
 * Matches: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
 */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Valid location type values, sourced from the LocationType domain enum.
 */
const LOCATION_TYPES = [
  'TOWER',
  'NODE',
  'DATACENTER',
  'POP',
  'WAREHOUSE',
  'OFFICE',
  'OTHER'
] as const;

// =====================================
// CREATE SCHEMA
// =====================================

/**
 * Schema for creating a new location.
 *
 * POST /api/locations
 *
 * Validates:
 * - Required fields: name, type
 * - Optional address fields: municipality, neighborhood, address
 * - Optional coordinates: latitude (-90 to 90), longitude (-180 to 180), altitude
 * - Coordinate coherence: latitude and longitude must be provided together
 *
 * Note: coordinate coherence (lat without lon or vice-versa) is an HTTP-level
 * structural concern that surfaces clearly here rather than deep in the use case.
 */
export const createLocationSchema = z.object({
  body: z
    .object({
      // ===================================
      // REQUIRED FIELDS
      // ===================================

      name: z
        .string()
        .min(1, 'Location name cannot be empty')
        .max(150, 'Location name cannot exceed 150 characters')
        .trim()
        .describe(
          'Human-readable location name (e.g., "Tower Norte")'
        ),

      type: z
        .enum(LOCATION_TYPES, {
          error: () => ({
            message: `Location type must be one of: ${LOCATION_TYPES.join(', ')}`
          })
        })
        .describe('Location type classification'),

      // ===================================
      // OPTIONAL ADDRESS FIELDS
      // ===================================

      municipality: z
        .string()
        .max(100, 'Municipality cannot exceed 100 characters')
        .trim()
        .nullable()
        .optional()
        .describe(
          'Municipality (city/town) where the location resides'
        ),

      neighborhood: z
        .string()
        .max(150, 'Neighborhood cannot exceed 150 characters')
        .trim()
        .nullable()
        .optional()
        .describe('Neighborhood within the municipality'),

      address: z
        .string()
        .max(255, 'Address cannot exceed 255 characters')
        .trim()
        .nullable()
        .optional()
        .describe('Street address'),

      // ===================================
      // OPTIONAL GEOGRAPHIC COORDINATES
      // ===================================

      latitude: z
        .number()
        .min(-90, 'Latitude must be between -90 and 90')
        .max(90, 'Latitude must be between -90 and 90')
        .nullable()
        .optional()
        .describe('Latitude in WGS-84 decimal degrees (-90 to 90)'),

      longitude: z
        .number()
        .min(-180, 'Longitude must be between -180 and 180')
        .max(180, 'Longitude must be between -180 and 180')
        .nullable()
        .optional()
        .describe(
          'Longitude in WGS-84 decimal degrees (-180 to 180)'
        ),

      altitude: z
        .number()
        .finite('Altitude must be a finite number')
        .optional()
        .describe(
          'Altitude in metres above sea level (WGS-84). Only meaningful when latitude and longitude are also provided.'
        )
    })
    .refine(
      (data) => {
        // Latitude and longitude must be provided together.
        // null and undefined are both treated as "absent".
        const hasLatitude = data.latitude != null;
        const hasLongitude = data.longitude != null;
        return hasLatitude === hasLongitude;
      },
      {
        message:
          'Both latitude and longitude must be provided together, or both omitted',
        path: ['latitude']
      }
    )
});

// =====================================
// LIST SCHEMA
// =====================================

/**
 * Schema for listing locations with optional pagination and type filter.
 *
 * GET /api/locations
 *
 * Validates:
 * - Pagination: limit (1-100), offset (≥0)
 * - Optional filter: type (LocationType enum)
 * - Query strings transformed to numbers where required
 */
export const listLocationsSchema = z.object({
  query: z.object({
    limit: z
      .string()
      .regex(/^\d+$/, 'Limit must be a positive integer')
      .transform(Number)
      .refine((n) => n > 0 && n <= 100, {
        message: 'Limit must be between 1 and 100'
      })
      .optional()
      .describe('Maximum number of results (1-100, default: 20)'),

    offset: z
      .string()
      .regex(/^\d+$/, 'Offset must be a non-negative integer')
      .transform(Number)
      .refine((n) => n >= 0, {
        message: 'Offset must be non-negative'
      })
      .optional()
      .describe('Number of results to skip (default: 0)'),

    type: z
      .enum(LOCATION_TYPES, {
        error: () => ({
          message: `Location type must be one of: ${LOCATION_TYPES.join(', ')}`
        })
      })
      .optional()
      .describe('Filter by location type')
  })
});

// =====================================
// GET BY ID SCHEMA
// =====================================

/**
 * Schema for retrieving a single location by ID.
 *
 * GET /api/locations/:id
 *
 * Validates:
 * - id parameter must be a valid UUID v4
 */
export const getLocationByIdSchema = z.object({
  params: z.object({
    id: z
      .string()
      .regex(UUID_REGEX, 'Invalid location ID (must be a UUID v4)')
      .describe('Location UUID v4')
  })
});

// =====================================
// UPDATE SCHEMA
// =====================================

/**
 * Schema for PATCH /api/locations/:id
 *
 * Validates the :id param (UUID v4) and an optional body containing any
 * subset of updatable location fields. All body fields are optional — omitted
 * fields are left unchanged (PATCH semantics).
 *
 * Coordinate coherence is enforced: latitude and longitude must be provided
 * together (both present or both absent/null).
 */
export const updateLocationSchema = z.object({
  params: z.object({
    id: z
      .string()
      .regex(UUID_REGEX, 'Invalid location ID (must be a UUID v4)')
      .describe('Location UUID v4')
  }),

  body: z
    .object({
      name: z
        .string()
        .min(1, 'Location name cannot be empty')
        .max(150, 'Location name cannot exceed 150 characters')
        .trim()
        .optional(),

      type: z
        .enum(LOCATION_TYPES, {
          error: () => ({
            message: `Location type must be one of: ${LOCATION_TYPES.join(', ')}`
          })
        })
        .optional(),

      municipality: z
        .string()
        .max(100, 'Municipality cannot exceed 100 characters')
        .trim()
        .nullable()
        .optional(),

      neighborhood: z
        .string()
        .max(150, 'Neighborhood cannot exceed 150 characters')
        .trim()
        .nullable()
        .optional(),

      address: z
        .string()
        .max(255, 'Address cannot exceed 255 characters')
        .trim()
        .nullable()
        .optional(),

      latitude: z
        .number()
        .min(-90, 'Latitude must be between -90 and 90')
        .max(90, 'Latitude must be between -90 and 90')
        .nullable()
        .optional(),

      longitude: z
        .number()
        .min(-180, 'Longitude must be between -180 and 180')
        .max(180, 'Longitude must be between -180 and 180')
        .nullable()
        .optional(),

      altitude: z
        .number()
        .finite('Altitude must be a finite number')
        .optional()
    })
    .refine(
      (data) => {
        // Use != null so both null and undefined are treated as "absent".
        // Setting latitude to a number while clearing longitude (or vice versa)
        // is semantically invalid even in a PATCH update.
        const hasLatitude = data.latitude != null;
        const hasLongitude = data.longitude != null;
        return hasLatitude === hasLongitude;
      },
      {
        message:
          'Both latitude and longitude must be provided together, or both omitted',
        path: ['latitude']
      }
    )
});

// =====================================
// TYPE EXPORTS
// =====================================

/**
 * TypeScript types inferred from Zod schemas.
 * Use these types in LocationController for compile-time safety.
 */
export type CreateLocationInput = z.infer<
  typeof createLocationSchema
>['body'];
export type ListLocationsQuery = z.infer<
  typeof listLocationsSchema
>['query'];
export type GetLocationByIdParams = z.infer<
  typeof getLocationByIdSchema
>['params'];
export type UpdateLocationInput = z.infer<
  typeof updateLocationSchema
>['body'];
export type UpdateLocationParams = z.infer<
  typeof updateLocationSchema
>['params'];

// =====================================
// DELETE SCHEMA
// =====================================

export const deleteLocationSchema = z.object({
  params: z.object({
    id: z
      .string()
      .regex(UUID_REGEX, 'Invalid location ID (must be a UUID v4)')
  })
});

export type DeleteLocationParams = z.infer<
  typeof deleteLocationSchema
>['params'];
