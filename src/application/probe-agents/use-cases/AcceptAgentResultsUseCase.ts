import { AgentId } from 'domain/shared/ids';
import { IAgentRepository } from 'domain/probe-agents/repository';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  IAgentDeviceIndex,
  IAgentPingResultSink
} from '../interfaces';
import {
  AcceptAgentResultsRequestDTO,
  AcceptAgentResultsResponseDTO
} from '../dtos';

// Turns a batch of results from one agent into per-device ingests. A result
// is acknowledged once the agent may forget it: stored, already stored, or
// dropped on purpose. One that failed to store is left unacknowledged, so the
// agent keeps it and sends it again.
//
// Timestamps are moved onto the backend's clock with the agent's last
// measured offset (ADR 0002, R12), and never past the batch's arrival: a
// result from the future would read as newer than every live one after it.
export class AcceptAgentResultsUseCase extends UseCase<
  AcceptAgentResultsRequestDTO,
  AcceptAgentResultsResponseDTO
> {
  constructor(
    private readonly agentRepository: IAgentRepository,
    private readonly deviceIndex: IAgentDeviceIndex,
    private readonly sink: IAgentPingResultSink,
    logger: ILogger
  ) {
    super(logger, 'AcceptAgentResultsUseCase');
  }

  protected async executeImpl(
    request: AcceptAgentResultsRequestDTO
  ): Promise<Result<AcceptAgentResultsResponseDTO>> {
    const idResult = AgentId.parse(request.agentId);
    if (idResult.isFailure) {
      return this.fail(`Invalid agent ID: ${idResult.error}`);
    }

    const agentResult = await this.agentRepository.findById(
      idResult.value
    );
    if (agentResult.isFailure) {
      return this.fail(agentResult.error);
    }
    if (agentResult.value === null) {
      return this.fail(`Agent not found: ${request.agentId}`);
    }
    const clockOffsetMs = agentResult.value.clockOffsetMs ?? 0;
    const receivedAtMs = request.receivedAt.getTime();

    const indexes = [
      ...new Set(request.results.map((r) => r.deviceIndex))
    ];
    const resolveResult = await this.deviceIndex.resolveAssigned(
      idResult.value,
      indexes
    );
    if (resolveResult.isFailure) {
      return this.fail(resolveResult.error);
    }
    const devices = resolveResult.value;

    const acknowledged: string[] = [];
    let dropped = 0;
    for (const result of request.results) {
      const deviceId = devices.get(result.deviceIndex);
      // Unknown index, or a device since moved to another agent or back
      // in-process: this agent no longer speaks for it.
      if (deviceId === undefined) {
        dropped++;
        acknowledged.push(result.id);
        continue;
      }

      const acceptResult = await this.sink.accept({
        deviceId,
        resultId: result.id,
        outcome: result.outcome,
        measuredAt: new Date(
          Math.min(
            result.measuredAt.getTime() - clockOffsetMs,
            receivedAtMs
          )
        ),
        receivedAt: request.receivedAt
      });
      if (acceptResult.isFailure) {
        this.logger.warn(
          'Agent result not stored; agent will resend',
          {
            agentId: request.agentId,
            resultId: result.id,
            error: acceptResult.error
          }
        );
        continue;
      }
      acknowledged.push(result.id);
    }

    if (dropped > 0) {
      this.logger.info(
        'Dropped results for devices not on this agent',
        {
          agentId: request.agentId,
          dropped
        }
      );
    }
    return this.ok({ acknowledged });
  }

  protected sanitizeForLogging(data: unknown): unknown {
    if (data && typeof data === 'object' && 'results' in data) {
      const { results, ...rest } = data as { results: unknown[] };
      return { ...rest, resultCount: results.length };
    }
    if (data && typeof data === 'object' && 'acknowledged' in data) {
      return {
        acknowledgedCount: (data as { acknowledged: unknown[] })
          .acknowledged.length
      };
    }
    return data;
  }
}
