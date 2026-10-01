import { IAgentRepository } from 'domain/probe-agents/repository';
import { AgentId } from 'domain/shared/ids';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  AGENT_PLATFORMS,
  AgentPlatform,
  isNewerVersion
} from 'agent/protocol';
import { IAgentReleaseCatalog } from '../interfaces';
import {
  AgentUpdateOfferDTO,
  GetAgentUpdateOfferRequestDTO
} from '../dtos';

// AGT-082: an agent is offered the newest release published to this install
// when it runs something older, has a binary for its platform, and has not
// already failed on that very release.
export class GetAgentUpdateOfferUseCase extends UseCase<
  GetAgentUpdateOfferRequestDTO,
  AgentUpdateOfferDTO | null
> {
  constructor(
    private readonly agentRepository: IAgentRepository,
    private readonly releases: IAgentReleaseCatalog,
    logger: ILogger
  ) {
    super(logger, 'GetAgentUpdateOfferUseCase');
  }

  protected async executeImpl(
    request: GetAgentUpdateOfferRequestDTO
  ): Promise<Result<AgentUpdateOfferDTO | null>> {
    const idResult = AgentId.parse(request.agentId);
    if (idResult.isFailure) {
      return this.fail(`Invalid agent ID: ${idResult.error}`);
    }
    const platform = AGENT_PLATFORMS.find(
      (p) => p === request.platform
    ) as AgentPlatform | undefined;
    if (!platform) return this.ok(null);

    const latest = await this.releases.latest();
    if (latest.isFailure) return this.fail(latest.error);
    const release = latest.value;
    const file = release?.files[platform];
    if (
      !release ||
      !file ||
      !isNewerVersion(release.version, request.runningVersion)
    ) {
      return this.ok(null);
    }

    const findResult = await this.agentRepository.findById(
      idResult.value
    );
    if (findResult.isFailure) return this.fail(findResult.error);
    const agent = findResult.value;
    if (agent === null) {
      return this.fail(`Agent not found: ${request.agentId}`);
    }
    if (agent.hasFailedUpdateTo(release.version))
      return this.ok(null);

    return this.ok({ version: release.version, ...file });
  }
}
