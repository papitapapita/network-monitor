import { z } from 'zod';

const uuidSchema = z.string().uuid();

export const listDeviceBackupsSchema = z.object({
  params: z.object({ id: uuidSchema })
});

export const backUpDeviceNowSchema = z.object({
  params: z.object({ id: uuidSchema })
});

export const downloadDeviceBackupSchema = z.object({
  params: z.object({ id: uuidSchema, backupId: uuidSchema })
});

export const diffDeviceBackupsSchema = z.object({
  params: z.object({ id: uuidSchema }),
  query: z.object({ from: uuidSchema, to: uuidSchema })
});

export type ListDeviceBackupsInput = z.infer<
  typeof listDeviceBackupsSchema
>;
export type BackUpDeviceNowInput = z.infer<
  typeof backUpDeviceNowSchema
>;
export type DownloadDeviceBackupInput = z.infer<
  typeof downloadDeviceBackupSchema
>;
export type DiffDeviceBackupsInput = z.infer<
  typeof diffDeviceBackupsSchema
>;
