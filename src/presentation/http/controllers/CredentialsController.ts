import { Request, Response } from 'express';
import { ILogger } from 'application/shared/interfaces';
import {
  SetDeviceCredentialsUseCase,
  GetDeviceCredentialsUseCase,
  DeleteDeviceCredentialsUseCase
} from 'application/device-inventory/use-cases';

export class CredentialsController {
  constructor(
    private readonly setCredentials: SetDeviceCredentialsUseCase,
    private readonly getCredentials: GetDeviceCredentialsUseCase,
    private readonly deleteCredentials: DeleteDeviceCredentialsUseCase,
    private readonly logger: ILogger
  ) {}

  // Requires authentication — protect this route with auth middleware before deploying.
  public set = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.setCredentials.execute({
        deviceId: req.params.id,
        ...req.body
      });

      if (result.isFailure) {
        res
          .status(this.getErrorStatusCode(result.error!))
          .json({ error: result.error });
        return;
      }

      res.status(200).json(result.value);
    } catch (error) {
      this.handleUnexpectedError(error, res);
    }
  };

  // Requires authentication — protect this route with auth middleware before deploying.
  public get = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.getCredentials.execute({
        deviceId: req.params.id
      });

      if (result.isFailure) {
        res
          .status(this.getErrorStatusCode(result.error!))
          .json({ error: result.error });
        return;
      }

      res.status(200).json(result.value);
    } catch (error) {
      this.handleUnexpectedError(error, res);
    }
  };

  // Requires authentication — protect this route with auth middleware before deploying.
  public delete = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.deleteCredentials.execute({
        deviceId: req.params.id
      });

      if (result.isFailure) {
        res
          .status(this.getErrorStatusCode(result.error!))
          .json({ error: result.error });
        return;
      }

      res.status(204).send();
    } catch (error) {
      this.handleUnexpectedError(error, res);
    }
  };

  private getErrorStatusCode(message: string): number {
    if (
      message.includes('not found') ||
      message.includes('No credentials configured')
    ) {
      return 404;
    }
    if (
      message.includes('Invalid') ||
      message.includes('required') ||
      message.includes('must be')
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
    res
      .status(500)
      .json({ error: 'Internal server error' });
  }
}
