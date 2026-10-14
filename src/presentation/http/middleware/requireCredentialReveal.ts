import { Request, Response, NextFunction } from 'express';
import {
  CREDENTIAL_REVEAL_LOCKED,
  CredentialRevealGate
} from 'application/identity/services/CredentialRevealGate';

export const CREDENTIAL_REVEAL_HEADER = 'x-credential-reveal-token';

// Runs after authenticate, so req.user is the session the unlock must match
// (IDN-086).
export function createRequireCredentialRevealMiddleware(
  gate: CredentialRevealGate
) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const header = req.headers[CREDENTIAL_REVEAL_HEADER];
    const token = typeof header === 'string' ? header : null;

    try {
      const checked = await gate.check(token, req.user!.userId);
      if (checked.isFailure) {
        const locked = checked.error === CREDENTIAL_REVEAL_LOCKED;
        res.status(locked ? 403 : 500).json({
          success: false,
          error: locked
            ? CREDENTIAL_REVEAL_LOCKED
            : 'Internal server error'
        });
        return;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
