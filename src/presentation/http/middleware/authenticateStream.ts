import { Request, Response, NextFunction } from 'express';
import { ITokenService } from 'application/identity/interfaces/ITokenService';

/**
 * Authenticates SSE routes, which accept `?token=` in addition to the Bearer
 * header. Browser `EventSource` has no API for setting headers, so a stream is
 * unreachable without it.
 *
 * Deliberately separate from createAuthenticateMiddleware so no ordinary route
 * gains a query-token path. Both request loggers print `req.path`, which
 * excludes the query string, so the token stays out of the logs.
 */
export function createStreamAuthenticateMiddleware(
  tokenService: ITokenService
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    const queryToken = req.query.token;

    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : typeof queryToken === 'string'
        ? queryToken
        : null;

    if (!token) {
      res
        .status(401)
        .json({ success: false, error: 'Authentication required' });
      return;
    }

    const result = tokenService.verify(token);

    if (result.isFailure) {
      res.status(401).json({ success: false, error: 'Invalid token' });
      return;
    }

    req.user = result.value;
    next();
  };
}
