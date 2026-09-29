import { IAgentRepository } from 'domain/probe-agents/repository';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { IAgentSecretService } from '../interfaces';
import {
  EnrollAgentRequestDTO,
  EnrollAgentResponseDTO
} from '../dtos';

// One answer for every rejection — unknown, used, expired, revoked — so the
// endpoint cannot be used to learn which codes exist. The real reason is
// logged.
export const INVALID_PAIRING_CODE = 'Invalid or expired pairing code';

export class EnrollAgentUseCase extends UseCase<
  EnrollAgentRequestDTO,
  EnrollAgentResponseDTO
> {
  constructor(
    private readonly agentRepository: IAgentRepository,
    private readonly secrets: IAgentSecretService,
    logger: ILogger
  ) {
    super(logger, 'EnrollAgentUseCase');
  }

  protected async beforeExecute(
    request: EnrollAgentRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.pairingCode?.trim()) {
      return Result.fail('Pairing code is required');
    }
    return null;
  }

  protected async executeImpl(
    request: EnrollAgentRequestDTO
  ): Promise<Result<EnrollAgentResponseDTO>> {
    const codeHash = this.secrets.hash(request.pairingCode.trim());

    const findResult =
      await this.agentRepository.findByPairingCodeHash(codeHash);
    if (findResult.isFailure) {
      return this.fail(findResult.error);
    }
    const agent = findResult.value;
    if (agent === null) {
      return this.reject('no agent holds this pairing code');
    }

    const token = this.secrets.generate();
    const enrollResult = agent.enroll(this.secrets.hash(token));
    if (enrollResult.isFailure) {
      return this.reject(enrollResult.error, agent.id.toString());
    }

    const saveResult = await this.agentRepository.saveEnrollment(
      agent,
      codeHash
    );
    if (saveResult.isFailure) {
      return this.fail(saveResult.error);
    }
    if (saveResult.value === null) {
      return this.reject(
        'pairing code was consumed by a concurrent enrollment',
        agent.id.toString()
      );
    }

    this.logger.info('Agent enrolled', {
      agentId: agent.id.toString(),
      agentName: agent.name.value
    });
    return this.ok({ token, agentName: agent.name.value });
  }

  private reject(
    reason: string,
    agentId?: string
  ): Result<EnrollAgentResponseDTO> {
    this.logger.warn('Agent enrollment rejected', {
      reason,
      agentId
    });
    return this.fail(INVALID_PAIRING_CODE);
  }

  protected sanitizeForLogging(data: unknown): unknown {
    if (data && typeof data === 'object') {
      const redacted: Record<string, unknown> = { ...data };
      if ('pairingCode' in redacted)
        redacted.pairingCode = '[redacted]';
      if ('token' in redacted) redacted.token = '[redacted]';
      return redacted;
    }
    return data;
  }
}
