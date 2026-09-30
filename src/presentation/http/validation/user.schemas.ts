import { z } from 'zod';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// VENDOR is left out on purpose: only the boot assigns it (IDN-141).
const staffRole = z.enum(['ADMIN', 'OPERATOR', 'VIEWER'], {
  message: 'role must be one of: ADMIN, OPERATOR, VIEWER'
});
const password = z
  .string()
  .max(200, 'password must not exceed 200 characters');

export const createUserSchema = z.object({
  body: z.object({
    email: z.string().trim().min(1, 'email is required').max(255),
    password,
    role: staffRole
  })
});

export const updateUserSchema = z.object({
  params: z.object({
    id: z
      .string()
      .regex(UUID_REGEX, 'Invalid user ID (must be a UUID v4)')
  }),
  body: z
    .object({
      role: staffRole.optional(),
      disabled: z.boolean().optional(),
      password: password.optional()
    })
    .strict()
    .refine(
      (b) =>
        b.role !== undefined ||
        b.disabled !== undefined ||
        b.password !== undefined,
      { message: 'Nothing to update' }
    )
});

export const changeOwnPasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, 'currentPassword is required'),
    newPassword: password
  })
});
