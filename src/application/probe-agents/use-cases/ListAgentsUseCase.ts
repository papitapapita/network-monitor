import { IAgentRepository } from 'domain/probe-agents/repository';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { AgentMapper } from '../mappers';
import { AgentListResponseDTO } from '../dtos';

export class ListAgentsUseCase extends UseCase<
  void,
  AgentListResponseDTO
> {
  constructor(
    private readonly agentRepository: IAgentRepository,
    logger: ILogger
  ) {
    super(logger, 'ListAgentsUseCase');
  }

  protected async executeImpl(): Promise<
    Result<AgentListResponseDTO>
  > {
    const findResult = await this.agentRepository.findAll();
    if (findResult.isFailure) {
      return this.fail(findResult.error);
    }
    return this.ok(AgentMapper.toListDTO(findResult.value));
  }
}
