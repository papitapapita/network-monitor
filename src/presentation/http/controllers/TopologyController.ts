import { Request, Response } from 'express';
import { ILogger } from 'application/shared/interfaces';
import {
  GetTopologyUseCase,
  GetDeviceDescendantsUseCase
} from 'application/device-inventory/use-cases';

export class TopologyController {
  constructor(
    private readonly getTopologyUseCase: GetTopologyUseCase,
    private readonly getDescendantsUseCase: GetDeviceDescendantsUseCase,
    private readonly logger: ILogger
  ) {}

  public getTopology = async (
    _req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.getTopologyUseCase.execute({});
      if (result.isFailure) {
        res.status(500).json({ success: false, error: result.error });
        return;
      }
      res.status(200).json({ success: true, data: result.value });
    } catch (error) {
      this.handleUnexpectedError(error, res);
    }
  };

  public getDescendants = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.getDescendantsUseCase.execute({
        deviceId: req.params.deviceId
      });
      if (result.isFailure) {
        res
          .status(this.getErrorStatusCode(result.error))
          .json({ success: false, error: result.error });
        return;
      }
      res.status(200).json({ success: true, data: result.value });
    } catch (error) {
      this.handleUnexpectedError(error, res);
    }
  };

  private getErrorStatusCode(errorMessage: string): number {
    if (errorMessage.includes('not found')) return 404;
    if (errorMessage.includes('Invalid')) return 400;
    return 500;
  }

  private handleUnexpectedError(error: unknown, res: Response): void {
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    this.logger.error(
      'Unexpected error in TopologyController',
      error as Error,
      { error: errorMessage }
    );

    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}
