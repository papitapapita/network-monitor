import { Request, Response, NextFunction } from 'express';
import { ITokenService } from 'application/identity/interfaces/ITokenService';
import { SessionValidator } from 'application/identity/services/SessionValidator';
import { authenticateToken, findSessionToken } from './authenticate';

/**
 * Authenticates SSE routes, which accept `?token=` in addition to the Bearer
 * header and the session cookie. Browser `EventSource` has no API for setting headers, so a stream is
 * unreachable without it.
 *
 * Deliberately separate from createAuthenticateMiddleware so no ordinary route
 * gains a query-token path. Both request loggers print `req.path`, which
 * excludes the query string, so the token stays out of the logs.
 */
export function createStreamAuthenticateMiddleware(
  tokenService: ITokenService,
  sessions: SessionValidator
) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const queryToken = req.query.token;

    // EventSource sends the session cookie when opened withCredentials.
    const token =
      findSessionToken(req)?.token ??
      (typeof queryToken === 'string' ? queryToken : null);

    if (!token) {
      res
        .status(401)
        .json({ success: false, error: 'Authentication required' });
      return;
    }

    await authenticateToken(
      token,
      tokenService,
      sessions,
      req,
      res,
      next
    );
  };
}
