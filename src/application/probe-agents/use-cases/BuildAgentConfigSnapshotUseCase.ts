import { createHash } from 'crypto';
import { AgentId } from 'domain/shared/ids';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  IAgentDeviceIndex,
  IAgentPollingTargetsQuery
} from '../interfaces';
import {
  AgentConfigDeviceDTO,
  AgentConfigSnapshotDTO
} from '../dtos';

// What the agent should poll and how (ADR 0002, R14): its devices, by index
// (R19), with interval and attempt budget. No credentials until phase 3.
export class BuildAgentConfigSnapshotUseCase extends UseCase<
  { agentId: string },
  AgentConfigSnapshotDTO
> {
  constructor(
    private readonly targets: IAgentPollingTargetsQuery,
    private readonly deviceIndex: IAgentDeviceIndex,
    logger: ILogger
  ) {
    super(logger, 'BuildAgentConfigSnapshotUseCase');
  }

  protected async executeImpl(request: {
    agentId: string;
  }): Promise<Result<AgentConfigSnapshotDTO>> {
    const idResult = AgentId.parse(request.agentId);
    if (idResult.isFailure) {
      return this.fail(`Invalid agent ID: ${idResult.error}`);
    }

    const targetsResult = await this.targets.listForAgent(
      idResult.value
    );
    if (targetsResult.isFailure) {
      return this.fail(targetsResult.error);
    }
    const targets = targetsResult.value;

    const indexResult = await this.deviceIndex.indexesFor(
      idResult.value,
      targets.map((t) => t.deviceId)
    );
    if (indexResult.isFailure) {
      return this.fail(indexResult.error);
    }

    const devices: AgentConfigDeviceDTO[] = [];
    for (const target of targets) {
      const index = indexResult.value.get(target.deviceId);
      if (index === undefined) {
        return this.fail(
          `No index assigned to device ${target.deviceId}`
        );
      }
      devices.push({
        index,
        ipAddress: target.ipAddress,
        intervalSeconds: target.intervalSeconds,
        failuresBeforeDown: target.failuresBeforeDown
      });
    }
    devices.sort((a, b) => a.index - b.index);

    return this.ok({ version: this.versionOf(devices), devices });
  }

  private versionOf(devices: AgentConfigDeviceDTO[]): string {
    return createHash('sha256')
      .update(JSON.stringify(devices))
      .digest('hex')
      .slice(0, 16);
  }
}
