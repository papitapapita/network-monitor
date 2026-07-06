import { z } from 'zod';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const uuidField = (label: string) =>
  z.string().regex(UUID_REGEX, `Invalid ${label} (must be a UUID v4)`);

const STATUS_VALUES = ['ACTIVE', 'SUSPENDED', 'CANCELLED'] as const;

export const createContractedServiceSchema = z.object({
  body: z.object({
    customerId: uuidField('customerId'),
    servicePlanId: uuidField('servicePlanId'),
    deviceId: uuidField('deviceId').nullable().optional(),
    startDate: z
      .string()
      .datetime({ message: 'startDate must be an ISO 8601 datetime' })
      .optional()
  })
});

export const updateContractedServiceSchema = z.object({
  params: z.object({
    id: uuidField('contracted service ID')
  }),
  body: z
    .object({
      servicePlanId: uuidField('servicePlanId').optional(),
      deviceId: uuidField('deviceId').nullable().optional(),
      status: z.enum(STATUS_VALUES).optional()
    })
    .refine(
      (body) =>
        body.servicePlanId !== undefined ||
        body.deviceId !== undefined ||
        body.status !== undefined,
      { message: 'At least one field must be provided for update' }
    )
});

export const getContractedServiceByIdSchema = z.object({
  params: z.object({
    id: uuidField('contracted service ID')
  })
});

export const deleteContractedServiceSchema = z.object({
  params: z.object({
    id: uuidField('contracted service ID')
  })
});

export const listContractedServicesSchema = z.object({
  query: z.object({
    customerId: uuidField('customerId').optional(),
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
