import { IAgentRepository } from 'domain/probe-agents/repository';
import { AgentStatus } from 'domain/probe-agents';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { IAgentSecretService } from '../interfaces';
import {
  AuthenticateAgentRequestDTO,
  AuthenticatedAgentDTO
} from '../dtos';

export const INVALID_AGENT_TOKEN = 'Invalid agent token';

// The token is the whole identity (ADR 0002, R4): nothing the agent says
// about itself is trusted, only which agent holds this token.
export class AuthenticateAgentUseCase extends UseCase<
  AuthenticateAgentRequestDTO,
  AuthenticatedAgentDTO
> {
  constructor(
    private readonly agentRepository: IAgentRepository,
    private readonly secrets: IAgentSecretService,
    logger: ILogger
  ) {
    super(logger, 'AuthenticateAgentUseCase');
  }

  protected async beforeExecute(
    request: AuthenticateAgentRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.token?.trim()) {
      return Result.fail(INVALID_AGENT_TOKEN);
    }
    return null;
  }

  protected async executeImpl(
    request: AuthenticateAgentRequestDTO
  ): Promise<Result<AuthenticatedAgentDTO>> {
    const findResult = await this.agentRepository.findByTokenHash(
      this.secrets.hash(request.token.trim())
    );
    if (findResult.isFailure) {
      return this.fail(findResult.error);
    }
    const agent = findResult.value;
    if (agent === null || agent.status !== AgentStatus.ACTIVE) {
      return this.fail(INVALID_AGENT_TOKEN);
    }
    return this.ok({
      agentId: agent.id.toString(),
      agentName: agent.name.value
    });
  }

  protected sanitizeForLogging(data: unknown): unknown {
    if (data && typeof data === 'object' && 'token' in data) {
      return { ...data, token: '[redacted]' };
    }
    return data;
  }
}
