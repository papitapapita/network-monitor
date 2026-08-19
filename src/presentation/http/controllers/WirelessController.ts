import { Request, Response } from 'express';
import { ILogger } from 'application/shared/interfaces';
import {
  GetWirelessDeviceStatusUseCase,
  GetWirelessDeviceHistoryUseCase,
  GetWirelessClientsUseCase,
  GetActiveWirelessAlertsUseCase,
  GetWirelessAlertHistoryUseCase,
  TriggerWirelessPollUseCase,
  RebootWirelessDeviceUseCase,
  CreateWirelessConfigUseCase,
  GetWirelessConfigUseCase,
  UpdateWirelessConfigUseCase,
  DeleteWirelessConfigUseCase,
  ClearWirelessAlertUseCase,
  BulkClearWirelessAlertsUseCase
} from 'application/wireless-monitoring/use-cases';

export class WirelessController {
  constructor(
    private readonly getWirelessDeviceStatusUseCase: GetWirelessDeviceStatusUseCase,
    private readonly getWirelessDeviceHistoryUseCase: GetWirelessDeviceHistoryUseCase,
    private readonly getWirelessClientsUseCase: GetWirelessClientsUseCase,
    private readonly getActiveWirelessAlertsUseCase: GetActiveWirelessAlertsUseCase,
    private readonly getWirelessAlertHistoryUseCase: GetWirelessAlertHistoryUseCase,
    private readonly triggerWirelessPollUseCase: TriggerWirelessPollUseCase,
    private readonly rebootWirelessDeviceUseCase: RebootWirelessDeviceUseCase,
    private readonly createWirelessConfigUseCase: CreateWirelessConfigUseCase,
    private readonly getWirelessConfigUseCase: GetWirelessConfigUseCase,
    private readonly updateWirelessConfigUseCase: UpdateWirelessConfigUseCase,
    private readonly deleteWirelessConfigUseCase: DeleteWirelessConfigUseCase,
    private readonly clearWirelessAlertUseCase: ClearWirelessAlertUseCase,
    private readonly bulkClearWirelessAlertsUseCase: BulkClearWirelessAlertsUseCase,
    private readonly logger: ILogger
  ) {}

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

  // 202 Accepted — poll is dispatched asynchronously; result not yet available.
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

  // 202 Accepted — the device reboots asynchronously after acknowledging.
  public reboot = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.rebootWirelessDeviceUseCase.execute({
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

  public clearAlert = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.clearWirelessAlertUseCase.execute({
        deviceId: req.params.id,
        alertId: req.params.alertId
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

  public bulkClearAlerts = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result =
        await this.bulkClearWirelessAlertsUseCase.execute({
          deviceId: req.params.id,
          ids: req.body?.ids
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
      `Unexpected error in ${this.constructor.name}`,
      error as Error,
      { error: errorMessage }
    );

    res.status(500).json({ error: 'Internal server error' });
  }
}
