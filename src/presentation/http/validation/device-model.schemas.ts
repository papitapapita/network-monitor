import { z } from 'zod';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DEVICE_TYPES = [
  'ANTENNA',
  'OTHER',
  'RADIO',
  'ROUTER',
  'ROUTERBOARD',
  'SERVER',
  'SWITCH'
] as const;

export const listDeviceModelsSchema = z.object({
  query: z.object({
    limit: z
      .string()
      .regex(/^\d+$/, 'Limit must be a positive integer')
      .transform(Number)
      .refine((n) => n > 0 && n <= 100, {
        message: 'Limit must be between 1 and 100'
      })
      .optional(),

    offset: z
      .string()
      .regex(/^\d+$/, 'Offset must be a non-negative integer')
      .transform(Number)
      .refine((n) => n >= 0, {
        message: 'Offset must be non-negative'
      })
      .optional()
  })
});

export const getDeviceModelByIdSchema = z.object({
  params: z.object({
    id: z
      .string()
      .regex(
        UUID_REGEX,
        'Invalid device model ID (must be a UUID v4)'
      )
  })
});

export const createDeviceModelSchema = z.object({
  body: z.object({
    vendorId: z
      .string()
      .regex(UUID_REGEX, 'Invalid vendor ID (must be a UUID v4)'),

    model: z
      .string()
      .trim()
      .min(1, 'Model name cannot be empty')
      .max(150, 'Model name cannot exceed 150 characters'),

    deviceType: z.enum(DEVICE_TYPES, {
      error: () => ({
        message: `deviceType must be one of: ${DEVICE_TYPES.join(', ')}`
      })
    }),

    isWireless: z.boolean().optional()
  })
});

export const updateDeviceModelSchema = z.object({
  params: z.object({
    id: z
      .string()
      .regex(
        UUID_REGEX,
        'Invalid device model ID (must be a UUID v4)'
      )
  }),
  body: z
    .object({
      vendorId: z
        .string()
        .regex(UUID_REGEX, 'Invalid vendor ID (must be a UUID v4)')
        .optional(),

      model: z
        .string()
        .trim()
        .min(1, 'Model name cannot be empty')
        .max(150, 'Model name cannot exceed 150 characters')
        .optional(),

      deviceType: z
        .enum(DEVICE_TYPES, {
          error: () => ({
            message: `deviceType must be one of: ${DEVICE_TYPES.join(', ')}`
          })
        })
        .optional(),

      isWireless: z.boolean().optional()
    })
    .refine(
      (body) =>
        body.vendorId !== undefined ||
        body.model !== undefined ||
        body.deviceType !== undefined ||
        body.isWireless !== undefined,
      { message: 'At least one field must be provided for update' }
    )
});

export const deleteDeviceModelSchema = z.object({
  params: z.object({
    id: z
      .string()
      .regex(
        UUID_REGEX,
        'Invalid device model ID (must be a UUID v4)'
      )
  })
});

export type CreateDeviceModelInput = z.infer<
  typeof createDeviceModelSchema
>['body'];
export type UpdateDeviceModelInput = z.infer<
  typeof updateDeviceModelSchema
>['body'];
export type UpdateDeviceModelParams = z.infer<
  typeof updateDeviceModelSchema
>['params'];
export type ListDeviceModelsQuery = z.infer<
  typeof listDeviceModelsSchema
>['query'];
export type GetDeviceModelByIdParams = z.infer<
  typeof getDeviceModelByIdSchema
>['params'];
export type DeleteDeviceModelParams = z.infer<
  typeof deleteDeviceModelSchema
>['params'];
