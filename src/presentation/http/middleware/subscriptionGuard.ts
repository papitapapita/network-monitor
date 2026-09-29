import { Request, Response, NextFunction } from 'express';
import { ILogger } from 'application/shared/interfaces';
import { GetSubscriptionStatusUseCase } from 'application/shared/use-cases/GetSubscriptionStatusUseCase';

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export const SUBSCRIPTION_READ_ONLY_ERROR =
  'Subscription expired: the service is read-only until payment is received';
export const SUBSCRIPTION_LOCKED_ERROR =
  'Subscription expired: the service is locked until payment is received';

// ADR 0002, R17. Mounted ahead of every route of a router. `exempt` names the
// requests that must keep working even when locked — signing in, and reading
// the subscription status the lock screen shows. A failure to read the status
// lets the request through: a configuration problem must never lock out a
// paying customer.
export function createSubscriptionGuard(
  getStatus: GetSubscriptionStatusUseCase,
  logger: ILogger,
  exempt: (req: Request) => boolean = () => false
) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    if (exempt(req)) return next();

    const status = await getStatus.execute();
    if (status.isFailure) {
      logger.warn(
        'Subscription status unavailable; request allowed',
        {
          error: status.error
        }
      );
      return next();
    }
    if (status.value.locked) {
      res
        .status(402)
        .json({ success: false, error: SUBSCRIPTION_LOCKED_ERROR });
      return;
    }
    if (status.value.readOnly && !READ_METHODS.has(req.method)) {
      res
        .status(402)
        .json({
          success: false,
          error: SUBSCRIPTION_READ_ONLY_ERROR
        });
      return;
    }
    next();
  };
}
