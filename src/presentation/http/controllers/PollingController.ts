import { Request, Response } from 'express';
import { ExecutePollingCycleUseCase } from '../../../application/device-monitoring/use-cases/ExecutePollingCycleUseCase';
import { GetDevicePollingStatusUseCase } from '../../../application/device-monitoring/use-cases/GetDevicePollingStatusUseCase';
import { GetDevicePollingHistoryUseCase } from '../../../application/device-monitoring/use-cases/GetDevicePollingHistoryUseCase';
import { ConfigureDevicePollingUseCase } from '../../../application/device-monitoring/use-cases/ConfigureDevicePollingUseCase';

export class PollingController {
  constructor(
    private readonly executePollingCycleUseCase: ExecutePollingCycleUseCase,
    private readonly getPollingStatusUseCase: GetDevicePollingStatusUseCase,
    private readonly getPollingHistoryUseCase: GetDevicePollingHistoryUseCase,
    private readonly configurePollingUseCase: ConfigureDevicePollingUseCase
  ) {}

  /**
   * POST /api/devices/:id/poll
   * Trigger an immediate manual poll for a device.
   */
  public poll = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    const result = await this.executePollingCycleUseCase.execute({
      deviceId: req.params.id,
      forceExecution: true
    });

    if (result.isFailure) {
      const notFound =
        result.error.includes('not found') ||
        result.error.includes('No polling configuration');
      res.status(notFound ? 404 : 400).json({ error: result.error });
      return;
    }

    res.status(200).json(result.value);
  };

  /**
   * GET /api/devices/:id/polling/status
   * Get current polling status and device state.
   */
  public getStatus = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    const result = await this.getPollingStatusUseCase.execute({
      deviceId: req.params.id
    });

    if (result.isFailure) {
      const notFound =
        result.error.includes('not found') ||
        result.error.includes('No polling configuration');
      res.status(notFound ? 404 : 400).json({ error: result.error });
      return;
    }

    res.status(200).json(result.value);
  };

  /**
   * GET /api/devices/:id/polling/history
   * Get historical ping results for a device.
   */
  public getHistory = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    const query = req.query as Record<string, string>;

    const result = await this.getPollingHistoryUseCase.execute({
      deviceId: req.params.id,
      fromDate: query.fromDate ? new Date(query.fromDate) : undefined,
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
      res.status(400).json({ error: result.error });
      return;
    }

    res.status(200).json(result.value);
  };

  /**
   * PATCH /api/devices/:id/polling/config
   * Update polling configuration (interval, failuresBeforeDown, enabled).
   */
  public configure = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    const result = await this.configurePollingUseCase.execute({
      deviceId: req.params.id,
      intervalSeconds: req.body.intervalSeconds,
      failuresBeforeDown: req.body.failuresBeforeDown,
      enabled: req.body.enabled
    });

    if (result.isFailure) {
      const notFound =
        result.error.includes('not found') ||
        result.error.includes('No polling configuration');
      res.status(notFound ? 404 : 400).json({ error: result.error });
      return;
    }

    res.status(204).send();
  };
}
