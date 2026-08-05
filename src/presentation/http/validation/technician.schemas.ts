import { z } from 'zod';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PHONE_REGEX = /^\+?[\d\s().-]{7,20}$/;

const technicianIdParam = z.object({
  id: z
    .string()
    .regex(UUID_REGEX, 'Invalid technician ID (must be a UUID v4)')
});

const nameField = z
  .string()
  .trim()
  .min(1, 'Technician name cannot be empty')
  .max(150, 'Technician name cannot exceed 150 characters');

const phoneField = z
  .string()
  .trim()
  .regex(PHONE_REGEX, 'Phone number is not valid');

const emailField = z
  .string()
  .trim()
  .email('Email is not valid')
  .max(255, 'Email cannot exceed 255 characters');

const userIdField = z
  .string()
  .regex(UUID_REGEX, 'Invalid user ID (must be a UUID v4)');

export const createTechnicianSchema = z.object({
  body: z.object({
    fullName: nameField,
    phone: phoneField,
    email: emailField.nullable().optional(),
    userId: userIdField.nullable().optional(),
    isActive: z.boolean().optional()
  })
});

export const updateTechnicianSchema = z.object({
  params: technicianIdParam,
  body: z
    .object({
      fullName: nameField.optional(),
      phone: phoneField.optional(),
      email: emailField.nullable().optional(),
      userId: userIdField.nullable().optional(),
      isActive: z.boolean().optional()
    })
    .refine((body) => Object.keys(body).length > 0, {
      message: 'At least one field must be provided for update'
    })
});

export const getTechnicianByIdSchema = z.object({
  params: technicianIdParam
});

export const deleteTechnicianSchema = z.object({
  params: technicianIdParam
});

export const listTechniciansSchema = z.object({
  query: z.object({
    activeOnly: z
      .enum(['true', 'false'])
      .transform((v) => v === 'true')
      .optional(),
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

export type CreateTechnicianInput = z.infer<
  typeof createTechnicianSchema
>['body'];
export type UpdateTechnicianInput = z.infer<
  typeof updateTechnicianSchema
>['body'];
export type ListTechniciansQuery = z.infer<
  typeof listTechniciansSchema
>['query'];
