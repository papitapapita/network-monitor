import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';
import { createRateLimiter, validateRequest } from '../middleware';
import { loginSchema } from '../validation/auth.schemas';

export function createAuthRoutes(controller: AuthController): Router {
  const router = Router();

  router.post(
    '/login',
    createRateLimiter('sign-in'),
    validateRequest(loginSchema),
    controller.login
  );

  return router;
}
