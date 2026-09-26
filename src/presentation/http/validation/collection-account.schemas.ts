import { z } from 'zod';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const uuidField = (label: string) =>
  z
    .string()
    .regex(UUID_REGEX, `Invalid ${label} (must be a UUID v4)`);

const COLLECTION_ACCOUNT_STATUS_VALUES = [
  'PENDING',
  'PAID',
  'CANCELLED'
] as const;

const lineItemSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, 'description is required')
    .max(500),
  unitPrice: z.number().nonnegative(),
  quantity: z.number().int().positive()
});

export const createCollectionAccountSchema = z.object({
  body: z.object({
    customerId: uuidField('customerId').optional(),
    customerName: z.string().min(1).max(150).optional(),
    customerDocument: z.string().max(20).optional(),
    customerPhone: z.string().max(20).optional(),
    customerEmail: z.string().email().max(255).optional(),
    customerAddress: z.string().max(255).optional(),
    issueDate: z
      .string()
      .datetime({ message: 'issueDate must be an ISO 8601 datetime' })
      .optional(),
    dueDate: z
      .string()
      .datetime({ message: 'dueDate must be an ISO 8601 datetime' })
      .optional(),
    notes: z.string().optional(),
    lineItems: z
      .array(lineItemSchema)
      .min(1, 'At least one line item is required'),
    bankAccountIds: z
      .array(uuidField('bankAccountId'))
      .max(5, 'At most 5 bank accounts can be listed')
      .optional()
  })
});

export const collectionAccountIdParamSchema = z.object({
  params: z.object({
    id: uuidField('collection account ID')
  })
});

export const listCollectionAccountsSchema = z.object({
  query: z.object({
    customerId: uuidField('customerId').optional(),
    status: z.enum(COLLECTION_ACCOUNT_STATUS_VALUES).optional(),
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
