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
  // deviceType is not accepted: radio mode is derived from the device's
  // category, so linkCapacityKbps/clientsProvisionedLimit are cross-checked
  // in CreateWirelessConfigUseCase where that category is known.
  body: z.object({
    ipAddress: z
      .union([z.string().ipv4(), z.string().ipv6(), z.null()])
      .optional(),
    // Floor matches PollingInterval's MIN_SECONDS: polling AirOS faster
    // than this overloads the embedded web server on the radio.
    intervalSecs: z.number().int().min(60).max(86400).optional(),
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
      .optional(),
    provisionedLanSpeedMbps: z
      .number()
      .int()
      .positive()
      .nullable()
      .optional()
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
      // Floor matches PollingInterval's MIN_SECONDS: polling AirOS faster
      // than this overloads the embedded web server on the radio.
      intervalSecs: z.number().int().min(60).max(86400).optional(),
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
        .optional(),
      provisionedLanSpeedMbps: z
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

export const clearWirelessAlertSchema = z.object({
  params: z.object({ id: uuidSchema, alertId: uuidSchema })
});

export const bulkClearWirelessAlertsSchema = z.object({
  params: z.object({ id: uuidSchema }),
  body: z
    .object({
      ids: z.array(uuidSchema).min(1).optional()
    })
    .optional()
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
export type ClearWirelessAlertInput = z.infer<
  typeof clearWirelessAlertSchema
>;
export type BulkClearWirelessAlertsInput = z.infer<
  typeof bulkClearWirelessAlertsSchema
>;
