import { z } from 'zod';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const uuidField = (label: string) =>
  z
    .string()
    .regex(UUID_REGEX, `Invalid ${label} (must be a UUID v4)`);

const QUOTATION_STATUS_VALUES = [
  'DRAFT',
  'SENT',
  'ACCEPTED',
  'REJECTED',
  'EXPIRED'
] as const;

const lineItemSchema = z.object({
  deviceModelId: uuidField('deviceModelId'),
  description: z.string().min(1).optional(),
  unitPrice: z.number().nonnegative(),
  quantity: z.number().int().positive()
});

export const createQuotationSchema = z.object({
  body: z.object({
    customerId: uuidField('customerId').optional(),
    customerName: z.string().min(1).optional(),
    customerPhone: z.string().optional(),
    customerEmail: z.string().email().optional(),
    customerAddress: z.string().optional(),
    validUntil: z.string().datetime({
      message: 'validUntil must be an ISO 8601 datetime'
    }),
    notes: z.string().optional(),
    lineItems: z
      .array(lineItemSchema)
      .min(1, 'At least one line item is required')
  })
});

export const quotationIdParamSchema = z.object({
  params: z.object({
    id: uuidField('quotation ID')
  })
});

export const updateQuotationLineItemsSchema = z.object({
  params: z.object({
    id: uuidField('quotation ID')
  }),
  body: z.object({
    lineItems: z
      .array(lineItemSchema)
      .min(1, 'At least one line item is required')
  })
});

export const updateQuotationDetailsSchema = z.object({
  params: z.object({
    id: uuidField('quotation ID')
  }),
  body: z.object({
    validUntil: z
      .string()
      .datetime({
        message: 'validUntil must be an ISO 8601 datetime'
      })
      .optional(),
    notes: z.string().optional(),
    customerName: z.string().min(1).optional(),
    customerPhone: z.string().optional(),
    customerEmail: z.string().email().optional(),
    customerAddress: z.string().optional()
  })
});

export const rejectQuotationSchema = z.object({
  params: z.object({
    id: uuidField('quotation ID')
  }),
  body: z.object({
    reason: z
      .string()
      .min(1, 'A reason is required to reject a quotation')
  })
});

export const listQuotationsSchema = z.object({
  query: z.object({
    customerId: uuidField('customerId').optional(),
    status: z.enum(QUOTATION_STATUS_VALUES).optional(),
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
