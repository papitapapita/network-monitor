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

    const findResult = await this.agentRepository.findById(
      idResult.value
    );
    if (findResult.isFailure) {
      return this.fail(findResult.error);
    }
    const agent = findResult.value;
    if (agent === null) {
      return this.fail(`Agent not found: ${request.agentId}`);
    }

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
      return this.fail(contactResult.error);
    }

    const saveResult = await this.agentRepository.save(agent);
    if (saveResult.isFailure) {
      return this.fail(saveResult.error);
    }
    return this.ok(undefined);
  }
}
