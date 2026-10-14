import { z } from 'zod';

const uuidSchema = z.string().uuid();

const severityPair = z
  .object({ warning: z.number(), critical: z.number() })
  .strict();

const channelWidthTable = z.record(
  z.string().regex(/^\d+$/),
  z.number()
);

// Shape only; the ranges and ordering live in AlertThresholds (WLS-200).
const thresholdsShape = z
  .object({
    signalDbm: severityPair,
    snrDb: severityPair,
    ccqPercent: severityPair,
    latencyMs: severityPair,
    cpuPercent: z.number(),
    memoryPercent: z.number(),
    clockDriftSeconds: z.number(),
    saturationPercent: z.number(),
    clientDropPercent: z.number(),
    minCapacityMbps: channelWidthTable,
    maxDistanceKm: channelWidthTable,
    confirmBeforeAlerting: z.boolean()
  })
  .strict();

export const updateAlertThresholdsSchema = z.object({
  body: thresholdsShape.partial({ confirmBeforeAlerting: true })
});

export const getDeviceAlertThresholdsSchema = z.object({
  params: z.object({ id: uuidSchema })
});

export const updateDeviceAlertThresholdsSchema = z.object({
  params: z.object({ id: uuidSchema }),
  body: z.object({ overrides: thresholdsShape.partial() }).strict()
});
