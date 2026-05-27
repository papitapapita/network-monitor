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

  /**
   * PUT /api/devices/:id/credentials
   * Create or fully replace the credentials for a device.
   * Requires authentication — protect this route with auth middleware before deploying.
   */
  public set = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.setCredentials.execute({
        deviceId: req.params.id,
        ...req.body
      });

      if (result.isFailure) {
        res
          .status(this.errorStatus(result.error!))
          .json({ error: result.error });
        return;
      }

      res.status(200).json(result.value);
    } catch (error) {
      this.handleUnexpected(error, res);
    }
  };

  /**
   * GET /api/devices/:id/credentials
   * Retrieve the stored credentials for a device with sensitive fields masked.
   * Requires authentication — protect this route with auth middleware before deploying.
   */
  public get = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.getCredentials.execute({
        deviceId: req.params.id
      });

      if (result.isFailure) {
        res
          .status(this.errorStatus(result.error!))
          .json({ error: result.error });
        return;
      }

      res.status(200).json(result.value);
    } catch (error) {
      this.handleUnexpected(error, res);
    }
  };

  /**
   * DELETE /api/devices/:id/credentials
   * Remove the stored credentials for a device.
   * Requires authentication — protect this route with auth middleware before deploying.
   */
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
          .status(this.errorStatus(result.error!))
          .json({ error: result.error });
        return;
      }

      res.status(204).send();
    } catch (error) {
      this.handleUnexpected(error, res);
    }
  };

  private errorStatus(message: string): number {
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

  private handleUnexpected(error: unknown, res: Response): void {
    this.logger.error(
      'Unexpected error in CredentialsController',
      error instanceof Error ? error : new Error(String(error))
    );
    res.status(500).json({ error: 'Internal server error' });
  }
}
