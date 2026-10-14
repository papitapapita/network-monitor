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
  changeOwnPasswordSchema,
  unlockCredentialRevealSchema
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

  // Only wrong passwords spend the budget, as at sign-in (IDN-086).
  router.post(
    '/me/credential-reveal',
    authorize('reveal-credentials'),
    createRateLimiter('sign-in'),
    validateRequest(unlockCredentialRevealSchema),
    controller.unlockCredentialReveal
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

  router.post(
    '/:id/two-factor/reset',
    authorize('manage-users'),
    createRateLimiter('write'),
    controller.resetTwoFactor
  );

  return router;
}
