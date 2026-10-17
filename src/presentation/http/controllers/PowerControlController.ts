import { Request, Response } from 'express';
import { ILogger } from 'application/shared/interfaces';
import {
  GetDevicePowerSourceUseCase,
  ListSitePoePortsUseCase
} from 'application/power-control/use-cases';

export class PowerControlController {
  constructor(
    private readonly listSitePoePortsUseCase: ListSitePoePortsUseCase,
    private readonly getDevicePowerSourceUseCase: GetDevicePowerSourceUseCase,
    private readonly logger: ILogger
  ) {}

  public listSitePorts = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.listSitePoePortsUseCase.execute({
        locationId: req.params.id
      });

      if (result.isFailure) {
        res
          .status(this.getErrorStatusCode(result.error!))
          .json({ error: result.error });
        return;
      }

      res
        .status(200)
        .set('Cache-Control', 'no-store')
        .json(result.value);
    } catch (error) {
      this.handleUnexpectedError(error, res);
    }
  };

  public getPowerSource = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.getDevicePowerSourceUseCase.execute({
        deviceId: req.params.id
      });

      if (result.isFailure) {
        res
          .status(this.getErrorStatusCode(result.error!))
          .json({ error: result.error });
        return;
      }

      res
        .status(200)
        .set('Cache-Control', 'no-store')
        .json(result.value);
    } catch (error) {
      this.handleUnexpectedError(error, res);
    }
  };

  private getErrorStatusCode(message: string): number {
    if (message.includes('Invalid')) return 400;
    if (message.includes('not found')) return 404;
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
