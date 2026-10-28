import { Request, Response } from 'express';
import { ILogger } from 'application/shared/interfaces';
import { Result } from 'domain/shared/core';
import {
  ListDiscoveredDevicesUseCase,
  IgnoreDiscoveredDeviceUseCase,
  UnignoreDiscoveredDeviceUseCase,
  GetDiscoveredDevicePrefillUseCase,
  DISCOVERED_DEVICE_NOT_FOUND
} from 'application/device-inventory/use-cases';

export class DiscoveredDeviceController {
  constructor(
    private readonly listUseCase: ListDiscoveredDevicesUseCase,
    private readonly ignoreUseCase: IgnoreDiscoveredDeviceUseCase,
    private readonly unignoreUseCase: UnignoreDiscoveredDeviceUseCase,
    private readonly prefillUseCase: GetDiscoveredDevicePrefillUseCase,
    private readonly logger: ILogger
  ) {}

  public list = (req: Request, res: Response): Promise<void> =>
    this.run(res, () =>
      this.listUseCase.execute({
        ignored: req.query.ignored === 'true'
      })
    );

  public ignore = (req: Request, res: Response): Promise<void> =>
    this.run(res, () =>
      this.ignoreUseCase.execute({ id: req.params.id })
    );

  public unignore = (req: Request, res: Response): Promise<void> =>
    this.run(res, () =>
      this.unignoreUseCase.execute({ id: req.params.id })
    );

  public prefill = (req: Request, res: Response): Promise<void> =>
    this.run(res, () =>
      this.prefillUseCase.execute({ id: req.params.id })
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
    if (errorMessage === DISCOVERED_DEVICE_NOT_FOUND) return 404;
    if (errorMessage.startsWith('Invalid')) return 400;
    return 500;
  }

  private handleUnexpectedError(error: unknown, res: Response): void {
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    this.logger.error(
      'Unexpected error in DiscoveredDeviceController',
      error as Error,
      { error: errorMessage }
    );

    res
      .status(500)
      .json({ success: false, error: 'Internal server error' });
  }
}
