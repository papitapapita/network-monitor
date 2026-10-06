import { Request, Response, NextFunction } from 'express';
import { ITokenService } from 'application/identity/interfaces/ITokenService';
import {
  INVALID_SESSION,
  SessionValidator
} from 'application/identity/services/SessionValidator';
import { readCookie, SESSION_COOKIE } from './sessionCookies';

export const CROSS_SITE_REFUSED = 'Cross-site request refused';
const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

// A Bearer header wins; a browser sends the session cookie instead (IDN-084).
export function findSessionToken(
  req: Request
): { token: string; fromCookie: boolean } | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    return { token: header.slice(7), fromCookie: false };
  }
  const cookie = readCookie(req, SESSION_COOKIE);
  return cookie ? { token: cookie, fromCookie: true } : null;
}

// The browser attaches the cookie to whatever request a page makes, so a
// change signed by it must come from one of our own dashboards. A missing
// Origin is refused too: browsers always send it on these requests (IDN-085).
function isFromAllowedOrigin(
  req: Request,
  allowedOrigins: string[]
): boolean {
  if (SAFE_METHODS.includes(req.method)) return true;
  const origin = req.headers.origin;
  return (
    typeof origin === 'string' && allowedOrigins.includes(origin)
  );
}

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
  sessions: SessionValidator,
  allowedOrigins: string[] = []
) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const found = findSessionToken(req);

    if (!found) {
      res
        .status(401)
        .json({ success: false, error: 'Authentication required' });
      return;
    }

    if (
      found.fromCookie &&
      !isFromAllowedOrigin(req, allowedOrigins)
    ) {
      res
        .status(403)
        .json({ success: false, error: CROSS_SITE_REFUSED });
      return;
    }

    await authenticateToken(
      found.token,
      tokenService,
      sessions,
      req,
      res,
      next
    );
  };
}
