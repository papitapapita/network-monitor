import { z } from 'zod';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const createVendorSchema = z.object({
  body: z.object({
    name: z
      .string()
      .trim()
      .min(1, 'Vendor name cannot be empty')
      .max(100, 'Vendor name cannot exceed 100 characters'),

    slug: z
      .string()
      .trim()
      .min(1, 'Vendor slug cannot be empty')
      .max(100, 'Vendor slug cannot exceed 100 characters')
      .regex(
        SLUG_REGEX,
        'Slug must contain only lowercase letters, digits, and hyphens (e.g. "tp-link")'
      ),

    description: z
      .string()
      .max(500, 'Description cannot exceed 500 characters')
      .nullable()
      .optional()
  })
});

export const updateVendorSchema = z.object({
  params: z.object({
    id: z
      .string()
      .regex(UUID_REGEX, 'Invalid vendor ID (must be a UUID v4)')
  }),
  body: z
    .object({
      name: z
        .string()
        .trim()
        .min(1, 'Vendor name cannot be empty')
        .max(100, 'Vendor name cannot exceed 100 characters')
        .optional(),

      slug: z
        .string()
        .trim()
        .min(1, 'Vendor slug cannot be empty')
        .max(100, 'Vendor slug cannot exceed 100 characters')
        .regex(
          SLUG_REGEX,
          'Slug must contain only lowercase letters, digits, and hyphens (e.g. "tp-link")'
        )
        .optional(),

      description: z
        .string()
        .max(500, 'Description cannot exceed 500 characters')
        .nullable()
        .optional()
    })
    .refine(
      (body) =>
        body.name !== undefined ||
        body.slug !== undefined ||
        body.description !== undefined,
      { message: 'At least one field must be provided for update' }
    )
});

export const getVendorByIdSchema = z.object({
  params: z.object({
    id: z
      .string()
      .regex(UUID_REGEX, 'Invalid vendor ID (must be a UUID v4)')
  })
});

export const deleteVendorSchema = z.object({
  params: z.object({
    id: z
      .string()
      .regex(UUID_REGEX, 'Invalid vendor ID (must be a UUID v4)')
  })
});

export const listVendorsSchema = z.object({
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

export type CreateVendorInput = z.infer<
  typeof createVendorSchema
>['body'];
export type UpdateVendorInput = z.infer<
  typeof updateVendorSchema
>['body'];
export type UpdateVendorParams = z.infer<
  typeof updateVendorSchema
>['params'];
export type GetVendorByIdParams = z.infer<
  typeof getVendorByIdSchema
>['params'];
export type DeleteVendorParams = z.infer<
  typeof deleteVendorSchema
>['params'];
export type ListVendorsQuery = z.infer<
  typeof listVendorsSchema
>['query'];
