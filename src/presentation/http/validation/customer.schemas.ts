import { z } from 'zod';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PHONE_REGEX = /^\+?[\d\s().-]{7,20}$/;

const nameField = z
  .string()
  .trim()
  .min(1, 'Customer name cannot be empty')
  .max(150, 'Customer name cannot exceed 150 characters');

const phoneField = z
  .string()
  .trim()
  .regex(PHONE_REGEX, 'Phone number is not valid');

const emailField = z
  .string()
  .trim()
  .email('Email is not valid')
  .max(255, 'Email cannot exceed 255 characters');

const cedulaField = z
  .string()
  .trim()
  .regex(/^[\d.\s]{6,15}$/, 'Cedula must contain 6-10 digits');

export const createCustomerSchema = z.object({
  body: z.object({
    fullName: nameField,
    phone: phoneField,
    email: emailField.nullable().optional(),
    cedula: cedulaField.nullable().optional()
  })
});

export const updateCustomerSchema = z.object({
  params: z.object({
    id: z
      .string()
      .regex(UUID_REGEX, 'Invalid customer ID (must be a UUID v4)')
  }),
  body: z
    .object({
      fullName: nameField.optional(),
      phone: phoneField.optional(),
      email: emailField.nullable().optional(),
      cedula: cedulaField.nullable().optional()
    })
    .refine(
      (body) =>
        body.fullName !== undefined ||
        body.phone !== undefined ||
        body.email !== undefined ||
        body.cedula !== undefined,
      { message: 'At least one field must be provided for update' }
    )
});

export const getCustomerByIdSchema = z.object({
  params: z.object({
    id: z
      .string()
      .regex(UUID_REGEX, 'Invalid customer ID (must be a UUID v4)')
  })
});

export const deleteCustomerSchema = z.object({
  params: z.object({
    id: z
      .string()
      .regex(UUID_REGEX, 'Invalid customer ID (must be a UUID v4)')
  })
});

export const listCustomersSchema = z.object({
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
