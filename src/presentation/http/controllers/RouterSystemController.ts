import { Request, Response } from 'express';
import { Result } from 'domain/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  GetRouterAuditUseCase,
  GetRouterHealthThresholdsUseCase,
  GetRouterSystemUseCase,
  ListRouterSystemsUseCase,
  PORT_SPEED_ROUTER_NOT_FOUND,
  UpdateRouterHealthThresholdsUseCase
} from 'application/device-monitoring/use-cases';

export class RouterSystemController {
  constructor(
    private readonly listRouterSystemsUseCase: ListRouterSystemsUseCase,
    private readonly getRouterSystemUseCase: GetRouterSystemUseCase,
    private readonly getHealthThresholdsUseCase: GetRouterHealthThresholdsUseCase,
    private readonly updateHealthThresholdsUseCase: UpdateRouterHealthThresholdsUseCase,
    private readonly getRouterAuditUseCase: GetRouterAuditUseCase,
    private readonly logger: ILogger
  ) {}

  public list = (_req: Request, res: Response): Promise<void> =>
    this.run(res, () => this.listRouterSystemsUseCase.execute());

  public get = (req: Request, res: Response): Promise<void> =>
    this.run(res, () =>
      this.getRouterSystemUseCase.execute({ deviceId: req.params.id })
    );

  public getHealthThresholds = (
    _req: Request,
    res: Response
  ): Promise<void> =>
    this.run(res, () => this.getHealthThresholdsUseCase.execute());

  public updateHealthThresholds = (
    req: Request,
    res: Response
  ): Promise<void> =>
    this.run(res, () =>
      this.updateHealthThresholdsUseCase.execute(req.body)
    );

  public audit = (_req: Request, res: Response): Promise<void> =>
    this.run(res, () => this.getRouterAuditUseCase.execute());

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
      res
        .status(200)
        .set('Cache-Control', 'no-store')
        .json({ success: true, data: result.value });
    } catch (error) {
      this.handleUnexpectedError(error, res);
    }
  }

  private getErrorStatusCode(message: string): number {
    if (
      message.startsWith('Invalid') ||
      message.includes(' must be ')
    ) {
      return 400;
    }
    if (message === PORT_SPEED_ROUTER_NOT_FOUND) return 404;
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
    res
      .status(500)
      .json({ success: false, error: 'Internal server error' });
  }
}
