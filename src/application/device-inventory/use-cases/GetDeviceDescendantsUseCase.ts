import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { ITopologyQuery } from '../interfaces';
import {
  GetDeviceDescendantsRequestDTO,
  TopologyResponseDTO
} from '../dtos';
import { TopologyTree } from '../services';

// What hangs off one device: the device first, then everything below it.
export class GetDeviceDescendantsUseCase extends UseCase<
  GetDeviceDescendantsRequestDTO,
  TopologyResponseDTO
> {
  constructor(
    private readonly topologyQuery: ITopologyQuery,
    logger: ILogger
  ) {
    super(logger, 'GetDeviceDescendantsUseCase');
  }

  protected async executeImpl(
    request: GetDeviceDescendantsRequestDTO
  ): Promise<Result<TopologyResponseDTO>> {
    const idResult = DeviceId.parse(request.deviceId?.trim() ?? '');
    if (idResult.isFailure) {
      return this.fail(`Invalid device ID: ${idResult.error}`);
    }
    const deviceId = idResult.value.toString();

    const rowsResult = await this.topologyQuery.findAll();
    if (rowsResult.isFailure) {
      return this.fail(
        `Failed to load topology: ${rowsResult.error}`
      );
    }

    // Reachability needs the ancestors too, so the whole graph is built and
    // then cut down — not a query of the subtree alone.
    const tree = new TopologyTree(rowsResult.value);
    if (!tree.has(deviceId)) {
      return this.fail(
        `Device not found in the topology: ${deviceId}`
      );
    }

    const nodes = tree.subtree(deviceId);
    return this.ok({ nodes, total: nodes.length });
  }
}
