import { z } from 'zod';

export const listInboxNotificationsSchema = z.object({
  query: z
    .object({
      unread: z.enum(['true', 'false']).optional(),
      limit: z.coerce.number().int().min(1).max(100).optional(),
      offset: z.coerce.number().int().min(0).optional()
    })
    .optional()
});

export const markInboxNotificationReadSchema = z.object({
  params: z.object({ id: z.string().uuid() })
});
