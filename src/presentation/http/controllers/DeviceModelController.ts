import { Request, Response } from 'express';
import { ILogger } from '../../../application/shared/interfaces';
import {
  GetDeviceModelUseCase,
  ListDeviceModelsUseCase
} from '../../../application/device-inventory/use-cases';

export class DeviceModelController {
  constructor(
    private readonly getUseCase: GetDeviceModelUseCase,
    private readonly listUseCase: ListDeviceModelsUseCase,
    private readonly logger: ILogger
  ) {}

  public list = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.listUseCase.execute({
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        offset: req.query.offset ? Number(req.query.offset) : undefined
      });

      if (result.isFailure) {
        const statusCode = this.getErrorStatusCode(result.error!);
        res.status(statusCode).json({ success: false, error: result.error });
        return;
      }

      res.status(200).json({ success: true, data: result.value });
    } catch (error) {
      this.handleUnexpectedError(error, res);
    }
  };

  public getById = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.getUseCase.execute({ id: req.params.id });

      if (result.isFailure) {
        const statusCode = this.getErrorStatusCode(result.error!);
        res.status(statusCode).json({ success: false, error: result.error });
        return;
      }

      res.status(200).json({ success: true, data: result.value });
    } catch (error) {
      this.handleUnexpectedError(error, res);
    }
  };

  private getErrorStatusCode(errorMessage: string): number {
    if (errorMessage.includes('not found')) {
      return 404;
    }

    if (
      errorMessage.includes('Invalid') ||
      errorMessage.includes('invalid') ||
      errorMessage.includes('required') ||
      errorMessage.includes('must be')
    ) {
      return 400;
    }

    return 500;
  }

  private handleUnexpectedError(error: unknown, res: Response): void {
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    this.logger.error(
      'Unexpected error in DeviceModelController',
      error as Error,
      { error: errorMessage }
    );

    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}
