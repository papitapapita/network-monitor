import { z } from 'zod';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const nameField = z
  .string()
  .trim()
  .min(1, 'Service plan name cannot be empty')
  .max(100, 'Service plan name cannot exceed 100 characters');

const bandwidthField = z
  .number()
  .int('Bandwidth must be an integer')
  .positive('Bandwidth must be greater than 0');

const priceField = z
  .number()
  .nonnegative('Monthly price cannot be negative');

const descriptionField = z
  .string()
  .max(500, 'Description cannot exceed 500 characters')
  .nullable()
  .optional();

export const createServicePlanSchema = z.object({
  body: z.object({
    name: nameField,
    downloadMbps: bandwidthField,
    uploadMbps: bandwidthField,
    monthlyPrice: priceField,
    description: descriptionField,
    isActive: z.boolean().optional()
  })
});

export const updateServicePlanSchema = z.object({
  params: z.object({
    id: z
      .string()
      .regex(UUID_REGEX, 'Invalid service plan ID (must be a UUID v4)')
  }),
  body: z
    .object({
      name: nameField.optional(),
      downloadMbps: bandwidthField.optional(),
      uploadMbps: bandwidthField.optional(),
      monthlyPrice: priceField.optional(),
      description: descriptionField,
      isActive: z.boolean().optional()
    })
    .refine((body) => Object.keys(body).length > 0, {
      message: 'At least one field must be provided for update'
    })
});

export const getServicePlanByIdSchema = z.object({
  params: z.object({
    id: z
      .string()
      .regex(UUID_REGEX, 'Invalid service plan ID (must be a UUID v4)')
  })
});

export const deleteServicePlanSchema = z.object({
  params: z.object({
    id: z
      .string()
      .regex(UUID_REGEX, 'Invalid service plan ID (must be a UUID v4)')
  })
});

export const listServicePlansSchema = z.object({
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
