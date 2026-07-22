import { z } from 'zod';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const uuidField = (label: string) =>
  z
    .string()
    .regex(UUID_REGEX, `Invalid ${label} (must be a UUID v4)`);

const BILL_STATUS_VALUES = [
  'PENDING',
  'PAID',
  'OVERDUE',
  'CANCELLED'
] as const;

const YEAR_MIN = 2000;
const YEAR_MAX = 2100;

const yearField = z
  .number()
  .int()
  .min(YEAR_MIN, `Year must be between ${YEAR_MIN} and ${YEAR_MAX}`)
  .max(YEAR_MAX, `Year must be between ${YEAR_MIN} and ${YEAR_MAX}`);

const monthField = z
  .number()
  .int()
  .min(1, 'Month must be between 1 and 12')
  .max(12, 'Month must be between 1 and 12');

export const generateBillSchema = z.object({
  body: z.object({
    customerId: uuidField('customerId'),
    year: yearField,
    month: monthField,
    issueDate: z
      .string()
      .datetime({ message: 'issueDate must be an ISO 8601 datetime' })
      .optional(),
    dueDate: z
      .string()
      .datetime({ message: 'dueDate must be an ISO 8601 datetime' })
      .optional()
  })
});

export const generateBillsForPeriodSchema = z.object({
  body: z.object({
    year: yearField,
    month: monthField,
    issueDate: z
      .string()
      .datetime({ message: 'issueDate must be an ISO 8601 datetime' })
      .optional(),
    dueDate: z
      .string()
      .datetime({ message: 'dueDate must be an ISO 8601 datetime' })
      .optional()
  })
});

export const getBillByIdSchema = z.object({
  params: z.object({
    id: uuidField('bill ID')
  })
});

export const billIdParamSchema = z.object({
  params: z.object({
    id: uuidField('bill ID')
  })
});

export const listBillsSchema = z.object({
  query: z.object({
    customerId: uuidField('customerId').optional(),
    status: z.enum(BILL_STATUS_VALUES).optional(),
    year: z
      .string()
      .regex(/^\d+$/, 'Year must be a positive integer')
      .transform(Number)
      .refine((n) => n >= YEAR_MIN && n <= YEAR_MAX, {
        message: `Year must be between ${YEAR_MIN} and ${YEAR_MAX}`
      })
      .optional(),
    month: z
      .string()
      .regex(/^\d+$/, 'Month must be a positive integer')
      .transform(Number)
      .refine((n) => n >= 1 && n <= 12, {
        message: 'Month must be between 1 and 12'
      })
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
