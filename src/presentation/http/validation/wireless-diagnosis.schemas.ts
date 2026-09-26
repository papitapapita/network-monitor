import { z } from 'zod';

const uuidSchema = z.string().uuid();

// bounds mirror DiagnosisDuration; the domain re-checks them
export const startLinkDiagnosisSchema = z.object({
  params: z.object({ id: uuidSchema }),
  body: z
    .object({
      durationSeconds: z.number().int().min(10).max(300).optional()
    })
    .optional()
});

export const getLinkDiagnosisSchema = z.object({
  params: z.object({ id: uuidSchema })
});

export const stopLinkDiagnosisSchema = z.object({
  params: z.object({ id: uuidSchema })
});

export type StartLinkDiagnosisInput = z.infer<
  typeof startLinkDiagnosisSchema
>;
export type GetLinkDiagnosisInput = z.infer<
  typeof getLinkDiagnosisSchema
>;
export type StopLinkDiagnosisInput = z.infer<
  typeof stopLinkDiagnosisSchema
>;
