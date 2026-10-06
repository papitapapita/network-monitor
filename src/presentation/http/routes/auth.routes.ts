import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';
import { createRateLimiter, validateRequest } from '../middleware';
import {
  confirmTwoFactorSetupSchema,
  loginSchema,
  verifyTwoFactorSchema
} from '../validation/auth.schemas';

export function createAuthRoutes(controller: AuthController): Router {
  const router = Router();
  // One budget for every step, so wrong codes and wrong passwords from an
  // address add up (IDN-103).
  const signIn = createRateLimiter('sign-in');

  router.post(
    '/login',
    signIn,
    validateRequest(loginSchema),
    controller.login
  );
  router.post(
    '/two-factor/setup',
    signIn,
    controller.startTwoFactorSetup
  );
  router.post(
    '/two-factor/setup/confirm',
    signIn,
    validateRequest(confirmTwoFactorSetupSchema),
    controller.confirmTwoFactorSetup
  );
  router.post(
    '/two-factor/verify',
    signIn,
    validateRequest(verifyTwoFactorSchema),
    controller.verifyTwoFactor
  );

  router.post('/logout', controller.logout);

  return router;
}
