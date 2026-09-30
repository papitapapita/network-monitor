import { Request, Response } from 'express';
import { InstallationDTO } from 'application/shared/dtos';

// The answer is settled at boot, so there is nothing to fail on per request.
export class InstallationController {
  constructor(private readonly installation: InstallationDTO) {}

  public get = (_req: Request, res: Response): void => {
    res.status(200).json({ success: true, data: this.installation });
  };
}
