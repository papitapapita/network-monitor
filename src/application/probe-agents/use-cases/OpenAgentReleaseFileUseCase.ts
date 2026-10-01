import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  AgentReleaseDownload,
  IAgentReleaseCatalog
} from '../interfaces';
import { OpenAgentReleaseFileRequestDTO } from '../dtos';

export const AGENT_RELEASE_FILE_NOT_FOUND = 'Release file not found';

// AGT-083: a binary an agent downloads to update itself. Only names that a
// valid manifest lists are served; the caller has already checked the
// agent's token.
export class OpenAgentReleaseFileUseCase extends UseCase<
  OpenAgentReleaseFileRequestDTO,
  AgentReleaseDownload
> {
  constructor(
    private readonly releases: IAgentReleaseCatalog,
    logger: ILogger
  ) {
    super(logger, 'OpenAgentReleaseFileUseCase');
  }

  protected async executeImpl(
    request: OpenAgentReleaseFileRequestDTO
  ): Promise<Result<AgentReleaseDownload>> {
    const opened = await this.releases.open(request.fileName ?? '');
    if (opened.isFailure) return this.fail(opened.error);
    if (opened.value === null) {
      return this.fail(AGENT_RELEASE_FILE_NOT_FOUND);
    }
    return this.ok(opened.value);
  }
}
