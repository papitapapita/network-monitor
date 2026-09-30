import { IAgentRepository } from 'domain/probe-agents/repository';
import { AgentId } from 'domain/shared/ids';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  IAgentDeviceCountQuery,
  IAgentSecretService
} from '../interfaces';
import { AgentMapper } from '../mappers';
import { formatPairingKey } from 'agent/protocol';
import { AgentIdRequestDTO, AgentPairingResponseDTO } from '../dtos';
import { AGENT_PUBLIC_URL_MISSING } from './CreateAgentUseCase';

export class ReissuePairingKeyUseCase extends UseCase<
  AgentIdRequestDTO,
  AgentPairingResponseDTO
> {
  constructor(
    private readonly agentRepository: IAgentRepository,
    private readonly deviceCounts: IAgentDeviceCountQuery,
    private readonly secrets: IAgentSecretService,
    private readonly backendUrl: string | null,
    logger: ILogger
  ) {
    super(logger, 'ReissuePairingKeyUseCase');
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
  ): Promise<Result<AgentPairingResponseDTO>> {
    if (this.backendUrl === null) {
      return this.fail(AGENT_PUBLIC_URL_MISSING);
    }

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

    const pairingCode = this.secrets.generate();
    const reissueResult = agent.reissuePairingCode(
      this.secrets.hash(pairingCode)
    );
    if (reissueResult.isFailure) {
      return this.fail(reissueResult.error);
    }

    const saveResult = await this.agentRepository.save(agent);
    if (saveResult.isFailure) {
      return this.fail(saveResult.error);
    }

    // A pending agent can already have devices (DEV-166).
    const countResult = await this.deviceCounts.countByAgent([
      agent.id
    ]);
    if (countResult.isFailure) {
      return this.fail(countResult.error);
    }

    return this.ok({
      agent: AgentMapper.toDTO(saveResult.value, countResult.value),
      pairingKey: formatPairingKey({
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
