import { Request, Response } from 'express';
import { ILogger } from 'application/shared/interfaces';
import {
  AcceptCurrentPortSpeedsUseCase,
  ListRouterPortSpeedsUseCase,
  PORT_SPEED_ROUTER_DID_NOT_ANSWER,
  PORT_SPEED_ROUTER_NOT_FOUND,
  PORT_SPEED_ROUTER_NOT_READABLE,
  SetPortExpectedSpeedUseCase
} from 'application/device-monitoring/use-cases';

export class PortSpeedController {
  constructor(
    private readonly listRouterPortSpeedsUseCase: ListRouterPortSpeedsUseCase,
    private readonly setPortExpectedSpeedUseCase: SetPortExpectedSpeedUseCase,
    private readonly acceptCurrentPortSpeedsUseCase: AcceptCurrentPortSpeedsUseCase,
    private readonly logger: ILogger
  ) {}

  public list = async (
    _req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.listRouterPortSpeedsUseCase.execute();
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

  public setExpected = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.setPortExpectedSpeedUseCase.execute({
        deviceId: req.params.id,
        portName: req.body.portName,
        expectedMbps: req.body.expectedMbps
      });
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
  };

  public acceptCurrent = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result =
        await this.acceptCurrentPortSpeedsUseCase.execute({
          deviceId: req.params.id
        });
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
  };

  private getErrorStatusCode(message: string): number {
    if (
      message.startsWith('Invalid') ||
      message.includes('must be')
    ) {
      return 400;
    }
    if (message === PORT_SPEED_ROUTER_NOT_FOUND) return 404;
    if (message.startsWith(PORT_SPEED_ROUTER_NOT_READABLE))
      return 409;
    if (message.startsWith(PORT_SPEED_ROUTER_DID_NOT_ANSWER))
      return 502;
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
