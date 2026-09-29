import { IAgentRepository } from 'domain/probe-agents/repository';
import { AgentId } from 'domain/shared/ids';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { AgentMapper } from '../mappers';
import { AgentIdRequestDTO, AgentResponseDTO } from '../dtos';

export class GetAgentUseCase extends UseCase<
  AgentIdRequestDTO,
  AgentResponseDTO
> {
  constructor(
    private readonly agentRepository: IAgentRepository,
    logger: ILogger
  ) {
    super(logger, 'GetAgentUseCase');
  }

  protected async beforeExecute(
    request: AgentIdRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.id?.trim()) {
      return Result.fail('Agent ID is required');
    }
    return null;
  }

  protected async executeImpl(
    request: AgentIdRequestDTO
  ): Promise<Result<AgentResponseDTO>> {
    const idResult = AgentId.parse(request.id.trim());
    if (idResult.isFailure) {
      return this.fail(`Invalid agent ID: ${idResult.error}`);
    }

    const findResult = await this.agentRepository.findById(
      idResult.value
    );
    if (findResult.isFailure) {
      return this.fail(findResult.error);
    }
    if (findResult.value === null) {
      return this.fail(`Agent not found: ${request.id}`);
    }
    return this.ok(AgentMapper.toDTO(findResult.value));
  }
}
