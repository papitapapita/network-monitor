import { z } from 'zod';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const bankAccountIdParams = z.object({
  id: z
    .string()
    .regex(UUID_REGEX, 'Invalid bank account ID (must be a UUID v4)')
});

const BANK_ACCOUNT_TYPE_VALUES = ['SAVINGS', 'CHECKING'] as const;

const bankName = z
  .string()
  .trim()
  .min(1, 'bankName is required')
  .max(100);
const accountNumber = z
  .string()
  .trim()
  .regex(
    /^\d[\d -]{2,28}\d$/,
    'accountNumber must be 4 to 30 digits, optionally separated by spaces or dashes'
  );

export const createBankAccountSchema = z.object({
  body: z.object({
    bankName,
    accountType: z.enum(BANK_ACCOUNT_TYPE_VALUES),
    accountNumber
  })
});

export const updateBankAccountSchema = z.object({
  params: bankAccountIdParams,
  body: z.object({
    bankName: bankName.optional(),
    accountType: z.enum(BANK_ACCOUNT_TYPE_VALUES).optional(),
    accountNumber: accountNumber.optional()
  })
});

export const bankAccountIdParamSchema = z.object({
  params: bankAccountIdParams
});
