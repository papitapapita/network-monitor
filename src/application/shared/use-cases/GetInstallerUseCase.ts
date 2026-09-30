import { Result } from 'domain/shared/core';
import { UseCase } from '../core';
import {
  ILogger,
  IInstallerStore,
  INSTALLERS_UNAVAILABLE
} from '../interfaces';
import {
  GetInstallerRequestDTO,
  InstallerDownloadDTO
} from '../dtos';
import { toInstallerDTO } from './ListInstallersUseCase';

export class GetInstallerUseCase extends UseCase<
  GetInstallerRequestDTO,
  InstallerDownloadDTO
> {
  constructor(
    private readonly store: IInstallerStore | null,
    logger: ILogger
  ) {
    super(logger, 'GetInstallerUseCase');
  }

  protected sanitizeForLogging(data: unknown): unknown {
    if (data && typeof data === 'object' && 'stream' in data) {
      return (data as InstallerDownloadDTO).installer;
    }
    return data;
  }

  protected async executeImpl(
    request: GetInstallerRequestDTO
  ): Promise<Result<InstallerDownloadDTO>> {
    if (!this.store) return this.fail(INSTALLERS_UNAVAILABLE);

    const opened = await this.store.open(request.fileName);
    if (opened.isFailure) return this.fail(opened.error!);
    if (!opened.value) {
      return this.fail(`Installer not found: ${request.fileName}`);
    }

    return this.ok({
      installer: toInstallerDTO(opened.value.file),
      stream: opened.value.stream
    });
  }
}
