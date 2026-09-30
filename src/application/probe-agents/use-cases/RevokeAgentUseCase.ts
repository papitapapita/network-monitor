import { IAgentRepository } from 'domain/probe-agents/repository';
import { AgentId } from 'domain/shared/ids';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { IAgentDeviceCountQuery } from '../interfaces';
import { AgentMapper } from '../mappers';
import { AgentIdRequestDTO, AgentResponseDTO } from '../dtos';

export class RevokeAgentUseCase extends UseCase<
  AgentIdRequestDTO,
  AgentResponseDTO
> {
  constructor(
    private readonly agentRepository: IAgentRepository,
    private readonly deviceCounts: IAgentDeviceCountQuery,
    logger: ILogger
  ) {
    super(logger, 'RevokeAgentUseCase');
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
    const agent = findResult.value;
    if (agent === null) {
      return this.fail(`Agent not found: ${request.id}`);
    }

    const revokeResult = agent.revoke();
    if (revokeResult.isFailure) {
      return this.fail(revokeResult.error);
    }

    const saveResult = await this.agentRepository.save(agent);
    if (saveResult.isFailure) {
      return this.fail(saveResult.error);
    }

    const countResult = await this.deviceCounts.countByAgent([
      agent.id
    ]);
    if (countResult.isFailure) {
      return this.fail(countResult.error);
    }
    return this.ok(
      AgentMapper.toDTO(saveResult.value, countResult.value)
    );
  }
}
