import { Request, Response } from 'express';
import { ILogger } from '../../../application/shared/interfaces';
import { ExecutePollingCycleUseCase } from '../../../application/device-monitoring/use-cases/ExecutePollingCycleUseCase';
import { GetDevicePollingStatusUseCase } from '../../../application/device-monitoring/use-cases/GetDevicePollingStatusUseCase';
import { GetDevicePollingHistoryUseCase } from '../../../application/device-monitoring/use-cases/GetDevicePollingHistoryUseCase';
import { ConfigureDevicePollingUseCase } from '../../../application/device-monitoring/use-cases/ConfigureDevicePollingUseCase';
import { CreateDevicePollingUseCase } from '../../../application/device-monitoring/use-cases/CreateDevicePollingUseCase';

export class PollingController {
  constructor(
    private readonly executePollingCycleUseCase: ExecutePollingCycleUseCase,
    private readonly getPollingStatusUseCase: GetDevicePollingStatusUseCase,
    private readonly getPollingHistoryUseCase: GetDevicePollingHistoryUseCase,
    private readonly configurePollingUseCase: ConfigureDevicePollingUseCase,
    private readonly createPollingUseCase: CreateDevicePollingUseCase,
    private readonly logger: ILogger
  ) {}

  /**
   * POST /api/devices/:id/poll
   * Trigger an immediate manual poll for a device.
   */
  public poll = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.executePollingCycleUseCase.execute({
        deviceId: req.params.id,
        forceExecution: true
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

  /**
   * GET /api/devices/:id/polling/status
   * Get current polling status and device state.
   */
  public getStatus = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.getPollingStatusUseCase.execute({
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

  /**
   * GET /api/devices/:id/polling/history
   * Get historical ping results for a device.
   */
  public getHistory = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const query = req.query as Record<string, string>;

      const result = await this.getPollingHistoryUseCase.execute({
        deviceId: req.params.id,
        fromDate: query.fromDate
          ? new Date(query.fromDate)
          : undefined,
        toDate: query.toDate ? new Date(query.toDate) : undefined,
        status: query.status
          ? (query.status.split(',') as (
              | 'SUCCESS'
              | 'FAILED'
              | 'UNKNOWN'
            )[])
          : undefined,
        limit: query.limit ? parseInt(query.limit, 10) : undefined,
        offset: query.offset ? parseInt(query.offset, 10) : undefined
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

  public create = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.createPollingUseCase.execute({
        deviceId: req.params.id,
        ipAddress: req.body?.ipAddress,
        intervalSeconds: req.body?.intervalSeconds,
        failuresBeforeDown: req.body?.failuresBeforeDown,
        enabled: req.body?.enabled
      });

      if (result.isFailure) {
        const statusCode = this.getErrorStatusCode(result.error!);
        res.status(statusCode).json({ error: result.error });
        return;
      }

      res.status(201).json(result.value);
    } catch (error) {
      this.handleUnexpectedError(error, res);
    }
  };

  /**
   * PATCH /api/devices/:id/polling/config
   * Update polling configuration (interval, failuresBeforeDown, enabled).
   */
  public configure = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.configurePollingUseCase.execute({
        deviceId: req.params.id,
        intervalSeconds: req.body.intervalSeconds,
        failuresBeforeDown: req.body.failuresBeforeDown,
        enabled: req.body.enabled
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

  // =====================================
  // PRIVATE HELPERS
  // =====================================

  private getErrorStatusCode(errorMessage: string): number {
    if (
      errorMessage.includes('not found') ||
      errorMessage.includes('No polling configuration')
    ) {
      return 404;
    }

    if (
      errorMessage.includes('Invalid') ||
      errorMessage.includes('invalid') ||
      errorMessage.includes('required') ||
      errorMessage.includes('must be') ||
      errorMessage.includes('cannot be')
    ) {
      return 400;
    }

    return 500;
  }

  private handleUnexpectedError(error: unknown, res: Response): void {
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    this.logger.error(
      'Unexpected error in PollingController',
      error as Error,
      { error: errorMessage }
    );

    res.status(500).json({ error: 'Internal server error' });
  }
}
