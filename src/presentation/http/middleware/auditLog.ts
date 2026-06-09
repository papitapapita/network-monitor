import { Request, Response, NextFunction } from 'express';
import { ILogger } from 'application/shared/interfaces';

export function createAuditLogMiddleware(logger: ILogger) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const startedAt = Date.now();

    res.on('finish', () => {
      logger.info('Audit', {
        userId: req.user?.userId ?? 'anonymous',
        role: req.user?.role ?? 'none',
        method: req.method,
        path: req.path,
        ip: req.ip,
        statusCode: res.statusCode,
        durationMs: Date.now() - startedAt
      });
    });

    next();
  };
}
