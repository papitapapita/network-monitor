import { Request, Response } from 'express';
import { ILogger } from 'application/shared/interfaces';
import {
  ListAlertsUseCase,
  GetAlertByIdUseCase,
  DeleteAlertUseCase,
  ClearAlertUseCase,
  BulkClearAlertsUseCase,
  BulkDeleteAlertsUseCase
} from 'application/notifications/use-cases';

export class AlertController {
  constructor(
    private readonly listAlertsUseCase: ListAlertsUseCase,
    private readonly getAlertByIdUseCase: GetAlertByIdUseCase,
    private readonly deleteAlertUseCase: DeleteAlertUseCase,
    private readonly clearAlertUseCase: ClearAlertUseCase,
    private readonly bulkClearAlertsUseCase: BulkClearAlertsUseCase,
    private readonly bulkDeleteAlertsUseCase: BulkDeleteAlertsUseCase,
    private readonly logger: ILogger
  ) {}

  public listAlerts = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const q = req.query as Record<string, string | undefined>;

      const result = await this.listAlertsUseCase.execute({
        deviceId: q.deviceId,
        limit: q.limit ? Number(q.limit) : undefined,
        offset: q.offset ? Number(q.offset) : undefined
      });

      if (result.isFailure) {
        const statusCode = this.getErrorStatusCode(result.error!);
        res
          .status(statusCode)
          .json({ success: false, error: result.error });
        return;
      }

      res.status(200).json({ success: true, data: result.value });
    } catch (error) {
      this.handleUnexpectedError(error, res);
    }
  };

  public getAlertById = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.getAlertByIdUseCase.execute({
        id: req.params.id
      });

      if (result.isFailure) {
        const statusCode = this.getErrorStatusCode(result.error!);
        res
          .status(statusCode)
          .json({ success: false, error: result.error });
        return;
      }

      res.status(200).json({ success: true, data: result.value });
    } catch (error) {
      this.handleUnexpectedError(error, res);
    }
  };

  public deleteAlert = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.deleteAlertUseCase.execute({
        id: req.params.id
      });

      if (result.isFailure) {
        const statusCode = this.getErrorStatusCode(result.error!);
        res
          .status(statusCode)
          .json({ success: false, error: result.error });
        return;
      }

      res.status(204).send();
    } catch (error) {
      this.handleUnexpectedError(error, res);
    }
  };

  public clearAlert = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.clearAlertUseCase.execute({
        id: req.params.id
      });

      if (result.isFailure) {
        const statusCode = this.getErrorStatusCode(result.error!);
        res
          .status(statusCode)
          .json({ success: false, error: result.error });
        return;
      }

      res.status(200).json({ success: true, data: result.value });
    } catch (error) {
      this.handleUnexpectedError(error, res);
    }
  };

  public bulkClearAlerts = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.bulkClearAlertsUseCase.execute({
        ids: req.body?.ids,
        deviceId: req.body?.deviceId
      });

      if (result.isFailure) {
        const statusCode = this.getErrorStatusCode(result.error!);
        res
          .status(statusCode)
          .json({ success: false, error: result.error });
        return;
      }

      res.status(200).json({ success: true, data: result.value });
    } catch (error) {
      this.handleUnexpectedError(error, res);
    }
  };

  public bulkDeleteAlerts = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.bulkDeleteAlertsUseCase.execute({
        ids: req.body?.ids
      });

      if (result.isFailure) {
        const statusCode = this.getErrorStatusCode(result.error!);
        res
          .status(statusCode)
          .json({ success: false, error: result.error });
        return;
      }

      res.status(200).json({ success: true, data: result.value });
    } catch (error) {
      this.handleUnexpectedError(error, res);
    }
  };

  private getErrorStatusCode(errorMessage: string): number {
    if (errorMessage.includes('not found')) {
      return 404;
    }
    if (errorMessage.includes('still open')) {
      return 409;
    }
    if (
      errorMessage.includes('Invalid') ||
      errorMessage.includes('invalid') ||
      errorMessage.includes('required') ||
      errorMessage.includes('must be')
    ) {
      return 400;
    }
    return 500;
  }

  private handleUnexpectedError(error: unknown, res: Response): void {
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    this.logger.error(
      `Unexpected error in ${this.constructor.name}`,
      error as Error,
      {
        error: errorMessage
      }
    );

    res
      .status(500)
      .json({ success: false, error: 'Internal server error' });
  }
}
