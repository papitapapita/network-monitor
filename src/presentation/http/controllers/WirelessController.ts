import { Request, Response } from 'express';
import { ILogger } from '../../../application/shared/interfaces';
import { GetWirelessDeviceStatusUseCase } from '../../../application/wireless-monitoring/use-cases/GetWirelessDeviceStatusUseCase';
import { GetWirelessDeviceHistoryUseCase } from '../../../application/wireless-monitoring/use-cases/GetWirelessDeviceHistoryUseCase';
import { GetWirelessClientsUseCase } from '../../../application/wireless-monitoring/use-cases/GetWirelessClientsUseCase';
import { GetActiveWirelessAlertsUseCase } from '../../../application/wireless-monitoring/use-cases/GetActiveWirelessAlertsUseCase';
import { GetWirelessAlertHistoryUseCase } from '../../../application/wireless-monitoring/use-cases/GetWirelessAlertHistoryUseCase';
import { TriggerWirelessPollUseCase } from '../../../application/wireless-monitoring/use-cases/TriggerWirelessPollUseCase';
import { CreateWirelessConfigUseCase } from '../../../application/wireless-monitoring/use-cases/CreateWirelessConfigUseCase';
import { GetWirelessConfigUseCase } from '../../../application/wireless-monitoring/use-cases/GetWirelessConfigUseCase';
import { UpdateWirelessConfigUseCase } from '../../../application/wireless-monitoring/use-cases/UpdateWirelessConfigUseCase';
import { DeleteWirelessConfigUseCase } from '../../../application/wireless-monitoring/use-cases/DeleteWirelessConfigUseCase';

export class WirelessController {
  constructor(
    private readonly getWirelessDeviceStatusUseCase: GetWirelessDeviceStatusUseCase,
    private readonly getWirelessDeviceHistoryUseCase: GetWirelessDeviceHistoryUseCase,
    private readonly getWirelessClientsUseCase: GetWirelessClientsUseCase,
    private readonly getActiveWirelessAlertsUseCase: GetActiveWirelessAlertsUseCase,
    private readonly getWirelessAlertHistoryUseCase: GetWirelessAlertHistoryUseCase,
    private readonly triggerWirelessPollUseCase: TriggerWirelessPollUseCase,
    private readonly createWirelessConfigUseCase: CreateWirelessConfigUseCase,
    private readonly getWirelessConfigUseCase: GetWirelessConfigUseCase,
    private readonly updateWirelessConfigUseCase: UpdateWirelessConfigUseCase,
    private readonly deleteWirelessConfigUseCase: DeleteWirelessConfigUseCase,
    private readonly logger: ILogger
  ) {}

  /**
   * GET /api/devices/:id/wireless/status
   * Get the latest wireless status snapshot for an AP device.
   */
  public getStatus = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result =
        await this.getWirelessDeviceStatusUseCase.execute({
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
   * GET /api/devices/:id/wireless/history
   * Get historical wireless snapshots for a device within a time range.
   */
  public getHistory = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const query = req.query as Record<string, string>;

      const result =
        await this.getWirelessDeviceHistoryUseCase.execute({
          deviceId: req.params.id,
          from: new Date(query.from),
          to: new Date(query.to)
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
   * GET /api/devices/:id/wireless/clients
   * Get the current client list for an AP device.
   */
  public getClients = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.getWirelessClientsUseCase.execute({
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
   * GET /api/devices/:id/wireless/alerts
   * Get active wireless alerts for a specific device.
   */
  public getDeviceActiveAlerts = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result =
        await this.getActiveWirelessAlertsUseCase.execute({
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
   * GET /api/devices/:id/wireless/alerts/history
   * Get historical wireless alerts for a specific device.
   */
  public getDeviceAlertHistory = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const query = req.query as Record<string, string>;

      const result =
        await this.getWirelessAlertHistoryUseCase.execute({
          deviceId: req.params.id,
          from: query.from ? new Date(query.from) : undefined,
          to: query.to ? new Date(query.to) : undefined,
          limit: query.limit ? Number(query.limit) : undefined
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
   * POST /api/devices/:id/wireless/poll
   * Trigger an immediate wireless poll for a device.
   */
  public triggerPoll = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.triggerWirelessPollUseCase.execute({
        deviceId: req.params.id
      });

      if (result.isFailure) {
        const statusCode = this.getErrorStatusCode(result.error!);
        res.status(statusCode).json({ error: result.error });
        return;
      }

      res.status(202).json(result.value);
    } catch (error) {
      this.handleUnexpectedError(error, res);
    }
  };

  /**
   * GET /api/wireless/alerts
   * Get all active wireless alerts, optionally filtered by device.
   */
  public getAllActiveAlerts = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const query = req.query as Record<string, string>;

      const result =
        await this.getActiveWirelessAlertsUseCase.execute({
          deviceId: query.deviceId
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
   * GET /api/wireless/alerts/history
   * Get wireless alert history, optionally filtered by device and time range.
   */
  public getAllAlertHistory = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const query = req.query as Record<string, string>;

      const result =
        await this.getWirelessAlertHistoryUseCase.execute({
          deviceId: query.deviceId,
          from: query.from ? new Date(query.from) : undefined,
          to: query.to ? new Date(query.to) : undefined,
          limit: query.limit ? Number(query.limit) : undefined
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
   * POST /api/devices/:id/wireless/config
   * Create a wireless polling configuration for a device.
   */
  public createConfig = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.createWirelessConfigUseCase.execute({
        deviceId: req.params.id,
        ...req.body
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
   * GET /api/devices/:id/wireless/config
   * Get the wireless polling configuration for a device.
   */
  public getConfig = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.getWirelessConfigUseCase.execute({
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
   * PATCH /api/devices/:id/wireless/config
   * Update the wireless polling configuration for a device.
   */
  public updateConfig = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.updateWirelessConfigUseCase.execute({
        deviceId: req.params.id,
        ...req.body
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
   * DELETE /api/devices/:id/wireless/config
   * Delete the wireless polling configuration for a device.
   */
  public deleteConfig = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.deleteWirelessConfigUseCase.execute({
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

  // =====================================
  // PRIVATE HELPERS
  // =====================================

  private getErrorStatusCode(errorMessage: string): number {
    if (
      errorMessage.includes('not found') ||
      errorMessage.includes('NOT_FOUND') ||
      errorMessage.includes('NOT_AP') ||
      errorMessage.includes('No wireless data found') ||
      errorMessage.includes(
        'No wireless polling configuration found'
      ) ||
      errorMessage.includes('Wireless config not found') ||
      errorMessage.includes('Device not found')
    ) {
      return 404;
    }

    if (errorMessage.includes('already exists')) {
      return 409;
    }

    if (
      errorMessage.includes('Invalid') ||
      errorMessage.includes('invalid') ||
      errorMessage.includes('required') ||
      errorMessage.includes('must be') ||
      errorMessage.includes('cannot be') ||
      errorMessage.includes('not configured') ||
      errorMessage.includes('not wireless-capable')
    ) {
      return 400;
    }

    return 500;
  }

  private handleUnexpectedError(error: unknown, res: Response): void {
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    this.logger.error(
      'Unexpected error in WirelessController',
      error as Error,
      { error: errorMessage }
    );

    res.status(500).json({ error: 'Internal server error' });
  }
}
