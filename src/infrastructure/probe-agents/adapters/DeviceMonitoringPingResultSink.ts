import { Result } from 'domain/shared/core';
import {
  AgentPingResult,
  IAgentPingResultSink
} from 'application/probe-agents/interfaces';
import { IngestPingResultsUseCase } from 'application/device-monitoring/use-cases';

// Hands an agent's result to device-monitoring, which owns DeviceState.
export class DeviceMonitoringPingResultSink
  implements IAgentPingResultSink
{
  constructor(private readonly ingest: IngestPingResultsUseCase) {}

  async accept(result: AgentPingResult): Promise<Result<void>> {
    const ingestResult = await this.ingest.execute({
      deviceId: result.deviceId,
      outcome: result.outcome,
      measuredAt: result.measuredAt,
      source: {
        resultId: result.resultId,
        receivedAt: result.receivedAt
      }
    });
    return ingestResult.isFailure
      ? Result.fail(ingestResult.error)
      : Result.ok();
  }
}
