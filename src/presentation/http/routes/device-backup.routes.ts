import { Router } from 'express';
import { DeviceBackupController } from '../controllers';
import {
  authorize,
  createRateLimiter,
  validateRequest
} from '../middleware';
import {
  backUpDeviceNowSchema,
  downloadDeviceBackupSchema,
  listDeviceBackupsSchema
} from '../validation';

/**
 * Device configuration backups — mounted under /api/devices
 *
 * GET  /api/devices/:id/backups                     — the kept copy and the latest attempt
 * POST /api/devices/:id/backups                     — back up now
 * GET  /api/devices/:id/backups/:backupId/download  — the saved file
 *
 * The file carries the device's passwords and wireless keys, so downloading it
 * sits behind `manage-credentials`, like writing those credentials (BKP-041).
 */
export function createDeviceBackupRoutes(
  controller: DeviceBackupController
): Router {
  const router = Router({ mergeParams: true });

  router.get(
    '/:id/backups',
    authorize('read'),
    createRateLimiter('read'),
    validateRequest(listDeviceBackupsSchema),
    controller.list
  );
  router.post(
    '/:id/backups',
    authorize('update'),
    createRateLimiter('write'),
    validateRequest(backUpDeviceNowSchema),
    controller.backUpNow
  );
  router.get(
    '/:id/backups/:backupId/download',
    authorize('manage-credentials'),
    createRateLimiter('read'),
    validateRequest(downloadDeviceBackupSchema),
    controller.download
  );

  return router;
}
