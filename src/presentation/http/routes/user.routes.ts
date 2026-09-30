import { Router } from 'express';
import { UserController } from '../controllers';
import {
  validateRequest,
  authorize,
  createRateLimiter
} from '../middleware';
import {
  createUserSchema,
  updateUserSchema,
  changeOwnPasswordSchema
} from '../validation';

// The customer's administrator manages the staff; everyone manages their own
// password (IDN-140).
export function createUserRoutes(controller: UserController): Router {
  const router = Router();

  router.post(
    '/me/password',
    authorize('read'),
    createRateLimiter('write'),
    validateRequest(changeOwnPasswordSchema),
    controller.changeOwnPassword
  );

  router.get(
    '/',
    authorize('manage-users'),
    createRateLimiter('read'),
    controller.list
  );

  router.post(
    '/',
    authorize('manage-users'),
    createRateLimiter('write'),
    validateRequest(createUserSchema),
    controller.create
  );

  router.patch(
    '/:id',
    authorize('manage-users'),
    createRateLimiter('write'),
    validateRequest(updateUserSchema),
    controller.update
  );

  return router;
}
