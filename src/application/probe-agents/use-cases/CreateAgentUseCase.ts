import { Agent, AgentName } from 'domain/probe-agents';
import { IAgentRepository } from 'domain/probe-agents/repository';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { IAgentSecretService } from '../interfaces';
import { AgentMapper } from '../mappers';
import { PairingKey } from '../services';
import {
  AgentPairingResponseDTO,
  CreateAgentRequestDTO
} from '../dtos';

export const AGENT_PUBLIC_URL_MISSING =
  'Agent pairing is not available: AGENT_PUBLIC_URL is not configured';

export class CreateAgentUseCase extends UseCase<
  CreateAgentRequestDTO,
  AgentPairingResponseDTO
> {
  constructor(
    private readonly agentRepository: IAgentRepository,
    private readonly secrets: IAgentSecretService,
    private readonly backendUrl: string | null,
    logger: ILogger
  ) {
    super(logger, 'CreateAgentUseCase');
  }

  protected async beforeExecute(
    request: CreateAgentRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.name?.trim()) {
      return Result.fail('Agent name is required');
    }
    return null;
  }

  protected async executeImpl(
    request: CreateAgentRequestDTO
  ): Promise<Result<AgentPairingResponseDTO>> {
    if (this.backendUrl === null) {
      return this.fail(AGENT_PUBLIC_URL_MISSING);
    }

    const nameResult = AgentName.create(request.name);
    if (nameResult.isFailure) {
      return this.fail(nameResult.error);
    }

    const pairingCode = this.secrets.generate();
    const agentResult = Agent.create(
      nameResult.value,
      this.secrets.hash(pairingCode)
    );
    if (agentResult.isFailure) {
      return this.fail(agentResult.error);
    }

    const saveResult = await this.agentRepository.save(
      agentResult.value
    );
    if (saveResult.isFailure) {
      return this.fail(saveResult.error);
    }

    return this.ok({
      agent: AgentMapper.toDTO(saveResult.value),
      pairingKey: PairingKey.format({
        backendUrl: this.backendUrl,
        pairingCode
      })
    });
  }

  protected sanitizeForLogging(data: unknown): unknown {
    if (data && typeof data === 'object' && 'pairingKey' in data) {
      return { ...data, pairingKey: '[redacted]' };
    }
    return data;
  }
}
