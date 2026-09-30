import { Request, Response, NextFunction } from 'express';
import { ITokenService } from 'application/identity/interfaces/ITokenService';
import {
  INVALID_SESSION,
  SessionValidator
} from 'application/identity/services/SessionValidator';

// Shared by the Bearer and the stream middleware once each has found a token.
export async function authenticateToken(
  token: string,
  tokenService: ITokenService,
  sessions: SessionValidator,
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const verified = tokenService.verify(token);
  if (verified.isFailure) {
    res.status(401).json({ success: false, error: INVALID_SESSION });
    return;
  }

  try {
    const session = await sessions.validate(verified.value);
    if (session.isFailure) {
      const status = session.error === INVALID_SESSION ? 401 : 500;
      res.status(status).json({
        success: false,
        error:
          status === 401 ? INVALID_SESSION : 'Internal server error'
      });
      return;
    }
    req.user = session.value;
    next();
  } catch (error) {
    next(error);
  }
}

export function createAuthenticateMiddleware(
  tokenService: ITokenService,
  sessions: SessionValidator
) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res
        .status(401)
        .json({ success: false, error: 'Authentication required' });
      return;
    }

    await authenticateToken(
      authHeader.slice(7),
      tokenService,
      sessions,
      req,
      res,
      next
    );
  };
}
