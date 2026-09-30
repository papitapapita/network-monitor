import { Result } from 'domain/shared/core';
import { UseCase } from '../core';
import {
  ILogger,
  IInstallerStore,
  INSTALLERS_UNAVAILABLE,
  InstallerFile
} from '../interfaces';
import { InstallerDTO, ListInstallersResponseDTO } from '../dtos';

const VERSION = /\d+\.\d+\.\d+/;

export function toInstallerDTO(file: InstallerFile): InstallerDTO {
  return {
    fileName: file.fileName,
    platform: file.platform,
    version: file.fileName.match(VERSION)?.[0] ?? null,
    sizeBytes: file.sizeBytes,
    modifiedAt: file.modifiedAt.toISOString()
  };
}

// Newest first, so the first installer of a platform is the one to offer.
export class ListInstallersUseCase extends UseCase<
  void,
  ListInstallersResponseDTO
> {
  constructor(
    private readonly store: IInstallerStore | null,
    logger: ILogger
  ) {
    super(logger, 'ListInstallersUseCase');
  }

  protected async executeImpl(): Promise<
    Result<ListInstallersResponseDTO>
  > {
    if (!this.store) return this.fail(INSTALLERS_UNAVAILABLE);

    const listed = await this.store.list();
    if (listed.isFailure) return this.fail(listed.error!);

    const installers = [...listed.value]
      .sort(
        (a, b) =>
          b.modifiedAt.getTime() - a.modifiedAt.getTime() ||
          a.fileName.localeCompare(b.fileName)
      )
      .map(toInstallerDTO);
    return this.ok({ installers });
  }
}
