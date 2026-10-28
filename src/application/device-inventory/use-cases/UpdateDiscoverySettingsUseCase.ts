import { Result } from 'domain/shared/core';
import { AgentId } from 'domain/shared/ids';
import { IDiscoverySettingsRepository } from 'domain/device-inventory/repository';
import { DiscoverySettings } from 'domain/device-inventory/value-objects';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  DiscoverySettingsDTO,
  UpdateDiscoverySettingsRequestDTO
} from '../dtos';
import { IAgentAssignmentQuery } from '../interfaces';
import { DiscoverySettingsMapper } from '../mappers';

// Shared with the controller, which answers 409 for it (DEV-212).
export const SERVER_SEGMENT_NEEDS_SERVER_ON_SITE =
  'needs an agent — this server is not on the monitored network';

// Replaced as a whole; the next scheduled check reads it (DEV-210).
export class UpdateDiscoverySettingsUseCase extends UseCase<
  UpdateDiscoverySettingsRequestDTO,
  DiscoverySettingsDTO
> {
  constructor(
    private readonly repository: IDiscoverySettingsRepository,
    private readonly agents: IAgentAssignmentQuery,
    logger: ILogger,
    private readonly serverOnSite = true
  ) {
    super(logger, 'UpdateDiscoverySettingsUseCase');
  }

  protected async executeImpl(
    request: UpdateDiscoverySettingsRequestDTO
  ): Promise<Result<DiscoverySettingsDTO>> {
    const settings = DiscoverySettings.create({
      enabled: request.enabled,
      intervalHours: request.intervalHours,
      segments: request.segments
    });
    if (settings.isFailure) return this.fail(settings.error);

    for (const segment of settings.value.segments) {
      if (segment.agentId === null) {
        if (!this.serverOnSite) {
          return this.fail(
            `segment ${segment.cidr} ${SERVER_SEGMENT_NEEDS_SERVER_ON_SITE}`
          );
        }
        continue;
      }
      const check = await this.agents.check(
        AgentId.parse(segment.agentId).value
      );
      if (check.isFailure) {
        return this.fail(`Failed to check the agent: ${check.error}`);
      }
      if (check.value !== 'ASSIGNABLE') {
        return this.fail(
          `segment ${segment.cidr}: agentId must be an agent that is not revoked`
        );
      }
    }

    const saved = await this.repository.save(settings.value);
    if (saved.isFailure) {
      return this.fail(
        `Failed to save discovery settings: ${saved.error}`
      );
    }
    const lastRunAt = await this.repository.lastRunAt();
    return this.ok(
      DiscoverySettingsMapper.toDTO(
        settings.value,
        lastRunAt.isSuccess ? lastRunAt.value : null
      )
    );
  }
}
