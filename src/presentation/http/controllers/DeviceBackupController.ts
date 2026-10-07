import { Request, Response } from 'express';
import { ILogger } from 'application/shared/interfaces';
import {
  BACKUP_NOW_FAILURES,
  BackUpDeviceNowUseCase,
  DiffDeviceBackupsUseCase,
  DownloadDeviceBackupUseCase,
  ListDeviceBackupsUseCase
} from 'application/device-backups/use-cases';

export class DeviceBackupController {
  constructor(
    private readonly listDeviceBackupsUseCase: ListDeviceBackupsUseCase,
    private readonly backUpDeviceNowUseCase: BackUpDeviceNowUseCase,
    private readonly downloadDeviceBackupUseCase: DownloadDeviceBackupUseCase,
    private readonly diffDeviceBackupsUseCase: DiffDeviceBackupsUseCase,
    private readonly logger: ILogger
  ) {}

  public list = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.listDeviceBackupsUseCase.execute({
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

  // 201 when a new version was saved, 200 when the device still holds the last one
  public backUpNow = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.backUpDeviceNowUseCase.execute({
        deviceId: req.params.id
      });

      if (result.isFailure) {
        res
          .status(this.getErrorStatusCode(result.error!))
          .json({ error: result.error });
        return;
      }

      res
        .status(result.value.outcome === 'SAVED' ? 201 : 200)
        .json(result.value);
    } catch (error) {
      this.handleUnexpectedError(error, res);
    }
  };

  public download = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.downloadDeviceBackupUseCase.execute({
        deviceId: req.params.id,
        backupId: req.params.backupId
      });

      if (result.isFailure) {
        res
          .status(this.getErrorStatusCode(result.error!))
          .json({ error: result.error });
        return;
      }

      const file = result.value;
      res
        .status(200)
        .set({
          'Content-Type': file.contentType,
          'Content-Disposition': `attachment; filename="${file.fileName}"`,
          'Cache-Control': 'no-store'
        })
        .send(file.content);
    } catch (error) {
      this.handleUnexpectedError(error, res);
    }
  };

  public diff = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.diffDeviceBackupsUseCase.execute({
        deviceId: req.params.id,
        fromBackupId: String(req.query.from),
        toBackupId: String(req.query.to)
      });

      if (result.isFailure) {
        res
          .status(this.getErrorStatusCode(result.error!))
          .json({ error: result.error });
        return;
      }

      res
        .status(200)
        .set('Cache-Control', 'no-store')
        .json(result.value);
    } catch (error) {
      this.handleUnexpectedError(error, res);
    }
  };

  private getErrorStatusCode(message: string): number {
    if (message.startsWith(BACKUP_NOW_FAILURES.REFUSED)) return 409;
    if (message.startsWith(BACKUP_NOW_FAILURES.FAILED)) return 502;
    if (message.includes('Invalid')) return 400;
    if (message.includes('not found')) return 404;
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
    res.status(500).json({ error: 'Internal server error' });
  }
}
