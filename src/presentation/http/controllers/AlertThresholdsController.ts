import { Request, Response } from 'express';
import { ILogger } from 'application/shared/interfaces';
import { Result } from 'domain/shared/core';
import {
  GetAlertThresholdsUseCase,
  UpdateAlertThresholdsUseCase,
  GetDeviceAlertThresholdsUseCase,
  UpdateDeviceAlertThresholdsUseCase,
  WIRELESS_CONFIG_NOT_FOUND
} from 'application/wireless-monitoring/use-cases';

export class AlertThresholdsController {
  constructor(
    private readonly getUseCase: GetAlertThresholdsUseCase,
    private readonly updateUseCase: UpdateAlertThresholdsUseCase,
    private readonly getDeviceUseCase: GetDeviceAlertThresholdsUseCase,
    private readonly updateDeviceUseCase: UpdateDeviceAlertThresholdsUseCase,
    private readonly logger: ILogger
  ) {}

  public get = (_req: Request, res: Response): Promise<void> =>
    this.run(res, () => this.getUseCase.execute({}));

  public update = (req: Request, res: Response): Promise<void> =>
    this.run(res, () => this.updateUseCase.execute(req.body));

  public getForDevice = (
    req: Request,
    res: Response
  ): Promise<void> =>
    this.run(res, () =>
      this.getDeviceUseCase.execute({ deviceId: req.params.id })
    );

  public updateForDevice = (
    req: Request,
    res: Response
  ): Promise<void> =>
    this.run(res, () =>
      this.updateDeviceUseCase.execute({
        deviceId: req.params.id,
        overrides: req.body.overrides
      })
    );

  private async run<T>(
    res: Response,
    action: () => Promise<Result<T>>
  ): Promise<void> {
    try {
      const result = await action();
      if (result.isFailure) {
        res
          .status(this.getErrorStatusCode(result.error!))
          .json({ success: false, error: result.error });
        return;
      }
      res.status(200).json({ success: true, data: result.value });
    } catch (error) {
      this.handleUnexpectedError(error, res);
    }
  }

  private getErrorStatusCode(errorMessage: string): number {
    if (errorMessage === WIRELESS_CONFIG_NOT_FOUND) return 404;
    if (
      errorMessage.includes('must be') ||
      errorMessage.includes('must have') ||
      errorMessage.includes('must map') ||
      errorMessage.startsWith('Invalid device ID')
    ) {
      return 400;
    }
    return 500;
  }

  private handleUnexpectedError(error: unknown, res: Response): void {
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    this.logger.error(
      'Unexpected error in AlertThresholdsController',
      error as Error,
      { error: errorMessage }
    );

    res
      .status(500)
      .json({ success: false, error: 'Internal server error' });
  }
}
