import { z } from 'zod';

const uuidSchema = z.string().uuid();

const alertQueryFields = {
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional()
};

export const getWirelessStatusSchema = z.object({
  params: z.object({ id: uuidSchema })
});

export const getWirelessHistorySchema = z.object({
  params: z.object({ id: uuidSchema }),
  query: z.object({
    from: z.string().datetime({ offset: true }),
    to: z.string().datetime({ offset: true }),
    limit: z.coerce.number().int().min(1).max(1000).optional()
  })
});

export const getWirelessClientsSchema = z.object({
  params: z.object({ id: uuidSchema })
});

export const getDeviceWirelessAlertsSchema = z.object({
  params: z.object({ id: uuidSchema }),
  query: z.object(alertQueryFields).optional()
});

export const getDeviceWirelessAlertHistorySchema = z.object({
  params: z.object({ id: uuidSchema }),
  query: z.object(alertQueryFields).optional()
});

export const triggerWirelessPollSchema = z.object({
  params: z.object({ id: uuidSchema })
});

export const rebootWirelessDeviceSchema = z.object({
  params: z.object({ id: uuidSchema })
});

export const getAllActiveAlertsSchema = z.object({
  query: z
    .object({
      deviceId: uuidSchema.optional()
    })
    .optional()
});

export const getAllAlertHistorySchema = z.object({
  query: z
    .object({
      deviceId: uuidSchema.optional(),
      ...alertQueryFields
    })
    .optional()
});

export const createWirelessConfigSchema = z.object({
  params: z.object({ id: uuidSchema }),
  body: z
    .object({
      deviceType: z.enum(['STATION', 'ACCESS_POINT']),
      ipAddress: z
        .union([z.string().ipv4(), z.string().ipv6(), z.null()])
        .optional(),
      intervalSecs: z.number().int().min(30).max(86400).optional(),
      enabled: z.boolean().optional(),
      linkCapacityKbps: z
        .number()
        .int()
        .positive()
        .nullable()
        .optional(),
      clientsProvisionedLimit: z
        .number()
        .int()
        .positive()
        .nullable()
        .optional()
    })
    .superRefine((data, ctx) => {
      if (data.deviceType === 'ACCESS_POINT' && data.linkCapacityKbps != null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'linkCapacityKbps can only be set for STATION devices',
          path: ['linkCapacityKbps']
        });
      }
      if (
        data.deviceType === 'STATION' &&
        data.clientsProvisionedLimit != null
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'clientsProvisionedLimit can only be set for ACCESS_POINT devices',
          path: ['clientsProvisionedLimit']
        });
      }
    })
});

export const getWirelessConfigSchema = z.object({
  params: z.object({ id: uuidSchema })
});

export const updateWirelessConfigSchema = z.object({
  params: z.object({ id: uuidSchema }),
  body: z
    .object({
      ipAddress: z
        .union([z.string().ipv4(), z.string().ipv6(), z.null()])
        .optional(),
      intervalSecs: z.number().int().min(30).max(86400).optional(),
      enabled: z.boolean().optional(),
      linkCapacityKbps: z
        .number()
        .int()
        .positive()
        .nullable()
        .optional(),
      clientsProvisionedLimit: z
        .number()
        .int()
        .positive()
        .nullable()
        .optional()
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be provided'
    })
});

export const deleteWirelessConfigSchema = z.object({
  params: z.object({ id: uuidSchema })
});

export type GetWirelessStatusInput = z.infer<
  typeof getWirelessStatusSchema
>;
export type GetWirelessHistoryInput = z.infer<
  typeof getWirelessHistorySchema
>;
export type GetWirelessClientsInput = z.infer<
  typeof getWirelessClientsSchema
>;
export type GetDeviceWirelessAlertsInput = z.infer<
  typeof getDeviceWirelessAlertsSchema
>;
export type GetDeviceWirelessAlertHistoryInput = z.infer<
  typeof getDeviceWirelessAlertHistorySchema
>;
export type TriggerWirelessPollInput = z.infer<
  typeof triggerWirelessPollSchema
>;
export type RebootWirelessDeviceInput = z.infer<
  typeof rebootWirelessDeviceSchema
>;
export type GetAllActiveAlertsInput = z.infer<
  typeof getAllActiveAlertsSchema
>;
export type GetAllAlertHistoryInput = z.infer<
  typeof getAllAlertHistorySchema
>;
export type CreateWirelessConfigInput = z.infer<
  typeof createWirelessConfigSchema
>;
export type GetWirelessConfigInput = z.infer<
  typeof getWirelessConfigSchema
>;
export type UpdateWirelessConfigInput = z.infer<
  typeof updateWirelessConfigSchema
>;
export type DeleteWirelessConfigInput = z.infer<
  typeof deleteWirelessConfigSchema
>;
