import { Request, Response, NextFunction } from 'express';
import { ITokenService } from 'application/identity/interfaces/ITokenService';

export function createAuthenticateMiddleware(
  tokenService: ITokenService
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res
        .status(401)
        .json({ success: false, error: 'Authentication required' });
      return;
    }

    const token = authHeader.slice(7);
    const result = tokenService.verify(token);

    if (result.isFailure) {
      res
        .status(401)
        .json({ success: false, error: 'Invalid token' });
      return;
    }

    req.user = result.value;
    next();
  };
}
