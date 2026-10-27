import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { ITopologyQuery } from '../interfaces';
import { TopologyResponseDTO } from '../dtos';
import { TopologyTree } from '../services';

export class GetTopologyUseCase extends UseCase<
  Record<string, never>,
  TopologyResponseDTO
> {
  constructor(
    private readonly topologyQuery: ITopologyQuery,
    logger: ILogger
  ) {
    super(logger, 'GetTopologyUseCase');
  }

  protected async executeImpl(
    _request: Record<string, never>
  ): Promise<Result<TopologyResponseDTO>> {
    const rowsResult = await this.topologyQuery.findAll();
    if (rowsResult.isFailure) {
      return this.fail(
        `Failed to load topology: ${rowsResult.error}`
      );
    }

    const nodes = new TopologyTree(rowsResult.value).nodes();
    return this.ok({ nodes, total: nodes.length });
  }
}
