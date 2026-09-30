import { IAgentRepository } from 'domain/probe-agents/repository';
import { AgentId } from 'domain/shared/ids';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { IAgentOutageQuery } from '../interfaces';
import {
  AgentOutageListResponseDTO,
  ListAgentOutagesRequestDTO
} from '../dtos';

export class ListAgentOutagesUseCase extends UseCase<
  ListAgentOutagesRequestDTO,
  AgentOutageListResponseDTO
> {
  private static readonly DEFAULT_LIMIT = 20;
  private static readonly MAX_LIMIT = 100;

  constructor(
    private readonly agentRepository: IAgentRepository,
    private readonly outages: IAgentOutageQuery,
    logger: ILogger
  ) {
    super(logger, 'ListAgentOutagesUseCase');
  }

  protected async beforeExecute(
    request: ListAgentOutagesRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.id?.trim()) {
      return Result.fail('Agent ID is required');
    }
    return null;
  }

  protected async executeImpl(
    request: ListAgentOutagesRequestDTO
  ): Promise<Result<AgentOutageListResponseDTO>> {
    const idResult = AgentId.parse(request.id.trim());
    if (idResult.isFailure) {
      return this.fail(`Invalid agent ID: ${idResult.error}`);
    }

    // An agent with no outages answers an empty page; an unknown one, 404.
    const findResult = await this.agentRepository.findById(
      idResult.value
    );
    if (findResult.isFailure) {
      return this.fail(findResult.error);
    }
    if (findResult.value === null) {
      return this.fail(`Agent not found: ${request.id}`);
    }

    const limit = Math.min(
      request.limit ?? ListAgentOutagesUseCase.DEFAULT_LIMIT,
      ListAgentOutagesUseCase.MAX_LIMIT
    );
    const offset = request.offset ?? 0;

    const pageResult = await this.outages.list(idResult.value, {
      limit,
      offset
    });
    if (pageResult.isFailure) {
      return this.fail(pageResult.error);
    }
    const { outages, total } = pageResult.value;
    return this.ok({
      outages,
      total,
      limit,
      offset,
      hasMore: offset + outages.length < total
    });
  }
}
