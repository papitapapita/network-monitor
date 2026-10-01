import { IAgentRepository } from 'domain/probe-agents/repository';
import { AgentUpdateOutcome } from 'domain/probe-agents';
import { AgentId } from 'domain/shared/ids';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { RecordAgentUpdateOutcomeRequestDTO } from '../dtos';

// AGT-084: what the agent reports after trying to update itself.
export class RecordAgentUpdateOutcomeUseCase extends UseCase<
  RecordAgentUpdateOutcomeRequestDTO,
  void
> {
  constructor(
    private readonly agentRepository: IAgentRepository,
    logger: ILogger
  ) {
    super(logger, 'RecordAgentUpdateOutcomeUseCase');
  }

  protected async executeImpl(
    request: RecordAgentUpdateOutcomeRequestDTO
  ): Promise<Result<void>> {
    const idResult = AgentId.parse(request.agentId);
    if (idResult.isFailure) {
      return this.fail(`Invalid agent ID: ${idResult.error}`);
    }

    // One retry, as for contact: the liveness scan may write the agent
    // between our read and our write.
    for (let attempt = 0; attempt < 2; attempt++) {
      const findResult = await this.agentRepository.findById(
        idResult.value
      );
      if (findResult.isFailure) return this.fail(findResult.error);
      const agent = findResult.value;
      if (agent === null) {
        return this.fail(`Agent not found: ${request.agentId}`);
      }

      const loadedUpdatedAt = agent.updatedAt;
      const recorded = agent.recordUpdateOutcome(
        request.version,
        request.outcome as AgentUpdateOutcome,
        request.reason
      );
      if (recorded.isFailure) return this.fail(recorded.error);

      const saved = await this.agentRepository.saveIfUnchanged(
        agent,
        loadedUpdatedAt
      );
      if (saved.isFailure) return this.fail(saved.error);
      if (saved.value) return this.ok(undefined);
    }
    return this.fail(
      `Agent ${request.agentId} changed while recording its update`
    );
  }
}
