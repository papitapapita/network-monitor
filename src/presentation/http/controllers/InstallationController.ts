import { Request, Response } from 'express';
import {
  InstallationDTO,
  InstallerDownloadDTO
} from 'application/shared/dtos';
import {
  ILogger,
  INSTALLERS_UNAVAILABLE
} from 'application/shared/interfaces';
import { ListInstallersUseCase } from 'application/shared/use-cases/ListInstallersUseCase';
import { GetInstallerUseCase } from 'application/shared/use-cases/GetInstallerUseCase';

export class InstallationController {
  constructor(
    private readonly installation: InstallationDTO,
    private readonly listInstallersUseCase: ListInstallersUseCase,
    private readonly getInstallerUseCase: GetInstallerUseCase,
    private readonly logger: ILogger
  ) {}

  // Settled at boot, so there is nothing to fail on per request.
  public get = (_req: Request, res: Response): void => {
    res.status(200).json({ success: true, data: this.installation });
  };

  public listInstallers = async (
    _req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.listInstallersUseCase.execute();
      if (result.isFailure) {
        this.sendError(res, result.error!);
        return;
      }
      res.status(200).json({ success: true, data: result.value });
    } catch (error) {
      this.handleUnexpectedError(error, res);
    }
  };

  public downloadInstaller = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.getInstallerUseCase.execute({
        fileName: req.params.fileName
      });
      if (result.isFailure) {
        this.sendError(res, result.error!);
        return;
      }
      this.stream(result.value, res);
    } catch (error) {
      this.handleUnexpectedError(error, res);
    }
  };

  private stream(
    download: InstallerDownloadDTO,
    res: Response
  ): void {
    const { installer, stream } = download;
    stream.on('error', (error: Error) => {
      this.logger.error('Installer download failed', error, {
        fileName: installer.fileName
      });
      if (res.headersSent) res.destroy(error);
      else this.handleUnexpectedError(error, res);
    });
    res.status(200);
    res.attachment(installer.fileName);
    res.type('application/octet-stream');
    res.setHeader('Content-Length', String(installer.sizeBytes));
    stream.pipe(res);
  }

  private sendError(res: Response, error: string): void {
    res
      .status(this.getErrorStatusCode(error))
      .json({ success: false, error });
  }

  private getErrorStatusCode(errorMessage: string): number {
    if (
      errorMessage === INSTALLERS_UNAVAILABLE ||
      errorMessage.startsWith('Installer folder cannot be read')
    ) {
      return 503;
    }
    if (errorMessage.startsWith('Installer not found')) {
      return 404;
    }
    return 500;
  }

  private handleUnexpectedError(error: unknown, res: Response): void {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    this.logger.error(
      'Unexpected error in InstallationController',
      error as Error,
      { error: errorMessage }
    );
    res
      .status(500)
      .json({ success: false, error: 'Internal server error' });
  }
}
