import { IAgentRepository } from 'domain/probe-agents/repository';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { IAgentDeviceCountQuery } from '../interfaces';
import { AgentMapper } from '../mappers';
import { AgentListResponseDTO } from '../dtos';

export class ListAgentsUseCase extends UseCase<
  void,
  AgentListResponseDTO
> {
  constructor(
    private readonly agentRepository: IAgentRepository,
    private readonly deviceCounts: IAgentDeviceCountQuery,
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
    const agents = findResult.value;

    const countResult = await this.deviceCounts.countByAgent(
      agents.map((a) => a.id)
    );
    if (countResult.isFailure) {
      return this.fail(countResult.error);
    }
    return this.ok(AgentMapper.toListDTO(agents, countResult.value));
  }
}
