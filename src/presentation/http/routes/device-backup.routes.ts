import { Router } from 'express';
import { DeviceBackupController } from '../controllers';
import {
  authorize,
  createRateLimiter,
  validateRequest
} from '../middleware';
import {
  backUpDeviceNowSchema,
  diffDeviceBackupsSchema,
  downloadDeviceBackupSchema,
  listDeviceBackupsSchema
} from '../validation';

/**
 * Device configuration backups — mounted under /api/devices
 *
 * GET  /api/devices/:id/backups                     — versions and the latest attempt
 * POST /api/devices/:id/backups                     — back up now
 * GET  /api/devices/:id/backups/:backupId/download  — the saved file
 * GET  /api/devices/:id/backups/diff?from=&to=       — what changed between two
 *
 * The file carries the device's passwords and wireless keys, so downloading it
 * sits behind `manage-credentials`, like writing those credentials (BKP-041).
 * The diff masks those values but still shows the whole configuration around
 * a change, so it sits behind the same permission (BKP-072).
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
  router.get(
    '/:id/backups/diff',
    authorize('manage-credentials'),
    createRateLimiter('read'),
    validateRequest(diffDeviceBackupsSchema),
    controller.diff
  );

  return router;
}
