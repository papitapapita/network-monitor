import { IAgentRepository } from 'domain/probe-agents/repository';
import { AgentId } from 'domain/shared/ids';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { RecordAgentContactRequestDTO } from '../dtos';

// A hello or a heartbeat (ADR 0002, R5): when the agent was last heard
// from, which version it runs, and how far its clock is from ours.
export class RecordAgentContactUseCase extends UseCase<
  RecordAgentContactRequestDTO,
  void
> {
  constructor(
    private readonly agentRepository: IAgentRepository,
    logger: ILogger
  ) {
    super(logger, 'RecordAgentContactUseCase');
  }

  protected async executeImpl(
    request: RecordAgentContactRequestDTO
  ): Promise<Result<void>> {
    const idResult = AgentId.parse(request.agentId);
    if (idResult.isFailure) {
      return this.fail(`Invalid agent ID: ${idResult.error}`);
    }

    // One retry: a miss means the liveness scan marked the agent offline
    // between our read and our write, and only a fresh read sees that and
    // raises the matching came-back event.
    for (let attempt = 0; attempt < 2; attempt++) {
      const saved = await this.recordOnce(idResult.value, request);
      if (saved.isFailure) return this.fail(saved.error);
      if (saved.value) return this.ok(undefined);
    }
    return this.fail(
      `Agent ${request.agentId} changed while recording contact`
    );
  }

  private async recordOnce(
    id: AgentId,
    request: RecordAgentContactRequestDTO
  ): Promise<Result<boolean>> {
    const findResult = await this.agentRepository.findById(id);
    if (findResult.isFailure) {
      return Result.fail(findResult.error);
    }
    const agent = findResult.value;
    if (agent === null) {
      return Result.fail(`Agent not found: ${request.agentId}`);
    }

    const loadedUpdatedAt = agent.updatedAt;
    // Positive when the agent's clock runs ahead of ours. Includes the
    // message's transit time, which on a live connection is milliseconds
    // against the minute that matters (R12).
    const clockOffsetMs =
      request.sentAt - request.receivedAt.getTime();
    const contactResult = agent.recordContact(
      request.agentVersion,
      clockOffsetMs,
      request.receivedAt
    );
    if (contactResult.isFailure) {
      return Result.fail(contactResult.error);
    }

    return this.agentRepository.saveIfUnchanged(
      agent,
      loadedUpdatedAt
    );
  }
}
