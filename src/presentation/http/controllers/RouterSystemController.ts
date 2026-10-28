import { Request, Response } from 'express';
import { ILogger } from 'application/shared/interfaces';
import {
  GetRouterSystemUseCase,
  ListRouterSystemsUseCase,
  PORT_SPEED_ROUTER_NOT_FOUND
} from 'application/device-monitoring/use-cases';

export class RouterSystemController {
  constructor(
    private readonly listRouterSystemsUseCase: ListRouterSystemsUseCase,
    private readonly getRouterSystemUseCase: GetRouterSystemUseCase,
    private readonly logger: ILogger
  ) {}

  public list = async (
    _req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.listRouterSystemsUseCase.execute();
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
  };

  public get = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.getRouterSystemUseCase.execute({
        deviceId: req.params.id
      });
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
  };

  private getErrorStatusCode(message: string): number {
    if (message.startsWith('Invalid')) return 400;
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
