import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';
import { validateRequest } from '../middleware';
import { loginSchema } from '../validation/auth.schemas';

export function createAuthRoutes(controller: AuthController): Router {
  const router = Router();

  router.post(
    '/login',
    validateRequest(loginSchema),
    controller.login
  );

  return router;
}
