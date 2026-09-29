import { IAgentRepository } from 'domain/probe-agents/repository';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { MarkSilentAgentsOfflineResponseDTO } from '../dtos';

// R6: an active agent silent for Agent.OFFLINE_AFTER_MS goes OFFLINE, once.
// The alert itself is the AgentWentOfflineEvent handler's job.
export class MarkSilentAgentsOfflineUseCase extends UseCase<
  void,
  MarkSilentAgentsOfflineResponseDTO
> {
  constructor(
    private readonly agentRepository: IAgentRepository,
    logger: ILogger
  ) {
    super(logger, 'MarkSilentAgentsOfflineUseCase');
  }

  protected async executeImpl(): Promise<
    Result<MarkSilentAgentsOfflineResponseDTO>
  > {
    const findResult = await this.agentRepository.findAll();
    if (findResult.isFailure) {
      return this.fail(findResult.error);
    }

    const now = new Date();
    const markedOffline: string[] = [];
    for (const agent of findResult.value) {
      if (!agent.isOverdue(now)) continue;

      const loadedUpdatedAt = agent.updatedAt;
      const markResult = agent.markOffline(now);
      if (markResult.isFailure) {
        this.logger.warn('Agent could not be marked offline', {
          agentId: agent.id.toString(),
          error: markResult.error
        });
        continue;
      }
      // A miss means the agent reported in after we read it: it is not
      // silent any more, so there is nothing to mark.
      const saveResult = await this.agentRepository.saveIfUnchanged(
        agent,
        loadedUpdatedAt
      );
      if (saveResult.isFailure) {
        this.logger.error(
          'Agent offline state not saved',
          new Error(saveResult.error),
          { agentId: agent.id.toString() }
        );
        continue;
      }
      if (saveResult.value) markedOffline.push(agent.id.toString());
    }
    return this.ok({ markedOffline });
  }
}
