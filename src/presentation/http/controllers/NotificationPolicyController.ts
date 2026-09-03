import { Request, Response } from 'express';
import { ILogger } from 'application/shared/interfaces';
import {
  GetDeviceNotificationPolicyUseCase,
  UpsertDeviceNotificationPolicyUseCase,
  DeleteDeviceNotificationPolicyUseCase,
  BulkUpsertDeviceNotificationPoliciesUseCase
} from 'application/notifications/use-cases';

export class NotificationPolicyController {
  constructor(
    private readonly getPolicyUseCase: GetDeviceNotificationPolicyUseCase,
    private readonly upsertPolicyUseCase: UpsertDeviceNotificationPolicyUseCase,
    private readonly deletePolicyUseCase: DeleteDeviceNotificationPolicyUseCase,
    private readonly bulkUpsertPoliciesUseCase: BulkUpsertDeviceNotificationPoliciesUseCase,
    private readonly logger: ILogger
  ) {}

  public get = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.getPolicyUseCase.execute({
        deviceId: req.params.id
      });

      if (result.isFailure) {
        const statusCode = this.getErrorStatusCode(result.error!);
        res.status(statusCode).json({ error: result.error });
        return;
      }

      res.status(200).json(result.value);
    } catch (error) {
      this.handleUnexpectedError(error, res);
    }
  };

  public upsert = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.upsertPolicyUseCase.execute({
        deviceId: req.params.id,
        quietHoursStart: req.body?.quietHoursStart ?? null,
        quietHoursEnd: req.body?.quietHoursEnd ?? null,
        alertDelayMinutes: req.body?.alertDelayMinutes ?? null
      });

      if (result.isFailure) {
        const statusCode = this.getErrorStatusCode(result.error!);
        res.status(statusCode).json({ error: result.error });
        return;
      }

      res.status(200).json(result.value);
    } catch (error) {
      this.handleUnexpectedError(error, res);
    }
  };

  public delete = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.deletePolicyUseCase.execute({
        deviceId: req.params.id
      });

      if (result.isFailure) {
        const statusCode = this.getErrorStatusCode(result.error!);
        res.status(statusCode).json({ error: result.error });
        return;
      }

      res.status(204).send();
    } catch (error) {
      this.handleUnexpectedError(error, res);
    }
  };

  public bulkUpsert = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.bulkUpsertPoliciesUseCase.execute({
        deviceIds: req.body?.deviceIds ?? [],
        quietHoursStart: req.body?.quietHoursStart ?? null,
        quietHoursEnd: req.body?.quietHoursEnd ?? null,
        alertDelayMinutes: req.body?.alertDelayMinutes ?? null
      });

      if (result.isFailure) {
        const statusCode = this.getErrorStatusCode(result.error!);
        res.status(statusCode).json({ error: result.error });
        return;
      }

      res.status(200).json(result.value);
    } catch (error) {
      this.handleUnexpectedError(error, res);
    }
  };

  private getErrorStatusCode(errorMessage: string): number {
    if (errorMessage.includes('not found')) {
      return 404;
    }

    if (
      errorMessage.includes('Invalid') ||
      errorMessage.includes('invalid') ||
      errorMessage.includes('required') ||
      errorMessage.includes('must') ||
      errorMessage.includes('cannot')
    ) {
      return 400;
    }

    return 500;
  }

  private handleUnexpectedError(error: unknown, res: Response): void {
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    this.logger.error(
      'Unexpected error in NotificationPolicyController',
      error as Error,
      { error: errorMessage }
    );

    res.status(500).json({ error: 'Internal server error' });
  }
}
